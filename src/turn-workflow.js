function canonical(value) {
  return String(value || '').trim().toUpperCase();
}

function rootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

function planningTurnKeyFromResult(resultTurn) {
  const explicit = String(resultTurn?.metadata?.nextTurn || '').trim();
  if (/^\d+[-_]\d+$/.test(explicit)) return explicit;
  const current = String(resultTurn?.turnKey || '').trim();
  const match = current.match(/^(\d+)([-_])(\d+)$/);
  if (!match) return current || null;
  const nextPart = String(Number(match[3]) + 1).padStart(match[3].length, '0');
  return `${match[1]}${match[2]}${nextPart}`;
}

function resultSkills(resultTurn) {
  const byTribe = {};
  for (const unit of resultTurn?.units || []) {
    if (unit.unitType !== 'Tribe') continue;
    byTribe[rootTribe(unit.unitCode)] = Object.entries(unit.skills || {}).map(([name, level]) => ({
      skill: name,
      shortname: name,
      group: null,
      level: Number(level || 0)
    }));
  }
  return byTribe;
}

function resultTurnToStartWorkbook(resultTurn) {
  if (!resultTurn?.turnKey) throw new Error('A result turn is required to build the turn baseline.');
  const planningTurnKey = planningTurnKeyFromResult(resultTurn);
  const skillsByTribe = resultSkills(resultTurn);
  const units = (resultTurn.units || []).map(unit => {
    const parentTribe = rootTribe(unit.unitCode);
    const people = unit.people || {};
    const ordinaryPeople = Number(people.People ?? (
      Number(people.Warriors || 0) + Number(people.Actives || 0) + Number(people.Inactives || 0)
    ));
    const slaves = Number(people.Slaves ?? people.Slave ?? 0);
    return {
      unit: unit.unitCode,
      unitName: unit.unitName || null,
      type: unit.unitType || 'Unit',
      parentTribe,
      startHex: unit.currentHex || null,
      warrior: Number(people.Warriors || 0),
      active: Number(people.Actives || 0),
      inactive: Number(people.Inactives || 0),
      slave: slaves,
      eaters: Math.max(0, ordinaryPeople + slaves),
      locals: Number(people.Locals || 0),
      workers: Math.max(0, Number(people.Warriors || 0) + Number(people.Actives || 0) + slaves),
      used: 0,
      remains: Math.max(0, Number(people.Warriors || 0) + Number(people.Actives || 0) + slaves),
      skills: skillsByTribe[parentTribe] || []
    };
  });

  return {
    role: 'start',
    sourceKind: 'results',
    derivedFromResults: true,
    resultTurnKey: resultTurn.turnKey,
    turnKey: planningTurnKey,
    sourceFile: resultTurn.sourceFile || `Turn ${resultTurn.turnKey} results`,
    importedAt: resultTurn.importedAt || new Date().toISOString(),
    units,
    skillsByTribe,
    skillMeta: [],
    activities: [],
    scouts: [],
    movements: [],
    transfers: [],
    rawPlan: null
  };
}

function normalizePopulationKey(item) {
  const key = canonical(item).replace(/\s+/g, ' ');
  const aliases = {
    WARRIOR: 'warriors', WARRIORS: 'warriors',
    ACTIVE: 'actives', ACTIVES: 'actives',
    INACTIVE: 'inactives', INACTIVES: 'inactives',
    SLAVE: 'slaves', SLAVES: 'slaves',
    HIRELING: 'hirelings', HIRELINGS: 'hirelings',
    MERC: 'mercs', MERCS: 'mercs', MERCENARY: 'mercs', MERCENARIES: 'mercs',
    LOCAL: 'locals', LOCALS: 'locals',
    RESIDENT: 'residents', RESIDENTS: 'residents',
    FOLLOWER: 'followers', FOLLOWERS: 'followers',
    AUXILIARY: 'auxiliaries', AUXILIARIES: 'auxiliaries',
    CATTLE: 'cattle',
    GOAT: 'goats', GOATS: 'goats',
    HORSE: 'horses', HORSES: 'horses',
    ELEPHANT: 'elephants', ELEPHANTS: 'elephants',
    DOG: 'dogs', DOGS: 'dogs',
    CAMEL: 'camels', CAMELS: 'camels'
  };
  return aliases[key] || null;
}

function emptyCounts() {
  return {
    warriors: 0, actives: 0, inactives: 0, slaves: 0,
    hirelings: 0, mercs: 0, locals: 0, residents: 0, followers: 0, auxiliaries: 0,
    cattle: 0, goats: 0, horses: 0, elephants: 0, dogs: 0, camels: 0
  };
}

function clampCounts(counts) {
  for (const key of Object.keys(counts)) counts[key] = Math.max(0, Number(counts[key] || 0));
  return counts;
}

function countsFromResultUnit(unit) {
  const counts = emptyCounts();
  const people = unit?.people || {};
  counts.warriors = Number(people.Warriors || 0);
  counts.actives = Number(people.Actives || 0);
  counts.inactives = Number(people.Inactives || 0);
  counts.slaves = Number(people.Slaves ?? people.Slave ?? 0);
  counts.hirelings = Number(people.Hirelings || 0);
  counts.mercs = Number(people.Mercenaries ?? people.Mercs ?? 0);
  counts.locals = Number(people.Locals || 0);
  counts.residents = Number(people.Residents || 0);
  counts.followers = Number(people.Followers || 0);
  counts.auxiliaries = Number(people.Auxiliaries || 0);

  const animals = unit?.resources?.Animals || {};
  counts.cattle = Number(animals.Cattle || 0);
  counts.goats = Number(animals.Goat ?? animals.Goats ?? 0);
  counts.horses = Number(animals.Horse ?? animals.Horses ?? 0);
  counts.elephants = Number(animals.Elephant ?? animals.Elephants ?? 0);
  counts.dogs = Number(animals.Dog ?? animals.Dogs ?? 0);
  counts.camels = Number(animals.Camel ?? animals.Camels ?? 0);

  const explicitPeople = Number(people.People);
  const enumeratedOrdinary = counts.warriors + counts.actives + counts.inactives + counts.hirelings
    + counts.mercs + counts.locals + counts.residents + counts.followers + counts.auxiliaries;
  if (Number.isFinite(explicitPeople) && explicitPeople > enumeratedOrdinary) {
    counts.locals += explicitPeople - enumeratedOrdinary;
  }
  return clampCounts(counts);
}

function countsByUnitFromPlan(plan) {
  const states = new Map();
  const ensure = unitCode => {
    const key = String(unitCode || '').trim();
    if (!states.has(key)) states.set(key, emptyCounts());
    return states.get(key);
  };

  for (const row of plan?.clan || []) {
    const state = ensure(row.unit);
    Object.assign(state, {
      warriors: Number(row.warrior || 0), actives: Number(row.active || 0), inactives: Number(row.inactive || 0),
      slaves: Number(row.slave || 0), hirelings: Number(row.hirelings || 0), mercs: Number(row.mercs || 0),
      locals: Number(row.locals || 0), residents: Number(row.residents || 0), followers: Number(row.followers || 0),
      auxiliaries: Number(row.auxiliaries || 0), cattle: Number(row.cattle || 0), goats: Number(row.goat || 0),
      horses: Number(row.horse || 0), elephants: Number(row.elephant || 0), dogs: Number(row.dog || 0),
      camels: Number(row.camel || 0)
    });
  }
  for (const creation of plan?.unitCreations || []) ensure(creation.unit);

  for (const transfer of plan?.transfers || []) {
    if (canonical(transfer.timing) !== 'BM') continue;
    const field = normalizePopulationKey(transfer.item);
    const qty = Number(transfer.quantity || 0);
    if (!field || !Number.isFinite(qty) || qty === 0) continue;
    const from = ensure(transfer.from);
    const to = ensure(transfer.to);
    from[field] = Math.max(0, Number(from[field] || 0) - qty);
    to[field] = Math.max(0, Number(to[field] || 0) + qty);
  }
  for (const state of states.values()) clampCounts(state);
  return states;
}

function parseCoordinate(input) {
  const match = String(input || '').toUpperCase().replace(/\s+/g, '').match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!match) return null;
  const mapRow = match[1].charCodeAt(0) - 65;
  const mapCol = match[2].charCodeAt(0) - 65;
  const hexCol = Number(match[3]);
  const hexRow = Number(match[4]);
  if (hexCol < 1 || hexCol > 30 || hexRow < 1 || hexRow > 21) return null;
  return { globalCol: mapCol * 30 + hexCol - 1, globalRow: mapRow * 21 + hexRow - 1 };
}

function coordinateFor(globalCol, globalRow) {
  if (globalCol < 0 || globalRow < 0 || globalCol >= 16 * 30 || globalRow >= 26 * 21) return null;
  const mapCol = Math.floor(globalCol / 30);
  const mapRow = Math.floor(globalRow / 21);
  const hexCol = globalCol % 30 + 1;
  const hexRow = globalRow % 21 + 1;
  return `${String.fromCharCode(65 + mapRow)}${String.fromCharCode(65 + mapCol)}${String(hexCol).padStart(2, '0')}${String(hexRow).padStart(2, '0')}`;
}

function stepCoordinate(coordinate, direction) {
  const parsed = parseCoordinate(coordinate);
  if (!parsed) return null;
  let c = parsed.globalCol;
  let r = parsed.globalRow;
  const odd = c % 2 === 1;
  if (direction === 'N') r -= 1;
  else if (direction === 'S') r += 1;
  else if (direction === 'NE') { c += 1; r += odd ? 0 : -1; }
  else if (direction === 'SE') { c += 1; r += odd ? 1 : 0; }
  else if (direction === 'NW') { c -= 1; r += odd ? 0 : -1; }
  else if (direction === 'SW') { c -= 1; r += odd ? 1 : 0; }
  else return null;
  return coordinateFor(c, r);
}

function deriveMovementEnd(startHex, orders) {
  let current = String(startHex || '').toUpperCase().replace(/\s+/g, '');
  if (!parseCoordinate(current)) return { endHex: null, uncertain: true, unresolvedOrder: 'invalid origin' };
  for (const raw of orders || []) {
    const order = canonical(raw);
    if (!order || order === 'EMPTY' || order === 'STILL') continue;
    if (['N', 'NE', 'SE', 'S', 'SW', 'NW'].includes(order)) {
      const next = stepCoordinate(current, order);
      if (!next) return { endHex: current, uncertain: true, unresolvedOrder: order };
      current = next;
      continue;
    }
    return { endHex: current, uncertain: true, unresolvedOrder: order };
  }
  return { endHex: current, uncertain: false, unresolvedOrder: null };
}

function ordinaryPeople(counts) {
  return Number(counts.warriors || 0) + Number(counts.actives || 0) + Number(counts.inactives || 0)
    + Number(counts.hirelings || 0) + Number(counts.mercs || 0) + Number(counts.locals || 0)
    + Number(counts.residents || 0) + Number(counts.followers || 0) + Number(counts.auxiliaries || 0);
}

function calculateSupplyRequirements({ counts, terrain, adjacentTerrains = [], endHex = null, source = 'current', uncertain = false }) {
  const normalizedTerrain = canonical(terrain || 'UNKNOWN');
  const neighbors = (adjacentTerrains || []).map(canonical).filter(Boolean);
  const known = normalizedTerrain && normalizedTerrain !== 'UNKNOWN';
  const adjacentFreshWater = neighbors.includes('L');
  const coastalOcean = normalizedTerrain === 'O' && neighbors.some(value => value !== 'O' && value !== 'UNKNOWN');

  const dryLand = normalizedTerrain === 'AR' || normalizedTerrain === 'DE';
  const waterRestricted = (dryLand && !adjacentFreshWater)
    || (normalizedTerrain === 'O' && !coastalOcean);
  const fodderRestricted = dryLand || (normalizedTerrain === 'O' && !coastalOcean);

  const ordinary = ordinaryPeople(counts || emptyCounts());
  const slaves = Number(counts?.slaves || 0);
  const goats = Number(counts?.goats || 0);
  const dogs = Number(counts?.dogs || 0);
  const cattle = Number(counts?.cattle || 0);
  const horses = Number(counts?.horses || 0);
  const elephants = Number(counts?.elephants || 0);
  const camels = Number(counts?.camels || 0);

  const rawWater = ordinary * 10 + (slaves + goats + dogs) * 5 + (cattle + horses) * 20 + elephants * 30;
  const rawFodder = horses * 8 + cattle * 5 + goats + elephants * 12;
  const hasFodderAnimals = goats + cattle + horses + elephants > 0;

  let reason;
  if (!known) reason = 'Ending terrain is unknown, so stored Water/Fodder need cannot yet be confirmed.';
  else if (dryLand && adjacentFreshWater) reason = `${normalizedTerrain === 'AR' ? 'Arid' : 'Desert'} ending hex has a known adjacent fresh-water source; stored water is not required, but herd animals still need fodder.`;
  else if (normalizedTerrain === 'O' && coastalOcean) reason = 'Ending Ocean hex is known to be coastal; the non-coastal-ocean Water/Fodder rule does not apply.';
  else if (waterRestricted || fodderRestricted) reason = 'This ending terrain requires stored supplies at the end of the turn.';
  else reason = 'This ending terrain has normal local access; no special stored Water/Fodder is required.';

  if (camels > 0 && (waterRestricted || fodderRestricted)) {
    reason += ' Camel Water/Fodder rates are not specified in the current Mandate table, so camels are flagged but not added to the numeric requirement.';
  }

  return {
    known,
    endHex,
    terrain: normalizedTerrain || 'UNKNOWN',
    source,
    uncertain: Boolean(uncertain),
    adjacentFreshWater,
    coastalOcean,
    waterRequired: known && waterRestricted ? rawWater : 0,
    fodderRequired: known && fodderRestricted && hasFodderAnimals ? rawFodder : 0,
    waterRestricted: known ? waterRestricted : null,
    fodderRestricted: known ? fodderRestricted : null,
    counts: { ordinaryPeople: ordinary, slaves, goats, dogs, cattle, horses, elephants, camels },
    reason
  };
}

module.exports = {
  rootTribe,
  planningTurnKeyFromResult,
  resultTurnToStartWorkbook,
  countsFromResultUnit,
  countsByUnitFromPlan,
  deriveMovementEnd,
  calculateSupplyRequirements,
  parseCoordinate,
  stepCoordinate
};

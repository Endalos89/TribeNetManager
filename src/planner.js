const path = require('path');
const XLSX = require('xlsx');

function sheetRecords(workbook, name, headerRow = 0) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, range: headerRow });
}

function clean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

function cleanUnit(value) {
  const v = clean(value);
  return v === null ? null : String(v).trim();
}

function canonicalItem(value) {
  return String(clean(value) || '').trim().toUpperCase();
}

function normalizeHex(value) {
  const v = clean(value);
  if (!v) return null;
  const compact = String(v).toUpperCase().replace(/\s+/g, '');
  const m = compact.match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!m) return String(v).toUpperCase();
  return `${m[1]}${m[2]}${m[3]}${m[4]}`;
}

function collectMovement(row, prefix, count) {
  const orders = [];
  for (let i = 1; i <= count; i++) {
    const raw = clean(row[`${prefix}${i}`] ?? row[`${prefix}_${i}`]);
    if (!raw) continue;
    const value = String(raw).trim().toUpperCase();
    if (value === 'EMPTY') continue;
    orders.push(value);
  }
  return orders;
}

function inferTurnKey(filename) {
  const base = path.basename(filename, path.extname(filename));
  const patterns = [
    /(?:^|_)(\d{3})[_-](\d{1,2})(?:_|$)/,
    /(?:^|\s)(\d{3})[-_](\d{1,2})(?:\s|$)/
  ];
  for (const pattern of patterns) {
    const m = base.match(pattern);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return base;
}

function parseCreation(text, unitHint = null) {
  const s = String(text || '');
  const m = s.match(/create\s+(tribe|element|fleet|garrison|courier)\s+([0-9]{4}(?:[a-z]\d+)?)\s+from\s+(?:tribe|element|fleet|garrison|courier)?\s*([0-9]{4}(?:[a-z]\d+)?)/i);
  if (!m) return null;
  return {
    type: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(),
    unit: m[2],
    parentUnit: m[3],
    creationPhase: /after\s+movement/i.test(s) ? 'after' : 'before',
    source: unitHint || null,
    text: s
  };
}

function unitType(unit) {
  const s = String(unit || '').toLowerCase();
  if (/^\d{4}$/.test(s)) return 'Tribe';
  if (/^\d{4}e\d+$/.test(s)) return 'Element';
  if (/^\d{4}f\d+$/.test(s)) return 'Fleet';
  if (/^\d{4}g\d+$/.test(s)) return 'Garrison';
  if (/^\d{4}c\d+$/.test(s)) return 'Courier';
  return 'Unit';
}

const EATER_TRANSFER_ITEMS = new Set([
  'WARRIORS', 'ACTIVES', 'INACTIVES', 'SLAVE', 'SLAVES', 'HIRELINGS', 'MERCENARIES',
  'RESIDENTS', 'FOLLOWERS', 'AUXILIARIES'
]);

function emptyUnitState(unit, type = null, unitName = null) {
  return {
    unit,
    unitName,
    type: type || unitType(unit),
    warrior: 0,
    active: 0,
    inactive: 0,
    slave: 0,
    eaters: 0,
    locals: 0,
    cattle: 0,
    dog: 0,
    elephant: 0,
    goat: 0,
    horse: 0,
    camel: 0,
    inventory: {}
  };
}

function ensureUnitState(states, unit, type = null, unitName = null) {
  if (!states.has(unit)) states.set(unit, emptyUnitState(unit, type, unitName));
  const state = states.get(unit);
  if (type && (!state.type || state.type === 'Unit')) state.type = type;
  if (unitName && !state.unitName) state.unitName = unitName;
  return state;
}

function changeInventory(state, item, amount) {
  const key = canonicalItem(item);
  if (!key || !Number.isFinite(amount) || amount === 0) return;
  state.inventory[key] = Math.max(0, Number(state.inventory[key] || 0) + amount);
}

function changePopulation(state, item, amount) {
  const key = canonicalItem(item);
  if (key === 'WARRIORS') state.warrior = Math.max(0, state.warrior + amount);
  else if (key === 'ACTIVES') state.active = Math.max(0, state.active + amount);
  else if (key === 'INACTIVES') state.inactive = Math.max(0, state.inactive + amount);
  else if (key === 'SLAVE' || key === 'SLAVES') state.slave = Math.max(0, state.slave + amount);
  else if (key === 'LOCALS') state.locals = Math.max(0, state.locals + amount);

  if (EATER_TRANSFER_ITEMS.has(key)) state.eaters = Math.max(0, state.eaters + amount);

  if (key === 'CATTLE') state.cattle = Math.max(0, state.cattle + amount);
  else if (key === 'DOG' || key === 'DOGS') state.dog = Math.max(0, state.dog + amount);
  else if (key === 'ELEPHANT' || key === 'ELEPHANTS') state.elephant = Math.max(0, state.elephant + amount);
  else if (key === 'GOAT' || key === 'GOATS') state.goat = Math.max(0, state.goat + amount);
  else if (key === 'HORSE' || key === 'HORSES') state.horse = Math.max(0, state.horse + amount);
  else if (key === 'CAMEL' || key === 'CAMELS') state.camel = Math.max(0, state.camel + amount);
}

function buildGoodsMetadata(workbook) {
  const meta = new Map();
  for (const row of sheetRecords(workbook, 'Valid Goods')) {
    const item = canonicalItem(row.Goods);
    if (!item) continue;
    const weight = Number(row.Weight);
    meta.set(item, {
      item,
      table: clean(row.Table),
      shortname: clean(row.Shortname),
      weight: Number.isFinite(weight) ? weight : null
    });
  }
  return meta;
}

function buildMovementUnitStats({ workbook, clan, transfers, unitCreations, movements, unitsById }) {
  const goodsMeta = buildGoodsMetadata(workbook);
  const states = new Map();

  for (const row of clan) {
    states.set(row.unit, {
      ...emptyUnitState(row.unit, row.type, row.unitName),
      warrior: row.warrior,
      active: row.active,
      inactive: row.inactive,
      slave: row.slave,
      eaters: row.eaters,
      locals: row.locals,
      cattle: row.cattle,
      dog: row.dog,
      elephant: row.elephant,
      goat: row.goat,
      horse: row.horse,
      camel: row.camel,
      inventory: {}
    });
  }

  for (const creation of unitCreations) {
    ensureUnitState(states, creation.unit, creation.type, unitsById.get(creation.unit)?.unitName || null);
  }

  for (const movement of movements) {
    ensureUnitState(states, movement.unit, movement.type, movement.unitName);
  }

  for (const row of sheetRecords(workbook, 'Clan_Goods')) {
    const unit = cleanUnit(row.Tribe);
    const item = canonicalItem(row.Item);
    const qty = Number(row.Number || 0);
    if (!unit || !item || !Number.isFinite(qty)) continue;
    const state = ensureUnitState(states, unit, unitsById.get(unit)?.type, unitsById.get(unit)?.unitName);
    changeInventory(state, item, qty);
  }

  // Movement happens after BM transfers. AM transfers are deliberately excluded from movement load/provision figures.
  for (const transfer of transfers) {
    if (String(transfer.timing || '').toUpperCase() !== 'BM') continue;
    const qty = Number(transfer.quantity || 0);
    if (!qty) continue;
    const from = ensureUnitState(states, transfer.from, unitsById.get(transfer.from)?.type, unitsById.get(transfer.from)?.unitName);
    const to = ensureUnitState(states, transfer.to, unitsById.get(transfer.to)?.type, unitsById.get(transfer.to)?.unitName);
    changeInventory(from, transfer.item, -qty);
    changeInventory(to, transfer.item, qty);
    changePopulation(from, transfer.item, -qty);
    changePopulation(to, transfer.item, qty);
  }

  const startHexByUnit = new Map(movements.map(m => [m.unit, m.startHex]));
  const results = [];

  for (const state of states.values()) {
    const inventoryRows = [];
    const missingWeights = [];
    let carriedWeight = 0;
    for (const [item, quantity] of Object.entries(state.inventory)) {
      if (!quantity) continue;
      const info = goodsMeta.get(item);
      const weightEach = info?.weight;
      if (!Number.isFinite(weightEach)) {
        missingWeights.push(item);
        inventoryRows.push({ item, quantity, weightEach: null, totalWeight: null });
        continue;
      }
      const totalWeight = quantity * weightEach;
      carriedWeight += totalWeight;
      inventoryRows.push({ item, quantity, weightEach, totalWeight });
    }
    inventoryRows.sort((a, b) => (b.totalWeight || 0) - (a.totalWeight || 0));

    const wagons = Number(state.inventory.WAGON || 0);
    const backpacks = Number(state.inventory.BACKPACK || 0);
    const saddlebags = Number(state.inventory.SADDLEBAG || state.inventory.SADDLEBAGS || 0);
    const totalPeople = Math.max(0, Number(state.eaters || 0) + Number(state.locals || 0));

    // Current Mandate: one Horse/Cattle can support two wagons; cattle are allocated before horses.
    const draftAnimalsNeeded = Math.ceil(wagons / 2);
    const cattlePulling = Math.min(state.cattle, draftAnimalsNeeded);
    const horsePulling = Math.min(state.horse, Math.max(0, draftAnimalsNeeded - cattlePulling));
    const draftShortage = Math.max(0, draftAnimalsNeeded - cattlePulling - horsePulling);
    const loadHorses = Math.max(0, state.horse - horsePulling);

    // "Max capacity" assumes the capacity-maximising configuration. A unit is only treated as fully mounted
    // when it has no wagons and has a horse for every person; otherwise people are on foot and spare horses pack-load.
    const fullyMounted = wagons === 0 && totalPeople > 0 && loadHorses >= totalPeople;
    let carryingCapacity = fullyMounted
      ? (totalPeople * 100) + (Math.max(0, loadHorses - totalPeople) * 300)
      : (totalPeople * 30) + (loadHorses * 300);

    const wagonGrossCapacity = wagons * 3000; // Wagon weighs 1000 lb in inventory and has 3000 lb gross CC = 2000 lb net.
    carryingCapacity += wagonGrossCapacity;

    const backpackEligible = fullyMounted ? 0 : Math.max(0, state.warrior + state.active);
    const backpacksUsed = Math.min(backpacks, backpackEligible);
    carryingCapacity += backpacksUsed * 32; // Backpack weighs 2 and adds 32 gross = +30 lb net.

    const saddlebagEligible = Math.max(0, loadHorses + state.camel);
    const saddlebagsUsed = Math.min(saddlebags, saddlebagEligible);
    carryingCapacity += saddlebagsUsed * 104; // Saddlebag weighs 4 and adds 104 gross = +100 lb net.

    const provs = Number(state.inventory.PROVS ?? 0);
    const provisionTurns = state.eaters > 0 ? provs / state.eaters : null;
    const loadPercent = carryingCapacity > 0 ? (carriedWeight / carryingCapacity) * 100 : null;
    const warnings = [];
    if (draftShortage > 0) warnings.push(`Movement blocked: ${draftShortage} more draft animal${draftShortage === 1 ? '' : 's'} needed for ${wagons} wagons.`);
    if (carryingCapacity > 0 && carriedWeight > carryingCapacity) warnings.push(`Over capacity by ${Math.round(carriedWeight - carryingCapacity).toLocaleString()} lb.`);
    if (state.eaters > 0 && provisionTurns < 1) warnings.push('Less than one stored turn of provisions.');
    if (missingWeights.length) warnings.push(`Weight unavailable for: ${missingWeights.join(', ')}.`);
    if (state.camel > 0) warnings.push('Camel base carrying capacity is not included yet; saddlebag bonus is included.');

    results.push({
      unit: state.unit,
      unitName: state.unitName || unitsById.get(state.unit)?.unitName || null,
      type: state.type || unitsById.get(state.unit)?.type || unitType(state.unit),
      startHex: startHexByUnit.get(state.unit) || unitsById.get(state.unit)?.startHex || null,
      warrior: state.warrior,
      active: state.active,
      inactive: state.inactive,
      slave: state.slave,
      locals: state.locals,
      eaters: state.eaters,
      totalPeople,
      provs,
      provisionTurns,
      carriedWeight,
      carryingCapacity,
      loadPercent,
      fullyMounted,
      wagonCount: wagons,
      horseCount: state.horse,
      cattleCount: state.cattle,
      horsePulling,
      cattlePulling,
      draftAnimalsNeeded,
      draftShortage,
      backpacks,
      backpacksUsed,
      saddlebags,
      saddlebagsUsed,
      inventory: inventoryRows,
      warnings,
      calculationBasis: 'Starting workbook inventory plus BM transfers. AM transfers and activity production are excluded from movement load.'
    });
  }

  return results.sort((a, b) => String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
}

function parseOrdersWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellFormula: true });
  const sourceFile = path.basename(filePath);
  const turnKey = inferTurnKey(sourceFile);

  const clan = sheetRecords(workbook, 'Clan')
    .filter(r => cleanUnit(r.Unit) && String(r.Unit).toLowerCase() !== 'totals')
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.Unit), gt: cleanUnit(r.GT),
      warrior: Number(r.Warrior || 0), active: Number(r.Active || 0), inactive: Number(r.Inactive || 0), slave: Number(r.Slave || 0),
      eaters: Number(r.Eaters || 0), provs: Number(r.Provs || 0), months: Number(r.Months || 0),
      hirelings: Number(r.Hirelings || 0), mercs: Number(r.Mercs || 0), locals: Number(r.Locals || 0),
      residents: Number(r.Residents || 0), followers: Number(r.Followers || 0), auxiliaries: Number(r.Auxiliaries || 0),
      cattle: Number(r.Cattle || 0), dog: Number(r.Dog || 0), elephant: Number(r.Elephant || 0), goat: Number(r.Goat || 0),
      horse: Number(r.Horse || 0), camel: Number(r.Camel || 0), type: unitType(r.Unit)
    }));

  const gmActions = sheetRecords(workbook, 'GM Actions')
    .filter(r => cleanUnit(r.Unit) && clean(r['What does the GM need to do?']))
    .map(r => ({ unit: cleanUnit(r.Unit), text: String(r['What does the GM need to do?']).trim() }));

  // Auto-GM has a descriptive first row; its actual headings are on row 2.
  const autoGm = sheetRecords(workbook, 'Auto-GM', 1)
    .filter(r => clean(r.From_Unit) || clean(r.Action) || clean(r.To_Unit))
    .map(r => ({
      fromUnit: cleanUnit(r.From_Unit), action: clean(r.Action), timing: clean(r.Timing),
      toUnit: cleanUnit(r.To_Unit), newUnitDirection: clean(r.NewUnitDirection)
    }));

  const unitCreations = gmActions.map(a => parseCreation(a.text, a.unit)).filter(Boolean);
  for (const row of autoGm) {
    if (String(row.action || '').toLowerCase().includes('create') && row.toUnit) {
      unitCreations.push({
        type: unitType(row.toUnit), unit: row.toUnit, parentUnit: row.fromUnit,
        source: 'Auto-GM', direction: row.newUnitDirection || null,
        text: `${row.action}: ${row.fromUnit || '?'} -> ${row.toUnit}`
      });
    }
  }

  const movements = sheetRecords(workbook, 'Tribe_Movement')
    // Hex is only the optional destination for a GOTO order.  A normal movement
    // row has no Hex value; its origin comes from the Results baseline.
    .filter(r => cleanUnit(r.TRIBE))
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE), type: unitType(r.TRIBE),
      followTribe: cleanUnit(r.FOLLOW_TRIBE), movementType: clean(r.MovementType),
      gotoHex: normalizeHex(r.Hex), startHex: null, orders: collectMovement(r, 'MOVEMENT_', 40), processed: clean(r.Processed)
    }));

  const scouts = sheetRecords(workbook, 'Scout_Movement')
    .filter(r => cleanUnit(r.TRIBE) && Number(r.No_of_Scouts || 0) > 0)
    .map((r, index) => ({
      id: index + 1, unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE),
      noOfScouts: Number(r.No_of_Scouts || 0), noOfHorses: Number(r.No_of_Horses || 0),
      mission: clean(r.Mission) || 'PATROL', orders: collectMovement(r, 'Movement', 9), processed: clean(r.Processed)
    }));

  const transfers = sheetRecords(workbook, 'Transfers')
    .filter(r => cleanUnit(r.From) && cleanUnit(r.To) && clean(r.Item))
    .map(r => ({
      from: cleanUnit(r.From), to: cleanUnit(r.To), item: canonicalItem(r.Item),
      quantity: Number(r.Quantity || 0), timing: clean(r.Transfer_Timing), notes: clean(r.Notes), description: clean(r['Description of Transfer units'])
    }));

  const activities = sheetRecords(workbook, 'Tribes_Activities')
    .filter(r => cleanUnit(r.TRIBE) && clean(r.ACTIVITY))
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE), activity: clean(r.ACTIVITY),
      item: clean(r.ITEM), distinction: clean(r.DISTINCTION), people: Number(r.PEOPLE || 0),
      miningDirection: clean(r.MINING_DIRECTION)
    }));

  const unitsById = new Map();
  for (const u of clan) unitsById.set(u.unit, { unit: u.unit, unitName: u.unitName, type: u.type });
  for (const m of movements) unitsById.set(m.unit, { ...(unitsById.get(m.unit) || {}), unit: m.unit, unitName: m.unitName, type: m.type, startHex: m.startHex });
  for (const c of unitCreations) unitsById.set(c.unit, { ...(unitsById.get(c.unit) || {}), unit: c.unit, type: c.type, parentUnit: c.parentUnit });

  const unitStats = buildMovementUnitStats({ workbook, clan, transfers, unitCreations, movements, unitsById });

  return {
    formatVersion: 2,
    turnKey,
    sourceFile,
    importedAt: new Date().toISOString(),
    clan,
    units: Array.from(unitsById.values()),
    unitStats,
    unitCreations,
    gmActions,
    autoGm,
    transfers,
    activities,
    movements,
    scouts
  };
}

module.exports = { parseOrdersWorkbook };

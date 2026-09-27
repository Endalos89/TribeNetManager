const { rootTribe, countsFromResultUnit, deriveMovementEnd, stepCoordinate } = require('./turn-workflow');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function canonical(value) { return String(value || '').trim().toUpperCase(); }
function skillKey(value) {
  const key = canonical(value).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ({ WOODWORKING: 'WOODWORK' })[key] || key;
}
function itemName(value) { return String(value || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

const COUNT_FIELDS = {
  WARRIOR: 'warriors', WARRIORS: 'warriors', ACTIVE: 'actives', ACTIVES: 'actives',
  INACTIVE: 'inactives', INACTIVES: 'inactives', SLAVE: 'slaves', SLAVES: 'slaves',
  HIRELING: 'hirelings', HIRELINGS: 'hirelings', MERC: 'mercs', MERCS: 'mercs',
  MERCENARY: 'mercs', MERCENARIES: 'mercs', LOCAL: 'locals', LOCALS: 'locals',
  RESIDENT: 'residents', RESIDENTS: 'residents', FOLLOWER: 'followers', FOLLOWERS: 'followers',
  AUXILIARY: 'auxiliaries', AUXILIARIES: 'auxiliaries', CATTLE: 'cattle',
  GOAT: 'goats', GOATS: 'goats', HORSE: 'horses', HORSES: 'horses',
  ELEPHANT: 'elephants', ELEPHANTS: 'elephants', DOG: 'dogs', DOGS: 'dogs',
  CAMEL: 'camels', CAMELS: 'camels'
};
const PEOPLE_FIELDS = new Set(['warriors','actives','inactives','slaves','hirelings','mercs','locals','residents','followers','auxiliaries']);
const ANIMAL_FIELDS = new Set(['cattle','goats','horses','elephants','dogs','camels']);

function emptyCounts() {
  return { warriors:0, actives:0, inactives:0, slaves:0, hirelings:0, mercs:0, locals:0,
    residents:0, followers:0, auxiliaries:0, cattle:0, goats:0, horses:0, elephants:0, dogs:0, camels:0 };
}
function ensureMap(map, key, factory) { if (!map.has(key)) map.set(key, factory()); return map.get(key); }
function setClanCounts(state, row) {
  Object.assign(state, {
    warriors:Number(row.warrior||0), actives:Number(row.active||0), inactives:Number(row.inactive||0), slaves:Number(row.slave||0),
    hirelings:Number(row.hirelings||0), mercs:Number(row.mercs||0), locals:Number(row.locals||0), residents:Number(row.residents||0),
    followers:Number(row.followers||0), auxiliaries:Number(row.auxiliaries||0), cattle:Number(row.cattle||0), goats:Number(row.goat||0),
    horses:Number(row.horse||0), elephants:Number(row.elephant||0), dogs:Number(row.dog||0), camels:Number(row.camel||0)
  });
}

function resolvePlanMovementStarts(plan, resultTurn) {
  if (!plan) return plan;
  const resolved = clone(plan);
  const starts = new Map((resultTurn?.units || []).filter(u => u.currentHex).map(u => [String(u.unitCode), u.currentHex]));
  const pending = [...(resolved.unitCreations || [])];
  let changed = true;
  while (pending.length && changed) {
    changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const creation = pending[i];
      const parentStart = starts.get(String(creation.parentUnit));
      if (!parentStart) continue;
      const direction = canonical(creation.direction);
      starts.set(String(creation.unit), ['N','NE','SE','S','SW','NW'].includes(direction) ? (stepCoordinate(parentStart, direction) || parentStart) : parentStart);
      pending.splice(i, 1); changed = true;
    }
  }
  resolved.movements = (resolved.movements || []).map(row => ({ ...row, startHex: row.startHex || starts.get(String(row.unit)) || null }));
  return resolved;
}

function completedCounts(resultTurn, plan) {
  const states = new Map();
  for (const unit of resultTurn?.units || []) states.set(String(unit.unitCode), countsFromResultUnit(unit));
  for (const row of plan?.clan || []) setClanCounts(ensureMap(states, String(row.unit), emptyCounts), row);
  for (const creation of plan?.unitCreations || []) ensureMap(states, String(creation.unit), emptyCounts);
  for (const transfer of plan?.transfers || []) {
    const field = COUNT_FIELDS[canonical(transfer.item)];
    const qty = Number(transfer.quantity || 0);
    if (!field || !Number.isFinite(qty) || qty === 0) continue;
    const from = ensureMap(states, String(transfer.from), emptyCounts), to = ensureMap(states, String(transfer.to), emptyCounts);
    from[field] = Math.max(0, Number(from[field] || 0) - qty); to[field] = Math.max(0, Number(to[field] || 0) + qty);
  }
  return states;
}

function findResource(resources, wanted) {
  const target = canonical(wanted);
  for (const [section, values] of Object.entries(resources || {})) {
    for (const name of Object.keys(values || {})) if (canonical(name) === target) return { section, name };
  }
  return null;
}
function addResource(resources, section, name, delta) {
  if (!resources[section]) resources[section] = {};
  resources[section][name] = Math.max(0, Number(resources[section][name] || 0) + delta);
  if (resources[section][name] === 0) delete resources[section][name];
}
function completedResources(resultTurn, plan) {
  const states = new Map((resultTurn?.units || []).map(u => [String(u.unitCode), clone(u.resources || {})]));
  for (const creation of plan?.unitCreations || []) ensureMap(states, String(creation.unit), () => ({}));
  for (const transfer of plan?.transfers || []) {
    const field = COUNT_FIELDS[canonical(transfer.item)], qty = Number(transfer.quantity || 0);
    if (PEOPLE_FIELDS.has(field) || !Number.isFinite(qty) || qty === 0) continue;
    const from = ensureMap(states, String(transfer.from), () => ({})), to = ensureMap(states, String(transfer.to), () => ({}));
    const found = findResource(from, transfer.item) || findResource(to, transfer.item);
    const section = found?.section || (ANIMAL_FIELDS.has(field) ? 'Animals' : 'Other Goods');
    const name = found?.name || itemName(transfer.item);
    addResource(from, section, name, -qty); addResource(to, section, name, qty);
  }
  return states;
}

function parsedSkillTransfers(plan) {
  if (plan?.skillTransfers?.length) return plan.skillTransfers;
  return (plan?.gmActions || []).map(row => {
    const m = String(row.text || '').match(/^Skill\s+(.+?)\s+(\d+(?:\.\d+)?)\s+should\s+be\s+moved\s+from\s+Tribe\s+(\d{4})\s+to\s+Tribe\s+(\d{4})/i);
    return m ? { skill:m[1].trim(), level:Number(m[2]), fromTribe:m[3], toTribe:m[4] } : null;
  }).filter(Boolean);
}
function completedSkills(resultTurn, plan) {
  const states = new Map();
  for (const unit of resultTurn?.units || []) if (unit.unitType === 'Tribe') states.set(rootTribe(unit.unitCode), { ...(unit.skills || {}) });
  for (const creation of plan?.unitCreations || []) if (creation.type === 'Tribe') ensureMap(states, rootTribe(creation.unit), () => ({}));
  for (const transfer of parsedSkillTransfers(plan)) {
    const from = ensureMap(states, transfer.fromTribe, () => ({})), to = ensureMap(states, transfer.toTribe, () => ({}));
    const wanted = skillKey(transfer.skill);
    const sourceName = Object.keys(from).find(name => skillKey(name) === wanted);
    const level = Number(transfer.level || (sourceName ? from[sourceName] : 0));
    if (sourceName) delete from[sourceName];
    if (level > 0) to[sourceName || transfer.skill] = level;
  }
  return states;
}

function peopleFromCounts(c) {
  const people = {
    Warriors:c.warriors, Actives:c.actives, Inactives:c.inactives, Slaves:c.slaves,
    Hirelings:c.hirelings, Mercenaries:c.mercs, Locals:c.locals, Residents:c.residents,
    Followers:c.followers, Auxiliaries:c.auxiliaries
  };
  people.People = c.warriors+c.actives+c.inactives+c.hirelings+c.mercs+c.locals+c.residents+c.followers+c.auxiliaries;
  return people;
}
function numberDeltas(current, before) {
  const out = {}; for (const key of new Set([...Object.keys(current||{}), ...Object.keys(before||{})])) out[key] = Number(current?.[key]||0)-Number(before?.[key]||0); return out;
}
function resourceDeltas(current, before) {
  const out = {}; for (const section of new Set([...Object.keys(current||{}), ...Object.keys(before||{})])) out[section] = numberDeltas(current?.[section]||{}, before?.[section]||{}); return out;
}

function buildCompletedTurnState(resultTurn, completed) {
  if (!resultTurn || !completed) return resultTurn;
  const plan = resolvePlanMovementStarts(completed.plan || completed.rawPlan || completed, resultTurn);
  if (!plan) return resultTurn;
  const baseline = new Map((resultTurn.units || []).map(u => [String(u.unitCode), u]));
  const counts = completedCounts(resultTurn, plan), resources = completedResources(resultTurn, plan), skills = completedSkills(resultTurn, plan);
  const info = new Map();
  const put = row => { if (!row?.unit) return; info.set(String(row.unit), { ...(info.get(String(row.unit))||{}), ...row }); };
  for (const u of resultTurn.units || []) put({ unit:u.unitCode, unitName:u.unitName, type:u.unitType });
  for (const row of plan.units || []) put(row); for (const row of plan.unitStats || []) put(row); for (const row of plan.movements || []) put(row);
  for (const row of plan.unitCreations || []) put({ unit:row.unit, type:row.type, parentUnit:row.parentUnit, created:true });
  for (const key of counts.keys()) put({ unit:key }); for (const key of resources.keys()) put({ unit:key });
  const movementByUnit = new Map((plan.movements || []).map(m => [String(m.unit), m]));
  const units = [];
  for (const [unitCode, meta] of info) {
    const before = baseline.get(unitCode), c = counts.get(unitCode) || countsFromResultUnit(before || {}), r = resources.get(unitCode) || {};
    const movement = movementByUnit.get(unitCode); let currentHex = before?.currentHex || movement?.startHex || null, uncertain = false;
    if (movement?.startHex) { const end = deriveMovementEnd(movement.startHex, movement.orders); currentHex = end.endHex || currentHex; uncertain = end.uncertain; }
    const tribeSkills = { ...(skills.get(rootTribe(unitCode)) || before?.skills || {}) }, people = peopleFromCounts(c);
    units.push({
      ...(before ? clone(before) : {}), unitCode, unitName:meta.unitName || before?.unitName || null, unitType:meta.type || before?.unitType || 'Unit',
      currentHex, previousHex:before?.currentHex || movement?.startHex || null,
      statusTerrain:before?.currentHex === currentHex ? (before?.statusTerrain || 'UNKNOWN') : 'UNKNOWN',
      statusNotes:uncertain ? 'Completed orders contain a conditional/unresolved movement segment.' : '', people, resources:r, skills:tribeSkills,
      movement:movement?.orders?.length ? movement.orders.join(' → ') : before?.movement || null, scouts:before?.scouts || [],
      previousTurnKey:before ? `${resultTurn.turnKey} start` : null,
      deltas:before ? { people:numberDeltas(people,before.people||{}), resources:resourceDeltas(r,before.resources||{}), skills:numberDeltas(tribeSkills,before.skills||{}), weight:null, walkingCapacity:null, mountedCapacity:null, morale:0 }
        : { people:numberDeltas(people,{}), resources:resourceDeltas(r,{}), skills:numberDeltas(tribeSkills,{}), weight:null, walkingCapacity:null, mountedCapacity:null, morale:null },
      completedOrdersProjection:true
    });
  }
  const sourceFile = completed.sourceFile || plan.sourceFile || 'Completed Orders';
  return { ...clone(resultTurn), sourceFile:`${resultTurn.sourceFile || `Turn ${resultTurn.turnKey} results`} + ${sourceFile}`,
    importedAt:completed.importedAt || plan.importedAt || resultTurn.importedAt, baselineSourceFile:resultTurn.sourceFile || null,
    completedOrdersSourceFile:sourceFile, workflowState:'completed', units:units.sort((a,b)=>String(a.unitCode).localeCompare(String(b.unitCode),undefined,{numeric:true})), completedPlan:plan };
}

function completedStateToManagedUnits(state, skillsByTribe = {}) {
  return (state?.units || []).map(unit => {
    const people = unit.people || {}, tribe = rootTribe(unit.unitCode);
    const skills = skillsByTribe[tribe] || Object.entries(unit.skills || {}).map(([skill,level]) => ({ skill, shortname:skill, group:null, level:Number(level||0) }));
    const warrior=Number(people.Warriors||0), active=Number(people.Actives||0), slave=Number(people.Slaves??people.Slave??0);
    return { unit:unit.unitCode, unitName:unit.unitName||null, type:unit.unitType||'Unit', parentTribe:tribe, startHex:unit.currentHex||null,
      warrior, active, inactive:Number(people.Inactives||0), slave, eaters:Number(people.People||0)+slave, locals:Number(people.Locals||0),
      workers:warrior+active+slave, used:0, remains:warrior+active+slave, skills, resources:clone(unit.resources||{}) };
  });
}

module.exports = { resolvePlanMovementStarts, buildCompletedTurnState, completedStateToManagedUnits };

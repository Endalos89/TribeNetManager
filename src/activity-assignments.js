// Reusable turn activity assembly. Scout routes are the authoritative source
// for derived reservations; removing/editing a route updates them automatically.
const { activityFromOrderLabel } = require('./activity-catalog');

const key = value => String(value || '').trim().toLowerCase();
const rootTribe = code => String(code || '').trim().slice(0, 4);
function quantity(value, description, positive = false) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (positive ? 1 : 0)) {
    throw new Error(description + ' must be a ' + (positive ? 'positive' : 'nonnegative') + ' whole number.');
  }
  return n;
}
function sortUnit(a, b) {
  const tuple = value => {
    const code = key(value);
    const suffix = code.slice(4);
    const order = !suffix ? 0 : ({ e:1, f:2, g:3, c:4 }[suffix[0]] || 9);
    return [Number(code.slice(0,4)) || 0, order, Number(suffix.slice(1)) || 0, code];
  };
  const x = tuple(a), y = tuple(b);
  return x[0]-y[0] || x[1]-y[1] || x[2]-y[2] || x[3].localeCompare(y[3]);
}
function normalizeManualActivity(row) {
  const unit = String(row.unit || row.unitCode || '').trim();
  const input = String(row.activityCode || row.activity || '').trim();
  if (!unit || !input) throw new Error('Each activity needs a unit and an activity name.');
  const catalog = activityFromOrderLabel(input);
  const activity = catalog?.code === 'CUSTOM' ? input : (catalog?.orderAliases?.[0] || catalog?.code || input);
  return {
    unit, activity, people: quantity(row.people ?? 0, unit + ' ' + input + ' workers'),
    item: String(row.item || row.target || '').trim(),
    distinction: String(row.distinction || '').trim(),
    miningDirection: String(row.miningDirection || '').trim(),
    notes: String(row.notes || '').trim(),
    source: 'manual'
  };
}
// This generic function accepts ordinary planned activities and optional
// order-derived reservations. Further activity planners can call it directly.
function assembleActivityAssignments({ activities = [], routes = [], unitSplits = [], baselineUnits = [] } = {}) {
  const manual = activities.map(normalizeManualActivity);
  const splits = new Map(unitSplits.map(s => [key(s.unitCode), s]));
  const baseline = new Map(baselineUnits.map(u => [key(u.unit || u.unitCode), u]));
  const byTribe = new Map();
  const groups = new Map();

  for (const scout of routes.filter(r => r?.routeType === 'scout')) {
    const owner = String(scout.unitCode || '').trim();
    if (!owner) throw new Error('A scouting party is missing its unit.');
    if (/^\d{4}c\d+$/i.test(owner) || key(splits.get(key(owner))?.unitType || baseline.get(key(owner))?.type || baseline.get(key(owner))?.unitType) === 'courier') {
      throw new Error('Courier ' + owner + ' cannot scout.');
    }
    const mission = String(scout.mission || 'PATROL').toUpperCase();
    if (mission !== 'PATROL') throw new Error('Only PATROL missions are currently supported (' + owner + ').');
    const people = quantity(scout.noOfScouts ?? scout.scoutCount, owner + ' scouting warriors', true);
    const horses = quantity(scout.noOfHorses ?? scout.horseCount ?? 0, owner + ' scouting horses');
    if (horses > people) throw new Error(owner + ' cannot assign more horses than scouts.');
    const tribe = rootTribe(scout.tribeCode || owner);
    byTribe.set(tribe, (byTribe.get(tribe) || 0) + 1);
    if (byTribe.get(tribe) > 8) throw new Error('Tribe ' + tribe + ' exceeds eight scouting parties.');
    const split = splits.get(key(owner));
    const sourceUnit = String(split?.parentUnit || owner).trim();
    const group = groups.get(key(sourceUnit)) || { unit:sourceUnit, people:0, horses:0, splitScoutUnits:new Map() };
    group.people += people;
    group.horses += horses;
    // A newly created unit's scout workers are booked to the unit it was
    // split from. Only that attribution needs a GM Comment. Record each
    // new unit once even if it sends multiple separate scouting parties.
    if (split) group.splitScoutUnits.set(key(owner), owner);
    groups.set(key(sourceUnit), group);
  }
  const derived = [];
  const comments = [];
  for (const group of groups.values()) {
    if (manual.some(row => key(row.unit) === key(group.unit) && key(row.activity) === 'scouting')) {
      throw new Error(group.unit + ' has a manual SCOUTING activity and saved scout routes; remove the duplicate.');
    }
    const source = baseline.get(key(group.unit));
    if (source && Number(source.warrior) > 0 && group.people > Number(source.warrior)) {
      throw new Error(group.unit + ' has only ' + source.warrior + ' warriors for ' + group.people + ' scouts.');
    }
    const manualPeople = manual.filter(a => key(a.unit) === key(group.unit)).reduce((n,a) => n+a.people,0);
    if (source && Number(source.workers) > 0 && manualPeople + group.people > Number(source.workers)) {
      throw new Error(group.unit + ' allocates ' + (manualPeople+group.people) + ' workers; only ' + source.workers + ' available.');
    }
    derived.push({ unit:group.unit, activity:'SCOUTING', people:group.people, item:'SCOUTING', distinction:'NONE', miningDirection:'', notes:'', source:'scouting' });
    for (const newUnit of group.splitScoutUnits.values()) {
      comments.push({
        unit:group.unit,
        text:`Allocated scouting for ${group.unit} includes scouting performed by ${newUnit}.`
      });
    }
  }
  for (const row of manual) {
    if (row.notes) comments.push({ unit:row.unit, text:row.activity + ': ' + row.notes });
  }
  const all = [...manual, ...derived].sort((a,b) => sortUnit(a.unit,b.unit));
  return { activities:all, comments, derived };
}
module.exports = { assembleActivityAssignments, normalizeManualActivity, sortUnit };

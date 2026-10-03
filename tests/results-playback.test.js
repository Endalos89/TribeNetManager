const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('src/results-playback.js', 'utf8');
const elements = new Map();
const context = {
  console,
  Map,
  Set,
  Math,
  Number,
  String,
  Object,
  Date,
  Intl,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  draw: () => {},
  document: { getElementById: id => elements.get(id) || null },
  window: null,
  TurnLifecycleCore: {
    actualPlanFromResult: () => ({
      movements: [{ unit: 'T1', startHex: 'AA0101', orders: ['E', 'SE'] }],
      scouts: [{ id: 1, unit: 'T1', startHex: 'AA0101', orders: ['N'], noOfScouts: 284 }]
    })
  },
  buildPlanRoutes: () => ({
    movements: [{ unit: 'T1', route: { points: [{ globalCol: 0, globalRow: 0 }, { globalCol: 1, globalRow: 0 }, { globalCol: 1, globalRow: 1 }] } }],
    scouts: [{ unit: 'T1', id: 1, noOfScouts: 284, report: "N-N, Not enough M.P's to move to SE into UNKNOWN", route: { points: [{ globalCol: 0, globalRow: 0, coordinate: 'AA0101' }, { globalCol: 0, globalRow: 1, coordinate: 'AA0102' }] } }]
  }),
  stepHex: (point, direction) => ({ globalCol: point.globalCol + (direction === 'SE' ? 1 : 0), globalRow: point.globalRow, coordinate: 'AB0102' })
};
context.window = context;
context.resultsTimeline = { turn: {
  turnKey: '1-02',
  units: [{ unitCode: 'T1', previousHex: 'AA0101', currentHex: 'AA0202', deltas: { resources: {} } }],
  events: []
} };
vm.runInNewContext(source, context, { filename: 'results-playback.js' });

const events = context.resultsPlayback.buildEvents({
  units: [{ unitCode: 'T1', previousHex: 'AA0101', currentHex: 'AA0202', deltas: { resources: { food: { Goat: -60 } } } }],
  events: [{ unitCode: 'T1', eventType: 'activities', message: 'Tribe Activities, Skin\\gut\\bone 60 Goat, 100 people made 100 Sling (using 100 Leather), 275 herders allocated, Bred ( Cattle 32, Goat 284, Horse 21 )' }]
});

assert.strictEqual(context.resultsPlayback.modelCount(1), 1);
assert.strictEqual(context.resultsPlayback.modelCount(99), 2);
assert.strictEqual(context.resultsPlayback.modelCount(1000), 4);
assert.strictEqual(context.resultsPlayback.activitySound('40 people Skin\\gut\\bone 60 Goat'), 'butcher');
assert.strictEqual(context.resultsPlayback.activitySound('B/axe 50'), 'wood');
assert.strictEqual(context.resultsPlayback.activitySound('20257 people hunted 52668 provs'), 'hunt');
assert.strictEqual(context.resultsPlayback.activitySound('275 herders allocated'), 'herd');
assert.strictEqual(events.filter(event => event.phase === 'activities').length, 3);
assert.strictEqual(events.filter(event => event.phase === 'activities' && event.sound === 'herd').length, 1);
assert.ok(events.some(event => event.changes.some(change => change.name === 'Goat' && change.amount === -60)));
assert.ok(events.some(event => event.changes.some(change => change.name === 'Leather' && change.amount === -100)));
assert.strictEqual(events.filter(event => event.phase === 'movement').length, 2);
assert.strictEqual(events.filter(event => event.phase === 'scouting')[0].riders, 3);
assert.ok(events.some(event => event.phase === 'scouting' && event.partial), 'Incomplete scouts should travel to a border tile');

(async () => {
  const started = await context.startResultsPlayback();
  assert.strictEqual(started, true, 'Play Turn should find the shared current results turn');
  assert.strictEqual(context.resultsPlayback.active, true);
  assert.ok(context.resultsPlayback.revealTargets.size >= 1, 'Scout destinations should be staged behind fog until reached');
  const pausedAt = context.resultsPlayback.progress;
  assert.strictEqual(context.pauseResultsPlayback(), true);
  assert.strictEqual(context.resultsPlayback.paused, true);
  assert.strictEqual(context.resultsPlayback.progress, pausedAt);
  assert.strictEqual(context.resumeResultsPlayback(), true);
  assert.strictEqual(context.resultsPlayback.paused, false);
  context.stopResultsPlayback();
  console.log('Results playback event, start path and log-scale tests passed');
})();

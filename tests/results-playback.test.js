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
    scouts: [{ unit: 'T1', id: 1, noOfScouts: 284, route: { points: [{ globalCol: 0, globalRow: 0 }, { globalCol: 0, globalRow: 1 }] } }]
  })
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
  events: [{ unitCode: 'T1', eventType: 'activities', message: 'Tribe Activities, Skin\\gut\\bone 60 Goat, 100 people made 100 Sling (using 100 Leather)' }]
});

assert.strictEqual(context.resultsPlayback.modelCount(1), 1);
assert.strictEqual(context.resultsPlayback.modelCount(99), 2);
assert.strictEqual(context.resultsPlayback.modelCount(1000), 4);
assert.strictEqual(events.filter(event => event.phase === 'activities').length, 2);
assert.ok(events.some(event => event.changes.some(change => change.name === 'Goat' && change.amount === -60)));
assert.ok(events.some(event => event.changes.some(change => change.name === 'Leather' && change.amount === -100)));
assert.strictEqual(events.filter(event => event.phase === 'movement').length, 2);
assert.strictEqual(events.filter(event => event.phase === 'scouting')[0].riders, 3);

(async () => {
  const started = await context.startResultsPlayback();
  assert.strictEqual(started, true, 'Play Turn should find the shared current results turn');
  assert.strictEqual(context.resultsPlayback.active, true);
  context.stopResultsPlayback();
  console.log('Results playback event, start path and log-scale tests passed');
})();

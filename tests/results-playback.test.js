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
  parseCoordinate: value => ({ coordinate: String(value), globalCol: String(value) === 'AA0102' ? 0 : 0, globalRow: String(value) === 'AA0102' ? 1 : 0 }),
  stepHex: (point, direction) => ({ globalCol: point.globalCol + (direction === 'SE' ? 1 : 0), globalRow: point.globalRow, coordinate: 'AB0102' })
};
context.window = context;
context.resultsTimeline = { turn: {
  turnKey: '1-02',
  turnSort: 2,
  isPlanningTurn: true,
  isStartState: true,
  eventTurnKey: '1-02',
  knowledgeTurnKey: '1-01',
  units: [{ unitCode: 'T1', currentHex: 'AA0101', deltas: { resources: {} } }],
  events: [],
  startHexKnowledge: []
}, turns: [{ turnKey: '1-01', turnSort: 1 }, { turnKey: '1-02', turnSort: 2 }] };
context.state = { mode: 'detail', hexCache: new Map([
  ['AA0101', { coordinate: 'AA0101', terrain: 'PR', discoveredTurn: '1-01' }],
  ['AA0102', { coordinate: 'AA0102', terrain: 'GH', discoveredTurn: '1-02' }]
]) };
context.visibleBounds = () => ({ minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 });
context.tribenet = {
  getResultTurn: async () => ({
    turnKey: '1-02',
    turnSort: 2,
    units: [{ unitCode: 'T1', previousHex: 'AA0101', currentHex: 'AA0202', deltas: { resources: { food: { Goat: -60 } } } }],
    events: [{ unitCode: 'T1', eventType: 'activities', message: 'Tribe Activities, Skin\\gut\\bone 60 Goat' }]
  }),
  getResultHexesInArea: async (_bounds, turnKey) => turnKey === '1-01'
    ? [{ coordinate: 'AA0101', terrain: 'PR', discoveredTurn: '1-01', globalCol: 0, globalRow: 0 }]
    : [...context.state.hexCache.values()]
};
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
assert.strictEqual(context.resultsPlayback.activitySound('100 people made 100 Sling'), 'craft');
assert.strictEqual(context.resultsPlayback.activitySound('20257 people hunted 52668 provs'), 'hunt');
assert.strictEqual(context.resultsPlayback.activitySound('275 herders allocated'), 'herd');
assert.strictEqual(events.filter(event => event.phase === 'activities').length, 3);
assert.strictEqual(events.filter(event => event.phase === 'activities' && event.sound === 'herd').length, 1);
assert.ok(events.some(event => event.changes.some(change => change.name === 'Goat' && change.amount === -60)));
assert.ok(events.some(event => event.changes.some(change => change.name === 'Leather' && change.amount === -100)));
assert.strictEqual(events.filter(event => event.phase === 'movement').length, 2);
assert.strictEqual(events.filter(event => event.phase === 'scouting')[0].riders, 3);
const partialScout = events.find(event => event.phase === 'scouting' && event.partial);
assert.ok(partialScout, 'Incomplete scouts should travel to a border tile');
assert.ok(partialScout.borderPoint && partialScout.borderPoint.x !== partialScout.to.globalCol, 'Incomplete scouts should stop before the attempted tile centre');
assert.ok(partialScout.segments.length >= 2, 'A scout route should retain per-hex reveal segments');
assert.equal(partialScout.sound, 'horse');

// Curly apostrophes and coordinate-only route points are both present in
// copied Word reports.  The failed entry must still be a separate segment.
const savedRouteBuilder = context.buildPlanRoutes;
context.buildPlanRoutes = () => ({
  movements: [],
  scouts: [{
    unit: 'T1', id: 2, noOfScouts: 10, report: "N-GH, Not enough M.P’s to move to SE into UNKNOWN",
    route: { points: [{ coordinate: 'AA0101' }, { coordinate: 'AA0102' }] }
  }]
});
const curlyEvents = context.resultsPlayback.buildEvents({ units: [{ unitCode: 'T1', currentHex: 'AA0101' }], events: [] });
assert.strictEqual(curlyEvents.filter(event => event.phase === 'scouting').length, 1, 'A scout route should play as one continuous event');
assert.ok(curlyEvents.some(event => event.partial && event.to.coordinate === 'AB0102'), 'Partial segment should target the attempted adjacent hex');
assert.strictEqual(curlyEvents[0].segments.length, 2, 'Continuous scout playback should retain the normal and partial segments');
context.buildPlanRoutes = savedRouteBuilder;

(async () => {
  const started = await context.startResultsPlayback();
  assert.strictEqual(started, true, 'Play Turn should find the shared current results turn');
  assert.strictEqual(context.resultsPlayback.active, true);
  assert.strictEqual(context.resultsPlayback.baselineTurnKey, '1-01');
  assert.ok(context.resultsPlayback.renderRevision > 0, 'Playback should publish a render revision for cached map invalidation');
  assert.strictEqual(context.resultsPlayback.baselineHexes.get('AA0101').terrain, 'PR');
  assert.strictEqual(context.resultsPlaybackMapData('AA0101', { coordinate: 'AA0101', terrain: 'GH' }).terrain, 'PR');
  assert.ok(context.resultsPlayback.revealTargets.size >= 1, 'Scout destinations should be staged behind fog until reached');
  assert.strictEqual(context.resultsPlaybackMapData('AA0102', { coordinate: 'AA0102', terrain: 'GH' }), null, 'Future target terrain must stay hidden before its scout segment');
  const activeScout = context.resultsPlayback.events.find(event => event.phase === 'scouting');
  assert.ok(activeScout?.segments?.[0]?.reveals?.includes('AA0102'), 'Scout reveals should remain attached to the matching continuous segment');
  assert.notStrictEqual(context.resultsPlayback.soundSources.movement, context.resultsPlayback.soundSources.scout, 'Movement and scouting should not share a sound cue');
  assert.strictEqual(context.resultsPlayback.soundSources.scout, context.resultsPlayback.soundSources.horse, 'Scouting should use the horse gallop cue');
  assert.notStrictEqual(context.resultsPlayback.soundSources.scout, context.resultsPlayback.soundSources.unknown, 'Unknown activities should retain their placeholder cue');
  assert.notStrictEqual(context.resultsPlayback.soundSources.hunt, context.resultsPlayback.soundSources.movement, 'Hunting should have its own cue');
  assert.notStrictEqual(context.resultsPlayback.soundSources.craft, context.resultsPlayback.soundSources.wood, 'Crafting should have its own cue');
  const revisionBeforePan = context.resultsPlayback.renderRevision;
  context.tribenet.getResultHexesInArea = async () => [{ coordinate: 'AA0102', terrain: 'PR', discoveredTurn: '1-01' }];
  await context.resultsPlaybackEnsureBaseline({ minCol: 0, maxCol: 8, minRow: 0, maxRow: 8 });
  assert.ok(context.resultsPlayback.renderRevision > revisionBeforePan, 'Loading a new baseline area should invalidate cached terrain');
  context.resultsPlayback.revealed.add('AA0102');
  assert.strictEqual(context.resultsPlaybackMapData('AA0102', { coordinate: 'AA0102', terrain: 'GH' }).terrain, 'GH');
  context.resultsPlayback.revealedQuestions.add('AA0102');
  context.resultsPlayback.partialPreviews.add('AA0102');
  assert.strictEqual(context.resultsPlaybackMapData('AA0102', { coordinate: 'AA0102', terrain: 'GH' }).terrain, 'GH', 'Partial scout terrain should remain visible with its question marker');
  const pausedAt = context.resultsPlayback.progress;
  assert.strictEqual(context.pauseResultsPlayback(), true);
  assert.strictEqual(context.resultsPlayback.paused, true);
  assert.strictEqual(context.resultsPlayback.progress, pausedAt);
  assert.strictEqual(context.resumeResultsPlayback(), true);
  assert.strictEqual(context.resultsPlayback.paused, false);
  context.stopResultsPlayback();
  console.log('Results playback event, start path and log-scale tests passed');
})();

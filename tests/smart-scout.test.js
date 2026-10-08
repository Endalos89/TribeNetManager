const assert = require('assert');
const SmartScoutCore = require('../src/smart-scout');
const ConditionalOrders = require('../src/conditional-orders');
const MovementPlannerCore = require('../src/movement-planner-core');

const rows = [
  { coordinate: 'AA0101', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0102', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0103', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0201', terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: 'AA0202', terrain: 'HSM', knowledgeLevel: 'observed' },
  { coordinate: 'AA0401', terrain: '?', knowledgeLevel: 'observed' }
];

const result = SmartScoutCore.generate(rows, 'AA0101', {
  scoutCount: 4,
  noOfScouts: 2,
  noOfHorses: 2,
  mission: 'PATROL'
});

assert.equal(result.routes.length, 4, 'Smart Scout should always return one valid row per requested scout');
assert.equal(new Set(result.routes.map(route => route.signature)).size, result.routes.length, 'different candidates should be preferred before repeating an exact route');
assert.ok(result.mounted, '2 people and 2 horses should use mounted scouting allowance');
assert.ok(result.totalCoverage > 0, 'Smart Scout should score unique fog/question-mark land coverage');
assert.ok(result.covered.every(coordinate => !String(coordinate).startsWith('ocean:')), 'ocean must not be counted as a coverage target');
for (const route of result.routes) {
  assert.equal(route.noOfScouts, 2);
  assert.equal(route.noOfHorses, 2);
  assert.equal(route.mission, 'PATROL');
  assert.ok(route.directions.length <= 9);
  assert.ok(route.directions.every(order => SmartScoutCore.VALID_SCOUT_ORDERS.has(order)), 'every generated order must be valid for Scout_Movement');
  assert.ok(!route.directions.includes('GOTO'), 'GOTO must never be generated for scouting');
  assert.ok(route.scenarioMp.high >= route.scenarioMp.expected, 'unknown-terrain what-if high cost should be conservative');
  if (!route.specialOrder && route.directions[0] !== 'Still') assert.ok(route.unknownEntryCount >= 2, 'Smart Scout should continue through multiple unknown hexes when optimistic movement allows it');
  assert.ok(route.optimisticMp <= route.movementAllowance, 'unknown continuation should fit the optimistic movement allowance');
  if (route.specialOrder) {
    assert.ok(['FOL', 'FOR'].includes(route.specialOrder), 'Smart Scout should currently generate ocean follow orders only');
    assert.equal(route.directions.at(-1), route.specialOrder, 'a conditional order must be the terminal exported order');
    assert.equal(route.destinationHex, route.path.at(-1).coordinate, 'a conditional route must not invent a future destination');
    assert.ok(route.conditionalPredictionPaths.length > 0, 'conditional routes should expose forecast branches separately');
  }
}

const endpoint = MovementPlannerCore.parseCoordinate('AA1010');
const previous = MovementPlannerCore.step(endpoint, 'S');
const rightFeature = MovementPlannerCore.step(endpoint, 'NE');
const leftFeature = MovementPlannerCore.step(endpoint, 'NW');
const rightKnown = MovementPlannerCore.buildKnownHexMap([
  { coordinate: previous.coordinate, terrain: 'PR' },
  { coordinate: endpoint.coordinate, terrain: 'PR' },
  { coordinate: rightFeature.coordinate, terrain: 'O' }
]);
const leftKnown = MovementPlannerCore.buildKnownHexMap([
  { coordinate: previous.coordinate, terrain: 'PR' },
  { coordinate: endpoint.coordinate, terrain: 'PR' },
  { coordinate: leftFeature.coordinate, terrain: 'O' }
]);

assert.strictEqual(
  SmartScoutCore.specialOrderFor(rightKnown, [{ coordinate: previous.coordinate }, { coordinate: endpoint.coordinate }], rightFeature.coordinate),
  'FOR',
  'an ocean one clockwise step from the movement heading is on the right'
);
assert.strictEqual(
  SmartScoutCore.specialOrderFor(leftKnown, [{ coordinate: previous.coordinate }, { coordinate: endpoint.coordinate }], leftFeature.coordinate),
  'FOL',
  'an ocean one counter-clockwise step from the movement heading is on the left'
);

const dynamic = ConditionalOrders.preview(rightKnown, endpoint, 'S', 'FOR', { remainingMp: 15, maxSteps: 6 });
assert.ok(dynamic.valid, 'FOR should be valid when a visible ocean edge has an unresolved land continuation');
assert.ok(dynamic.dynamic, 'follow orders must be represented as dynamic policies');
assert.ok(dynamic.predictionPaths.length > 0, 'the planner should expose possible forecast branches without treating them as facts');
assert.ok(dynamic.continuationSteps > 0, 'the forecast should account for movement remaining after the first possible reveal');
assert.ok(Object.keys(dynamic.coverageWeights).every(coordinate => coordinate !== rightFeature.coordinate), 'the ocean edge itself must not be scored as land coverage');

const observedCoast = SmartScoutCore.generate([
  { coordinate: 'AA0201', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0202', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0103', terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: 'AA0203', terrain: 'PR', knowledgeLevel: 'observed' },
  { coordinate: 'AA0303', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0304', terrain: 'PR', knowledgeLevel: 'visited' }
], 'AA0201', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
const conditionalRoute = observedCoast.routes.find(route => route.specialOrder);
assert.ok(conditionalRoute, 'a useful visible coastline should produce a conditional scout route');
assert.ok(['FOL', 'FOR'].includes(conditionalRoute.specialOrder));
assert.equal(conditionalRoute.path.at(-1).coordinate, conditionalRoute.destinationHex);
assert.ok(conditionalRoute.conditionalPredictionPaths.length > 0);

const obstacleSafe = SmartScoutCore.generate(rows, 'AA0101', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
assert.ok(obstacleSafe.routes.every(route => !route.path.some(point => point.coordinate === 'AA0202')), 'Smart Scout must not route through known mountain hexes');

const nearOcean = MovementPlannerCore.step(endpoint, 'N');
const nearLand = MovementPlannerCore.step(endpoint, 'S');
const oceanLikelihood = SmartScoutCore.terrainLikelihood(MovementPlannerCore.buildKnownHexMap([
  { coordinate: nearOcean.coordinate, terrain: 'O' },
  { coordinate: nearLand.coordinate, terrain: 'PR' }
]), endpoint.coordinate);
const landLikelihood = SmartScoutCore.terrainLikelihood(MovementPlannerCore.buildKnownHexMap([
  { coordinate: nearOcean.coordinate, terrain: 'PR' },
  { coordinate: nearLand.coordinate, terrain: 'PR' }
]), endpoint.coordinate);
assert.ok(oceanLikelihood.ocean > landLikelihood.ocean, 'nearby ocean should increase the estimated ocean likelihood');
assert.ok(oceanLikelihood.passable < landLikelihood.passable, 'nearby ocean should reduce the estimated passability');

console.log('smart-scout tests passed');

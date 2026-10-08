const assert = require('assert');
const SmartScoutCore = require('../src/smart-scout');
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

assert.equal(result.routes.length, 4, 'four selected scouts should become four scouting rows');
assert.ok(result.mounted, '2 people and 2 horses should use mounted scouting allowance');
assert.ok(result.totalCoverage > 0, 'Smart Scout should score unique fog/question-mark coverage');
for (const route of result.routes) {
  assert.equal(route.noOfScouts, 2);
  assert.equal(route.noOfHorses, 2);
  assert.equal(route.mission, 'PATROL');
  assert.ok(route.directions.length <= 9);
  assert.ok(route.directions.every(order => SmartScoutCore.VALID_SCOUT_ORDERS.has(order)), 'every generated order must be valid for Scout_Movement');
  assert.ok(!route.directions.includes('GOTO'), 'GOTO must never be generated for scouting');
  assert.ok(route.scenarioMp.high >= route.scenarioMp.expected, 'unknown-terrain what-if high cost should be conservative');
  assert.ok(route.unknownEntryCount >= 2, 'Smart Scout should continue through multiple unknown hexes when optimistic movement allows it');
  assert.ok(route.optimisticMp <= route.movementAllowance, 'unknown continuation should fit the optimistic movement allowance');
}

assert.ok(
  result.routes.some(route => ['FOL', 'FOR', 'FML', 'FMR'].includes(route.specialOrder)),
  'Smart Scout should consider ocean/mountain follow orders when a feature edge is available'
);

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

console.log('smart-scout tests passed');

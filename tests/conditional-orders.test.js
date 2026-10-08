const assert = require('assert');
const ConditionalOrders = require('../src/conditional-orders');
const MovementPlannerCore = require('../src/movement-planner-core');

const endpoint = MovementPlannerCore.parseCoordinate('AA1010');
const previous = MovementPlannerCore.step(endpoint, 'S');
const oceanRight = MovementPlannerCore.step(endpoint, 'NE');
const oceanLeft = MovementPlannerCore.step(endpoint, 'NW');
const known = MovementPlannerCore.buildKnownHexMap([
  { coordinate: previous.coordinate, terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: endpoint.coordinate, terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: oceanRight.coordinate, terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: oceanLeft.coordinate, terrain: 'O', knowledgeLevel: 'observed' }
]);

assert.equal(ConditionalOrders.sideForFeature('N', oceanRight.direction), 'right');
assert.equal(ConditionalOrders.sideForFeature('N', oceanLeft.direction), 'left');

const right = ConditionalOrders.preview(known, endpoint, 'N', 'FOR', { remainingMp: 15 });
assert.ok(right.valid);
assert.equal(right.dynamic, true);
assert.equal(right.token, 'FOR');
assert.equal(right.feature, 'ocean');
assert.equal(right.side, 'right');
assert.ok(right.predictionPaths.length > 0);
assert.ok(right.continuationSteps > 0);
assert.ok(!right.coverageWeights[oceanRight.coordinate], 'the feature being followed is not a land target');

const left = ConditionalOrders.preview(known, endpoint, 'N', 'FOL', { remainingMp: 15 });
assert.ok(left.valid);
assert.equal(left.side, 'left');

const noEdge = ConditionalOrders.preview(
  MovementPlannerCore.buildKnownHexMap([{ coordinate: endpoint.coordinate, terrain: 'PR' }]),
  endpoint,
  'N',
  'FOR',
  { remainingMp: 15 }
);
assert.equal(noEdge.valid, false, 'a follow order without a visible feature edge must not be presented as executable');

console.log('conditional-orders tests passed');

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

assert.ok(result.routes.length >= 2, 'Smart Scout should produce every feasible scouting row');
assert.equal(
  new Set(result.routes.map(route => route.signature)).size,
  result.routes.length,
  'Smart Scout should not duplicate an exact route when selecting multiple scouts'
);
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
  if (!route.specialOrder) assert.ok(route.unknownEntryCount >= 2, 'Smart Scout should continue through multiple unknown hexes when optimistic movement allows it');
  assert.ok(route.optimisticMp <= route.movementAllowance, 'unknown continuation should fit the optimistic movement allowance');
}

assert.ok(
  result.routes.some(route => ['FOL', 'FOR', 'FML', 'FMR'].includes(route.specialOrder)),
  'Smart Scout should consider ocean/mountain follow orders when a feature edge is available'
);

const openResult = SmartScoutCore.generate(rows.slice(0, 3), 'AA0101', {
  scoutCount: 1,
  noOfScouts: 2,
  noOfHorses: 2,
  mission: 'PATROL'
});
assert.ok(openResult.routes[0]?.unknownEntryCount >= 2, 'Smart Scout should continue through multiple unknown hexes when no follow order is needed');

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

const rightCoast = SmartScoutCore.generate([
  { coordinate: 'AA0201', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0202', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0103', terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: 'AA0303', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0304', terrain: 'PR', knowledgeLevel: 'visited' }
], 'AA0201', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
assert.strictEqual(rightCoast.routes[0]?.specialOrder, 'FOR', 'a reachable right-hand coastline should reserve a FOR scout route');
assert.equal(new Set(rightCoast.routes.map(route => route.signature)).size, rightCoast.routes.length, 'coastline selection should still keep scout routes distinct');

const leftCoast = SmartScoutCore.generate([
  { coordinate: 'AA0201', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0202', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0303', terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: 'AA0103', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0104', terrain: 'PR', knowledgeLevel: 'visited' }
], 'AA0201', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
assert.strictEqual(leftCoast.routes[0]?.specialOrder, 'FOL', 'a reachable left-hand coastline should reserve a FOL scout route');

// A visible-but-unresolved coastal row (the form used by the Results data)
// must still give FOR a real land reveal target rather than stopping at the
// ocean edge with no chance to uncover anything.
const observedCoast = SmartScoutCore.generate([
  { coordinate: 'AA0201', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0202', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0103', terrain: 'O', knowledgeLevel: 'observed' },
  { coordinate: 'AA0203', terrain: 'PR', knowledgeLevel: 'observed' },
  { coordinate: 'AA0303', terrain: 'PR', knowledgeLevel: 'visited' },
  { coordinate: 'AA0304', terrain: 'PR', knowledgeLevel: 'visited' }
], 'AA0201', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
assert.strictEqual(observedCoast.routes[0]?.specialOrder, 'FOR', 'Smart Scout should keep a usable FOR route beside an ocean edge');
assert.ok(observedCoast.routes[0]?.destinationHex, 'a follow route must have a reveal destination');
assert.equal(observedCoast.routes[0]?.path.at(-1)?.kind, 'approx', 'a follow route must end on an unresolved land target');
for (const route of observedCoast.routes.filter(item => /^FO[LR]$/.test(item.specialOrder || ''))) {
  assert.ok(route.destinationHex && route.path.at(-1)?.kind === 'approx', 'every FOL/FOR route must be capable of revealing a new hex');
}

const obstacleSafe = SmartScoutCore.generate(rows, 'AA0101', { scoutCount: 4, noOfScouts: 2, noOfHorses: 2 });
assert.ok(obstacleSafe.routes.every(route => !route.path.some(point => point.coordinate === 'AA0202')), 'Smart Scout must not route through known mountain hexes while extending unknown paths');

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

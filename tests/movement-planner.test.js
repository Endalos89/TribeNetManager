const assert = require('assert');
const {
  buildKnownHexMap,
  findFastestRoute,
  parseCoordinate,
  adjacentHexes
} = require('../src/movement-planner-core');

function makeHex(coordinate, terrain) {
  return { coordinate, terrain };
}

(function choosesLowerMovementCostOverFewerHexes() {
  const origin = parseCoordinate('AA0505');
  const expensive = adjacentHexes(origin).find(x => x.direction === 'SE');
  const target = adjacentHexes(expensive).find(x => x.direction === 'SE');
  const detour1 = adjacentHexes(origin).find(x => x.direction === 'NE');
  const detour2 = adjacentHexes(detour1).find(x => x.direction === 'SE');
  const detour3 = adjacentHexes(detour2).find(x => x.direction === 'S');

  assert.equal(detour3.coordinate, target.coordinate, 'detour fixture should reconnect to target');

  const rows = [
    makeHex(origin.coordinate, 'PR'),
    makeHex(expensive.coordinate, 'LCM'),
    makeHex(target.coordinate, 'PR'),
    makeHex(detour1.coordinate, 'PR'),
    makeHex(detour2.coordinate, 'PR')
  ];

  const result = findFastestRoute(buildKnownHexMap(rows), origin.coordinate, target.coordinate);
  assert.equal(result.status, 'ok');
  assert.equal(result.totalMp, 9, 'three prairie entries should beat LCM + prairie (13 MP)');
  assert.deepEqual(result.directions, ['NE', 'SE', 'S']);
})();

(function routesUnknownDestinationToCheapestRevealedAdjacentHex() {
  const origin = parseCoordinate('AA0505');
  const destination = adjacentHexes(origin).find(x => x.direction === 'SE');
  const cheapAdjacent = origin;
  const otherAdjacent = adjacentHexes(destination)
    .filter(x => x.coordinate !== origin.coordinate)
    .find(Boolean);

  const rows = [
    makeHex(origin.coordinate, 'PR'),
    makeHex(otherAdjacent.coordinate, 'SW')
  ];
  const result = findFastestRoute(buildKnownHexMap(rows), origin.coordinate, destination.coordinate);
  assert.equal(result.status, 'ok');
  assert.equal(result.targetIsUnknown, true);
  assert.equal(result.actualTarget, cheapAdjacent.coordinate);
  assert.equal(result.totalMp, 0);
})();

(function refusesToCrossUnknownHexes() {
  const origin = parseCoordinate('AA1005');
  const destination = adjacentHexes(origin).find(x => x.direction === 'SE');
  const beyond = adjacentHexes(destination).find(x => x.direction === 'SE');
  const rows = [
    makeHex(origin.coordinate, 'PR'),
    makeHex(beyond.coordinate, 'PR')
  ];
  const result = findFastestRoute(buildKnownHexMap(rows), origin.coordinate, beyond.coordinate);
  assert.equal(result.status, 'no-route');
})();

(function reportsNoAdjacentRevealForUnknownDestination() {
  const origin = parseCoordinate('AA1505');
  const farUnknown = parseCoordinate('AA2010');
  const result = findFastestRoute(buildKnownHexMap([
    makeHex(origin.coordinate, 'PR')
  ]), origin.coordinate, farUnknown.coordinate);
  assert.equal(result.status, 'no-revealed-adjacent');
})();

(function treatsHighMountainsAsImpassable() {
  const origin = parseCoordinate('AA2005');
  const destination = adjacentHexes(origin).find(x => x.direction === 'SE');
  const result = findFastestRoute(buildKnownHexMap([
    makeHex(origin.coordinate, 'PR'),
    makeHex(destination.coordinate, 'HSM')
  ]), origin.coordinate, destination.coordinate);
  assert.equal(result.status, 'target-impassable');
})();

console.log('movement-planner tests passed');

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
  const origin = parseCoordinate('AA0101');
  const east = adjacentHexes(origin).find(x => x.direction === 'SE');
  const target = adjacentHexes(east).find(x => x.direction === 'SE');
  const north = adjacentHexes(origin).find(x => x.direction === 'N');
  const northEast = adjacentHexes(north).find(x => x.direction === 'SE');
  const northEastEast = adjacentHexes(northEast).find(x => x.direction === 'SE');
  const backSouth = adjacentHexes(northEastEast).find(x => x.direction === 'S');

  const rows = [
    makeHex(origin.coordinate, 'PR'),
    makeHex(east.coordinate, 'SW'),
    makeHex(target.coordinate, 'PR'),
    makeHex(north.coordinate, 'PR'),
    makeHex(northEast.coordinate, 'PR'),
    makeHex(northEastEast.coordinate, 'PR'),
    makeHex(backSouth.coordinate, 'PR')
  ];

  const result = findFastestRoute(buildKnownHexMap(rows), origin.coordinate, target.coordinate);
  assert.equal(result.status, 'ok');
  assert.equal(result.totalMp, 12, 'four prairie entries should beat swamp + prairie (11) only if geometry route reaches target');
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

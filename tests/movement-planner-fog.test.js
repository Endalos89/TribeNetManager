const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MovementPlannerCore = require('../src/movement-planner-core');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'movement-planner.js'), 'utf8');
const context = {
  MovementPlannerCore,
  draw() {},
  selectHex() {},
  state: { selected: null, mode: 'overview' },
  document: { getElementById() { return null; } },
  window: { addEventListener() {}, tribenet: {} },
  escapeHtml: value => String(value),
  TOTAL_COLS: 480,
  TOTAL_ROWS: 546,
  coordinateFor: MovementPlannerCore.coordinateFor,
  console
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'movement-planner.js' });

(function includesFinalCommandIntoFog() {
  const origin = MovementPlannerCore.parseCoordinate('AA0505');
  const fog = MovementPlannerCore.adjacentHexes(origin).find(step => step.direction === 'SE');
  const raw = {
    status: 'ok',
    origin: origin.coordinate,
    requestedTarget: fog.coordinate,
    actualTarget: origin.coordinate,
    targetIsUnknown: true,
    candidateGoalCount: 1,
    path: [{
      coordinate: origin.coordinate,
      globalCol: origin.globalCol,
      globalRow: origin.globalRow,
      terrain: 'PR',
      cumulativeMp: 0
    }],
    directions: [],
    totalMp: 0,
    steps: 0
  };

  const result = context.movementPlannerPrepareRoute(raw);
  assert.equal(result.actualTarget, fog.coordinate);
  assert.equal(result.approachTarget, origin.coordinate);
  assert.deepEqual(Array.from(result.directions), ['SE']);
  assert.equal(result.steps, 1);
  assert.equal(result.knownMp, 0);
  assert.equal(result.unknownEntryCount, 1);
  assert.equal(result.totalMp, null);
  assert.equal(result.path.length, 2);
  assert.equal(result.path[1].terrain, 'UNKNOWN');
  assert.equal(result.path[1].kind, 'approx');
})();

(function recognisesAdjacentFogToFogCommandDirection() {
  const first = MovementPlannerCore.parseCoordinate('AA0505');
  const second = MovementPlannerCore.adjacentHexes(first).find(step => step.direction === 'NE');
  assert.equal(context.movementPlannerDirectionBetween(first.coordinate, second.coordinate), 'NE');
})();

console.log('movement-planner fog tests passed');

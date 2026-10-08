const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'saved-movement-plans.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');

function parseCoordinate(value) {
  const match = String(value || '').match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!match) return null;
  return {
    coordinate: value,
    globalCol: Number(match[3]) - 1,
    globalRow: Number(match[4]) - 1
  };
}

const context = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  resultsTimeline: {
    turn: {
      turnKey: '0485-27',
      units: [
        { unitCode: '0485', unitType: 'Tribe', currentHex: 'AA0101' }
      ]
    }
  },
  state: {
    mode: 'detail',
    scale: 30,
    selected: null,
    planningVisible: true,
    scoutingVisible: true,
    planImport: {
      turnKey: '0485-27',
      plan: {
        turnKey: '0485-27',
        units: [
          { unit: '0485E1', type: 'Element', startHex: 'AB0202' }
        ],
        movements: []
      }
    }
  },
  parseCoordinate,
  movementPlannerState: { active: false, origin: null, route: null, knownHexes: null, knowledgeKey: null },
  draw: () => {},
  drawRoute: () => {},
  roundedRect: () => {},
  screenFromBase: () => ({ x: 0, y: 0 }),
  baseCenter: () => ({ x: 0, y: 0 }),
  ctx: {},
  movementPlannerRenderCard: () => {},
  movementPlannerReset: () => {},
  movementPlannerUpdateButton: () => {},
  movementPlannerSetStatus: () => {},
  movementPlannerRenderAllowances: () => {},
  movementPlannerToggle: async () => {},
  applyResultTurn: async () => null,
  selectHex: async () => {},
  centerOnHex: () => {},
  document: {
    getElementById: () => null,
    createElement: () => ({})
  },
  window: {
    tribenet: {
      listPlannedRoutes: async () => [],
      savePlannedRoute: async route => route,
      removePlannedRoute: async () => true
    }
  }
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'saved-movement-plans.js' });

const units = JSON.parse(vm.runInContext(`JSON.stringify(savedMovementUnits().map(unit => ({
  unitCode: unit.unitCode,
  unitType: unit.unitType,
  currentHex: unit.currentHex
})))`, context));
assert.deepStrictEqual(units, [
  { unitCode: '0485', unitType: 'Tribe', currentHex: 'AA0101' },
  { unitCode: '0485E1', unitType: 'Element', currentHex: 'AB0202' }
]);

vm.runInContext(`
  savedMovementPlansState.selectedUnitCode = '0485';
  savedMovementPlansState.routes = [{
    routeType: 'unit',
    unitCode: '0485',
    destinationHex: 'AC0303',
    path: [{ terrain: 'PR' }]
  }];
`, context);

assert.strictEqual(
  vm.runInContext(`savedMovementOriginFor('0485', 'unit', 'current')`, context),
  'AA0101',
  'Unit Move should start from the unit current location.'
);
assert.strictEqual(
  vm.runInContext(`savedMovementOriginFor('0485', 'scout', 'current')`, context),
  'AC0303',
  'Scouting should always start after a saved Unit Move.'
);
assert.strictEqual(
  vm.runInContext(`savedMovementOriginFor('0485', 'scout', 'after-unit')`, context),
  'AC0303',
  'The old optional scout-origin argument should not change the automatic after-movement origin.'
);

assert.ok(source.includes('movement-planner-setup-grid'), 'Unit/type/scouting controls should be rendered inside the planner card.');
assert.ok(source.includes('value="smart-scout"'), 'Movement controls should expose Smart Scout mode.');
assert.ok(!source.includes('movementPlannerScoutOrigin'), 'Scouting should not expose a before/after movement option.');
assert.ok(source.includes('savedMovementSaveSmartScout'), 'Smart Scout drafts should be saved as a replaceable scouting set.');
assert.ok(source.includes('data-select-planned-route'), 'Saved scout and movement rows should be clickable for route highlighting.');
assert.ok(source.includes('savedMovementSelectSavedRoute'), 'Clicking a saved route should select and center that route.');
assert.ok(source.includes('movementPlannerReset({ keepCard: true })'), 'Saving or resetting changes should leave the Movement controls available for the next unit.');
assert.ok(source.includes('movementPlannerResetAllUnitChanges'), 'Movement controls should expose a reset-all unit changes action.');
assert.ok(indexHtml.includes('<script src="saved-movement-plans.js"></script>'), 'Saved movement planner should load deterministically with the mapper.');
assert.ok(!preload.includes("savedPlansScript.src = 'saved-movement-plans.js'"), 'Preload should not inject the saved movement planner asynchronously.');

console.log('Saved movement unit selection/scout origin regression tests passed.');

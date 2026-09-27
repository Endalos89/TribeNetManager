const assert = require('assert');
const { planningTurnKey, actualDirections, actualPlanFromResult } = require('../src/turn-lifecycle-core');

(function nextTurnComesFromResultsMetadata() {
  assert.strictEqual(planningTurnKey({ turnKey:'906-03', metadata:{ nextTurn:'906-04' } }), '906-04');
  assert.strictEqual(planningTurnKey({ turnKey:'906-03', metadata:{} }), '906-04');
})();

(function actualDirectionsIgnoreFailedEntry() {
  assert.deepStrictEqual(
    actualDirections('Movement: N-PR, NE-D, SE-GH, Not enough M.P\'s to move to S into SWAMP'),
    ['N', 'NE', 'SE']
  );
  assert.deepStrictEqual(actualDirections('Scout 1: Move N-PR\\NE-D\\SW-BR'), ['N', 'NE', 'SW']);
})();

(function resultRoutesBecomeActualOverlayPlan() {
  const plan = actualPlanFromResult({
    turnKey:'906-03',
    sourceFile:'0485_906_03_Results.docx',
    units:[{
      unitType:'Tribe', unitCode:'0485', previousHex:'PK1614', currentHex:'PK1713',
      movement:'N-PR, NE-D',
      scouts:[{ id:1, report:'N-PR, NE-D, Not enough M.P\'s to move to N into BRUSH', raw:'Scout 1: N-PR, NE-D, Not enough M.P\'s to move to N into BRUSH' }]
    }]
  });
  assert.strictEqual(plan.actualResult, true);
  assert.strictEqual(plan.hasActualRoutes, true);
  assert.deepStrictEqual(plan.movements[0].orders, ['N','NE']);
  assert.strictEqual(plan.movements[0].startHex, 'PK1614');
  assert.deepStrictEqual(plan.scouts[0].orders, ['N','NE']);
})();

console.log('Turn lifecycle regression tests passed.');

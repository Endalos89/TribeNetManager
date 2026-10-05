const assert = require('assert');
const { planningTurnKey, planningTimelineEntry, actualDirections, actualPlanFromResult } = require('../src/turn-lifecycle-core');

(function nextTurnComesFromResultsMetadata() {
  assert.strictEqual(planningTurnKey({ turnKey:'906-03', metadata:{ nextTurn:'906-04' } }), '906-04');
  assert.strictEqual(planningTurnKey({ turnKey:'906-03', metadata:{} }), '906-04');
  assert.strictEqual(planningTurnKey({ turnKey:'906-02', metadata:{ nextTurn:'now' } }), '906-03');
})();

(function latestResultCreatesVisiblePlanningTimelineEntry() {
  const entry = planningTimelineEntry([
    { turnKey:'906-02', turnSort:906002, sourceFile:'906-02 Results.docx', metadata:{ nextTurn:'906-03' } },
    { turnKey:'906-03', turnSort:906003, sourceFile:'906-03 Results.docx', metadata:{ nextTurn:'906-04' } }
  ]);
  assert(entry, 'The Mapper should expose a planning entry after the latest Results turn.');
  assert.strictEqual(entry.turnKey, '906-04');
  assert.strictEqual(entry.baselineTurnKey, '906-03');
  assert.strictEqual(entry.isPlanningTurn, true);
})();

(function noDuplicatePlanningEntryWhenNextResultsAlreadyExist() {
  const entry = planningTimelineEntry([
    { turnKey:'906-03', turnSort:906003, metadata:{ nextTurn:'906-04' } },
    { turnKey:'906-04', turnSort:906004, metadata:{ nextTurn:'906-05' } }
  ]);
  assert(entry);
  assert.strictEqual(entry.turnKey, '906-05');
  assert.strictEqual(entry.baselineTurnKey, '906-04');
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

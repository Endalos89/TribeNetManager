const assert = require('assert');
const {
  planningTurnKeyFromResult,
  resultTurnToStartWorkbook,
  countsFromResultUnit,
  countsByUnitFromPlan,
  deriveMovementEnd,
  calculateSupplyRequirements
} = require('../src/turn-workflow');

(function resultsBecomeNextTurnPlanningBaseline() {
  const resultTurn = {
    turnKey: '906-03',
    metadata: { nextTurn: '906-04' },
    sourceFile: '0485_906_03_Results.docx',
    importedAt: '2026-09-27T10:00:00.000Z',
    units: [
      {
        unitType: 'Tribe', unitCode: '0485', currentHex: 'PK1714',
        people: { People: 100, Warriors: 30, Actives: 30, Inactives: 40 },
        skills: { For: 2, Fish: 1 }
      },
      {
        unitType: 'Element', unitCode: '0485e1', currentHex: 'PK1612',
        people: { People: 20, Warriors: 10, Actives: 10, Inactives: 0 },
        skills: {}
      }
    ]
  };

  const baseline = resultTurnToStartWorkbook(resultTurn);
  assert.strictEqual(baseline.role, 'start');
  assert.strictEqual(baseline.sourceKind, 'results');
  assert.strictEqual(baseline.resultTurnKey, '906-03');
  assert.strictEqual(baseline.turnKey, '906-04');
  assert.strictEqual(baseline.units[0].startHex, 'PK1714');
  assert.strictEqual(baseline.units[0].workers, 60);
  assert.strictEqual(baseline.units[1].parentTribe, '0485');
  assert.strictEqual(baseline.skillsByTribe['0485'].find(row => row.shortname === 'For').level, 2);
  assert.strictEqual(planningTurnKeyFromResult({ turnKey: '906-03' }), '906-04', 'fallback should increment the sub-turn when Next Turn metadata is absent');
})();

(function resultCountsUseReportedPeopleAndAnimals() {
  const counts = countsFromResultUnit({
    people: { People: 12, Warriors: 3, Actives: 3, Inactives: 4, Slaves: 2 },
    resources: { Animals: { Horse: 5, Cattle: 4, Goat: 3, Elephant: 1, Dog: 1 } }
  });
  assert.strictEqual(counts.warriors, 3);
  assert.strictEqual(counts.locals, 2, 'unclassified reported people should still be counted as ordinary people');
  assert.strictEqual(counts.slaves, 2);
  assert.strictEqual(counts.horses, 5);
})();

(function completedOrdersApplyBeforeMovementTransfers() {
  const states = countsByUnitFromPlan({
    clan: [
      { unit: '0485', warrior: 10, active: 10, inactive: 10, slave: 0, horse: 8, cattle: 4 },
      { unit: '0485e1', warrior: 0, active: 0, inactive: 0, slave: 0, horse: 0, cattle: 0 }
    ],
    unitCreations: [],
    transfers: [
      { timing: 'BM', from: '0485', to: '0485e1', item: 'WARRIORS', quantity: 4 },
      { timing: 'BM', from: '0485', to: '0485e1', item: 'HORSE', quantity: 3 },
      { timing: 'AM', from: '0485', to: '0485e1', item: 'CATTLE', quantity: 2 }
    ]
  });
  assert.strictEqual(states.get('0485').warriors, 6);
  assert.strictEqual(states.get('0485e1').warriors, 4);
  assert.strictEqual(states.get('0485').horses, 5);
  assert.strictEqual(states.get('0485e1').horses, 3);
  assert.strictEqual(states.get('0485').cattle, 4, 'AM transfers happen after movement and must not affect the movement-end requirement');
})();

(function movementEndUsesExplicitCommandsAndMarksConditionalOrders() {
  assert.deepStrictEqual(deriveMovementEnd('PK1614', ['NE', 'N']), {
    endHex: 'PK1713', uncertain: false, unresolvedOrder: null
  });
  const conditional = deriveMovementEnd('PK1614', ['NE', 'NEL']);
  assert.strictEqual(conditional.endHex, 'PK1714');
  assert.strictEqual(conditional.uncertain, true);
  assert.strictEqual(conditional.unresolvedOrder, 'NEL');
})();

(function mandateWaterAndFodderRates() {
  const counts = {
    warriors: 4, actives: 3, inactives: 3,
    slaves: 2, goats: 3, dogs: 1, cattle: 4, horses: 5, elephants: 1, camels: 0,
    hirelings: 0, mercs: 0, locals: 0, residents: 0, followers: 0, auxiliaries: 0
  };
  const arid = calculateSupplyRequirements({ counts, terrain: 'AR', adjacentTerrains: ['PR'] });
  assert.strictEqual(arid.waterRequired, 340);
  assert.strictEqual(arid.fodderRequired, 75);

  const desertWithFreshWater = calculateSupplyRequirements({ counts, terrain: 'DE', adjacentTerrains: ['L'] });
  assert.strictEqual(desertWithFreshWater.waterRequired, 0, 'adjacent freshwater applies to Desert as well as Arid');
  assert.strictEqual(desertWithFreshWater.fodderRequired, 75);

  const prairie = calculateSupplyRequirements({ counts, terrain: 'PR' });
  assert.strictEqual(prairie.waterRequired, 0);
  assert.strictEqual(prairie.fodderRequired, 0);

  const nonCoastalOcean = calculateSupplyRequirements({ counts, terrain: 'O', adjacentTerrains: ['O', 'O'] });
  assert.strictEqual(nonCoastalOcean.waterRequired, 340);
  assert.strictEqual(nonCoastalOcean.fodderRequired, 75);

  const coastalOcean = calculateSupplyRequirements({ counts, terrain: 'O', adjacentTerrains: ['O', 'PR'] });
  assert.strictEqual(coastalOcean.waterRequired, 0);
  assert.strictEqual(coastalOcean.fodderRequired, 0);

  const unknown = calculateSupplyRequirements({ counts, terrain: 'UNKNOWN' });
  assert.strictEqual(unknown.known, false);
  assert.strictEqual(unknown.waterRequired, 0);
  assert.strictEqual(unknown.fodderRequired, 0);
})();

(function dogsDoNotCreateFodderRequirementByThemselves() {
  const onlyDogs = calculateSupplyRequirements({
    counts: { warriors: 1, dogs: 10 },
    terrain: 'AR'
  });
  assert.strictEqual(onlyDogs.waterRequired, 60);
  assert.strictEqual(onlyDogs.fodderRequired, 0);
})();

console.log('Unified turn workflow regression tests passed.');
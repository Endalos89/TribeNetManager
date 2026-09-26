const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const { parseOrdersWorkbook } = require('../src/planner');
const { applyWagonAnimalRules } = require('../src/logistics-rules');

function addSheet(wb, name, rows) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
}

const wb = XLSX.utils.book_new();
addSheet(wb, 'Clan', [
  ['UnitName','Unit','GT','Warrior','Active','Inactive','Slave','Eaters','Provs','Months','Hirelings','Mercs','Locals','Residents','Followers','Auxiliaries','Workers','Used','Remains','Cattle','Dog','Elephant','Goat','Horse','Camel'],
  ['Main Tribe','0485','0485',10404,10404,10404,0,31212,40000,1.3,0,0,0,0,0,0,20808,20808,0,500,0,0,3700,400,0]
]);
addSheet(wb, 'Clan_Goods', [
  ['Tribe','Item_Type','Item','Number'],
  ['0485','FINISHED','PROVS',40000],
  ['0485','FINISHED','SLING',300],
  ['0485','ANIMAL','HORSE',400],
  ['0485','FINISHED','WAGON',300]
]);
addSheet(wb, 'Valid Goods', [
  ['Goods','Table','Shortname','Weight'],
  ['ACTIVES','HUMANS','Actives',0],
  ['WARRIORS','HUMANS','Warriors',0],
  ['PROVS','FINISHED','Provs',10],
  ['SLING','FINISHED','Sling',0.5],
  ['HORSE','ANIMAL','Horse',0],
  ['WAGON','FINISHED','Wagon',1000],
  ['BACKPACK','FINISHED','Backpacks',2],
  ['SADDLEBAG','FINISHED','Saddlebags',4]
]);
addSheet(wb, 'GM Actions', [
  ['Unit','What does the GM need to do?'],
  ['0485','Create Element 0485e1 from Tribe 0485']
]);
addSheet(wb, 'Transfers', [
  ['From','To','Item','Quantity','Transfer_Timing','Notes','Processed','Description of Transfer units'],
  ['0485','0485e1','ACTIVES',20,'BM',null,null,'Main Tribe Transfer to Forestry Unit'],
  ['0485','0485e1','WARRIORS',20,'BM',null,null,'Main Tribe Transfer to Forestry Unit'],
  ['0485','0485e1','PROVS',240,'BM'],
  ['0485','0485e1','SLING',20,'BM'],
  ['0485','0485e1','HORSE',32,'BM'],
  ['0485','0485e1','WAGON',16,'BM']
]);
addSheet(wb, 'Tribe_Movement', [
  ['UnitName','TRIBE','FOLLOW_TRIBE','MovementType','Hex','MOVEMENT_1','MOVEMENT_2'],
  ['Main Tribe','0485',null,null,'PK 1614','NE',null],
  ['Forestry','0485e1',null,null,'PK 1614','N','N']
]);
addSheet(wb, 'Scout_Movement', [['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission','Movement1']]);
addSheet(wb, 'Tribes_Activities', [['UnitName','TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION']]);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-planner-'));
const file = path.join(tempDir, '0485_906_3_Orders.xlsx');
XLSX.writeFile(wb, file);

try {
  const plan = applyWagonAnimalRules(parseOrdersWorkbook(file));
  assert.strictEqual(plan.formatVersion, 2);
  const main = plan.unitStats.find(row => row.unit === '0485');
  const forestry = plan.unitStats.find(row => row.unit === '0485e1');
  assert(main, 'Main tribe stats missing');
  assert(forestry, 'Forestry element stats missing');

  assert.strictEqual(main.eaters, 31172);
  assert.strictEqual(main.provs, 39760);
  assert(Math.abs(main.provisionTurns - (39760 / 31172)) < 1e-10);
  assert.strictEqual(main.wagonCount, 284);
  assert.strictEqual(main.draftAnimalsNeeded, 568);
  assert.strictEqual(main.cattlePulling, 500);
  assert.strictEqual(main.horsePulling, 68);
  assert.strictEqual(main.draftShortage, 0);
  assert.strictEqual(main.carriedWeight, 681740);
  assert.strictEqual(main.carryingCapacity, 1877160);

  assert.strictEqual(forestry.eaters, 40);
  assert.strictEqual(forestry.provs, 240);
  assert.strictEqual(forestry.provisionTurns, 6);
  assert.strictEqual(forestry.wagonCount, 16);
  assert.strictEqual(forestry.draftAnimalsNeeded, 32);
  assert.strictEqual(forestry.cattlePulling, 0);
  assert.strictEqual(forestry.horsePulling, 32);
  assert.strictEqual(forestry.draftShortage, 0);
  assert.strictEqual(forestry.carriedWeight, 18410);
  assert.strictEqual(forestry.carryingCapacity, 49200);

  const elephantPlan = {
    clan: [{ unit: '0001', cattle: 2, horse: 2, elephant: 1 }],
    transfers: [],
    unitStats: [{
      unit: '0001', wagonCount: 2, totalPeople: 10, warrior: 5, active: 5,
      carriedWeight: 2000, backpacks: 0, saddlebags: 0, camelCount: 0, warnings: []
    }]
  };
  applyWagonAnimalRules(elephantPlan);
  const elephantUnit = elephantPlan.unitStats[0];
  assert.strictEqual(elephantUnit.elephantsCarryingWagons, 1);
  assert.strictEqual(elephantUnit.wagonsNeedingDraftAnimals, 1);
  assert.strictEqual(elephantUnit.draftAnimalsNeeded, 2);
  assert.strictEqual(elephantUnit.cattlePulling, 2);
  assert.strictEqual(elephantUnit.horsePulling, 0);
  assert.strictEqual(elephantUnit.draftShortage, 0);

  console.log('Planner logistics regression test passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

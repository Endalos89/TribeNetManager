const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const { parseTurnWorkbook } = require('../src/turn-manager-parser');
const { buildCompletedTurnState, resolvePlanMovementStarts, completedStateToManagedUnits } = require('../src/completed-turn-state');

(function completedSplitProjectsAcrossViews() {
  const resultTurn = {
    turnKey: '906-03', sourceFile: '0485_906_03_Results.docx', importedAt: '2026-09-27T10:00:00.000Z',
    metadata: { nextTurn: '906-04' },
    units: [{
      unitType: 'Tribe', unitCode: '0485', unitName: 'Main Tribe', currentHex: 'PK1614', statusTerrain: 'PR',
      people: { People: 31172, Warriors: 10384, Actives: 10384, Inactives: 10404 },
      resources: {
        Animals: { Horse: 387, Cattle: 532, Goat: 3924 },
        'Finished Goods': { Wagon: 284, Provs: 92668, Trap: 500, Sling: 380 },
        'Raw Materials': { Log: 100 }
      },
      skills: { WOODWORK: 3, FORESTRY: 2 }
    }]
  };
  const plan = {
    turnKey: '906-04',
    clan: [{ unit:'0485', warrior:10384, active:10384, inactive:10404, horse:387, cattle:532, goat:3924 }],
    units: [{ unit:'0485', type:'Tribe' }, { unit:'1485', type:'Tribe', parentUnit:'0485' }],
    unitCreations: [{ type:'Tribe', unit:'1485', parentUnit:'0485', direction:null }],
    unitStats: [],
    movements: [
      { unit:'0485', unitName:'Main Tribe', type:'Tribe', startHex:null, orders:['N','N','N'] },
      { unit:'1485', unitName:'Shipbuilding Tribe', type:'Tribe', startHex:null, orders:['SE','SE','S','SE'] }
    ],
    transfers: [
      { from:'0485', to:'1485', item:'ACTIVES', quantity:2000, timing:'BM' },
      { from:'0485', to:'1485', item:'INACTIVES', quantity:2000, timing:'BM' },
      { from:'0485', to:'1485', item:'WARRIORS', quantity:2000, timing:'BM' },
      { from:'0485', to:'1485', item:'HORSE', quantity:100, timing:'BM' },
      { from:'0485', to:'1485', item:'WAGON', quantity:50, timing:'BM' },
      { from:'0485', to:'1485', item:'PROVS', quantity:20000, timing:'BM' },
      { from:'0485', to:'1485', item:'LOG', quantity:4, timing:'BM' },
      { from:'0485', to:'1485', item:'TRAP', quantity:100, timing:'BM' },
      { from:'0485', to:'1485', item:'SLING', quantity:80, timing:'BM' }
    ],
    skillTransfers: [{ skill:'Woodworking', level:3, fromTribe:'0485', toTribe:'1485' }]
  };

  const hydrated = resolvePlanMovementStarts(plan, resultTurn);
  assert.strictEqual(hydrated.movements.find(row => row.unit === '0485').startHex, 'PK1614');
  assert.strictEqual(hydrated.movements.find(row => row.unit === '1485').startHex, 'PK1614');

  const completed = buildCompletedTurnState(resultTurn, { sourceFile:'0485_906_4_Orders Complete.xlsx', plan });
  assert.strictEqual(completed.turnKey, '906-04');
  const source = completed.units.find(unit => unit.unitCode === '0485');
  const child = completed.units.find(unit => unit.unitCode === '1485');
  assert(source && child, 'Both the source and newly created Tribe must appear in the completed state.');

  assert.strictEqual(source.people.Warriors, 8384);
  assert.strictEqual(source.people.Actives, 8384);
  assert.strictEqual(source.people.Inactives, 8404);
  assert.strictEqual(child.people.Warriors, 2000);
  assert.strictEqual(child.people.Actives, 2000);
  assert.strictEqual(child.people.Inactives, 2000);

  assert.strictEqual(source.resources.Animals.Horse, 287);
  assert.strictEqual(child.resources.Animals.Horse, 100);
  assert.strictEqual(source.resources['Finished Goods'].Wagon, 234);
  assert.strictEqual(child.resources['Finished Goods'].Wagon, 50);
  assert.strictEqual(source.resources['Finished Goods'].Provs, 72668);
  assert.strictEqual(child.resources['Finished Goods'].Provs, 20000);
  assert.strictEqual(source.resources['Raw Materials'].Log, 96);
  assert.strictEqual(child.resources['Raw Materials'].Log, 4);
  assert.strictEqual(source.resources['Finished Goods'].Trap, 400);
  assert.strictEqual(child.resources['Finished Goods'].Trap, 100);
  assert.strictEqual(source.resources['Finished Goods'].Sling, 300);
  assert.strictEqual(child.resources['Finished Goods'].Sling, 80);

  assert.strictEqual(source.skills.WOODWORK, undefined);
  assert.strictEqual(child.skills.WOODWORK, 3);
  assert.strictEqual(source.currentHex, 'PK1611');
  assert.strictEqual(child.currentHex, 'PK1917');

  const managed = completedStateToManagedUnits(completed);
  assert(managed.some(unit => unit.unit === '1485' && unit.warrior === 2000 && unit.startHex === 'PK1917'));
})();

(function actualResultsBeatSameTurnProjection() {
  const actual = {
    turnKey: '906-04', metadata: { nextTurn: '906-05' }, sourceFile: '0485_906_04_Results.docx',
    units: [{ unitType:'Tribe', unitCode:'0485', currentHex:'PK1708', people:{ Warriors:9, Actives:8, Inactives:7 }, resources:{}, skills:{} }]
  };
  const submitted = { plan: { turnKey:'906-04', transfers:[{ from:'0485', to:'1485', item:'WARRIORS', quantity:2, timing:'BM' }], unitCreations:[{ type:'Tribe', unit:'1485', parentUnit:'0485' }], movements:[] } };
  const state = buildCompletedTurnState(actual, submitted);
  assert.strictEqual(state.turnKey, '906-04');
  assert.strictEqual(state.units.length, 1, 'A real Results report must replace the same-turn completed-orders projection.');
  assert.strictEqual(state.units[0].people.Warriors, 9);
})();

(function parserKeepsBlankHexMovementsAndMovesSkill() {
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add('Clan', [
    ['UnitName','Unit','GT','Warrior','Active','Inactive','Slave','Eaters','Provs','Workers','Used','Remains','Cattle','Dog','Elephant','Goat','Horse','Camel'],
    ['Main Tribe','0485','0485',100,100,100,0,300,1000,200,0,200,0,0,0,0,20,0]
  ]);
  add('Clan_Goods', [
    ['Tribe','Item_Type','Item','Number'],
    ['0485','FINISHED','PROVS',1000], ['0485','ANIMAL','HORSE',20], ['0485','FINISHED','WAGON',10]
  ]);
  add('Valid Goods', [
    ['Goods','Table','Shortname','Weight'],
    ['ACTIVES','HUMANS','Actives',0], ['INACTIVES','HUMANS','Inactives',0], ['WARRIORS','HUMANS','Warriors',0],
    ['PROVS','FINISHED','Provs',10], ['HORSE','ANIMAL','Horse',0], ['WAGON','FINISHED','Wagon',1000]
  ]);
  add('Valid_Skills', [
    ['SKILL','GROUP','SHORTNAME','0485','1485'],
    ['WOODWORK','A','Wd',3,null], ['FORESTRY','A','For',2,null]
  ]);
  add('GM Actions', [
    ['Unit','What does the GM need to do?'],
    ['0485','Create Tribe 1485 from 0485'],
    ['1485','Skill Woodworking 3 should be moved from Tribe 0485 to Tribe 1485']
  ]);
  add('Transfers', [
    ['From','To','Item','Quantity','Transfer_Timing','Notes','Processed','Description of Transfer units'],
    ['0485','1485','WARRIORS',20,'BM'], ['0485','1485','ACTIVES',20,'BM'], ['0485','1485','INACTIVES',20,'BM'],
    ['0485','1485','HORSE',5,'BM'], ['0485','1485','WAGON',2,'BM'], ['0485','1485','PROVS',200,'BM']
  ]);
  add('Tribe_Movement', [
    ['UnitName','TRIBE','FOLLOW_TRIBE','MovementType','Hex','MOVEMENT_1','MOVEMENT_2'],
    ['Main Tribe','0485',null,null,null,'N','N'],
    ['Shipbuilding Tribe','1485',null,null,null,'SE','S']
  ]);
  add('Scout_Movement', [['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission','Movement1']]);
  add('Tribes_Activities', [['UnitName','TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION']]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-completed-split-'));
  const file = path.join(dir, '0485_906_4_Orders Complete.xlsx');
  XLSX.writeFile(wb, file);
  try {
    const parsed = parseTurnWorkbook(file, 'final');
    const movement = parsed.movements.find(row => row.unit === '1485');
    assert(movement, 'Blank-Hex movement row should not be discarded.');
    assert.strictEqual(movement.startHex, null);
    assert.deepStrictEqual(movement.orders, ['SE','S']);
    assert(parsed.units.some(unit => unit.unit === '1485'), 'Created Tribe should be present in final units.');
    assert(!parsed.skillsByTribe['0485'].some(skill => skill.skill === 'WOODWORK'), 'WOODWORK should leave the source Tribe.');
    const moved = parsed.skillsByTribe['1485'].find(skill => skill.skill === 'WOODWORK');
    assert(moved && moved.level === 3, 'Woodworking GM wording should map to WOODWORK 3 on the new Tribe.');
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})();

console.log('Completed split state regression tests passed.');
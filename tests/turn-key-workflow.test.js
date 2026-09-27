const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

require('../src/workflow-fixes');
const { canonicalTurnKey, inferTurnKeyFromFilename } = require('../src/turn-key');
const { parseTurnWorkbook } = require('../src/turn-manager-parser');
const { TribeNetDatabase } = require('../src/database');

assert.strictEqual(canonicalTurnKey('906-4'), '906-04');
assert.strictEqual(canonicalTurnKey('906_04'), '906-04');
assert.strictEqual(inferTurnKeyFromFilename('0485_906_4_Orders Complete.xlsx'), '906-04');
assert.strictEqual(inferTurnKeyFromFilename('0485_906_03_Results.docx'), '906-03');

(function completedWorkbookKeepsMovementAndGotoSemantics() {
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add('Clan', [
    ['UnitName','Unit','GT','Warrior','Active','Inactive','Slave','Eaters','Provs','Workers','Used','Remains','Cattle','Dog','Elephant','Goat','Horse','Camel'],
    ['Main','0485','0485',10,10,10,0,30,100,20,0,20,0,0,0,0,5,0]
  ]);
  add('Clan_Goods', [['Tribe','Item_Type','Item','Number']]);
  add('Valid Goods', [['Goods','Table','Shortname','Weight']]);
  add('Valid_Skills', [['SKILL','GROUP','SHORTNAME','0485']]);
  add('GM Actions', [
    ['Unit','What does the GM need to do?'],
    ['0485','Create Tribe 1485 from 0485']
  ]);
  add('Transfers', [['From','To','Item','Quantity','Transfer_Timing','Notes','Processed','Description of Transfer units']]);
  add('Tribe_Movement', [
    ['UnitName','TRIBE','FOLLOW_TRIBE','MovementType','Hex','MOVEMENT_1','MOVEMENT_2'],
    ['Main','0485',null,null,null,'N','NE'],
    ['New Tribe','1485',null,null,'PK2010','GOTO',null]
  ]);
  add('Scout_Movement', [
    ['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission','Movement1','Movement2'],
    ['Main','0485',2,2,'PATROL','SE','S']
  ]);
  add('Tribes_Activities', [['UnitName','TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION']]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-turn-key-'));
  const file = path.join(dir, '0485_906_4_Orders Complete.xlsx');
  XLSX.writeFile(wb, file);
  try {
    const parsed = parseTurnWorkbook(file, 'final');
    assert.strictEqual(parsed.turnKey, '906-04');
    assert.strictEqual(parsed.rawPlan.turnKey, '906-04');
    const main = parsed.rawPlan.movements.find(row => row.unit === '0485');
    const child = parsed.rawPlan.movements.find(row => row.unit === '1485');
    assert(main, 'Blank-Hex normal movement must survive parsing.');
    assert.deepStrictEqual(main.orders, ['N','NE']);
    assert.strictEqual(main.startHex, null, 'Hex is not a movement origin.');
    assert(child, 'GOTO movement must survive parsing.');
    assert.strictEqual(child.startHex, null);
    assert.strictEqual(child.gotoHex, 'PK2010');
    assert.deepStrictEqual(child.orders, ['GOTO PK2010']);
    assert(parsed.rawPlan.unitCreations.some(row => row.unit === '1485'));
    assert.strictEqual(parsed.rawPlan.scouts.length, 1);
    assert.deepStrictEqual(parsed.rawPlan.scouts[0].orders, ['SE','S']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

(function legacyStoredTurnKeysMigrate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-key-db-'));
  try {
    const first = new TribeNetDatabase(dir);
    first.db.prepare(`INSERT INTO turn_imports(turn_key, source_file, imported_at, plan_json, is_active) VALUES (?, ?, ?, ?, 1)`)
      .run('906-4', 'old.xlsx', new Date().toISOString(), JSON.stringify({ turnKey:'906-4', movements:[], scouts:[] }));
    first.close();

    const reopened = new TribeNetDatabase(dir);
    const imports = reopened.getTurnImports('906-04');
    assert.strictEqual(imports.length, 1);
    const plan = reopened.getTurnPlanForTurn('906-04');
    assert.strictEqual(plan.turnKey, '906-04');
    assert.strictEqual(plan.plan.turnKey, '906-04');
    reopened.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

console.log('Turn key workflow regression tests passed.');

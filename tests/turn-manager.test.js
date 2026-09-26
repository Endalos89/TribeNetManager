const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const { parseTurnWorkbook } = require('../src/turn-manager-parser');
const { ACTIVITY_CATALOG, sharedWorkerLimit, skillLevelFor } = require('../src/activity-catalog');
const { TurnManagerDatabase } = require('../src/turn-manager-database');

function addSheet(wb, name, rows) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name); }

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-turn-manager-'));
const file = path.join(tempDir, '0485_906_03_Beginning.xlsx');
const wb = XLSX.utils.book_new();
addSheet(wb, 'Clan', [
  ['UnitName','Unit','GT','Warrior','Active','Inactive','Slave','Eaters','Workers','Used','Remains','Cattle','Elephant','Horse'],
  ['Main Tribe','0485','0485',100,80,60,0,240,180,0,180,10,0,40]
]);
addSheet(wb, 'Skills', [
  ['SKILL','GROUP','SHORTNAME','0485'],
  ['FORESTRY','B','For',2],
  ['WEAVING','C','Weav',1]
]);
addSheet(wb, 'Clan_Goods', [['Tribe','Item_Type','Item','Number']]);
addSheet(wb, 'Valid Goods', [['Goods','Table','Shortname','Weight']]);
addSheet(wb, 'GM Actions', [['Unit','What does the GM need to do?'],['0485','Create Element 0485e1 from Tribe 0485']]);
addSheet(wb, 'Transfers', [['From','To','Item','Quantity','Transfer_Timing']]);
addSheet(wb, 'Tribe_Movement', [
  ['UnitName','TRIBE','Hex','MOVEMENT_1'],
  ['Main Tribe','0485','PK 1614','N'],
  ['Forestry','0485e1','PK 1614','N']
]);
addSheet(wb, 'Scout_Movement', [['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission','Movement1']]);
addSheet(wb, 'Tribes_Activities', [['UnitName','TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION']]);
XLSX.writeFile(wb, file);

try {
  const parsed = parseTurnWorkbook(file, 'start');
  assert.strictEqual(parsed.role, 'start');
  assert.strictEqual(parsed.turnKey, '906-03');
  assert.strictEqual(parsed.units.length, 2);
  const main = parsed.units.find(u => u.unit === '0485');
  const element = parsed.units.find(u => u.unit === '0485e1');
  assert(main && element);
  assert.strictEqual(element.parentTribe, '0485');
  assert.strictEqual(element.skills.find(s => s.skill === 'FORESTRY').level, 2);

  const forestry = ACTIVITY_CATALOG.find(a => a.code === 'FORESTRY');
  assert(forestry);
  const level = skillLevelFor(forestry, element.skills);
  assert.strictEqual(level, 2);
  assert.strictEqual(sharedWorkerLimit(forestry, level), 20);
  assert(ACTIVITY_CATALOG.length >= 40, 'Expected general and specialist activity catalogue entries');

  const dbRoot = path.join(tempDir, 'userdata');
  const db = new TurnManagerDatabase(dbRoot);
  db.saveWorkbook(parsed);
  const replacement = { ...parsed, sourceFile: 'replacement.xlsx', importedAt: new Date().toISOString() };
  db.saveWorkbook(replacement);
  assert.strictEqual(db.listTurns().length, 1, 'Re-import should override same turn/role, not duplicate it');
  assert.strictEqual(db.getTurn(parsed.turnKey).start.sourceFile, 'replacement.xlsx');

  db.saveWorkbook({ ...parsed, role: 'final', sourceFile: 'final.xlsx' });
  const stored = db.getTurn(parsed.turnKey);
  assert(stored.start && stored.final, 'Beginning and finalized workbooks should coexist');

  const activity = db.addActivity(parsed.turnKey, { unit: '0485e1', activityCode: 'FORESTRY', people: 10, target: 'Logs', notes: 'test' });
  assert(activity.id > 0);
  assert.strictEqual(db.listActivities(parsed.turnKey)[0].people, 10);
  db.saveContext(parsed.turnKey, 'extra context');
  assert.strictEqual(db.getContext(parsed.turnKey).notes, 'extra context');
  db.close();

  console.log('Turn Manager regression test passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

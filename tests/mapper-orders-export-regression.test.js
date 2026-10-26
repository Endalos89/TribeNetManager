const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const { PlannedRoutesDatabase } = require('../src/planned-routes-database');
const { buildOrdersExportData, mergeDraftRoutes, mergeDraftSplits } = require('../src/orders-export-data');
const { canonicalTurnKey } = require('../src/turn-key');
const { saveOrderTemplate, findOrderTemplate, patchOrdersWorkbook } = require('../src/orders-workbook');

const main = fs.readFileSync(path.join(__dirname,'../src/main.js'), 'utf8');
const launcher = fs.readFileSync(path.join(__dirname,'../src/launcher-imports.js'), 'utf8');
const importStart = main.indexOf('function saveCompletedOrders(filePath) {');
const importEnd = main.indexOf('\nfunction terrainContextForHex', importStart);
assert(importStart >= 0 && importEnd > importStart);
assert.doesNotMatch(main.slice(importStart, importEnd), /clearDraftPlanning|removeAllScoutRoutesForUnit|routesDb\(\)\.remove/,
  'Importing a Completed Orders workbook must not delete saved Mapper orders');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-db-export-regression-'));
const db = new PlannedRoutesDatabase(temp);
function route(turnKey, routeType, unitCode, directions, overrides = {}) {
  return {
    turnKey, routeType, unitCode, tribeCode: '0485',
    originHex:'AA0101',destinationHex:'AA0103',
    directions, path:[{coordinate:'AA0101'},{coordinate:'AA0103'}],
    knownMp:4, noOfScouts:2,noOfHorses:1,mission:'PATROL',
    ...overrides
  };
}
function blankWorkbook(filename) {
  const wb=XLSX.utils.book_new();
  function sheet(name,headers) {
    const rows=[headers, ...Array.from({length:16},()=>headers.map(()=> ' '))];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
  }
  sheet('Tribe_Movement',['UnitName','TRIBE','FOLLOW_TRIBE','MovementType','Hex',
    ...Array.from({length:40},(_,i)=>'MOVEMENT_'+(i+1)), 'Processed']);
  sheet('Scout_Movement',['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission',
    ...Array.from({length:9},(_,i)=>'Movement'+(i+1)),'Processed']);
  sheet('Tribes_Activities',['TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION','Processed']);
  sheet('Comments',['Unit','Message/Notes']);
  sheet('GM Actions',['Unit','What does the GM need to do?']);
  sheet('Valid Units',['Unit','Description']);
  sheet('Skill_Attempts',['TRIBE','ORDER','TOPIC']);
  XLSX.writeFile(wb,filename);
}
function fromSqlite() {
  const beginning=main.indexOf('function ordersExportDraftKeys(turnKey) {');
  const ending=main.indexOf('\nfunction saveCompletedOrders(filePath)',beginning);
  assert(beginning>=0 && ending>beginning,'Export snapshot functions must be inspectable');
  const context={
    canonicalTurnKey, mergeDraftRoutes, mergeDraftSplits,
    routesDb:()=>db,
    resultForPlanTurn:()=>({turnKey:'906-04'}),
    ordersExportBaseline:()=>({units:[
      {unit:'0485',type:'Tribe',warrior:20,workers:20},
      {unit:'0485e1',type:'Element',warrior:10,workers:10}
    ]}),
    turnManagerDatabase:{
      listUnitSplits:()=>[], listTransfers:()=>[],
      getSkillAttempts:()=>[],listActivities:()=>[]
    },
    assembleOrdersExportData:buildOrdersExportData
  };
  vm.runInNewContext(main.slice(beginning,ending)+'\nthis.buildExport=buildOrdersExportData;',context);
  return context.buildExport('906-05');
}
(async()=>{
 try {
  // Save directly through the same SQLite class and values used by Mapper IPC.
  // The current planning turn may have been stored with a legacy spelling.
  db.save(route('906-04','unit','0485',['SW']));
  db.save(route('906-05','unit','0485',['N','NE']));
  db.save(route('906_05','scout','0485',['S']));
  const plan=fromSqlite();
  assert.deepEqual(Array.from(plan.savedRouteCounts.keys).slice(0,3),['906-05','906_05','906-04']);
  assert.equal(plan.savedRouteCounts.movement,1);
  assert.equal(plan.savedRouteCounts.scouting,1);
  assert.deepEqual(Array.from(plan.movements.find(row=>row.unitCode==='0485').directions),['N','NE'],
    'Saved current-turn movement must win over old Results-turn route');
  assert.deepEqual(Array.from(plan.scouts[0].directions),['S'],
    'A scout saved under a legacy planning key must be exported');

  const blank=path.join(temp,'blank.xlsx');
  blankWorkbook(blank);
  const stored=await saveOrderTemplate(blank,temp,'906-05');
  const original=fs.readFileSync(stored.storedPath);
  assert.equal(await findOrderTemplate(temp,'906-05'),stored.storedPath);
  const output=path.join(temp,'Completed Orders','906_05_Orders Complete.xlsx');
  const {savedRouteCounts, ...data}=plan;
  await patchOrdersWorkbook({templatePath:stored.storedPath,outputPath:output,...data});
  let wb=XLSX.readFile(output);
  let moves=XLSX.utils.sheet_to_json(wb.Sheets.Tribe_Movement)
    .filter(row=>row.TRIBE&&String(row.MOVEMENT_1)!=='EMPTY');
  assert.deepEqual(moves.filter(row=>row.TRIBE==='0485').map(row=>[row.MOVEMENT_1,row.MOVEMENT_2]),
    [['N','NE']], 'Exported movement must be read from database rather than blank Still fallback');
  let scouts=XLSX.utils.sheet_to_json(wb.Sheets.Scout_Movement).filter(row=>Number(row.No_of_Scouts)>0);
  assert.equal(scouts.length,1);
  assert.equal(scouts[0].Movement1,'S');
  assert.equal(scouts[0].No_of_Scouts,2);
  assert.equal(scouts[0].No_of_Horses,1);
  assert.deepEqual(fs.readFileSync(stored.storedPath),original,'Saved Ravenpost template must be unchanged');

  // Remove saved scout and change movement; repeated export must not resurrect
  // old values from the previously completed workbook.
  db.remove(db.list('906_05')[0].id);
  db.save(route('906-05','unit','0485',['SE']));
  const next=fromSqlite();
  assert.equal(next.savedRouteCounts.scouting,0);
  const {savedRouteCounts:discard, ...nextData}=next;
  await patchOrdersWorkbook({templatePath:stored.storedPath,outputPath:output,...nextData});
  wb=XLSX.readFile(output);
  scouts=XLSX.utils.sheet_to_json(wb.Sheets.Scout_Movement).filter(row=>Number(row.No_of_Scouts)>0);
  assert.equal(scouts.length,0);
  moves=XLSX.utils.sheet_to_json(wb.Sheets.Tribe_Movement);
  assert.equal(moves.find(row=>row.TRIBE==='0485').MOVEMENT_1,'SE');
  assert.deepEqual(fs.readFileSync(stored.storedPath),original);

  // When viewing Results 906-04, the exporter must target the Mapper planning
  // turn 906-05, not accidentally export a blank 906-04 workbook.
  const start=launcher.indexOf('function selectedPlanningTurnKey() {');
  const end=launcher.indexOf('\n  async function refreshOrdersStatus',start);
  assert(start>=0&&end>start);
  const ctx={
    canonicalTurnKey,resultsTimeline:{turn:{turnKey:'906-04',isPlanningTurn:false}},
    lifecyclePlanningTurnKey:()=> '906-05',
    localStorage:{getItem:()=> '906-04'}
  };
  vm.runInNewContext(launcher.slice(start,end)+'\nthis.selectedTurn=selectedPlanningTurnKey;',ctx);
  assert.equal(ctx.selectedTurn(),'906-05');
  ctx.resultsTimeline.turn={turnKey:'906-06',isPlanningTurn:true};
  assert.equal(ctx.selectedTurn(),'906-06');
  console.log('Mapper SQLite -> export -> re-export and displayed planning turn tests passed');
 } finally {
  db.close();
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

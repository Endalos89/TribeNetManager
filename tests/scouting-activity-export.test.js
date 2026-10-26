const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const { assembleActivityAssignments } = require('../src/activity-assignments');
const { patchOrdersWorkbook, normalizeActivityRows, saveOrderTemplate, findOrderTemplate } = require('../src/orders-workbook');
const { parseOrdersWorkbook } = require('../src/planner');

const baseline = [
  { unit:'0485', type:'Tribe', warrior:20, workers:30 },
  { unit:'0485g1', type:'Garrison', warrior:8, workers:8 }
];
const splits = [{ unitCode:'0485e1', parentUnit:'0485', unitType:'Element', creationPhase:'after' }];
const routes = [
  { id:1, routeType:'scout', unitCode:'0485', scoutNumber:1, mission:'PATROL', noOfScouts:2, noOfHorses:2, equipment:'Spears' },
  { id:2, routeType:'scout', unitCode:'0485e1', scoutNumber:2, mission:'PATROL', noOfScouts:3, noOfHorses:1, equipment:'Bows' },
  { id:3, routeType:'scout', unitCode:'0485g1', scoutNumber:3, mission:'PATROL', noOfScouts:1, noOfHorses:0 }
];
const regular = [
  { unit:'0485', activityCode:'HUNTING', people:4, target:'DEER' },
  { unit:'0485g1', activityCode:'FORESTRY', people:2 },
  { unit:'0485', activityCode:'FORAGING', people:3 }
];
const assigned = assembleActivityAssignments({ routes, unitSplits:splits, baselineUnits:baseline, activities:regular });
assert.deepEqual(assigned.activities.map(row => [row.unit,row.activity,row.people]), [
  ['0485','HUNTING',4],['0485','FORAGING',3],['0485','SCOUTING',5],
  ['0485g1','FORESTRY',2],['0485g1','SCOUTING',1]
]);
assert.deepEqual(assigned.derived.map(row=>[row.unit,row.activity,row.item,row.distinction,row.people]), [
  ['0485','SCOUTING','SCOUTING','NONE',5],
  ['0485g1','SCOUTING','SCOUTING','NONE',1]
], 'Both original and split-unit scout worker allocations use the required Item and Distinction');
assert.deepEqual(assigned.comments, [{
  unit:'0485',
  text:'Allocated scouting for 0485 includes scouting performed by 0485e1.'
}], 'Only the split-unit scout should generate a Comment against its original unit');
assert.deepEqual(assembleActivityAssignments({ routes:[routes[0],routes[2]],baselineUnits:baseline }).comments, [],
  'Ordinary scouting by existing units must not generate Comments');
assert.deepEqual(assembleActivityAssignments({ routes:[routes[0]], unitSplits:splits, baselineUnits:baseline }).comments, [],
  'A new unit with no scouting party must not generate a scouting Comment');
const multiplePartiesFromNewUnit = assembleActivityAssignments({
  routes:[routes[1],{...routes[1],id:4,scoutNumber:4,noOfScouts:1}],
  unitSplits:splits, baselineUnits:baseline
});
assert.equal(multiplePartiesFromNewUnit.derived[0].people,4);
assert.equal(multiplePartiesFromNewUnit.comments.length,1,
  'Multiple scout parties from the same new unit need only one Comment');
assert.equal(assembleActivityAssignments({ routes:[{...routes[0],noOfScouts:6}],baselineUnits:baseline }).derived[0].people,6);
assert.equal(assembleActivityAssignments({ routes:[],baselineUnits:baseline }).derived.length,0);
assert.throws(() => assembleActivityAssignments({routes:[{...routes[0], unitCode:'0485c1'}]}),/Courier/);
assert.throws(() => assembleActivityAssignments({routes:[{...routes[0], mission:'RAID'}]}),/PATROL/);
assert.throws(() => assembleActivityAssignments({routes:Array.from({length:9},(_,i)=>({...routes[0],scoutNumber:i+1}))}),/eight scouting/);
assert.throws(() => assembleActivityAssignments({routes:[{...routes[0],noOfScouts:21}],baselineUnits:baseline}),/only 20 warriors/);
assert.throws(() => assembleActivityAssignments({
  routes:[routes[0]],activities:[{unit:'0485',activityCode:'SCOUTING',people:2}]
}),/manual SCOUTING/);
assert.deepEqual(normalizeActivityRows([{ unit:'0485g1', activity:'SCOUTING', people:1 },
  { unit:'0485', activity:'HUNTING', people:4 }, { unit:'0485', activity:'SCOUTING', people:5 }],10)
  .map(row=>row.unit),['0485','0485','0485g1']);

function fakeSheet(headers, capacity = 12) {
  return XLSX.utils.aoa_to_sheet([headers,...Array.from({length:capacity},()=>headers.map(()=>' '))]);
}
function blankWorkbook(filename, withComments = true) {
  const wb = XLSX.utils.book_new();
  const movement = ['UnitName','TRIBE','FOLLOW_TRIBE','MovementType','Hex',
    ...Array.from({length:40},(_,i)=>'MOVEMENT_'+(i+1)),'Processed'];
  const scout = ['UnitName','TRIBE','No_of_Scouts','No_of_Horses','Mission',
    ...Array.from({length:9},(_,i)=>'Movement'+(i+1)),'Processed'];
  const sheets = [
    ['Tribe_Movement',movement],['Scout_Movement',scout],
    ['Tribes_Activities',['TRIBE','ACTIVITY','ITEM','DISTINCTION','PEOPLE','MINING_DIRECTION','Processed']],
    ['GM Actions',['Unit','What does the GM need to do?']],
    ['Valid Units',['Unit','Description']],
    ['Skill_Attempts',['TRIBE','ORDER','TOPIC']]
  ];
  if (withComments) sheets.push(['Comments',['Unit','Message/Notes']]);
  for (const [name,headers] of sheets) XLSX.utils.book_append_sheet(wb,fakeSheet(headers),name);
  XLSX.writeFile(wb,filename);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'tribenet-scout-export-'));
const blank = path.join(temp,'blank.xlsx');
const output = path.join(temp,'exported.xlsx');
(async() => {
  try {
    blankWorkbook(blank);
    const originalBlank = fs.readFileSync(blank);
    const userData = path.join(temp, 'app-user-data');
    const savedTemplate = await saveOrderTemplate(blank, userData, '906-05');
    assert.equal(await findOrderTemplate(userData, '906-05'),savedTemplate.storedPath);
    assert.deepEqual(fs.readFileSync(savedTemplate.storedPath),originalBlank,
      'Get blank Orders must save an unmodified copy for the turn');
    await patchOrdersWorkbook({
      templatePath:savedTemplate.storedPath, outputPath:output,
      movements:[{ unitCode:'0485',directions:['Still'] },{ unitCode:'0485e1',directions:['Still'] }],
      scouts:routes.map(r => ({...r,directions:['N']})),
      activities:assigned.activities, comments:assigned.comments,
      validUnits:[{unitCode:'0485'},{unitCode:'0485e1'},{unitCode:'0485g1'}]
    });
    const wb = XLSX.readFile(output,{cellFormula:true});
    const activities = XLSX.utils.sheet_to_json(wb.Sheets.Tribes_Activities);
    assert.deepEqual(activities.filter(row=>row.ACTIVITY).map(row=>[row.TRIBE,row.ACTIVITY,row.PEOPLE]),
      [['0485','HUNTING',4],['0485','FORAGING',3],['0485','SCOUTING',5],
       ['0485g1','FORESTRY',2],['0485g1','SCOUTING',1]]);
    assert.deepEqual(activities.filter(row=>row.ACTIVITY === 'SCOUTING')
      .map(row=>[row.TRIBE,row.ITEM,row.DISTINCTION]), [
        ['0485','SCOUTING','NONE'],
        ['0485g1','SCOUTING','NONE']
      ], 'Excel Tribes_Activities must write ITEM=SCOUTING and DISTINCTION=NONE');
    const comments = XLSX.utils.sheet_to_json(wb.Sheets.Comments).filter(row=>row['Message/Notes']);
    assert.equal(comments.length,1,'Only split-unit scouting generates a scouting Comment');
    assert.equal(comments[0].Unit,'0485');
    assert.equal(comments[0]['Message/Notes'],
      'Allocated scouting for 0485 includes scouting performed by 0485e1.');
    assert.deepEqual(fs.readFileSync(blank),originalBlank,'The original blank attachment must remain byte-for-byte untouched');
    assert.deepEqual(fs.readFileSync(savedTemplate.storedPath),originalBlank,'The app copy of the blank Orders template must remain unchanged');
    const missingCommentsTemplate = path.join(temp, 'blank-no-comments.xlsx');
    const fallbackOutput = path.join(temp, 'export-no-comments.xlsx');
    blankWorkbook(missingCommentsTemplate, false);
    await patchOrdersWorkbook({
      templatePath: missingCommentsTemplate, outputPath: fallbackOutput,
      activities: assigned.activities, comments: assigned.comments,
      validUnits:[{unitCode:'0485'},{unitCode:'0485e1'},{unitCode:'0485g1'}]
    });
    const fallbackWb = XLSX.readFile(fallbackOutput);
    assert.equal(Boolean(fallbackWb.Sheets.Comments), false,
      'Do not invent a Comments worksheet in a blank template');
    const fallbackActions = XLSX.utils.sheet_to_json(fallbackWb.Sheets['GM Actions'])
      .filter(row=>row['What does the GM need to do?']);
    assert.equal(fallbackActions.length,1);
    assert.equal(fallbackActions[0].Unit,'0485');
    assert.equal(fallbackActions[0]['What does the GM need to do?'],
      'Allocated scouting for 0485 includes scouting performed by 0485e1.');
    const imported = parseOrdersWorkbook(output);
    assert.equal(imported.activities.filter(r=>r.activity==='SCOUTING').length,2);

    // Export a changed turn onto the SAME completed file: all previous
    // scouting routes, Activities and Comments must disappear. This proves
    // the exporter rebuilds from the blank template rather than patching
    // the last completed workbook.
    await patchOrdersWorkbook({
      templatePath:savedTemplate.storedPath,outputPath:output,
      movements:[{ unitCode:'0485',directions:['S'] }],
      scouts:[], activities:[], comments:[],
      validUnits:[{ unitCode:'0485' }]
    });
    const second = XLSX.readFile(output, {cellFormula:true});
    assert.deepEqual(XLSX.utils.sheet_to_json(second.Sheets.Scout_Movement)
      .filter(row => row.TRIBE && Number(row.No_of_Scouts || 0)), [], 'Removed scouts must not survive re-export');
    assert.deepEqual(XLSX.utils.sheet_to_json(second.Sheets.Tribes_Activities)
      .filter(row => row.TRIBE && row.ACTIVITY), [], 'Old activity rows must not survive re-export');
    assert.deepEqual(XLSX.utils.sheet_to_json(second.Sheets.Comments)
      .filter(row => row.Unit && row['Message/Notes']), [], 'Old Comments must not survive re-export');
    const movementRows = XLSX.utils.sheet_to_json(second.Sheets.Tribe_Movement);
    assert.equal(movementRows.find(row => String(row.TRIBE ?? '').padStart(4, '0') === '0485')?.MOVEMENT_1, 'S',
      'Repeated export must write the new direction for Tribe 0485. Got: ' + JSON.stringify(movementRows.slice(0, 3)));
    assert.deepEqual(fs.readFileSync(blank), originalBlank,
      'Multiple exports must never mutate the original Ravenpost blank template');
    assert.deepEqual(fs.readFileSync(savedTemplate.storedPath), originalBlank,
      'Stored empty Orders attachment remains pristine across repeated exports');

    // A later failing export may not corrupt the last successful completed file.
    const previousCompleted = fs.readFileSync(output);
    await assert.rejects(patchOrdersWorkbook({
      templatePath:savedTemplate.storedPath, outputPath:output, 
      scouts:[{unitCode:'0485',noOfScouts:2,noOfHorses:2,mission:'PATROL',directions:['INVALID']}]
    }),/invalid movement/);
    assert.deepEqual(fs.readFileSync(output),previousCompleted,'Failed export must not damage the last completed workbook');
    console.log('scouting activity assignment and repeat-from-blank workbook export tests passed');
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(err=>{ console.error(err); process.exitCode=1; });

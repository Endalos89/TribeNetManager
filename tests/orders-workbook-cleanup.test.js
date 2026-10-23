const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { patchOrdersWorkbook } = require('../src/orders-workbook');

function row(headers, values) {
  const output = Array(Math.max(headers.length, values.length)).fill(null);
  headers.forEach((value, index) => { output[index] = value; });
  values.forEach((value, index) => { output[index] = value; });
  return output;
}

const movementHeaders = Array(46).fill(null);
movementHeaders[1] = 'TRIBE'; movementHeaders[5] = 'MOVEMENT_1'; movementHeaders[44] = 'MOVEMENT_40'; movementHeaders[45] = 'Processed';
const scoutHeaders = Array(15).fill(null);
scoutHeaders[1] = 'TRIBE'; scoutHeaders[2] = 'No_of_Scouts'; scoutHeaders[3] = 'No_of_Horses'; scoutHeaders[4] = 'Mission'; scoutHeaders[5] = 'Movement1'; scoutHeaders[13] = 'Movement9'; scoutHeaders[14] = 'Processed';
const gmHeaders = ['Unit', 'What does the GM need to do?'];
const validHeaders = ['Unit', 'Description'];
const skillAttemptHeaders = ['TRIBE', 'ORDER', 'TOPIC', 'Processed', 'Attempting'];

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-workbook-cleanup-'));
const templatePath = path.join(temp, 'blank.xlsx');
const outputPath = path.join(temp, 'export.xlsx');
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  movementHeaders,
  row(movementHeaders, [null, '0485e9', null, null, null, 'N']),
  row(movementHeaders, [null, '0485e1', null, null, null, 'S'])
]), 'Tribe_Movement');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  scoutHeaders,
  row(scoutHeaders, [null, '0485e9', 2, 0, 'PATROL', null, 'N']),
  row(scoutHeaders, [null, '0485e1', 1, 0, 'PATROL', null, 'S'])
]), 'Scout_Movement');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([gmHeaders, ['0485', 'Create Element 0485e9 from 0485']]), 'GM Actions');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([validHeaders, ['0485', 'Main Tribe'], ['0485e9', 'Deleted Element']]), 'Valid Units');
const skillAttemptsSheet = XLSX.utils.aoa_to_sheet([
  skillAttemptHeaders,
  ['0485', 1, 'DIPLOMACY', null, null],
  ['0485', 2, 'ENGINEERING', null, null],
  ['0485', 3, 'FISHING', null, null]
]);
skillAttemptsSheet.E2 = { t: 'n', f: 'IF(C2<>"",1,0)', v: 0 };
XLSX.utils.book_append_sheet(workbook, skillAttemptsSheet, 'Skill_Attempts');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['From', 'To', 'Item', 'Quantity', 'Transfer_Timing', 'Notes', 'Processed', 'Description of Transfer units'],
  [null, null, null, null, null, null, 0, 'Existing transfer'],
  [null, null, null, null, null, null, 0, 'Existing transfer']
]), 'Transfers');
XLSX.writeFile(workbook, templatePath);

(async () => {
  try {
    const templateZip = await JSZip.loadAsync(fs.readFileSync(templatePath));
    const templateWorkbookXml = await templateZip.file('xl/workbook.xml').async('string');
    templateZip.file('xl/workbook.xml', templateWorkbookXml.replace('</workbook>', '<calcPr calcMode="manual" /></workbook>'));
    fs.writeFileSync(templatePath, await templateZip.generateAsync({ type: 'nodebuffer' }));

    await patchOrdersWorkbook({
      templatePath,
      outputPath,
      movements: [{ unitCode: '0485', directions: ['N'] }],
      scouts: [],
      gmActions: [],
      validUnits: [{ unitCode: '0485', unitName: 'Main Tribe' }],
      skillAttempts: [
        { tribe: '0485', order: 1, topic: 'Diplomacy', group: 'B', baselineLevel: 0 },
        { tribe: '0485', order: 2, topic: 'Engineering', group: 'C', baselineLevel: 0 },
        { tribe: '0485', order: 3, topic: 'Fishing', group: 'A', baselineLevel: 0 }
      ],
      transfers: [{ from:'0485', to:'0485e1', item:'WARRIORS', quantity:20, timing:'BM', notes:'New unit allocation' }]
    });
    const output = XLSX.readFile(outputPath);
    const movement = XLSX.utils.sheet_to_json(output.Sheets.Tribe_Movement, { defval: null });
    assert.deepEqual(movement.filter(row => row.TRIBE).map(row => row.TRIBE), ['0485']);
    const scouts = XLSX.utils.sheet_to_json(output.Sheets.Scout_Movement, { defval: null }).filter(row => row.No_of_Scouts);
    assert.equal(scouts.length, 0);
    const actions = XLSX.utils.sheet_to_json(output.Sheets['GM Actions'], { defval: null }).filter(row => row['What does the GM need to do?']);
    assert.equal(actions.length, 0);
    const validUnits = XLSX.utils.sheet_to_json(output.Sheets['Valid Units'], { defval: null }).map(row => row.Unit).filter(Boolean);
    assert.deepEqual(validUnits, ['0485']);
    const attempts = XLSX.utils.sheet_to_json(output.Sheets.Skill_Attempts, { defval: null })
      .filter(row => row.TRIBE && row.TOPIC)
      .map(row => [String(row.TRIBE).padStart(4, '0'), Number(row.ORDER), row.TOPIC]);
    assert.deepEqual(attempts, [['0485', 1, 'DIPLOMACY'], ['0485', 2, 'ENGINEERING'], ['0485', 3, 'FISHING']]);
    const transfers = XLSX.utils.sheet_to_json(output.Sheets.Transfers, { defval: null }).filter(row => row.From);
    assert.deepEqual(transfers.map(row => [row.From, row.To, row.Item, row.Quantity, row.Transfer_Timing, row.Notes]), [['0485', '0485e1', 'WARRIORS', 20, 'BM', 'New unit allocation']]);
    const outputZip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const outputWorkbookXml = await outputZip.file('xl/workbook.xml').async('string');
    const calcPr = outputWorkbookXml.match(/<calcPr\b[^>]*\/>/)?.[0] || '';
    assert.match(calcPr, /calcMode="auto"/, 'Excel should use automatic calculation when opening completed orders.');
    assert.match(calcPr, /fullCalcOnLoad="1"/, 'The entire workbook should recalculate on open.');
    assert.match(calcPr, /forceFullCalc="1"/, 'The full recalculation should not be skipped because of cached formula values.');
    const attemptsXml = await outputZip.file('xl/worksheets/sheet5.xml').async('string');
    assert.match(attemptsXml, /<c[^>]*r="E2"[^>]*>[\s\S]*?<f>IF\(C2&lt;&gt;&quot;&quot;,1,0\)<\/f>/, 'Skill attempt dependent formulas should be preserved for Excel to recalculate.');
    console.log('orders workbook cleanup tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

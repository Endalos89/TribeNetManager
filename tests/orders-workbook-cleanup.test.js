const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
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
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  skillAttemptHeaders,
  ['0485', 1, 'DIPLOMACY', null, null],
  ['0485', 2, 'ENGINEERING', null, null],
  ['0485', 3, 'FISHING', null, null]
]), 'Skill_Attempts');
XLSX.writeFile(workbook, templatePath);

(async () => {
  try {
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
      ]
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
    assert.deepEqual(attempts, [['0485', 1, 'Diplomacy'], ['0485', 2, 'Engineering'], ['0485', 3, 'Fishing']]);
    console.log('orders workbook cleanup tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

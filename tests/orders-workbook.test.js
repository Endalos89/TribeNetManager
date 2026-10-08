const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { patchOrdersWorkbook, compareUnitCodes, validateOrdersTemplate, skillTransferText } = require('../src/orders-workbook');
const { parseOrdersWorkbook } = require('../src/planner');

const blank = path.join(__dirname, '..', '..', 'upload', '0485_906_4_Orders.xlsx');
if (!fs.existsSync(blank)) {
  console.log('orders workbook export tests skipped (uploaded workbook fixture is not present)');
  process.exit(0);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-orders-workbook-'));
const output = path.join(temp, 'completed.xlsx');

(async () => {
  try {
    assert.ok(validateOrdersTemplate(blank).movementRows >= 2);
    assert.ok(compareUnitCodes('0485', '0485e1') < 0);
    assert.ok(compareUnitCodes('0485e1', '1485') < 0, 'a Tribe must precede the next Tribe only after its own units');
    assert.equal(skillTransferText({ name: 'Woodworking', level: 3 }, '0485', '1485'), 'Skill Woodworking 3 should be moved from Tribe 0485 to Tribe 1485');

    await patchOrdersWorkbook({
      templatePath: blank,
      outputPath: output,
      movements: [
        { unitCode: '0485', directions: ['N', 'N', 'N'] },
        { unitCode: '0485e1', directions: ['Still'] },
        { unitCode: '1485', directions: ['SE', 'SE', 'S', 'SE'] }
      ],
      validUnits: [{ unitCode: '0485g1', unitName: 'Home Garrison' }],
      scouts: [
        { unitCode: '0485', noOfScouts: 2, noOfHorses: 2, mission: 'PATROL', directions: ['FOR'] },
        { unitCode: '0485e1', noOfScouts: 2, noOfHorses: 2, mission: 'PATROL', directions: ['SW', 'SW', 'S'] },
        { unitCode: '1485', noOfScouts: 1, noOfHorses: 0, mission: 'LOCATE', directions: ['N'] }
      ],
      gmActions: [{ unit: '1485', text: 'Create Tribe 1485 from 0485' }]
    });

    const workbook = XLSX.readFile(output, { cellFormula: true });
    const movement = XLSX.utils.sheet_to_json(workbook.Sheets.Tribe_Movement, { defval: null });
    assert.deepEqual(movement.slice(0, 3).map(row => [row.TRIBE, row.MOVEMENT_1, row.MOVEMENT_2, row.MOVEMENT_3]), [
      ['0485', 'N', 'N', 'N'], ['0485e1', 'Still', 'EMPTY', 'EMPTY'], ['1485', 'SE', 'SE', 'S']
    ]);
    assert.equal(movement.some(row => row.TRIBE === '0485g1'), false, 'Garrisons must not receive a Movement row');
    const validUnits = XLSX.utils.sheet_to_json(workbook.Sheets['Valid Units'], { defval: null });
    assert.ok(validUnits.some(row => row.Unit === '0485g1'), 'Garrisons should still be available as valid unit codes');
    const scouts = XLSX.utils.sheet_to_json(workbook.Sheets.Scout_Movement, { defval: null }).filter(row => row.No_of_Scouts);
    assert.deepEqual(scouts.map(row => row.TRIBE), ['0485', '0485e1', '1485'], 'scouting rows must group Tribe before linked units');
    assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets['GM Actions'], { defval: null })[0]['What does the GM need to do?'], 'Create Tribe 1485 from 0485');

    const parsed = parseOrdersWorkbook(output);
    assert.deepEqual(parsed.movements.find(row => row.unit === '0485').orders, ['N', 'N', 'N']);
    assert.deepEqual(parsed.movements.find(row => row.unit === '0485e1').orders, ['STILL']);

    const sourceZip = await JSZip.loadAsync(fs.readFileSync(blank));
    const outputZip = await JSZip.loadAsync(fs.readFileSync(output));
    for (const sheet of ['xl/worksheets/sheet8.xml', 'xl/worksheets/sheet9.xml']) {
      const sourceXml = await sourceZip.file(sheet).async('string');
      const outputXml = await outputZip.file(sheet).async('string');
      assert.equal(sourceXml.match(/<dataValidations[\s\S]*?<\/dataValidations>/)?.[0], outputXml.match(/<dataValidations[\s\S]*?<\/dataValidations>/)?.[0], `${sheet} validation rules must be preserved`);
    }
    console.log('orders workbook export tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

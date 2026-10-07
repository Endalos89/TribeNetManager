const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseResultText } = require('../src/result-report-parser');
const { ResultsDatabase } = require('../src/results-database');

const reportText = `
Tribe 1485, , Current Hex = PK 2016, (Previous Hex = PK 1714)
Current Turn 906-04 (#76), Summer, FINE Next Turn 906-05
Scout 1:Scout SE-CH, \\S-CH, O NE, SE,Find ZINC ORE,Can't Move on Ocean to S of HEX,
Scout 2:Scout S-CH, \\SE-CH, O S,Find ZINC ORE,Not enough M.P's to move to SE into CONIFER HILLS,
1485 Status: CONIFER HILLS, Iron Ore, O N, 1485
Humans
People\t1
`;

const report = parseResultText(reportText, 'resource-test.docx');
const zinc = report.hexKnowledge.filter(row => row.resources?.includes('Zinc Ore'));
const oceans = report.hexKnowledge.filter(row => row.terrain === 'O');
assert.strictEqual(zinc.length, 1, 'repeated Zinc findings should merge on one hex');
assert.strictEqual(zinc[0].coordinate, 'PK2118');
assert(zinc[0].evidence.some(value => /Find ZINC ORE/i.test(value)));
assert(oceans.length >= 2, 'continuation directions after O should reveal every adjacent ocean');
assert(report.hexKnowledge.some(row => row.coordinate === 'PK2016' && row.resources?.includes('Iron Ore')));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-resource-test-'));
const db = new ResultsDatabase(tempRoot);
try {
  db.saveReport(report);
  const rows = db.getHexesInArea({ minCol: 0, maxCol: 500, minRow: 0, maxRow: 500 }, report.turnKey);
  assert(rows.some(row => row.resources?.includes('Zinc Ore')));
  assert(rows.some(row => row.resources?.includes('Iron Ore')));
  assert(db.getHexHistory('PK2118').some(row => row.resources?.includes('Zinc Ore')));
} finally {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Results resource and adjacent-observation regression tests passed.');

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


const turn90607 = String.raw`
Tribe 0485, , Current Hex = PK 2016, (Previous Hex = PK 2016)
Current Turn 906-07 (#79), Autumn, FINE Next Turn 906-08 (#80), 29/11/2026
Goods Tribe: No GT
Tribe Activities: 40 people skinned, gutted and boned 60 Goat (60 Skin, 120 Gut, 120 Bones, 240 Provs), 8595 people hunted 22304 provs (using 300 trap, 400 sling), 100 bone experts crafted 40 Bone Axe (using 40 Bones, 40 Club, 40 Leather) (limited by Leather: 80 of 100 assigned), 10 workers cured 20 Leather (using 50 Gut, 20 Skin), 100 leather workers crafted 20 Sling (using 20 Leather) (limited by Leather: 20 of 100 assigned), 10 tanners tanned 40 Leather (using 100 Bark, 40 Skin), 287 herders allocated, 292 actual herders required, 51 Goat strayed bred (5 Cattle, 96 Goat, 2 Horse)
Final Activities: Provs eaten: 10776 Provs,
Transfer goods to 4485: 1000 WARRIORS, 1000 ACTIVES, 1000 INACTIVES, To 3485: 100 CATTLE, 50 WAGON,
Receive goods from 2485: 102 HORSE, 96 LOG, 15844 PROVS, 120 SLING, 100 TRAP, 50 WAGON,
0485 Status: CONIFER HILLS, Iron Ore, O N, 4485, 0485, 2485
Humans
People	10776
Element 0485e1, , Current Hex = PK 1508, (Previous Hex = PK 1710)
Current Turn 906-07 (#79), Autumn, FINE
Goods Tribe: No GT
Tribe Activities: 19 people hunted 30 provs (using 19 sling), 5 herders allocated, 5 actual herders required (No breeding)
Scout 4:Scout NW-PR, Lcm SE,\N-CH, \N-CH, \ 1468e1 \ Not enough M.P's to move to NE into CONIFER HILLS, Patrolled and found 1468e1
Scout Group did not return
0485e1 Status: LOW CONIFER MOUNTAINS, 0485e1
Tribe 1485, , Current Hex = PK 1916, (Previous Hex = PK 1518)
Current Turn 906-07 (#79), Autumn, FINE
Tribe Activities: 4091 people hunted 6780 provs (using 100 trap, 80 sling), 11 herders allocated, 10 actual herders required bred (1 Horse)
1485 Status: PRAIRIE, O NE, 1485
Tribe 2485, , Current Hex = PK 2016, (Previous Hex = PK 2016)
Current Turn 906-07 (#79), Autumn, FINE
Goods Tribe: 0485
Tribe Activities: 40 people cut 160 logs, 3995 people hunted 7954 provs (using 100 trap, 120 sling), 11 herders allocated: not herded - these animals were already herded by 0485 this turn
Transfer goods to 0485: 102 HORSE, 96 LOG, 15844 PROVS, 120 SLING, 100 TRAP, 50 WAGON,
2485 Status: CONIFER HILLS, Iron Ore, O N, 4485, 0485, 2485
Tribe 3485, , Current Hex = PK 2118, (Previous Hex = PK 2016)
Current Turn 906-07 (#79), Autumn, FINE
Tribe Activities: 4005 people hunted 7930 provs, 10 herders allocated, 10 actual herders required bred (1 Cattle)
3485 Status: CONIFER HILLS, ZINC ORE, O S, 3485
Tribe 4485, , Current Hex = PK 2016, (Previous Hex = PK 2016)
Current Turn 906-07 (#79), Autumn, FINE
Goods Tribe: 0485
Receive goods from 0485: 1000 WARRIORS, 1000 ACTIVES, 1000 INACTIVES,
4485 Status: CONIFER HILLS, Iron Ore, O N, 4485, 0485, 2485
`;
const transfers90607 = [
  ['From', 'To', 'Item', 'Requested', 'Actual', 'Message'],
  ['0485', '4485', 'WARRIORS', '1000', '', 'Transfer in same hex'],
  ['0485', '3485', 'CATTLE', '100', '', 'Transfer in same hex'],
  ['2485', '0485', 'PROVS', '15844', '', 'Transfer in same hex']
];
const result90607 = parseResultText(turn90607, '0485_906_07_Results.docx', [transfers90607]);
assert.deepStrictEqual(result90607.units.map(u => u.unitCode), ['0485', '0485e1', '1485', '2485', '3485', '4485']);
const unit90607 = code => result90607.units.find(u => u.unitCode === code);
const actions90607 = code => result90607.events.find(e => e.unitCode === code && e.eventType === 'activities').details.actions;
const mainActions = actions90607('0485');
const processing = mainActions.find(a => a.type === 'animal-processing');
assert.strictEqual(processing.items[0].item, 'Goat');
assert.strictEqual(processing.items[0].quantity, 60);
assert.deepStrictEqual(processing.outputs.map(a => a.quantity), [60, 120, 120, 240]);
const hunting = mainActions.find(a => a.type === 'hunted');
assert.strictEqual(hunting.items[0].item.toLowerCase(), 'provs');
assert.deepStrictEqual(hunting.tools.map(t => t.quantity), [300, 400]);
assert.deepStrictEqual(hunting.inputs, [], 'Used hunting equipment is not consumed');
const crafted = mainActions.filter(a => a.type === 'crafting');
assert.strictEqual(crafted[0].workerRole, 'bone experts');
assert.deepStrictEqual(crafted[0].limit, { item: 'Leather', actualWorkers: 80, assignedWorkers: 100 });
assert.strictEqual(crafted[1].items[0].item, 'Sling');
assert.deepStrictEqual(crafted[1].limit, { item: 'Leather', actualWorkers: 20, assignedWorkers: 100 });
assert.strictEqual(mainActions.find(a => a.type === 'curing').items[0].quantity, 20);
assert.strictEqual(mainActions.find(a => a.type === 'tanning').inputs[0].item, 'Bark');
assert.strictEqual(mainActions.find(a => a.type === 'straying').items[0].quantity, 51);
assert.deepStrictEqual(mainActions.find(a => a.type === 'breeding').items.map(a => [a.item, a.quantity]), [['Cattle', 5], ['Goat', 96], ['Horse', 2]]);
assert.strictEqual(actions90607('0485e1').find(a => a.type === 'breeding').label, 'No breeding performed');
assert.strictEqual(actions90607('1485').find(a => a.type === 'breeding').items[0].item, 'Horse');
assert.strictEqual(actions90607('3485').find(a => a.type === 'breeding').items[0].item, 'Cattle');
assert.strictEqual(actions90607('2485').find(a => a.type === 'cut').items[0].quantity, 160);
assert.strictEqual(actions90607('2485').find(a => a.type === 'herding').herdedBy, '0485');
assert.strictEqual(unit90607('0485').goodsTribe, null);
assert.strictEqual(unit90607('2485').goodsTribe, '0485');
assert.strictEqual(unit90607('4485').goodsTribe, '0485');
assert.strictEqual(unit90607('0485e1').scoutGroupStatus, 'did-not-return');
assert(result90607.events.some(e => e.unitCode === '0485e1' && e.eventType === 'scout-group'));
assert(result90607.hexKnowledge.some(h => h.observedUnits?.includes('1468e1')));
assert(result90607.hexKnowledge.some(h => h.terrain === 'O'));
assert.strictEqual(result90607.metadata.parseWarnings.length, 0, 'All current report activity clauses should parse');
const warriorTransfer = result90607.metadata.transfers.find(t => t.item === 'WARRIORS');
assert.strictEqual(warriorTransfer.actual, null);
assert.strictEqual(warriorTransfer.status, 'unreported', 'Blank Actual must not be inferred successful');
assert.strictEqual(warriorTransfer.summaryReported, true);
assert.deepStrictEqual(warriorTransfer.summaryReportedBy, ['0485', '4485']);
assert.strictEqual(result90607.metadata.transfers.find(t => t.item === 'CATTLE').summaryReported, true);
assert.strictEqual(result90607.metadata.transfers.find(t => t.item === 'PROVS').summaryReported, true);

console.log('Results resource and adjacent-observation regression tests passed.');

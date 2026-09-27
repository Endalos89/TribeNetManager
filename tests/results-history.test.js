const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseResultText } = require('../src/result-report-parser');
const { ResultsDatabase } = require('../src/results-database');

const REPORT_906_02 = `
Tribe 0485, , Current Hex = PK 1614, (Previous Hex = N/A)
Current Turn 906-02 (#75), Spring, FINE Next Turn now
Received: $0, Cost: $ 0 Credit: $ 200
Goods Tribe: No GT
Scout 1:Scout N-GH, \\N-CH, Lcm N
Scout 2:Scout NW-PR, \\NW-PR, Lcm NW
Scout 3:Scout NE-GH, O NE
Scout 4:Scout S-PR, \\S-GH, \\S-GH
Scout 5:Scout SW-GH, Lcm SW,\\SW-LCM, Lcm NW
Scout 6:Scout SE-GH, \\SE-GH, \\SE-PR, O NE
0485 Status: PRAIRIE, 0485
Humans
People 31212
Warriors 10404Actives 10404Inactives 10404
Animals
Cattle 500Goat 3700Horse 400
Minerals
Brass 500Bronze 400Coal 3000Iron 400Silver 10000
War Equipment
Club 500Jerkin 200Shield 30Sword 30
Finished Goods
Provs 40000Sling 300Trap 500Wagon 300
Raw Materials
Bark 1000Bone 500Gut 500Leather 100Log 100Skin 100
Wax 20
Ships
None
Skills:
Adm 2, BnW 1, Bon 1, Cur 1, Dip 2, Eco 2, Eng 2, For 2, Garr 1, Gut 1, Herd 3, Hunt 3, Ldr 2, Ltr 3, Qry 2, Sct 2, Skn 2, Tan 1, Wd 3,
Morale : 1
Weight: 0
Walking CC: 0
Mounted CC: 0
`;

const REPORT_906_03 = `
Tribe 0485, , Current Hex = PK 1714, (Previous Hex = PK 1614)
Current Turn 906-03 (#75), Spring, FINE Next Turn 906-04 (#76), 4/10/2026
Received: $0, Cost: $ 5.5 Credit: $ 194.5
Goods Tribe: No GT
Desired Commodities: (1) Rubies, (2) Coffee
Tribe Activities, 40 people Skin\\gut\\bone 60 Goat, 20257 people hunted 52668 provs, B/axe 50, Skins Cured 20, 100 people made 100 Sling (using 100 Leather), Skins Tanned 40 (using 100 Bark, 40 Skin), 275 herders allocated, 272 actual herders required, Bred ( Cattle 32, Goat 284, Horse 21 )
Movement Weight: 731,670 Walking Capacity: 1,926,360 Mounted Capacity: 0
Tribe Movement: Move NE-GH, O NE \\
Scout 1:Scout SE-GH, O NE, N\\SE-PR, O NE, SE, N\\S-PR, O NE\\,Not enough M.P's to move to SE into CONIFER HILLS,
Scout 2:Scout N-GH, O NE, SE\\N-CH, Lcm NW, O NE, SE\\,Not enough M.P's to move to N into CONIFER HILLS,
Scout 3:Scout S-GH, \\S-GH, \\S-GH, \\,Not enough M.P's to move to S into GRASSY HILLS,
Scout 4:Scout N-GH, O NE, SE\\N-CH, Lcm NW, O NE, SE\\,Not enough M.P's to move to N into CONIFER HILLS,
Scout 5:Scout SW-PR, \\S-PR, \\SW-GH, Lcm NW,\\,Not enough M.P's to move to S into GRASSY HILLS,
Scout 6:Scout NW-GH, \\N-CH, Lcm N,\\see 0485e1\\,Not enough M.P's to move to N into LOW CONIFER MOUNTAINS, Patrolled and found 0485e1
Scout 7:Scout NW-GH, \\NW-PR, \\N-PR, Lcm NE, NW,\\N-PR, Lcm NE, SE, SW, N,\\,Not enough M.P's to move to N into LOW CONIFER MOUNTAINS,
Scout 8:Scout SW-PR, \\SW-GH, Lcm SW,\\,Not enough M.P's to move to SW into LOW CONIFER MOUNTAINS,
0485 Status: GRASSY HILLS, O NE, 0485
Humans
People 31172
Warriors 10384Actives 10384Inactives 10404
Animals
Cattle 532Goat 3924Horse 387
Minerals
Brass 500Bronze 400Coal 3000Iron 400Silver 10000
War Equipment
B/Axe 50Club 450Jerkin 200Shield 30Sword 30
Finished Goods
Provs 92668Sling 380Trap 500Wagon 284
Raw Materials
Bark 900Bone 570Gut 570Leather 40Log 100Skin 100
Wax 20
Ships
None
Skills:
Adm 2, BnW 1, Bon 1, Cur 1, Dip 2, Eco 3, Eng 3, Fish 1, For 2, Garr 1, Gut 1, Herd 3, Hunt 3, Ldr 2, Ltr 3, Qry 2, Sct 2, Skn 2, Tan 1, Wd 3,
Morale : 1
Weight: 1,242,610
Walking CC: 1,892,460
Mounted CC: 0
Element 0485e1, , Current Hex = PK 1612, (Previous Hex = PK 1614)
Current Turn 906-03 (#75), Spring, FINE
Goods Tribe: No GT
Movement Weight: 0 Walking Capacity: 0 Mounted Capacity: 0
Tribe Movement: Move N-GH, \\N-CH, Lcm N, \\
0485e1 Status: CONIFER HILLS, Lcm N, 0485e1
Humans
People 40
Warriors 20Actives 20Inactives 0
Animals
Horse 34
Minerals
None
War Equipment
None
Finished Goods
Provs 240Sling 20Wagon 16
Raw Materials
None
Ships
None
Skills:
Morale : 1
Weight: 18,410
Walking CC: 49,800
Mounted CC: 0
`;

function unit(report, code) {
  return report.units.find(row => row.unitCode === code);
}

(function parserRegression() {
  const turn2 = parseResultText(REPORT_906_02, '0485_906_02_Results.docx');
  assert.strictEqual(turn2.turnKey, '906-02');
  assert.deepStrictEqual(turn2.units.map(row => row.unitCode), ['0485']);
  assert.strictEqual(unit(turn2, '0485').resources['Finished Goods'].Provs, 40000);
  assert.strictEqual(unit(turn2, '0485').resources.Animals.Goat, 3700);
  assert(turn2.hexKnowledge.some(row => row.coordinate === 'PK1614' && row.knowledgeLevel === 'visited'));
  assert(turn2.hexKnowledge.some(row => row.terrain === 'GH' && row.knowledgeLevel === 'scouted'));

  const turn3 = parseResultText(REPORT_906_03, '0485_906_03_Results.docx');
  assert.strictEqual(turn3.turnKey, '906-03');
  assert.deepStrictEqual(turn3.units.map(row => row.unitCode), ['0485', '0485e1']);
  assert.strictEqual(unit(turn3, '0485').resources['Finished Goods'].Provs, 92668);
  assert.strictEqual(unit(turn3, '0485').resources.Animals.Goat, 3924);
  assert.strictEqual(unit(turn3, '0485e1').currentHex, 'PK1612');
  assert.strictEqual(unit(turn3, '0485e1').resources['Finished Goods'].Provs, 240);
  assert(turn3.events.some(row => row.eventType === 'activities' && /52668 provs/.test(row.message)));
  assert(turn3.hexKnowledge.some(row =>
    row.terrain === 'LCM' && row.evidence.some(evidence => /Not enough M\.P/i.test(evidence))
  ));
  assert(turn3.hexKnowledge.some(row => row.coordinate === 'PK1612' && row.observedUnits.includes('0485e1')));
})();

(function databaseRegression() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-results-test-'));
  const db = new ResultsDatabase(tempRoot);
  try {
    const turn2 = parseResultText(REPORT_906_02, '0485_906_02_Results.docx');
    const turn3 = parseResultText(REPORT_906_03, '0485_906_03_Results.docx');
    db.saveReport(turn2);
    db.saveReport(turn3);

    assert.deepStrictEqual(db.listTurns().map(row => row.turnKey), ['906-02', '906-03']);
    const stored3 = db.getTurn('906-03');
    const main = stored3.units.find(row => row.unitCode === '0485');
    assert.strictEqual(main.previousTurnKey, '906-02');
    assert.strictEqual(main.deltas.people.People, -40);
    assert.strictEqual(main.deltas.resources['Finished Goods'].Provs, 52668);
    assert.strictEqual(main.deltas.resources.Animals.Goat, 224);

    const corrected = parseResultText(REPORT_906_03.replace('Provs 92668', 'Provs 92670'), '0485_906_03_CORRECTED.docx');
    db.saveReport(corrected);
    assert.strictEqual(db.listTurns().length, 2, 're-import must replace the same turn, not duplicate it');
    assert.strictEqual(db.getTurn('906-03').units.find(row => row.unitCode === '0485').resources['Finished Goods'].Provs, 92670);
  } finally {
    db.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();

console.log('Results history regression tests passed.');

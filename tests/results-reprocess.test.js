const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ResultsDatabase } = require('../src/results-database');
const { reprocessArchivedReports } = require('../src/results-reprocessor');

function report(turnKey, marker, sourceFile = `${turnKey}.docx`) {
  const match = turnKey.match(/(\d+)-(\d+)/);
  return {
    turnKey,
    turnSort: Number(match[1]) * 1000 + Number(match[2]),
    sourceFile,
    metadata: { marker },
    units: [{
      unitType: 'Tribe',
      unitCode: '0485',
      currentHex: 'PK1614',
      previousHex: null,
      turnKey,
      statusTerrain: 'PR',
      statusNotes: '',
      people: { People: 100 },
      resources: { 'Finished Goods': { Provs: marker } },
      skills: {},
      morale: 1,
      weight: 0,
      walkingCapacity: 0,
      mountedCapacity: 0,
      movementWeight: null,
      movementWalkingCapacity: null,
      movementMountedCapacity: null,
      movement: null,
      scouts: []
    }],
    events: [],
    hexKnowledge: []
  };
}

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-reprocess-test-'));
  const db = new ResultsDatabase(tempRoot);
  try {
    // A legacy turn without an archived source should be reported, not silently skipped.
    db.saveReport(report('906-01', 1, 'legacy.docx'));

    const sourcePath = path.join(tempRoot, '0485_906_02_Results.docx');
    fs.writeFileSync(sourcePath, 'original report bytes');
    db.archiveSource('906-02', sourcePath, '0485_906_02_Results.docx');
    db.saveReport(report('906-02', 10, '0485_906_02_Results.docx'));

    // Moving/changing the user's original later must not affect our retained source copy.
    fs.writeFileSync(sourcePath, 'changed outside the archive');
    const status = db.getReprocessStatus();
    assert.strictEqual(status.totalTurns, 2);
    assert.strictEqual(status.archivedSources, 1);
    assert.deepStrictEqual(status.missingSourceTurns, ['906-01']);

    let archivedText = null;
    const first = await reprocessArchivedReports(db, async storedPath => {
      archivedText = fs.readFileSync(storedPath, 'utf8');
      return report('906-02', 99, path.basename(storedPath));
    });

    assert.strictEqual(archivedText, 'original report bytes');
    assert.deepStrictEqual(first.processed.map(row => row.turnKey), ['906-02']);
    assert.deepStrictEqual(first.failed, []);
    assert.deepStrictEqual(first.missingSourceTurns, ['906-01']);
    assert(first.backupPath && fs.existsSync(first.backupPath), 'reprocess should create a backup first');

    const rebuilt = db.getTurn('906-02');
    assert.strictEqual(rebuilt.metadata.marker, 99);
    assert.strictEqual(rebuilt.sourceFile, '0485_906_02_Results.docx');
    assert.strictEqual(rebuilt.units[0].resources['Finished Goods'].Provs, 99);

    // Corrected re-imports for the same turn replace the archived source used next time.
    fs.writeFileSync(sourcePath, 'corrected report bytes');
    db.archiveSource('906-02', sourcePath, '0485_906_02_CORRECTED.docx');
    let correctedText = null;
    const second = await reprocessArchivedReports(db, async storedPath => {
      correctedText = fs.readFileSync(storedPath, 'utf8');
      return report('906-02', 101, path.basename(storedPath));
    });

    assert.strictEqual(correctedText, 'corrected report bytes');
    assert.strictEqual(second.processed.length, 1);
    assert.strictEqual(db.getTurn('906-02').sourceFile, '0485_906_02_CORRECTED.docx');
    assert.strictEqual(db.getTurn('906-02').metadata.marker, 101);
  } finally {
    db.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('Results reprocess regression tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

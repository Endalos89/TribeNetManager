const fs = require('fs');

async function reprocessArchivedReports(resultsDatabase, parseResultDocument) {
  const sources = resultsDatabase.listSources();
  const turns = resultsDatabase.listTurns();
  const archivedTurns = new Set(sources.filter(source => source.exists).map(source => source.turnKey));
  const missingSourceTurns = turns.filter(turn => !archivedTurns.has(turn.turnKey)).map(turn => turn.turnKey);

  if (!sources.length) {
    return {
      processed: [],
      failed: [],
      missingSourceTurns,
      backupPath: null
    };
  }

  const backupPath = resultsDatabase.createBackup();
  const processed = [];
  const failed = [];

  for (const source of sources) {
    if (!source.exists || !fs.existsSync(source.storedPath)) {
      failed.push({ turnKey: source.turnKey, sourceFile: source.originalFileName, error: 'Archived source file is missing.' });
      continue;
    }

    try {
      const parsed = await parseResultDocument(source.storedPath);
      if (parsed.turnKey !== source.turnKey) {
        throw new Error(`Archived report parsed as turn ${parsed.turnKey}, expected ${source.turnKey}.`);
      }
      parsed.sourceFile = source.originalFileName;
      resultsDatabase.saveReport(parsed);
      processed.push({ turnKey: source.turnKey, sourceFile: source.originalFileName });
    } catch (error) {
      failed.push({ turnKey: source.turnKey, sourceFile: source.originalFileName, error: error.message });
    }
  }

  return { processed, failed, missingSourceTurns, backupPath };
}

module.exports = { reprocessArchivedReports };

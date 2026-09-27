const fs = require('fs');
const path = require('path');
const { app, ipcMain, shell } = require('electron');
const { TribeNetDatabase } = require('./database');
const { TurnManagerDatabase } = require('./turn-manager-database');
const { ResultsDatabase } = require('./results-database');
const { parseTurnWorkbook } = require('./turn-manager-parser');
const { parseResultDocument } = require('./result-report-parser');
const { applyWagonAnimalRules } = require('./logistics-rules');
const { resultTurnToStartWorkbook } = require('./turn-workflow');
const { routesDb } = require('./planned-routes-ipc');
const { canonicalTurnKey, inferTurnKeyFromFilename } = require('./turn-key');

let syncPromise = null;

function preferredLibraryRoot() {
  const parent = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
  return path.join(parent, 'TribeNet Files');
}

function fallbackLibraryRoot() {
  return path.join(app.getPath('userData'), 'TribeNet Files');
}

function ensureLibraryFolders() {
  const preferred = preferredLibraryRoot();
  let root = preferred;
  let fallback = false;
  try {
    fs.mkdirSync(path.join(root, 'Results'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Completed Orders'), { recursive: true });
    const probe = path.join(root, '.write-test');
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
  } catch (_) {
    root = fallbackLibraryRoot();
    fallback = true;
    fs.mkdirSync(path.join(root, 'Results'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Completed Orders'), { recursive: true });
  }
  return {
    root,
    preferredRoot: preferred,
    resultsDir: path.join(root, 'Results'),
    completedDir: path.join(root, 'Completed Orders'),
    fallback
  };
}

function manifestPath() {
  return path.join(app.getPath('userData'), 'turn-file-library.json');
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) || {}; }
  catch (_) { return {}; }
}

function saveManifest(manifest) {
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
}

function signature(filePath) {
  const stat = fs.statSync(filePath);
  return `${Number(stat.size)}:${Math.floor(Number(stat.mtimeMs))}`;
}

function listFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const allowed = new Set(extensions.map(ext => ext.toLowerCase()));
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase()))
    .map(entry => path.join(dir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
}

function clearDraftPlanning(turnManagerDatabase, turnKey) {
  for (const activity of turnManagerDatabase.listActivities(turnKey)) turnManagerDatabase.deleteActivity(activity.id);
  for (const split of turnManagerDatabase.listUnitSplits(turnKey)) turnManagerDatabase.deleteUnitSplit(split.id);
  for (const route of routesDb().list(turnKey)) routesDb().remove(route.id);
}

function backfillArchivedResults(resultsDatabase, folders) {
  const copied = [];
  for (const source of resultsDatabase.listSources()) {
    if (!source.exists) continue;
    const fileName = path.basename(source.originalFileName || source.storedFileName || `${source.turnKey}.docx`);
    const destination = path.join(folders.resultsDir, fileName);
    if (fs.existsSync(destination)) continue;
    try {
      fs.copyFileSync(source.storedPath, destination);
      copied.push(destination);
    } catch (_) {}
  }
  return copied;
}

function turnSortKey(turnKey) {
  const match = String(canonicalTurnKey(turnKey) || '').match(/^(\d+)-(\d+)$/);
  return match ? Number(match[1]) * 1000 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

function buildHistory(folders, database, resultsDatabase) {
  const rows = new Map();
  const ensure = keyValue => {
    const turnKey = canonicalTurnKey(keyValue);
    if (!turnKey) return null;
    if (!rows.has(turnKey)) rows.set(turnKey, {
      turnKey,
      resultFile: null,
      resultPath: null,
      resultImportedAt: null,
      completedFile: null,
      completedPath: null,
      completedImportedAt: null
    });
    return rows.get(turnKey);
  };

  for (const turn of resultsDatabase.listTurns()) {
    const row = ensure(turn.turnKey);
    if (!row) continue;
    row.resultFile = turn.sourceFile || row.resultFile;
    row.resultImportedAt = turn.importedAt || null;
  }
  for (const item of database.getTurnImports()) {
    const row = ensure(item.turnKey);
    if (!row) continue;
    row.completedFile = item.sourceFile || row.completedFile;
    row.completedImportedAt = item.importedAt || null;
  }

  for (const filePath of listFiles(folders.resultsDir, ['.docx'])) {
    const row = ensure(inferTurnKeyFromFilename(path.basename(filePath)));
    if (!row) continue;
    row.resultFile = path.basename(filePath);
    row.resultPath = filePath;
  }
  for (const filePath of listFiles(folders.completedDir, ['.xlsx', '.xlsm', '.xls'])) {
    const row = ensure(inferTurnKeyFromFilename(path.basename(filePath)));
    if (!row) continue;
    row.completedFile = path.basename(filePath);
    row.completedPath = filePath;
  }

  return [...rows.values()].sort((a, b) => turnSortKey(a.turnKey) - turnSortKey(b.turnKey) || a.turnKey.localeCompare(b.turnKey));
}

async function performSync() {
  const folders = ensureLibraryFolders();
  const manifest = loadManifest();
  const nextManifest = { ...manifest };
  const processed = [];
  const failed = [];
  const database = new TribeNetDatabase(app.getPath('userData'));
  const turnManagerDatabase = new TurnManagerDatabase(app.getPath('userData'));
  const resultsDatabase = new ResultsDatabase(app.getPath('userData'));

  try {
    backfillArchivedResults(resultsDatabase, folders);

    const resultFiles = listFiles(folders.resultsDir, ['.docx']);
    const completedFiles = listFiles(folders.completedDir, ['.xlsx', '.xlsm', '.xls']);

    for (const filePath of resultFiles) {
      const key = `result:${filePath}`;
      let sig;
      try { sig = signature(filePath); } catch (error) { failed.push({ file: path.basename(filePath), error: error.message }); continue; }
      if (manifest[key] === sig) continue;
      try {
        const parsed = await parseResultDocument(filePath);
        parsed.turnKey = canonicalTurnKey(parsed.turnKey);
        const saved = resultsDatabase.saveReport(parsed);
        resultsDatabase.archiveSource(saved.turnKey, filePath, parsed.sourceFile || path.basename(filePath));
        const baseline = resultTurnToStartWorkbook(saved);
        baseline.turnKey = canonicalTurnKey(baseline.turnKey);
        baseline.resultTurnKey = canonicalTurnKey(baseline.resultTurnKey);
        turnManagerDatabase.saveWorkbook(baseline);
        nextManifest[key] = sig;
        processed.push({ kind: 'results', file: path.basename(filePath), turnKey: saved.turnKey });
      } catch (error) {
        failed.push({ kind: 'results', file: path.basename(filePath), error: error.message });
      }
    }

    for (const filePath of completedFiles) {
      const key = `completed:${filePath}`;
      let sig;
      try { sig = signature(filePath); } catch (error) { failed.push({ file: path.basename(filePath), error: error.message }); continue; }
      if (manifest[key] === sig) continue;
      try {
        const parsed = parseTurnWorkbook(filePath, 'final');
        parsed.turnKey = canonicalTurnKey(parsed.turnKey);
        parsed.rawPlan.turnKey = parsed.turnKey;
        const plan = applyWagonAnimalRules(parsed.rawPlan);
        database.saveTurnPlan(plan);
        turnManagerDatabase.saveWorkbook(parsed);
        clearDraftPlanning(turnManagerDatabase, parsed.turnKey);
        nextManifest[key] = sig;
        processed.push({ kind: 'completed', file: path.basename(filePath), turnKey: parsed.turnKey });
      } catch (error) {
        failed.push({ kind: 'completed', file: path.basename(filePath), error: error.message });
      }
    }

    saveManifest(nextManifest);
    const history = buildHistory(folders, database, resultsDatabase);
    return { ...folders, processed, failed, history };
  } finally {
    database.close();
    turnManagerDatabase.close();
    resultsDatabase.close();
  }
}

function syncLibrary() {
  if (!syncPromise) {
    syncPromise = performSync().finally(() => { syncPromise = null; });
  }
  return syncPromise;
}

ipcMain.handle('turn-files:scan', () => syncLibrary());
ipcMain.handle('turn-files:info', async () => {
  const folders = ensureLibraryFolders();
  const database = new TribeNetDatabase(app.getPath('userData'));
  const resultsDatabase = new ResultsDatabase(app.getPath('userData'));
  try {
    return { ...folders, processed: [], failed: [], history: buildHistory(folders, database, resultsDatabase) };
  } finally {
    database.close();
    resultsDatabase.close();
  }
});
ipcMain.handle('turn-files:open', async () => {
  const folders = ensureLibraryFolders();
  const error = await shell.openPath(folders.root);
  return { ok: !error, error: error || null, root: folders.root };
});

app.whenReady().then(() => syncLibrary().catch(error => console.error('Turn file library sync failed', error)));

module.exports = { ensureLibraryFolders, syncLibrary, buildHistory };

const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { TribeNetDatabase } = require('./database');
const { TurnManagerDatabase } = require('./turn-manager-database');
const { ResultsDatabase } = require('./results-database');
const { parseOrdersWorkbook } = require('./planner');
const { parseTurnWorkbook } = require('./turn-manager-parser');
const { parseResultDocument } = require('./result-report-parser');
const { reprocessArchivedReports } = require('./results-reprocessor');
const { applyWagonAnimalRules } = require('./logistics-rules');
const { ACTIVITY_CATALOG } = require('./activity-catalog');

let mainWindow;
let database;
let turnManagerDatabase;
let resultsDatabase;

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', payload);
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-not-available', info => sendUpdateStatus({ state: 'current', message: `You are up to date (${info.version}).` }));
  autoUpdater.on('update-available', async info => {
    sendUpdateStatus({ state: 'downloading', message: `Downloading version ${info.version}…`, version: info.version });
    try { await autoUpdater.downloadUpdate(); }
    catch (error) { sendUpdateStatus({ state: 'error', message: `Update download failed: ${error.message}` }); }
  });
  autoUpdater.on('download-progress', progress => sendUpdateStatus({
    state: 'downloading', message: `Downloading update… ${Math.round(progress.percent)}%`, percent: progress.percent
  }));
  autoUpdater.on('update-downloaded', info => sendUpdateStatus({
    state: 'ready', message: `Version ${info.version} is ready. Restart to apply it.`, version: info.version
  }));
  autoUpdater.on('error', error => sendUpdateStatus({ state: 'error', message: `Update error: ${error.message}` }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540, height: 940, minWidth: 1080, minHeight: 720,
    backgroundColor: '#0b1117', title: 'TribeNet Manager',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function withCurrentLogistics(record) {
  if (!record) return null;
  if (record.plan) record.plan = applyWagonAnimalRules(record.plan);
  return record;
}

app.whenReady().then(() => {
  database = new TribeNetDatabase(app.getPath('userData'));
  turnManagerDatabase = new TurnManagerDatabase(app.getPath('userData'));
  resultsDatabase = new ResultsDatabase(app.getPath('userData'));
  configureUpdater();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (database) database.close();
  if (turnManagerDatabase) turnManagerDatabase.close();
  if (resultsDatabase) resultsDatabase.close();
});

ipcMain.handle('hexes:area', (_event, bounds) => database.getHexesInArea(bounds));
ipcMain.handle('hex:get', (_event, coordinate) => database.getHex(coordinate));
ipcMain.handle('hex:save', (_event, hex, context) => database.saveHex(hex, context));
ipcMain.handle('hex:clear', (_event, coordinate, context) => database.clearHex(coordinate, context));
ipcMain.handle('hex:history', (_event, coordinate) => database.getHexHistory(coordinate));
ipcMain.handle('submaps:summaries', () => database.getSubmapSummaries());
ipcMain.handle('database:backup', () => database.createManualBackup());

ipcMain.handle('planner:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import TribeNet Orders Workbook', properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const filePath = result.filePaths[0];
  try {
    const plan = applyWagonAnimalRules(parseOrdersWorkbook(filePath));
    const saved = database.saveTurnPlan(plan);
    return { canceled: false, imported: withCurrentLogistics(saved) };
  } catch (error) {
    console.error('Planner import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('planner:imports', () => database.getTurnImports());
ipcMain.handle('planner:get', (_event, id) => withCurrentLogistics(database.getTurnPlan(id || null)));
ipcMain.handle('planner:activate', (_event, id) => withCurrentLogistics(database.setActiveTurnPlan(id)));

ipcMain.handle('turn-manager:import', async (_event, role) => {
  const normalizedRole = role === 'final' ? 'final' : 'start';
  const result = await dialog.showOpenDialog(mainWindow, {
    title: normalizedRole === 'start' ? 'Import Beginning-of-Turn Workbook' : 'Import Finalized Turn Workbook',
    properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const parsed = parseTurnWorkbook(result.filePaths[0], normalizedRole);
    return { canceled: false, turn: turnManagerDatabase.saveWorkbook(parsed) };
  } catch (error) {
    console.error('Turn Manager import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('turn-manager:list-turns', () => turnManagerDatabase.listTurns());
ipcMain.handle('turn-manager:get-turn', (_event, turnKey) => turnManagerDatabase.getTurn(turnKey));
ipcMain.handle('turn-manager:add-activity', (_event, turnKey, activity) => turnManagerDatabase.addActivity(turnKey, activity));
ipcMain.handle('turn-manager:update-activity', (_event, id, activity) => turnManagerDatabase.updateActivity(id, activity));
ipcMain.handle('turn-manager:delete-activity', (_event, id) => turnManagerDatabase.deleteActivity(id));
ipcMain.handle('turn-manager:save-context', (_event, turnKey, notes) => turnManagerDatabase.saveContext(turnKey, notes));
ipcMain.handle('turn-manager:catalog', () => ACTIVITY_CATALOG);
ipcMain.handle('turn-manager:backup', () => turnManagerDatabase.createBackup());

ipcMain.handle('results:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import TribeNet Results Report',
    properties: ['openFile'],
    filters: [{ name: 'Word results reports', extensions: ['docx'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const filePath = result.filePaths[0];
  try {
    const parsed = await parseResultDocument(filePath);
    resultsDatabase.archiveSource(parsed.turnKey, filePath, parsed.sourceFile);
    const saved = resultsDatabase.saveReport(parsed);
    return { canceled: false, turn: saved, archived: true };
  } catch (error) {
    console.error('Results report import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('results:reprocess', async () => {
  try {
    return await reprocessArchivedReports(resultsDatabase, parseResultDocument);
  } catch (error) {
    console.error('Results report reprocess failed', error);
    return { error: error.message, processed: [], failed: [], missingSourceTurns: [] };
  }
});
ipcMain.handle('results:reprocess-status', () => resultsDatabase.getReprocessStatus());
ipcMain.handle('results:list-turns', () => resultsDatabase.listTurns());
ipcMain.handle('results:get-turn', (_event, turnKey) => resultsDatabase.getTurn(turnKey));
ipcMain.handle('results:hexes-area', (_event, bounds, turnKey) => resultsDatabase.getHexesInArea(bounds, turnKey));
ipcMain.handle('results:hex-history', (_event, coordinate) => resultsDatabase.getHexHistory(coordinate));
ipcMain.handle('results:submaps', (_event, turnKey) => resultsDatabase.getSubmapSummaries(turnKey));
ipcMain.handle('results:backup', () => resultsDatabase.createBackup());

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    const payload = { state: 'development', message: 'Updates are available in installed builds. This is a development build.' };
    sendUpdateStatus(payload); return payload;
  }
  try { await autoUpdater.checkForUpdates(); return { ok: true }; }
  catch (error) {
    const payload = { state: 'error', message: `Could not check for updates: ${error.message}` };
    sendUpdateStatus(payload); return payload;
  }
});
ipcMain.handle('update:install', () => { if (app.isPackaged) autoUpdater.quitAndInstall(true, true); return true; });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:userDataPath', () => app.getPath('userData'));
ipcMain.handle('app:showBackup', async (_event, backupPath) => { if (backupPath) shell.showItemInFolder(backupPath); return true; });

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { TribeNetDatabase } = require('./database');
const { TurnManagerDatabase } = require('./turn-manager-database');
const { ResultsDatabase } = require('./results-database');
const { parseTurnWorkbook } = require('./turn-manager-parser');
const { parseResultDocument } = require('./result-report-parser');
const { reprocessArchivedReports } = require('./results-reprocessor');
const { applyWagonAnimalRules } = require('./logistics-rules');
const { ACTIVITY_CATALOG } = require('./activity-catalog');
const { normalizeView } = require('./update-view-state');
const { routesDb, removeRoutesForUnit } = require('./planned-routes-ipc');
const {
  planningTurnKeyFromResult,
  resultTurnToStartWorkbook,
  countsFromResultUnit,
  countsByUnitFromPlan,
  deriveMovementEnd,
  calculateSupplyRequirements,
  parseCoordinate,
  stepCoordinate
} = require('./turn-workflow');
const {
  resolvePlanMovementStarts,
  buildCompletedTurnState,
  completedStateToManagedUnits
} = require('./completed-turn-state');

let mainWindow;
let database;
let turnManagerDatabase;
let resultsDatabase;
let currentView = normalizeView({ page: 'index.html', screen: 'launcher' });
let pendingStartupView = null;
let startupViewConsumed = false;
let updateReadyForInstall = false;

const RESTORE_FILENAME = 'update-restore-view.json';

function restoreStatePath() {
  return path.join(app.getPath('userData'), RESTORE_FILENAME);
}

function persistUpdateRestoreView() {
  try {
    fs.writeFileSync(restoreStatePath(), JSON.stringify(normalizeView(currentView)), 'utf8');
    return true;
  } catch (error) {
    console.error('Could not persist update restore view', error);
    return false;
  }
}

function consumeUpdateRestoreView() {
  const filePath = restoreStatePath();
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = normalizeView(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    fs.unlinkSync(filePath);
    return parsed;
  } catch (error) {
    console.error('Could not restore previous view after update', error);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    return null;
  }
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', payload);
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-not-available', info => {
    updateReadyForInstall = false;
    sendUpdateStatus({ state: 'current', message: `You are up to date (${info.version}).` });
  });
  autoUpdater.on('update-available', async info => {
    sendUpdateStatus({ state: 'downloading', message: `Downloading version ${info.version}…`, version: info.version });
    try { await autoUpdater.downloadUpdate(); }
    catch (error) { sendUpdateStatus({ state: 'error', message: `Update download failed: ${error.message}` }); }
  });
  autoUpdater.on('download-progress', progress => sendUpdateStatus({
    state: 'downloading', message: `Downloading update… ${Math.round(progress.percent)}%`, percent: progress.percent
  }));
  autoUpdater.on('update-downloaded', info => {
    updateReadyForInstall = true;
    sendUpdateStatus({ state: 'ready', message: `Version ${info.version} is ready. Restart to apply it.`, version: info.version });
  });
  autoUpdater.on('error', error => sendUpdateStatus({ state: 'error', message: `Update error: ${error.message}` }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540, height: 940, minWidth: 1080, minHeight: 720,
    backgroundColor: '#0b1117', title: 'TribeNet Manager',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  const startupPage = pendingStartupView?.page || 'index.html';
  currentView = pendingStartupView || normalizeView({ page: startupPage });
  mainWindow.loadFile(path.join(__dirname, startupPage));
}

function withCurrentLogistics(record) {
  if (!record) return null;
  if (record.plan) record.plan = applyWagonAnimalRules(record.plan);
  return record;
}

function syncResultBaseline(resultTurn) {
  if (!resultTurn?.turnKey) return null;
  const baseline = resultTurnToStartWorkbook(resultTurn);
  return turnManagerDatabase.saveWorkbook(baseline);
}

function syncAllResultBaselines() {
  if (!resultsDatabase || !turnManagerDatabase) return 0;
  let synced = 0;
  for (const turn of resultsDatabase.listTurns()) {
    const detail = resultsDatabase.getTurn(turn.turnKey);
    if (!detail) continue;
    syncResultBaseline(detail);
    synced += 1;
  }
  return synced;
}

function clearDraftPlanning(turnKey) {
  if (!turnKey) return;
  for (const activity of turnManagerDatabase.listActivities(turnKey)) {
    turnManagerDatabase.deleteActivity(activity.id);
  }
  for (const split of turnManagerDatabase.listUnitSplits(turnKey)) {
    turnManagerDatabase.deleteUnitSplit(split.id);
  }
  for (const route of routesDb().list(turnKey)) {
    routesDb().remove(route.id);
  }
}

function planningBaselineResult(turnKey) {
  if (!turnKey || !resultsDatabase) return null;
  for (const summary of resultsDatabase.listTurns()) {
    const resultTurn = resultsDatabase.getTurn(summary.turnKey);
    if (resultTurn && String(planningTurnKeyFromResult(resultTurn)) === String(turnKey)) return resultTurn;
  }
  return null;
}

function resultForPlanTurn(turnKey) {
  return planningBaselineResult(turnKey) || resultsDatabase.getTurn(turnKey) || null;
}

function hydratedPlanRecord(record) {
  if (!record?.plan || !record.turnKey) return record;
  const resultTurn = resultForPlanTurn(record.turnKey);
  if (!resultTurn) return record;
  return { ...record, plan: resolvePlanMovementStarts(record.plan, resultTurn) };
}

function effectiveResultTurn(turnKey) {
  const resultTurn = resultsDatabase.getTurn(turnKey);
  if (!resultTurn) return null;
  const completed = hydratedPlanRecord(database.getTurnPlanForTurn(turnKey));
  return completed?.plan ? buildCompletedTurnState(resultTurn, completed) : resultTurn;
}

function effectiveManagedTurn(turnKey) {
  const managed = turnManagerDatabase.getTurn(turnKey);
  if (!managed?.final) return managed;
  const resultTurn = resultForPlanTurn(turnKey);
  const completed = hydratedPlanRecord(database.getTurnPlanForTurn(turnKey));
  if (!resultTurn || !completed?.plan) return managed;
  const completedState = buildCompletedTurnState(resultTurn, completed);
  const finalData = managed.final.data || {};
  const finalSkills = finalData.skillsByTribe || {};
  return {
    ...managed,
    final: {
      ...managed.final,
      data: {
        ...finalData,
        units: completedStateToManagedUnits(completedState, finalSkills),
        skillsByTribe: finalSkills,
        movements: completed.plan.movements || finalData.movements || [],
        scouts: completed.plan.scouts || finalData.scouts || [],
        transfers: completed.plan.transfers || finalData.transfers || [],
        rawPlan: completed.plan
      }
    }
  };
}

function saveCompletedOrders(filePath) {
  const parsed = parseTurnWorkbook(filePath, 'final');
  const plan = applyWagonAnimalRules(parsed.rawPlan);
  const imported = database.saveTurnPlan(plan);
  turnManagerDatabase.saveWorkbook(parsed);
  clearDraftPlanning(parsed.turnKey);
  return {
    imported: withCurrentLogistics(hydratedPlanRecord(imported)),
    turn: effectiveManagedTurn(parsed.turnKey)
  };
}

function terrainContextForHex(turnKey, coordinate, fallbackTerrain = null) {
  const center = parseCoordinate(coordinate);
  if (!center) return { terrain: fallbackTerrain || 'UNKNOWN', adjacentTerrains: [] };
  const coordinates = [String(coordinate).toUpperCase()];
  for (const direction of ['N', 'NE', 'SE', 'S', 'SW', 'NW']) {
    const next = stepCoordinate(coordinate, direction);
    if (next) coordinates.push(next);
  }

  const knowledgeTurnKey = resultForPlanTurn(turnKey)?.turnKey || turnKey;
  const resultRows = resultsDatabase.getHexesInArea({
    minCol: Math.max(0, center.globalCol - 2),
    maxCol: center.globalCol + 2,
    minRow: Math.max(0, center.globalRow - 2),
    maxRow: center.globalRow + 2
  }, knowledgeTurnKey);
  const resultByCoordinate = new Map(resultRows.map(row => [String(row.coordinate).toUpperCase(), row.terrain]));

  const terrainAt = value => {
    const key = String(value || '').toUpperCase();
    if (resultByCoordinate.has(key)) return resultByCoordinate.get(key);
    const manual = database.getHex(key);
    return manual?.terrain || null;
  };

  const terrain = terrainAt(coordinates[0]) || fallbackTerrain || 'UNKNOWN';
  const adjacentTerrains = coordinates.slice(1).map(terrainAt).filter(Boolean);
  return { terrain, adjacentTerrains };
}

function unitSupplyRequirements(turnKey, unitCode) {
  const resultTurn = resultForPlanTurn(turnKey);
  const resultUnit = resultTurn?.units?.find(unit => String(unit.unitCode) === String(unitCode)) || null;
  const managedTurn = turnManagerDatabase.getTurn(turnKey);
  const finalPlanRecord = managedTurn?.final ? hydratedPlanRecord(database.getTurnPlanForTurn(turnKey)) : null;
  const finalPlan = finalPlanRecord?.plan || (managedTurn?.final?.data?.rawPlan ? resolvePlanMovementStarts(managedTurn.final.data.rawPlan, resultTurn) : null);

  let source = 'current';
  let endHex = resultUnit?.currentHex || null;
  let uncertain = false;
  let counts = countsFromResultUnit(resultUnit || {});

  if (managedTurn?.final && finalPlan) {
    source = 'completed';
    const plannedCounts = countsByUnitFromPlan(finalPlan).get(String(unitCode));
    if (plannedCounts) counts = plannedCounts;
    const movement = (finalPlan.movements || []).find(row => String(row.unit) === String(unitCode));
    if (movement) {
      const end = deriveMovementEnd(movement.startHex || endHex, movement.orders);
      endHex = end.endHex || endHex;
      uncertain = end.uncertain;
    }
  } else {
    const unitMove = routesDb().list(turnKey).find(route => route.routeType === 'unit' && String(route.unitCode) === String(unitCode));
    if (unitMove) {
      source = 'planned';
      endHex = unitMove.destinationHex || endHex;
      uncertain = Number(unitMove.unknownEntryCount || 0) > 0;
    }
  }

  if (!endHex) {
    return {
      known: false,
      endHex: null,
      terrain: 'UNKNOWN',
      source,
      uncertain: true,
      waterRequired: 0,
      fodderRequired: 0,
      reason: 'No ending hex is known for this unit.'
    };
  }

  const fallbackTerrain = endHex === resultUnit?.currentHex ? resultUnit?.statusTerrain : null;
  const terrainContext = terrainContextForHex(turnKey, endHex, fallbackTerrain);
  const requirements = calculateSupplyRequirements({
    counts,
    terrain: terrainContext.terrain,
    adjacentTerrains: terrainContext.adjacentTerrains,
    endHex,
    source,
    uncertain
  });
  if (uncertain) {
    requirements.reason += ' The route contains an unresolved/unknown segment, so this is based on the last planned destination and should be rechecked when the terrain is known.';
  }
  return requirements;
}

app.whenReady().then(() => {
  database = new TribeNetDatabase(app.getPath('userData'));
  turnManagerDatabase = new TurnManagerDatabase(app.getPath('userData'));
  resultsDatabase = new ResultsDatabase(app.getPath('userData'));
  try { syncAllResultBaselines(); }
  catch (error) { console.error('Could not sync result baselines into Turn Manager', error); }
  pendingStartupView = consumeUpdateRestoreView();
  configureUpdater();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (updateReadyForInstall) persistUpdateRestoreView();
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
    title: 'Import Completed TribeNet Orders Workbook', properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const saved = saveCompletedOrders(result.filePaths[0]);
    return { canceled: false, imported: saved.imported, turn: saved.turn };
  } catch (error) {
    console.error('Completed orders import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('planner:imports', (_event, turnKey) => database.getTurnImports(turnKey || null));
ipcMain.handle('planner:get', (_event, id) => withCurrentLogistics(hydratedPlanRecord(database.getTurnPlan(id || null))));
ipcMain.handle('planner:get-turn', (_event, turnKey) => withCurrentLogistics(hydratedPlanRecord(database.getTurnPlanForTurn(turnKey))));
ipcMain.handle('planner:activate', (_event, id) => withCurrentLogistics(hydratedPlanRecord(database.setActiveTurnPlan(id))));

ipcMain.handle('turn-manager:import', async (_event, role) => {
  if (role === 'start') {
    return { canceled: false, error: 'Beginning workbooks are no longer required. Import the Results report once; it is used automatically as the beginning-of-turn state.' };
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Completed TribeNet Orders Workbook',
    properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const saved = saveCompletedOrders(result.filePaths[0]);
    return { canceled: false, turn: saved.turn, imported: saved.imported };
  } catch (error) {
    console.error('Turn Manager completed orders import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('turn-manager:list-turns', () => turnManagerDatabase.listTurns());
ipcMain.handle('turn-manager:get-turn', (_event, turnKey) => effectiveManagedTurn(turnKey));
ipcMain.handle('turn-manager:add-activity', (_event, turnKey, activity) => turnManagerDatabase.addActivity(turnKey, activity));
ipcMain.handle('turn-manager:update-activity', (_event, id, activity) => turnManagerDatabase.updateActivity(id, activity));
ipcMain.handle('turn-manager:delete-activity', (_event, id) => turnManagerDatabase.deleteActivity(id));
ipcMain.handle('turn-manager:add-unit-split', (_event, turnKey, split) => turnManagerDatabase.addUnitSplit(turnKey, split));
ipcMain.handle('turn-manager:list-unit-splits', (_event, turnKey) => turnManagerDatabase.listUnitSplits(turnKey));
ipcMain.handle('turn-manager:delete-unit-split', (_event, id) => {
  const removed = turnManagerDatabase.deleteUnitSplit(id);
  if (removed) removeRoutesForUnit(removed.turnKey, removed.unitCode);
  return removed;
});
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
    syncResultBaseline(saved);
    return { canceled: false, turn: saved, archived: true };
  } catch (error) {
    console.error('Results report import failed', error);
    return { canceled: false, error: error.message };
  }
});
ipcMain.handle('results:reprocess', async () => {
  try {
    const result = await reprocessArchivedReports(resultsDatabase, parseResultDocument);
    syncAllResultBaselines();
    return result;
  } catch (error) {
    console.error('Results report reprocess failed', error);
    return { error: error.message, processed: [], failed: [], missingSourceTurns: [] };
  }
});
ipcMain.handle('results:reprocess-status', () => resultsDatabase.getReprocessStatus());
ipcMain.handle('results:list-turns', () => resultsDatabase.listTurns());
ipcMain.handle('results:get-turn', (_event, turnKey) => effectiveResultTurn(turnKey));
ipcMain.handle('results:hexes-area', (_event, bounds, turnKey) => resultsDatabase.getHexesInArea(bounds, turnKey));
ipcMain.handle('results:hex-history', (_event, coordinate) => resultsDatabase.getHexHistory(coordinate));
ipcMain.handle('results:submaps', (_event, turnKey) => resultsDatabase.getSubmapSummaries(turnKey));
ipcMain.handle('results:backup', () => resultsDatabase.createBackup());
ipcMain.handle('workflow:unit-supplies', (_event, turnKey, unitCode) => unitSupplyRequirements(turnKey, unitCode));

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
ipcMain.handle('update:install', () => {
  if (app.isPackaged) {
    persistUpdateRestoreView();
    autoUpdater.quitAndInstall(true, true);
  }
  return true;
});
ipcMain.handle('app:report-view', (_event, view) => {
  currentView = normalizeView(view);
  return currentView;
});
ipcMain.handle('app:consume-startup-view', () => {
  if (startupViewConsumed || !pendingStartupView) return null;
  startupViewConsumed = true;
  return pendingStartupView;
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:userDataPath', () => app.getPath('userData'));
ipcMain.handle('app:showBackup', async (_event, backupPath) => { if (backupPath) shell.showItemInFolder(backupPath); return true; });
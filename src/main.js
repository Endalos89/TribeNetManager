const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { TerrainMeshDiskCache } = require('./terrain-mesh-disk-cache');
const { TribeNetDatabase } = require('./database');
const { TurnManagerDatabase } = require('./turn-manager-database');
const { ActivityBillStore } = require('./activities-bills-store');
const { ResultsDatabase } = require('./results-database');
const {
  findLatestRavenpostResultsReport,
  downloadLatestRavenpostResultsReport,
  markRavenpostResultsReportImported,
  downloadRavenpostOrdersTemplate
} = require('./ravenpost-ipc');
const { parseTurnWorkbook } = require('./turn-manager-parser');
const { parseResultDocument } = require('./result-report-parser');
const { reprocessArchivedReports } = require('./results-reprocessor');
const { applyWagonAnimalRules } = require('./logistics-rules');
const { ACTIVITY_CATALOG } = require('./activity-catalog');
const { assembleActivityAssignments } = require('./activity-assignments');
const { normalizeView } = require('./update-view-state');
const DESIGN_DOCUMENTS = require('./design-document-catalog');
const { routesDb, removeRoutesForUnit } = require('./planned-routes-ipc');
const { canonicalTurnKey, inferTurnKeyFromFilename } = require('./turn-key');
const { patchOrdersWorkbook, saveOrderTemplate, findOrderTemplate } = require('./orders-workbook');
const { buildOrdersExportData: assembleOrdersExportData, mergeDraftRoutes, mergeDraftSplits } = require('./orders-export-data');
const { resolveOrdersExportPath } = require('./orders-export-path');
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
let compendiumWindow;
let database;
let turnManagerDatabase;
let activityBillStore;
let resultsDatabase;
let terrainMeshDiskCache;
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

function openCompendiumWindow(entry, key) {
  const safeEntry = entry === 'skill' || entry === 'item' ? entry : '';
  const safeKey = String(key || '').trim().slice(0, 200);
  if (!safeEntry || !safeKey) return false;

  const query = { entry: safeEntry, key: safeKey };
  if (compendiumWindow && !compendiumWindow.isDestroyed()) {
    compendiumWindow.loadFile(path.join(__dirname, 'compendium.html'), { query });
    compendiumWindow.show();
    compendiumWindow.focus();
    return true;
  }

  compendiumWindow = new BrowserWindow({
    width: 1120, height: 820, minWidth: 760, minHeight: 560,
    backgroundColor: '#0b1117', title: 'TribeNet Compendium',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  compendiumWindow.on('closed', () => { compendiumWindow = null; });
  compendiumWindow.loadFile(path.join(__dirname, 'compendium.html'), { query });
  return true;
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
  if (managed && !managed.final) {
    const allocations = assembleActivityAssignments({
      routes: mergeDraftRoutes(ordersExportDraftRoutes(turnKey)),
      unitSplits: mergeDraftSplits(ordersExportDraftSplits(turnKey)),
      baselineUnits: ordersExportBaseline(turnKey)?.units || []
    });
    return {
      ...managed,
      activities: [...(managed.activities || []), ...allocations.derived.map(row => ({
        unit:row.unit, activityCode:'SCOUTING', people:row.people,
        target:'', notes:'Automatically reserved from scouting routes', derived:true
      }))]
    };
  }
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

function ordersExportBaseline(turnKey) {
  const managed = turnManagerDatabase.getTurn(turnKey);
  if (managed?.start?.data) return managed.start.data;
  const result = resultForPlanTurn(turnKey);
  return result ? resultTurnToStartWorkbook(result) : null;
}

function ordersExportDraftKeys(turnKey) {
  const keys = [turnKey];
  const recordedRouteKeys = routesDb().listTurnKeys();
  // Older builds saved routes under different textual spellings of the same
  // turn (906_05, 906-5) or under the preceding Results turn. Discover those
  // actual persisted keys instead of silently exporting Still for every unit.
  const includeTurnAndAliases = key => {
    if (!key) return;
    if (!keys.includes(key)) keys.push(key);
    for (const recorded of recordedRouteKeys) {
      if (canonicalTurnKey(recorded) === canonicalTurnKey(key) && !keys.includes(recorded)) keys.push(recorded);
    }
  };
  includeTurnAndAliases(turnKey);
  const baseline = resultForPlanTurn(turnKey);
  if (baseline?.turnKey && String(baseline.turnKey) !== String(turnKey)) includeTurnAndAliases(baseline.turnKey);
  return keys;
}

function ordersExportDraftRoutes(turnKey) {
  return ordersExportDraftKeys(turnKey).map(key => routesDb().list(key));
}

function ordersExportDraftSplits(turnKey) {
  const keys = ordersExportDraftKeys(turnKey);
  return keys.map(key => {
    const splits = turnManagerDatabase.listUnitSplits(key);
    // An alternative spelling of the *current planning turn* is still current
    // draft data. Only filter splits saved against the preceding Results turn:
    // old legacy splits can otherwise resurrect when deliberately deleted.
    if (canonicalTurnKey(key) === canonicalTurnKey(turnKey)) return splits;
    const legacyRouteCodes = new Set(routesDb().list(key)
      .map(route => String(route.unitCode || '').trim().toLowerCase()).filter(Boolean));
    return splits.filter(split => legacyRouteCodes.has(String(split.unitCode || '').trim().toLowerCase()));
  });
}

function buildOrdersExportData(turnKey) {
  const baseline = ordersExportBaseline(turnKey);
  const draftKeys = ordersExportDraftKeys(turnKey);
  const routeGroups = draftKeys.map(key => routesDb().list(key));
  const savedRoutes = mergeDraftRoutes(routeGroups);
  const skillAttempts = turnManagerDatabase.getSkillAttempts(turnKey).map(row => ({
    tribe: row.tribe,
    order: Number(row.order),
    topic: row.skill,
    group: row.group,
    baselineLevel: Number(row.baselineLevel || 0)
  }));
  const data = assembleOrdersExportData({
    baselineUnits: baseline?.units || [],
    routeGroups,
    splitGroups: ordersExportDraftSplits(turnKey),
    transferGroups: draftKeys.map(key => turnManagerDatabase.listTransfers(key)),
    comments: typeof turnManagerDatabase.listOrderText === 'function' ? turnManagerDatabase.listOrderText(turnKey, 'Comments') : [],
    gmActions: typeof turnManagerDatabase.listOrderText === 'function' ? turnManagerDatabase.listOrderText(turnKey, 'GM Actions') : [],
    skillAttempts,
    researchAttempts: typeof turnManagerDatabase.listResearchAttempts === 'function' ? turnManagerDatabase.listResearchAttempts(turnKey) : [],
    activities: turnManagerDatabase.listActivities(turnKey)
  });
  // Do not allow a silently incomplete export when a saved SQLite route is
  // missing from the assembled order payload.
  for (const route of savedRoutes) {
    const directions = (route.directions || []).map(value => String(value).toUpperCase()).join('|');
    const rows = route.routeType === 'scout' ? data.scouts : data.movements;
    const matched = rows.some(row =>
      String(row.unitCode).toLowerCase() === String(route.unitCode).toLowerCase()
      && (row.directions || []).map(value => String(value).toUpperCase()).join('|') === directions
      && (route.routeType !== 'scout'
        || (Number(row.noOfScouts) === Number(route.noOfScouts) && Number(row.noOfHorses) === Number(route.noOfHorses))));
    if (!matched) throw new Error('Saved ' + route.routeType + ' route for ' + route.unitCode
      + ' was not included in Orders export for Turn ' + turnKey + '. No workbook has been modified.');
  }
  return { ...data, savedRouteCounts: {
    movement: savedRoutes.filter(row => row.routeType === 'unit').length,
    scouting: savedRoutes.filter(row => row.routeType === 'scout').length,
    keys: draftKeys
  } };
}

function saveCompletedOrders(filePath) {
  const parsed = parseTurnWorkbook(filePath, 'final');
  const plan = applyWagonAnimalRules(parsed.rawPlan);
  const imported = database.saveTurnPlan(plan);
  turnManagerDatabase.saveWorkbook(parsed);
  // Importing a completed workbook is a reference/verification action, not
  // permission to delete Mapper orders. Saved movement/scouting remain in
  // SQLite until explicitly edited or removed by the player.
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
  activityBillStore = new ActivityBillStore(turnManagerDatabase);
  resultsDatabase = new ResultsDatabase(app.getPath('userData'));
  terrainMeshDiskCache = new TerrainMeshDiskCache(app.getPath('userData'));
  // Old LRU files can be pruned asynchronously; no first-launch delay.
  terrainMeshDiskCache.prune().catch(error=>console.warn('Terrain cache prune:',error));
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
ipcMain.handle('terrain-mesh:read', (_event, key) => terrainMeshDiskCache.read(key));
ipcMain.handle('terrain-mesh:write', (_event, key, mesh) => terrainMeshDiskCache.write(key,mesh));
ipcMain.handle('app:open-compendium', (_event, entry, key) => openCompendiumWindow(entry, key));
ipcMain.handle('design-documents:list', () => DESIGN_DOCUMENTS.map(({ id, title, status, summary, built, partial, notBuilt }) => ({
  id, title, status, summary, built, partial, notBuilt
})));
ipcMain.handle('design-documents:read', (_event, id) => {
  const document = DESIGN_DOCUMENTS.find(entry => entry.id === String(id || ''));
  if (!document) throw new Error('Unknown design document.');
  const filePath = path.join(__dirname, '..', 'docs', document.filename);
  return { id: document.id, title: document.title, content: fs.readFileSync(filePath, 'utf8') };
});
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

ipcMain.handle('orders:template-import', async (_event, expectedTurnKey) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import blank Orders workbook',
    properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const filePath = result.filePaths[0];
    const inferred = canonicalTurnKey(inferTurnKeyFromFilename(filePath));
    const requested = canonicalTurnKey(expectedTurnKey);
    const turnKey = requested || inferred;
    if (!turnKey) throw new Error('The workbook filename does not identify a turn, and no planning turn is selected.');
    const saved = await saveOrderTemplate(filePath, app.getPath('userData'), turnKey);
    const lifecycle = turnManagerDatabase.recordBlankTemplateReceived(turnKey, path.basename(filePath));
    return { canceled: false, ...saved, lifecycle };
  } catch (error) {
    console.error('Blank Orders template import failed', error);
    return { canceled: false, error: error.message };
  }
});

async function importOrdersTemplateFromRavenpost(expectedTurnKey) {
  let stagingDirectory = null;
  try {
    const attachment = await downloadRavenpostOrdersTemplate(expectedTurnKey);
    if (!attachment) return { notFound: true };
    const turnKey = canonicalTurnKey(expectedTurnKey) || canonicalTurnKey(attachment.turnKey);
    if (!turnKey) throw new Error('Select a planning turn before picking up the blank Orders sheet from Ravenpost.');
    const extension = path.extname(String(attachment.filename || '')).toLowerCase();
    if (!['.xlsx', '.xlsm', '.xls'].includes(extension)) throw new Error('The Ravenpost attachment is not an Excel Orders workbook.');
    stagingDirectory = fs.mkdtempSync(path.join(app.getPath('temp'), 'tribenet-ravenpost-orders-'));
    const filePath = path.join(stagingDirectory, `blank-orders${extension}`);
    fs.writeFileSync(filePath, attachment.data);
    const saved = await saveOrderTemplate(filePath, app.getPath('userData'), turnKey);
    const lifecycle = turnManagerDatabase.recordBlankTemplateReceived(turnKey, attachment.filename || 'Ravenpost blank Orders workbook');
    return { ...saved, lifecycle, source: 'Ravenpost', emailSubject: attachment.subject };
  } catch (error) {
    console.error('Ravenpost blank Orders import failed', error);
    return { error: error.message };
  } finally {
    if (stagingDirectory) {
      try { fs.rmSync(stagingDirectory, { recursive: true, force: true }); }
      catch (error) { console.warn('Could not remove Ravenpost Orders staging files:', error.message); }
    }
  }
}

ipcMain.handle('orders:template-ravenpost', async (_event, expectedTurnKey) => ({
  canceled: false,
  ...await importOrdersTemplateFromRavenpost(expectedTurnKey)
}));

ipcMain.handle('orders:export', async (_event, requestedTurnKey) => {
  const turnKey = canonicalTurnKey(requestedTurnKey);
  if (!turnKey) return { canceled: false, error: 'Select a planning turn before exporting Orders.' };
  try {
    let templatePath = await findOrderTemplate(app.getPath('userData'), turnKey);
    let baselineSource = 'saved';
    if (!templatePath) {
      const fetched = await importOrdersTemplateFromRavenpost(turnKey);
      if (fetched.error) throw new Error(`Could not fetch the blank Orders sheet from Ravenpost: ${fetched.error}`);
      if (fetched.notFound) throw new Error(`No blank Orders attachment for Turn ${turnKey} was found from reports@tribenet.com.au. You can choose a workbook manually.`);
      templatePath = await findOrderTemplate(app.getPath('userData'), turnKey);
      baselineSource = 'Ravenpost';
    }
    const destination = resolveOrdersExportPath(app, turnKey);
    const data = buildOrdersExportData(turnKey);
    const { savedRouteCounts, ...workbookData } = data;
    console.info('Export Orders source', { turnKey, ...savedRouteCounts });
    const exported = await patchOrdersWorkbook({ templatePath, outputPath: destination.outputPath, ...workbookData });
    let openError = '';
    try {
      openError = await shell.openPath(exported.outputPath);
    } catch (error) {
      openError = error.message;
    }
    return {
      canceled: false,
      outputFile: path.basename(exported.outputPath),
      outputPath: exported.outputPath,
      outputFolder: path.dirname(exported.outputPath),
      updatedExisting: destination.updatedExisting,
      usedAlternativePath: false,
      opened: !openError,
      openError: openError || null,
      baselineSource,
      savedRouteCounts
    };
  } catch (error) {
    console.error('Orders workbook export failed', error);
    const message = ['EPERM', 'EBUSY', 'EACCES'].includes(error?.code)
      ? `Could not replace the existing Orders export. Close the workbook in Excel and try again. ${error.message}`
      : error.message;
    return { canceled: false, error: message };
  }
});

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
ipcMain.handle('activities:list-bills', () => activityBillStore.list());
ipcMain.handle('activities:save-bill', (_event, row) => activityBillStore.save(row));
ipcMain.handle('activities:remove-bill', (_event, id, turn) => activityBillStore.remove(id,turn));
ipcMain.handle('activities:move-bill', (_event, id, direction) => activityBillStore.move(id,direction));
ipcMain.handle('activities:pause-bill', (_event, id, paused) => activityBillStore.pause(id,paused));
ipcMain.handle('activities:skip-bill', (_event, id, turn) => activityBillStore.skip(id,turn));
ipcMain.handle('activities:reset-bill', (_event, id, turn) => activityBillStore.reset(id,turn));
ipcMain.handle('activities:apply-bills', (_event, turn, units) => {
  // Scout-route workers are a separate saved planner commitment and need
  // reserving before allocating Hunting, including newly split scout parties.
  const splits=ordersExportDraftSplits(turn).flat();
  const parentOf=new Map(splits.map(row=>[String(row.unitCode||'').toLowerCase(),String(row.parentUnit||'').toLowerCase()]));
  const commitments=new Map();
  for(const scout of mergeDraftRoutes(ordersExportDraftRoutes(turn)).filter(r=>r.routeType==='scout')){
    const unit=String(scout.unitCode||'').toLowerCase();
    const origin=parentOf.get(unit)||unit;
    commitments.set(origin,(commitments.get(origin)||0)+Math.max(0,Number(scout.noOfScouts)||0));
  }
  return activityBillStore.apply(turn,(units||[]).map(unit=>({
    ...unit,externalReservedWorkers:(commitments.get(String(unit.code||'').toLowerCase())||0)
  })));
});

ipcMain.handle('turn-manager:list-turns', () => turnManagerDatabase.listTurns());
ipcMain.handle('turn-manager:latest-template-turn', () => turnManagerDatabase.latestBlankTemplateTurn());
ipcMain.handle('turn-manager:get-turn', (_event, turnKey) => effectiveManagedTurn(turnKey));
ipcMain.handle('turn-manager:list-activities', (_event, turnKey) => turnManagerDatabase.listActivities(turnKey));
ipcMain.handle('turn-manager:add-activity', (_event, turnKey, activity) => turnManagerDatabase.addActivity(turnKey, activity));
ipcMain.handle('turn-manager:update-activity', (_event, id, activity) => turnManagerDatabase.updateActivity(id, activity));
ipcMain.handle('turn-manager:delete-activity', (_event, id) => turnManagerDatabase.deleteActivity(id));
ipcMain.handle('turn-manager:add-unit-split', (_event, turnKey, split) => turnManagerDatabase.addUnitSplit(turnKey, split));
ipcMain.handle('turn-manager:list-unit-splits', (_event, turnKey) => turnManagerDatabase.listUnitSplits(turnKey));
ipcMain.handle('turn-manager:add-transfer', (_event, turnKey, transfer) => turnManagerDatabase.addTransfer(turnKey, transfer));
ipcMain.handle('turn-manager:list-transfers', (_event, turnKey) => turnManagerDatabase.listTransfers(turnKey));
ipcMain.handle('turn-manager:delete-transfer', (_event, id) => turnManagerDatabase.deleteTransfer(id));
ipcMain.handle('turn-manager:replace-transfer-group', (_event, turnKey, unitA, unitB, timing, transfers) => turnManagerDatabase.replaceTransferGroup(turnKey, unitA, unitB, timing, transfers));
ipcMain.handle('turn-manager:delete-all-transfers', (_event, turnKey) => turnManagerDatabase.deleteAllTransfers(turnKey));
ipcMain.handle('turn-manager:delete-unit-split', (_event, id) => {
  const removed = turnManagerDatabase.deleteUnitSplit(id);
  if (removed) {
    removeRoutesForUnit(removed.turnKey, removed.unitCode);
    const baseline = resultForPlanTurn(removed.turnKey);
    if (baseline?.turnKey && String(baseline.turnKey) !== String(removed.turnKey)) removeRoutesForUnit(baseline.turnKey, removed.unitCode);
  }
  return removed;
});
ipcMain.handle('turn-manager:delete-all-unit-splits', (_event, turnKey) => {
  const removed = turnManagerDatabase.deleteAllUnitSplits(turnKey);
  for (const split of removed) {
    removeRoutesForUnit(split.turnKey, split.unitCode);
    const baseline = resultForPlanTurn(split.turnKey);
    if (baseline?.turnKey && String(baseline.turnKey) !== String(split.turnKey)) removeRoutesForUnit(baseline.turnKey, split.unitCode);
  }
  return removed;
});
ipcMain.handle('turn-manager:save-context', (_event, turnKey, notes) => turnManagerDatabase.saveContext(turnKey, notes));
ipcMain.handle('turn-manager:get-skill-attempts', (_event, turnKey, tribe) => turnManagerDatabase.getSkillAttempts(turnKey, tribe));
ipcMain.handle('turn-manager:save-skill-attempts', (_event, turnKey, tribe, attempts) => turnManagerDatabase.saveSkillAttempts(turnKey, tribe, attempts));
ipcMain.handle('turn-manager:list-order-text', (_event, turnKey, sheet) => turnManagerDatabase.listOrderText(turnKey, sheet));
ipcMain.handle('turn-manager:add-order-text', (_event, turnKey, sheet, row) => turnManagerDatabase.addOrderText(turnKey, sheet, row));
ipcMain.handle('turn-manager:update-order-text', (_event, id, row) => turnManagerDatabase.updateOrderText(id, row));
ipcMain.handle('turn-manager:delete-order-text', (_event, id) => turnManagerDatabase.deleteOrderText(id));
ipcMain.handle('turn-manager:list-research-attempts', (_event, turnKey) => turnManagerDatabase.listResearchAttempts(turnKey));
ipcMain.handle('turn-manager:add-research-attempt', (_event, turnKey, attempt) => turnManagerDatabase.addResearchAttempt(turnKey, attempt));
ipcMain.handle('turn-manager:update-research-attempt', (_event, id, attempt) => turnManagerDatabase.updateResearchAttempt(id, attempt));
ipcMain.handle('turn-manager:delete-research-attempt', (_event, id) => turnManagerDatabase.deleteResearchAttempt(id));
ipcMain.handle('turn-manager:get-skill-streaks', (_event, tribe) => turnManagerDatabase.getSkillStreaks(tribe));
ipcMain.handle('turn-manager:set-skill-streak', (_event, tribe, skill, count, turnKey) => turnManagerDatabase.setSkillStreak(tribe, skill, count, turnKey));
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
    const saved = await importResultsReportFile(filePath);
    return { canceled: false, turn: saved, archived: true };
  } catch (error) {
    console.error('Results report import failed', error);
    return { canceled: false, error: error.message };
  }
});
async function importResultsReportFile(filePath, originalFileName = path.basename(filePath)) {
  const parsed = await parseResultDocument(filePath);
  resultsDatabase.archiveSource(parsed.turnKey, filePath, originalFileName || parsed.sourceFile);
  const saved = resultsDatabase.saveReport(parsed);
  const skillsByTribe = {};
  for (const unit of parsed.units || []) {
    const tribe = String(unit.unitCode || '').trim();
    if (!/^\d{4}$/.test(tribe)) continue;
    skillsByTribe[tribe] = Object.entries(unit.skills || {}).map(([skill, level]) => ({ skill, level: Number(level || 0) }));
  }
  turnManagerDatabase.reconcileSkillAttemptResults(parsed.turnKey, skillsByTribe);
  syncResultBaseline(saved);
  return saved;
}

ipcMain.handle('results:ravenpost-latest', async () => {
  try {
    return await findLatestRavenpostResultsReport();
  } catch (error) {
    console.error('Could not check Ravenpost for a Results report', error);
    return { error: error.message };
  }
});

ipcMain.handle('results:ravenpost-import', async () => {
  let stagingDirectory = null;
  try {
    const report = await downloadLatestRavenpostResultsReport();
    if (!report) return { canceled: false, notFound: true };
    const filename = path.basename(String(report.filename || 'Results.docx')).replace(/[^A-Za-z0-9._-]/g, '_');
    if (!/results[^/]*\.docx$/i.test(filename)) throw new Error('The latest Ravenpost attachment is not a Results .docx report.');
    stagingDirectory = fs.mkdtempSync(path.join(app.getPath('temp'), 'tribenet-ravenpost-report-'));
    const filePath = path.join(stagingDirectory, filename);
    fs.writeFileSync(filePath, report.data);
    const saved = await importResultsReportFile(filePath, report.filename);
    markRavenpostResultsReportImported(report.gmailId);
    return { canceled: false, turn: saved, archived: true, source: 'Ravenpost' };
  } catch (error) {
    console.error('Ravenpost Results report import failed', error);
    return { canceled: false, error: error.message };
  } finally {
    if (stagingDirectory) {
      try { fs.rmSync(stagingDirectory, { recursive: true, force: true }); }
      catch (error) { console.warn('Could not remove temporary Ravenpost report file:', error.message); }
    }
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

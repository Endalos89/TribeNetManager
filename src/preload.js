const fs = require('fs');
const path = require('path');
const { contextBridge, ipcRenderer } = require('electron');

const FEEDBACK_FILENAME = 'feedback-comments.json';

function isEmbeddedFair() {
  try { return new URLSearchParams(window.location.search || '').get('embed') === '1'; }
  catch (_) { return false; }
}

async function feedbackFilePath() {
  const userDataPath = await ipcRenderer.invoke('app:userDataPath');
  return path.join(userDataPath, FEEDBACK_FILENAME);
}

async function loadFeedbackComments() {
  try {
    const filePath = await feedbackFilePath();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not load feedback comments', error);
    return [];
  }
}

async function saveFeedbackComments(comments) {
  try {
    const filePath = await feedbackFilePath();
    const tempPath = `${filePath}.tmp`;
    const safeComments = Array.isArray(comments) ? comments : [];
    fs.writeFileSync(tempPath, JSON.stringify(safeComments, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return { ok: true, count: safeComments.length };
  } catch (error) {
    console.error('Could not save feedback comments', error);
    return { ok: false, error: error.message };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const page = String(window.location.pathname || '').split('/').pop() || 'index.html';
  const feedbackCss = document.createElement('link');
  feedbackCss.rel = 'stylesheet';
  feedbackCss.href = 'feedback.css';
  document.head.appendChild(feedbackCss);

  const scripts = [];
  if (page === 'index.html') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'turn-file-library.css';
    document.head.appendChild(link);
    scripts.push('planned-unit-splits-map.js', 'compendium-launcher.js', 'fair-turns.js', 'fair-launcher.js');
  }
  if (page === 'turn-manager.html') scripts.push('planned-unit-splits-turn.js', 'turn-manager-mandate.js');
  if (page === 'fair.html' && isEmbeddedFair()) scripts.push('fair-embed.js');
  if (page === 'fair.html') scripts.push('fair-launcher-managed.js');
  if (page !== 'compendium.html' && page !== 'fair.html' && page !== 'fairground.html') scripts.push('session-snapshot.js');
  if (page === 'index.html') scripts.push('turn-lifecycle-core.js', 'turn-key-ui-fix.js', 'turn-lifecycle.js', 'planning-turn-movement-bridge.js', 'turn-file-library-ui.js');
  scripts.push('feedback-storage-bridge.js');
  for (const src of scripts) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.body.appendChild(script);
  }
});

contextBridge.exposeInMainWorld('fairnet', {
  importWorkbook: turnKey => ipcRenderer.invoke('fair:import', turnKey),
  listSnapshots: () => ipcRenderer.invoke('fair:list'),
  getSnapshot: turnKey => ipcRenderer.invoke('fair:get', turnKey),
  getCraftingCatalog: () => ipcRenderer.invoke('fair:recipes'),
  backup: () => ipcRenderer.invoke('fair:backup')
});

contextBridge.exposeInMainWorld('tribenet', {
  getHexesInArea: bounds => ipcRenderer.invoke('hexes:area', bounds),
  getHex: coordinate => ipcRenderer.invoke('hex:get', coordinate),
  saveHex: (hex, context) => ipcRenderer.invoke('hex:save', hex, context),
  clearHex: (coordinate, context) => ipcRenderer.invoke('hex:clear', coordinate, context),
  getHexHistory: coordinate => ipcRenderer.invoke('hex:history', coordinate),
  getSubmapSummaries: () => ipcRenderer.invoke('submaps:summaries'),
  createBackup: () => ipcRenderer.invoke('database:backup'),
  showBackup: backupPath => ipcRenderer.invoke('app:showBackup', backupPath),
  importOrdersWorkbook: () => ipcRenderer.invoke('planner:import'),
  getPlannerImports: turnKey => ipcRenderer.invoke('planner:imports', turnKey || null),
  getPlannerPlan: id => ipcRenderer.invoke('planner:get', id),
  getPlannerPlanForTurn: turnKey => ipcRenderer.invoke('planner:get-turn', turnKey),
  activatePlannerPlan: id => ipcRenderer.invoke('planner:activate', id),
  importTurnWorkbook: role => ipcRenderer.invoke('turn-manager:import', role),
  listManagedTurns: () => ipcRenderer.invoke('turn-manager:list-turns'),
  getManagedTurn: turnKey => ipcRenderer.invoke('turn-manager:get-turn', turnKey),
  addPlannedActivity: (turnKey, activity) => ipcRenderer.invoke('turn-manager:add-activity', turnKey, activity),
  updatePlannedActivity: (id, activity) => ipcRenderer.invoke('turn-manager:update-activity', id, activity),
  deletePlannedActivity: id => ipcRenderer.invoke('turn-manager:delete-activity', id),
  addPlannedUnitSplit: (turnKey, split) => ipcRenderer.invoke('turn-manager:add-unit-split', turnKey, split),
  listPlannedUnitSplits: turnKey => ipcRenderer.invoke('turn-manager:list-unit-splits', turnKey),
  deletePlannedUnitSplit: id => ipcRenderer.invoke('turn-manager:delete-unit-split', id),
  saveTurnContext: (turnKey, notes) => ipcRenderer.invoke('turn-manager:save-context', turnKey, notes),
  getActivityCatalog: () => ipcRenderer.invoke('turn-manager:catalog'),
  backupTurnManager: () => ipcRenderer.invoke('turn-manager:backup'),
  getMandateCatalog: () => ipcRenderer.invoke('mandate:catalog'),
  getMandateSkills: () => ipcRenderer.invoke('mandate:skills'),
  getMandateRecipesForSkill: skill => ipcRenderer.invoke('mandate:recipes-for-skill', skill),
  resolveMandateSkill: skill => ipcRenderer.invoke('mandate:resolve-skill', skill),
  getCompendiumCatalog: () => ipcRenderer.invoke('mandate:compendium'),
  importResultsReport: () => ipcRenderer.invoke('results:import'),
  reprocessResultsReports: () => ipcRenderer.invoke('results:reprocess'),
  getResultsReprocessStatus: () => ipcRenderer.invoke('results:reprocess-status'),
  listResultTurns: () => ipcRenderer.invoke('results:list-turns'),
  getResultTurn: turnKey => ipcRenderer.invoke('results:get-turn', turnKey),
  getResultHexesInArea: (bounds, turnKey) => ipcRenderer.invoke('results:hexes-area', bounds, turnKey),
  getResultHexHistory: coordinate => ipcRenderer.invoke('results:hex-history', coordinate),
  getResultSubmapSummaries: turnKey => ipcRenderer.invoke('results:submaps', turnKey),
  backupResults: () => ipcRenderer.invoke('results:backup'),
  getUnitSupplyRequirements: (turnKey, unitCode) => ipcRenderer.invoke('workflow:unit-supplies', turnKey, unitCode),
  listPlannedRoutes: turnKey => ipcRenderer.invoke('planned-routes:list', turnKey),
  savePlannedRoute: route => ipcRenderer.invoke('planned-routes:save', route),
  removePlannedRoute: id => ipcRenderer.invoke('planned-routes:remove', id),
  scanTurnFiles: () => ipcRenderer.invoke('turn-files:scan'),
  getTurnFilesInfo: () => ipcRenderer.invoke('turn-files:info'),
  openTurnFilesFolder: () => ipcRenderer.invoke('turn-files:open'),
  reportCurrentView: view => isEmbeddedFair() ? Promise.resolve(null) : ipcRenderer.invoke('app:report-view', view),
  consumeStartupView: () => ipcRenderer.invoke('app:consume-startup-view'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getUserDataPath: () => ipcRenderer.invoke('app:userDataPath'),
  loadFeedbackComments,
  saveFeedbackComments,
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  }
});
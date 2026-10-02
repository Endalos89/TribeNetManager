const { contextBridge, ipcRenderer } = require('electron');

function isEmbeddedFair() {
  try { return new URLSearchParams(window.location.search || '').get('embed') === '1'; }
  catch (_) { return false; }
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
    scripts.push('planned-unit-splits-map.js', 'compendium-launcher.js', 'fair-turns.js', 'fair-launcher.js', 'ravenpost-launcher.js');
  }
  if (page === 'turn-manager.html') scripts.push('planned-unit-splits-turn.js', 'turn-manager-mandate.js');
  if (page === 'fair.html' && isEmbeddedFair()) scripts.push('fair-embed.js');
  if (page === 'fair.html') scripts.push('fair-launcher-managed.js');
  if (!['compendium.html', 'fair.html', 'fairground.html', 'ravenpost.html'].includes(page)) scripts.push('session-snapshot.js');
  if (page === 'ravenpost.html') scripts.push('ravenpost-view-state.js');
  if (page === 'index.html') scripts.push('turn-lifecycle-core.js', 'turn-key-ui-fix.js', 'turn-lifecycle.js', 'planning-turn-movement-bridge.js', 'turn-file-library-ui.js', 'mapper-food-gathering.js');
  if (page === 'compendium.html') scripts.push('compendium-round4-cleanup.js');
  scripts.push('ravenpost-notifications.js');
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

contextBridge.exposeInMainWorld('ravenpost', {
  getSettings: () => ipcRenderer.invoke('ravenpost:settings'),
  saveSettings: settings => ipcRenderer.invoke('ravenpost:save-settings', settings),
  authorize: () => ipcRenderer.invoke('ravenpost:authorize'),
  disconnect: () => ipcRenderer.invoke('ravenpost:disconnect'),
  syncNow: () => ipcRenderer.invoke('ravenpost:sync'),
  listMessages: (filter, limit) => ipcRenderer.invoke('ravenpost:list-messages', filter, limit),
  getMessage: gmailId => ipcRenderer.invoke('ravenpost:get-message', gmailId),
  markRead: gmailId => ipcRenderer.invoke('ravenpost:mark-read', gmailId),
  getCounts: () => ipcRenderer.invoke('ravenpost:counts'),
  listContacts: status => ipcRenderer.invoke('ravenpost:list-contacts', status || null),
  updateContact: (email, update) => ipcRenderer.invoke('ravenpost:update-contact', email, update),
  listClans: () => ipcRenderer.invoke('ravenpost:list-clans'),
  sendMessage: payload => ipcRenderer.invoke('ravenpost:send', payload),
  createBackup: () => ipcRenderer.invoke('ravenpost:backup'),
  openExternal: url => ipcRenderer.invoke('ravenpost:open-external', url),
  onNewMail: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ravenpost:new-mail', listener);
    return () => ipcRenderer.removeListener('ravenpost:new-mail', listener);
  },
  onSyncStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ravenpost:sync-status', listener);
    return () => ipcRenderer.removeListener('ravenpost:sync-status', listener);
  },
  onContactsChanged: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ravenpost:contacts-changed', listener);
    return () => ipcRenderer.removeListener('ravenpost:contacts-changed', listener);
  }
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
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  }
});

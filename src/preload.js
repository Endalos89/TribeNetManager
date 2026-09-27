const { contextBridge, ipcRenderer } = require('electron');

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
  saveTurnContext: (turnKey, notes) => ipcRenderer.invoke('turn-manager:save-context', turnKey, notes),
  getActivityCatalog: () => ipcRenderer.invoke('turn-manager:catalog'),
  backupTurnManager: () => ipcRenderer.invoke('turn-manager:backup'),
  importResultsReport: () => ipcRenderer.invoke('results:import'),
  reprocessResultsReports: () => ipcRenderer.invoke('results:reprocess'),
  getResultsReprocessStatus: () => ipcRenderer.invoke('results:reprocess-status'),
  listResultTurns: () => ipcRenderer.invoke('results:list-turns'),
  getResultTurn: turnKey => ipcRenderer.invoke('results:get-turn', turnKey),
  getResultHexesInArea: (bounds, turnKey) => ipcRenderer.invoke('results:hexes-area', bounds, turnKey),
  getResultHexHistory: coordinate => ipcRenderer.invoke('results:hex-history', coordinate),
  getResultSubmapSummaries: turnKey => ipcRenderer.invoke('results:submaps', turnKey),
  backupResults: () => ipcRenderer.invoke('results:backup'),
  listPlannedRoutes: turnKey => ipcRenderer.invoke('planned-routes:list', turnKey),
  savePlannedRoute: route => ipcRenderer.invoke('planned-routes:save', route),
  removePlannedRoute: id => ipcRenderer.invoke('planned-routes:remove', id),
  reportCurrentView: view => ipcRenderer.invoke('app:report-view', view),
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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tribenet', {
  getHexesInArea: bounds => ipcRenderer.invoke('hexes:area', bounds),
  getHex: coordinate => ipcRenderer.invoke('hex:get', coordinate),
  saveHex: hex => ipcRenderer.invoke('hex:save', hex),
  clearHex: coordinate => ipcRenderer.invoke('hex:clear', coordinate),
  getSubmapSummaries: () => ipcRenderer.invoke('submaps:summaries'),
  createBackup: () => ipcRenderer.invoke('database:backup'),
  showBackup: backupPath => ipcRenderer.invoke('app:showBackup', backupPath),
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

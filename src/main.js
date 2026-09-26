const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { TribeNetDatabase } = require('./database');

let mainWindow;
let database;

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', payload);
  }
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-not-available', info => sendUpdateStatus({ state: 'current', message: `You are up to date (${info.version}).` }));
  autoUpdater.on('update-available', async info => {
    sendUpdateStatus({ state: 'downloading', message: `Downloading version ${info.version}…`, version: info.version });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      sendUpdateStatus({ state: 'error', message: `Update download failed: ${error.message}` });
    }
  });
  autoUpdater.on('download-progress', progress => sendUpdateStatus({
    state: 'downloading',
    message: `Downloading update… ${Math.round(progress.percent)}%`,
    percent: progress.percent
  }));
  autoUpdater.on('update-downloaded', info => sendUpdateStatus({
    state: 'ready',
    message: `Version ${info.version} is ready. Restart to install.`,
    version: info.version
  }));
  autoUpdater.on('error', error => sendUpdateStatus({ state: 'error', message: `Update error: ${error.message}` }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#0b1117',
    title: 'TribeNet Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  database = new TribeNetDatabase(app.getPath('userData'));
  configureUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (database) database.close();
});

ipcMain.handle('hexes:area', (_event, bounds) => database.getHexesInArea(bounds));
ipcMain.handle('hex:get', (_event, coordinate) => database.getHex(coordinate));
ipcMain.handle('hex:save', (_event, hex) => database.saveHex(hex));
ipcMain.handle('hex:clear', (_event, coordinate) => database.clearHex(coordinate));
ipcMain.handle('submaps:summaries', () => database.getSubmapSummaries());
ipcMain.handle('database:backup', () => database.createManualBackup());

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    const payload = { state: 'development', message: 'Updates are available in installed builds. This is a development build.' };
    sendUpdateStatus(payload);
    return payload;
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const payload = { state: 'error', message: `Could not check for updates: ${error.message}` };
    sendUpdateStatus(payload);
    return payload;
  }
});

ipcMain.handle('update:install', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall(false, true);
  return true;
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:userDataPath', () => app.getPath('userData'));
ipcMain.handle('app:showBackup', async (_event, backupPath) => {
  if (backupPath) shell.showItemInFolder(backupPath);
  return true;
});

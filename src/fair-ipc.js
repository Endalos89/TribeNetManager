const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { FairDatabase } = require('./fair-database');
const { parseFairWorkbook } = require('./fair-parser');
const { RECIPES, SKILLS } = require('./mandate-catalog');

let fairDatabase = null;

function store() {
  if (!fairDatabase) fairDatabase = new FairDatabase(app.getPath('userData'));
  return fairDatabase;
}

app.whenReady().then(() => store());
app.on('before-quit', () => {
  if (fairDatabase) fairDatabase.close();
  fairDatabase = null;
});

ipcMain.handle('fair:import', async (_event, turnKey) => {
  const options = {
    title:`Import Fair workbook for ${turnKey || 'selected turn'}`,
    properties:['openFile'],
    filters:[{ name:'Fair Excel workbooks', extensions:['xlsx','xlsm','xls'] }]
  };
  const focused = BrowserWindow.getFocusedWindow();
  const result = focused ? await dialog.showOpenDialog(focused, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths.length) return { canceled:true };
  try {
    const snapshot = parseFairWorkbook(result.filePaths[0], turnKey);
    return { canceled:false, snapshot:store().saveSnapshot(snapshot, result.filePaths[0]) };
  } catch (error) {
    console.error('Fair workbook import failed', error);
    return { canceled:false, error:error.message };
  }
});

ipcMain.handle('fair:list', () => store().listSnapshots());
ipcMain.handle('fair:get', (_event, turnKey) => store().getSnapshot(turnKey));
ipcMain.handle('fair:recipes', () => ({ recipes:RECIPES, skills:SKILLS }));
ipcMain.handle('fair:backup', () => store().createBackup());

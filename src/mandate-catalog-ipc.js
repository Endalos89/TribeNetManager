const { app, ipcMain } = require('electron');
const { MandateCatalogDatabase } = require('./mandate-catalog-database');

let mandateCatalogDatabase = null;

app.whenReady().then(() => {
  mandateCatalogDatabase = new MandateCatalogDatabase(app.getPath('userData'));
});

ipcMain.handle('mandate:catalog', () => mandateCatalogDatabase?.getCatalog() || { version: 0, sourceDocument: '', skills: [], recipes: [] });
ipcMain.handle('mandate:skills', () => mandateCatalogDatabase?.listSkills() || []);
ipcMain.handle('mandate:recipes-for-skill', (_event, skill) => mandateCatalogDatabase?.recipeRowsForSkill(skill) || []);
ipcMain.handle('mandate:resolve-skill', (_event, skill) => mandateCatalogDatabase?.resolveSkill(skill) || null);

app.on('before-quit', () => {
  if (mandateCatalogDatabase) mandateCatalogDatabase.close();
  mandateCatalogDatabase = null;
});

const { app, ipcMain } = require('electron');
const { MandateCatalogDatabase } = require('./mandate-catalog-database');
const { completeMandateSkills } = require('./compendium-service');

let mandateCatalogDatabase = null;

function catalogDb() {
  if (!mandateCatalogDatabase && app.isReady()) mandateCatalogDatabase = new MandateCatalogDatabase(app.getPath('userData'));
  return mandateCatalogDatabase;
}

app.whenReady().then(() => catalogDb());

ipcMain.handle('mandate:catalog', () => catalogDb()?.getCatalog() || { version: 0, sourceDocument: '', skills: [], recipes: [] });
ipcMain.handle('mandate:skills', () => catalogDb()?.listSkills() || []);
ipcMain.handle('mandate:recipes-for-skill', (_event, skill) => catalogDb()?.recipeRowsForSkill(skill) || []);
ipcMain.handle('mandate:resolve-skill', (_event, skill) => catalogDb()?.resolveSkill(skill) || null);
ipcMain.handle('mandate:compendium', () => completeMandateSkills(catalogDb()?.getCatalog() || { version: 0, sourceDocument: '', skills: [], recipes: [] }));

app.on('before-quit', () => {
  if (mandateCatalogDatabase) mandateCatalogDatabase.close();
  mandateCatalogDatabase = null;
});

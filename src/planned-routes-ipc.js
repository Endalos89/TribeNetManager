const { app, ipcMain } = require('electron');
const { PlannedRoutesDatabase } = require('./planned-routes-database');

let plannedRoutesDatabase = null;

function routesDb() {
  if (!plannedRoutesDatabase) plannedRoutesDatabase = new PlannedRoutesDatabase(app.getPath('userData'));
  return plannedRoutesDatabase;
}

ipcMain.handle('planned-routes:list', (_event, turnKey) => routesDb().list(turnKey));
ipcMain.handle('planned-routes:save', (_event, route) => routesDb().save(route));
ipcMain.handle('planned-routes:remove', (_event, id) => routesDb().remove(id));

app.on('before-quit', () => {
  if (plannedRoutesDatabase) plannedRoutesDatabase.close();
  plannedRoutesDatabase = null;
});

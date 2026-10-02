const path = require('path');
const { app, ipcMain, Notification, BrowserWindow, shell } = require('electron');
const { RavenpostDatabase } = require('./ravenpost-database');
const { RavenpostService } = require('./ravenpost-service');
const { ResultsDatabase } = require('./results-database');

let ravenDb = null;
let ravenService = null;
let ravenResultsDatabase = null;
let pollTimer = null;
let syncInFlight = null;

function requireService() {
  if (!ravenService) throw new Error('Ravenpost is still starting.');
  return ravenService;
}

function sendToWindows(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

function openRavenpost() {
  const window = BrowserWindow.getAllWindows().find(item => !item.isDestroyed());
  if (!window) return;
  window.loadFile(path.join(__dirname, 'ravenpost.html'));
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function showNewMailNotification(message) {
  const settings = ravenService?.getSettings();
  if (!settings?.notificationsEnabled) return;

  const contact = ravenDb.getContact(message.senderEmail);
  if (contact?.status === 'not_interested') return;

  if (Notification.isSupported()) {
    const sender = contact?.displayName || message.senderName || message.senderEmail || 'Unknown sender';
    const notification = new Notification({
      title: 'Ravenpost · New raven arrived',
      body: `${sender}: ${message.subject || '(No subject)'}`,
      silent: true
    });
    notification.on('click', openRavenpost);
    notification.show();
  }

  sendToWindows('ravenpost:new-mail', {
    gmailId: message.gmailId,
    senderEmail: message.senderEmail,
    senderName: message.senderName,
    subject: message.subject,
    playSound: settings.soundEnabled
  });
}

async function syncNow({ background = false } = {}) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const result = await requireService().syncInbox();
      if (!result.firstSync) {
        for (const message of result.newMessages) showNewMailNotification(message);
      }
      sendToWindows('ravenpost:sync-status', {
        state: 'complete',
        newCount: result.newMessages.length,
        firstSync: result.firstSync,
        lastSyncAt: result.settings.lastSyncAt,
        counts: result.counts
      });
      return result;
    } catch (error) {
      if (!background) throw error;
      console.warn('Ravenpost background sync failed:', error.message);
      sendToWindows('ravenpost:sync-status', {
        state: 'error',
        message: error.message
      });
      return { error: error.message };
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

function restartPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (!ravenService) return;
  const settings = ravenService.getSettings();
  if (!settings.connected) return;
  const intervalMs = Math.max(30, settings.pollSeconds || 60) * 1000;
  pollTimer = setInterval(() => syncNow({ background: true }), intervalMs);
  if (pollTimer.unref) pollTimer.unref();
}

function registerHandlers() {
  ipcMain.handle('ravenpost:settings', () => requireService().getSettings());
  ipcMain.handle('ravenpost:save-settings', (_event, input) => {
    const result = requireService().saveSettings(input || {});
    restartPolling();
    return result;
  });
  ipcMain.handle('ravenpost:authorize', async () => {
    const settings = await requireService().authorize();
    restartPolling();
    const sync = await syncNow({ background: false });
    return { settings, sync };
  });
  ipcMain.handle('ravenpost:disconnect', async () => {
    const settings = await requireService().disconnect();
    restartPolling();
    return settings;
  });
  ipcMain.handle('ravenpost:sync', () => syncNow({ background: false }));
  ipcMain.handle('ravenpost:list-messages', (_event, filter, limit) =>
    ravenDb.listMessages(filter || 'inbox', limit || 200)
  );
  ipcMain.handle('ravenpost:get-message', (_event, gmailId) => ravenDb.getMessage(gmailId));
  ipcMain.handle('ravenpost:mark-read', (_event, gmailId) => ravenDb.markRead(gmailId));
  ipcMain.handle('ravenpost:counts', () => ravenDb.getCounts());
  ipcMain.handle('ravenpost:list-contacts', (_event, status) => ravenDb.listContacts(status || null));
  ipcMain.handle('ravenpost:update-contact', (_event, email, update) => {
    const contact = ravenDb.updateContact(email, update || {});
    sendToWindows('ravenpost:contacts-changed', { email, contact });
    return contact;
  });
  ipcMain.handle('ravenpost:list-clans', () => requireService().listClans());
  ipcMain.handle('ravenpost:send', (_event, payload) => requireService().sendMessage(payload || {}));
  ipcMain.handle('ravenpost:backup', () => ravenDb.createBackup());
  ipcMain.handle('ravenpost:open-external', (_event, url) => {
    const allowed = new URL(String(url || ''));
    if (!['https:', 'http:'].includes(allowed.protocol)) throw new Error('Only web links can be opened.');
    return shell.openExternal(allowed.toString());
  });
}

registerHandlers();

app.whenReady().then(() => {
  ravenDb = new RavenpostDatabase(app.getPath('userData'));
  ravenResultsDatabase = new ResultsDatabase(app.getPath('userData'));
  ravenService = new RavenpostService(ravenDb, ravenResultsDatabase);
  restartPolling();

  const settings = ravenService.getSettings();
  if (settings.connected) {
    setTimeout(() => syncNow({ background: true }), 3500);
  }
});

app.on('before-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (ravenDb) ravenDb.close();
  if (ravenResultsDatabase) ravenResultsDatabase.close();
  ravenDb = null;
  ravenResultsDatabase = null;
  ravenService = null;
});

module.exports = { syncNow };

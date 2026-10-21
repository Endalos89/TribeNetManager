const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { RavenpostDatabase } = require('../src/ravenpost-database');
const originalLoad = Module._load;
Module._load = function loadElectronForRavenpostTests(request, parent, isMain) {
  if (request === 'electron') return { safeStorage: { isEncryptionAvailable: () => false }, shell: {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { RavenpostService, RESULTS_REPORT_SENDER, ORDERS_TEMPLATE_SENDER, findResultsReportAttachment, findOrdersTemplateAttachments, turnKeyFromOrdersFilename } = require('../src/ravenpost-service');
Module._load = originalLoad;

const root = path.join(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src', 'ravenpost-service.js'), 'utf8');
const ipc = fs.readFileSync(path.join(root, 'src', 'ravenpost-ipc.js'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'src', 'ravenpost-launcher.js'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'src', 'ravenpost-notifications.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src', 'ravenpost.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'ravenpost.html'), 'utf8');
const viewState = fs.readFileSync(path.join(root, 'src', 'update-view-state.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const launcherImports = fs.readFileSync(path.join(root, 'src', 'launcher-imports.js'), 'utf8');

assert.match(preload, /exposeInMainWorld\(['"]ravenpost['"]/, 'Ravenpost must stay behind the preload IPC bridge');
assert.match(preload, /ipcRenderer\.invoke\(['"]ravenpost:authorize['"]/, 'Gmail authorization should go through IPC');
assert.match(preload, /ipcRenderer\.invoke\(['"]ravenpost:send['"]/, 'Gmail sending should go through IPC');
assert.doesNotMatch(preload, /refresh_token|client_secret/i, 'OAuth secrets must not be exposed directly by preload');
assert.match(service, /safeStorage\.encryptString/, 'OAuth credentials should use Electron protected storage where available');
assert.match(service, /gmail\.readonly/, 'Ravenpost needs Gmail read scope');
assert.match(service, /gmail\.send/, 'Ravenpost needs Gmail send scope');
assert.match(service, /Cc: /, 'Reply All should emit RFC email Cc header');
assert.match(ui, /function setReplyMode\(all\)/, 'Ravenpost must support both Reply and Reply All');
assert.match(html, /id="rpReplyAllButton"/, 'Reply All control must be visible');
assert.match(html, /id="rpContactDirectory"/, 'Contact Directory must be visible');
assert.match(preload, /ravenpost:create-clan/, 'Clan creation must use IPC');
assert.match(service, /included_addresses/, 'Ravenpost must support an approved-address inclusion list');
assert.match(service, /nextPageToken/, 'Historical Gmail imports must follow pagination');
assert.match(service, /'outbound' : 'inbound'/, 'Gmail history must distinguish sent and received mail');
assert.doesNotMatch(service, /labelIds: 'INBOX'/, 'Ravenpost must not restrict its search to Gmail Inbox');
assert.match(service, /from:\$\{RESULTS_REPORT_SENDER\} has:attachment filename:docx/, 'Ravenpost must find report mail even when the sender is not in the player allowlist');
assert.match(main, /results:ravenpost-import/, 'The launcher must be able to import a Results report from Ravenpost');
assert.match(service, /from:\$\{ORDERS_TEMPLATE_SENDER\} has:attachment/);
assert.match(main, /orders:template-ravenpost/);
assert.match(main, /importOrdersTemplateFromRavenpost\(turnKey\)/, 'Orders export should automatically fetch its baseline when none is stored');
assert.match(preload, /importRavenpostOrdersTemplate: turnKey => ipcRenderer\.invoke\('orders:template-ravenpost'/);
assert.match(launcherImports, /importRavenpostOrdersTemplate\(turnKey\)/);
assert.match(launcherImports, /baselineSource === 'Ravenpost'/);
assert.match(launcher, /pickupRavenpostResultsButton/, 'A Results pickup action should appear above the Ravenpost launcher card');

assert.match(ipc, /contact\?\.status === ['"]not_interested['"]/, 'Ignored senders must suppress new-mail alerts');
assert.match(launcher, /ravenpost\.html/, 'Launcher should open Ravenpost');
assert.match(viewState, /ravenpost\.html/, 'Ravenpost should be restorable after an app update');
assert.match(notifications, /Common_Raven_Grand_Teton_National_Park\.ogg\.mp3/, 'Ravenpost should use the real Common Raven MP3');
assert.doesNotMatch(notifications, /AudioContext|createOscillator|scheduleCroak/, 'The synthetic raven call should no longer be used');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-ravenpost-'));
let db = null;
try {
  db = new RavenpostDatabase(tempRoot);
  const now = new Date().toISOString();

  db.createClan('The Ravens');
  assert.ok(db.listClans().some(clan => clan.code === 'The Ravens'));
  db.ensureContact('Trader@example.com', 'Trader');
  db.upsertMessage({
    gmailId: 'm1',
    threadId: 't1',
    direction: 'inbound',
    senderEmail: 'Trader@example.com',
    senderName: 'Trader',
    recipient: 'ravenwake0485@gmail.com',
    subject: 'Trade offer',
    snippet: 'I have timber available.',
    bodyText: 'I have timber available.',
    receivedAt: now,
    unread: true
  });
  db.upsertMessage({
    gmailId: 'm2',
    threadId: 't2',
    direction: 'inbound',
    senderEmail: 'TRADER@example.com',
    senderName: 'Trader',
    recipient: 'ravenwake0485@gmail.com',
    subject: 'Second trade offer',
    snippet: 'I also have stone available.',
    bodyText: 'I also have stone available.',
    receivedAt: now,
    unread: true
  });

  assert.strictEqual(db.getCounts().unknown, 2, 'Messages from a new sender should start as unknown');
  assert.strictEqual(db.listMessages('inbox').length, 2, 'Unknown sender mail should appear in Inbox');

  db.updateContact('trader@example.com', { status: 'linked', clanCode: '0485' });
  assert.strictEqual(db.getContact('TRADER@example.com').clanCode, '0485', 'Email matching should be case-insensitive');
  db.updateContact('trader@example.com', { status: 'linked', contactType: 'GM' });
  assert.strictEqual(db.getContact('trader@example.com').contactType, 'GM', 'GM contact type should persist');
  db.updateContact('trader@example.com', { status: 'linked', contactType: 'Clan', clanCode: '0485' });
  assert.strictEqual(db.listMessages('linked').length, 2, 'All mail from the linked sender should appear in linked view');

  db.updateContact('trader@example.com', { status: 'not_interested' });
  assert.strictEqual(db.listMessages('inbox').length, 0, 'Not Interested sender mail should be hidden from Inbox');
  assert.strictEqual(db.listMessages('unknown').length, 0, 'Not Interested sender mail should be hidden from Unknown Senders');
  assert.strictEqual(db.listMessages('linked').length, 0, 'Not Interested sender mail should be hidden from linked view');
  assert.strictEqual(db.listMessages('all').length, 0, 'Not Interested sender mail should be hidden from All Mail');
  assert.strictEqual(db.listMessages('ignored').length, 2, 'All existing mail from the sender should move to Not Interested');

  db.upsertMessage({
    gmailId: 'm3',
    threadId: 't3',
    direction: 'inbound',
    senderEmail: 'trader@example.com',
    senderName: 'Trader',
    recipient: 'ravenwake0485@gmail.com',
    subject: 'Future trade offer',
    snippet: 'One more offer.',
    bodyText: 'One more offer.',
    receivedAt: now,
    unread: true
  });
  assert.strictEqual(db.listMessages('inbox').length, 0, 'Future mail from a Not Interested email address should stay filtered');
  assert.strictEqual(db.listMessages('all').length, 0, 'Future ignored mail should stay out of All Mail');
  assert.strictEqual(db.listMessages('ignored').length, 3, 'Future mail from an ignored sender should remain accessible in Not Interested');
  assert.strictEqual(db.getCounts().unread, 0, 'Ignored sender mail should not contribute to Ravenpost unread count');

  db.updateContact('trader@example.com', { status: 'unlinked' });
  assert.strictEqual(db.listMessages('inbox').length, 3, 'Restoring a sender should restore all of their mail to Inbox');
  db.markRead('m1');
  assert.strictEqual(db.getMessage('m1').unread, false, 'Opening a Ravenpost message should be persistently markable as read');

  db.clearMessages();
  assert.strictEqual(db.listMessages('all').length, 0, 'Changing approved senders must clear excluded cached messages');

  const backupPath = db.createBackup();
  assert.ok(fs.existsSync(backupPath), 'Ravenpost should create an independent local backup');
} finally {
  if (db) db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

(async () => {
  const attachment = { filename: '0485_906_05_Results.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: { attachmentId: 'att-1' } };
  assert.deepStrictEqual(findResultsReportAttachment({ mimeType: 'multipart/mixed', parts: [
    { filename: 'turn-news.pdf', body: { attachmentId: 'news' } },
    { mimeType: 'multipart/alternative', parts: [attachment] }
  ] }), [{ filename: attachment.filename, mimeType: attachment.mimeType, attachmentId: 'att-1' }]);

  const orderAttachment = { filename: '0485_906_05_Orders.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: { attachmentId: 'orders-1' } };
  assert.deepStrictEqual(findOrdersTemplateAttachments({ mimeType: 'multipart/mixed', parts: [
    { filename: 'tribenet-news.pdf', body: { attachmentId: 'news-1' } },
    { mimeType: 'multipart/alternative', parts: [orderAttachment] }
  ] }), [{ filename: orderAttachment.filename, mimeType: orderAttachment.mimeType, attachmentId: 'orders-1' }]);
  assert.strictEqual(turnKeyFromOrdersFilename(orderAttachment.filename), '906-05');

  const settings = new Map();
  const db = { getSetting: (key, fallback = null) => settings.has(key) ? settings.get(key) : fallback, setSetting: (key, value) => settings.set(key, String(value)) };
  const ravenpost = new RavenpostService(db);
  const queryPaths = [];
  ravenpost.gmailJson = async pathname => {
    queryPaths.push(pathname);
    if (pathname.startsWith('/users/me/messages?')) return { messages: [{ id: 'report-1' }] };
    if (pathname === '/users/me/messages/report-1?format=full') return {
      id: 'report-1',
      internalDate: String(Date.parse('2026-10-21T10:00:00Z')),
      payload: {
        headers: [
          { name: 'From', value: `TribeNet Postmaster <${RESULTS_REPORT_SENDER}>` },
          { name: 'Subject', value: 'Your TribeNet results and news' }
        ],
        mimeType: 'multipart/mixed',
        parts: [attachment]
      }
    };
    if (pathname === '/users/me/messages/report-1/attachments/att-1') return { data: Buffer.from('word report').toString('base64url') };
    throw new Error(`Unexpected Gmail request: ${pathname}`);
  };
  const report = await ravenpost.findLatestResultsReport();
  assert.strictEqual(report.filename, attachment.filename);
  assert.strictEqual(report.gmailId, 'report-1');
  assert(queryPaths[0].includes(encodeURIComponent(RESULTS_REPORT_SENDER)));
  const downloaded = await ravenpost.downloadLatestResultsReport();
  assert.strictEqual(downloaded.data.toString(), 'word report');
  ravenpost.markResultsReportImported('report-1');
  assert.strictEqual(await ravenpost.findLatestResultsReport(), null, 'An imported report should no longer appear as pending pickup');

  const ordersDb = { getSetting: () => '' };
  const ordersService = new RavenpostService(ordersDb);
  const orderQueries = [];
  ordersService.gmailJson = async pathname => {
    orderQueries.push(pathname);
    if (pathname.startsWith('/users/me/messages?')) return { messages: [{ id: 'orders-mail-1' }] };
    if (pathname === '/users/me/messages/orders-mail-1?format=full') return {
      id: 'orders-mail-1', internalDate: String(Date.parse('2026-10-21T11:00:00Z')),
      payload: {
        headers: [
          { name: 'From', value: `TribeNet Reports <${ORDERS_TEMPLATE_SENDER}>` },
          { name: 'Subject', value: 'Blank Orders workbook for Turn 906-05' }
        ],
        mimeType: 'multipart/mixed', parts: [orderAttachment]
      }
    };
    if (pathname === '/users/me/messages/orders-mail-1/attachments/orders-1') return { data: Buffer.from('xlsx template').toString('base64url') };
    throw new Error(`Unexpected Orders Gmail request: ${pathname}`);
  };
  const foundOrders = await ordersService.findLatestOrdersTemplate({ turnKey: '906-05' });
  assert.strictEqual(foundOrders.filename, orderAttachment.filename);
  assert.strictEqual(foundOrders.turnKey, '906-05');
  assert(orderQueries[0].includes(encodeURIComponent(ORDERS_TEMPLATE_SENDER)));
  const downloadedOrders = await ordersService.downloadLatestOrdersTemplate({ turnKey: '906-05' });
  assert.strictEqual(downloadedOrders.data.toString(), 'xlsx template');

  const syncSettings = new Map();
  const syncDb = {
    getSetting: (key, fallback = null) => syncSettings.has(key) ? syncSettings.get(key) : fallback,
    setSetting: (key, value) => syncSettings.set(key, String(value)),
    getMessage: () => null,
    upsertMessage: message => ({ inserted: true, message }),
    getCounts: () => ({ unread: 1, unknown: 0, ignored: 0 })
  };
  const syncService = new RavenpostService(syncDb);
  const syncQueries = [];
  syncService.gmailJson = async pathname => {
    syncQueries.push(pathname);
    if (pathname.startsWith('/users/me/messages?')) return { messages: [{ id: 'report-2' }] };
    if (pathname === '/users/me/messages/report-2?format=full') return {
      id: 'report-2', threadId: 'thread-2', internalDate: String(Date.now()),
      labelIds: ['UNREAD'], snippet: 'Results attached',
      payload: {
        headers: [
          { name: 'From', value: RESULTS_REPORT_SENDER },
          { name: 'To', value: 'manager@example.com' },
          { name: 'Subject', value: 'Results and news' }
        ],
        mimeType: 'multipart/mixed', parts: [attachment]
      }
    };
    throw new Error(`Unexpected sync request: ${pathname}`);
  };
  const syncResult = await syncService.syncInbox();
  assert.strictEqual(syncResult.newMessages.length, 1, 'Postmaster Results email should sync even with no approved player addresses');
  assert(syncQueries[0].includes(encodeURIComponent(RESULTS_REPORT_SENDER)));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).then(() => {
  if (!process.exitCode) console.log('Ravenpost regression tests passed');
});

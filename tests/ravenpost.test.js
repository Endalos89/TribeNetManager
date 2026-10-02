const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RavenpostDatabase } = require('../src/ravenpost-database');

const root = path.join(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src', 'ravenpost-service.js'), 'utf8');
const ipc = fs.readFileSync(path.join(root, 'src', 'ravenpost-ipc.js'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'src', 'ravenpost-launcher.js'), 'utf8');
const viewState = fs.readFileSync(path.join(root, 'src', 'update-view-state.js'), 'utf8');

assert.match(preload, /exposeInMainWorld\(['"]ravenpost['"]/, 'Ravenpost must stay behind the preload IPC bridge');
assert.match(preload, /ipcRenderer\.invoke\(['"]ravenpost:authorize['"]/, 'Gmail authorization should go through IPC');
assert.match(preload, /ipcRenderer\.invoke\(['"]ravenpost:send['"]/, 'Gmail sending should go through IPC');
assert.doesNotMatch(preload, /refresh_token|client_secret/i, 'OAuth secrets must not be exposed directly by preload');
assert.match(service, /safeStorage\.encryptString/, 'OAuth credentials should use Electron protected storage where available');
assert.match(service, /gmail\.readonly/, 'Ravenpost needs Gmail read scope');
assert.match(service, /gmail\.send/, 'Ravenpost needs Gmail send scope');
assert.match(ipc, /contact\?\.status === ['"]not_interested['"]/, 'Ignored senders must suppress new-mail alerts');
assert.match(launcher, /ravenpost\.html/, 'Launcher should open Ravenpost');
assert.match(viewState, /ravenpost\.html/, 'Ravenpost should be restorable after an app update');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-ravenpost-'));
let db = null;
try {
  db = new RavenpostDatabase(tempRoot);
  const now = new Date().toISOString();

  db.ensureContact('Trader@example.com', 'Trader');
  db.upsertMessage({
    gmailId: 'm1',
    threadId: 't1',
    direction: 'inbound',
    senderEmail: 'Trader@example.com',
    senderName: 'Trader',
    recipient: 'ravenwake_0485@gmail.com',
    subject: 'Trade offer',
    snippet: 'I have timber available.',
    bodyText: 'I have timber available.',
    receivedAt: now,
    unread: true
  });

  assert.strictEqual(db.getCounts().unknown, 1, 'A new sender should start as unknown');
  assert.strictEqual(db.listMessages('inbox').length, 1, 'Unknown sender mail should appear in Inbox');

  db.updateContact('trader@example.com', { status: 'linked', clanCode: '0485' });
  assert.strictEqual(db.getContact('TRADER@example.com').clanCode, '0485', 'Email matching should be case-insensitive');
  assert.strictEqual(db.listMessages('linked').length, 1, 'Linked sender mail should appear in linked view');

  db.updateContact('trader@example.com', { status: 'not_interested' });
  assert.strictEqual(db.listMessages('inbox').length, 0, 'Not Interested mail should be hidden from Inbox');
  assert.strictEqual(db.listMessages('ignored').length, 1, 'Not Interested mail should remain accessible');

  db.updateContact('trader@example.com', { status: 'unlinked' });
  db.markRead('m1');
  assert.strictEqual(db.getMessage('m1').unread, false, 'Opening a Ravenpost message should be persistently markable as read');

  const backupPath = db.createBackup();
  assert.ok(fs.existsSync(backupPath), 'Ravenpost should create an independent local backup');
} finally {
  if (db) db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Ravenpost regression tests passed');

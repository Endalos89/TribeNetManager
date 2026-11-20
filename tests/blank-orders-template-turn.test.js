'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { canonicalTurnKey, inferOrdersTemplateTurnKey } = require('../src/turn-key');

// Template turns are taken from the uploaded file, not whatever previous
// planning turn happened to be selected in Mapper.
for (const name of [
  '0485_906_08_Orders.xlsx',
  'Orders_906-08.xlsx',
  'Orders_906-08 Blank.xlsx',
  'TribeNet Orders 906 08 (1).xlsx',
  'C:\\Users\\Tester\\Downloads\\0485_906_08_Orders.xlsx',
  '/home/user/0485_906_8_Orders.xlsm'
]) assert.equal(inferOrdersTemplateTurnKey(name), '906-08', name);
for (const name of [
  'Blank_Orders.xlsx',
  '0485_906_13_Orders.xlsx',
  'Orders_906-07_906-08.xlsx'
]) assert.equal(inferOrdersTemplateTurnKey(name), null, name);

const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
const handlerStart = main.indexOf("ipcMain.handle('orders:template-import'");
const handlerEnd = main.indexOf('\nasync function importOrdersTemplateFromRavenpost', handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart);
const callbacks = new Map(), saves = [], lifecycleCalls = [];
let uploadPath = 'C:\\Downloads\\0485_906_08_Orders.xlsx';
const ipcContext = {
  ipcMain: { handle: (name, callback) => callbacks.set(name, callback) },
  dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [uploadPath] }) },
  mainWindow: {},
  inferOrdersTemplateTurnKey, canonicalTurnKey, path, console,
  app: { getPath: () => '/unit-test' },
  saveOrderTemplate: async (filePath, location, turnKey) => {
    saves.push({ filePath, location, turnKey });
    return { turnKey, sourceFile: path.basename(filePath), storedPath: '/unit-test/' + turnKey };
  },
  turnManagerDatabase: { recordBlankTemplateReceived: (turnKey, fileName) => {
    lifecycleCalls.push({ turnKey, fileName });
    return { completedTurnKey: '906-07' };
  } }
};
vm.runInNewContext(main.slice(handlerStart, handlerEnd), ipcContext, { filename: 'main-orders-template-import.js' });
const importTemplate = callbacks.get('orders:template-import');
assert.equal(typeof importTemplate, 'function');

async function test() {
  const uploaded = await importTemplate(null, '906-07');
  assert.equal(uploaded.turnKey, '906-08');
  assert.equal(saves.at(-1).turnKey, '906-08',
    'New blank template must not be stored as the old selected turn');
  assert.equal(lifecycleCalls.at(-1).turnKey, '906-08',
    'The newly uploaded turn, not the old one, must advance the lifecycle');
  assert.equal(uploaded.lifecycle.completedTurnKey, '906-07');

  uploadPath = '/downloads/Blank_Orders.xlsx';
  const savedCount = saves.length, lifecycleCount = lifecycleCalls.length;
  const unknown = await importTemplate(null, '906-07');
  assert.match(unknown.error, /rename.*include its turn/i);
  assert.equal(saves.length, savedCount, 'Unidentified template must not overwrite any template');
  assert.equal(lifecycleCalls.length, lifecycleCount, 'Unidentified template must not change turn status');

  // The launcher must use the returned, filename-derived turn when switching
  // the Mapper timeline and preserve the resulting success/error message.
  const launcher = fs.readFileSync(path.join(__dirname, '../src/launcher-imports.js'), 'utf8');
  const start = launcher.indexOf('  async function importBlankOrders() {');
  const end = launcher.indexOf('\n  async function fetchBlankOrders() {', start);
  assert(start >= 0 && end > start);
  const storage = new Map([['tribenet:selectedResultTurn','906-07'],
    ['tribenet:activeOrdersTemplateTurn','906-07']]);
  const selected = [], dispatched = [], refreshed = [];
  const ordersStatus = { textContent: '' };
  const uiContext = {
    ordersStatus,
    setBusy: () => {},
    selectedPlanningTurnKey: () => '906-07',
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    canonicalTurnKey,
    ACTIVE_ORDERS_TURN_STORAGE_KEY: 'tribenet:activeOrdersTemplateTurn',
    RESULT_TURN_STORAGE_KEY: 'tribenet:selectedResultTurn',
    refreshPlanningTurn: async (turn, id) => selected.push({ turn, id }),
    refreshOrdersStatus: async opts => refreshed.push(opts),
    window: { tribenet: { importOrdersTemplate: async () => ({
      turnKey:'906-08', lifecycle:{ completedTurnKey:'906-07' }
    }) }, dispatchEvent: e => dispatched.push(e) },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type=type;this.detail=options?.detail; }
    }
  };
  vm.runInNewContext(launcher.slice(start, end) + '\nthis.importBlankOrdersTest=importBlankOrders;', uiContext);
  await uiContext.importBlankOrdersTest();
  assert.equal(storage.get('tribenet:selectedResultTurn'), '906-08');
  assert.equal(storage.get('tribenet:activeOrdersTemplateTurn'), '906-08');
  assert.deepEqual(selected, [{turn:'906-08',id:'draft'}]);
  assert.equal(dispatched[0].detail.turnKey, '906-08');
  assert.match(ordersStatus.textContent, /906-08/);
  assert(refreshed[0].preserveMessage, 'Do not erase the confirmation of the imported turn');
  console.log('Blank Orders filename turn and Mapper handoff regression tests passed');
}
test().catch(error => { console.error(error); process.exitCode=1; });

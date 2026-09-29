const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const core = require('../src/fair-core');
const { parseFairWorkbook } = require('../src/fair-parser');

(function fairParserRegression() {
  const rows = [
    [906, 'Fair Exchange Item List'], [], ['Maximum Transactions', 10], [], [], [],
    ['Clan -> Fair', null, null, null, null, null, null, 'Fair -> Clan'],
    ['Buy Items','Status','Buy Silver / Gold / Coin','Buy Quantity Limit','Buy Utility','Your Sell quantity','Silver Gained','Sell Items','Status','Fair Sells Silver','Sell Quantity Limit'],
    ['Log','Normal',4,500,2000,null,0,'Log','Normal',5,400],
    ['Frame','Normal',20,100,2000,null,0,'Frame','Normal',25,80]
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Exchange List');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-fair-parser-'));
  const filePath = path.join(root, '906-04 Fair Prices.xlsx');
  XLSX.writeFile(workbook, filePath);
  try {
    const parsed = parseFairWorkbook(filePath, '906-04');
    assert.strictEqual(parsed.turnKey, '906-04');
    assert.strictEqual(parsed.maxTransactions, 10);
    assert.strictEqual(parsed.items.length, 2);
    assert.deepStrictEqual(parsed.items[0], { name:'Log', status:'Normal', sellPrice:4, sellQuantityLimit:500, purchasePrice:5, purchaseQuantityLimit:400 });
    assert.throws(() => parseFairWorkbook(filePath, '906-05'), /not a Fair month/i);
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})();

(function fairCoreRegression() {
  const skillDefinitions = [
    { name:'Woodwork', shortname:'Wd' }, { name:'Metalwork', shortname:'Mtl' }, { name:'Economics', shortname:'Eco' }
  ];
  const resultTurn = { turnKey:'906-03', units:[
    { unitCode:'0485', unitType:'Tribe', skills:{ Wd:3, Mtl:2, Eco:5 }, resources:{ 'Raw Materials':{ Log:4 }, Minerals:{ Iron:2 } } },
    { unitCode:'0485e1', unitType:'Element', skills:{}, resources:{ 'Finished Goods':{ Frame:1 } } }
  ] };
  const recipes = [
    { key:'frame', name:'Frame', primarySkill:'Woodwork', skillLevel:2, requirements:[], facilities:[], conditions:[], inputs:[{ item:'Log', quantity:1 }], output:{ item:'Frame', quantity:2 } },
    { key:'widget', name:'Widget', primarySkill:'Metalwork', skillLevel:2, requirements:[], facilities:[], conditions:[], inputs:[{ item:'Frame', quantity:2 }, { item:'Iron', quantity:1 }], output:{ item:'Widget', quantity:1 } }
  ];
  const fair = { turnKey:'906-04', turnSort:90604, maxTransactions:10, items:[
    { name:'Log', sellPrice:4, sellQuantityLimit:100, purchasePrice:5, purchaseQuantityLimit:100 },
    { name:'Frame', sellPrice:20, sellQuantityLimit:100, purchasePrice:25, purchaseQuantityLimit:100 },
    { name:'Iron', sellPrice:6, sellQuantityLimit:100, purchasePrice:8, purchaseQuantityLimit:100 },
    { name:'Widget', sellPrice:60, sellQuantityLimit:10, purchasePrice:75, purchaseQuantityLimit:10 }
  ] };

  const inventory = core.aggregateInventory(resultTurn);
  assert.strictEqual(inventory.find(row => row.key === 'LOG').quantity, 4);
  assert.strictEqual(inventory.find(row => row.key === 'FRAME').quantity, 1, 'Element holdings should be included in combined inventory');
  assert.strictEqual(core.tradeEligibility(resultTurn, skillDefinitions).status, 'allowed');

  const rows = core.buildProfitRows({ recipes, resultTurn, skillDefinitions, snapshot:fair });
  const widget = rows.find(row => row.key === 'WIDGET');
  assert(widget.craftableNow, 'Widget should be recursively craftable by making the missing Frame from Logs');
  assert.strictEqual(widget.batches, 2);
  assert.strictEqual(widget.totalProfit, 80);

  const purchaseRows = core.buildPurchaseToCraftRows({ recipes, resultTurn, skillDefinitions, snapshot:fair, snapshots:[fair] });
  const purchaseWidget = purchaseRows.find(row => row.key === 'WIDGET');
  assert.strictEqual(purchaseWidget.currentFairCost, 58);
  assert.strictEqual(purchaseWidget.profitPerBatch, 2);
  assert.strictEqual(purchaseWidget.valuation, 'estimated');

  const fair2 = JSON.parse(JSON.stringify(fair));
  fair2.turnKey = '906-10'; fair2.turnSort = 90610;
  fair2.items.find(row => row.name === 'Widget').sellPrice = 90;
  const actual = core.buildPurchaseToCraftRows({ recipes, resultTurn, skillDefinitions, snapshot:fair, snapshots:[fair,fair2] }).find(row => row.key === 'WIDGET');
  assert.strictEqual(actual.valuation, 'actual');
  assert.strictEqual(actual.valuationTurn, '906-10');
  assert.strictEqual(actual.profitPerBatch, 32);
})();

(function integrationFilesRegression() {
  const src = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  assert.match(src('bootstrap.js'), /fair-ipc/);
  assert.match(src('preload.js'), /fair:import/);
  assert.match(src('preload.js'), /fair-launcher\.js/);
  assert.match(src('fair-launcher.js'), /fair\.html/);
  assert.match(src('fair.html'), /PURCHASE → CRAFT → NEXT FAIR/i);
  assert.match(src('update-view-state.js'), /fair\.html/);
})();

console.log('Fair tool regression tests passed.');

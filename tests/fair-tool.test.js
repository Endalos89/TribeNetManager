const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const core = require('../src/fair-core');
global.TribeNetFairCore = core;
const analysis = require('../src/fair-analysis');
const fairTurns = require('../src/fair-turns');
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
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.ao_to_sheet ? XLSX.utils.ao_to_sheet(rows) : XLSX.utils.aoa_to_sheet(rows), 'Exchange List');
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

(function fairTurnSelectorRegression() {
  assert.deepStrictEqual(
    fairTurns.buildFairTurnOptions([{ turnKey:'906-03' }], []),
    ['906-04'],
    'A pre-Fair latest turn should expose only the upcoming Fair; no synthetic Fair before the known history is needed.'
  );
  assert.deepStrictEqual(
    fairTurns.buildFairTurnOptions([{ turnKey:'906-08' }, { turnKey:'906-03' }], []),
    ['906-04','906-10'],
    'Only Month 04/10 turns should appear, including one Fair after the latest known turn.'
  );
  assert.deepStrictEqual(
    fairTurns.buildFairTurnOptions([{ turnKey:'906-10' }, { turnKey:'906-04' }], []),
    ['906-04','906-10','907-04'],
    'If the known range ends on a Fair, the selector should still include the next Fair but not invent an earlier one.'
  );
  assert.strictEqual(fairTurns.fairAtOrAfter('906-03'), '906-04');
  assert.strictEqual(fairTurns.fairAtOrAfter('906-04'), '906-04');
  assert.strictEqual(fairTurns.fairAtOrAfter('906-11'), '907-04');
})();

(function fairCoreRegression() {
  const skillDefinitions = [
    { name:'Woodwork', shortname:'Wd' }, { name:'Metalwork', shortname:'Mtl' }, { name:'Economics', shortname:'Eco' },
    { name:'Forestry', shortname:'For' }, { name:'Mining', shortname:'Min' }
  ];
  const resultTurn = { turnKey:'906-03', units:[
    { unitCode:'0485', unitType:'Tribe', skills:{ Wd:3, Mtl:2, Eco:5, For:1, Min:1 }, resources:{ 'Raw Materials':{ Log:4 }, Minerals:{ Iron:2 } } },
    { unitCode:'0485e1', unitType:'Element', skills:{}, resources:{ 'Finished Goods':{ Frame:1 } } }
  ] };
  const recipes = [
    { key:'source-log', name:'Fell Logs', primarySkill:'Forestry', skillLevel:1, requirements:[], facilities:[], conditions:['Forest or Jungle'], inputs:[], output:{ item:'Log', quantity:4 } },
    { key:'source-iron', name:'Mine Iron', primarySkill:'Mining', skillLevel:1, requirements:[], facilities:[], conditions:['Iron source'], inputs:[], output:{ item:'Iron', quantity:1 } },
    { key:'frame', name:'Frame', primarySkill:'Woodwork', skillLevel:2, requirements:[], facilities:[], conditions:[], inputs:[{ item:'Log', quantity:1 }], output:{ item:'Frame', quantity:2 } },
    { key:'widget', name:'Widget', primarySkill:'Metalwork', skillLevel:2, requirements:[], facilities:[], conditions:[], inputs:[{ item:'Frame', quantity:2 }, { item:'Iron', quantity:1 }], output:{ item:'Widget', quantity:1 } },
    { key:'wagon', name:'Wagon', primarySkill:'Woodwork', skillLevel:3, requirements:[], facilities:[], conditions:[], inputs:[{ item:'Log', quantity:6 }], output:{ item:'Wagon', quantity:1 } }
  ];
  const fair = { turnKey:'906-04', turnSort:90604, maxTransactions:10, items:[
    { name:'Log', sellPrice:4, sellQuantityLimit:1000, purchasePrice:5, purchaseQuantityLimit:1000 },
    { name:'Frame', sellPrice:20, sellQuantityLimit:100, purchasePrice:25, purchaseQuantityLimit:100 },
    { name:'Iron', sellPrice:6, sellQuantityLimit:1000, purchasePrice:8, purchaseQuantityLimit:1000 },
    { name:'Widget', sellPrice:60, sellQuantityLimit:10, purchasePrice:75, purchaseQuantityLimit:10 },
    { name:'Wagon', sellPrice:100, sellQuantityLimit:160, purchasePrice:125, purchaseQuantityLimit:120 }
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

  const sourceRows = analysis.buildProfitRows({ recipes, resultTurn, skillDefinitions, snapshot:fair });
  const wagon = sourceRows.find(row => row.key === 'WAGON');
  assert(wagon.sourceAvailable, 'Wagon should be production-available because Logs have a Forestry source.');
  assert.strictEqual(wagon.sellQuantity, 160, 'Profit planning should target the Fair quantity limit rather than current Log stock.');
  const wagonLogs = wagon.plannedInputs.find(row => row.key === 'LOG');
  assert.strictEqual(wagonLogs.quantity, 960, '160 Wagons should plan for 960 Logs.');
  assert.strictEqual(wagonLogs.sourceRecipe, 'Fell Logs');
  assert.strictEqual(wagon.inputValue, 3840, 'Planned input value should value all 960 Logs at their Fair opportunity value.');

  const behindOnSkill = JSON.parse(JSON.stringify(resultTurn));
  behindOnSkill.units[0].skills.Mtl = 0;
  const gapRows = analysis.buildProfitRows({ recipes, resultTurn:behindOnSkill, skillDefinitions, snapshot:fair });
  const gapWidget = gapRows.find(row => row.key === 'WIDGET');
  assert.strictEqual(gapWidget.skillUpsNeeded, 2, 'Profit analysis should identify how many skillups are missing across the production chain.');
  assert.strictEqual(gapWidget.craftableNow, false);
  assert.strictEqual(gapWidget.batches, 10, 'Missing skills must not suppress Fair-limit production planning.');
  assert.strictEqual(gapWidget.inputValue, 100);
  assert.strictEqual(gapWidget.totalProfit, 500, 'Profit should still be shown for recipes that are within a future skill plan.');
  assert.deepStrictEqual(analysis.sortRows([{ value:1 }, { value:3 }, { value:2 }], 'value', 'desc').map(row => row.value), [3,2,1]);
})();

(function integrationFilesRegression() {
  const src = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  assert.match(src('bootstrap.js'), /fair-ipc/);
  assert.match(src('preload.js'), /fair:import/);
  assert.match(src('preload.js'), /fair-launcher\.js/);
  assert.match(src('fair-launcher.js'), /fair\.html/);
  assert.match(src('fair.html'), /fair-analysis\.js/);
  assert.match(src('fair.html'), /fair-table-sort\.js/);
  assert.match(src('fair.html'), /sortable-th/);
  assert.match(src('fair.html'), /resourceBuyBody/);
  assert.match(src('fair.html'), /skillGapSelect/);
  assert.match(src('fair.html'), /PURCHASE → CRAFT → NEXT FAIR/i);
  assert.match(src('fair.js'), /baselineSnapshotFor/);
  assert.match(src('fair.js'), /remainingSaleTrades/);
  assert.match(src('fair.js'), /initializeCollapsibles/);
  assert.match(src('fair-table-sort.js'), /Click to sort/);
  assert.match(src('fair-table-sort.js'), /input\[type="checkbox"\]/);
  assert.match(src('fair.css'), /section-collapsed/);
  assert.match(src('fair.css'), /sortable-th/);
  assert.match(src('fair.css'), /\.fair-app\s*\{[^}]*height:100%[^}]*overflow-y:auto/s, 'Fair page must provide its own vertical scrolling because the global shell hides body overflow.');
  assert.match(src('update-view-state.js'), /fair\.html/);
})();

delete global.TribeNetFairCore;
console.log('Fair tool regression tests passed.');

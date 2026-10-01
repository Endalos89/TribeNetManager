const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const hotspots = require('../src/fairground-hotspots');
const itemIcons = require('../src/fair-item-icons');
const { parseFairWorkbook, parseSupplementalSheets } = require('../src/fair-parser');

(function hotspotRegression() {
  assert.strictEqual(hotspots.HOTSPOTS.length, 8, 'Fairground should expose the eight agreed hotspots.');
  assert.deepStrictEqual(
    hotspots.HOTSPOTS.map(row => row.id),
    ['scholar','fairmaster','caravan','market','workshop','pavilion','storehouse','trading-wagon']
  );
  assert.strictEqual(hotspots.getHotspot('pavilion').sheetKey, 'culturalActivities');
  assert.strictEqual(hotspots.getHotspot('scholar').sheetKey, 'researchSpecials');
})();

(function iconRegression() {
  assert.strictEqual(itemIcons.iconFor('Logs'), '🪵');
  assert.strictEqual(itemIcons.iconFor('Wagon'), '🛒');
  assert.strictEqual(itemIcons.iconFor('Iron'), '⛓️');
  assert.strictEqual(itemIcons.iconFor('Fishing Boat'), '⛵');
  assert.strictEqual(itemIcons.iconFor('Unmapped Thing'), '📦');
})();

(function supplementalFairSheetsRegression() {
  const workbook = XLSX.utils.book_new();
  const exchange = [
    [906, 'Fair Exchange Item List'], [], ['Maximum Transactions', 10], [], [], [],
    ['Clan -> Fair', null, null, null, null, null, null, 'Fair -> Clan'],
    ['Buy Items','Status','Buy Silver / Gold / Coin','Buy Quantity Limit','Buy Utility','Your Sell quantity','Silver Gained','Sell Items','Status','Fair Sells Silver','Sell Quantity Limit'],
    ['Log','Normal',4,500,2000,null,0,'Log','Normal',5,400]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(exchange), 'Exchange List');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Cultural Activities'],['Activity','Skill','Benefit'],['Dance','Dance',10]]), 'Cultural Activities');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Research and Specials'],['Offer','Cost'],['Special Research',50]]), 'Research and Specials');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-fairground-'));
  const filePath = path.join(root, '906-04 Fair Prices.xlsx');
  XLSX.writeFile(workbook, filePath);
  try {
    const supplemental = parseSupplementalSheets(filePath);
    assert.strictEqual(supplemental.culturalActivities.rows[2][0], 'Dance');
    assert.strictEqual(supplemental.researchSpecials.rows[2][0], 'Special Research');
    const parsed = parseFairWorkbook(filePath, '906-04');
    assert(parsed.supplementalSheets.culturalActivities, 'Imported snapshots should carry Cultural Activities.');
    assert(parsed.supplementalSheets.researchSpecials, 'Imported snapshots should carry Research and Specials.');
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})();

(function staticIntegrationRegression() {
  const src = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  const html = src('fairground.html');
  const css = src('fairground.css');
  const gameCss = src('fairground-game.css');
  const js = src('fairground.js');
  const launcher = src('fair-launcher.js');
  const launcherImports = src('launcher-imports.js');
  const preload = src('preload.js');
  const classicManaged = src('fair-launcher-managed.js');
  const viewState = src('update-view-state.js');

  assert.match(launcher, /openFairButton/, 'Classic Fair launcher must remain available during preview.');
  assert.match(launcher, /openFairgroundButton/, 'Fairground Preview needs an additional launcher button.');
  assert.match(launcher, /launcherImportFairButton/, 'Fair workbook import belongs on the main Launcher.');
  assert.match(launcherImports, /fairnet\.importWorkbook/);
  assert.match(launcherImports, /fairAtOrAfter/);
  assert.match(launcherImports, /Replace Fair/);

  assert.match(html, /fairgroundHotspots/);
  assert.match(html, /featureContent/);
  assert.match(html, /interactionDialog/);
  assert.match(html, /fair-item-icons\.js/);
  assert.match(html, /Month 04 = Summer Fair · Month 10 = Winter Fair/);
  assert.doesNotMatch(html, /<iframe/i, 'Batch 2 must stay inside the Fairground instead of embedding another page.');
  assert.match(css, /data-season="winter"/);
  assert.match(gameCss, /market-item-card/);
  assert.match(gameCss, /interaction-dialog/);

  assert.match(js, /renderTradingWagon/);
  assert.match(js, /openTradeDialog/);
  assert.match(js, /resourceSales/);
  assert.match(js, /renderStorehouse/);
  assert.match(js, /renderMarket/);
  assert.match(js, /renderWorkshop/);
  assert.match(js, /renderPavilion/);
  assert.match(js, /renderScholar/);
  assert.match(js, /renderFairmaster/);
  assert.match(js, /renderCaravan/);
  assert.doesNotMatch(js, /fair\.html\?embed=1/, 'Fairground must not navigate into Classic Fair feature pages.');

  assert.match(preload, /fair-launcher-managed\.js/);
  assert.match(classicManaged, /Manage Fair Files on Launcher/);
  assert.match(preload, /fairground\.html/);
  assert.match(viewState, /fairground\.html/);
})();

console.log('Fairground preview regression tests passed.');

const fairState = {
  managedTurns:[], planningTurnKey:null, managedTurn:null, resultTurn:null,
  resultBaselineTurnKey:null, resultContextIsBaseline:false,
  snapshots:[], snapshotDetails:new Map(), snapshot:null, previousSnapshot:null, snapshotMode:'none',
  catalog:{ recipes:[], skills:[] }, inventory:[], profitRows:[], purchaseRows:[], changes:[],
  excluded:new Set(), resourceBuys:new Map(), buyWarning:''
};

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const core = window.TribeNetFairCore;
const analysis = window.TribeNetFairAnalysis;
const fairTurns = window.TribeNetFairTurns;

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char])); }
function number(value) { return value == null || Number.isNaN(Number(value)) ? '—' : nf.format(Number(value)); }
function silver(value) { return value == null || Number.isNaN(Number(value)) ? '—' : money.format(Number(value)); }
function pct(value) { return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`; }
function turnMonth(turnKey) { const m = String(turnKey || '').match(/\d+\D+(\d+)/); return m ? Number(m[1]) : null; }
function isFairMonth(turnKey) { return [4,10].includes(turnMonth(turnKey)); }
function emptyRow(cols, message) { return `<tr><td colspan="${cols}" class="empty-row">${escapeHtml(message)}</td></tr>`; }
function deltaHtml(value, percent = null) {
  if (value == null) return '<span class="delta-flat">—</span>';
  const n = Number(value || 0);
  const cls = n > 0 ? 'delta-up' : n < 0 ? 'delta-down' : 'delta-flat';
  return `<span class="${cls}">${escapeHtml(`${n > 0 ? '+' : ''}${silver(n)}${percent == null ? '' : ` (${pct(percent)})`}`)}</span>`;
}
function fairSnapshotFor(turnKey) { return fairState.snapshotDetails.get(String(turnKey || '')) || null; }
function parsedTurn(turnKey) { return fairTurns.parseTurnKey(turnKey); }
function maxTrades() { return Number(fairState.snapshot?.maxTransactions || 10); }
function selectedBuyTrades() { return fairState.resourceBuys.size; }
function remainingSaleTrades() { return Math.max(0, maxTrades() - selectedBuyTrades()); }
function selectValue(id, fallback = '') { return $(id)?.value || fallback; }

function baselineSnapshotFor(turnKey) {
  const target = parsedTurn(turnKey);
  if (!target) return null;
  const candidates = [...fairState.snapshotDetails.values()]
    .map(snapshot => ({ snapshot, parsed:parsedTurn(snapshot.turnKey) }))
    .filter(row => row.parsed && row.parsed.sort < target.sort)
    .sort((a,b) => b.parsed.sort - a.parsed.sort);
  return candidates[0]?.snapshot || null;
}

function initializeCollapsibles() {
  for (const panel of document.querySelectorAll('.fair-panel[data-section]')) {
    const heading = panel.querySelector(':scope > .fair-panel-heading');
    if (!heading || heading.querySelector('.collapse-button')) continue;
    const key = panel.dataset.section;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'collapse-button';
    const stored = localStorage.getItem(`tribenet:fair:collapsed:${key}`) === '1';
    if (stored) panel.classList.add('section-collapsed');
    const sync = () => {
      const collapsed = panel.classList.contains('section-collapsed');
      button.textContent = collapsed ? '＋' : '−';
      button.title = collapsed ? 'Expand section' : 'Minimize section';
      button.setAttribute('aria-expanded', String(!collapsed));
    };
    button.addEventListener('click', () => {
      panel.classList.toggle('section-collapsed');
      localStorage.setItem(`tribenet:fair:collapsed:${key}`, panel.classList.contains('section-collapsed') ? '1' : '0');
      sync();
    });
    heading.appendChild(button); sync();
  }
}

async function initializeFair() {
  initializeCollapsibles();
  bindEvents();
  try {
    const version = await window.tribenet.getVersion();
    $('fairVersion').textContent = `Version ${version} · Fair planning, pricing and crafting`;
  } catch (_) {}
  fairState.catalog = await window.fairnet.getCraftingCatalog();
  await refreshSnapshots();
  await refreshPlanningTurns();
  await reportView();
}

function bindEvents() {
  $('backLauncherButton').addEventListener('click', () => { window.location.href = 'index.html'; });
  $('backupFairButton').addEventListener('click', async () => {
    const path = await window.fairnet.backup();
    $('fairUploadStatus').textContent = path ? 'Fair database backup created.' : 'Could not create backup.';
  });
  $('planningTurnSelect').addEventListener('change', () => selectPlanningTurn($('planningTurnSelect').value));
  $('fairSnapshotSelect').addEventListener('change', () => selectSnapshot($('fairSnapshotSelect').value));
  $('importFairButton').addEventListener('click', importFairWorkbook);
  for (const id of ['priceChangeSearch','inventorySearch','profitSearch','purchaseSearch','resourceBuySearch']) $(id).addEventListener('input', renderTables);
  for (const id of ['positiveProfitToggle','purchasePositiveToggle']) $(id).addEventListener('change', renderTables);
  for (const id of ['skillGapSelect','priceSortField','priceSortDirection','inventorySortField','inventorySortDirection','resourceBuySortField','resourceBuySortDirection','profitSortField','profitSortDirection','purchaseSortField','purchaseSortDirection']) {
    $(id).addEventListener('change', renderTables);
  }
}

async function reportView() {
  try { await window.tribenet.reportCurrentView({ page:'fair.html', screen:'fair', turnKey:fairState.planningTurnKey, fairTurnKey:fairState.snapshot?.turnKey || null }); }
  catch (_) {}
}

async function refreshSnapshots(preferredTurnKey = null) {
  fairState.snapshots = await window.fairnet.listSnapshots();
  fairState.snapshotDetails.clear();
  for (const summary of fairState.snapshots) {
    const detail = await window.fairnet.getSnapshot(summary.turnKey);
    if (detail) fairState.snapshotDetails.set(summary.turnKey, detail);
  }
  $('fairCountMetric').textContent = number(fairState.snapshots.length);
  const select = $('fairSnapshotSelect');
  select.innerHTML = '<option value="">No Fair workbook selected</option>' + [...fairState.snapshots].reverse().map(row =>
    `<option value="${escapeHtml(row.turnKey)}">${escapeHtml(row.turnKey)} · ${escapeHtml(row.sourceFile)}</option>`
  ).join('');
  if (preferredTurnKey && fairState.snapshotDetails.has(preferredTurnKey)) select.value = preferredTurnKey;
}

async function refreshPlanningTurns() {
  fairState.managedTurns = await window.tribenet.listManagedTurns();
  const options = fairTurns.buildFairTurnOptions(fairState.managedTurns, fairState.snapshots);
  const select = $('planningTurnSelect');
  select.innerHTML = options.length
    ? options.map(turnKey => `<option value="${escapeHtml(turnKey)}">Turn ${escapeHtml(turnKey)}</option>`).join('')
    : '<option value="">No Fair turns available</option>';
  if (!options.length) return selectPlanningTurn('');

  const stored = localStorage.getItem('tribenet:fair:planningTurn');
  const managedParsed = fairState.managedTurns.map(row => parsedTurn(row.turnKey)).filter(Boolean).sort((a,b) => a.sort - b.sort);
  const latestManaged = managedParsed.at(-1);
  const suggested = latestManaged ? fairTurns.fairAtOrAfter(latestManaged.turnKey) : options.at(-1);
  const preferred = options.includes(stored) ? stored : options.includes(suggested) ? suggested : options.at(-1);
  select.value = preferred;
  await selectPlanningTurn(preferred);
}

async function loadResultContext(turnKey) {
  fairState.managedTurn = null;
  fairState.resultTurn = null;
  fairState.resultBaselineTurnKey = null;
  fairState.resultContextIsBaseline = false;
  if (!turnKey) return;

  const exact = await window.tribenet.getManagedTurn(turnKey);
  let selectedTurnKey = turnKey;
  let managed = exact;
  if (!managed) {
    const target = parsedTurn(turnKey);
    const prior = fairState.managedTurns
      .map(row => ({ row, parsed:parsedTurn(row.turnKey) }))
      .filter(entry => entry.parsed && target && entry.parsed.sort <= target.sort)
      .sort((a,b) => b.parsed.sort - a.parsed.sort)[0];
    if (prior) {
      selectedTurnKey = prior.row.turnKey;
      managed = await window.tribenet.getManagedTurn(selectedTurnKey);
      fairState.resultContextIsBaseline = selectedTurnKey !== turnKey;
    }
  }
  fairState.managedTurn = managed;
  fairState.resultBaselineTurnKey = managed ? selectedTurnKey : null;
  const resultKey = managed?.start?.data?.resultTurnKey;
  if (resultKey) fairState.resultTurn = await window.tribenet.getResultTurn(resultKey);
}

async function selectPlanningTurn(turnKey) {
  fairState.planningTurnKey = turnKey || null;
  if (turnKey) localStorage.setItem('tribenet:fair:planningTurn', turnKey);
  await loadResultContext(turnKey);

  const matching = fairSnapshotFor(turnKey);
  if (matching) {
    fairState.snapshot = matching;
    fairState.snapshotMode = 'exact';
  } else {
    fairState.snapshot = baselineSnapshotFor(turnKey);
    fairState.snapshotMode = fairState.snapshot ? 'baseline' : 'none';
  }
  $('fairSnapshotSelect').value = fairState.snapshot?.turnKey || '';
  updatePreviousSnapshot();
  loadExcluded();
  loadResourceBuys();
  recalculate();
  renderAll();
  await reportView();
}

async function selectSnapshot(turnKey) {
  fairState.snapshot = turnKey ? fairSnapshotFor(turnKey) : null;
  fairState.snapshotMode = fairState.snapshot ? (turnKey === fairState.planningTurnKey ? 'exact' : 'manual') : 'none';
  updatePreviousSnapshot();
  recalculate();
  renderAll();
  await reportView();
}

function updatePreviousSnapshot() {
  fairState.previousSnapshot = null;
  if (!fairState.snapshot) return;
  const ordered = [...fairState.snapshots].sort((a,b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
  const index = ordered.findIndex(row => row.turnKey === fairState.snapshot.turnKey);
  if (index > 0) fairState.previousSnapshot = fairSnapshotFor(ordered[index - 1].turnKey);
}

async function importFairWorkbook() {
  if (!fairState.planningTurnKey || !isFairMonth(fairState.planningTurnKey)) return;
  $('fairUploadStatus').textContent = 'Importing…';
  const result = await window.fairnet.importWorkbook(fairState.planningTurnKey);
  if (result.canceled) { $('fairUploadStatus').textContent = 'Import cancelled.'; return; }
  if (result.error) { $('fairUploadStatus').textContent = result.error; return; }
  $('fairUploadStatus').textContent = `${result.snapshot.sourceFile} saved for ${result.snapshot.turnKey}.`;
  await refreshSnapshots(result.snapshot.turnKey);
  await selectPlanningTurn(fairState.planningTurnKey);
}

function planningStorageKey(name) { return `tribenet:fair:${name}:${fairState.planningTurnKey || 'none'}`; }
function loadExcluded() {
  fairState.excluded = new Set();
  try { fairState.excluded = new Set(JSON.parse(localStorage.getItem(planningStorageKey('excluded')) || '[]')); }
  catch (_) {}
}
function saveExcluded() { localStorage.setItem(planningStorageKey('excluded'), JSON.stringify([...fairState.excluded])); }
function loadResourceBuys() {
  fairState.resourceBuys = new Map(); fairState.buyWarning = '';
  try {
    const rows = JSON.parse(localStorage.getItem(planningStorageKey('resourceBuys')) || '[]');
    for (const row of Array.isArray(rows) ? rows : []) if (row?.key) fairState.resourceBuys.set(row.key, { quantity:Number(row.quantity || 0), all:Boolean(row.all) });
  } catch (_) {}
}
function saveResourceBuys() { localStorage.setItem(planningStorageKey('resourceBuys'), JSON.stringify([...fairState.resourceBuys].map(([key,value]) => ({ key, ...value })))); }

function recalculate() {
  fairState.inventory = core.aggregateInventory(fairState.resultTurn);
  $('inventoryCountMetric').textContent = number(fairState.inventory.length);
  if (!fairState.snapshot) { fairState.profitRows = []; fairState.purchaseRows = []; fairState.changes = []; return; }
  fairState.profitRows = analysis.buildProfitRows({ recipes:fairState.catalog.recipes, resultTurn:fairState.resultTurn, skillDefinitions:fairState.catalog.skills, snapshot:fairState.snapshot });
  fairState.purchaseRows = core.buildPurchaseToCraftRows({ recipes:fairState.catalog.recipes, resultTurn:fairState.resultTurn, skillDefinitions:fairState.catalog.skills, snapshot:fairState.snapshot, snapshots:[...fairState.snapshotDetails.values()] });
  fairState.changes = core.compareFairItems(fairState.snapshot, fairState.previousSnapshot);
}

function renderAll() { renderContext(); renderSnapshotContext(); renderTables(); }
function renderContext() {
  const turn = fairState.planningTurnKey;
  const matching = fairSnapshotFor(turn);
  $('importFairButton').disabled = !isFairMonth(turn);
  $('importFairButton').textContent = matching ? `Replace ${turn} Fair Workbook` : 'Upload Fair Workbook';
  if (!turn) $('planningTurnNote').textContent = 'Import Results first. Fair upload slots will then be generated from your known turn range.';
  else if (matching) $('planningTurnNote').innerHTML = `<strong>Turn ${escapeHtml(turn)} has Fair data.</strong> Workbook uploaded: ${escapeHtml(matching.sourceFile)}.`;
  else if (fairState.snapshotMode === 'baseline') $('planningTurnNote').innerHTML = `<strong>Turn ${escapeHtml(turn)} has no Fair workbook yet.</strong> Prices are using Fair ${escapeHtml(fairState.snapshot.turnKey)} as the baseline until you upload the new workbook.`;
  else $('planningTurnNote').innerHTML = `<strong>Turn ${escapeHtml(turn)} is the next Fair upload slot.</strong> Upload the workbook when it is issued.`;

  const eligibility = fairState.resultTurn ? core.tradeEligibility(fairState.resultTurn, fairState.catalog.skills) : null;
  const banner = $('tradeEligibility');
  banner.className = `trade-banner ${eligibility?.status || 'neutral'}`;
  if (eligibility) banner.textContent = `${eligibility.message}${fairState.resultContextIsBaseline ? ` Using latest available Results baseline from planning turn ${fairState.resultBaselineTurnKey}.` : ''}`;
  else banner.textContent = 'No Results baseline is available yet for this Fair turn.';
}
function renderSnapshotContext() {
  const snapshot = fairState.snapshot;
  $('maxTradesMetric').textContent = number(maxTrades());
  if (!snapshot) { $('snapshotNote').textContent = 'No Fair workbook or earlier Fair baseline is available.'; return; }
  if (fairState.snapshotMode === 'baseline') {
    $('snapshotNote').innerHTML = `<strong>Baseline pricing:</strong> Fair ${escapeHtml(snapshot.turnKey)} (${escapeHtml(snapshot.sourceFile)}) is standing in for upcoming Fair ${escapeHtml(fairState.planningTurnKey)} until its workbook arrives.`;
    return;
  }
  const relationship = snapshot.turnKey === fairState.planningTurnKey ? 'Prices match the selected Fair turn.' : `Viewing historical Fair ${snapshot.turnKey} while planning ${fairState.planningTurnKey}.`;
  $('snapshotNote').textContent = `${snapshot.sourceFile} · ${snapshot.items.length} items · ${snapshot.maxTransactions} maximum trades. ${relationship}`;
}
function renderTables() { renderPriceChanges(); renderInventory(); renderResourceBuys(); renderProfit(); renderPurchaseCraft(); }

function renderPriceChanges() {
  const body = $('priceChangeBody');
  if (!fairState.snapshot) { body.innerHTML = emptyRow(7, 'Select or upload a Fair workbook.'); $('priceChangeSummary').textContent = ''; return; }
  if (fairState.snapshotMode === 'baseline') $('priceChangeSummary').textContent = `Upcoming Fair ${fairState.planningTurnKey} has no workbook yet. Market movement below is the latest known movement through baseline Fair ${fairState.snapshot.turnKey}.`;
  else if (!fairState.previousSnapshot) $('priceChangeSummary').textContent = `Fair ${fairState.snapshot.turnKey} is the first saved Fair, so it is the price-change baseline.`;
  else {
    const changed = fairState.changes.filter(row => Number(row.sellDelta || 0) !== 0 || Number(row.purchaseDelta || 0) !== 0).length;
    $('priceChangeSummary').textContent = `${changed} items changed between Fair ${fairState.previousSnapshot.turnKey} and ${fairState.snapshot.turnKey}.`;
  }
  const search = $('priceChangeSearch').value.trim().toLowerCase();
  let rows = fairState.changes.filter(row => !search || row.name.toLowerCase().includes(search));
  rows = analysis.sortRows(rows, selectValue('priceSortField','sellDeltaPct'), selectValue('priceSortDirection','desc'));
  body.innerHTML = rows.length ? rows.map(row => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td class="number">${silver(row.sellPrice)}</td><td class="number">${silver(row.oldSellPrice)}</td><td>${deltaHtml(row.sellDelta, row.sellDeltaPct)}</td><td class="number">${silver(row.purchasePrice)}</td><td class="number">${silver(row.oldPurchasePrice)}</td><td>${deltaHtml(row.purchaseDelta, row.purchaseDeltaPct)}</td></tr>`).join('') : emptyRow(7, 'No matching items.');
}

function inventoryRows() {
  const fairMap = core.fairItemMap(fairState.snapshot);
  const changeMap = new Map(fairState.changes.map(row => [row.key,row]));
  return fairState.inventory.map(row => {
    const fair = fairMap.get(row.key);
    const sellPrice = fair && Number(fair.sellPrice) > 0 ? Number(fair.sellPrice) : null;
    const limit = fair && Number(fair.sellQuantityLimit) >= 0 ? Number(fair.sellQuantityLimit) : null;
    const sellQty = sellPrice == null ? 0 : Math.min(row.quantity, limit != null && limit > 0 ? limit : row.quantity);
    const change = changeMap.get(row.key);
    return { ...row, fair, sellPrice, limit, sellQty, potentialSale:sellPrice == null ? null : sellQty * sellPrice, change:Number(change?.sellDeltaPct ?? 0), changeRow:change };
  });
}

function renderInventory() {
  const body = $('inventoryBody');
  const resultKey = fairState.managedTurn?.start?.data?.resultTurnKey;
  $('inventoryContext').textContent = fairState.resultTurn ? `Combined holdings from all units in Results ${resultKey || fairState.resultTurn.turnKey}.${fairState.resultContextIsBaseline ? ` This is the latest available baseline for upcoming Fair ${fairState.planningTurnKey}.` : ''} You can use the per-unit breakdown to arrange transfers before the Fair.` : 'No Results inventory baseline is available for this Fair turn.';
  if (!fairState.resultTurn) { body.innerHTML = emptyRow(7, 'No Results inventory available.'); return; }
  const search = $('inventorySearch').value.trim().toLowerCase();
  let rows = inventoryRows().filter(row => !search || row.name.toLowerCase().includes(search));
  rows = analysis.sortRows(rows, selectValue('inventorySortField','potentialSale'), selectValue('inventorySortDirection','desc'));
  body.innerHTML = rows.length ? rows.map(row => {
    const breakdown = row.breakdown.map(part => `<div>${escapeHtml(part.unitCode)} · ${escapeHtml(part.section)} · ${number(part.quantity)}</div>`).join('');
    return `<tr><td><strong>${escapeHtml(row.fair?.name || row.name)}</strong></td><td class="number">${number(row.quantity)}</td><td class="number">${silver(row.sellPrice)}</td><td class="number">${number(row.limit)}</td><td class="number">${silver(row.potentialSale)}${row.sellPrice != null && row.sellQty < row.quantity ? `<br><small>${number(row.sellQty)} saleable</small>` : ''}</td><td>${row.changeRow ? deltaHtml(row.changeRow.sellDelta, row.changeRow.sellDeltaPct) : '<span class="delta-flat">—</span>'}</td><td><details class="fair-breakdown"><summary>${row.breakdown.length} location${row.breakdown.length === 1 ? '' : 's'}</summary>${breakdown}</details></td></tr>`;
  }).join('') : emptyRow(7, 'No matching holdings.');
}

function purchasableResources() {
  return (fairState.snapshot?.items || []).filter(item => Number(item.purchasePrice) > 0 && Number(item.purchaseQuantityLimit) !== 0).map(item => ({ ...item, key:core.itemKey(item.name) }));
}
function resourceBuySpend() {
  const map = new Map(purchasableResources().map(row => [row.key,row]));
  let total = 0;
  for (const [key,selection] of fairState.resourceBuys) {
    const row = map.get(key); if (!row) continue;
    const limit = Math.max(0, Number(row.purchaseQuantityLimit || 0));
    const qty = selection.all ? limit : Math.min(limit || Number(selection.quantity || 0), Math.max(0, Number(selection.quantity || 0)));
    total += qty * Number(row.purchasePrice || 0);
  }
  return total;
}
function renderResourceBuys() {
  const body = $('resourceBuyBody');
  if (!fairState.snapshot) { body.innerHTML = emptyRow(7, 'No Fair price baseline available.'); $('resourceBuySummary').innerHTML = ''; return; }
  const selected = selectedBuyTrades();
  const remaining = Math.max(0, maxTrades() - selected);
  $('resourceBuySummary').innerHTML = `<div><span>Buy trades selected</span><strong>${selected} / ${maxTrades()}</strong></div><div><span>Trades remaining</span><strong>${remaining}</strong></div><div><span>Planned spend</span><strong>${silver(resourceBuySpend())} Silver</strong></div>${fairState.buyWarning ? `<div class="trade-over-cap"><span>Trade limit</span><strong>${escapeHtml(fairState.buyWarning)}</strong></div>` : ''}`;
  const search = $('resourceBuySearch').value.trim().toLowerCase();
  let rows = purchasableResources().filter(row => !search || row.name.toLowerCase().includes(search));
  rows = analysis.sortRows(rows, selectValue('resourceBuySortField','purchasePrice'), selectValue('resourceBuySortDirection','asc'));
  body.innerHTML = rows.length ? rows.map(row => {
    const selection = fairState.resourceBuys.get(row.key);
    const checked = Boolean(selection);
    const limit = Math.max(0, Number(row.purchaseQuantityLimit || 0));
    const qty = selection?.all ? limit : Number(selection?.quantity || 0);
    const spend = checked ? qty * Number(row.purchasePrice || 0) : 0;
    return `<tr><td><input class="resource-buy-select" type="checkbox" data-key="${escapeHtml(row.key)}" ${checked ? 'checked' : ''}></td><td><strong>${escapeHtml(row.name)}</strong></td><td class="number">${silver(row.purchasePrice)}</td><td class="number">${number(limit)}</td><td><input class="resource-buy-quantity" type="number" min="0" max="${escapeHtml(limit)}" step="1" data-key="${escapeHtml(row.key)}" value="${escapeHtml(qty || '')}" ${selection?.all ? 'disabled' : ''}></td><td><input class="resource-buy-all" type="checkbox" data-key="${escapeHtml(row.key)}" ${selection?.all ? 'checked' : ''}></td><td class="number">${checked ? silver(spend) : '—'}</td></tr>`;
  }).join('') : emptyRow(7, 'No matching resources available to buy.');

  body.querySelectorAll('.resource-buy-select').forEach(input => input.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key;
    if (event.currentTarget.checked) {
      if (!fairState.resourceBuys.has(key) && selectedBuyTrades() >= maxTrades()) {
        event.currentTarget.checked = false; fairState.buyWarning = `Maximum ${maxTrades()} trades already selected.`; renderResourceBuys(); return;
      }
      const row = purchasableResources().find(item => item.key === key);
      fairState.resourceBuys.set(key, { quantity:Math.min(1, Number(row?.purchaseQuantityLimit || 1)), all:false });
    } else fairState.resourceBuys.delete(key);
    fairState.buyWarning = ''; saveResourceBuys(); renderTables();
  }));
  body.querySelectorAll('.resource-buy-quantity').forEach(input => input.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key;
    const row = purchasableResources().find(item => item.key === key); if (!row) return;
    const limit = Math.max(0, Number(row.purchaseQuantityLimit || 0));
    const quantity = Math.min(limit, Math.max(0, Number(event.currentTarget.value || 0)));
    if (!fairState.resourceBuys.has(key)) {
      if (quantity <= 0) return;
      if (selectedBuyTrades() >= maxTrades()) { fairState.buyWarning = `Maximum ${maxTrades()} trades already selected.`; renderResourceBuys(); return; }
    }
    if (quantity <= 0) fairState.resourceBuys.delete(key); else fairState.resourceBuys.set(key, { quantity, all:false });
    fairState.buyWarning = ''; saveResourceBuys(); renderTables();
  }));
  body.querySelectorAll('.resource-buy-all').forEach(input => input.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key;
    if (event.currentTarget.checked && !fairState.resourceBuys.has(key) && selectedBuyTrades() >= maxTrades()) {
      event.currentTarget.checked = false; fairState.buyWarning = `Maximum ${maxTrades()} trades already selected.`; renderResourceBuys(); return;
    }
    if (event.currentTarget.checked) fairState.resourceBuys.set(key, { quantity:0, all:true });
    else if (fairState.resourceBuys.has(key)) fairState.resourceBuys.set(key, { quantity:fairState.resourceBuys.get(key).quantity || 1, all:false });
    fairState.buyWarning = ''; saveResourceBuys(); renderTables();
  }));
}

function skillAllowed(row, limit) {
  if (row.skillUpsNeeded == null) return limit >= 999;
  return row.skillUpsNeeded <= limit;
}
function renderProfit() {
  const body = $('profitBody');
  if (!fairState.snapshot || !fairState.resultTurn) { body.innerHTML = emptyRow(10, 'Select Fair prices and a Fair turn with Results inventory.'); $('profitSummary').innerHTML = ''; $('plannedTradesMetric').textContent = number(selectedBuyTrades()); return; }
  const skillLimit = Number(selectValue('skillGapSelect','0'));
  const positiveOnly = $('positiveProfitToggle').checked;
  const search = $('profitSearch').value.trim().toLowerCase();
  let visible = fairState.profitRows.filter(row => skillAllowed(row, skillLimit) && (!positiveOnly || Number(row.totalProfit || 0) > 0) && (!search || row.item.toLowerCase().includes(search) || String(row.recipeName || '').toLowerCase().includes(search)));
  visible = analysis.sortRows(visible, selectValue('profitSortField','totalProfit'), selectValue('profitSortDirection','desc'));

  const saleSlots = remainingSaleTrades();
  const eligibleTop = fairState.profitRows.filter(row => skillAllowed(row, skillLimit) && !fairState.excluded.has(row.key) && row.totalProfit != null);
  const topSelected = analysis.sortRows(eligibleTop, 'totalProfit', 'desc').slice(0, saleSlots);
  const topKeys = new Set(topSelected.map(row => row.key));
  const topProfit = topSelected.reduce((sum,row) => sum + Number(row.totalProfit || 0), 0);
  const planned = selectedBuyTrades() + topSelected.length;
  $('plannedTradesMetric').textContent = number(planned);
  $('profitSummary').innerHTML = `<div><span>Buy trades reserved</span><strong>${selectedBuyTrades()} / ${maxTrades()}</strong></div><div><span>Sale slots remaining</span><strong>${saleSlots}</strong></div><div><span>Best sales selected</span><strong>${topSelected.length}</strong></div><div><span>Standalone sale profit</span><strong>${silver(topProfit)} Silver</strong></div>`;

  body.innerHTML = visible.length ? visible.map(row => {
    const included = !fairState.excluded.has(row.key);
    const consumed = (row.consumedInputs || []).map(part => `${part.key} ${number(part.quantity)}`).join(', ');
    const missing = (row.missingSkills || []).map(skill => `${skill.skill} ${skill.current}→${skill.required}`).join(', ');
    let skillLabel = row.skillUpsNeeded === 0 ? `<span class="status-pill good">Current skills</span>` : row.skillUpsNeeded == null ? `<span class="status-pill bad">Skills unknown</span>` : `<span class="status-pill warn">${row.skillUpsNeeded} skillup${row.skillUpsNeeded === 1 ? '' : 's'}</span>`;
    if (row.contextBlocked) skillLabel += ' <span class="status-pill warn">Check facility/location</span>';
    const inputValue = row.inputValueComplete ? silver(row.inputValue) : `${silver(row.inputValue)}*`;
    const unavailableClass = row.totalProfit == null ? 'unavailable' : '';
    return `<tr class="${topKeys.has(row.key) && included ? 'top-trade ' : ''}${unavailableClass}"><td><input class="profit-include" type="checkbox" data-key="${escapeHtml(row.key)}" ${included ? 'checked' : ''} aria-label="Include ${escapeHtml(row.item)}" /></td><td>${topKeys.has(row.key) && included ? '<span class="status-pill good">Selected</span>' : '—'}</td><td><strong>${escapeHtml(row.item)}</strong></td><td>${skillLabel}${missing ? `<br><small>${escapeHtml(missing)}</small>` : ''}</td><td>${escapeHtml(row.recipeName || '—')}<br><small title="${escapeHtml(consumed)}">${consumed ? escapeHtml(consumed) : escapeHtml(row.reason || '')}</small></td><td class="number">${silver(row.sellPrice)}</td><td class="number">${number(row.sellQuantity)}</td><td class="number">${inputValue}${row.unpricedInputs?.length ? `<br><small>unpriced: ${escapeHtml(row.unpricedInputs.join(', '))}</small>` : ''}</td><td class="number">${silver(row.profitEach)}</td><td class="number">${silver(row.totalProfit)}</td></tr>`;
  }).join('') : emptyRow(10, 'No crafting rows match these filters.');
  body.querySelectorAll('.profit-include').forEach(input => input.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key;
    if (event.currentTarget.checked) fairState.excluded.delete(key); else fairState.excluded.add(key);
    saveExcluded(); renderProfit();
  }));
}

function renderPurchaseCraft() {
  const body = $('purchaseCraftBody');
  if (!fairState.snapshot || !fairState.resultTurn) { body.innerHTML = emptyRow(10, 'Select Fair prices and a Fair turn with Tribe skills.'); $('purchaseCraftNote').textContent = ''; return; }
  const next = core.nextFairSnapshot(fairState.snapshot, [...fairState.snapshotDetails.values()]);
  if (fairState.snapshotMode === 'baseline') $('purchaseCraftNote').textContent = `Upcoming Fair ${fairState.planningTurnKey} has no workbook yet, so purchase costs use Fair ${fairState.snapshot.turnKey} as the baseline. Future sale values remain estimates unless a later actual Fair workbook is available.`;
  else $('purchaseCraftNote').textContent = next ? `Using actual sell prices from the next saved Fair, ${next.turnKey}. Purchase quantity limits come from ${fairState.snapshot.turnKey}. Rows are standalone opportunities and do not allocate shared Fair limits across several plans.` : `No later Fair is saved yet. The next-Fair sell value is estimated using ${fairState.snapshot.turnKey}'s current sell price and will switch to actual prices automatically when the next workbook is uploaded.`;
  const positiveOnly = $('purchasePositiveToggle').checked;
  const search = $('purchaseSearch').value.trim().toLowerCase();
  let rows = fairState.purchaseRows.filter(row => (!positiveOnly || row.profitPerBatch > 0) && (!search || row.item.toLowerCase().includes(search) || String(row.recipeName || '').toLowerCase().includes(search)));
  rows = analysis.sortRows(rows, selectValue('purchaseSortField','profitPerBatch'), selectValue('purchaseSortDirection','desc'));
  body.innerHTML = rows.length ? rows.map(row => {
    const inputs = row.purchases.map(input => `<div>${escapeHtml(input.name)} × ${number(input.quantity)} @ ${silver(input.unitPrice)}</div>`).join('');
    const valuation = row.valuation === 'actual' ? `<span class="status-pill good">Actual ${escapeHtml(row.valuationTurn)}</span>` : '<span class="status-pill warn">Estimated</span>';
    return `<tr><td><strong>${escapeHtml(row.item)}</strong><br><small>${escapeHtml(row.recipeName)}</small></td><td class="fair-input-list">${inputs}</td><td class="number">${silver(row.currentFairCost)}</td><td class="number">${number(row.outputQuantity)}</td><td class="number">${silver(row.nextSellPrice)}<br>${valuation}</td><td class="number ${row.profitPerBatch > 0 ? 'delta-up' : row.profitPerBatch < 0 ? 'delta-down' : ''}">${silver(row.profitPerBatch)}</td><td class="number">${row.roi == null ? '—' : pct(row.roi * 100)}</td><td class="number">${number(row.maxBatches)}</td><td class="number">${silver(row.maxProfit)}</td><td class="number">${number(row.currentFairTradesNeeded)} / ${number(maxTrades())}</td></tr>`;
  }).join('') : emptyRow(10, 'No purchase-to-craft opportunities match these filters.');
}

initializeFair().catch(error => {
  console.error('Fair tool failed to initialize', error);
  $('fairUploadStatus').textContent = `Fair tool could not initialize: ${error.message || error}`;
});

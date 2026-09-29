const fairState = {
  managedTurns:[], planningTurnKey:null, managedTurn:null, resultTurn:null,
  snapshots:[], snapshotDetails:new Map(), snapshot:null, previousSnapshot:null,
  catalog:{ recipes:[], skills:[] }, inventory:[], profitRows:[], purchaseRows:[], changes:[], excluded:new Set()
};

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const core = window.TribeNetFairCore;

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

async function initializeFair() {
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
  for (const id of ['priceChangeSearch','inventorySearch','profitSearch','purchaseSearch']) $(id).addEventListener('input', renderTables);
  for (const id of ['onlyCraftableToggle','positiveProfitToggle','purchasePositiveToggle']) $(id).addEventListener('change', renderTables);
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
  const desired = preferredTurnKey || fairState.snapshot?.turnKey || fairState.snapshots.at(-1)?.turnKey || '';
  select.value = fairState.snapshotDetails.has(desired) ? desired : '';
  fairState.snapshot = select.value ? fairSnapshotFor(select.value) : null;
  updatePreviousSnapshot();
}

async function refreshPlanningTurns() {
  fairState.managedTurns = await window.tribenet.listManagedTurns();
  const select = $('planningTurnSelect');
  select.innerHTML = fairState.managedTurns.length
    ? fairState.managedTurns.map(row => `<option value="${escapeHtml(row.turnKey)}">Turn ${escapeHtml(row.turnKey)}</option>`).join('')
    : '<option value="">No planning turns available</option>';
  if (!fairState.managedTurns.length) return selectPlanningTurn('');
  const stored = localStorage.getItem('tribenet:fair:planningTurn');
  const preferred = fairState.managedTurns.some(row => row.turnKey === stored) ? stored : fairState.managedTurns[0].turnKey;
  select.value = preferred;
  await selectPlanningTurn(preferred);
}

async function selectPlanningTurn(turnKey) {
  fairState.planningTurnKey = turnKey || null;
  fairState.managedTurn = null;
  fairState.resultTurn = null;
  if (turnKey) localStorage.setItem('tribenet:fair:planningTurn', turnKey);
  if (turnKey) {
    fairState.managedTurn = await window.tribenet.getManagedTurn(turnKey);
    const resultKey = fairState.managedTurn?.start?.data?.resultTurnKey;
    if (resultKey) fairState.resultTurn = await window.tribenet.getResultTurn(resultKey);
  }
  const matching = fairSnapshotFor(turnKey);
  if (matching) {
    $('fairSnapshotSelect').value = turnKey;
    fairState.snapshot = matching;
    updatePreviousSnapshot();
  } else if (!fairState.snapshot && fairState.snapshots.length) {
    const latest = fairState.snapshots.at(-1).turnKey;
    $('fairSnapshotSelect').value = latest;
    fairState.snapshot = fairSnapshotFor(latest);
    updatePreviousSnapshot();
  }
  loadExcluded();
  recalculate();
  renderAll();
  await reportView();
}

async function selectSnapshot(turnKey) {
  fairState.snapshot = turnKey ? fairSnapshotFor(turnKey) : null;
  updatePreviousSnapshot();
  loadExcluded();
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
  loadExcluded();
  recalculate();
  renderAll();
}

function loadExcluded() {
  fairState.excluded = new Set();
  if (!fairState.snapshot) return;
  try { fairState.excluded = new Set(JSON.parse(localStorage.getItem(`tribenet:fair:excluded:${fairState.snapshot.turnKey}`) || '[]')); }
  catch (_) {}
}
function saveExcluded() {
  if (fairState.snapshot) localStorage.setItem(`tribenet:fair:excluded:${fairState.snapshot.turnKey}`, JSON.stringify([...fairState.excluded]));
}

function recalculate() {
  fairState.inventory = core.aggregateInventory(fairState.resultTurn);
  $('inventoryCountMetric').textContent = number(fairState.inventory.length);
  if (!fairState.snapshot) { fairState.profitRows = []; fairState.purchaseRows = []; fairState.changes = []; return; }
  fairState.profitRows = core.buildProfitRows({ recipes:fairState.catalog.recipes, resultTurn:fairState.resultTurn, skillDefinitions:fairState.catalog.skills, snapshot:fairState.snapshot });
  fairState.purchaseRows = core.buildPurchaseToCraftRows({ recipes:fairState.catalog.recipes, resultTurn:fairState.resultTurn, skillDefinitions:fairState.catalog.skills, snapshot:fairState.snapshot, snapshots:[...fairState.snapshotDetails.values()] });
  fairState.changes = core.compareFairItems(fairState.snapshot, fairState.previousSnapshot);
}

function renderAll() { renderContext(); renderSnapshotContext(); renderTables(); }
function renderContext() {
  const turn = fairState.planningTurnKey;
  const fairMonth = isFairMonth(turn);
  const matching = fairSnapshotFor(turn);
  $('importFairButton').disabled = !fairMonth;
  $('importFairButton').textContent = matching ? `Replace ${turn} Fair Workbook` : 'Upload Fair Workbook';
  if (!turn) $('planningTurnNote').textContent = 'Import Results first. The next planning turn will then be available here.';
  else if (fairMonth) $('planningTurnNote').innerHTML = `<strong>Turn ${escapeHtml(turn)} is a Fair month.</strong> ${matching ? `Workbook uploaded: ${escapeHtml(matching.sourceFile)}.` : 'Upload the Fair workbook when it is issued.'}`;
  else $('planningTurnNote').innerHTML = `<strong>Turn ${escapeHtml(turn)} is not a Fair month.</strong> Fair workbook uploads are enabled in Months 04 and 10.`;
  const eligibility = fairState.resultTurn ? core.tradeEligibility(fairState.resultTurn, fairState.catalog.skills) : null;
  const banner = $('tradeEligibility');
  banner.className = `trade-banner ${eligibility?.status || 'neutral'}`;
  banner.textContent = eligibility?.message || 'No beginning-of-turn Results state is available for this planning turn.';
}
function renderSnapshotContext() {
  const snapshot = fairState.snapshot;
  $('maxTradesMetric').textContent = number(snapshot?.maxTransactions || 10);
  if (!snapshot) { $('snapshotNote').textContent = 'No Fair workbook selected. Upload one in a Month 04/10 planning turn.'; return; }
  const relationship = snapshot.turnKey === fairState.planningTurnKey ? 'Prices match the selected planning turn.' : fairState.planningTurnKey ? `Valuing Turn ${fairState.planningTurnKey} holdings against Fair ${snapshot.turnKey} prices.` : '';
  $('snapshotNote').textContent = `${snapshot.sourceFile} · ${snapshot.items.length} items · ${snapshot.maxTransactions} maximum trades. ${relationship}`;
}
function renderTables() { renderPriceChanges(); renderInventory(); renderProfit(); renderPurchaseCraft(); }

function renderPriceChanges() {
  const body = $('priceChangeBody');
  if (!fairState.snapshot) { body.innerHTML = emptyRow(7, 'Select or upload a Fair workbook.'); $('priceChangeSummary').textContent = ''; return; }
  if (!fairState.previousSnapshot) $('priceChangeSummary').textContent = `Fair ${fairState.snapshot.turnKey} is the first saved Fair, so it is the price-change baseline.`;
  else {
    const changed = fairState.changes.filter(row => Number(row.sellDelta || 0) !== 0 || Number(row.purchaseDelta || 0) !== 0).length;
    $('priceChangeSummary').textContent = `${changed} items changed between Fair ${fairState.previousSnapshot.turnKey} and ${fairState.snapshot.turnKey}.`;
  }
  const search = $('priceChangeSearch').value.trim().toLowerCase();
  const rows = fairState.changes.filter(row => !search || row.name.toLowerCase().includes(search));
  body.innerHTML = rows.length ? rows.map(row => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td class="number">${silver(row.sellPrice)}</td><td class="number">${silver(row.oldSellPrice)}</td><td>${deltaHtml(row.sellDelta, row.sellDeltaPct)}</td><td class="number">${silver(row.purchasePrice)}</td><td class="number">${silver(row.oldPurchasePrice)}</td><td>${deltaHtml(row.purchaseDelta, row.purchaseDeltaPct)}</td></tr>`).join('') : emptyRow(7, 'No matching items.');
}

function renderInventory() {
  const body = $('inventoryBody');
  const resultKey = fairState.managedTurn?.start?.data?.resultTurnKey;
  $('inventoryContext').textContent = fairState.resultTurn ? `Combined holdings from all units in Results ${resultKey || fairState.resultTurn.turnKey}. You can use the per-unit breakdown to arrange transfers before the Fair.` : 'No Results inventory is available for this planning turn.';
  if (!fairState.resultTurn) { body.innerHTML = emptyRow(7, 'No Results inventory available.'); return; }
  const fairMap = core.fairItemMap(fairState.snapshot);
  const changeMap = new Map(fairState.changes.map(row => [row.key,row]));
  const search = $('inventorySearch').value.trim().toLowerCase();
  const rows = fairState.inventory.filter(row => !search || row.name.toLowerCase().includes(search));
  body.innerHTML = rows.length ? rows.map(row => {
    const fair = fairMap.get(row.key);
    const sellPrice = fair && Number(fair.sellPrice) > 0 ? Number(fair.sellPrice) : null;
    const limit = fair && Number(fair.sellQuantityLimit) >= 0 ? Number(fair.sellQuantityLimit) : null;
    const sellQty = sellPrice == null ? 0 : Math.min(row.quantity, limit != null && limit > 0 ? limit : row.quantity);
    const total = sellPrice == null ? null : sellQty * sellPrice;
    const change = changeMap.get(row.key);
    const breakdown = row.breakdown.map(part => `<div>${escapeHtml(part.unitCode)} · ${escapeHtml(part.section)} · ${number(part.quantity)}</div>`).join('');
    return `<tr><td><strong>${escapeHtml(fair?.name || row.name)}</strong></td><td class="number">${number(row.quantity)}</td><td class="number">${silver(sellPrice)}</td><td class="number">${number(limit)}</td><td class="number">${silver(total)}${sellPrice != null && sellQty < row.quantity ? `<br><small>${number(sellQty)} saleable</small>` : ''}</td><td>${change ? deltaHtml(change.sellDelta, change.sellDeltaPct) : '<span class="delta-flat">—</span>'}</td><td><details class="fair-breakdown"><summary>${row.breakdown.length} location${row.breakdown.length === 1 ? '' : 's'}</summary>${breakdown}</details></td></tr>`;
  }).join('') : emptyRow(7, 'No matching holdings.');
}

function renderProfit() {
  const body = $('profitBody');
  if (!fairState.snapshot || !fairState.resultTurn) { body.innerHTML = emptyRow(9, 'Select Fair prices and a planning turn with Results inventory.'); $('profitSummary').innerHTML = ''; return; }
  const onlyCraftable = $('onlyCraftableToggle').checked;
  const positiveOnly = $('positiveProfitToggle').checked;
  const search = $('profitSearch').value.trim().toLowerCase();
  const visible = fairState.profitRows.filter(row => (!onlyCraftable || row.craftableNow) && (!positiveOnly || Number(row.totalProfit || 0) > 0) && (!search || row.item.toLowerCase().includes(search) || String(row.recipeName || '').toLowerCase().includes(search)));
  const top = core.selectTopTrades(fairState.profitRows, fairState.excluded, fairState.snapshot.maxTransactions || 10);
  const topKeys = new Set(top.selected.map(row => row.key));
  $('profitSummary').innerHTML = `<div><span>Included craftable items</span><strong>${number(fairState.profitRows.filter(row => row.craftableNow && !fairState.excluded.has(row.key)).length)}</strong></div><div><span>Best trades selected</span><strong>${number(top.selected.length)} / ${number(fairState.snapshot.maxTransactions || 10)}</strong></div><div><span>Standalone profit total</span><strong>${silver(top.totalProfit)} Silver</strong></div>`;
  body.innerHTML = visible.length ? visible.map(row => {
    const included = !fairState.excluded.has(row.key);
    const consumed = (row.consumedInputs || []).map(part => `${part.key} ${number(part.quantity)}`).join(', ');
    const craftLabel = row.craftableNow ? `<span class="status-pill good">${escapeHtml(row.craftTribe || 'Craftable')}</span>` : `<span class="status-pill bad" title="${escapeHtml(row.reason)}">Not now</span>`;
    const inputValue = row.inputValueComplete ? silver(row.inputValue) : `${silver(row.inputValue)}*`;
    return `<tr class="${topKeys.has(row.key) && included ? 'top-trade ' : ''}${row.craftableNow ? '' : 'unavailable'}"><td><input class="profit-include" type="checkbox" data-key="${escapeHtml(row.key)}" ${included ? 'checked' : ''} aria-label="Include ${escapeHtml(row.item)}" /></td><td>${topKeys.has(row.key) && included ? '<span class="status-pill good">Top 10</span>' : '—'}</td><td><strong>${escapeHtml(row.item)}</strong><br>${craftLabel}</td><td>${escapeHtml(row.recipeName || '—')}<br><small title="${escapeHtml(consumed)}">${consumed ? escapeHtml(consumed) : escapeHtml(row.reason || '')}</small></td><td class="number">${silver(row.sellPrice)}</td><td class="number">${number(row.sellQuantity)}</td><td class="number">${inputValue}${row.unpricedInputs?.length ? `<br><small>unpriced: ${escapeHtml(row.unpricedInputs.join(', '))}</small>` : ''}</td><td class="number">${silver(row.profitEach)}</td><td class="number">${silver(row.totalProfit)}</td></tr>`;
  }).join('') : emptyRow(9, 'No crafting rows match these filters.');
  body.querySelectorAll('.profit-include').forEach(input => input.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key;
    if (event.currentTarget.checked) fairState.excluded.delete(key); else fairState.excluded.add(key);
    saveExcluded(); renderProfit();
  }));
}

function renderPurchaseCraft() {
  const body = $('purchaseCraftBody');
  if (!fairState.snapshot || !fairState.resultTurn) { body.innerHTML = emptyRow(10, 'Select Fair prices and a planning turn with Tribe skills.'); $('purchaseCraftNote').textContent = ''; return; }
  const next = core.nextFairSnapshot(fairState.snapshot, [...fairState.snapshotDetails.values()]);
  $('purchaseCraftNote').textContent = next ? `Using actual sell prices from the next saved Fair, ${next.turnKey}. Purchase quantity limits come from ${fairState.snapshot.turnKey}. Rows are standalone opportunities and do not allocate shared Fair limits across several plans.` : `No later Fair is saved yet. The next-Fair sell value is estimated using ${fairState.snapshot.turnKey}'s current sell price and will switch to actual prices automatically when the next workbook is uploaded.`;
  const positiveOnly = $('purchasePositiveToggle').checked;
  const search = $('purchaseSearch').value.trim().toLowerCase();
  const rows = fairState.purchaseRows.filter(row => (!positiveOnly || row.profitPerBatch > 0) && (!search || row.item.toLowerCase().includes(search) || String(row.recipeName || '').toLowerCase().includes(search)));
  body.innerHTML = rows.length ? rows.map(row => {
    const inputs = row.purchases.map(input => `<div>${escapeHtml(input.name)} × ${number(input.quantity)} @ ${silver(input.unitPrice)}</div>`).join('');
    const valuation = row.valuation === 'actual' ? `<span class="status-pill good">Actual ${escapeHtml(row.valuationTurn)}</span>` : '<span class="status-pill warn">Estimated</span>';
    return `<tr><td><strong>${escapeHtml(row.item)}</strong><br><small>${escapeHtml(row.recipeName)}</small></td><td class="fair-input-list">${inputs}</td><td class="number">${silver(row.currentFairCost)}</td><td class="number">${number(row.outputQuantity)}</td><td class="number">${silver(row.nextSellPrice)}<br>${valuation}</td><td class="number ${row.profitPerBatch > 0 ? 'delta-up' : row.profitPerBatch < 0 ? 'delta-down' : ''}">${silver(row.profitPerBatch)}</td><td class="number">${row.roi == null ? '—' : pct(row.roi * 100)}</td><td class="number">${number(row.maxBatches)}</td><td class="number">${silver(row.maxProfit)}</td><td class="number">${number(row.currentFairTradesNeeded)} / ${number(fairState.snapshot.maxTransactions || 10)}</td></tr>`;
  }).join('') : emptyRow(10, 'No purchase-to-craft opportunities match these filters.');
}

initializeFair().catch(error => {
  console.error('Fair tool failed to initialize', error);
  $('fairUploadStatus').textContent = `Fair tool could not initialize: ${error.message || error}`;
});

const fairgroundState = {
  managedTurns:[], planningTurnKey:null, managedTurn:null, resultTurn:null,
  resultBaselineTurnKey:null, snapshots:[], snapshotDetails:new Map(), snapshot:null,
  snapshotMode:'none', previousSnapshot:null, catalog:{ recipes:[], skills:[] },
  inventory:[], profitRows:[], purchaseRows:[], changes:[], resourceBuys:new Map(), eligibility:null
};

const $ = id => document.getElementById(id);
const core = window.TribeNetFairCore;
const analysis = window.TribeNetFairAnalysis;
const fairTurns = window.TribeNetFairTurns;
const hotspotsApi = window.TribeNetFairgroundHotspots;
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char])); }
function number(value) { return value == null || Number.isNaN(Number(value)) ? '—' : nf.format(Number(value)); }
function silver(value) { return value == null || Number.isNaN(Number(value)) ? '—' : money.format(Number(value)); }
function parsedTurn(turnKey) { return fairTurns.parseTurnKey(turnKey); }
function fairSnapshotFor(turnKey) { return fairgroundState.snapshotDetails.get(String(turnKey || '')) || null; }
function maxTrades() { return Number(fairgroundState.snapshot?.maxTransactions || 10); }
function planningStorageKey(name) { return `tribenet:fair:${name}:${fairgroundState.planningTurnKey || 'none'}`; }

function baselineSnapshotFor(turnKey) {
  const target = parsedTurn(turnKey);
  if (!target) return null;
  return [...fairgroundState.snapshotDetails.values()]
    .map(snapshot => ({ snapshot, parsed:parsedTurn(snapshot.turnKey) }))
    .filter(row => row.parsed && row.parsed.sort < target.sort)
    .sort((a,b) => b.parsed.sort - a.parsed.sort)[0]?.snapshot || null;
}

async function refreshSnapshots() {
  fairgroundState.snapshots = await window.fairnet.listSnapshots();
  fairgroundState.snapshotDetails.clear();
  for (const summary of fairgroundState.snapshots) {
    const detail = await window.fairnet.getSnapshot(summary.turnKey);
    if (detail) fairgroundState.snapshotDetails.set(summary.turnKey, detail);
  }
}

async function refreshPlanningTurns() {
  fairgroundState.managedTurns = await window.tribenet.listManagedTurns();
  const options = fairTurns.buildFairTurnOptions(fairgroundState.managedTurns, fairgroundState.snapshots);
  const select = $('fairgroundTurnSelect');
  select.innerHTML = options.length
    ? options.map(turnKey => `<option value="${escapeHtml(turnKey)}">${escapeHtml(turnKey)}</option>`).join('')
    : '<option value="">No Fair turns</option>';
  if (!options.length) return selectPlanningTurn('');
  const stored = localStorage.getItem('tribenet:fair:planningTurn');
  const managedParsed = fairgroundState.managedTurns.map(row => parsedTurn(row.turnKey)).filter(Boolean).sort((a,b) => a.sort - b.sort);
  const latest = managedParsed.at(-1);
  const suggested = latest ? fairTurns.fairAtOrAfter(latest.turnKey) : options.at(-1);
  const preferred = options.includes(stored) ? stored : options.includes(suggested) ? suggested : options.at(-1);
  select.value = preferred;
  await selectPlanningTurn(preferred);
}

async function loadResultContext(turnKey) {
  fairgroundState.managedTurn = null;
  fairgroundState.resultTurn = null;
  fairgroundState.resultBaselineTurnKey = null;
  if (!turnKey) return;
  let managed = await window.tribenet.getManagedTurn(turnKey);
  let selectedTurnKey = turnKey;
  if (!managed) {
    const target = parsedTurn(turnKey);
    const prior = fairgroundState.managedTurns
      .map(row => ({ row, parsed:parsedTurn(row.turnKey) }))
      .filter(entry => target && entry.parsed && entry.parsed.sort <= target.sort)
      .sort((a,b) => b.parsed.sort - a.parsed.sort)[0];
    if (prior) {
      selectedTurnKey = prior.row.turnKey;
      managed = await window.tribenet.getManagedTurn(selectedTurnKey);
    }
  }
  fairgroundState.managedTurn = managed;
  fairgroundState.resultBaselineTurnKey = managed ? selectedTurnKey : null;
  const resultKey = managed?.start?.data?.resultTurnKey;
  if (resultKey) fairgroundState.resultTurn = await window.tribenet.getResultTurn(resultKey);
}

function loadResourceBuys() {
  fairgroundState.resourceBuys = new Map();
  try {
    const rows = JSON.parse(localStorage.getItem(planningStorageKey('resourceBuys')) || '[]');
    for (const row of Array.isArray(rows) ? rows : []) if (row?.key) fairgroundState.resourceBuys.set(row.key, { quantity:Number(row.quantity || 0), all:Boolean(row.all) });
  } catch (_) {}
}

function resourceBuySpend() {
  const map = new Map((fairgroundState.snapshot?.items || []).map(item => [core.itemKey(item.name), item]));
  let total = 0;
  for (const [key, selection] of fairgroundState.resourceBuys) {
    const row = map.get(key); if (!row) continue;
    const limit = Math.max(0, Number(row.purchaseQuantityLimit || 0));
    const qty = selection.all ? limit : Math.min(limit || Number(selection.quantity || 0), Math.max(0, Number(selection.quantity || 0)));
    total += qty * Number(row.purchasePrice || 0);
  }
  return total;
}

function updatePreviousSnapshot() {
  fairgroundState.previousSnapshot = null;
  if (!fairgroundState.snapshot) return;
  const ordered = [...fairgroundState.snapshots].sort((a,b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
  const index = ordered.findIndex(row => row.turnKey === fairgroundState.snapshot.turnKey);
  if (index > 0) fairgroundState.previousSnapshot = fairSnapshotFor(ordered[index - 1].turnKey);
}

function recalculate() {
  fairgroundState.inventory = core.aggregateInventory(fairgroundState.resultTurn);
  if (!fairgroundState.snapshot) {
    fairgroundState.profitRows = [];
    fairgroundState.purchaseRows = [];
    fairgroundState.changes = [];
    fairgroundState.eligibility = fairgroundState.resultTurn ? core.tradeEligibility(fairgroundState.resultTurn, fairgroundState.catalog.skills) : null;
    return;
  }
  fairgroundState.profitRows = analysis.buildProfitRows({
    recipes:fairgroundState.catalog.recipes,
    resultTurn:fairgroundState.resultTurn,
    skillDefinitions:fairgroundState.catalog.skills,
    snapshot:fairgroundState.snapshot
  });
  fairgroundState.purchaseRows = core.buildPurchaseToCraftRows({
    recipes:fairgroundState.catalog.recipes,
    resultTurn:fairgroundState.resultTurn,
    skillDefinitions:fairgroundState.catalog.skills,
    snapshot:fairgroundState.snapshot,
    snapshots:[...fairgroundState.snapshotDetails.values()]
  });
  fairgroundState.changes = core.compareFairItems(fairgroundState.snapshot, fairgroundState.previousSnapshot);
  fairgroundState.eligibility = fairgroundState.resultTurn ? core.tradeEligibility(fairgroundState.resultTurn, fairgroundState.catalog.skills) : null;
}

async function selectPlanningTurn(turnKey) {
  fairgroundState.planningTurnKey = turnKey || null;
  if (turnKey) localStorage.setItem('tribenet:fair:planningTurn', turnKey);
  await loadResultContext(turnKey);
  const exact = fairSnapshotFor(turnKey);
  if (exact) {
    fairgroundState.snapshot = exact;
    fairgroundState.snapshotMode = 'exact';
  } else {
    fairgroundState.snapshot = baselineSnapshotFor(turnKey);
    fairgroundState.snapshotMode = fairgroundState.snapshot ? 'baseline' : 'none';
  }
  updatePreviousSnapshot();
  loadResourceBuys();
  recalculate();
  renderFairground();
  try { await window.tribenet.reportCurrentView({ page:'fairground.html', screen:'fairground', turnKey, fairTurnKey:fairgroundState.snapshot?.turnKey || null }); } catch (_) {}
}

function seasonForTurn(turnKey) { return parsedTurn(turnKey)?.month === 10 ? 'winter' : 'summer'; }
function seasonLabel(turnKey) { return seasonForTurn(turnKey) === 'winter' ? 'Start of Winter' : 'Start of Summer'; }

function inventoryFairValue() {
  if (!fairgroundState.snapshot) return 0;
  const prices = core.fairItemMap(fairgroundState.snapshot);
  let total = 0;
  for (const row of fairgroundState.inventory) {
    const fair = prices.get(row.key);
    if (!fair || !(Number(fair.sellPrice) > 0)) continue;
    const limit = Number(fair.sellQuantityLimit);
    const qty = Number.isFinite(limit) && limit > 0 ? Math.min(Number(row.quantity || 0), limit) : Number(row.quantity || 0);
    total += qty * Number(fair.sellPrice);
  }
  return total;
}

function sheetRows(key) { return fairgroundState.snapshot?.supplementalSheets?.[key]?.rows || []; }
function meaningfulSheetRows(key) { return sheetRows(key).filter(row => row.filter(cell => String(cell ?? '').trim() !== '').length > 1).length; }

function hotspotStatus(id) {
  const buyTrades = fairgroundState.resourceBuys.size;
  const profitable = fairgroundState.profitRows.filter(row => Number(row.totalProfit || 0) > 0);
  const currentSkills = profitable.filter(row => Number(row.skillUpsNeeded || 0) === 0).length;
  const changed = fairgroundState.changes.filter(row => Number(row.sellDelta || 0) !== 0 || Number(row.purchaseDelta || 0) !== 0).length;
  const positiveCaravan = fairgroundState.purchaseRows.filter(row => Number(row.profitPerBatch || 0) > 0).length;
  const exact = fairgroundState.snapshotMode === 'exact';
  switch (id) {
    case 'trading-wagon': return { badge:`${buyTrades}/${maxTrades()}`, status:buyTrades >= maxTrades() ? 'warn' : 'good', live:`${buyTrades} buy trade${buyTrades === 1 ? '' : 's'} selected · ${Math.max(0,maxTrades()-buyTrades)} trade slots remaining · ${silver(resourceBuySpend())} Silver planned spend` };
    case 'storehouse': return { badge:String(fairgroundState.inventory.length), status:fairgroundState.inventory.length ? 'good' : 'neutral', live:`${fairgroundState.inventory.length} goods in combined holdings · potential Fair value ${silver(inventoryFairValue())} Silver` };
    case 'market': return { badge:String(changed), status:changed ? 'good' : 'neutral', live:fairgroundState.previousSnapshot ? `${changed} prices changed since Fair ${fairgroundState.previousSnapshot.turnKey}` : 'No earlier saved Fair is available for comparison' };
    case 'workshop': return { badge:String(profitable.length), status:profitable.length ? 'good' : 'neutral', live:`${profitable.length} positive-profit production plans · ${currentSkills} with current skills · ${Math.max(0, profitable.length-currentSkills)} need skillups` };
    case 'pavilion': { const count = meaningfulSheetRows('culturalActivities'); return { badge:String(count), status:count ? 'good' : 'neutral', live:count ? `${count} populated Cultural Activities rows in the Fair workbook` : 'No Cultural Activities data found in the current Fair workbook' }; }
    case 'scholar': { const count = meaningfulSheetRows('researchSpecials'); return { badge:String(count), status:count ? 'good' : 'neutral', live:count ? `${count} populated Research and Specials rows in the Fair workbook` : 'No Research and Specials data found in the current Fair workbook' }; }
    case 'fairmaster': {
      const eligibility = fairgroundState.eligibility;
      const status = !fairgroundState.snapshot ? 'bad' : eligibility?.status === 'blocked' ? 'bad' : exact ? 'good' : 'warn';
      const badge = !fairgroundState.snapshot ? '!' : exact ? '✓' : '!';
      const price = exact ? `Workbook loaded for ${fairgroundState.planningTurnKey}` : fairgroundState.snapshot ? `Using ${fairgroundState.snapshot.turnKey} as the price baseline` : 'No Fair price workbook available';
      return { badge, status, live:`${price} · ${eligibility?.message || 'No Results baseline for Economics check'}` };
    }
    case 'caravan': {
      const actual = fairgroundState.purchaseRows.some(row => row.valuation === 'actual');
      return { badge:String(positiveCaravan), status:positiveCaravan ? 'good' : 'neutral', live:`${positiveCaravan} positive buy → craft → next Fair routes · next-Fair pricing ${actual ? 'includes actual saved prices' : 'is estimated'}` };
    }
    default: return { badge:'', status:'neutral', live:'' };
  }
}

function renderStatusRibbon() {
  const season = seasonForTurn(fairgroundState.planningTurnKey);
  document.querySelector('.fairground-app').dataset.season = season;
  $('seasonStatus').textContent = seasonLabel(fairgroundState.planningTurnKey);
  $('tradeStatus').textContent = `${fairgroundState.resourceBuys.size} / ${maxTrades()}`;
  $('spendStatus').textContent = `${silver(resourceBuySpend())} Silver`;
  const eligibility = fairgroundState.eligibility;
  $('accessStatus').textContent = eligibility ? (eligibility.status === 'allowed' ? `Economics ${eligibility.level} ✓` : eligibility.status === 'conditional' ? `Economics ${eligibility.level} ?` : `Economics ${eligibility.level} ✕`) : 'No Results baseline';
  if (fairgroundState.snapshotMode === 'exact') $('pricingStatus').textContent = `${fairgroundState.planningTurnKey} Actual`;
  else if (fairgroundState.snapshot) $('pricingStatus').textContent = `${fairgroundState.snapshot.turnKey} Baseline`;
  else $('pricingStatus').textContent = 'No Fair data';
}

function renderHotspots() {
  const layer = $('fairgroundHotspots');
  layer.innerHTML = hotspotsApi.HOTSPOTS.map(hotspot => {
    const info = hotspotStatus(hotspot.id);
    return `<button type="button" class="fairground-hotspot status-${escapeHtml(info.status)}" data-hotspot="${escapeHtml(hotspot.id)}" data-size="${escapeHtml(hotspot.size)}" style="left:${hotspot.x}%;top:${hotspot.y}%" aria-label="${escapeHtml(hotspot.label)}">
      <span class="hotspot-object" aria-hidden="true">${escapeHtml(hotspot.icon)}</span>
      <span class="hotspot-label">${escapeHtml(hotspot.shortLabel)}</span>
      ${info.badge ? `<span class="hotspot-badge">${escapeHtml(info.badge)}</span>` : ''}
    </button>`;
  }).join('');
  layer.querySelectorAll('.fairground-hotspot').forEach(button => {
    const hotspot = hotspotsApi.getHotspot(button.dataset.hotspot);
    button.addEventListener('mouseenter', event => showTooltip(hotspot, event));
    button.addEventListener('mousemove', positionTooltip);
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('focus', event => showTooltip(hotspot, event));
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', () => openHotspot(hotspot));
  });
}

function renderFairground() {
  renderStatusRibbon();
  renderHotspots();
  $('fairgroundEmptyState').classList.toggle('hidden', Boolean(fairgroundState.planningTurnKey));
}

function showTooltip(hotspot, event) {
  if (!hotspot) return;
  const info = hotspotStatus(hotspot.id);
  const tooltip = $('fairgroundTooltip');
  tooltip.innerHTML = `<strong>${escapeHtml(hotspot.icon)} ${escapeHtml(hotspot.label)}</strong><p>${escapeHtml(hotspot.description)}</p><div class="tooltip-live">${escapeHtml(info.live)}</div>`;
  tooltip.classList.remove('hidden');
  positionTooltip(event);
}
function positionTooltip(event) {
  const tooltip = $('fairgroundTooltip');
  if (tooltip.classList.contains('hidden')) return;
  const x = Math.min(window.innerWidth - 300, Math.max(12, Number(event.clientX || 20) + 16));
  const y = Math.min(window.innerHeight - 150, Math.max(72, Number(event.clientY || 80) + 16));
  tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
}
function hideTooltip() { $('fairgroundTooltip').classList.add('hidden'); }

function renderSheetPanel(hotspot) {
  const panel = $('fairSheetPanel');
  const sheet = fairgroundState.snapshot?.supplementalSheets?.[hotspot.sheetKey];
  if (!sheet?.rows?.length) {
    panel.innerHTML = `<div class="sheet-empty"><h3>No ${escapeHtml(hotspot.label)} data available</h3><p>${fairgroundState.snapshot ? `The saved ${escapeHtml(fairgroundState.snapshot.turnKey)} Fair workbook does not contain readable ${escapeHtml(sheet?.name || hotspot.label)} data.` : 'Upload a Fair workbook first.'}</p></div>`;
    return;
  }
  const width = Math.max(1, ...sheet.rows.map(row => row.length));
  let seenMulti = false;
  const body = sheet.rows.map(row => {
    const filled = row.filter(cell => String(cell ?? '').trim() !== '').length;
    if (filled === 1) {
      const text = row.find(cell => String(cell ?? '').trim() !== '') || '';
      return `<tr class="sheet-title-row"><td colspan="${width}">${escapeHtml(text)}</td></tr>`;
    }
    const headerClass = !seenMulti ? 'sheet-header-row' : '';
    if (filled > 1) seenMulti = true;
    const cells = Array.from({ length:width }, (_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('');
    return `<tr class="${headerClass}">${cells}</tr>`;
  }).join('');
  panel.innerHTML = `<div class="sheet-intro"><strong>${escapeHtml(sheet.name)}</strong> · Fair ${escapeHtml(fairgroundState.snapshot.turnKey)}. This preview preserves the workbook content while the final Fairground card treatment is developed.</div><div class="sheet-table-wrap"><table class="sheet-table"><tbody>${body}</tbody></table></div>`;
}

function openHotspot(hotspot) {
  if (!hotspot) return;
  hideTooltip();
  $('featureIcon').textContent = hotspot.icon;
  $('featureTitle').textContent = hotspot.label;
  $('featureSubtitle').textContent = hotspot.description;
  $('featureEyebrow').textContent = seasonLabel(fairgroundState.planningTurnKey).toUpperCase();
  $('featureBackdrop').classList.remove('hidden');
  $('featureDrawer').classList.remove('hidden');
  $('featureBackdrop').setAttribute('aria-hidden','false');
  $('featureDrawer').setAttribute('aria-hidden','false');
  if (hotspot.kind === 'embedded') {
    $('fairSheetPanel').classList.add('hidden');
    const frame = $('fairFeatureFrame');
    frame.classList.remove('hidden');
    const sections = hotspot.sections.join(',');
    frame.src = `fair.html?embed=1&from=fairground&sections=${encodeURIComponent(sections)}`;
  } else {
    const frame = $('fairFeatureFrame');
    frame.classList.add('hidden'); frame.src = 'about:blank';
    $('fairSheetPanel').classList.remove('hidden');
    renderSheetPanel(hotspot);
  }
}

function closeFeature() {
  $('featureBackdrop').classList.add('hidden');
  $('featureDrawer').classList.add('hidden');
  $('featureBackdrop').setAttribute('aria-hidden','true');
  $('featureDrawer').setAttribute('aria-hidden','true');
  $('fairFeatureFrame').src = 'about:blank';
}

async function refreshFromEmbeddedFair() {
  const turnKey = fairgroundState.planningTurnKey;
  await refreshSnapshots();
  await selectPlanningTurn(turnKey);
}

function bindEvents() {
  $('fairgroundLauncherButton').addEventListener('click', () => { window.location.href = 'index.html'; });
  $('classicFairButton').addEventListener('click', () => { window.location.href = 'fair.html'; });
  $('fairgroundTurnSelect').addEventListener('change', async event => {
    await selectPlanningTurn(event.currentTarget.value);
    const frame = $('fairFeatureFrame');
    if (!frame.classList.contains('hidden') && frame.src && !frame.src.endsWith('about:blank')) frame.contentWindow.location.reload();
  });
  $('closeFeatureButton').addEventListener('click', closeFeature);
  $('featureBackdrop').addEventListener('click', closeFeature);
  $('fairEntranceButton').addEventListener('click', closeFeature);
  window.addEventListener('message', event => {
    if (event.data?.type === 'tribenet:fair-state-changed') refreshFromEmbeddedFair().catch(console.error);
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeFeature(); });
}

async function initializeFairground() {
  bindEvents();
  try {
    const version = await window.tribenet.getVersion();
    $('fairgroundVersion').textContent = `Version ${version} · Interactive Fair planning preview`;
  } catch (_) {}
  fairgroundState.catalog = await window.fairnet.getCraftingCatalog();
  await refreshSnapshots();
  await refreshPlanningTurns();
}

initializeFairground().catch(error => {
  console.error('Fairground preview failed to initialize', error);
  $('pricingStatus').textContent = 'Fairground error';
  $('fairgroundEmptyState').classList.remove('hidden');
  $('fairgroundEmptyState').textContent = `Fairground preview could not initialize: ${error.message || error}`;
});

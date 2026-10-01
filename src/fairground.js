const fairgroundState = {
  managedTurns:[], planningTurnKey:null, managedTurn:null, resultTurn:null,
  resultBaselineTurnKey:null, snapshots:[], snapshotDetails:new Map(), snapshot:null,
  snapshotMode:'none', previousSnapshot:null, catalog:{ recipes:[], skills:[] },
  inventory:[], profitRows:[], purchaseRows:[], changes:[], eligibility:null,
  resourceBuys:new Map(), resourceSales:new Map(), excluded:new Set(),
  activeFeature:null, tradingTab:'buy', workshopSkillLimit:999, featureSearch:''
};

const $ = id => document.getElementById(id);
const core = window.TribeNetFairCore;
const analysis = window.TribeNetFairAnalysis;
const fairTurns = window.TribeNetFairTurns;
const hotspotsApi = window.TribeNetFairgroundHotspots;
const itemIcons = window.TribeNetFairItemIcons;
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char])); }
function number(value) { return value == null || Number.isNaN(Number(value)) ? '—' : nf.format(Number(value)); }
function silver(value) { return value == null || Number.isNaN(Number(value)) ? '—' : money.format(Number(value)); }
function pct(value) { return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`; }
function parsedTurn(turnKey) { return fairTurns.parseTurnKey(turnKey); }
function fairSnapshotFor(turnKey) { return fairgroundState.snapshotDetails.get(String(turnKey || '')) || null; }
function maxTrades() { return Number(fairgroundState.snapshot?.maxTransactions || 10); }
function planningStorageKey(name) { return `tribenet:fair:${name}:${fairgroundState.planningTurnKey || 'none'}`; }
function itemIcon(name) { return itemIcons?.iconFor(name) || '📦'; }
function itemKey(name) { return core.itemKey(name); }

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

function loadPlanningState() {
  fairgroundState.resourceBuys = new Map();
  fairgroundState.resourceSales = new Map();
  fairgroundState.excluded = new Set();
  try {
    const rows = JSON.parse(localStorage.getItem(planningStorageKey('resourceBuys')) || '[]');
    for (const row of Array.isArray(rows) ? rows : []) if (row?.key) fairgroundState.resourceBuys.set(row.key, { quantity:Number(row.quantity || 0), all:Boolean(row.all) });
  } catch (_) {}
  try {
    const rows = JSON.parse(localStorage.getItem(planningStorageKey('resourceSales')) || '[]');
    for (const row of Array.isArray(rows) ? rows : []) if (row?.key) fairgroundState.resourceSales.set(row.key, { quantity:Number(row.quantity || 0), source:String(row.source || 'stock') });
  } catch (_) {}
  try { fairgroundState.excluded = new Set(JSON.parse(localStorage.getItem(planningStorageKey('excluded')) || '[]')); }
  catch (_) {}
}
function saveResourceBuys() { localStorage.setItem(planningStorageKey('resourceBuys'), JSON.stringify([...fairgroundState.resourceBuys].map(([key,value]) => ({ key, ...value })))); }
function saveResourceSales() { localStorage.setItem(planningStorageKey('resourceSales'), JSON.stringify([...fairgroundState.resourceSales].map(([key,value]) => ({ key, ...value })))); }

function selectedTradeCount() { return fairgroundState.resourceBuys.size + fairgroundState.resourceSales.size; }
function tradesRemaining() { return Math.max(0, maxTrades() - selectedTradeCount()); }

function fairItemMap() { return core.fairItemMap(fairgroundState.snapshot); }
function inventoryMap() { return new Map(fairgroundState.inventory.map(row => [row.key,row])); }
function profitMap() { return new Map(fairgroundState.profitRows.map(row => [row.key,row])); }

function resourceBuySpend() {
  const map = fairItemMap();
  let total = 0;
  for (const [key, selection] of fairgroundState.resourceBuys) {
    const row = map.get(key); if (!row) continue;
    const limit = Math.max(0, Number(row.purchaseQuantityLimit || 0));
    const qty = selection.all ? limit : Math.min(limit || Number(selection.quantity || 0), Math.max(0, Number(selection.quantity || 0)));
    total += qty * Number(row.purchasePrice || 0);
  }
  return total;
}
function resourceSaleIncome() {
  const map = fairItemMap();
  let total = 0;
  for (const [key, selection] of fairgroundState.resourceSales) {
    const row = map.get(key); if (!row) continue;
    total += Number(selection.quantity || 0) * Number(row.sellPrice || 0);
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
  fairgroundState.eligibility = fairgroundState.resultTurn ? core.tradeEligibility(fairgroundState.resultTurn, fairgroundState.catalog.skills) : null;
  if (!fairgroundState.snapshot) {
    fairgroundState.profitRows = [];
    fairgroundState.purchaseRows = [];
    fairgroundState.changes = [];
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
  loadPlanningState();
  recalculate();
  renderFairground();
  if (fairgroundState.activeFeature) renderActiveFeature();
  try { await window.tribenet.reportCurrentView({ page:'fairground.html', screen:'fairground', turnKey, fairTurnKey:fairgroundState.snapshot?.turnKey || null }); } catch (_) {}
}

function seasonForTurn(turnKey) { return parsedTurn(turnKey)?.month === 10 ? 'winter' : 'summer'; }
function seasonLabel(turnKey) { return seasonForTurn(turnKey) === 'winter' ? 'Start of Winter' : 'Start of Summer'; }

function inventoryFairValue() {
  if (!fairgroundState.snapshot) return 0;
  const prices = fairItemMap();
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

function purchasableItems() {
  return (fairgroundState.snapshot?.items || [])
    .filter(item => Number(item.purchasePrice) > 0 && Number(item.purchaseQuantityLimit) > 0)
    .map(item => ({ ...item, key:itemKey(item.name), price:Number(item.purchasePrice), maxQuantity:Number(item.purchaseQuantityLimit) }));
}

function sellOfferItems() {
  const inv = inventoryMap();
  const profits = profitMap();
  return (fairgroundState.snapshot?.items || [])
    .filter(item => Number(item.sellPrice) > 0 && Number(item.sellQuantityLimit) > 0)
    .map(item => {
      const key = itemKey(item.name);
      const owned = Number(inv.get(key)?.quantity || 0);
      const craft = profits.get(key);
      const productionSource = Boolean(craft?.sourceAvailable || Number(craft?.sellQuantity || 0) > 0);
      const fairLimit = Number(item.sellQuantityLimit || 0);
      const maxQuantity = productionSource ? fairLimit : Math.min(owned, fairLimit);
      return { ...item, key, price:Number(item.sellPrice), owned, productionSource, craft, maxQuantity };
    });
}

function hotspotStatus(id) {
  const planned = selectedTradeCount();
  const profitable = fairgroundState.profitRows.filter(row => Number(row.totalProfit || 0) > 0);
  const currentSkills = profitable.filter(row => Number(row.skillUpsNeeded || 0) === 0).length;
  const changed = fairgroundState.changes.filter(row => Number(row.sellDelta || 0) !== 0 || Number(row.purchaseDelta || 0) !== 0).length;
  const positiveCaravan = fairgroundState.purchaseRows.filter(row => Number(row.profitPerBatch || 0) > 0).length;
  const exact = fairgroundState.snapshotMode === 'exact';
  switch (id) {
    case 'trading-wagon': return { badge:`${planned}/${maxTrades()}`, status:planned >= maxTrades() ? 'warn' : 'good', live:`${fairgroundState.resourceBuys.size} purchases · ${fairgroundState.resourceSales.size} sales · ${tradesRemaining()} trade slots remaining` };
    case 'storehouse': return { badge:String(fairgroundState.inventory.length), status:fairgroundState.inventory.length ? 'good' : 'neutral', live:`${fairgroundState.inventory.length} goods in combined holdings · potential Fair value ${silver(inventoryFairValue())} Silver` };
    case 'market': return { badge:String(changed), status:changed ? 'good' : 'neutral', live:fairgroundState.previousSnapshot ? `${changed} prices changed since Fair ${fairgroundState.previousSnapshot.turnKey}` : 'No earlier saved Fair is available for comparison' };
    case 'workshop': return { badge:String(profitable.length), status:profitable.length ? 'good' : 'neutral', live:`${profitable.length} positive-profit production plans · ${currentSkills} with current skills` };
    case 'pavilion': { const count = meaningfulSheetRows('culturalActivities'); return { badge:String(count), status:count ? 'good' : 'neutral', live:count ? `${count} Cultural Activities entries to explore` : 'No Cultural Activities data found in the Fair workbook' }; }
    case 'scholar': { const count = meaningfulSheetRows('researchSpecials'); return { badge:String(count), status:count ? 'good' : 'neutral', live:count ? `${count} Research and Specials entries to explore` : 'No Research and Specials data found in the Fair workbook' }; }
    case 'fairmaster': {
      const eligibility = fairgroundState.eligibility;
      const status = !fairgroundState.snapshot ? 'bad' : eligibility?.status === 'blocked' ? 'bad' : exact ? 'good' : 'warn';
      const badge = !fairgroundState.snapshot ? '!' : exact ? '✓' : '!';
      const price = exact ? `Shared workbook loaded for ${fairgroundState.planningTurnKey}` : fairgroundState.snapshot ? `Using ${fairgroundState.snapshot.turnKey} as the price baseline` : 'No Fair workbook available';
      return { badge, status, live:`${price} · ${eligibility?.message || 'No Results baseline for Economics check'}` };
    }
    case 'caravan': {
      const actual = fairgroundState.purchaseRows.some(row => row.valuation === 'actual');
      return { badge:String(positiveCaravan), status:positiveCaravan ? 'good' : 'neutral', live:`${positiveCaravan} positive Fair-to-Fair craft routes · future prices ${actual ? 'include actual data' : 'are estimated'}` };
    }
    default: return { badge:'', status:'neutral', live:'' };
  }
}

function renderStatusRibbon() {
  const season = seasonForTurn(fairgroundState.planningTurnKey);
  document.querySelector('.fairground-app').dataset.season = season;
  $('seasonStatus').textContent = seasonLabel(fairgroundState.planningTurnKey);
  $('tradeStatus').textContent = `${selectedTradeCount()} / ${maxTrades()}`;
  $('spendStatus').textContent = `${silver(resourceBuySpend())} Silver`;
  $('incomeStatus').textContent = `${silver(resourceSaleIncome())} Silver`;
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

function featureIntro(title, copy, stat = '') {
  return `<div class="feature-intro"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div>${stat ? `<div class="feature-stat">${escapeHtml(stat)}</div>` : ''}</div>`;
}
function tradeSummaryHtml() {
  return `<div class="trade-summary-strip">
    <div class="trade-summary-chip"><span>Trades planned</span><strong>${selectedTradeCount()} / ${maxTrades()}</strong></div>
    <div class="trade-summary-chip"><span>Remaining</span><strong>${tradesRemaining()}</strong></div>
    <div class="trade-summary-chip"><span>Buying</span><strong>${silver(resourceBuySpend())} Silver</strong></div>
    <div class="trade-summary-chip"><span>Selling</span><strong>${silver(resourceSaleIncome())} Silver</strong></div>
    <div class="trade-summary-chip"><span>Net cash</span><strong>${silver(resourceSaleIncome() - resourceBuySpend())} Silver</strong></div>
  </div>`;
}
function emptyFeature(icon, title, copy) { return `<div class="feature-empty"><div class="empty-icon">${escapeHtml(icon)}</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`; }

function marketCard(item, mode) {
  const isBuy = mode === 'buy';
  const selection = isBuy ? fairgroundState.resourceBuys.get(item.key) : fairgroundState.resourceSales.get(item.key);
  const max = Number(item.maxQuantity || 0);
  const selectedQty = selection ? (isBuy && selection.all ? max : Number(selection.quantity || 0)) : 0;
  const sourceText = isBuy
    ? `${number(max)} available from the Fair`
    : item.productionSource ? `${number(item.sellQuantityLimit)} wanted · production source known` : item.owned > 0 ? `${number(item.owned)} held · Fair wants ${number(item.sellQuantityLimit)}` : `Fair wants ${number(item.sellQuantityLimit)} · no known source`;
  const disabled = !isBuy && max <= 0;
  return `<button type="button" class="market-item-card ${selection ? 'selected' : ''}" data-trade-mode="${mode}" data-key="${escapeHtml(item.key)}" ${disabled ? 'disabled' : ''}>
    <div class="item-card-top"><span class="item-icon">${escapeHtml(itemIcon(item.name))}</span><span class="item-quantity-badge">${number(max)}</span>${selection ? `<span class="item-selected-badge">${number(selectedQty)} planned</span>` : ''}</div>
    <div class="item-card-body"><strong class="item-card-name">${escapeHtml(item.name)}</strong><div class="item-card-price">${silver(item.price)} Silver each</div><div class="item-card-meta">${escapeHtml(sourceText)}</div></div>
  </button>`;
}

function renderTradingWagon() {
  const content = $('featureContent');
  const tab = fairgroundState.tradingTab;
  const search = fairgroundState.featureSearch.trim().toLowerCase();
  const buyRows = purchasableItems().filter(row => !search || row.name.toLowerCase().includes(search));
  const sellRows = sellOfferItems().filter(row => !search || row.name.toLowerCase().includes(search));
  const plannedRows = [
    ...[...fairgroundState.resourceBuys.entries()].map(([key,value]) => ({ mode:'buy', key, value, item:fairItemMap().get(key) })),
    ...[...fairgroundState.resourceSales.entries()].map(([key,value]) => ({ mode:'sell', key, value, item:fairItemMap().get(key) }))
  ].filter(row => row.item);

  let cards = '';
  if (tab === 'buy') cards = buyRows.length ? `<div class="fair-card-grid">${buyRows.map(row => marketCard(row,'buy')).join('')}</div>` : emptyFeature('🛒','Nothing to buy','No Fair → Clan offers match this filter.');
  else if (tab === 'sell') cards = sellRows.length ? `<div class="fair-card-grid">${sellRows.map(row => marketCard(row,'sell')).join('')}</div>` : emptyFeature('🪙','Nothing to sell','No Clan → Fair offers match this filter.');
  else cards = plannedRows.length ? `<div class="fair-card-grid">${plannedRows.map(row => {
    const item = row.item;
    const qty = row.mode === 'buy' && row.value.all ? Number(item.purchaseQuantityLimit || 0) : Number(row.value.quantity || 0);
    const price = row.mode === 'buy' ? Number(item.purchasePrice || 0) : Number(item.sellPrice || 0);
    return `<button type="button" class="market-item-card selected" data-planned-mode="${row.mode}" data-key="${escapeHtml(row.key)}"><div class="item-card-top"><span class="item-icon">${escapeHtml(itemIcon(item.name))}</span><span class="item-selected-badge">${row.mode === 'buy' ? 'BUY' : 'SELL'}</span><span class="item-quantity-badge">${number(qty)}</span></div><div class="item-card-body"><strong class="item-card-name">${escapeHtml(item.name)}</strong><div class="item-card-price">${silver(qty * price)} Silver ${row.mode === 'buy' ? 'cost' : 'income'}</div><div class="item-card-meta">Click to change this trade.</div></div></button>`;
  }).join('')}</div>` : emptyFeature('📜','No trades planned','Choose goods from Buy from Fair or Sell to Fair.');

  content.innerHTML = `${featureIntro('The Trading Wagon','Browse the Fair as a marketplace. Each different item you buy or sell consumes one of the Fair transaction slots.',`${selectedTradeCount()} / ${maxTrades()} trades`)}${tradeSummaryHtml()}
    <div class="feature-tabs"><button class="fair-tab-button ${tab === 'buy' ? 'active' : ''}" data-trading-tab="buy">🛍 Buy from Fair</button><button class="fair-tab-button ${tab === 'sell' ? 'active' : ''}" data-trading-tab="sell">🪙 Sell to Fair</button><button class="fair-tab-button ${tab === 'planned' ? 'active' : ''}" data-trading-tab="planned">📜 Planned Trades (${selectedTradeCount()})</button></div>
    ${tab !== 'planned' ? `<div class="fair-card-toolbar"><input id="featureSearchInput" type="search" placeholder="Search goods…" value="${escapeHtml(fairgroundState.featureSearch)}"><span class="fair-card-count">${tab === 'buy' ? buyRows.length : sellRows.length} offers</span></div>` : ''}${cards}`;
  bindTradingEvents();
}

function bindTradingEvents() {
  document.querySelectorAll('[data-trading-tab]').forEach(button => button.addEventListener('click', () => {
    fairgroundState.tradingTab = button.dataset.tradingTab;
    fairgroundState.featureSearch = '';
    renderTradingWagon();
  }));
  $('featureSearchInput')?.addEventListener('input', event => { fairgroundState.featureSearch = event.currentTarget.value; renderTradingWagon(); });
  document.querySelectorAll('[data-trade-mode]').forEach(button => button.addEventListener('click', () => {
    const mode = button.dataset.tradeMode;
    const key = button.dataset.key;
    const row = mode === 'buy' ? purchasableItems().find(item => item.key === key) : sellOfferItems().find(item => item.key === key);
    if (row) openTradeDialog(mode,row);
  }));
  document.querySelectorAll('[data-planned-mode]').forEach(button => button.addEventListener('click', () => {
    const mode = button.dataset.plannedMode;
    const key = button.dataset.key;
    const row = mode === 'buy' ? purchasableItems().find(item => item.key === key) : sellOfferItems().find(item => item.key === key);
    if (row) openTradeDialog(mode,row);
  }));
}

function renderStorehouse() {
  const fairMap = fairItemMap();
  const rows = [...fairgroundState.inventory].map(row => {
    const fair = fairMap.get(row.key);
    const price = Number(fair?.sellPrice || 0);
    const limit = Number(fair?.sellQuantityLimit || 0);
    const saleQty = price > 0 ? Math.min(Number(row.quantity || 0), limit > 0 ? limit : Number(row.quantity || 0)) : 0;
    return { ...row, fair, saleQty, value:saleQty * price };
  }).sort((a,b) => b.value - a.value || b.quantity - a.quantity);
  $('featureContent').innerHTML = `${featureIntro('Your Storehouse','Everything currently held across your Tribes and Elements. Click a crate to see where it is held and, where possible, plan a sale.',`${rows.length} goods`)}
    ${rows.length ? `<div class="fair-card-grid large-cards">${rows.map(row => `<button type="button" class="fair-info-card storehouse-card" data-stock-key="${escapeHtml(row.key)}"><div class="stock-line"><span class="stock-icon">${escapeHtml(itemIcon(row.name))}</span><div><h4>${escapeHtml(row.fair?.name || row.name)}</h4><small>${row.breakdown.length} holding location${row.breakdown.length === 1 ? '' : 's'}</small></div><strong class="stock-number">${number(row.quantity)}</strong></div><div class="stock-value">${row.value > 0 ? `Fair value up to ${silver(row.value)} Silver` : 'No current Fair buy price'}</div></button>`).join('')}</div>` : emptyFeature('📦','Storehouse is empty','No Results inventory is available for this Fair turn.')}`;
  document.querySelectorAll('[data-stock-key]').forEach(button => button.addEventListener('click', () => openStockDialog(button.dataset.stockKey)));
}

function renderMarket() {
  const rows = [...fairgroundState.changes]
    .filter(row => Number(row.sellDelta || 0) !== 0 || Number(row.purchaseDelta || 0) !== 0)
    .sort((a,b) => Math.max(Math.abs(Number(b.sellDeltaPct || 0)),Math.abs(Number(b.purchaseDeltaPct || 0))) - Math.max(Math.abs(Number(a.sellDeltaPct || 0)),Math.abs(Number(a.purchaseDeltaPct || 0))));
  $('featureContent').innerHTML = `${featureIntro('Market Stalls','Walk the stalls to see which goods have become dearer or cheaper since the previous saved Fair.',fairgroundState.previousSnapshot ? `${fairgroundState.previousSnapshot.turnKey} → ${fairgroundState.snapshot?.turnKey}` : 'First saved Fair')}
    ${rows.length ? `<div class="fair-card-grid large-cards">${rows.map(row => {
      const direction = Number(row.sellDelta || row.purchaseDelta || 0) >= 0 ? 'up' : 'down';
      const headline = row.sellDeltaPct != null ? row.sellDeltaPct : row.purchaseDeltaPct;
      return `<button type="button" class="market-change-card change-${direction}" data-market-key="${escapeHtml(row.key)}"><div class="change-ribbon">${direction === 'up' ? '▲' : '▼'} ${pct(headline)}</div><div class="change-content"><h4>${escapeHtml(row.name)}</h4><div class="change-price"><span>Fair pays</span><strong>${silver(row.oldSellPrice)} → ${silver(row.sellPrice)}</strong></div><div class="change-price"><span>Fair sells</span><strong>${silver(row.oldPurchasePrice)} → ${silver(row.purchasePrice)}</strong></div></div></button>`;
    }).join('')}</div>` : emptyFeature('🏪','No market movement to show',fairgroundState.previousSnapshot ? 'Prices did not change between these saved Fairs.' : 'Save another Fair workbook to begin comparing prices.')}`;
  document.querySelectorAll('[data-market-key]').forEach(button => button.addEventListener('click', () => openMarketDialog(button.dataset.marketKey)));
}

function renderWorkshop() {
  const limit = fairgroundState.workshopSkillLimit;
  const rows = fairgroundState.profitRows
    .filter(row => row.skillUpsNeeded == null ? limit >= 999 : Number(row.skillUpsNeeded) <= limit)
    .sort((a,b) => Number(b.totalProfit ?? -Infinity) - Number(a.totalProfit ?? -Infinity));
  $('featureContent').innerHTML = `${featureIntro("Craftsman's Workshop",'Production plans are built from known Compendium sources rather than capped by the resources already in your storehouse. Click a project to inspect its full production route or plan it as a Fair sale.',`${rows.filter(row => Number(row.totalProfit || 0) > 0).length} profitable`)}
    <div class="feature-tabs"><button class="fair-tab-button ${limit === 0 ? 'active' : ''}" data-skill-limit="0">Current skills</button><button class="fair-tab-button ${limit === 1 ? 'active' : ''}" data-skill-limit="1">+1</button><button class="fair-tab-button ${limit === 2 ? 'active' : ''}" data-skill-limit="2">+2</button><button class="fair-tab-button ${limit === 3 ? 'active' : ''}" data-skill-limit="3">+3</button><button class="fair-tab-button ${limit >= 999 ? 'active' : ''}" data-skill-limit="999">All projects</button></div>
    ${rows.length ? `<div class="fair-card-grid large-cards">${rows.map(row => {
      const inputs = (row.planningInputs || row.consumedInputs || []).slice(0,3).map(part => `${part.name || part.key} × ${number(part.quantity)}`).join(' · ');
      const skill = row.skillUpsNeeded == null ? 'Skills unknown' : row.skillUpsNeeded === 0 ? 'Current skills' : `${row.skillUpsNeeded} skillup${row.skillUpsNeeded === 1 ? '' : 's'}`;
      return `<button type="button" class="craft-card" data-craft-key="${escapeHtml(row.key)}"><div class="craft-card-top"><span class="craft-card-icon">${escapeHtml(itemIcon(row.item))}</span><div><h4>${escapeHtml(row.item)}</h4><small>${number(row.sellQuantity)} planned to Fair limit</small></div><strong class="craft-profit">${row.totalProfit == null ? '—' : `${silver(row.totalProfit)} profit`}</strong></div><div class="craft-route">${escapeHtml(inputs || row.reason || 'Open to inspect production route')}</div><span class="skill-token ${Number(row.skillUpsNeeded || 0) > 0 ? 'warn' : ''}">${escapeHtml(skill)}</span></button>`;
    }).join('')}</div>` : emptyFeature('⚒️','No projects match this skill filter','Try a wider skill-gap option.')}`;
  document.querySelectorAll('[data-skill-limit]').forEach(button => button.addEventListener('click', () => { fairgroundState.workshopSkillLimit = Number(button.dataset.skillLimit); renderWorkshop(); }));
  document.querySelectorAll('[data-craft-key]').forEach(button => button.addEventListener('click', () => openCraftDialog(button.dataset.craftKey)));
}

function sheetCards(sheetKey, icon) {
  const rows = sheetRows(sheetKey).filter(row => row.some(cell => String(cell ?? '').trim()));
  if (!rows.length) return emptyFeature(icon,'Nothing posted here','The shared Fair workbook does not contain readable entries for this pavilion.');
  let headers = null;
  let seenHeader = false;
  let html = '<div class="activity-board">';
  for (const row of rows) {
    const values = row.map(cell => String(cell ?? '').trim());
    const filled = values.filter(Boolean);
    if (filled.length === 1) {
      html += `<h3 class="activity-section-title">${escapeHtml(filled[0])}</h3>`;
      continue;
    }
    if (!seenHeader) {
      headers = values;
      seenHeader = true;
      continue;
    }
    const titleIndex = values.findIndex(Boolean);
    const title = titleIndex >= 0 ? values[titleIndex] : 'Fair entry';
    const lines = values.map((value,index) => ({ value, label:headers?.[index] || `Field ${index + 1}` })).filter((part,index) => part.value && index !== titleIndex);
    html += `<article class="activity-card"><h4>${escapeHtml(title)}</h4>${lines.map(line => `<p class="activity-line"><strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.value)}</p>`).join('')}</article>`;
  }
  return html + '</div>';
}
function renderPavilion() { $('featureContent').innerHTML = `${featureIntro('Grand Pavilion','Cultural activities are presented as programmes and performance notices rather than another spreadsheet.',`${meaningfulSheetRows('culturalActivities')} entries`)}${sheetCards('culturalActivities','🎪')}`; }
function renderScholar() { $('featureContent').innerHTML = `${featureIntro("Scholar's Pavilion",'Research and special Fair opportunities are laid out as individual notices and scrolls.',`${meaningfulSheetRows('researchSpecials')} entries`)}${sheetCards('researchSpecials','📜')}`; }

function renderFairmaster() {
  const exact = fairgroundState.snapshotMode === 'exact';
  const eligibility = fairgroundState.eligibility;
  const resultKey = fairgroundState.managedTurn?.start?.data?.resultTurnKey || fairgroundState.resultTurn?.turnKey;
  const history = [...fairgroundState.snapshots].sort((a,b) => Number(b.turnSort || 0) - Number(a.turnSort || 0));
  $('featureContent').innerHTML = `${featureIntro("Fairmaster's Tent",'Fair files now enter the toolkit once on the Launcher, just like Results and Completed Orders. This tent shows the shared state used by both Fair versions.','Shared data')}
    <div class="fairmaster-grid">
      <article class="fairmaster-card ${exact ? 'good' : fairgroundState.snapshot ? 'warn' : 'bad'}"><h4>📘 Fair workbook</h4><strong>${fairgroundState.snapshot ? escapeHtml(fairgroundState.snapshot.sourceFile) : 'Not loaded'}</strong><p>${exact ? `Actual Fair ${escapeHtml(fairgroundState.planningTurnKey)} prices are loaded.` : fairgroundState.snapshot ? `Fair ${escapeHtml(fairgroundState.snapshot.turnKey)} is being used as a baseline for ${escapeHtml(fairgroundState.planningTurnKey)}.` : 'No current or earlier Fair workbook is available.'}</p><button id="manageFairFilesButton" class="button">Manage Fair files on Launcher</button></article>
      <article class="fairmaster-card ${eligibility?.status === 'allowed' ? 'good' : eligibility?.status === 'blocked' ? 'bad' : 'warn'}"><h4>🪙 Trade access</h4><strong>${escapeHtml(eligibility?.message || 'No Results baseline')}</strong><p>The Economics check uses the same Results state as the rest of the toolkit.</p></article>
      <article class="fairmaster-card ${resultKey ? 'good' : 'warn'}"><h4>📦 Results baseline</h4><strong>${escapeHtml(resultKey || 'Unavailable')}</strong><p>${fairgroundState.resultBaselineTurnKey ? `Planning state taken from ${escapeHtml(fairgroundState.resultBaselineTurnKey)}.` : 'Import Results on the Launcher to populate holdings and skills.'}</p></article>
      <article class="fairmaster-card"><h4>📜 Trade ledger</h4><strong>${selectedTradeCount()} / ${maxTrades()} transactions</strong><p>${fairgroundState.resourceBuys.size} purchases · ${fairgroundState.resourceSales.size} sales · net cash ${silver(resourceSaleIncome() - resourceBuySpend())} Silver.</p><button id="openTradeLedgerButton" class="button">Open Trading Wagon ledger</button></article>
    </div>
    <h3 class="activity-section-title">Saved Fair history</h3>
    ${history.length ? `<div class="fair-card-grid">${history.map(row => `<button type="button" class="history-card ${row.turnKey === fairgroundState.snapshot?.turnKey ? 'current' : ''}" data-history-turn="${escapeHtml(row.turnKey)}"><strong>${escapeHtml(row.turnKey)}</strong><div class="item-card-meta">${escapeHtml(row.sourceFile)} · ${number(row.itemCount)} items</div></button>`).join('')}</div>` : emptyFeature('📚','No Fair history','Import the next Fair workbook on the Launcher.')}`;
  $('manageFairFilesButton')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  $('openTradeLedgerButton')?.addEventListener('click', () => { fairgroundState.tradingTab = 'planned'; openHotspot(hotspotsApi.getHotspot('trading-wagon')); });
  document.querySelectorAll('[data-history-turn]').forEach(button => button.addEventListener('click', async () => {
    const turn = button.dataset.historyTurn;
    const select = $('fairgroundTurnSelect');
    if ([...select.options].some(option => option.value === turn)) { select.value = turn; await selectPlanningTurn(turn); renderFairmaster(); }
  }));
}

function renderCaravan() {
  const rows = [...fairgroundState.purchaseRows].sort((a,b) => Number(b.maxProfit ?? -Infinity) - Number(a.maxProfit ?? -Infinity));
  $('featureContent').innerHTML = `${featureIntro('Caravan Road','Buy inputs at this Fair, take them away to manufacture, then return with finished goods at the next Fair.',`${rows.filter(row => Number(row.profitPerBatch || 0) > 0).length} positive routes`)}
    ${rows.length ? `<div class="fair-card-grid large-cards">${rows.map((row,index) => `<button type="button" class="caravan-card" data-caravan-index="${index}"><div class="craft-card-top"><span class="craft-card-icon">${escapeHtml(itemIcon(row.item))}</span><div><h4>${escapeHtml(row.item)}</h4><small>${row.valuation === 'actual' ? `Actual ${escapeHtml(row.valuationTurn)}` : 'Estimated next Fair'}</small></div><strong class="caravan-profit">${silver(row.maxProfit)}</strong></div><div class="caravan-route"><span>${silver(row.currentFairCost)} buy cost</span><span class="caravan-arrow">→</span><span>${silver(row.nextSellPrice)} next sell</span></div><div class="item-card-meta">${number(row.maxBatches)} max batches · ${row.roi == null ? 'ROI —' : `${pct(row.roi * 100)} ROI`} · ${number(row.currentFairTradesNeeded)} trade types now</div></button>`).join('')}</div>` : emptyFeature('🐎','No caravan routes','No purchase-to-craft routes can be calculated from the current Fair data.')}`;
  document.querySelectorAll('[data-caravan-index]').forEach(button => button.addEventListener('click', () => openCaravanDialog(rows[Number(button.dataset.caravanIndex)])));
}

function renderActiveFeature() {
  const hotspot = hotspotsApi.getHotspot(fairgroundState.activeFeature);
  if (!hotspot) return;
  $('featureIcon').textContent = hotspot.icon;
  $('featureTitle').textContent = hotspot.label;
  $('featureSubtitle').textContent = hotspot.description;
  $('featureEyebrow').textContent = seasonLabel(fairgroundState.planningTurnKey).toUpperCase();
  $('featureHeaderStatus').textContent = hotspotStatus(hotspot.id).live;
  switch (hotspot.id) {
    case 'trading-wagon': renderTradingWagon(); break;
    case 'storehouse': renderStorehouse(); break;
    case 'market': renderMarket(); break;
    case 'workshop': renderWorkshop(); break;
    case 'pavilion': renderPavilion(); break;
    case 'scholar': renderScholar(); break;
    case 'fairmaster': renderFairmaster(); break;
    case 'caravan': renderCaravan(); break;
  }
}

function openHotspot(hotspot) {
  if (!hotspot) return;
  hideTooltip();
  fairgroundState.activeFeature = hotspot.id;
  fairgroundState.featureSearch = '';
  $('featureBackdrop').classList.remove('hidden');
  $('featureDrawer').classList.remove('hidden');
  $('featureBackdrop').setAttribute('aria-hidden','false');
  $('featureDrawer').setAttribute('aria-hidden','false');
  renderActiveFeature();
}
function closeFeature() {
  closeInteraction();
  fairgroundState.activeFeature = null;
  $('featureBackdrop').classList.add('hidden');
  $('featureDrawer').classList.add('hidden');
  $('featureBackdrop').setAttribute('aria-hidden','true');
  $('featureDrawer').setAttribute('aria-hidden','true');
}

function openInteraction({ icon='📦', eyebrow='FAIR', title='Details', body='', actions=[] }) {
  $('interactionIcon').textContent = icon;
  $('interactionEyebrow').textContent = eyebrow;
  $('interactionTitle').textContent = title;
  $('interactionBody').innerHTML = body;
  $('interactionActions').innerHTML = actions.map(action => `<button type="button" class="button ${escapeHtml(action.className || '')}" data-dialog-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('');
  $('interactionBackdrop').classList.remove('hidden');
  $('interactionDialog').classList.remove('hidden');
  $('interactionBackdrop').setAttribute('aria-hidden','false');
  for (const action of actions) $('interactionActions').querySelector(`[data-dialog-action="${CSS.escape(action.id)}"]`)?.addEventListener('click', action.handler);
}
function closeInteraction() {
  $('interactionBackdrop').classList.add('hidden');
  $('interactionDialog').classList.add('hidden');
  $('interactionBackdrop').setAttribute('aria-hidden','true');
}

function openTradeDialog(mode,row) {
  const isBuy = mode === 'buy';
  const selection = isBuy ? fairgroundState.resourceBuys.get(row.key) : fairgroundState.resourceSales.get(row.key);
  const max = Math.max(0, Number(row.maxQuantity || 0));
  const current = selection ? (isBuy && selection.all ? max : Number(selection.quantity || 0)) : Math.min(1,max);
  const owned = Number(row.owned || 0);
  openInteraction({
    icon:itemIcon(row.name), eyebrow:isBuy ? 'BUY FROM FAIR' : 'SELL TO FAIR', title:row.name,
    body:`<div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Price each</span><strong>${silver(row.price)} Silver</strong></div><div class="trade-dialog-stat"><span>${isBuy ? 'Fair stock' : 'Fair wants'}</span><strong>${number(isBuy ? row.purchaseQuantityLimit : row.sellQuantityLimit)}</strong></div><div class="trade-dialog-stat"><span>${isBuy ? 'Trade slots left' : 'Your source'}</span><strong>${isBuy ? tradesRemaining() : row.productionSource ? 'Production available' : `${number(owned)} held`}</strong></div></div>
      <p>${isBuy ? 'Choose how many you want to purchase. This item counts as one Fair transaction regardless of quantity.' : 'Choose how many you plan to bring to the Fair. Stock and known Compendium production sources are both recognised.'}</p>
      <div class="trade-quantity-row"><button id="qtyMinusButton" class="qty-button" type="button">−</button><input id="tradeQuantityInput" type="number" min="0" max="${max}" step="1" value="${current}"><button id="qtyPlusButton" class="qty-button" type="button">+</button><button id="qtyAllButton" class="qty-button" type="button">All</button></div><div id="tradeDialogTotal" class="item-card-price"></div><div id="tradeDialogWarning"></div>`,
    actions:[
      ...(selection ? [{ id:'remove', label:'Remove trade', className:'danger-trade', handler:() => { if (isBuy) { fairgroundState.resourceBuys.delete(row.key); saveResourceBuys(); } else { fairgroundState.resourceSales.delete(row.key); saveResourceSales(); } closeInteraction(); afterPlanChange(); } }] : []),
      { id:'cancel', label:'Cancel', handler:closeInteraction },
      { id:'confirm', label:selection ? 'Update trade' : 'Add trade', className:'primary-trade', handler:() => confirmTrade(mode,row) }
    ]
  });
  const input = $('tradeQuantityInput');
  const updateTotal = () => {
    const qty = Math.min(max,Math.max(0,Number(input.value || 0)));
    input.value = qty;
    $('tradeDialogTotal').textContent = `${number(qty)} × ${silver(row.price)} = ${silver(qty * row.price)} Silver`;
  };
  $('qtyMinusButton')?.addEventListener('click', () => { input.value = Math.max(0,Number(input.value || 0) - 1); updateTotal(); });
  $('qtyPlusButton')?.addEventListener('click', () => { input.value = Math.min(max,Number(input.value || 0) + 1); updateTotal(); });
  $('qtyAllButton')?.addEventListener('click', () => { input.value = max; updateTotal(); });
  input?.addEventListener('input', updateTotal);
  updateTotal();
}

function confirmTrade(mode,row) {
  const isBuy = mode === 'buy';
  const map = isBuy ? fairgroundState.resourceBuys : fairgroundState.resourceSales;
  const existing = map.has(row.key);
  const max = Math.max(0,Number(row.maxQuantity || 0));
  const qty = Math.min(max,Math.max(0,Number($('tradeQuantityInput')?.value || 0)));
  const warning = $('tradeDialogWarning');
  if (qty <= 0) { if (warning) warning.innerHTML = '<div class="dialog-warning">Choose a quantity above zero, or use Remove trade.</div>'; return; }
  if (!existing && selectedTradeCount() >= maxTrades()) { if (warning) warning.innerHTML = `<div class="dialog-warning">All ${maxTrades()} Fair transactions are already planned. Remove another trade first.</div>`; return; }
  if (isBuy) {
    fairgroundState.resourceBuys.set(row.key,{ quantity:qty, all:qty >= max });
    saveResourceBuys();
  } else {
    const owned = Number(row.owned || 0);
    fairgroundState.resourceSales.set(row.key,{ quantity:qty, source:qty <= owned ? 'stock' : 'production' });
    saveResourceSales();
  }
  closeInteraction();
  afterPlanChange();
}

function afterPlanChange() {
  renderFairground();
  if (fairgroundState.activeFeature) renderActiveFeature();
}

function openStockDialog(key) {
  const row = fairgroundState.inventory.find(item => item.key === key); if (!row) return;
  const fair = fairItemMap().get(key);
  const breakdown = row.breakdown.map(part => `<div class="activity-line"><strong>${escapeHtml(part.unitCode)}</strong> · ${escapeHtml(part.section)} · ${number(part.quantity)}</div>`).join('');
  const offer = sellOfferItems().find(item => item.key === key);
  openInteraction({ icon:itemIcon(row.name), eyebrow:'STOREHOUSE', title:fair?.name || row.name,
    body:`<div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Combined stock</span><strong>${number(row.quantity)}</strong></div><div class="trade-dialog-stat"><span>Fair pays</span><strong>${fair?.sellPrice ? `${silver(fair.sellPrice)} Silver` : '—'}</strong></div><div class="trade-dialog-stat"><span>Fair limit</span><strong>${number(fair?.sellQuantityLimit)}</strong></div></div><h4>Where held</h4>${breakdown || '<p>No location breakdown.</p>'}`,
    actions:[{ id:'close', label:'Close', handler:closeInteraction }, ...(offer?.maxQuantity > 0 ? [{ id:'sell', label:'Plan sale', className:'primary-trade', handler:() => { closeInteraction(); openTradeDialog('sell',offer); } }] : [])]
  });
}

function openMarketDialog(key) {
  const row = fairgroundState.changes.find(item => item.key === key); if (!row) return;
  openInteraction({ icon:itemIcon(row.name), eyebrow:'MARKET MOVEMENT', title:row.name,
    body:`<div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Fair pays now</span><strong>${silver(row.sellPrice)}</strong></div><div class="trade-dialog-stat"><span>Previous</span><strong>${silver(row.oldSellPrice)}</strong></div><div class="trade-dialog-stat"><span>Sell change</span><strong>${pct(row.sellDeltaPct)}</strong></div></div><div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Fair sells now</span><strong>${silver(row.purchasePrice)}</strong></div><div class="trade-dialog-stat"><span>Previous</span><strong>${silver(row.oldPurchasePrice)}</strong></div><div class="trade-dialog-stat"><span>Buy change</span><strong>${pct(row.purchaseDeltaPct)}</strong></div></div>`,
    actions:[{ id:'close', label:'Close', handler:closeInteraction }]
  });
}

function openCraftDialog(key) {
  const row = fairgroundState.profitRows.find(item => item.key === key); if (!row) return;
  const inputs = (row.planningInputs || row.consumedInputs || []).map(part => `<div class="activity-line"><strong>${escapeHtml(part.name || part.key)}</strong> × ${number(part.quantity)}${part.sourceRecipe ? ` · ${escapeHtml(part.sourceRecipe)}` : ''}</div>`).join('');
  const missing = (row.missingSkills || []).map(skill => `${skill.skill} ${skill.current}→${skill.required}`).join(', ');
  const saleOffer = sellOfferItems().find(item => item.key === key);
  openInteraction({ icon:itemIcon(row.item), eyebrow:'CRAFT WORKSHOP', title:row.item,
    body:`<div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Planned sell qty</span><strong>${number(row.sellQuantity)}</strong></div><div class="trade-dialog-stat"><span>Fair pays each</span><strong>${silver(row.sellPrice)}</strong></div><div class="trade-dialog-stat"><span>Total profit</span><strong>${silver(row.totalProfit)}</strong></div></div><h4>Production route</h4>${inputs || `<p>${escapeHtml(row.reason || 'No source detail available.')}</p>`}<p>${missing ? `<strong>Skill gaps:</strong> ${escapeHtml(missing)}` : 'Current skills cover the known recipe chain.'}</p>${row.contextWarnings?.length ? `<p><strong>Check:</strong> ${escapeHtml(row.contextWarnings.join(' · '))}</p>` : ''}`,
    actions:[{ id:'close', label:'Close', handler:closeInteraction }, ...(saleOffer?.maxQuantity > 0 ? [{ id:'sell', label:'Plan Fair sale', className:'primary-trade', handler:() => { closeInteraction(); openTradeDialog('sell',saleOffer); } }] : [])]
  });
}

function openCaravanDialog(row) {
  if (!row) return;
  const inputs = (row.purchases || []).map(input => `<div class="activity-line"><strong>${escapeHtml(input.name)}</strong> × ${number(input.quantity)} @ ${silver(input.unitPrice)}</div>`).join('');
  openInteraction({ icon:itemIcon(row.item), eyebrow:'CARAVAN ROUTE', title:row.item,
    body:`<div class="trade-dialog-stats"><div class="trade-dialog-stat"><span>Cost / batch</span><strong>${silver(row.currentFairCost)}</strong></div><div class="trade-dialog-stat"><span>Next sell price</span><strong>${silver(row.nextSellPrice)}</strong></div><div class="trade-dialog-stat"><span>Profit / batch</span><strong>${silver(row.profitPerBatch)}</strong></div></div><h4>Buy at this Fair</h4>${inputs}<p>Maximum ${number(row.maxBatches)} batches · ${row.roi == null ? 'ROI unavailable' : `${pct(row.roi * 100)} ROI`} · ${row.valuation === 'actual' ? `next price from actual Fair ${escapeHtml(row.valuationTurn)}` : 'next price currently estimated'}.</p>`,
    actions:[{ id:'close', label:'Close', handler:closeInteraction }]
  });
}

function bindEvents() {
  $('fairgroundLauncherButton').addEventListener('click', () => { window.location.href = 'index.html'; });
  $('classicFairButton').addEventListener('click', () => { window.location.href = 'fair.html'; });
  $('fairgroundTurnSelect').addEventListener('change', event => selectPlanningTurn(event.currentTarget.value));
  $('closeFeatureButton').addEventListener('click', closeFeature);
  $('featureBackdrop').addEventListener('click', closeFeature);
  $('fairEntranceButton').addEventListener('click', closeFeature);
  $('closeInteractionButton').addEventListener('click', closeInteraction);
  $('interactionBackdrop').addEventListener('click', closeInteraction);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('interactionDialog').classList.contains('hidden')) closeInteraction(); else closeFeature();
  });
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

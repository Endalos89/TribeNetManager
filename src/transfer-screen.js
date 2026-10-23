let transferScreenSession = null;
let transferScreenItemDraft = null;

function transferScreenEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function transferScreenCode(unit) { return String(unit?.unitCode || unit?.unit || '').trim(); }
function transferScreenKey(item) { return String(item || '').trim().toUpperCase(); }
function transferScreenIconKey(item) { return transferScreenKey(item).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function transferScreenPairMatches(row, a, b) {
  const from = transferScreenCode({ unitCode: row?.from }).toLowerCase();
  const to = transferScreenCode({ unitCode: row?.to }).toLowerCase();
  return (from === a.toLowerCase() && to === b.toLowerCase()) || (from === b.toLowerCase() && to === a.toLowerCase());
}

function transferScreenStock(unitCode) {
  const code = String(unitCode || '').trim().toLowerCase();
  const plan = state?.planImport?.plan || {};
  const candidates = [
    ...(plan.unitStats || []), ...(plan.units || []), ...(plan.clan || []), ...(savedMovementUnits?.() || [])
  ];
  const unit = candidates.find(row => String(row?.unitCode || row?.unit || '').trim().toLowerCase() === code);
  if (!unit) return null;
  const stock = new Map();
  const inventory = unit.inventory;
  if (Array.isArray(inventory)) {
    for (const row of inventory) if (row?.item) stock.set(transferScreenKey(row.item), Number(row.quantity || 0));
  } else if (inventory && typeof inventory === 'object') {
    for (const [item, quantity] of Object.entries(inventory)) stock.set(transferScreenKey(item), Number(quantity || 0));
  }
  const population = {
    WARRIORS: unit.warrior ?? unit.warriors,
    ACTIVES: unit.active ?? unit.actives,
    INACTIVES: unit.inactive ?? unit.inactives,
    SLAVES: unit.slave ?? unit.slaves,
    HIRELINGS: unit.hireling ?? unit.hirelings,
    MERCENARIES: unit.mercenary ?? unit.mercenaries,
    LOCALS: unit.locals,
    RESIDENTS: unit.residents,
    FOLLOWERS: unit.followers,
    AUXILIARIES: unit.auxiliaries
  };
  for (const [item, quantity] of Object.entries(population)) {
    if (quantity != null && Number.isFinite(Number(quantity))) stock.set(item, Number(quantity));
  }
  return stock;
}

function transferScreenRowsSignature(rows) {
  const normalized = (rows || []).map(row => ({ from:String(row.from).toLowerCase(), to:String(row.to).toLowerCase(), item:transferScreenKey(row.item), quantity:Number(row.quantity), notes:String(row.notes || '') }))
    .sort((a, b) => `${a.from}|${a.to}|${a.item}`.localeCompare(`${b.from}|${b.to}|${b.item}`));
  return JSON.stringify(normalized);
}

function transferScreenUnitLabel(code) {
  const unit = (savedMovementUnits?.() || []).find(row => transferScreenCode(row).toLowerCase() === String(code || '').toLowerCase());
  return unit ? `${transferScreenCode(unit)} · ${unit.unitName || unit.unitType || unit.type || 'Unit'}` : String(code || '—');
}

function transferScreenPositionHex(unit, timing) {
  if (!unit) return null;
  const phase = String(timing || 'BM').toUpperCase() === 'AM' ? 'AM' : 'BM';
  if (unit.plannedSplit && unit.creationPhase === 'after') {
    if (phase === 'BM') return null;
    if (typeof plannedSplitMapHex === 'function') return plannedSplitMapHex(unit);
  }
  const start = unit.currentHex || unit.startHex || null;
  if (phase === 'BM') return start;
  const destination = typeof savedMovementUnitMoveDestination === 'function'
    ? savedMovementUnitMoveDestination(transferScreenCode(unit))
    : null;
  return destination || start;
}

function transferScreenEligibleTargets(from, timing) {
  const units = savedMovementUnits?.() || [];
  const source = units.find(unit => transferScreenCode(unit).toLowerCase() === String(from || '').toLowerCase());
  const location = transferScreenPositionHex(source, timing);
  if (!location) return [];
  return units.filter(unit => {
    if (transferScreenCode(unit).toLowerCase() === String(from || '').toLowerCase()) return false;
    const position = transferScreenPositionHex(unit, timing);
    return position && String(position).trim().toUpperCase() === String(location).trim().toUpperCase();
  });
}

function transferScreenPopulateTargets(from, timing, preferred = '') {
  const select = document.getElementById('transferTo');
  const targets = transferScreenEligibleTargets(from, timing);
  const source = (savedMovementUnits?.() || []).find(unit => transferScreenCode(unit).toLowerCase() === String(from || '').toLowerCase());
  const location = transferScreenPositionHex(source, timing);
  select.innerHTML = targets.length
    ? targets.map(unit => `<option value="${transferScreenEsc(transferScreenCode(unit))}">${transferScreenEsc(transferScreenUnitLabel(transferScreenCode(unit)))}</option>`).join('')
    : '<option value="">No other unit shares this location</option>';
  select.disabled = !targets.length;
  const preferredTarget = targets.find(unit => transferScreenCode(unit).toLowerCase() === String(preferred || '').toLowerCase());
  select.value = transferScreenCode(preferredTarget || targets[0]) || '';
  const phaseName = String(timing || 'BM').toUpperCase() === 'AM' ? 'After Movement' : 'Before Movement';
  document.getElementById('transferAreaHint').textContent = location
    ? `${phaseName} location: ${location}. Only units at this hex are available.`
    : `${phaseName}: ${transferScreenUnitLabel(from)} has no location at this point in the turn.`;
  return targets;
}

function transferScreenSessionRows() {
  const totals = new Map();
  for (const row of transferScreenSession?.draftRows || []) {
    const key = `${String(row.from).toLowerCase()}|${String(row.to).toLowerCase()}|${transferScreenKey(row.item)}`;
    const current = totals.get(key) || { ...row, quantity:0 };
    current.quantity += Number(row.quantity || 0);
    if (row.notes) current.notes = current.notes ? `${current.notes}; ${row.notes}` : row.notes;
    totals.set(key, current);
  }
  return [...totals.values()].filter(row => row.quantity > 0);
}

function transferScreenFindRow(rows, from, to, item) {
  const key = transferScreenKey(item);
  return rows.find(row => String(row.from).toLowerCase() === String(from).toLowerCase()
    && String(row.to).toLowerCase() === String(to).toLowerCase() && transferScreenKey(row.item) === key);
}

function transferScreenSetQuantity(from, to, item, quantity) {
  const key = transferScreenKey(item);
  const existing = transferScreenFindRow(transferScreenSession.draftRows, from, to, key);
  const amount = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!amount) {
    transferScreenSession.draftRows = transferScreenSession.draftRows.filter(row => row !== existing);
  } else if (existing) {
    existing.quantity = amount;
  } else {
    transferScreenSession.draftRows.push({ from, to, item:key, quantity:amount, timing:transferScreenSession.timing, notes:'' });
  }
}

function transferScreenBalance(unitCode, item) {
  const key = transferScreenKey(item);
  const base = transferScreenStock(unitCode);
  let amount = base?.get(key) ?? 0;
  for (const row of transferScreenSession?.draftRows || []) {
    if (transferScreenKey(row.item) !== key) continue;
    if (String(row.to).toLowerCase() === String(unitCode).toLowerCase()) amount += Number(row.quantity || 0);
    if (String(row.from).toLowerCase() === String(unitCode).toLowerCase()) amount -= Number(row.quantity || 0);
  }
  return { known:Boolean(base?.has(key)), amount:Math.max(0, amount), baseline:base?.get(key) ?? 0 };
}

function transferScreenIcon(item) {
  const filename = window.TribeNetItemIconManifest?.[transferScreenIconKey(item)];
  return filename
    ? `<img src="item-icons/${transferScreenEsc(filename)}" alt="" width="40" height="40" loading="lazy" decoding="async">`
    : `<span class="transfer-roster-fallback" aria-hidden="true">${transferScreenEsc(String(item || '◈').slice(0, 1))}</span>`;
}

function transferScreenRenderRoster(side) {
  const left = side === 'left';
  const unitCode = left ? transferScreenSession.from : transferScreenSession.to;
  const otherCode = left ? transferScreenSession.to : transferScreenSession.from;
  const host = document.getElementById(left ? 'transferRosterLeft' : 'transferRosterRight');
  const title = document.getElementById(left ? 'transferLeftTitle' : 'transferRightTitle');
  title.textContent = transferScreenUnitLabel(unitCode);
  const itemKeys = new Set([...(transferScreenStock(unitCode)?.keys() || []), ...(transferScreenStock(otherCode)?.keys() || [])]);
  for (const row of transferScreenSession.draftRows) itemKeys.add(transferScreenKey(row.item));
  const entries = [...itemKeys].sort((a, b) => a.localeCompare(b)).map(item => {
    const balance = transferScreenBalance(unitCode, item);
    const delta = balance.amount - balance.baseline;
    const deltaText = delta ? `<small class="transfer-roster-delta ${delta > 0 ? 'incoming' : 'outgoing'}">${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()} ${delta > 0 ? 'pending' : 'staged'}</small>` : '';
    return `<button type="button" class="transfer-roster-item${delta ? ' has-transfer' : ''}" data-transfer-side="${left ? 'left' : 'right'}" data-transfer-item="${transferScreenEsc(item)}" title="${transferScreenEsc(item)}" aria-label="${transferScreenEsc(item)}, ${balance.amount.toLocaleString()}">
      <span class="transfer-roster-icon">${transferScreenIcon(item)}<strong>${balance.amount.toLocaleString()}</strong></span><span class="transfer-roster-name">${transferScreenEsc(item)}</span>${deltaText}
    </button>`;
  });
  host.innerHTML = entries.length ? entries.join('') : '<p class="transfer-roster-empty">No items listed in the imported baseline.</p>';
  host.querySelectorAll('[data-transfer-side]').forEach(button => button.addEventListener('click', () => {
    const from = button.dataset.transferSide === 'left' ? transferScreenSession.from : transferScreenSession.to;
    const to = button.dataset.transferSide === 'left' ? transferScreenSession.to : transferScreenSession.from;
    transferScreenOpenItemEditor(from, to, button.dataset.transferItem);
  }));
  host.querySelectorAll('.transfer-roster-item img').forEach(image => image.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'transfer-roster-fallback';
    fallback.textContent = image.closest('button')?.dataset.transferItem?.slice(0, 1) || '◈';
    image.replaceWith(fallback);
  }, { once:true }));
}

function transferScreenRenderRosters() {
  if (!transferScreenSession) return;
  transferScreenRenderRoster('left');
  transferScreenRenderRoster('right');
}

function transferScreenOpenItemEditor(from, to, item) {
  const editor = document.getElementById('transferItemEditor');
  const key = transferScreenKey(item);
  const current = transferScreenFindRow(transferScreenSession.draftRows, from, to, key);
  const balance = transferScreenBalance(from, key);
  const max = balance.known ? Math.max(0, balance.amount + Number(current?.quantity || 0)) : Math.max(10000, Number(current?.quantity || 0));
  transferScreenItemDraft = { from, to, item:key };
  const qty = Number(current?.quantity || 0);
  document.getElementById('transferItemEditorTitle').textContent = `${key}: ${transferScreenUnitLabel(from)} → ${transferScreenUnitLabel(to)}`;
  document.getElementById('transferItemAvailable').textContent = balance.known
    ? `Available to transfer: ${max.toLocaleString()}`
    : 'No quantity is available in the imported baseline; enter the amount to transfer.';
  const number = document.getElementById('transferQuantity');
  const slider = document.getElementById('transferQuantitySlider');
  number.max = String(max);
  number.value = String(Math.min(qty, max));
  slider.max = String(max);
  slider.value = String(Math.min(qty, max));
  slider.disabled = max <= 0;
  editor.hidden = false;
  number.focus();
}

function transferScreenQuantityChanged(value, source) {
  const number = document.getElementById('transferQuantity');
  const slider = document.getElementById('transferQuantitySlider');
  let amount = Math.max(0, Math.floor(Number(value) || 0));
  const max = Number(number.max || slider.max || 0);
  if (transferScreenItemDraft && transferScreenBalance(transferScreenItemDraft.from, transferScreenItemDraft.item).known) amount = Math.min(amount, max);
  if (source === 'slider') number.value = String(amount);
  else {
    number.value = String(amount);
    if (amount > Number(slider.max)) slider.max = String(amount);
    slider.value = String(Math.min(amount, Number(slider.max)));
  }
}

async function transferScreenLoadGroup(from, to, timing) {
  const turnKey = savedMovementCurrentTurnKey();
  const a = String(from || '').trim(); const b = String(to || '').trim();
  const phase = String(timing || 'BM').toUpperCase() === 'AM' ? 'AM' : 'BM';
  const all = turnKey && b ? await window.tribenet.listPlannedTransfers(turnKey) : [];
  const group = all.filter(row => transferScreenPairMatches(row, a, b) && String(row.timing).toUpperCase() === phase)
    .map(row => ({ from:row.from, to:row.to, item:transferScreenKey(row.item), quantity:Number(row.quantity), timing:phase, notes:row.notes || '' }));
  transferScreenSession = { turnKey, from:a, to:b, timing:phase, originalRows:structuredClone(group), draftRows:structuredClone(group) };
  transferScreenRenderRosters();
}

async function transferScreenOpen({ from = '', to = '', timing = 'BM' } = {}) {
  const dialog = document.getElementById('transferDialog');
  const turnKey = savedMovementCurrentTurnKey();
  if (!dialog || !turnKey) return false;
  const units = savedMovementUnits();
  const fromCode = from || transferScreenCode(savedMovementSelectedUnit());
  const sourceUnit = units.find(unit => transferScreenCode(unit).toLowerCase() === String(fromCode).toLowerCase());
  if (!sourceUnit) return false;
  document.getElementById('transferFromLabel').textContent = transferScreenUnitLabel(fromCode);
  const toSelect = document.getElementById('transferTo');
  const phaseSelect = document.getElementById('transferTiming');
  phaseSelect.value = String(timing).toUpperCase() === 'AM' || (sourceUnit.plannedSplit && sourceUnit.creationPhase === 'after') ? 'AM' : 'BM';
  transferScreenPopulateTargets(fromCode, phaseSelect.value, to);
  document.getElementById('transferStatus').textContent = '';
  await transferScreenLoadGroup(fromCode, toSelect.value, phaseSelect.value);
  transferScreenRenderOverviewButton();
  if (!dialog.open) dialog.showModal();
  return true;
}

async function transferScreenSelectionChanged() {
  if (!transferScreenSession) return;
  const from = transferScreenSession.from;
  const phaseSelect = document.getElementById('transferTiming');
  const toSelect = document.getElementById('transferTo');
  const timing = phaseSelect.value;
  const targets = transferScreenPopulateTargets(from, timing, toSelect.value);
  const to = toSelect.value;
  const changedGroup = transferScreenRowsSignature(transferScreenSession.draftRows) !== transferScreenRowsSignature(transferScreenSession.originalRows);
  if (changedGroup && !window.confirm('Discard the unsaved edits to this unit pair and transfer phase?')) {
    phaseSelect.value = transferScreenSession.timing;
    transferScreenPopulateTargets(from, phaseSelect.value, transferScreenSession.to);
    return;
  }
  if (!targets.length || !to) {
    if (changedGroup && transferScreenSession.draftRows.length) {
      document.getElementById('transferStatus').textContent = 'This phase has no other unit at the same location.';
    }
    await transferScreenLoadGroup(from, '', timing);
    return;
  }
  document.getElementById('transferStatus').textContent = '';
  await transferScreenLoadGroup(from, to, timing);
}

function transferScreenRenderOverviewButton(rows = null) {
  const count = document.getElementById('transferOverviewCount');
  if (!count) return;
  const turnKey = savedMovementCurrentTurnKey();
  if (!turnKey) { count.textContent = '0'; return; }
  if (rows) { count.textContent = String(rows.length); return; }
  window.tribenet.listPlannedTransfers(turnKey).then(transfers => { count.textContent = String(transfers.length); }).catch(() => { count.textContent = '0'; });
}

async function transferScreenRenderOverview() {
  const turnKey = savedMovementCurrentTurnKey();
  const rows = turnKey ? await window.tribenet.listPlannedTransfers(turnKey) : [];
  savedMovementPlansState.transfers = rows;
  transferScreenRenderOverviewButton(rows);
  document.getElementById('transferOverviewTurn').textContent = turnKey ? `Turn ${turnKey} · ${rows.length} transfer line${rows.length === 1 ? '' : 's'}` : 'No planning turn is selected.';
  const host = document.getElementById('transferOverviewRows');
  host.innerHTML = rows.length ? rows.map(row => `<tr>
    <td>${transferScreenEsc(row.from)}</td><td>${transferScreenEsc(row.to)}</td><td><span class="transfer-table-item">${transferScreenIcon(row.item)}${transferScreenEsc(row.item)}</span></td>
    <td>${Number(row.quantity).toLocaleString()}</td><td>${row.timing === 'AM' ? 'After Movement' : 'Before Movement'}</td><td>${transferScreenEsc(row.notes || '')}</td>
    <td><button type="button" class="button tm-mini" data-transfer-edit="${Number(row.id)}">Edit pair</button></td></tr>`).join('')
    : '<tr><td class="transfer-overview-empty" colspan="7">No transfers planned for this turn.</td></tr>';
  host.querySelectorAll('[data-transfer-edit]').forEach(button => button.addEventListener('click', async () => {
    const row = rows.find(item => Number(item.id) === Number(button.dataset.transferEdit));
    if (!row) return;
    document.getElementById('transferOverviewDialog').close();
    await transferScreenOpen({ from:row.from, to:row.to, timing:row.timing });
  }));
}

async function transferScreenOpenOverview() {
  const dialog = document.getElementById('transferOverviewDialog');
  if (!dialog || !savedMovementCurrentTurnKey()) return false;
  await transferScreenRenderOverview();
  if (!dialog.open) dialog.showModal();
  return true;
}

async function transferScreenSave() {
  const session = transferScreenSession;
  if (!session?.from || !session?.to || session.from.toLowerCase() === session.to.toLowerCase()) {
    document.getElementById('transferStatus').textContent = 'No other unit shares this location for the selected phase.';
    return;
  }
  try {
    await window.tribenet.replacePlannedTransferGroup(session.turnKey, session.from, session.to, session.timing, transferScreenSessionRows());
    const refreshed = await window.tribenet.listPlannedTransfers(session.turnKey);
    savedMovementPlansState.transfers = refreshed;
    transferScreenRenderOverviewButton(refreshed);
    document.getElementById('transferDialog').close();
    if (typeof turnActionsRender === 'function') turnActionsRender();
  } catch (error) {
    document.getElementById('transferStatus').textContent = error.message || String(error);
  }
}

function transferScreenCancel() {
  transferScreenItemDraft = null;
  document.getElementById('transferItemEditor').hidden = true;
  document.getElementById('transferDialog').close();
  transferScreenSession = null;
}

async function transferScreenCancelAll() {
  const turnKey = savedMovementCurrentTurnKey();
  if (!turnKey || !window.confirm(`Cancel every transfer planned for turn ${turnKey}? This cannot be undone.`)) return;
  await window.tribenet.deleteAllPlannedTransfers(turnKey);
  savedMovementPlansState.transfers = [];
  await transferScreenRenderOverview();
  if (typeof turnActionsRender === 'function') turnActionsRender();
}

document.getElementById('transferTo')?.addEventListener('change', transferScreenSelectionChanged);
document.getElementById('transferTiming')?.addEventListener('change', transferScreenSelectionChanged);
document.getElementById('transferQuantity')?.addEventListener('input', event => transferScreenQuantityChanged(event.target.value, 'number'));
document.getElementById('transferQuantitySlider')?.addEventListener('input', event => transferScreenQuantityChanged(event.target.value, 'slider'));
document.getElementById('transferItemCancel')?.addEventListener('click', () => { transferScreenItemDraft = null; document.getElementById('transferItemEditor').hidden = true; });
document.getElementById('transferItemApply')?.addEventListener('click', () => {
  if (!transferScreenItemDraft) return;
  const qty = Number(document.getElementById('transferQuantity').value);
  const balance = transferScreenBalance(transferScreenItemDraft.from, transferScreenItemDraft.item);
  const current = transferScreenFindRow(transferScreenSession.draftRows, transferScreenItemDraft.from, transferScreenItemDraft.to, transferScreenItemDraft.item);
  const max = balance.known ? balance.amount + Number(current?.quantity || 0) : qty;
  if (qty > max) { document.getElementById('transferItemAvailable').textContent = `Only ${max.toLocaleString()} are available in the imported baseline.`; return; }
  transferScreenSetQuantity(transferScreenItemDraft.from, transferScreenItemDraft.to, transferScreenItemDraft.item, qty);
  transferScreenItemDraft = null;
  document.getElementById('transferItemEditor').hidden = true;
  transferScreenRenderRosters();
});
document.getElementById('transferSave')?.addEventListener('click', transferScreenSave);
document.getElementById('transferCancel')?.addEventListener('click', transferScreenCancel);
document.getElementById('transferClose')?.addEventListener('click', transferScreenCancel);
document.getElementById('transferOverviewClose')?.addEventListener('click', () => document.getElementById('transferOverviewDialog').close());
document.getElementById('transferOverviewDone')?.addEventListener('click', () => document.getElementById('transferOverviewDialog').close());
document.getElementById('transferCancelAll')?.addEventListener('click', transferScreenCancelAll);
document.getElementById('openTransferOverviewButton')?.addEventListener('click', transferScreenOpenOverview);

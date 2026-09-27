const SELECTED_TURN_KEY = 'tribenet:selectedResultTurn';

const tmState = {
  turns: [],
  turn: null,
  selectedUnitCode: null,
  playTimer: null
};

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' }[c]));
}

function formatNumber(value) {
  return value == null ? '—' : nf.format(value);
}

function formatDelta(value, hasPrevious = true) {
  if (!hasPrevious) return '<span class="tm-delta tm-delta-new">new</span>';
  if (value == null || Number(value) === 0) return '<span class="tm-delta tm-delta-flat">—</span>';
  const n = Number(value);
  const cls = n > 0 ? 'tm-delta-up' : 'tm-delta-down';
  return `<span class="tm-delta ${cls}">${n > 0 ? '+' : ''}${escapeHtml(nf.format(n))}</span>`;
}

function stopPlayback() {
  if (tmState.playTimer) clearInterval(tmState.playTimer);
  tmState.playTimer = null;
  $('timelinePlay').textContent = 'Play';
}

function timelineIndex() {
  return Math.max(0, tmState.turns.findIndex(t => t.turnKey === tmState.turn?.turnKey));
}

async function initializeTribeManager() {
  try {
    const version = await window.tribenet.getVersion();
    $('tribeManagerVersion').textContent = `Version ${version} · Historical Tribe / Unit snapshots`;
  } catch (_) {}
  bindEvents();
  await refreshTurns();
}

async function refreshTurns(preferredTurnKey = null) {
  tmState.turns = await window.tribenet.listResultTurns();
  const slider = $('timelineSlider');
  slider.min = '0';
  slider.max = String(Math.max(0, tmState.turns.length - 1));
  slider.disabled = tmState.turns.length === 0;
  $('timelinePrev').disabled = tmState.turns.length < 2;
  $('timelineNext').disabled = tmState.turns.length < 2;
  $('timelinePlay').disabled = tmState.turns.length < 2;

  if (!tmState.turns.length) {
    tmState.turn = null;
    $('timelineTurnTitle').textContent = 'No results imported';
    $('timelineSource').textContent = 'Import a Word results report to begin.';
    $('timelineFirstTurn').textContent = '—';
    $('timelineCurrentTurn').textContent = '—';
    $('timelineLastTurn').textContent = '—';
    renderUnits();
    return;
  }

  const stored = preferredTurnKey || localStorage.getItem(SELECTED_TURN_KEY);
  const selected = tmState.turns.find(t => t.turnKey === stored) || tmState.turns[tmState.turns.length - 1];
  await selectTurn(selected.turnKey, false);
}

async function selectTurn(turnKey, persist = true) {
  stopPlayback();
  const detail = await window.tribenet.getResultTurn(turnKey);
  if (!detail) return;
  tmState.turn = detail;
  if (persist) localStorage.setItem(SELECTED_TURN_KEY, turnKey);

  const idx = tmState.turns.findIndex(t => t.turnKey === turnKey);
  $('timelineSlider').value = String(Math.max(0, idx));
  $('timelineTurnTitle').textContent = `Turn ${detail.turnKey}`;
  $('timelineSource').textContent = `${detail.sourceFile} · imported ${new Date(detail.importedAt).toLocaleString()}`;
  $('timelineFirstTurn').textContent = tmState.turns[0]?.turnKey || '—';
  $('timelineCurrentTurn').textContent = detail.turnKey;
  $('timelineLastTurn').textContent = tmState.turns[tmState.turns.length - 1]?.turnKey || '—';

  if (!detail.units.some(u => u.unitCode === tmState.selectedUnitCode)) {
    tmState.selectedUnitCode = detail.units[0]?.unitCode || null;
  }
  renderUnits();
  renderSelectedUnit();
}

function renderUnits() {
  const host = $('unitList');
  host.innerHTML = '';
  const units = tmState.turn?.units || [];
  $('unitCount').textContent = String(units.length);
  if (!units.length) {
    host.innerHTML = '<div class="tm-empty">No unit snapshots for this turn.</div>';
    $('unitEmpty').classList.remove('hidden');
    $('unitDetail').classList.add('hidden');
    return;
  }

  const order = { Tribe: 0, Element: 1, Fleet: 2, Garrison: 3 };
  for (const unit of [...units].sort((a,b) => (order[a.unitType] ?? 9) - (order[b.unitType] ?? 9) || a.unitCode.localeCompare(b.unitCode))) {
    const button = document.createElement('button');
    button.className = `tm-unit-card${unit.unitCode === tmState.selectedUnitCode ? ' active' : ''}`;
    button.innerHTML = `
      <div class="tm-unit-card-main"><strong>${escapeHtml(unit.unitCode)}</strong><span>${escapeHtml(unit.unitType)}</span></div>
      <div class="tm-unit-card-meta"><span>${escapeHtml(unit.currentHex || 'No hex')}</span><span>${escapeHtml(unit.statusTerrain || 'UNKNOWN')}</span></div>
    `;
    button.addEventListener('click', () => {
      tmState.selectedUnitCode = unit.unitCode;
      renderUnits();
      renderSelectedUnit();
    });
    host.appendChild(button);
  }
}

function renderSelectedUnit() {
  const unit = tmState.turn?.units?.find(u => u.unitCode === tmState.selectedUnitCode);
  if (!unit) {
    $('unitEmpty').classList.remove('hidden');
    $('unitDetail').classList.add('hidden');
    return;
  }
  $('unitEmpty').classList.add('hidden');
  $('unitDetail').classList.remove('hidden');
  $('unitTypeEyebrow').textContent = unit.unitType.toUpperCase();
  $('unitTitle').textContent = unit.unitCode;
  $('unitLocation').textContent = `${unit.currentHex || 'Unknown location'}${unit.previousHex ? ` · previous ${unit.previousHex}` : ''}`;
  $('unitTerrain').textContent = unit.statusTerrain || 'UNKNOWN';
  $('unitPreviousTurn').textContent = unit.previousTurnKey ? `Compared with ${unit.previousTurnKey}` : 'First recorded turn';
  renderSummary(unit);
  renderResources(unit);
  renderSkills(unit);
  renderMovement(unit);
  renderEvents(unit);
}

function renderSummary(unit) {
  const hasPrevious = Boolean(unit.previousTurnKey);
  const metrics = [
    ['People', unit.people?.People, unit.deltas?.people?.People],
    ['Warriors', unit.people?.Warriors, unit.deltas?.people?.Warriors],
    ['Actives', unit.people?.Actives, unit.deltas?.people?.Actives],
    ['Inactives', unit.people?.Inactives, unit.deltas?.people?.Inactives],
    ['Weight', unit.weight, unit.deltas?.weight],
    ['Walking CC', unit.walkingCapacity, unit.deltas?.walkingCapacity],
    ['Mounted CC', unit.mountedCapacity, unit.deltas?.mountedCapacity],
    ['Morale', unit.morale, unit.deltas?.morale]
  ];
  $('summaryGrid').innerHTML = metrics.map(([label, value, delta]) => `
    <div class="tm-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(value)}</strong>
      ${formatDelta(delta, hasPrevious)}
    </div>
  `).join('');
}

function renderResources(unit) {
  const host = $('resourceSections');
  host.innerHTML = '';
  const hasPrevious = Boolean(unit.previousTurnKey);
  const sections = Object.entries(unit.resources || {}).filter(([, values]) => Object.keys(values || {}).length);
  if (!sections.length) {
    host.innerHTML = '<div class="tm-empty">No resources reported for this unit.</div>';
    return;
  }
  for (const [section, values] of sections) {
    const wrap = document.createElement('div');
    wrap.className = 'tm-resource-card';
    const rows = Object.entries(values).sort(([a],[b]) => a.localeCompare(b)).map(([name, value]) => {
      const delta = unit.deltas?.resources?.[section]?.[name];
      return `<div class="tm-resource-row"><span>${escapeHtml(name)}</span><strong>${formatNumber(value)}</strong>${formatDelta(delta, hasPrevious)}</div>`;
    }).join('');
    wrap.innerHTML = `<h3>${escapeHtml(section)}</h3><div class="tm-resource-list">${rows}</div>`;
    host.appendChild(wrap);
  }
}

function renderSkills(unit) {
  const host = $('skillsGrid');
  const skills = Object.entries(unit.skills || {}).sort(([a],[b]) => a.localeCompare(b));
  const hasPrevious = Boolean(unit.previousTurnKey);
  if (!skills.length) {
    host.innerHTML = '<div class="tm-empty">No skills listed for this unit.</div>';
    return;
  }
  host.innerHTML = skills.map(([name, value]) => `
    <div class="tm-skill-row"><span>${escapeHtml(name)}</span><strong>${formatNumber(value)}</strong>${formatDelta(unit.deltas?.skills?.[name], hasPrevious)}</div>
  `).join('');
}

function renderMovement(unit) {
  const host = $('movementDetails');
  const items = [];
  if (unit.movement) items.push(`<div class="tm-event"><strong>Movement</strong><span>${escapeHtml(unit.movement)}</span></div>`);
  if (unit.movementWeight != null || unit.movementWalkingCapacity != null || unit.movementMountedCapacity != null) {
    items.push(`<div class="tm-event"><strong>Movement load</strong><span>${formatNumber(unit.movementWeight)} weight · ${formatNumber(unit.movementWalkingCapacity)} walking · ${formatNumber(unit.movementMountedCapacity)} mounted</span></div>`);
  }
  for (const scout of unit.scouts || []) {
    const blocked = /Not enough M\.P/i.test(scout.raw || scout.report || '');
    items.push(`<div class="tm-event${blocked ? ' tm-event-warning' : ''}"><strong>Scout ${escapeHtml(scout.id)}</strong><span>${escapeHtml(scout.report)}</span></div>`);
  }
  host.innerHTML = items.join('') || '<div class="tm-empty">No movement or scouting details reported.</div>';
}

function renderEvents(unit) {
  const host = $('eventList');
  const events = (tmState.turn?.events || []).filter(e => !e.unitCode || e.unitCode === unit.unitCode);
  if (!events.length) {
    host.innerHTML = '<div class="tm-empty">No activity events reported for this unit.</div>';
    return;
  }
  host.innerHTML = events.map(event => `
    <div class="tm-event">
      <strong>${escapeHtml(event.eventType.replace(/(^|\s)\S/g, s => s.toUpperCase()))}</strong>
      <span>${escapeHtml(event.message)}</span>
    </div>
  `).join('');
}

async function importResults() {
  $('importResultsButton').disabled = true;
  $('importStatus').textContent = 'Importing Word results report…';
  try {
    const result = await window.tribenet.importResultsReport();
    if (result?.canceled) { $('importStatus').textContent = 'Import cancelled.'; return; }
    if (result?.error) { $('importStatus').textContent = `Import failed: ${result.error}`; return; }
    localStorage.setItem(SELECTED_TURN_KEY, result.turn.turnKey);
    await refreshTurns(result.turn.turnKey);
    $('importStatus').textContent = `Turn ${result.turn.turnKey} imported. Re-importing this turn will replace its stored snapshot.`;
  } finally {
    $('importResultsButton').disabled = false;
  }
}

function moveTimeline(offset) {
  if (!tmState.turns.length) return;
  const next = Math.max(0, Math.min(tmState.turns.length - 1, timelineIndex() + offset));
  selectTurn(tmState.turns[next].turnKey);
}

function togglePlayback() {
  if (tmState.playTimer) { stopPlayback(); return; }
  if (tmState.turns.length < 2) return;
  $('timelinePlay').textContent = 'Pause';
  if (timelineIndex() >= tmState.turns.length - 1) selectTurn(tmState.turns[0].turnKey);
  tmState.playTimer = setInterval(() => {
    const idx = timelineIndex();
    if (idx >= tmState.turns.length - 1) { stopPlayback(); return; }
    const nextTurn = tmState.turns[idx + 1].turnKey;
    window.tribenet.getResultTurn(nextTurn).then(detail => {
      if (!detail) return;
      tmState.turn = detail;
      localStorage.setItem(SELECTED_TURN_KEY, nextTurn);
      $('timelineSlider').value = String(idx + 1);
      $('timelineTurnTitle').textContent = `Turn ${detail.turnKey}`;
      $('timelineSource').textContent = `${detail.sourceFile} · imported ${new Date(detail.importedAt).toLocaleString()}`;
      $('timelineCurrentTurn').textContent = detail.turnKey;
      if (!detail.units.some(u => u.unitCode === tmState.selectedUnitCode)) tmState.selectedUnitCode = detail.units[0]?.unitCode || null;
      renderUnits();
      renderSelectedUnit();
    });
  }, 1100);
}

function bindEvents() {
  $('importResultsButton').addEventListener('click', importResults);
  $('backupResultsButton').addEventListener('click', async () => {
    const backupPath = await window.tribenet.backupResults();
    $('importStatus').textContent = `Backup created: ${backupPath}`;
    await window.tribenet.showBackup(backupPath);
  });
  $('timelinePrev').addEventListener('click', () => moveTimeline(-1));
  $('timelineNext').addEventListener('click', () => moveTimeline(1));
  $('timelinePlay').addEventListener('click', togglePlayback);
  $('timelineSlider').addEventListener('input', event => {
    const turn = tmState.turns[Number(event.target.value)];
    if (turn) selectTurn(turn.turnKey);
  });
}

initializeTribeManager();

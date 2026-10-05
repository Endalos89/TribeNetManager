const MAP_ROWS = 26;
const MAP_COLS = 16;
const HEX_COLS = 30;
const HEX_ROWS = 21;
const TOTAL_COLS = MAP_COLS * HEX_COLS;
const TOTAL_ROWS = MAP_ROWS * HEX_ROWS;
const SQRT3 = Math.sqrt(3);

const TERRAIN = [
  ['UNKNOWN', 'Unknown'], ['ALPS', 'Alps'], ['AR', 'Arid'], ['BH', 'Brush Hill'], ['BR', 'Brush'],
  ['CH', 'Conifer Hill'], ['DE', 'Desert'], ['D', 'Deciduous'], ['DH', 'Deciduous Hill'],
  ['GH', 'Grassy Hill'], ['GHP', 'Grassy Hill Plateau'], ['HSM', 'High Mountains'], ['JG', 'Jungle'],
  ['JH', 'Jungle Hill'], ['L', 'Lake'], ['LAM', 'Low Arid Mountains'], ['LCM', 'Low Conifer Mountains'],
  ['LJM', 'Low Jungle Mountain'], ['LSM', 'Low Snowy Mountains'], ['LVM', 'Low Volcanic Mountains'],
  ['O', 'Ocean'], ['PP', 'Plateau Prairie'], ['PGH', 'Plateau Grassy Hill'], ['PI', 'Polar Ice'],
  ['PR', 'Prairie'], ['PPR', 'Prairie Plateau'], ['RH', 'Rocky Hill'], ['SH', 'Snow Hill'],
  ['SW', 'Swamp'], ['TU', 'Tundra']
];

const terrainStyle = {
  UNKNOWN: ['#68747b', '#dfe5e8'], ALPS: ['#7f8b90', '#fff'], AR: ['#b7a66d', '#25231b'],
  BH: ['#7e8953', '#10140e'], BR: ['#7f9951', '#13210f'], CH: ['#4c752f', '#eef7e8'],
  DE: ['#d9bd65', '#332a10'], D: ['#60963d', '#edf8e8'], DH: ['#557f36', '#edf8e8'],
  GH: ['#83b653', '#12200e'], GHP: ['#97c76b', '#13200f'], HSM: ['#a7b4ba', '#192126'],
  JG: ['#2e7a3d', '#eff9f0'], JH: ['#286b35', '#eff9f0'], L: ['#317da4', '#eefaff'],
  LAM: ['#96733a', '#fff4df'], LCM: ['#5c7137', '#f4f8e7'], LJM: ['#345e34', '#f1f8ea'],
  LSM: ['#8f9fa5', '#192126'], LVM: ['#6f523b', '#fff1e7'], O: ['#126b94', '#edfaff'],
  PP: ['#b3d875', '#1c2812'], PGH: ['#91c26a', '#14200f'], PI: ['#dbeff3', '#223036'],
  PR: ['#a5d66e', '#182511'], PPR: ['#b9dc83', '#1b2812'], RH: ['#81765d', '#fff6e7'],
  SH: ['#b8c5b0', '#1a2418'], SW: ['#527f65', '#eff8f3'], TU: ['#9eae72', '#1d2415']
};

const state = {
  mode: 'overview', cameraX: 0, cameraY: 0, scale: 29, selected: null,
  hexCache: new Map(), loadedArea: null, dragging: false, dragStart: null, summaries: new Map(),
  planningVisible: true, scoutingVisible: true, planningPanelCollapsed: true, planImport: null, planHistory: [], routeCache: null,
  selectedUnitHex: null
};

const $ = id => document.getElementById(id);
const canvas = $('mapCanvas');
const ctx = canvas.getContext('2d');

function letter(index) { return String.fromCharCode(65 + index); }
function submapCode(mapRow, mapCol) { return `${letter(mapRow)}${letter(mapCol)}`; }
function coordinateFor(globalCol, globalRow) {
  const mapCol = Math.floor(globalCol / HEX_COLS);
  const mapRow = Math.floor(globalRow / HEX_ROWS);
  const hexCol = (globalCol % HEX_COLS) + 1;
  const hexRow = (globalRow % HEX_ROWS) + 1;
  return `${submapCode(mapRow, mapCol)}${String(hexCol).padStart(2, '0')}${String(hexRow).padStart(2, '0')}`;
}
function parseCoordinate(input) {
  const cleaned = String(input || '').toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!match) return null;
  const mapRow = match[1].charCodeAt(0) - 65;
  const mapCol = match[2].charCodeAt(0) - 65;
  const hexCol = Number(match[3]);
  const hexRow = Number(match[4]);
  if (hexCol < 1 || hexCol > 30 || hexRow < 1 || hexRow > 21) return null;
  const globalCol = mapCol * HEX_COLS + hexCol - 1;
  const globalRow = mapRow * HEX_ROWS + hexRow - 1;
  return { coordinate: `${match[1]}${match[2]}${match[3]}${match[4]}`, mapRow, mapCol, hexCol, hexRow, globalCol, globalRow };
}
function baseCenter(globalCol, globalRow) {
  return { x: 1 + globalCol * 1.5, y: SQRT3 / 2 + SQRT3 * (globalRow + (globalCol % 2 ? 0.5 : 0)) };
}
function centerOnHex(globalCol, globalRow) {
  const p = baseCenter(globalCol, globalRow); state.cameraX = p.x; state.cameraY = p.y; requestVisibleData(); draw();
}
function centerOnSubmap(mapRow, mapCol) {
  showDetail(); centerOnHex(mapCol * HEX_COLS + Math.floor(HEX_COLS / 2), mapRow * HEX_ROWS + Math.floor(HEX_ROWS / 2));
}

async function initialize() {
  const version = await window.tribenet.getVersion();
  $('versionLabel').textContent = `Version ${version} · Local desktop application`;
  $('dataPathLabel').textContent = await window.tribenet.getUserDataPath();
  populateTerrain(); bindEvents(); await refreshSummaries(); buildWorldGrid(); await refreshPlannerHistory();
  window.tribenet.onUpdateStatus(updateUpdateUI);
}

function populateTerrain() {
  for (const [code, name] of TERRAIN) {
    const option = document.createElement('option'); option.value = code; option.textContent = `${code} — ${name}`; $('terrainSelect').appendChild(option);
  }
}
async function refreshSummaries() {
  const rows = await window.tribenet.getSubmapSummaries(); state.summaries.clear();
  for (const row of rows) state.summaries.set(`${row.mapRow}:${row.mapCol}`, Number(row.mapped));
}
function buildWorldGrid() {
  const grid = $('worldGrid'); grid.innerHTML = ''; grid.appendChild(document.createElement('div'));
  for (let c = 0; c < MAP_COLS; c++) { const h = document.createElement('div'); h.className = 'world-header'; h.textContent = letter(c); grid.appendChild(h); }
  for (let r = 0; r < MAP_ROWS; r++) {
    const rh = document.createElement('div'); rh.className = 'world-row-header'; rh.textContent = letter(r); grid.appendChild(rh);
    for (let c = 0; c < MAP_COLS; c++) {
      const mapped = state.summaries.get(`${r}:${c}`) || 0;
      const cell = document.createElement('button'); cell.className = `submap-cell${mapped ? ' has-data' : ''}`;
      cell.innerHTML = `<span class="map-code">${submapCode(r,c)}</span><span class="map-progress">${mapped ? `${mapped}/630 mapped` : 'Fog'}</span>`;
      cell.addEventListener('click', () => centerOnSubmap(r, c)); grid.appendChild(cell);
    }
  }
}
function showLauncher() { $('launcherView').classList.remove('hidden'); $('mapperView').classList.add('hidden'); }
function showMapper(options = {}) {
  // The terrain view is the default mapper experience. Keep the classic
  // renderer available through the switch, but do not make a new user opt in.
  if (typeof IsoMapper !== 'undefined' && !IsoMapper.enabled && $('mapperViewToggle')?.checked) {
    IsoMapper.setEnabled(true, { overview: false });
  }
  $('launcherView').classList.add('hidden'); $('mapperView').classList.remove('hidden');
  if (options.overview !== false) showOverview();
  else if (state.mode === 'detail') { resizeCanvas(); requestVisibleData(); draw(); }
}
function showOverview() {
  state.mode = 'overview'; $('overviewPanel').classList.remove('hidden'); $('detailPanel').classList.add('hidden'); $('detailControls').classList.add('hidden');
  $('overviewButton').classList.add('active'); updatePlanUI(); refreshSummaries().then(buildWorldGrid);
}
function showDetail() {
  state.mode = 'detail'; $('overviewPanel').classList.add('hidden'); $('detailPanel').classList.remove('hidden'); $('detailControls').classList.remove('hidden');
  $('overviewButton').classList.remove('active'); updatePlanUI(); requestAnimationFrame(() => { resizeCanvas(); draw(); requestVisibleData(); });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function screenFromBase(p) { if (typeof IsoMapper !== "undefined" && IsoMapper.enabled) return IsoMapper.project(p); const rect = canvas.getBoundingClientRect(); return { x: (p.x - state.cameraX) * state.scale + rect.width / 2, y: (p.y - state.cameraY) * state.scale + rect.height / 2 }; }
function baseFromScreen(x, y) { if (typeof IsoMapper !== "undefined" && IsoMapper.enabled) return IsoMapper.inverse(x,y); const rect = canvas.getBoundingClientRect(); return { x: (x - rect.width / 2) / state.scale + state.cameraX, y: (y - rect.height / 2) / state.scale + state.cameraY }; }
function visibleBounds() {
  if (typeof IsoMapper !== "undefined" && IsoMapper.enabled) return IsoMapper.bounds();
  const rect = canvas.getBoundingClientRect();
  const minBaseX = state.cameraX - rect.width / (2 * state.scale) - 2, maxBaseX = state.cameraX + rect.width / (2 * state.scale) + 2;
  const minBaseY = state.cameraY - rect.height / (2 * state.scale) - SQRT3 * 2, maxBaseY = state.cameraY + rect.height / (2 * state.scale) + SQRT3 * 2;
  return {
    minCol: Math.max(0, Math.floor((minBaseX - 1) / 1.5) - 2), maxCol: Math.min(TOTAL_COLS - 1, Math.ceil((maxBaseX - 1) / 1.5) + 2),
    minRow: Math.max(0, Math.floor(minBaseY / SQRT3) - 2), maxRow: Math.min(TOTAL_ROWS - 1, Math.ceil(maxBaseY / SQRT3) + 2)
  };
}
let areaRequestTimer;
function requestVisibleData() {
  if (state.mode !== 'detail') return; clearTimeout(areaRequestTimer);
  areaRequestTimer = setTimeout(async () => {
    const b = visibleBounds(); const rows = await window.tribenet.getHexesInArea(b);
    for (const row of rows) state.hexCache.set(row.coordinate, row); state.loadedArea = b;
    // Follow-ocean routes depend on revealed terrain. Re-evaluate them after
    // each area refresh so the marker advances as scouting data arrives.
    if (state.planImport?.plan) state.routeCache = null;
    draw();
  }, 55);
}

function hexPath(cx, cy, radius) {
  if (typeof IsoMapper !== "undefined" && IsoMapper.enabled) {
    ctx.beginPath(); IsoGeometry.corners.forEach((p,i)=>{const q=IsoGeometry.project(p.x*radius,p.y*radius); i?ctx.lineTo(cx+q.x,cy+q.y):ctx.moveTo(cx+q.x,cy+q.y);});ctx.closePath();return;
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const angle = Math.PI / 180 * (60 * i); const x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath();
}
function drawFog(cx, cy, radius, showQuestion = true) {
  // Always establish the hex path before filling. Playback can draw fog as an
  // overlay after the terrain pass, when no current path is guaranteed.
  hexPath(cx, cy, radius); ctx.fillStyle = '#18242b'; ctx.fill(); ctx.save(); hexPath(cx, cy, radius); ctx.clip(); ctx.strokeStyle = '#263842'; ctx.lineWidth = Math.max(1, radius * .055);
  for (let d = -radius * 2; d < radius * 2; d += Math.max(7, radius * .32)) { ctx.beginPath(); ctx.moveTo(cx - radius, cy + d); ctx.lineTo(cx + radius, cy + d + radius * .75); ctx.stroke(); }
  ctx.restore(); if (showQuestion && radius > 18) { ctx.fillStyle = '#78909b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(11, radius * .52)}px Segoe UI`; ctx.fillText('?', cx, cy + 1); }
}
function drawTerrain(cx, cy, radius, terrain) {
  const style = terrainStyle[terrain] || terrainStyle.UNKNOWN; ctx.fillStyle = style[0]; ctx.fill();
  if (radius > 12) { ctx.fillStyle = style[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.min(15, Math.max(8, radius * .38))}px Segoe UI`; ctx.fillText(terrain === 'UNKNOWN' ? '?' : terrain, cx, cy + 1); }
}

function draw() {
  if (state.mode !== 'detail') return;
  if (typeof IsoMapper !== 'undefined' && IsoMapper.enabled) return IsoMapper.draw();
  const rect = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = '#05090c'; ctx.fillRect(0, 0, rect.width, rect.height);
  const bounds = visibleBounds(), radius = state.scale * .96;
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const p = screenFromBase(baseCenter(col, row));
      if (p.x < -radius * 2 || p.x > rect.width + radius * 2 || p.y < -radius * 2 || p.y > rect.height + radius * 2) continue;
      hexPath(p.x, p.y, radius); const coord = coordinateFor(col, row), targetData = state.hexCache.get(coord);
      const data = typeof resultsPlaybackMapData === 'function' ? resultsPlaybackMapData(coord, targetData) : targetData;
      if (data) drawTerrain(p.x, p.y, radius, data.terrain);
      else {
        // Playback owns the reveal question marker. Keep staged destinations
        // as clean fog until the scout reaches them, then let the overlay draw
        // the single centred '?' for a partial attempt.
        const staged = window.resultsPlayback?.active && window.resultsPlayback.revealTargets?.has(coord);
        drawFog(p.x, p.y, radius, !staged);
      }
      ctx.strokeStyle = '#071116'; ctx.lineWidth = Math.max(1, state.scale * .055); ctx.stroke();
      if (state.selected && state.selected.coordinate === coord) { hexPath(p.x, p.y, radius * .91); ctx.strokeStyle = '#f4df72'; ctx.lineWidth = Math.max(2, state.scale * .12); ctx.stroke(); }
      if (state.scale >= 39) { ctx.fillStyle = 'rgba(235,244,248,.62)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `${Math.max(8, state.scale * .20)}px Segoe UI`; ctx.fillText(coord, p.x, p.y + radius * .72); }
    }
  }
  drawSubmapLabels(bounds); drawWorldBorder();
  if (state.planningVisible && state.planImport?.plan) drawPlanOverlay();
  drawSelectedUnitHighlight();
  if (typeof drawResultsPlaybackOverlay === 'function') drawResultsPlaybackOverlay();
  updateCenterReadout();
}
function drawSubmapLabels(bounds) {
  if (state.scale < 15) return;
  const firstMapCol = Math.floor(bounds.minCol / HEX_COLS), lastMapCol = Math.floor(bounds.maxCol / HEX_COLS), firstMapRow = Math.floor(bounds.minRow / HEX_ROWS), lastMapRow = Math.floor(bounds.maxRow / HEX_ROWS);
  ctx.save(); ctx.font = `800 ${Math.max(15, Math.min(30, state.scale * .7))}px Segoe UI`; ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let mr = firstMapRow; mr <= lastMapRow; mr++) for (let mc = firstMapCol; mc <= lastMapCol; mc++) { const p = screenFromBase(baseCenter(mc * HEX_COLS, mr * HEX_ROWS)); ctx.fillText(submapCode(mr, mc), p.x - state.scale * .7, p.y - state.scale * .72); }
  ctx.restore();
}
function drawWorldBorder() {
  const topLeft = screenFromBase({ x: .02, y: 0 }), bottomRight = screenFromBase(baseCenter(TOTAL_COLS - 1, TOTAL_ROWS - 1));
  ctx.save(); ctx.strokeStyle = '#cc6c59'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(topLeft.x, 0); ctx.lineTo(topLeft.x, canvas.clientHeight); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bottomRight.x + state.scale, 0); ctx.lineTo(bottomRight.x + state.scale, canvas.clientHeight); ctx.stroke(); ctx.restore();
}

function nearestHex(baseX, baseY) {
  const colGuess = Math.round((baseX - 1) / 1.5); let best = null, bestDist = Infinity;
  for (let c = colGuess - 2; c <= colGuess + 2; c++) {
    if (c < 0 || c >= TOTAL_COLS) continue; const rowGuess = Math.round(baseY / SQRT3 - (c % 2 ? .5 : 0));
    for (let r = rowGuess - 2; r <= rowGuess + 2; r++) { if (r < 0 || r >= TOTAL_ROWS) continue; const center = baseCenter(c, r), d = Math.hypot(center.x - baseX, center.y - baseY); if (d < bestDist) { bestDist = d; best = { globalCol: c, globalRow: r }; } }
  }
  return bestDist <= 1.03 ? best : null;
}

async function selectHex(globalCol, globalRow) {
  const coordinate = coordinateFor(globalCol, globalRow), parsed = parseCoordinate(coordinate), existing = state.hexCache.get(coordinate) || await window.tribenet.getHex(coordinate);
  if (existing) state.hexCache.set(coordinate, existing); state.selected = { ...parsed, existing };
  $('noSelection').classList.add('hidden'); $('selectionEditor').classList.remove('hidden'); $('selectedCoordinate').textContent = coordinate;
  $('selectedState').textContent = existing ? (existing.terrain === 'UNKNOWN' ? 'Mapped · Unknown terrain' : 'Mapped') : 'Fog of War'; $('terrainSelect').value = existing?.terrain || 'UNKNOWN'; $('notesInput').value = existing?.notes || ''; $('saveStatus').textContent = '';
  await loadHexHistory(coordinate); draw();
}
function activeTurnContext() { return state.planImport?.turnKey ? { turnKey: state.planImport.turnKey } : {}; }
async function saveSelectedHex() {
  if (!state.selected) return;
  const saved = await window.tribenet.saveHex({
    coordinate: state.selected.coordinate, mapRow: state.selected.mapRow, mapCol: state.selected.mapCol, hexCol: state.selected.hexCol, hexRow: state.selected.hexRow,
    globalCol: state.selected.globalCol, globalRow: state.selected.globalRow, terrain: $('terrainSelect').value, notes: $('notesInput').value.trim()
  }, activeTurnContext());
  state.hexCache.set(saved.coordinate, saved); state.selected.existing = saved; $('selectedState').textContent = saved.terrain === 'UNKNOWN' ? 'Mapped · Unknown terrain' : 'Mapped'; $('saveStatus').textContent = 'Saved locally.'; await loadHexHistory(saved.coordinate); draw();
}
async function clearSelectedHex() {
  if (!state.selected) return; await window.tribenet.clearHex(state.selected.coordinate, activeTurnContext()); state.hexCache.delete(state.selected.coordinate); state.selected.existing = null;
  $('selectedState').textContent = 'Fog of War'; $('terrainSelect').value = 'UNKNOWN'; $('notesInput').value = ''; $('saveStatus').textContent = 'Returned to Fog of War.'; await loadHexHistory(state.selected.coordinate); draw();
}
async function loadHexHistory(coordinate) {
  const rows = await window.tribenet.getHexHistory(coordinate), host = $('hexHistoryList'); host.innerHTML = '';
  $('historyTurnContext').textContent = state.planImport?.turnKey ? `Current plan: ${state.planImport.turnKey}` : '';
  if (!rows.length) { host.innerHTML = '<div class="history-empty">No changes recorded yet.</div>'; return; }
  for (const row of rows) {
    const item = document.createElement('div'); item.className = 'history-item';
    const when = new Date(row.createdAt).toLocaleString();
    const change = row.eventType === 'fogged' ? `${row.oldTerrain || 'Mapped'} → Fog` : `${row.oldTerrain || 'Fog'} → ${row.newTerrain || 'Unknown'}`;
    item.innerHTML = `<div class="history-meta"><strong>${row.turnKey ? `Turn ${escapeHtml(row.turnKey)}` : 'Unassigned turn'}</strong><span>${escapeHtml(when)}</span></div><div>${escapeHtml(change)}</div>${row.newNotes ? `<div class="history-note">${escapeHtml(row.newNotes)}</div>` : ''}`;
    host.appendChild(item);
  }
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function updateCenterReadout() { const nearest = nearestHex(state.cameraX, state.cameraY); $('centerCoordinateLabel').textContent = nearest ? `Centre: ${coordinateFor(nearest.globalCol, nearest.globalRow)}` : ''; }
let mapDrawFrame=null;
function scheduleMapDraw() {
  if(mapDrawFrame!==null)return;
  mapDrawFrame=requestAnimationFrame(()=>{mapDrawFrame=null;draw();});
}
function setZoom(newScale, screenX, screenY) {
  const oldScale = state.scale, clamped = Math.max(9, Math.min(typeof IsoMapper !== "undefined" && IsoMapper.enabled ? 180 : 68, newScale)); if (clamped === oldScale) return;
  if(typeof IsoMapper!=='undefined' && IsoMapper.enabled)IsoMapper.interact();
  const rect = canvas.getBoundingClientRect(), x = screenX ?? rect.width / 2, y = screenY ?? rect.height / 2, before = baseFromScreen(x, y);
  state.scale = clamped; const after = baseFromScreen(x, y); state.cameraX += before.x - after.x; state.cameraY += before.y - after.y; requestVisibleData(); scheduleMapDraw();
}
function goToCoordinate() {
  const parsed = parseCoordinate($('coordinateInput').value);
  if (!parsed) { $('coordinateInput').setCustomValidity('Use a TribeNet coordinate such as PK1614.'); $('coordinateInput').reportValidity(); return; }
  $('coordinateInput').setCustomValidity(''); showDetail(); centerOnHex(parsed.globalCol, parsed.globalRow); selectHex(parsed.globalCol, parsed.globalRow);
}

// ---- Turn planner ---------------------------------------------------------
async function refreshPlannerHistory(selectId = null) {
  state.planHistory = await window.tribenet.getPlannerImports();
  const select = $('turnSelect'); select.innerHTML = '';
  if (!state.planHistory.length) {
    select.innerHTML = '<option value="">No turn imported</option>'; state.planImport = null; updatePlanUI(); return;
  }
  for (const row of state.planHistory) {
    const option = document.createElement('option'); option.value = String(row.id);
    const date = new Date(row.importedAt).toLocaleDateString(); option.textContent = `${row.turnKey} · ${row.sourceFile} · ${date}`; if (row.isActive) option.selected = true; select.appendChild(option);
  }
  const desiredId = selectId || Number(select.value) || state.planHistory.find(r => r.isActive)?.id || state.planHistory[0].id;
  await loadPlan(desiredId, false);
}
async function loadPlan(id, activate = true) {
  if (!id) { state.planImport = null; state.routeCache = null; updatePlanUI(); draw(); return; }
  state.planImport = activate ? await window.tribenet.activatePlannerPlan(Number(id)) : await window.tribenet.getPlannerPlan(Number(id));
  if (!state.planImport) return; $('turnSelect').value = String(state.planImport.id); state.routeCache = buildPlanRoutes(state.planImport.plan); updatePlanUI();
  if (state.selected) loadHexHistory(state.selected.coordinate); draw();
}
async function importOrdersWorkbook() {
  $('importOrdersButton').disabled = true; $('planStatus').textContent = 'Importing workbook…';
  try {
    const result = await window.tribenet.importOrdersWorkbook();
    if (result?.canceled) { $('planStatus').textContent = 'Import cancelled.'; return; }
    if (result?.error) { $('planStatus').textContent = `Import failed: ${result.error}`; return; }
    const imported = result.imported; state.planningVisible = true; $('planningToggle').checked = true; await refreshPlannerHistory(imported.id);
    $('planStatus').textContent = `Turn ${imported.turnKey} imported.`;
    const first = imported.plan?.movements?.find(m => parseCoordinate(m.startHex));
    if (first) { const p = parseCoordinate(first.startHex); showDetail(); centerOnHex(p.globalCol, p.globalRow); }
  } finally { $('importOrdersButton').disabled = false; }
}
function updatePlanUI() {
  const active = Boolean(state.planImport?.plan); $('planningToggle').disabled = !active; $('scoutingToggle').disabled = !active || !state.planningVisible;
  $('planStatus').textContent = active ? `Turn ${state.planImport.turnKey}` : 'Import an orders workbook to plan on the map.';
  const planningContext = typeof resultsTimeline !== 'undefined' && resultsTimeline.turn?.isPlanningTurn;
  const card = $('plannerOverlayCard'); card.classList.toggle('hidden', !(active || planningContext) || !state.planningVisible || state.mode !== 'detail');
  if (card) {
    card.classList.toggle('collapsed', state.planningPanelCollapsed);
    const content = $('planningPanelContent'); if (content) content.hidden = state.planningPanelCollapsed;
    const toggle = $('planningPanelToggle'); if (toggle) toggle.setAttribute('aria-expanded', String(!state.planningPanelCollapsed));
    const chevron = $('planningPanelChevron'); if (chevron) chevron.textContent = state.planningPanelCollapsed ? '＋' : '−';
  }
  if (!active) {
    if (planningContext) {
      $('plannerTurnTitle').textContent = `Planning Turn ${resultsTimeline.turn.turnKey}`;
      $('plannerSourceLabel').textContent = 'Draft from Results baseline';
      $('plannerWarnings').innerHTML = '<div class="planning-panel-hint">Select a unit on the map to choose a movement origin. Routes are planned against the revealed baseline.</div>';
    }
    return;
  }
  $('plannerTurnTitle').textContent = `Turn ${state.planImport.turnKey}`; $('plannerSourceLabel').textContent = state.planImport.sourceFile;
  renderPlanWarnings();
}
function renderPlanWarnings() {
  const host = $('plannerWarnings'); host.innerHTML = ''; if (!state.routeCache) return;
  const warnings = [...state.routeCache.movementWarnings, ...(state.scoutingVisible ? state.routeCache.scoutWarnings : [])];
  if (!warnings.length) { host.innerHTML = '<div class="planner-ok">All displayed routes are explicit.</div>'; return; }
  const shown = warnings.slice(0, 7);
  for (const w of shown) { const div = document.createElement('div'); div.className = 'planner-warning'; div.textContent = w; host.appendChild(div); }
  if (warnings.length > shown.length) { const div = document.createElement('div'); div.className = 'planner-warning more'; div.textContent = `+${warnings.length - shown.length} more conditional actions`; host.appendChild(div); }
}

function stepHex(pos, direction) {
  let { globalCol: c, globalRow: r } = pos; const odd = c % 2 === 1;
  if (direction === 'N') r -= 1; else if (direction === 'S') r += 1;
  else if (direction === 'NE') { c += 1; r += odd ? 0 : -1; }
  else if (direction === 'SE') { c += 1; r += odd ? 1 : 0; }
  else if (direction === 'NW') { c -= 1; r += odd ? 0 : -1; }
  else if (direction === 'SW') { c -= 1; r += odd ? 1 : 0; }
  if (c < 0 || c >= TOTAL_COLS || r < 0 || r >= TOTAL_ROWS) return null;
  return { globalCol: c, globalRow: r, coordinate: coordinateFor(c, r) };
}
function underlyingDirection(order) {
  const map = { NL:'N', NEL:'NE', NWL:'NW', SL:'S', SEL:'SE', SWL:'SW' }; return map[order] || null;
}
function isFollowDirective(order) { return /^(FO[LR]|FC[LR]|FL[LR]|FM[LR]|FR[LR]|FOLLOW)$/i.test(order); }
function normalizeMovementOrder(value) {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '').trim();
}
function followCoastRoute(start, side, options = {}) {
  const points = [{ globalCol:start.globalCol, globalRow:start.globalRow, coordinate:start.coordinate, kind:'exact' }];
  const queue = [{ point:start, path:points }];
  const visited = new Set([start.coordinate]);
  const dirs = ['N','NE','SE','S','SW','NW'];
  const known = point => state.hexCache.get(point.coordinate);
  const terrainOf = data => String(data?.terrain ?? data?.terrainCode ?? '').trim().toUpperCase();
  const ocean = point => ['O','OCEAN'].includes(terrainOf(known(point)));
  const unexplored = point => {
    const data=known(point); if(!data)return true;
    const terrain=terrainOf(data), knowledge=String(data.knowledgeLevel ?? data.knowledge ?? '').trim().toLowerCase();
    return !terrain || ['UNKNOWN','?','UNEXPLORED'].includes(terrain) || ['observed','attempted','unexplored','unknown'].includes(knowledge);
  };
  while (queue.length && visited.size <= 90) {
    const current = queue.shift();
    const oceanIndexes = dirs.map((d,i)=>({i,p:stepHex(current.point,d)})).filter(x=>x.p&&ocean(x.p));
    const preferred=[];
    for (const edge of oceanIndexes) {
      const delta=side==='right'?-1:1;
      for (const offset of [delta,delta*2,-delta,-delta*2,0]) {
        const candidate=stepHex(current.point,dirs[(edge.i+offset+6)%6]);
        if(candidate&&!preferred.some(p=>p.coordinate===candidate.coordinate))preferred.push(candidate);
      }
    }
    for(const candidate of preferred){
      if(unexplored(candidate))return {points:[...current.path,{...candidate,kind:'approx',order:options.order}],found:true};
      if(!['O','OCEAN'].includes(terrainOf(known(candidate)))&&!visited.has(candidate.coordinate)){visited.add(candidate.coordinate);queue.push({point:candidate,path:[...current.path,{...candidate,kind:'approx',order:options.order}]});}
    }
  }
  return {points,found:false};
}
function routeFor(startHex, orders, options = {}) {
  const start = parseCoordinate(startHex); if (!start) return { points: [], warnings: [`Invalid start hex ${startHex}`], unresolved: [] };
  const points = [{ globalCol: start.globalCol, globalRow: start.globalRow, coordinate: start.coordinate, kind: 'exact' }]; const warnings = [], unresolved = [];
  let current = points[0];
  for (const rawOrder of orders || []) {
    const order = normalizeMovementOrder(rawOrder);
    if (!order || order === 'EMPTY' || order === 'STILL') continue;
    if (['N','NE','NW','S','SE','SW'].includes(order)) {
      const next = stepHex(current, order); if (!next) { warnings.push(`${options.label || 'Route'} reaches the world edge on ${order}.`); break; }
      current = { ...next, kind:'exact', order }; points.push(current); continue;
    }
    const limitDir = underlyingDirection(order);
    if (limitDir) {
      const count = options.limitSteps || 5;
      for (let i = 0; i < count; i++) { const next = stepHex(current, limitDir); if (!next) break; current = { ...next, kind:'approx', order }; points.push(current); }
      warnings.push(`${options.label || 'Route'}: ${order} means ${limitDir} to movement limit; dashed continuation is illustrative.`); unresolved.push(order); break;
    }
    if (/^FO[LR]$/i.test(order)) {
      const coast=followCoastRoute(current,/^FOR$/i.test(order)?'right':'left',{order});
      if(coast.points.length>1){current=coast.points[coast.points.length-1];points.push(...coast.points.slice(1));warnings.push(`${options.label || 'Route'}: ${order} ends at the first potential unexplored coastal hex revealed by the current map; continuation remains illustrative.`);}
      else warnings.push(`${options.label || 'Route'}: ${order} has no revealed ocean edge to follow yet.`);
      unresolved.push(order);break;
    }
    if (isFollowDirective(order)) {
      warnings.push(`${options.label || 'Route'}: ${order} is conditional on terrain/coastline; route cannot yet be fixed.`); unresolved.push(order); break;
    }
    if (order.startsWith('GOTO')) {
      const target = parseCoordinate(order.replace(/^GOTO\s*/i, '')); if (target) { current = { globalCol: target.globalCol, globalRow: target.globalRow, coordinate: target.coordinate, kind:'approx', order }; points.push(current); }
      else warnings.push(`${options.label || 'Route'}: ${order} needs a target hex.`); unresolved.push(order); break;
    }
    warnings.push(`${options.label || 'Route'}: ${order} is not yet drawable.`); unresolved.push(order); break;
  }
  return { points, warnings, unresolved };
}
function buildPlanRoutes(plan) {
  const movements = [], movementWarnings = [], ends = new Map();
  for (const m of plan.movements || []) {
    const movementType = normalizeMovementOrder(m.movementType ?? m.MovementType);
    const orders = /^FO[LR]$/.test(movementType) && !(m.orders || []).some(order => /^FO[LR]$/i.test(order))
      ? [movementType, ...(m.orders || [])] : (m.orders || []);
    const route = routeFor(m.startHex, orders, { label: m.unit }); movements.push({ ...m, route }); movementWarnings.push(...route.warnings);
    if (route.points.length) ends.set(m.unit, route.points[route.points.length - 1]);
  }
  const scouts = [], scoutWarnings = [];
  for (const s of plan.scouts || []) {
    const origin = ends.get(s.unit) || (() => { const m = (plan.movements || []).find(x => x.unit === s.unit); return m ? parseCoordinate(m.startHex) : null; })();
    if (!origin) { scoutWarnings.push(`Scout ${s.id} (${s.unit}) has no known starting hex.`); continue; }
    const startHex = coordinateFor(origin.globalCol, origin.globalRow), carts = Number(s.noOfCarts || s.carts || 0), mounted = s.noOfHorses >= s.noOfScouts && s.noOfScouts > 0 && carts <= 0;
    const route = routeFor(startHex, s.orders, { label: `Scout ${s.id} ${s.unit}`, limitSteps: mounted ? 6 : 4 }); scouts.push({ ...s, startHex, mounted, route }); scoutWarnings.push(...route.warnings);
  }
  return { movements, scouts, movementWarnings, scoutWarnings, ends };
}

function drawArrowSegment(a, b, style = {}) {
  const pa = screenFromBase(baseCenter(a.globalCol, a.globalRow)), pb = screenFromBase(baseCenter(b.globalCol, b.globalRow));
  ctx.save(); ctx.strokeStyle = style.color || '#f2b65e'; ctx.fillStyle = style.color || '#f2b65e'; ctx.globalAlpha = style.alpha ?? .9; ctx.lineWidth = style.width || Math.max(2, state.scale * .10); ctx.setLineDash(style.dashed ? [7, 6] : []);
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); ctx.setLineDash([]);
  const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x), size = Math.max(6, state.scale * .24); ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pb.x - size * Math.cos(angle - .55), pb.y - size * Math.sin(angle - .55)); ctx.lineTo(pb.x - size * Math.cos(angle + .55), pb.y - size * Math.sin(angle + .55)); ctx.closePath(); ctx.fill(); ctx.restore();
}
function drawRoute(points, style = {}) {
  if (!points || points.length < 2) return; for (let i = 1; i < points.length; i++) drawArrowSegment(points[i-1], points[i], { ...style, dashed: style.dashed || points[i].kind === 'approx' });
}
function drawClassicUnitModels(point, unit, snapshot) {
  if (typeof IsoUnits === 'undefined' || !IsoUnits.composition || !IsoUnits.formation) return;
  const counts = IsoUnits.composition(snapshot);
  if (!counts) return;
  const models = IsoUnits.formation(counts, `${point.coordinate || ''}:${unit}`);
  if (!models.length) return;
  const center = Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : baseCenter(point.globalCol, point.globalRow);
  for (const model of models) {
    const p = screenFromBase({ x: center.x + model.x * .82, y: center.y + model.y * .82 });
    const size = Math.max(2.2, Math.min(5.5, state.scale * .085));
    ctx.save();
    if (model.kind === 'carts') {
      ctx.fillStyle = '#a97945'; ctx.strokeStyle = '#e0bd83'; ctx.lineWidth = 1;
      ctx.fillRect(p.x - size * 1.35, p.y - size * .55, size * 2.7, size * 1.1); ctx.strokeRect(p.x - size * 1.35, p.y - size * .55, size * 2.7, size * 1.1);
      ctx.fillStyle = '#46392c'; ctx.beginPath(); ctx.arc(p.x - size, p.y + size * .75, size * .42, 0, Math.PI * 2); ctx.arc(p.x + size, p.y + size * .75, size * .42, 0, Math.PI * 2); ctx.fill();
    } else if (model.kind === 'horses' || model.mounted) {
      ctx.fillStyle = '#9b7046'; ctx.strokeStyle = '#e0bd83'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + size * .25, size * 1.25, size * .52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (model.mounted) { ctx.fillStyle = '#e2bd92'; ctx.beginPath(); ctx.arc(p.x, p.y - size * .65, size * .42, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = model.kind === 'warriors' ? '#b7614e' : model.kind === 'actives' ? '#4c9f95' : '#d4b86c';
      ctx.beginPath(); ctx.arc(p.x, p.y - size * .55, size * .42, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(p.x - size * .28, p.y, size * .56, size * .82);
    }
    ctx.restore();
  }
}
function drawUnitLabel(point, unit, type, offsetIndex = 0, extra = '', snapshot = null) {
  if(typeof IsoMapper!=='undefined' && IsoMapper.enabled){IsoUnits.draw(point,unit,type,offsetIndex,extra,snapshot);return;}
  if (!point) return; const p = screenFromBase(Number.isFinite(point.x) && Number.isFinite(point.y) ? point : baseCenter(point.globalCol, point.globalRow));
  drawClassicUnitModels(point, unit, snapshot);
  const text = `${type === 'Element' ? 'E' : type === 'Tribe' ? 'T' : 'U'} ${unit}${extra ? ` ${extra}` : ''}`; ctx.save();
  ctx.font = `700 ${Math.max(9, Math.min(12, state.scale * .32))}px Segoe UI`; const w = ctx.measureText(text).width + 12, h = 19;
  const x = p.x - w / 2, y = p.y - state.scale * .78 - offsetIndex * (h + 3); ctx.fillStyle = 'rgba(15,24,31,.94)'; ctx.strokeStyle = '#d7a754'; ctx.lineWidth = 1.2;
  roundedRect(ctx, x, y, w, h, 5); ctx.fill(); ctx.stroke();
  if (String(state.selectedUnit) === String(unit)) {
    hexPath(p.x, p.y, Math.max(state.scale * 1.02, 24)); ctx.strokeStyle = '#58d4ef'; ctx.lineWidth = Math.max(3, state.scale * .10); ctx.stroke();
    ctx.strokeStyle = '#ffe18a'; ctx.lineWidth = Math.max(1.5, state.scale * .05); ctx.stroke();
  }
  ctx.fillStyle = '#f4e5c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w/2, y + h/2 + .5); ctx.restore();
}
function drawSelectedUnitHighlight() {
  if (!state.selectedUnit || !state.selectedUnitHex || (typeof IsoMapper !== 'undefined' && IsoMapper.enabled)) return;
  const parsed = parseCoordinate(state.selectedUnitHex); if (!parsed) return;
  const p = screenFromBase(baseCenter(parsed.globalCol, parsed.globalRow));
  ctx.save(); hexPath(p.x, p.y, Math.max(state.scale * 1.02, 24));
  ctx.fillStyle = 'rgba(72,212,239,.10)'; ctx.fill();
  ctx.strokeStyle = '#58d4ef'; ctx.lineWidth = Math.max(3, state.scale * .10); ctx.stroke();
  ctx.strokeStyle = '#ffe18a'; ctx.lineWidth = Math.max(1.5, state.scale * .05); ctx.stroke(); ctx.restore();
}
function roundedRect(context, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2); context.beginPath(); context.moveTo(x+rr,y); context.arcTo(x+w,y,x+w,y+h,rr); context.arcTo(x+w,y+h,x,y+h,rr); context.arcTo(x,y+h,x,y,rr); context.arcTo(x,y,x+w,y,rr); context.closePath();
}
function drawConditionalMarker(point, text, color) {
  const p = screenFromBase(baseCenter(point.globalCol, point.globalRow)); ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = 'rgba(7,13,18,.92)'; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(11, state.scale * .48), 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = `800 ${Math.max(8, state.scale*.26)}px Segoe UI`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text, p.x, p.y); ctx.restore();
}
function drawPlanOverlay() {
  if (!state.routeCache) state.routeCache = buildPlanRoutes(state.planImport.plan); const plan = state.planImport.plan;
  const historicalResults = typeof resultsTimeline !== 'undefined' && resultsTimeline.turn && !resultsTimeline.turn.isPlanningTurn;
  const labelSlots = new Map();
  for (const m of state.routeCache.movements) {
    drawRoute(m.route.points, { color:'#f0b45e', width:Math.max(2.2,state.scale*.11), alpha:.94 });
    const start = m.route.points[0], end = m.route.points[m.route.points.length - 1]; if (!start) continue;
    const key = start.coordinate, slot = labelSlots.get(key) || 0;
    if (!historicalResults) { drawUnitLabel(start, m.unit, m.type, slot, 'start'); labelSlots.set(key, slot+1); }
    if (m.route.unresolved.length) drawConditionalMarker(end || start, m.route.unresolved[0], '#f0b45e');
  }
  for (const creation of plan.unitCreations || []) {
    const child = state.routeCache.movements.find(m => m.unit === creation.unit), parent = state.routeCache.movements.find(m => m.unit === creation.parentUnit);
    const point = child?.route?.points?.[0] || parent?.route?.points?.[0]; if (!point) continue;
    const p = screenFromBase(baseCenter(point.globalCol, point.globalRow)); ctx.save(); ctx.fillStyle='#f4df72'; ctx.font=`700 ${Math.max(8,state.scale*.25)}px Segoe UI`; ctx.textAlign='left'; ctx.textBaseline='bottom'; ctx.fillText(`split: ${creation.parentUnit} → ${creation.unit}`, p.x + state.scale*.55, p.y - state.scale*.34); ctx.restore();
  }
  if (state.scoutingVisible) {
    for (const s of state.routeCache.scouts) {
      drawRoute(s.route.points, { color:'#78c9e6', width:Math.max(1.7,state.scale*.075), alpha:.76, dashed:true });
      const start=s.route.points[0], end=s.route.points[s.route.points.length-1]; if (start) drawScoutLabel(start, s.id, s.unit); if (s.route.unresolved.length && end) drawConditionalMarker(end, s.route.unresolved[0], '#78c9e6');
      if (s.route.points.length > 1 && !s.route.unresolved.length) drawArrowSegment(end, start, { color:'#78c9e6', width:Math.max(1,state.scale*.05), alpha:.32, dashed:true });
    }
  }
}
function drawScoutLabel(point, id, unit) {
  const p=screenFromBase(baseCenter(point.globalCol,point.globalRow)); ctx.save(); const text=`S${id} ${unit}`; ctx.font=`700 ${Math.max(8,Math.min(10,state.scale*.25))}px Segoe UI`; const w=ctx.measureText(text).width+10,h=16,x=p.x-w/2,y=p.y+state.scale*.48;
  ctx.fillStyle='rgba(8,28,37,.9)'; ctx.strokeStyle='#78c9e6'; roundedRect(ctx,x,y,w,h,5); ctx.fill(); ctx.stroke(); ctx.fillStyle='#c8f1ff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x+w/2,y+h/2); ctx.restore();
}

function bindEvents() {
  $('openMapperButton').addEventListener('click', showMapper); $('backButton').addEventListener('click', showLauncher); $('overviewButton').addEventListener('click', showOverview); $('detailOverviewButton').addEventListener('click', showOverview);
  $('goCoordinateButton').addEventListener('click', goToCoordinate); $('coordinateInput').addEventListener('keydown', e => { if (e.key === 'Enter') goToCoordinate(); }); $('zoomInButton').addEventListener('click', () => setZoom(state.scale * 1.18)); $('zoomOutButton').addEventListener('click', () => setZoom(state.scale / 1.18));
  $('saveHexButton').addEventListener('click', saveSelectedHex); $('fogHexButton').addEventListener('click', clearSelectedHex); $('importOrdersButton').addEventListener('click', importOrdersWorkbook);
  $('planningToggle').addEventListener('change', e => { state.planningVisible = e.target.checked; $('scoutingToggle').disabled = !state.planningVisible || !state.planImport; updatePlanUI(); draw(); });
  $('planningPanelToggle')?.addEventListener('click', () => { state.planningPanelCollapsed = !state.planningPanelCollapsed; updatePlanUI(); });
  $('scoutingToggle').addEventListener('change', e => { state.scoutingVisible = e.target.checked; renderPlanWarnings(); draw(); });
  $('mapperViewToggle').addEventListener('change', e => {
    const use3d = e.target.checked;
    if (typeof IsoMapper !== 'undefined' && IsoMapper.enabled !== use3d) IsoMapper.setEnabled(use3d, { overview:false });
  });
  $('turnSelect').addEventListener('change', e => loadPlan(Number(e.target.value), true));
  $('backupButton').addEventListener('click', async () => { const backupPath = await window.tribenet.createBackup(); $('dataPathLabel').textContent = `Backup created: ${backupPath}`; await window.tribenet.showBackup(backupPath); });
  $('updateButton').addEventListener('click', async () => { $('updateButton').disabled = true; $('updateMessage').textContent = 'Checking for updates…'; await window.tribenet.checkForUpdates(); setTimeout(() => { $('updateButton').disabled = false; }, 1000); });
  $('installUpdateButton').addEventListener('click', () => window.tribenet.installUpdate());
  window.addEventListener('resize', () => { if (state.mode === 'detail') { resizeCanvas(); draw(); requestVisibleData(); } });
  canvas.addEventListener('mousedown', e => { state.dragging = true; state.dragStart = { x:e.clientX,y:e.clientY,cameraX:state.cameraX,cameraY:state.cameraY }; canvas.classList.add('dragging'); });
  window.addEventListener('mousemove', e => { if (!state.dragging) return; const dx=(e.clientX-state.dragStart.x)/state.scale, dy=(e.clientY-state.dragStart.y)/state.scale; const delta=typeof IsoMapper!=="undefined" && IsoMapper.enabled ? IsoGeometry.unproject(dx,dy) : {x:dx,y:dy}; state.cameraX = state.dragStart.cameraX-delta.x; state.cameraY = state.dragStart.cameraY-delta.y; if(typeof IsoMapper!=='undefined' && IsoMapper.enabled)IsoMapper.interact(); scheduleMapDraw(); requestVisibleData(); });
  window.addEventListener('mouseup', e => { if (!state.dragging) return; const moved=Math.hypot(e.clientX-state.dragStart.x,e.clientY-state.dragStart.y); state.dragging=false; canvas.classList.remove('dragging'); if (moved<5 && state.mode==='detail') { const rect=canvas.getBoundingClientRect(),base=baseFromScreen(e.clientX-rect.left,e.clientY-rect.top),hex=typeof IsoMapper!=='undefined' && IsoMapper.enabled ? IsoMapper.pick(e.clientX-rect.left,e.clientY-rect.top) || nearestHex(base.x,base.y) : nearestHex(base.x,base.y); if(hex) { const isClassic=typeof IsoMapper==='undefined' || !IsoMapper.enabled; const ref=coordinateFor(hex.globalCol,hex.globalRow); const hasUnits=isClassic && typeof IsoUnits!=='undefined' && typeof resultsTimeline!=='undefined' && resultsTimeline.turn && IsoUnits.unitsAt(ref).length; if(hasUnits) IsoUnits.clickHex(hex); else selectHex(hex.globalCol,hex.globalRow); } } });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const rect=canvas.getBoundingClientRect(); setZoom(state.scale*(e.deltaY<0?1.12:1/1.12),e.clientX-rect.left,e.clientY-rect.top); }, {passive:false});
}
function updateUpdateUI(payload) { $('updateMessage').textContent = payload.message || ''; $('installUpdateButton').classList.toggle('hidden', payload.state !== 'ready'); $('updateButton').disabled = payload.state === 'checking' || payload.state === 'downloading'; }

initialize();

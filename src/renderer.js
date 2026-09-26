const MAP_ROWS = 26;
const MAP_COLS = 16;
const HEX_COLS = 30;
const HEX_ROWS = 21;
const TOTAL_COLS = MAP_COLS * HEX_COLS;
const TOTAL_ROWS = MAP_ROWS * HEX_ROWS;
const SQRT3 = Math.sqrt(3);

const TERRAIN = [
  ['UNKNOWN', 'Unknown'],
  ['ALPS', 'Alps'],
  ['AR', 'Arid'],
  ['BH', 'Brush Hill'],
  ['BR', 'Brush'],
  ['CH', 'Conifer Hill'],
  ['DE', 'Desert'],
  ['D', 'Deciduous'],
  ['DH', 'Deciduous Hill'],
  ['GH', 'Grassy Hill'],
  ['GHP', 'Grassy Hill Plateau'],
  ['HSM', 'High Mountains'],
  ['JG', 'Jungle'],
  ['JH', 'Jungle Hill'],
  ['L', 'Lake'],
  ['LAM', 'Low Arid Mountains'],
  ['LCM', 'Low Conifer Mountains'],
  ['LJM', 'Low Jungle Mountain'],
  ['LSM', 'Low Snowy Mountains'],
  ['LVM', 'Low Volcanic Mountains'],
  ['O', 'Ocean'],
  ['PP', 'Plateau Prairie'],
  ['PGH', 'Plateau Grassy Hill'],
  ['PI', 'Polar Ice'],
  ['PR', 'Prairie'],
  ['PPR', 'Prairie Plateau'],
  ['RH', 'Rocky Hill'],
  ['SH', 'Snow Hill'],
  ['SW', 'Swamp'],
  ['TU', 'Tundra']
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
  mode: 'overview',
  cameraX: 0,
  cameraY: 0,
  scale: 29,
  selected: null,
  hexCache: new Map(),
  loadedArea: null,
  dragging: false,
  dragStart: null,
  summaries: new Map()
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
  return {
    x: 1 + globalCol * 1.5,
    y: SQRT3 / 2 + SQRT3 * (globalRow + (globalCol % 2 ? 0.5 : 0))
  };
}
function centerOnHex(globalCol, globalRow) {
  const p = baseCenter(globalCol, globalRow);
  state.cameraX = p.x;
  state.cameraY = p.y;
  requestVisibleData();
  draw();
}
function centerOnSubmap(mapRow, mapCol) {
  const globalCol = mapCol * HEX_COLS + Math.floor(HEX_COLS / 2);
  const globalRow = mapRow * HEX_ROWS + Math.floor(HEX_ROWS / 2);
  showDetail();
  centerOnHex(globalCol, globalRow);
}

async function initialize() {
  const version = await window.tribenet.getVersion();
  $('versionLabel').textContent = `Version ${version} · Local desktop application`;
  const path = await window.tribenet.getUserDataPath();
  $('dataPathLabel').textContent = path;
  populateTerrain();
  bindEvents();
  await refreshSummaries();
  buildWorldGrid();
  window.tribenet.onUpdateStatus(updateUpdateUI);
}

function populateTerrain() {
  for (const [code, name] of TERRAIN) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${code} — ${name}`;
    $('terrainSelect').appendChild(option);
  }
}

async function refreshSummaries() {
  const rows = await window.tribenet.getSubmapSummaries();
  state.summaries.clear();
  for (const row of rows) state.summaries.set(`${row.mapRow}:${row.mapCol}`, Number(row.mapped));
}

function buildWorldGrid() {
  const grid = $('worldGrid');
  grid.innerHTML = '';
  grid.appendChild(document.createElement('div'));
  for (let c = 0; c < MAP_COLS; c++) {
    const h = document.createElement('div'); h.className = 'world-header'; h.textContent = letter(c); grid.appendChild(h);
  }
  for (let r = 0; r < MAP_ROWS; r++) {
    const rh = document.createElement('div'); rh.className = 'world-row-header'; rh.textContent = letter(r); grid.appendChild(rh);
    for (let c = 0; c < MAP_COLS; c++) {
      const mapped = state.summaries.get(`${r}:${c}`) || 0;
      const cell = document.createElement('button');
      cell.className = `submap-cell${mapped ? ' has-data' : ''}`;
      cell.innerHTML = `<span class="map-code">${submapCode(r,c)}</span><span class="map-progress">${mapped ? `${mapped}/630 mapped` : 'Fog'}</span>`;
      cell.addEventListener('click', () => centerOnSubmap(r, c));
      grid.appendChild(cell);
    }
  }
}

function showLauncher() {
  $('launcherView').classList.remove('hidden');
  $('mapperView').classList.add('hidden');
}
function showMapper() {
  $('launcherView').classList.add('hidden');
  $('mapperView').classList.remove('hidden');
  showOverview();
}
function showOverview() {
  state.mode = 'overview';
  $('overviewPanel').classList.remove('hidden');
  $('detailPanel').classList.add('hidden');
  $('detailControls').classList.add('hidden');
  $('overviewButton').classList.add('active');
  refreshSummaries().then(buildWorldGrid);
}
function showDetail() {
  state.mode = 'detail';
  $('overviewPanel').classList.add('hidden');
  $('detailPanel').classList.remove('hidden');
  $('detailControls').classList.remove('hidden');
  $('overviewButton').classList.remove('active');
  requestAnimationFrame(() => { resizeCanvas(); draw(); requestVisibleData(); });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function screenFromBase(p) {
  const rect = canvas.getBoundingClientRect();
  return { x: (p.x - state.cameraX) * state.scale + rect.width / 2, y: (p.y - state.cameraY) * state.scale + rect.height / 2 };
}
function baseFromScreen(x, y) {
  const rect = canvas.getBoundingClientRect();
  return { x: (x - rect.width / 2) / state.scale + state.cameraX, y: (y - rect.height / 2) / state.scale + state.cameraY };
}

function visibleBounds() {
  const rect = canvas.getBoundingClientRect();
  const minBaseX = state.cameraX - rect.width / (2 * state.scale) - 2;
  const maxBaseX = state.cameraX + rect.width / (2 * state.scale) + 2;
  const minBaseY = state.cameraY - rect.height / (2 * state.scale) - SQRT3 * 2;
  const maxBaseY = state.cameraY + rect.height / (2 * state.scale) + SQRT3 * 2;
  const minCol = Math.max(0, Math.floor((minBaseX - 1) / 1.5) - 2);
  const maxCol = Math.min(TOTAL_COLS - 1, Math.ceil((maxBaseX - 1) / 1.5) + 2);
  const minRow = Math.max(0, Math.floor(minBaseY / SQRT3) - 2);
  const maxRow = Math.min(TOTAL_ROWS - 1, Math.ceil(maxBaseY / SQRT3) + 2);
  return { minCol, maxCol, minRow, maxRow };
}

let areaRequestTimer;
function requestVisibleData() {
  if (state.mode !== 'detail') return;
  clearTimeout(areaRequestTimer);
  areaRequestTimer = setTimeout(async () => {
    const b = visibleBounds();
    const rows = await window.tribenet.getHexesInArea(b);
    for (const row of rows) state.hexCache.set(row.coordinate, row);
    state.loadedArea = b;
    draw();
  }, 55);
}

function hexPath(cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawFog(cx, cy, radius) {
  ctx.fillStyle = '#18242b'; ctx.fill();
  ctx.save(); hexPath(cx, cy, radius); ctx.clip();
  ctx.strokeStyle = '#263842'; ctx.lineWidth = Math.max(1, radius * .055);
  for (let d = -radius * 2; d < radius * 2; d += Math.max(7, radius * .32)) {
    ctx.beginPath(); ctx.moveTo(cx - radius, cy + d); ctx.lineTo(cx + radius, cy + d + radius * .75); ctx.stroke();
  }
  ctx.restore();
  if (radius > 18) {
    ctx.fillStyle = '#78909b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(11, radius * .52)}px Segoe UI`; ctx.fillText('?', cx, cy + 1);
  }
}

function drawTerrain(cx, cy, radius, terrain) {
  const style = terrainStyle[terrain] || terrainStyle.UNKNOWN;
  ctx.fillStyle = style[0]; ctx.fill();
  if (radius > 12) {
    ctx.fillStyle = style[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.min(15, Math.max(8, radius * .38))}px Segoe UI`;
    ctx.fillText(terrain === 'UNKNOWN' ? '?' : terrain, cx, cy + 1);
  }
}

function draw() {
  if (state.mode !== 'detail') return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#05090c'; ctx.fillRect(0, 0, rect.width, rect.height);
  const bounds = visibleBounds();
  const radius = state.scale * .96;

  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const p = screenFromBase(baseCenter(col, row));
      if (p.x < -radius * 2 || p.x > rect.width + radius * 2 || p.y < -radius * 2 || p.y > rect.height + radius * 2) continue;
      hexPath(p.x, p.y, radius);
      const coord = coordinateFor(col, row);
      const data = state.hexCache.get(coord);
      if (data) drawTerrain(p.x, p.y, radius, data.terrain); else drawFog(p.x, p.y, radius);
      ctx.strokeStyle = '#071116'; ctx.lineWidth = Math.max(1, state.scale * .055); ctx.stroke();

      if (state.selected && state.selected.coordinate === coord) {
        hexPath(p.x, p.y, radius * .91);
        ctx.strokeStyle = '#f4df72'; ctx.lineWidth = Math.max(2, state.scale * .12); ctx.stroke();
      }

      if (state.scale >= 39) {
        ctx.fillStyle = 'rgba(235,244,248,.62)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.font = `${Math.max(8, state.scale * .20)}px Segoe UI`;
        ctx.fillText(coord, p.x, p.y + radius * .72);
      }
    }
  }
  drawSubmapLabels(bounds, rect);
  drawWorldBorder(rect);
  updateCenterReadout();
}

function drawSubmapLabels(bounds) {
  if (state.scale < 15) return;
  const firstMapCol = Math.floor(bounds.minCol / HEX_COLS);
  const lastMapCol = Math.floor(bounds.maxCol / HEX_COLS);
  const firstMapRow = Math.floor(bounds.minRow / HEX_ROWS);
  const lastMapRow = Math.floor(bounds.maxRow / HEX_ROWS);
  ctx.save();
  ctx.font = `800 ${Math.max(15, Math.min(30, state.scale * .7))}px Segoe UI`;
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let mr = firstMapRow; mr <= lastMapRow; mr++) {
    for (let mc = firstMapCol; mc <= lastMapCol; mc++) {
      const p = screenFromBase(baseCenter(mc * HEX_COLS, mr * HEX_ROWS));
      ctx.fillText(submapCode(mr, mc), p.x - state.scale * .7, p.y - state.scale * .72);
    }
  }
  ctx.restore();
}

function drawWorldBorder() {
  const topLeft = screenFromBase({ x: .02, y: 0 });
  const bottomRight = screenFromBase(baseCenter(TOTAL_COLS - 1, TOTAL_ROWS - 1));
  ctx.save(); ctx.strokeStyle = '#cc6c59'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(topLeft.x, 0); ctx.lineTo(topLeft.x, canvas.clientHeight); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bottomRight.x + state.scale, 0); ctx.lineTo(bottomRight.x + state.scale, canvas.clientHeight); ctx.stroke();
  ctx.restore();
}

function nearestHex(baseX, baseY) {
  let colGuess = Math.round((baseX - 1) / 1.5);
  let best = null;
  let bestDist = Infinity;
  for (let c = colGuess - 2; c <= colGuess + 2; c++) {
    if (c < 0 || c >= TOTAL_COLS) continue;
    const rowGuess = Math.round(baseY / SQRT3 - (c % 2 ? .5 : 0));
    for (let r = rowGuess - 2; r <= rowGuess + 2; r++) {
      if (r < 0 || r >= TOTAL_ROWS) continue;
      const center = baseCenter(c, r);
      const d = Math.hypot(center.x - baseX, center.y - baseY);
      if (d < bestDist) { bestDist = d; best = { globalCol: c, globalRow: r }; }
    }
  }
  return bestDist <= 1.03 ? best : null;
}

async function selectHex(globalCol, globalRow) {
  const coordinate = coordinateFor(globalCol, globalRow);
  const parsed = parseCoordinate(coordinate);
  const existing = state.hexCache.get(coordinate) || await window.tribenet.getHex(coordinate);
  if (existing) state.hexCache.set(coordinate, existing);
  state.selected = { ...parsed, existing };
  $('noSelection').classList.add('hidden');
  $('selectionEditor').classList.remove('hidden');
  $('selectedCoordinate').textContent = coordinate;
  $('selectedState').textContent = existing ? (existing.terrain === 'UNKNOWN' ? 'Mapped · Unknown terrain' : 'Mapped') : 'Fog of War';
  $('terrainSelect').value = existing?.terrain || 'UNKNOWN';
  $('notesInput').value = existing?.notes || '';
  $('saveStatus').textContent = '';
  draw();
}

async function saveSelectedHex() {
  if (!state.selected) return;
  const saved = await window.tribenet.saveHex({
    coordinate: state.selected.coordinate,
    mapRow: state.selected.mapRow,
    mapCol: state.selected.mapCol,
    hexCol: state.selected.hexCol,
    hexRow: state.selected.hexRow,
    globalCol: state.selected.globalCol,
    globalRow: state.selected.globalRow,
    terrain: $('terrainSelect').value,
    notes: $('notesInput').value.trim()
  });
  state.hexCache.set(saved.coordinate, saved);
  state.selected.existing = saved;
  $('selectedState').textContent = saved.terrain === 'UNKNOWN' ? 'Mapped · Unknown terrain' : 'Mapped';
  $('saveStatus').textContent = 'Saved locally.';
  draw();
}

async function clearSelectedHex() {
  if (!state.selected) return;
  await window.tribenet.clearHex(state.selected.coordinate);
  state.hexCache.delete(state.selected.coordinate);
  state.selected.existing = null;
  $('selectedState').textContent = 'Fog of War';
  $('terrainSelect').value = 'UNKNOWN';
  $('notesInput').value = '';
  $('saveStatus').textContent = 'Returned to Fog of War.';
  draw();
}

function updateCenterReadout() {
  const nearest = nearestHex(state.cameraX, state.cameraY);
  $('centerCoordinateLabel').textContent = nearest ? `Centre: ${coordinateFor(nearest.globalCol, nearest.globalRow)}` : '';
}

function setZoom(newScale, screenX, screenY) {
  const oldScale = state.scale;
  const clamped = Math.max(9, Math.min(68, newScale));
  if (clamped === oldScale) return;
  const rect = canvas.getBoundingClientRect();
  const x = screenX ?? rect.width / 2;
  const y = screenY ?? rect.height / 2;
  const before = baseFromScreen(x, y);
  state.scale = clamped;
  state.cameraX = before.x - (x - rect.width / 2) / state.scale;
  state.cameraY = before.y - (y - rect.height / 2) / state.scale;
  requestVisibleData(); draw();
}

function goToCoordinate() {
  const parsed = parseCoordinate($('coordinateInput').value);
  if (!parsed) {
    $('coordinateInput').setCustomValidity('Use a TribeNet coordinate such as PK1614.');
    $('coordinateInput').reportValidity();
    return;
  }
  $('coordinateInput').setCustomValidity('');
  showDetail(); centerOnHex(parsed.globalCol, parsed.globalRow); selectHex(parsed.globalCol, parsed.globalRow);
}

function bindEvents() {
  $('openMapperButton').addEventListener('click', showMapper);
  $('backButton').addEventListener('click', showLauncher);
  $('overviewButton').addEventListener('click', showOverview);
  $('detailOverviewButton').addEventListener('click', showOverview);
  $('goCoordinateButton').addEventListener('click', goToCoordinate);
  $('coordinateInput').addEventListener('keydown', e => { if (e.key === 'Enter') goToCoordinate(); });
  $('zoomInButton').addEventListener('click', () => setZoom(state.scale * 1.18));
  $('zoomOutButton').addEventListener('click', () => setZoom(state.scale / 1.18));
  $('saveHexButton').addEventListener('click', saveSelectedHex);
  $('fogHexButton').addEventListener('click', clearSelectedHex);

  $('backupButton').addEventListener('click', async () => {
    const backupPath = await window.tribenet.createBackup();
    $('dataPathLabel').textContent = `Backup created: ${backupPath}`;
    await window.tribenet.showBackup(backupPath);
  });

  $('updateButton').addEventListener('click', async () => {
    $('updateButton').disabled = true;
    $('updateMessage').textContent = 'Checking for updates…';
    await window.tribenet.checkForUpdates();
    setTimeout(() => { $('updateButton').disabled = false; }, 1000);
  });
  $('installUpdateButton').addEventListener('click', () => window.tribenet.installUpdate());

  window.addEventListener('resize', () => { if (state.mode === 'detail') { resizeCanvas(); draw(); requestVisibleData(); } });

  canvas.addEventListener('mousedown', e => {
    state.dragging = true; state.dragStart = { x: e.clientX, y: e.clientY, cameraX: state.cameraX, cameraY: state.cameraY };
    canvas.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!state.dragging) return;
    const dx = (e.clientX - state.dragStart.x) / state.scale;
    const dy = (e.clientY - state.dragStart.y) / state.scale;
    state.cameraX = state.dragStart.cameraX - dx;
    state.cameraY = state.dragStart.cameraY - dy;
    draw(); requestVisibleData();
  });
  window.addEventListener('mouseup', e => {
    if (!state.dragging) return;
    const moved = Math.hypot(e.clientX - state.dragStart.x, e.clientY - state.dragStart.y);
    state.dragging = false; canvas.classList.remove('dragging');
    if (moved < 5 && state.mode === 'detail') {
      const rect = canvas.getBoundingClientRect();
      const base = baseFromScreen(e.clientX - rect.left, e.clientY - rect.top);
      const hex = nearestHex(base.x, base.y);
      if (hex) selectHex(hex.globalCol, hex.globalRow);
    }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    setZoom(state.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
}

function updateUpdateUI(payload) {
  $('updateMessage').textContent = payload.message || '';
  $('installUpdateButton').classList.toggle('hidden', payload.state !== 'ready');
  if (payload.state === 'checking' || payload.state === 'downloading') $('updateButton').disabled = true;
  else $('updateButton').disabled = false;
}

initialize();

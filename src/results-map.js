const RESULT_TURN_STORAGE_KEY = 'tribenet:selectedResultTurn';

const resultsTimeline = {
  turns: [],
  turn: null,
  playTimer: null,
  loadingArea: false,
  ready: false
};

const originalRequestVisibleData = requestVisibleData;
const originalRefreshSummaries = refreshSummaries;
const originalDraw = draw;
const originalSelectHex = selectHex;
const originalLoadHexHistory = loadHexHistory;
const originalRefreshPlannerHistoryForResults = refreshPlannerHistory;

async function syncPlannerOverlayToResultTurn(turnKey, preferredId = null, options = {}) {
  const { redraw = true } = options;
  if (!turnKey) {
    return originalRefreshPlannerHistoryForResults(preferredId);
  }

  const imports = await window.tribenet.getPlannerImports(turnKey);
  state.planHistory = imports;
  const select = $('turnSelect');
  select.innerHTML = '';

  if (!imports.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `Turn ${turnKey} · no planning/scouting`;
    option.selected = true;
    select.appendChild(option);
    state.planImport = null;
    state.routeCache = null;
    updatePlanUI();
    $('planStatus').textContent = `Turn ${turnKey} · no planning or scouting imported.`;
    if (redraw) draw();
    return null;
  }

  for (const row of imports) {
    const option = document.createElement('option');
    option.value = String(row.id);
    const date = new Date(row.importedAt).toLocaleDateString();
    option.textContent = `${row.turnKey} · ${row.sourceFile} · ${date}`;
    select.appendChild(option);
  }

  const preferred = preferredId && imports.some(row => Number(row.id) === Number(preferredId))
    ? await window.tribenet.getPlannerPlan(Number(preferredId))
    : await window.tribenet.getPlannerPlanForTurn(turnKey);

  if (!preferred || preferred.turnKey !== turnKey) {
    state.planImport = null;
    state.routeCache = null;
    updatePlanUI();
    $('planStatus').textContent = `Turn ${turnKey} · no planning or scouting imported.`;
    if (redraw) draw();
    return null;
  }

  state.planImport = preferred;
  state.routeCache = buildPlanRoutes(preferred.plan);
  select.value = String(preferred.id);
  updatePlanUI();
  $('planStatus').textContent = `Turn ${turnKey} · planning/scouting loaded.`;
  if (redraw) {
    if (state.selected) await loadHexHistory(state.selected.coordinate);
    draw();
  }
  return preferred;
}

refreshPlannerHistory = async function refreshPlannerHistoryForSelectedResultTurn(selectId = null) {
  if (!resultsTimeline.ready) return null;
  if (resultsTimeline.turn?.turnKey) {
    return syncPlannerOverlayToResultTurn(resultsTimeline.turn.turnKey, selectId);
  }
  return originalRefreshPlannerHistoryForResults(selectId);
};

function resultHasBlockedEvidence(data) {
  return Boolean(data?.evidence?.some(item => /Not enough M\.P/i.test(String(item))));
}

function resultIsPartial(data) {
  return Boolean(data && (
    data.knowledgeLevel === 'observed' ||
    data.knowledgeLevel === 'attempted' ||
    resultHasBlockedEvidence(data)
  ));
}

function historicalStateLabel(data) {
  if (!data) return 'Fog of War';
  if (resultHasBlockedEvidence(data)) return 'Partially scouted · movement exhausted';
  if (data.knowledgeLevel === 'visited') return `Visited · known by ${data.discoveredTurn || resultsTimeline.turn?.turnKey || 'this turn'}`;
  if (data.knowledgeLevel === 'scouted') return `Scouted · known by ${data.discoveredTurn || resultsTimeline.turn?.turnKey || 'this turn'}`;
  if (data.knowledgeLevel === 'observed') return 'Observed · not entered';
  if (data.knowledgeLevel === 'attempted') return 'Attempted · not entered';
  return 'Known';
}

function historicalHexNotes(data) {
  if (!data) return 'No report knowledge was available for this hex by the selected turn.';
  const lines = [];
  if (data.reason) lines.push(data.reason);
  if (data.sourceUnit) lines.push(`Source unit: ${data.sourceUnit}${data.scoutId ? ` · Scout ${data.scoutId}` : ''}`);
  if (data.observedUnits?.length) lines.push(`Units observed: ${data.observedUnits.join(', ')}`);
  if (data.evidence?.length) lines.push(`Report evidence: ${data.evidence.join(' · ')}`);
  return lines.join('\n');
}

function setHistoricalEditingState(enabled) {
  $('terrainSelect').disabled = enabled;
  $('notesInput').disabled = enabled;
  $('saveHexButton').disabled = enabled;
  $('fogHexButton').disabled = enabled;
}

requestVisibleData = function requestVisibleDataWithResults() {
  if (!resultsTimeline.turn) return originalRequestVisibleData();
  if (state.mode !== 'detail') return;
  clearTimeout(areaRequestTimer);
  areaRequestTimer = setTimeout(async () => {
    if (resultsTimeline.loadingArea) return;
    resultsTimeline.loadingArea = true;
    try {
      const b = visibleBounds();
      const rows = await window.tribenet.getResultHexesInArea(b, resultsTimeline.turn.turnKey);
      state.hexCache.clear();
      for (const row of rows) state.hexCache.set(row.coordinate, row);
      state.loadedArea = b;
      draw();
    } finally {
      resultsTimeline.loadingArea = false;
    }
  }, 55);
};

refreshSummaries = async function refreshHistoricalSummaries() {
  if (!resultsTimeline.turn) return originalRefreshSummaries();
  const rows = await window.tribenet.getResultSubmapSummaries(resultsTimeline.turn.turnKey);
  state.summaries.clear();
  for (const row of rows) state.summaries.set(`${row.mapRow}:${row.mapCol}`, Number(row.mapped));
};

function drawResultPartialMarker(point, radius, data) {
  const blocked = resultHasBlockedEvidence(data);
  const markerRadius = Math.max(8, Math.min(13, radius * .30));
  const x = point.x + radius * .48;
  const y = point.y - radius * .42;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6,13,18,.94)';
  ctx.fill();
  ctx.strokeStyle = blocked ? '#e6ad69' : '#77c9e7';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = blocked ? '#ffd19c' : '#c8f1ff';
  ctx.font = `800 ${Math.max(10, markerRadius * 1.25)}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x, y + .5);
  ctx.restore();
}

function drawHistoricalUnits() {
  if (!resultsTimeline.turn?.units?.length) return;
  const slots = new Map();
  for (const unit of resultsTimeline.turn.units) {
    const point = parseCoordinate(unit.currentHex);
    if (!point) continue;
    const key = point.coordinate;
    const slot = slots.get(key) || 0;
    drawUnitLabel(point, unit.unitCode, unit.unitType, slot, '');
    slots.set(key, slot + 1);
  }
}

draw = function drawWithHistoricalResults() {
  originalDraw();
  if (!resultsTimeline.turn || state.mode !== 'detail') return;
  const bounds = visibleBounds();
  const radius = state.scale * .96;
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const coord = coordinateFor(col, row);
      const data = state.hexCache.get(coord);
      if (!resultIsPartial(data)) continue;
      const point = screenFromBase(baseCenter(col, row));
      drawResultPartialMarker(point, radius, data);
    }
  }
  drawHistoricalUnits();
};

async function historicalHexAt(globalCol, globalRow) {
  const coordinate = coordinateFor(globalCol, globalRow);
  const cached = state.hexCache.get(coordinate);
  if (cached) return cached;
  const rows = await window.tribenet.getResultHexesInArea({ minCol: globalCol, maxCol: globalCol, minRow: globalRow, maxRow: globalRow }, resultsTimeline.turn.turnKey);
  const found = rows.find(row => row.coordinate === coordinate) || null;
  if (found) state.hexCache.set(coordinate, found);
  return found;
}

selectHex = async function selectHistoricalHex(globalCol, globalRow) {
  if (!resultsTimeline.turn) {
    setHistoricalEditingState(false);
    return originalSelectHex(globalCol, globalRow);
  }
  const coordinate = coordinateFor(globalCol, globalRow);
  const parsed = parseCoordinate(coordinate);
  const existing = await historicalHexAt(globalCol, globalRow);
  state.selected = { ...parsed, existing };
  $('noSelection').classList.add('hidden');
  $('unitEditor')?.classList.add('hidden');
  $('selectionEditor').classList.remove('hidden');
  $('selectedCoordinate').textContent = coordinate;
  $('selectedState').textContent = historicalStateLabel(existing);
  $('terrainSelect').value = existing?.terrain || 'UNKNOWN';
  $('notesInput').value = historicalHexNotes(existing);
  $('saveStatus').textContent = `Historical results view · Turn ${resultsTimeline.turn.turnKey} · editing disabled.`;
  setHistoricalEditingState(true);
  await loadHexHistory(coordinate);
  draw();
};

loadHexHistory = async function loadHistoricalHexHistory(coordinate) {
  if (!resultsTimeline.turn) {
    setHistoricalEditingState(false);
    return originalLoadHexHistory(coordinate);
  }
  const rows = await window.tribenet.getResultHexHistory(coordinate);
  const visibleRows = rows.filter(row => Number(row.turnSort) <= Number(resultsTimeline.turn.turnSort));
  const host = $('hexHistoryList');
  host.innerHTML = '';
  $('historyTurnContext').textContent = `Knowledge as of Turn ${resultsTimeline.turn.turnKey}`;
  if (!visibleRows.length) {
    host.innerHTML = '<div class="history-empty">Still unknown at this point in the timeline.</div>';
    return;
  }
  for (const row of visibleRows) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const details = [];
    if (row.reason) details.push(row.reason);
    if (row.sourceUnit) details.push(`Source: ${row.sourceUnit}${row.scoutId ? ` · Scout ${row.scoutId}` : ''}`);
    if (row.observedUnits?.length) details.push(`Units: ${row.observedUnits.join(', ')}`);
    if (row.evidence?.length) details.push(row.evidence.join(' · '));
    item.innerHTML = `
      <div class="history-meta"><strong>Turn ${escapeHtml(row.turnKey)}</strong><span>${escapeHtml(row.knowledgeLevel)}</span></div>
      <div>${escapeHtml(row.terrain || 'UNKNOWN')} · ${escapeHtml(row.knowledgeLevel || 'known')}</div>
      ${details.length ? `<div class="history-note">${escapeHtml(details.join(' · '))}</div>` : ''}
    `;
    host.appendChild(item);
  }
};

function stopMapResultPlayback() {
  if (resultsTimeline.playTimer) clearInterval(resultsTimeline.playTimer);
  resultsTimeline.playTimer = null;
  $('mapResultPlay').textContent = 'Play';
}

function updateMapTimelineUI() {
  const hasTurns = resultsTimeline.turns.length > 0;
  const slider = $('mapResultSlider');
  slider.min = '0';
  slider.max = String(Math.max(0, resultsTimeline.turns.length - 1));
  slider.disabled = !hasTurns;
  $('mapResultPrev').disabled = resultsTimeline.turns.length < 2;
  $('mapResultNext').disabled = resultsTimeline.turns.length < 2;
  $('mapResultPlay').disabled = resultsTimeline.turns.length < 2;
  if (!hasTurns) {
    $('mapResultTurnLabel').textContent = 'No results imported';
    $('mapResultStatus').textContent = 'Import a Word results report to populate history.';
    return;
  }
  const idx = Math.max(0, resultsTimeline.turns.findIndex(row => row.turnKey === resultsTimeline.turn?.turnKey));
  slider.value = String(idx);
  $('mapResultTurnLabel').textContent = `Turn ${resultsTimeline.turn?.turnKey || resultsTimeline.turns[idx].turnKey}`;
  $('mapResultStatus').textContent = resultsTimeline.turn
    ? `${resultsTimeline.turn.sourceFile} · ${idx + 1}/${resultsTimeline.turns.length}`
    : `${idx + 1}/${resultsTimeline.turns.length}`;
}

async function applyResultTurn(turnKey, options = {}) {
  const { persist = true, preservePlayback = false } = options;
  if (!preservePlayback) stopMapResultPlayback();
  const detail = await window.tribenet.getResultTurn(turnKey);
  if (!detail) return;
  resultsTimeline.turn = detail;
  if (persist) localStorage.setItem(RESULT_TURN_STORAGE_KEY, turnKey);
  state.hexCache.clear();
  state.loadedArea = null;
  await syncPlannerOverlayToResultTurn(turnKey, null, { redraw: false });
  updateMapTimelineUI();
  await refreshSummaries();
  if (state.mode === 'overview') buildWorldGrid();
  if (state.mode === 'detail') {
    await new Promise(resolve => {
      requestVisibleData();
      setTimeout(resolve, 90);
    });
  }
  if (state.selected) await selectHex(state.selected.globalCol, state.selected.globalRow);
  draw();
}

async function refreshResultTurns(preferredTurnKey = null) {
  resultsTimeline.turns = await window.tribenet.listResultTurns();
  resultsTimeline.ready = true;
  if (!resultsTimeline.turns.length) {
    resultsTimeline.turn = null;
    state.hexCache.clear();
    setHistoricalEditingState(false);
    updateMapTimelineUI();
    await originalRefreshPlannerHistoryForResults();
    return;
  }
  const stored = preferredTurnKey || localStorage.getItem(RESULT_TURN_STORAGE_KEY);
  const selected = resultsTimeline.turns.find(row => row.turnKey === stored) || resultsTimeline.turns[resultsTimeline.turns.length - 1];
  await applyResultTurn(selected.turnKey, { persist: true, preservePlayback: true });
}

async function importMapResultsReport() {
  $('mapImportResultsButton').disabled = true;
  $('mapResultStatus').textContent = 'Importing Word results report…';
  try {
    const result = await window.tribenet.importResultsReport();
    if (result?.canceled) {
      $('mapResultStatus').textContent = 'Import cancelled.';
      return;
    }
    if (result?.error) {
      $('mapResultStatus').textContent = `Import failed: ${result.error}`;
      return;
    }
    await refreshResultTurns(result.turn.turnKey);
    $('mapResultStatus').textContent = `${result.turn.sourceFile} · Turn ${result.turn.turnKey} imported/rebuilt`;
    const firstUnit = result.turn.units?.find(unit => parseCoordinate(unit.currentHex));
    if (firstUnit) {
      const point = parseCoordinate(firstUnit.currentHex);
      showDetail();
      centerOnHex(point.globalCol, point.globalRow);
    }
  } finally {
    $('mapImportResultsButton').disabled = false;
  }
}

function resultTimelineIndex() {
  return Math.max(0, resultsTimeline.turns.findIndex(row => row.turnKey === resultsTimeline.turn?.turnKey));
}

async function moveMapResultTimeline(offset) {
  if (!resultsTimeline.turns.length) return;
  const next = Math.max(0, Math.min(resultsTimeline.turns.length - 1, resultTimelineIndex() + offset));
  await applyResultTurn(resultsTimeline.turns[next].turnKey);
}

function toggleMapResultPlayback() {
  if (resultsTimeline.playTimer) {
    stopMapResultPlayback();
    return;
  }
  if (resultsTimeline.turns.length < 2) return;
  $('mapResultPlay').textContent = 'Pause';
  const start = async () => {
    let idx = resultTimelineIndex();
    if (idx >= resultsTimeline.turns.length - 1) {
      await applyResultTurn(resultsTimeline.turns[0].turnKey, { preservePlayback: true });
      idx = 0;
    }
    resultsTimeline.playTimer = setInterval(async () => {
      const current = resultTimelineIndex();
      if (current >= resultsTimeline.turns.length - 1) {
        stopMapResultPlayback();
        return;
      }
      await applyResultTurn(resultsTimeline.turns[current + 1].turnKey, { preservePlayback: true });
    }, 1200);
  };
  start();
}

function bindResultsMapEvents() {
  $('mapImportResultsButton').addEventListener('click', importMapResultsReport);
  $('mapResultPrev').addEventListener('click', () => moveMapResultTimeline(-1));
  $('mapResultNext').addEventListener('click', () => moveMapResultTimeline(1));
  $('mapResultPlay').addEventListener('click', toggleMapResultPlayback);
  $('mapResultSlider').addEventListener('input', event => {
    const selected = resultsTimeline.turns[Number(event.target.value)];
    if (selected) applyResultTurn(selected.turnKey);
  });
  window.addEventListener('storage', event => {
    if (event.key === RESULT_TURN_STORAGE_KEY && event.newValue && event.newValue !== resultsTimeline.turn?.turnKey) {
      refreshResultTurns(event.newValue);
    }
  });
}

bindResultsMapEvents();
refreshResultTurns();

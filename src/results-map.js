const RESULT_TURN_STORAGE_KEY = 'tribenet:selectedResultTurn';

const resultsTimeline = {
  turns: [],
  // `turns` is the visible timeline (actual reports plus the optional draft
  // planning row).  `resultTurns` stays limited to imported reports so a
  // start-state can always find the report that supplies its event payload.
  resultTurns: [],
  turn: null,
  playTimer: null,
  loadingArea: false,
  ready: false,
  // Import staging loads the target snapshot before playback can establish
  // the previous-turn baseline. Suppress intermediate draws so the user never
  // sees the end state flash before the transition begins.
  transitionStaging: false
};
// Results playback is loaded as a separate script after this module. Expose
// the shared timeline explicitly because top-level `const` bindings are not
// properties on `window`.
window.resultsTimeline = resultsTimeline;

function resultActualRows() {
  const rows = resultsTimeline.resultTurns?.length
    ? resultsTimeline.resultTurns
    : resultsTimeline.turns.filter(row => row && !row.isPlanningTurn);
  return [...rows].filter(row => row?.turnKey && !row.isPlanningTurn)
    .sort((a, b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
}

function resultSummaryFor(turnKey) {
  return resultActualRows().find(row => String(row.turnKey) === String(turnKey)) || null;
}

function incrementResultTurnKey(turnKey) {
  const current = String(turnKey || '').trim();
  const match = current.match(/^(\d+)([-_])(\d+)$/);
  if (!match) return current || null;
  return `${match[1]}${match[2]}${String(Number(match[3]) + 1).padStart(match[3].length, '0')}`;
}

function resultKnowledgeTurnKey(turn = resultsTimeline.turn) {
  return turn?.knowledgeTurnKey || turn?.baselineTurnKey || null;
}

function resultStartUnit(unit, usePreviousHex = false) {
  if (!unit) return null;
  const startHex = usePreviousHex ? (unit.previousHex || unit.currentHex) : unit.currentHex;
  return {
    ...unit,
    currentHex: startHex || null,
    previousHex: null,
    previousTurnKey: null,
    previous: null,
    movement: null,
    scouts: []
  };
}

function resultStartHexRow(row) {
  if (!row?.coordinate) return null;
  return {
    ...row,
    discoveredTurn: 'prestart',
    knowledgeLevel: row.knowledgeLevel || 'visited',
    reason: 'Starting hex',
    sourceUnit: null,
    scoutId: null,
    observedUnits: [],
    evidence: []
  };
}

async function resultInitialKnowledge(eventTurn, units) {
  const rows = [];
  const seen = new Set();
  for (const unit of units || []) {
    const coordinate = unit?.currentHex;
    if (!coordinate || seen.has(coordinate)) continue;
    seen.add(coordinate);
    const parsed = typeof parseCoordinate === 'function' ? parseCoordinate(coordinate) : null;
    let found = [];
    if (parsed && window.tribenet?.getResultHexesInArea && eventTurn?.turnKey) {
      found = await window.tribenet.getResultHexesInArea({
        minCol: parsed.globalCol, maxCol: parsed.globalCol,
        minRow: parsed.globalRow, maxRow: parsed.globalRow
      }, eventTurn.turnKey);
    }
    const row = found.find(item => item.coordinate === coordinate)
      || (parsed ? { coordinate, terrain: 'UNKNOWN', knowledgeLevel: 'visited', ...parsed } : { coordinate, terrain: 'UNKNOWN', knowledgeLevel: 'visited' });
    rows.push(resultStartHexRow({ ...row, ...(parsed || {}) }));
  }
  return rows;
}

async function buildResultStartState(turnKey) {
  const visibleEntry = resultsTimeline.turns.find(row => String(row?.turnKey) === String(turnKey)) || null;
  const summary = resultSummaryFor(turnKey) || (!visibleEntry?.isPlanningTurn ? visibleEntry : null);
  const eventTurn = summary && window.tribenet?.getResultTurn
    ? await window.tribenet.getResultTurn(summary.turnKey)
    : null;
  const baselineKey = visibleEntry?.isPlanningTurn
    ? (visibleEntry.baselineTurnKey || null)
    : (() => {
      const currentSort = Number(summary?.turnSort || 0);
      return resultActualRows()
        .filter(row => Number(row.turnSort || 0) < currentSort)
        .sort((a, b) => Number(b.turnSort || 0) - Number(a.turnSort || 0))[0]?.turnKey || null;
    })();
  const baseline = baselineKey && window.tribenet?.getResultTurn
    ? await window.tribenet.getResultTurn(baselineKey)
    : null;
  const sourceUnits = baseline?.units?.length
    ? baseline.units.map(unit => resultStartUnit(unit))
    : [];
  // A report may mention a unit that was not emitted by the previous report
  // (for example a split/element that is about to move).  Keep it in the
  // starting snapshot at its reported previous hex so playback never makes a
  // unit pop into existence at its destination.
  const knownUnitCodes = new Set(sourceUnits.map(unit => String(unit.unitCode)));
  for (const unit of eventTurn?.units || []) {
    if (!knownUnitCodes.has(String(unit.unitCode))) {
      sourceUnits.push(resultStartUnit(unit, true));
      knownUnitCodes.add(String(unit.unitCode));
    }
  }
  const startHexKnowledge = baselineKey
    ? []
    : await resultInitialKnowledge(eventTurn, sourceUnits);
  const nextTurnKey = eventTurn && typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore.planningTurnKey
    ? TurnLifecycleCore.planningTurnKey(eventTurn)
    : incrementResultTurnKey(turnKey);
  return {
    ...(eventTurn || visibleEntry || {}),
    turnKey: String(turnKey),
    turnSort: Number(visibleEntry?.turnSort ?? summary?.turnSort ?? eventTurn?.turnSort ?? 0),
    sourceFile: eventTurn?.sourceFile || visibleEntry?.sourceFile || `Turn ${turnKey}`,
    metadata: {
      ...(eventTurn?.metadata || visibleEntry?.metadata || {}),
      baselineTurn: baselineKey,
      eventTurn: summary?.turnKey || null,
      nextTurn: nextTurnKey
    },
    units: sourceUnits,
    events: [],
    isPlanningTurn: true,
    isStartState: true,
    eventTurnKey: summary?.turnKey || null,
    knowledgeTurnKey: baselineKey,
    baselineTurnKey: baselineKey,
    baselineTurnSort: Number(baseline?.turnSort ?? visibleEntry?.baselineTurnSort ?? 0),
    baselineSourceFile: baseline?.sourceFile || visibleEntry?.baselineSourceFile || null,
    knowledgeTurnSort: Number(baseline?.turnSort ?? visibleEntry?.baselineTurnSort ?? 0),
    startHexKnowledge
  };
}

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

  // An imported report is a playback payload, not a planning overlay.  Keep
  // the starting map clean even when an older order workbook exists for the
  // same key; planning resumes only on the next start state (or a synthetic
  // planning row with no event payload).
  if (resultsTimeline.turn?.isStartState
    && resultsTimeline.turn.eventTurnKey
    && String(resultsTimeline.turn.turnKey) === String(turnKey)) {
    state.planHistory = [];
    state.planImport = null;
    state.routeCache = null;
    updatePlanUI();
    if (redraw) draw();
    return null;
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
      const knowledgeKey = resultKnowledgeTurnKey();
      const rows = knowledgeKey
        ? await window.tribenet.getResultHexesInArea(b, knowledgeKey)
        : (resultsTimeline.turn.startHexKnowledge || []).filter(row => row.globalCol >= b.minCol && row.globalCol <= b.maxCol && row.globalRow >= b.minRow && row.globalRow <= b.maxRow);
      state.hexCache.clear();
      for (const row of rows) state.hexCache.set(row.coordinate, row);
      if (window.resultsPlayback?.active && typeof window.resultsPlaybackEnsureBaseline === 'function') {
        await window.resultsPlaybackEnsureBaseline(b);
      }
      state.loadedArea = b;
      if (state.planImport?.plan) state.routeCache = null;
      draw();
    } finally {
      resultsTimeline.loadingArea = false;
    }
  }, 55);
};

refreshSummaries = async function refreshHistoricalSummaries() {
  if (!resultsTimeline.turn) return originalRefreshSummaries();
  const knowledgeKey = resultKnowledgeTurnKey();
  const rows = knowledgeKey
    ? await window.tribenet.getResultSubmapSummaries(knowledgeKey)
    : [...(resultsTimeline.turn.startHexKnowledge || [])].map(row => ({
      mapRow: row.mapRow ?? Math.floor(Number(row.globalRow || 0) / 21),
      mapCol: row.mapCol ?? Math.floor(Number(row.globalCol || 0) / 30),
      mapped: 1
    }));
  state.summaries.clear();
  for (const row of rows) state.summaries.set(`${row.mapRow}:${row.mapCol}`, Number(row.mapped));
};

function drawResultPartialMarker(point, radius, data) {
  // Playback owns the reveal animation (including the border question mark).
  // Drawing the historical marker as well creates a duplicate '?' and can
  // make a tile look revealed before its scout reaches it.
  if (window.resultsPlayback?.active) return;
  const blocked = resultHasBlockedEvidence(data);
  const markerRadius = Math.max(8, Math.min(13, radius * .30));
  // In the isometric view the projected centre is already the correct visual
  // anchor; the old corner offset made partial-exploration markers look like
  // they belonged to the neighbouring face of the hex.
  const x = typeof IsoMapper !== 'undefined' && IsoMapper.enabled ? point.x : point.x + radius * .48;
  const y = typeof IsoMapper !== 'undefined' && IsoMapper.enabled ? point.y : point.y - radius * .42;
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
  const planning = Boolean(resultsTimeline.turn.isPlanningTurn);
  const plannedCodes = planning
    ? new Set((state.routeCache?.movements || state.planImport?.plan?.movements || [])
      .map(row => String(row?.unit || row?.unitCode || '')).filter(Boolean))
    : new Set();
  const slots = new Map();
  const seen = new Set();
  for (const unit of resultsTimeline.turn.units) {
    const unitCode = String(unit.unitCode);
    // Planned movement units are drawn by drawPlanOverlay at their origin.
    // Keep only units without a planned route in this historical pass, so the
    // planning baseline does not show the same unit twice.
    if (plannedCodes.has(unitCode)) continue;
    if (seen.has(unitCode)) continue;
    seen.add(unitCode);
    const point = typeof resultsPlaybackUnitPosition === 'function'
      ? resultsPlaybackUnitPosition(unitCode, unit.currentHex)
      : parseCoordinate(unit.currentHex);
    if (!point) continue;
    const key = point.coordinate;
    const slot = slots.get(key) || 0;
    drawUnitLabel(point, unitCode, unit.unitType, slot, '', unit);
    slots.set(key, slot + 1);
  }
}

draw = function drawWithHistoricalResults() {
  if (resultsTimeline.transitionStaging) return;
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
  const knowledgeKey = resultKnowledgeTurnKey();
  const rows = knowledgeKey
    ? await window.tribenet.getResultHexesInArea({ minCol: globalCol, maxCol: globalCol, minRow: globalRow, maxRow: globalRow }, knowledgeKey)
    : (resultsTimeline.turn.startHexKnowledge || []).filter(row => row.coordinate === coordinate);
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
  const cutoff = resultKnowledgeTurnKey()
    ? Number(resultsTimeline.turn.knowledgeTurnSort ?? resultsTimeline.turn.turnSort)
    : -Infinity;
  const visibleRows = rows.filter(row => Number(row.turnSort) <= cutoff);
  const host = $('hexHistoryList');
  host.innerHTML = '';
  $('historyTurnContext').textContent = `Knowledge at start of Turn ${resultsTimeline.turn.turnKey}`;
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
  const playTurn = $('mapResultPlayTurn');
  if (playTurn) playTurn.disabled = !resultsTimeline.turn?.eventTurnKey;
  if (!hasTurns) {
    $('mapResultTurnLabel').textContent = 'No results imported';
    $('mapResultStatus').textContent = 'Import a Word results report to populate history.';
    return;
  }
  const idx = Math.max(0, resultsTimeline.turns.findIndex(row => row.turnKey === resultsTimeline.turn?.turnKey));
  slider.value = String(idx);
  $('mapResultTurnLabel').textContent = resultsTimeline.turn
    ? `Turn ${resultsTimeline.turn.turnKey} · START`
    : `Turn ${resultsTimeline.turns[idx].turnKey}`;
  $('mapResultStatus').textContent = resultsTimeline.turn
    ? `${resultsTimeline.turn.sourceFile} · report ${resultsTimeline.turn.eventTurnKey || 'not imported'} · ${idx + 1}/${resultsTimeline.turns.length}`
    : `${idx + 1}/${resultsTimeline.turns.length}`;
}

async function applyResultTurn(turnKey, options = {}) {
  const { persist = true, preservePlayback = false } = options;
  if (!preservePlayback) stopMapResultPlayback();
  if (!preservePlayback && typeof stopResultsPlayback === 'function') stopResultsPlayback({ draw: false });
  const startState = await buildResultStartState(turnKey);
  if (!startState || !startState.turnKey) return null;
  resultsTimeline.turn = startState;
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
  return startState;
}

async function advanceToNextStartState(actualTurnKey = null) {
  const actual = actualTurnKey && window.tribenet?.getResultTurn
    ? await window.tribenet.getResultTurn(actualTurnKey)
    : null;
  const nextTurnKey = actual && typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore.planningTurnKey
    ? TurnLifecycleCore.planningTurnKey(actual)
    : incrementResultTurnKey(actualTurnKey);
  let planning = resultsTimeline.turns.find(row => String(row?.turnKey) === String(nextTurnKey)) || null;
  if (!planning && nextTurnKey) {
    planning = {
      turnKey: nextTurnKey,
      turnSort: Number(actual?.turnSort || 0) + 0.5,
      sourceFile: `Start of Turn ${nextTurnKey}`,
      metadata: { baselineTurn: actualTurnKey, planningTurn: nextTurnKey },
      isPlanningTurn: true,
      isStartState: true,
      baselineTurnKey: actualTurnKey,
      knowledgeTurnKey: actualTurnKey
    };
    resultsTimeline.turns = [...resultsTimeline.turns, planning].sort((a, b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
  }
  state.planningVisible = true;
  const toggle = $('planningToggle');
  if (toggle) toggle.checked = true;
  if (planning) await applyResultTurn(planning.turnKey, { persist: true });
  if (state.mode !== 'detail') showDetail();
  if (planning && typeof lifecycleDecoratePlanningUI === 'function' && !resultsTimeline.turn?.eventTurnKey) lifecycleDecoratePlanningUI(resultsTimeline.turn);
  else updatePlanUI();
  draw();
  return planning || null;
}

// Backwards-compatible name used by older playback handoff code and external
// integrations.  The operation now advances to the next *start* state.
const openPlanningAfterResults = advanceToNextStartState;
window.advanceToNextStartState = advanceToNextStartState;
window.openPlanningAfterResults = advanceToNextStartState;

async function playImportedResultsTransition(actualTurnKey) {
  if (!actualTurnKey || !window.tribenet?.getResultTurn) return false;
  const actual = await window.tribenet.getResultTurn(actualTurnKey);
  if (!actual) return false;
  resultsTimeline.transitionStaging = true;
  try {
    await applyResultTurn(actual.turnKey, { persist: true });
    const firstUnit = resultsTimeline.turn?.units?.find(unit => parseCoordinate(unit.currentHex));
    showMapper({ overview: false });
    showDetail();
    if (firstUnit) {
      const point = parseCoordinate(firstUnit.currentHex);
      centerOnHex(point.globalCol, point.globalRow);
    }
    // Let the starting snapshot settle before playback captures its baseline.
    await new Promise(resolve => setTimeout(resolve, 120));
  } finally {
    resultsTimeline.transitionStaging = false;
  }
  const started = typeof startResultsPlayback === 'function'
    ? await startResultsPlayback({ handoff: true, eventTurnKey: actual.turnKey })
    : false;
  if (!started) await advanceToNextStartState(actual.turnKey);
  return started;
}

async function refreshResultTurns(preferredTurnKey = null) {
  resultsTimeline.resultTurns = await window.tribenet.listResultTurns();
  resultsTimeline.turns = [...resultsTimeline.resultTurns];
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
  resultsTimeline.transitionStaging = true;
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
    await playImportedResultsTransition(result.turn.turnKey);
    $('mapResultStatus').textContent = `${result.turn.sourceFile} · Turn ${result.turn.turnKey} imported/rebuilt`;
    const firstUnit = result.turn.units?.find(unit => parseCoordinate(unit.currentHex));
    if (firstUnit) {
      const point = parseCoordinate(firstUnit.currentHex);
      showDetail();
      centerOnHex(point.globalCol, point.globalRow);
    }
  } finally {
    resultsTimeline.transitionStaging = false;
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

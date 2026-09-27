// Results are the authoritative end-of-turn record. The Mapper also exposes a
// synthetic next-turn planning state whose map knowledge and unit positions come
// from the latest Results report.

function lifecyclePlanningTurnKey() {
  if (resultsTimeline?.turn?.isPlanningTurn) return resultsTimeline.turn.turnKey;
  return TurnLifecycleCore.planningTurnKey(resultsTimeline?.turn || null)
    || state?.planImport?.turnKey
    || state?.planImport?.plan?.turnKey
    || null;
}

function lifecycleActualRecord(resultTurn) {
  const plan = TurnLifecycleCore.actualPlanFromResult(resultTurn);
  if (!plan) return null;
  return {
    id: 'actual',
    turnKey: resultTurn.turnKey,
    sourceFile: resultTurn.sourceFile || `Turn ${resultTurn.turnKey} Results`,
    importedAt: resultTurn.importedAt || null,
    isActualResult: true,
    plan
  };
}

function lifecycleStepCoordinate(hex, direction) {
  const start = parseCoordinate(hex);
  if (!start) return null;
  const next = stepHex(start, direction);
  return next?.coordinate || null;
}

function lifecycleHydrateCompletedRecord(record, resultTurn) {
  if (!record?.plan || !resultTurn) return record;
  const plan = JSON.parse(JSON.stringify(record.plan));
  const starts = new Map((resultTurn.units || []).filter(unit => unit.currentHex).map(unit => [String(unit.unitCode), unit.currentHex]));
  const pending = [...(plan.unitCreations || [])];
  let changed = true;
  while (pending.length && changed) {
    changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const creation = pending[i];
      const parentStart = starts.get(String(creation.parentUnit));
      if (!parentStart) continue;
      const direction = String(creation.direction || '').toUpperCase();
      const childStart = ['N','NE','SE','S','SW','NW'].includes(direction)
        ? (lifecycleStepCoordinate(parentStart, direction) || parentStart)
        : parentStart;
      starts.set(String(creation.unit), childStart);
      pending.splice(i, 1);
      changed = true;
    }
  }

  plan.movements = (plan.movements || []).map(row => {
    const orders = [...(row.orders || [])];
    const gotoHex = row.gotoHex || (orders.some(order => String(order).trim().toUpperCase() === 'GOTO') ? row.startHex : null);
    return {
      ...row,
      gotoHex: gotoHex || null,
      startHex: starts.get(String(row.unit)) || null,
      orders: orders.map(order => String(order).trim().toUpperCase() === 'GOTO' && gotoHex ? `GOTO ${gotoHex}` : order)
    };
  });

  const movementUnits = new Set(plan.movements.map(row => String(row.unit)));
  const units = new Map((plan.units || []).map(unit => [String(unit.unit), unit]));
  for (const scout of plan.scouts || []) {
    const unit = String(scout.unit || '');
    if (!unit || movementUnits.has(unit)) continue;
    const meta = units.get(unit) || {};
    plan.movements.push({
      unit,
      unitName: scout.unitName || meta.unitName || null,
      type: meta.type || 'Unit',
      startHex: starts.get(unit) || null,
      orders: [],
      scoutAnchor: true
    });
    movementUnits.add(unit);
  }
  return { ...record, plan };
}

function lifecycleSetPlanRecord(record, selectValue = null, redraw = true) {
  state.planImport = record || null;
  state.routeCache = record?.plan ? buildPlanRoutes(record.plan) : null;
  const select = document.getElementById('turnSelect');
  if (select && selectValue != null) select.value = String(selectValue);
  updatePlanUI();
  if (redraw) draw();
}

function lifecycleDecorateActualUI(resultTurn) {
  const planningTurn = TurnLifecycleCore.planningTurnKey(resultTurn);
  const status = document.getElementById('planStatus');
  const title = document.getElementById('plannerTurnTitle');
  const source = document.getElementById('plannerSourceLabel');
  if (status) status.textContent = planningTurn
    ? `Turn ${resultTurn.turnKey} actual movement/scouting · planning baseline for ${planningTurn}`
    : `Turn ${resultTurn.turnKey} actual movement/scouting`;
  if (title) title.textContent = `Actual Turn ${resultTurn.turnKey}`;
  if (source) source.textContent = resultTurn.sourceFile || 'Results report';
}

function lifecycleDecoratePlanningUI(resultTurn) {
  if (!resultTurn?.isPlanningTurn) return;
  const baselineTurn = resultTurn.baselineTurnKey || resultTurn.metadata?.baselineTurn || 'previous turn';
  const status = document.getElementById('planStatus');
  const timelineLabel = document.getElementById('mapResultTurnLabel');
  const timelineStatus = document.getElementById('mapResultStatus');
  if (timelineLabel) timelineLabel.textContent = `Turn ${resultTurn.turnKey} · PLANNING`;
  if (timelineStatus) timelineStatus.textContent = `Planning from actual Turn ${baselineTurn} Results · movement/scouting belongs to Turn ${resultTurn.turnKey}`;
  if (status && !state.planImport) status.textContent = `Planning Turn ${resultTurn.turnKey} · baseline from actual Turn ${baselineTurn}.`;
}

const lifecycleOriginalSyncPlannerOverlay = syncPlannerOverlayToResultTurn;
syncPlannerOverlayToResultTurn = async function syncPlannerOverlayWithActualResults(turnKey, preferredId = null, options = {}) {
  const { redraw = true } = options;
  if (!turnKey) return lifecycleOriginalSyncPlannerOverlay(turnKey, preferredId, options);

  const resultTurn = resultsTimeline?.turn?.turnKey === turnKey
    ? resultsTimeline.turn
    : await window.tribenet.getResultTurn(turnKey);
  if (!resultTurn) return lifecycleOriginalSyncPlannerOverlay(turnKey, preferredId, options);

  // Synthetic next-turn planning state. Before Completed Orders exists this is a
  // draft planning turn. Once Completed Orders is imported it becomes authoritative:
  // local draft routes/activities are cleared by the backend and the workbook is
  // selected by default for verification.
  if (resultTurn.isPlanningTurn) {
    const imports = await window.tribenet.getPlannerImports(turnKey);
    state.planHistory = imports;
    const select = document.getElementById('turnSelect');
    if (select) {
      select.innerHTML = '';
      if (!imports.length) {
        const draftOption = document.createElement('option');
        draftOption.value = 'draft';
        draftOption.textContent = `Turn ${turnKey} · Draft planning`;
        select.appendChild(draftOption);
      } else {
        for (const row of imports) {
          const option = document.createElement('option');
          option.value = String(row.id);
          const date = row.importedAt ? new Date(row.importedAt).toLocaleDateString() : '';
          option.textContent = `Turn ${row.turnKey} · Completed Orders · ${row.sourceFile}${date ? ` · ${date}` : ''}`;
          select.appendChild(option);
        }
      }
      select.title = imports.length
        ? `Completed Orders are authoritative for Turn ${turnKey}`
        : `Planning Turn ${turnKey} from the Turn ${resultTurn.baselineTurnKey || 'previous'} Results baseline`;
    }

    if (imports.length) {
      const requestedId = Number(preferredId);
      const preferred = preferredId !== 'draft' && Number.isFinite(requestedId) && imports.some(row => Number(row.id) === requestedId)
        ? await window.tribenet.getPlannerPlan(requestedId)
        : await window.tribenet.getPlannerPlanForTurn(turnKey);
      if (preferred) {
        const hydrated = lifecycleHydrateCompletedRecord(preferred, resultTurn);
        lifecycleSetPlanRecord(hydrated, hydrated.id, false);
        const status = document.getElementById('planStatus');
        const title = document.getElementById('plannerTurnTitle');
        const source = document.getElementById('plannerSourceLabel');
        if (status) status.textContent = `Turn ${hydrated.turnKey} · Completed Orders are authoritative; displaying submitted movement and scouting.`;
        if (title) title.textContent = `Turn ${hydrated.turnKey} · Completed Orders`;
        if (source) source.textContent = hydrated.sourceFile || 'Completed Orders';
        if (redraw) draw();
        return hydrated;
      }
    }

    lifecycleSetPlanRecord(null, 'draft', false);
    lifecycleDecoratePlanningUI(resultTurn);
    if (redraw) draw();
    return null;
  }

  const planningTurn = TurnLifecycleCore.planningTurnKey(resultTurn);
  const imports = planningTurn ? await window.tribenet.getPlannerImports(planningTurn) : [];
  state.planHistory = imports;

  const select = document.getElementById('turnSelect');
  if (select) {
    select.innerHTML = '';
    const actualOption = document.createElement('option');
    actualOption.value = 'actual';
    actualOption.textContent = `Turn ${turnKey} · Actual Results`;
    select.appendChild(actualOption);
    for (const row of imports) {
      const option = document.createElement('option');
      option.value = String(row.id);
      const date = row.importedAt ? new Date(row.importedAt).toLocaleDateString() : '';
      option.textContent = `Turn ${row.turnKey} · ${row.sourceFile}${date ? ` · ${date}` : ''}`;
      select.appendChild(option);
    }
    select.title = planningTurn
      ? `Actual Turn ${turnKey}, plus submitted orders for planning Turn ${planningTurn}`
      : `Actual Turn ${turnKey}`;
  }

  const requestedId = Number(preferredId);
  if (preferredId !== 'actual' && Number.isFinite(requestedId) && imports.some(row => Number(row.id) === requestedId)) {
    const preferred = await window.tribenet.getPlannerPlan(requestedId);
    if (preferred) {
      lifecycleSetPlanRecord(preferred, requestedId, false);
      const status = document.getElementById('planStatus');
      if (status) status.textContent = `Turn ${preferred.turnKey} · completed orders loaded over the Turn ${turnKey} Results baseline.`;
      if (redraw) {
        if (state.selected) await loadHexHistory(state.selected.coordinate);
        draw();
      }
      return preferred;
    }
  }

  const actual = lifecycleActualRecord(resultTurn);
  lifecycleSetPlanRecord(actual, 'actual', false);
  lifecycleDecorateActualUI(resultTurn);
  if (redraw) {
    if (state.selected) await loadHexHistory(state.selected.coordinate);
    draw();
  }
  return actual;
};

function lifecyclePlanningEntry() {
  return (resultsTimeline?.turns || []).find(row => row.isPlanningTurn) || null;
}

function lifecycleKnowledgeTurnKey() {
  return resultsTimeline?.turn?.baselineTurnKey || resultsTimeline?.turn?.turnKey || null;
}

// Planning Turn 906-04 uses the map knowledge as-of actual Turn 906-03.
const lifecycleOriginalRequestVisibleData = requestVisibleData;
requestVisibleData = function requestVisibleDataForPlanningTurn() {
  if (!resultsTimeline?.turn?.isPlanningTurn) return lifecycleOriginalRequestVisibleData();
  if (state.mode !== 'detail') return;
  clearTimeout(areaRequestTimer);
  areaRequestTimer = setTimeout(async () => {
    if (resultsTimeline.loadingArea) return;
    resultsTimeline.loadingArea = true;
    try {
      const b = visibleBounds();
      const rows = await window.tribenet.getResultHexesInArea(b, lifecycleKnowledgeTurnKey());
      state.hexCache.clear();
      for (const row of rows) state.hexCache.set(row.coordinate, row);
      state.loadedArea = b;
      draw();
    } finally {
      resultsTimeline.loadingArea = false;
    }
  }, 55);
};

const lifecycleOriginalRefreshSummaries = refreshSummaries;
refreshSummaries = async function refreshSummariesForPlanningTurn() {
  if (!resultsTimeline?.turn?.isPlanningTurn) return lifecycleOriginalRefreshSummaries();
  const rows = await window.tribenet.getResultSubmapSummaries(lifecycleKnowledgeTurnKey());
  state.summaries.clear();
  for (const row of rows) state.summaries.set(`${row.mapRow}:${row.mapCol}`, Number(row.mapped));
};

const lifecycleOriginalHistoricalHexAt = historicalHexAt;
historicalHexAt = async function historicalHexAtPlanningBaseline(globalCol, globalRow) {
  if (!resultsTimeline?.turn?.isPlanningTurn) return lifecycleOriginalHistoricalHexAt(globalCol, globalRow);
  const coordinate = coordinateFor(globalCol, globalRow);
  const cached = state.hexCache.get(coordinate);
  if (cached) return cached;
  const rows = await window.tribenet.getResultHexesInArea(
    { minCol: globalCol, maxCol: globalCol, minRow: globalRow, maxRow: globalRow },
    lifecycleKnowledgeTurnKey()
  );
  const found = rows.find(row => row.coordinate === coordinate) || null;
  if (found) state.hexCache.set(coordinate, found);
  return found;
};

// A saved Unit/Scout Move belongs to the turn being planned, not the Results turn
// which supplied the starting state. Example: Results 906-03 -> planning 906-04.
savedMovementCurrentTurnKey = function savedMovementNextTurnKey() {
  return lifecyclePlanningTurnKey();
};

const lifecycleOriginalApplyResultTurn = applyResultTurn;
applyResultTurn = async function applyActualOrPlanningTurn(turnKey, options = {}) {
  const planningEntry = (resultsTimeline?.turns || []).find(row => row.isPlanningTurn && String(row.turnKey) === String(turnKey));
  if (!planningEntry) return lifecycleOriginalApplyResultTurn(turnKey, options);

  const { persist = true, preservePlayback = false } = options;
  if (!preservePlayback) stopMapResultPlayback();
  const baseline = await window.tribenet.getResultTurn(planningEntry.baselineTurnKey);
  if (!baseline) return null;

  resultsTimeline.turn = {
    ...baseline,
    turnKey: planningEntry.turnKey,
    turnSort: Number(planningEntry.baselineTurnSort ?? baseline.turnSort),
    sourceFile: `Planning baseline from ${baseline.sourceFile || `Turn ${baseline.turnKey} Results`}`,
    metadata: { ...(baseline.metadata || {}), baselineTurn: baseline.turnKey, planningTurn: planningEntry.turnKey, nextTurn: planningEntry.turnKey },
    isPlanningTurn: true,
    baselineTurnKey: baseline.turnKey,
    baselineTurnSort: Number(baseline.turnSort || 0),
    baselineSourceFile: baseline.sourceFile || null
  };
  if (persist) localStorage.setItem(RESULT_TURN_STORAGE_KEY, planningEntry.turnKey);
  state.hexCache.clear();
  state.loadedArea = null;
  await syncPlannerOverlayToResultTurn(planningEntry.turnKey, null, { redraw: false });
  updateMapTimelineUI();
  lifecycleDecoratePlanningUI(resultsTimeline.turn);
  await refreshSummaries();
  if (state.mode === 'overview') buildWorldGrid();
  if (state.mode === 'detail') {
    await new Promise(resolve => {
      requestVisibleData();
      setTimeout(resolve, 90);
    });
  }
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  if (movementPlannerState.active) movementPlannerReset();
  await savedMovementRefresh();
  if (state.selected) await selectHex(state.selected.globalCol, state.selected.globalRow);
  lifecycleDecoratePlanningUI(resultsTimeline.turn);
  draw();
  return resultsTimeline.turn;
};

const lifecycleOriginalRefreshResultTurns = refreshResultTurns;
refreshResultTurns = async function refreshResultsAndPlanningTurn(preferredTurnKey = null) {
  const storedBefore = preferredTurnKey || localStorage.getItem(RESULT_TURN_STORAGE_KEY);
  await lifecycleOriginalRefreshResultTurns(preferredTurnKey);
  const planningEntry = TurnLifecycleCore.planningTimelineEntry(resultsTimeline.turns);
  if (!planningEntry) return;

  resultsTimeline.turns = [...resultsTimeline.turns, planningEntry];
  updateMapTimelineUI();

  // Existing installs will normally have the latest actual turn persisted. On
  // startup move them into its next planning turn. An explicit preferred planning
  // turn also selects that synthetic planning state.
  const shouldOpenPlanning = String(storedBefore || '') === String(planningEntry.turnKey)
    || (!preferredTurnKey && (!storedBefore || String(storedBefore) === String(planningEntry.baselineTurnKey)));
  if (shouldOpenPlanning) {
    await applyResultTurn(planningEntry.turnKey, { persist: true, preservePlayback: true });
  }
};

const lifecycleTurnSelect = document.getElementById('turnSelect');
if (lifecycleTurnSelect) {
  lifecycleTurnSelect.addEventListener('change', async event => {
    if (!['actual', 'draft'].includes(event.target.value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (resultsTimeline?.turn?.turnKey) {
      await syncPlannerOverlayToResultTurn(resultsTimeline.turn.turnKey, event.target.value);
      await savedMovementRefresh();
      if (resultsTimeline.turn.isPlanningTurn) lifecycleDecoratePlanningUI(resultsTimeline.turn);
    }
  }, true);
}

function lifecycleRefreshLabels() {
  const planningTurn = lifecyclePlanningTurnKey();
  const hint = document.getElementById('movementPlannerOriginHint');
  if (hint && planningTurn && !savedMovementPlansState.selectedUnitCode) {
    hint.textContent = `Planning Turn ${planningTurn}. Select a unit; its location from the latest Results report becomes the movement origin.`;
  }
}

const lifecycleOriginalSavedMovementRefresh = savedMovementRefresh;
savedMovementRefresh = async function savedMovementRefreshForNextTurn() {
  const result = await lifecycleOriginalSavedMovementRefresh();
  lifecycleRefreshLabels();
  return result;
};

// The initial Results load is already in flight when this compatibility layer is
// appended by preload. Re-run the timeline once the page has settled so the
// synthetic next planning turn appears without needing another Results import.
setTimeout(async () => {
  await refreshResultTurns();
  if (resultsTimeline?.turn?.isPlanningTurn) lifecycleDecoratePlanningUI(resultsTimeline.turn);
}, 450);

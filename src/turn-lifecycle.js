// Results are the authoritative end-of-turn record. The selected Results turn is also
// the baseline for planning its Next Turn, so history and planning deliberately use
// different turn keys here.

function lifecyclePlanningTurnKey() {
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

const lifecycleOriginalSyncPlannerOverlay = syncPlannerOverlayToResultTurn;
syncPlannerOverlayToResultTurn = async function syncPlannerOverlayWithActualResults(turnKey, preferredId = null, options = {}) {
  const { redraw = true } = options;
  if (!turnKey) return lifecycleOriginalSyncPlannerOverlay(turnKey, preferredId, options);

  const resultTurn = resultsTimeline?.turn?.turnKey === turnKey
    ? resultsTimeline.turn
    : await window.tribenet.getResultTurn(turnKey);
  if (!resultTurn) return lifecycleOriginalSyncPlannerOverlay(turnKey, preferredId, options);

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

// A saved Unit/Scout Move belongs to the turn being planned, not the Results turn
// which supplied the starting state. Example: Results 906-03 -> planning 906-04.
savedMovementCurrentTurnKey = function savedMovementNextTurnKey() {
  return lifecyclePlanningTurnKey();
};

const lifecycleTurnSelect = document.getElementById('turnSelect');
if (lifecycleTurnSelect) {
  lifecycleTurnSelect.addEventListener('change', async event => {
    if (event.target.value !== 'actual') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (resultsTimeline?.turn?.turnKey) {
      await syncPlannerOverlayToResultTurn(resultsTimeline.turn.turnKey, 'actual');
      await savedMovementRefresh();
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

// The initial Results load may already be in flight when this compatibility layer is
// appended by preload. Re-apply once the page has settled so existing installs move
// immediately to the corrected turn lifecycle without needing another import.
setTimeout(async () => {
  if (!resultsTimeline?.turn?.turnKey) return;
  await syncPlannerOverlayToResultTurn(resultsTimeline.turn.turnKey, 'actual', { redraw: false });
  await savedMovementRefresh();
  draw();
}, 450);

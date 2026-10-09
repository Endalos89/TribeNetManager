/* Selected-unit turn actions. Each action owns its setup, route and commit. */
const turnActionState = {
  active: null,
  shiftChainStarted: false,
  pendingOcean: null,
  tracePoint: null,
  status: ''
};

const TURN_ACTION_ICONS = {
  move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M13 6l6 6-6 6"/></svg>',
  split: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M5 8l7 4 7-4M5 16l7-4 7 4"/></svg>',
  scout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19c4-8 7-12 16-14M4 19l6-1M4 19l2-6"/></svg>',
  cancel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6M4 5v6h6"/></svg>'
};

function turnActionsEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function turnActionsUnit() {
  if (state.selectedUnit && String(savedMovementPlansState.selectedUnitCode) !== String(state.selectedUnit)) {
    savedMovementPlansState.selectedUnitCode = String(state.selectedUnit);
  }
  return savedMovementSelectedUnit();
}

function turnActionsPlanningAvailable() {
  return state.mode === 'detail'
    && Boolean(state.selectedUnit)
    && Boolean(savedMovementCurrentTurnKey())
    && resultsTimeline?.turn?.isPlanningTurn !== false;
}

function turnActionsActiveLabel() {
  return turnActionState.active === 'scout' ? 'Send Out Scout' : 'Move Unit';
}

function turnActionsRouteSummary() {
  const route = movementPlannerState.route;
  if (!route || route.status !== 'ok') return turnActionState.status || 'Choose a destination on the map.';
  const known = Number(route.knownMp ?? route.totalMp ?? 0);
  const weather = Number(route.badWeatherMp ?? known);
  const unknown = Number(route.unknownEntryCount || 0);
  const commands = (route.directions || []).join(' → ');
  const cost = unknown ? `${known} MP + ?×${unknown} · bad weather ${weather}+? MP` : `${known} MP · bad weather ${weather} MP`;
  return `${cost}${commands ? ` · ${commands}` : ''}`;
}

function turnActionsRender() {
  const bar = document.getElementById('turnActionBar');
  if (!bar) return;
  const unit = turnActionsUnit();
  if (!turnActionsPlanningAvailable() || !unit) {
    bar.classList.add('hidden');
    return;
  }

  const garrison = String(unit.unitType || unit.type || '').toLowerCase() === 'garrison';
  const canMove = savedMovementCanMoveUnit(unit);
  const routeCount = savedMovementPlansState.routes.filter(route => String(route.unitCode).toLowerCase() === String(unit.unitCode).toLowerCase()).length;
  const splitCount = (savedMovementPlansState.unitSplits || []).length;
  const active = Boolean(turnActionState.active);
  const scoutControls = turnActionState.active === 'scout' ? `
    <div class="turn-action-scout-fields">
      <label><span>People</span><input id="turnActionScoutPeople" type="number" min="1" max="99" value="${Number(savedMovementPlansState.scoutCount || 2)}" /></label>
      <label><span>Horses</span><input id="turnActionScoutHorses" type="number" min="0" max="99" value="${Number(savedMovementPlansState.scoutHorses || 2)}" /></label>
      <label><span>Mission</span><select id="turnActionScoutMission"><option${savedMovementPlansState.scoutMission === 'LOCATE' ? ' selected' : ''}>LOCATE</option><option${savedMovementPlansState.scoutMission === 'PATROL' ? ' selected' : ''}>PATROL</option><option${savedMovementPlansState.scoutMission === 'RAID' ? ' selected' : ''}>RAID</option><option${savedMovementPlansState.scoutMission === 'SPY' ? ' selected' : ''}>SPY</option></select></label>
    </div>` : '';

  bar.innerHTML = `
    <div class="turn-action-heading">
      <div><span class="eyebrow">TURN ACTIONS</span><strong>${turnActionsEscape(unit.unitCode)}</strong><span>${turnActionsEscape(unit.unitName || unit.unitType || 'Unit')}</span></div>
      <span class="turn-action-status">${turnActionsEscape(active ? `${turnActionsActiveLabel()} · ${turnActionsRouteSummary()}` : turnActionState.status || 'Choose an action')}</span>
    </div>
    ${scoutControls}
    <div class="turn-action-buttons">
      ${!garrison ? `<button class="turn-action-button${turnActionState.active === 'unit' ? ' active' : ''}" data-turn-action="move"${!canMove && !active ? ' disabled' : ''} title="Move Unit (M)">${TURN_ACTION_ICONS.move}<span>Move Unit</span><kbd>M</kbd></button>` : ''}
      <button class="turn-action-button${turnActionState.active === 'split' ? ' active' : ''}" data-turn-action="split"${active ? ' disabled' : ''} title="Split Off Unit (X)">${TURN_ACTION_ICONS.split}<span>Split Off Unit</span><kbd>X</kbd></button>
      <button class="turn-action-button${turnActionState.active === 'scout' ? ' active' : ''}" data-turn-action="scout"${active ? ' disabled' : ''} title="Send Out Scout (C)">${TURN_ACTION_ICONS.scout}<span>Send Out Scout</span><kbd>C</kbd></button>
      ${active ? `<button class="turn-action-button secondary" data-turn-action="cancel" title="Cancel action (Esc)">${TURN_ACTION_ICONS.cancel}<span>Cancel</span><kbd>Esc</kbd></button>` : ''}
    </div>
    <div class="turn-action-utilities">
      <span>${routeCount ? `${routeCount} saved action${routeCount === 1 ? '' : 's'} for this unit` : 'No saved actions for this unit'}</span>
      ${savedMovementPlansState.routes.some(route => route.routeType === 'unit') ? `<button class="turn-action-utility" data-turn-action="reset-movement">${TURN_ACTION_ICONS.reset}Reset movement</button>` : ''}
      ${splitCount ? `<button class="turn-action-utility" data-turn-action="reset-splits">${TURN_ACTION_ICONS.reset}Reset unit changes</button>` : ''}
    </div>`;
  bar.classList.remove('hidden');

  bar.querySelectorAll('[data-turn-action]').forEach(button => button.addEventListener('click', () => turnActionsHandle(button.dataset.turnAction)));
  for (const id of ['turnActionScoutPeople', 'turnActionScoutHorses', 'turnActionScoutMission']) {
    document.getElementById(id)?.addEventListener('change', turnActionsReadScoutFields);
  }
}

function turnActionsReadScoutFields() {
  savedMovementPlansState.scoutCount = Math.max(1, Number(document.getElementById('turnActionScoutPeople')?.value || 2));
  savedMovementPlansState.scoutHorses = Math.max(0, Number(document.getElementById('turnActionScoutHorses')?.value || 2));
  savedMovementPlansState.scoutMission = String(document.getElementById('turnActionScoutMission')?.value || 'PATROL').toUpperCase();
  turnActionsRender();
}

function turnActionsSetStatus(message) {
  turnActionState.status = String(message || '');
  turnActionsRender();
}

function turnActionsOrigin(unit, type) {
  return savedMovementOriginFor(unit.unitCode, type) || unit.currentHex || null;
}

function turnActionsSetUnknownOrigin(coordinate) {
  const point = parseCoordinate(coordinate);
  if (!point) return false;
  movementPlannerState.active = true;
  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = {
    status: 'ok', origin: point.coordinate, requestedTarget: point.coordinate, actualTarget: point.coordinate,
    targetIsUnknown: true, path: [{ ...point, terrain: 'UNKNOWN', entryMp: 0, cumulativeMp: 0, knownCumulativeMp: 0, unknownCumulativeCount: 0, kind: 'approx' }],
    directions: [], steps: 0, knownMp: 0, unknownEntryCount: 0, totalMp: 0
  };
  return true;
}

async function turnActionsStart(type) {
  const unit = turnActionsUnit();
  if (!unit) return;
  if (type === 'unit' && !savedMovementCanMoveUnit(unit)) {
    turnActionsSetStatus(unit.plannedSplit ? 'This unit was created after its parent moved and must remain Still this turn.' : savedMovementSetStationaryStatus());
    return;
  }
  if (type === 'scout') {
    savedMovementPlansState.scoutCount = Math.max(1, Number(savedMovementPlansState.scoutCount || 2));
    savedMovementPlansState.scoutHorses = Math.max(0, Number(savedMovementPlansState.scoutHorses || 2));
    if (savedMovementPlansState.scoutHorses > savedMovementPlansState.scoutCount) savedMovementPlansState.scoutHorses = savedMovementPlansState.scoutCount;
    const status = savedMovementScoutGroupStatus(unit);
    if (!status || status.count >= 8) {
      turnActionsSetStatus(`Tribe ${status?.tribeCode || savedMovementRootTribe(unit.unitCode)} has used all 8 scout moves this turn.`);
      return;
    }
  }
  savedMovementPlansState.selectedUnitCode = unit.unitCode;
  savedMovementPlansState.routeType = type;
  state.selectedRouteId = null;
  turnActionState.active = type;
  turnActionState.shiftChainStarted = false;
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = null;
  turnActionState.status = `Click a destination${type === 'scout' ? ' to trace the scout route' : ''}. Hold Shift to chain commands.`;
  movementPlannerState.active = true;
  movementPlannerState.shiftHeld = false;
  movementPlannerState.route = null;
  const origin = turnActionsOrigin(unit, type);
  const point = parseCoordinate(origin);
  if (!point) {
    turnActionsCancel();
    turnActionsSetStatus('This unit has no valid planning origin.');
    return;
  }
  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  try { await movementPlannerLoadKnowledge(); } catch (_) {}
  const originRow = movementPlannerState.knownHexes?.get(point.coordinate) || state.hexCache.get(point.coordinate);
  if (type === 'scout' && savedMovementScoutUsesUnitMove() && !MovementPlannerCore.isRevealedLand(originRow)) turnActionsSetUnknownOrigin(point.coordinate);
  turnActionsRender();
  draw();
}

function turnActionsCancel() {
  turnActionState.active = null;
  turnActionState.shiftChainStarted = false;
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = null;
  movementPlannerState.active = false;
  movementPlannerState.origin = null;
  movementPlannerState.route = null;
  movementPlannerState.shiftHeld = false;
  turnActionsRender();
  draw();
}

async function turnActionsCommit() {
  if (!turnActionState.active || turnActionState.active === 'split') return;
  if (turnActionState.pendingOcean) {
    turnActionsSetStatus('Finish the coastal trace by Shift-clicking an adjacent land hex.');
    return;
  }
  const route = movementPlannerState.route;
  if (!route?.status || route.status !== 'ok' || !route.directions?.length) {
    turnActionsSetStatus('Choose a destination before committing the action.');
    return;
  }
  try {
    const saved = await savedMovementSaveCurrentRoute();
    if (!saved) {
      turnActionsSetStatus(turnActionState.active === 'scout' ? 'The scout action could not be saved. Check the scout count, horses, or Tribe limit.' : 'The movement action could not be saved.');
      return;
    }
    const label = turnActionsActiveLabel();
    turnActionsCancel();
    turnActionState.status = `${label} committed for ${savedMovementPlansState.selectedUnitCode}.`;
    turnActionsRender();
  } catch (error) {
    turnActionsSetStatus(error.message || String(error));
  }
}

function turnActionsDirectionBetween(from, to) {
  return MovementPlannerCore.adjacentHexes(from).find(point => point.coordinate === to.coordinate)?.direction || null;
}

function turnActionsOceanPoint(coordinate) {
  const row = state.hexCache.get(coordinate);
  return row && String(row.terrain || '').toUpperCase() === 'O' ? parseCoordinate(coordinate) : null;
}

async function turnActionsHandleScoutTrace(targetCoordinate) {
  if (turnActionState.active !== 'scout' || !movementPlannerState.shiftHeld) return false;
  const target = parseCoordinate(targetCoordinate);
  if (!target) return true;
  const ocean = turnActionsOceanPoint(target.coordinate);
  const route = movementPlannerState.route;
  if (route?.directions?.some(order => /^FO[LR]$/.test(String(order).toUpperCase()))) {
    turnActionsSetStatus('FOL/FOR is the final scouting order. Release Shift to commit or cancel the action.');
    return true;
  }

  if (ocean) {
    const path = route?.path || [];
    const endpoint = path[path.length - 1];
    const previous = path[path.length - 2];
    if (!endpoint || !previous || !route.directions?.length) {
      turnActionsSetStatus('Move the scout onto a land route first, then trace the ocean edge.');
      return true;
    }
    turnActionState.pendingOcean = ocean;
    turnActionState.tracePoint = ocean;
    turnActionState.shiftChainStarted = true;
    turnActionsSetStatus(`Ocean ${ocean.coordinate} selected. Shift-click adjacent land to infer FOL/FOR.`);
    draw();
    return true;
  }

  if (!turnActionState.pendingOcean) return false;
  const adjacent = MovementPlannerCore.adjacentHexes(turnActionState.pendingOcean).some(point => point.coordinate === target.coordinate);
  if (!adjacent || !MovementPlannerCore.isRevealedLand(state.hexCache.get(target.coordinate))) {
    turnActionsSetStatus('After selecting ocean, Shift-click one adjacent revealed land hex.');
    return true;
  }
  const path = route?.path || [];
  const endpoint = path[path.length - 1];
  const previous = path[path.length - 2];
  const heading = previous && directionBetween(previous.coordinate, endpoint.coordinate);
  const order = heading ? ConditionalOrders.orderForFeature(state.hexCache, endpoint, heading, turnActionState.pendingOcean) : null;
  if (!order || !/^FO[LR]$/.test(order)) {
    turnActionsSetStatus('That coastline does not resolve to FOL/FOR from the current heading.');
    return true;
  }
  const preview = ConditionalOrders.preview(state.hexCache, endpoint, heading, order, { maxSteps: 6 });
  movementPlannerState.route = {
    ...route,
    directions: [...route.directions, order],
    destinationHex: endpoint.coordinate,
    actualTarget: endpoint.coordinate,
    conditionalPredictionPaths: preview.predictionPaths || [],
    conditionalOrder: order,
    steps: Number(route.steps || 0) + 1
  };
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = target;
  turnActionState.shiftChainStarted = true;
  turnActionsSetStatus(`${order} inferred. Release Shift to commit, or cancel to discard.`);
  draw();
  return true;
}

const turnActionsOriginalSelectHex = selectHex;
selectHex = async function selectHexWithTurnActions(globalCol, globalRow) {
  if (!turnActionState.active) return turnActionsOriginalSelectHex(globalCol, globalRow);
  const coordinate = coordinateFor(globalCol, globalRow);
  if (coordinate === movementPlannerState.origin?.coordinate) return;
  if (await turnActionsHandleScoutTrace(coordinate)) return;
  await turnActionsOriginalSelectHex(globalCol, globalRow);
  if (!turnActionState.active) return;
  if (movementPlannerState.shiftHeld) {
    turnActionState.shiftChainStarted = true;
    turnActionsRender();
    return;
  }
  await turnActionsCommit();
};

function turnActionsOpenSplit() {
  if (turnActionState.active) return;
  const dialog = document.getElementById('unitSplitDialog');
  if (!dialog) return;
  savedMovementPopulateCreationForm();
  dialog.showModal();
}

async function turnActionsResetMovement() {
  if (!window.confirm('Reset all saved Movement routes for this turn? Scouting routes will be kept.')) return;
  await savedMovementResetAllMovement();
  turnActionsSetStatus('All Movement routes reset.');
}

async function turnActionsResetSplits() {
  if (!window.confirm('Reset all created units for this turn? Their saved routes will also be removed.')) return;
  await savedMovementResetAllUnitChanges();
  turnActionsSetStatus('All created units reset.');
}

async function turnActionsHandle(action) {
  if (action === 'move') return turnActionsStart('unit');
  if (action === 'scout') return turnActionsStart('scout');
  if (action === 'split') return turnActionsOpenSplit();
  if (action === 'cancel') return turnActionsCancel();
  if (action === 'reset-movement') return turnActionsResetMovement();
  if (action === 'reset-splits') return turnActionsResetSplits();
}

function turnActionsSyncSelection() {
  if (turnActionState.active) turnActionsCancel();
  if (state.selectedUnit) savedMovementPlansState.selectedUnitCode = String(state.selectedUnit);
  else savedMovementPlansState.selectedUnitCode = '';
  turnActionsRender();
}

function turnActionsRefresh() {
  turnActionsRender();
}

const turnActionsOriginalDraw = draw;
draw = function drawWithTurnActions() {
  turnActionsOriginalDraw();
  const route = movementPlannerState.route;
  if (!turnActionState.active || !route?.conditionalPredictionPaths?.length) return;
  const style = turnActionState.active === 'scout'
    ? { color:'#78c9e6', width:Math.max(1.2,state.scale*.05), alpha:.3, dashed:true }
    : { color:'#f0b45e', width:Math.max(1.4,state.scale*.06), alpha:.3, dashed:true };
  drawConditionalPredictions(route, style);
  if (turnActionState.tracePoint) {
    drawConditionalMarker(turnActionState.tracePoint, turnActionState.pendingOcean ? 'O' : (route.conditionalOrder || ''), style.color, .9);
  }
};

window.addEventListener('tribenet:unit-selected', turnActionsSyncSelection);
window.addEventListener('keydown', event => {
  if (event.key === 'Shift') return;
  if (event.key === 'Escape' && turnActionState.active) { event.preventDefault(); turnActionsCancel(); return; }
  if (event.repeat || turnActionState.active || !state.selectedUnit || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const key = String(event.key || '').toUpperCase();
  if (key === 'M' && String(turnActionsUnit()?.unitType || '').toLowerCase() !== 'garrison') { event.preventDefault(); turnActionsStart('unit'); }
  if (key === 'X') { event.preventDefault(); turnActionsOpenSplit(); }
  if (key === 'C') { event.preventDefault(); turnActionsStart('scout'); }
});
window.addEventListener('keyup', async event => {
  if (event.key !== 'Shift') return;
  if (turnActionState.active && turnActionState.shiftChainStarted) await turnActionsCommit();
});
window.addEventListener('blur', () => { movementPlannerState.shiftHeld = false; });

document.getElementById('movementPlannerCreateParent')?.addEventListener('change', savedMovementLoadCreationSkills);
document.getElementById('movementPlannerCreateType')?.addEventListener('change', async () => {
  const parent = document.getElementById('movementPlannerCreateParent')?.value || '0000';
  const code = document.getElementById('movementPlannerCreateCode');
  if (code) code.value = document.getElementById('movementPlannerCreateType')?.value === 'Tribe' ? '1485' : `${parent}e1`;
  await savedMovementLoadCreationSkills();
});
document.getElementById('movementPlannerCreateSubmit')?.addEventListener('click', savedMovementCreateUnit);

turnActionsRender();

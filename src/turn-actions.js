/* Selected-unit turn actions. Each action owns its setup, route and commit. */
const turnActionState = {
  active: null,
  shiftChainStarted: false,
  pendingOcean: null,
  tracePoint: null,
  status: '',
  hover: null,
  hoverRequest: 0,
  suppressContextMenuUntil: 0,
  pendingMapClick: null,
  editingRouteId: null,
  followOceanMode: false
};

function turnActionsImageIcon(filename, alt) {
  return `<img class="turn-action-icon" src="action-icons/${filename}" alt="${alt || ''}" aria-hidden="true" width="32" height="32" loading="lazy" decoding="async">`;
}

const TURN_ACTION_ICONS = {
  move: turnActionsImageIcon('move.svg', 'Move'),
  split: turnActionsImageIcon('split.svg', 'Split'),
  scout: turnActionsImageIcon('scout.svg', 'Scout'),
  followOcean: turnActionsImageIcon('follow-ocean.svg', 'Follow Ocean'),
  cancel: turnActionsImageIcon('cancel.svg', 'Cancel'),
  reset: turnActionsImageIcon('reset.svg', 'Reset'),
  edit: turnActionsImageIcon('edit.svg', 'Edit'),
  remove: turnActionsImageIcon('remove-route.svg', 'Remove'),
  routes: turnActionsImageIcon('routes.svg', 'Routes')
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
  const allowance = turnActionsUnitMovement(turnActionsUnit()).allowance;
  const commands = (route.directions || []).join(' → ');
  const cost = unknown ? `${known} + ?×${unknown}/${allowance} MP · bad weather ${weather}+?` : `${known}/${allowance} MP · bad weather ${weather} MP`;
  return `${cost}${commands ? ` · ${commands}` : ''}`;
}

function turnActionsUnitMovement(unit) {
  return MovementPlannerCore.unitMovementProfile(unit);
}

function turnActionsScoutAllowance() {
  const scouts = Math.max(1, Number(savedMovementPlansState.scoutCount || 1));
  const horses = Math.max(0, Number(savedMovementPlansState.scoutHorses || 0));
  return horses >= scouts ? 15 : 8;
}

function turnActionsMovementRisk(route, allowance) {
  const knownMp = Number(route?.knownMp ?? route?.totalMp);
  if (!Number.isFinite(knownMp) || knownMp > allowance) return 'over';
  const weatherMp = Number(route?.badWeatherMp ?? knownMp);
  if (Number(route?.unknownEntryCount || 0) > 0 || weatherMp > allowance) return 'warn';
  return 'safe';
}

function turnActionsRender() {
  const bar = document.getElementById('turnActionBar');
  if (!bar) return;
  turnActionsRenderLegend();
  const unit = turnActionsUnit();
  if (!turnActionsPlanningAvailable() || !unit) {
    bar.classList.add('hidden');
    return;
  }

  const stationary = savedMovementIsStationaryUnit(unit);
  const canMove = savedMovementCanMoveUnit(unit);
  const routeCount = savedMovementPlansState.routes.filter(route => String(route.unitCode).toLowerCase() === String(unit.unitCode).toLowerCase()).length;
  const splitCount = (savedMovementPlansState.unitSplits || []).length;
  const unitMove = savedMovementUnitMove(unit.unitCode);
  const unitScoutRoutes = savedMovementPlansState.routes.filter(route => route.routeType === 'scout' && String(route.unitCode).toLowerCase() === String(unit.unitCode).toLowerCase());
  const selectedRoute = state.selectedRouteId == null ? null : savedMovementPlansState.routes.find(route => savedMovementRouteKey(route) === String(state.selectedRouteId));
  const selectedScout = selectedRoute?.routeType === 'scout' ? selectedRoute : null;
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
      ${!stationary ? `<button class="turn-action-button${turnActionState.active === 'unit' ? ' active' : ''}" data-turn-action="move"${!canMove && !active ? ' disabled' : ''} aria-label="Move Unit" title="Move Unit · M">${TURN_ACTION_ICONS.move}</button>` : ''}
      <button class="turn-action-button${turnActionState.active === 'split' ? ' active' : ''}" data-turn-action="split"${active ? ' disabled' : ''} aria-label="Split Off Unit" title="Split Off Unit · X">${TURN_ACTION_ICONS.split}</button>
      <button class="turn-action-button${turnActionState.active === 'scout' ? ' active' : ''}" data-turn-action="scout"${active ? ' disabled' : ''} aria-label="Send Out Scout" title="Send Out Scout · C">${TURN_ACTION_ICONS.scout}</button>
      ${turnActionState.active === 'scout' ? `<button class="turn-action-button route-action${turnActionState.followOceanMode ? ' active' : ''}" data-turn-action="follow-ocean" aria-label="Follow Ocean" title="Follow Ocean · F">${TURN_ACTION_ICONS.followOcean}</button>` : ''}
      ${unitScoutRoutes.length ? `<button class="turn-action-button route-action" data-turn-action="open-scouts" aria-label="View scouting routes" title="View scouting routes · V">${TURN_ACTION_ICONS.routes}</button>` : ''}
      ${active ? `<button class="turn-action-button secondary" data-turn-action="cancel" aria-label="Cancel action" title="Cancel action · Esc">${TURN_ACTION_ICONS.cancel}</button>` : ''}
      ${selectedScout && !active ? `<span class="turn-action-route-selection">Scout S${selectedScout.scoutNumber} selected</span><button class="turn-action-button route-action" data-turn-action="edit-scout" aria-label="Edit scouting" title="Edit scouting · C">${TURN_ACTION_ICONS.edit}</button><button class="turn-action-button secondary route-action" data-turn-action="cancel-scout" aria-label="Cancel scouting" title="Cancel scouting">${TURN_ACTION_ICONS.remove}</button>` : ''}
    </div>
    <div class="turn-action-utilities">
      <span>${routeCount ? `${routeCount} saved action${routeCount === 1 ? '' : 's'} for this unit` : 'No saved actions for this unit'}</span>
      ${unitMove ? `<button class="turn-action-utility" data-turn-action="reset-movement" aria-label="Cancel movement" title="Cancel movement for ${turnActionsEscape(unit.unitCode)}">${TURN_ACTION_ICONS.cancel}</button>` : ''}
      ${unitScoutRoutes.length ? `<button class="turn-action-utility" data-turn-action="reset-scouting" aria-label="Reset scouting" title="Reset scouting for ${turnActionsEscape(unit.unitCode)}">${TURN_ACTION_ICONS.reset}</button>` : ''}
      ${splitCount ? `<button class="turn-action-utility" data-turn-action="reset-splits" title="Reset unit changes">${TURN_ACTION_ICONS.reset}</button>` : ''}
    </div>`;
  bar.classList.remove('hidden');

  bar.querySelectorAll('[data-turn-action]').forEach(button => button.addEventListener('click', () => turnActionsHandle(button.dataset.turnAction)));
  turnActionsBindTooltips(bar);
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

function turnActionsRenderLegend() {
  const legend = document.getElementById('turnActionRouteLegend');
  if (!legend) return;
  const hasRoutes = Boolean(savedMovementPlansState?.routes?.length) || Boolean(turnActionState.active);
  legend.classList.toggle('hidden', state.mode !== 'detail' || !state.planningVisible || !hasRoutes);
}

function turnActionsHoverCard() {
  return document.getElementById('turnActionHoverCard');
}

function turnActionsTooltip() {
  return document.getElementById('turnActionTooltip');
}

function turnActionsBindTooltips(root) {
  root?.querySelectorAll('[title]').forEach(button => {
    if (button.dataset.tooltipBound) return;
    button.dataset.tooltipBound = '1';
    button.addEventListener('pointerenter', event => {
      const tooltip = turnActionsTooltip();
      const text = button.getAttribute('title');
      if (!tooltip || !text) return;
      tooltip.textContent = text;
      tooltip.classList.remove('hidden');
      const rect = button.getBoundingClientRect();
      const margin = 7;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltip.offsetWidth / 2, window.innerWidth - tooltip.offsetWidth - 8));
      const above = rect.top - tooltip.offsetHeight - margin;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${above >= 8 ? above : rect.bottom + margin}px`;
    });
    button.addEventListener('pointerleave', () => turnActionsHideTooltip());
    button.addEventListener('focus', () => button.dispatchEvent(new PointerEvent('pointerenter')));
    button.addEventListener('blur', () => turnActionsHideTooltip());
  });
}

function turnActionsHideTooltip() {
  const tooltip = turnActionsTooltip();
  if (tooltip) tooltip.classList.add('hidden');
}

function turnActionsHideHover() {
  turnActionState.hover = null;
  turnActionState.hoverRequest += 1;
  const card = turnActionsHoverCard();
  if (card) card.classList.add('hidden');
}

function turnActionsPositionHoverCard(clientX, clientY) {
  const card = turnActionsHoverCard();
  const wrap = document.getElementById('canvasWrap');
  if (!card || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const gap = 14;
  const left = Math.max(8, Math.min(clientX - rect.left + gap, rect.width - card.offsetWidth - 8));
  let top = Math.max(8, Math.min(clientY - rect.top + gap, rect.height - card.offsetHeight - 8));
  const bar = document.getElementById('turnActionBar');
  if (bar && !bar.classList.contains('hidden')) {
    const barRect = bar.getBoundingClientRect();
    const barTop = barRect.top - rect.top - 8;
    if (top + card.offsetHeight > barTop) {
      const above = clientY - rect.top - card.offsetHeight - gap;
      if (above >= 8) top = above;
    }
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function turnActionsHoverPoint(event) {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas || state.mode !== 'detail') return null;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const base = baseFromScreen(x, y);
  const point = typeof IsoMapper !== 'undefined' && IsoMapper.enabled
    ? IsoMapper.pick(x, y) || nearestHex(base.x, base.y)
    : nearestHex(base.x, base.y);
  if (!point) return null;
  // Keep the cost card anchored to the centre of the hex. Pointer-level
  // positioning makes it jitter whenever Shift tracing causes a small mouse
  // correction inside the same hex.
  const centre = screenFromBase(baseCenter(point.globalCol, point.globalRow));
  return {
    point,
    clientX: rect.left + centre.x,
    clientY: rect.top + centre.y
  };
}

function turnActionsHoverAppendPreview(route, target, known) {
  return movementPlannerFindAppendedRoute(route, target.coordinate, known);
}

function turnActionsHoverAllowanceText(knownMp) {
  return MovementPlannerCore.MOVEMENT_ALLOWANCES
    .filter(row => row.key === 'foot' || row.key === 'mounted')
    .map(row => `${row.label.replace(' movement', '')} ${row.mp - knownMp >= 0 ? `${row.mp - knownMp} left` : `${knownMp - row.mp} over`}`)
    .join(' · ');
}

function turnActionsRenderHover(route, target, clientX, clientY) {
  const card = turnActionsHoverCard();
  if (!card) return;
  const coordinate = turnActionsEscape(target.coordinate);
  card.className = 'turn-action-hover-card';
  if (!route || route.status !== 'ok') {
    const message = route?.status === 'not-adjacent'
      ? 'The current endpoint is unrevealed; extend it one adjacent hex at a time.'
      : route?.status === 'target-impassable'
        ? `${target.coordinate} is ${route.targetTerrain || 'not enterable'}.`
        : route?.status === 'conditional-terminal'
          ? 'FOL/FOR is the final scouting order.'
        : route?.status === 'no-revealed-adjacent'
          ? 'No revealed land route reaches this fog tile.'
          : 'No route through revealed land reaches this tile.';
    card.classList.add('error');
    card.innerHTML = `<strong>${coordinate}</strong><span>${turnActionsEscape(message)}</span>`;
    card.classList.remove('hidden');
    turnActionsPositionHoverCard(clientX, clientY);
    return;
  }
  const knownMp = Number(route.knownMp ?? route.totalMp ?? 0);
  const weatherMp = Number(route.badWeatherMp ?? knownMp);
  const unknown = Number(route.unknownEntryCount || 0);
  const commands = (route.directions || []).join(' → ') || 'No movement';
  const normal = unknown ? `${knownMp} known + ?×${unknown}` : `${knownMp} MP`;
  const weather = unknown ? `${weatherMp} known + ?×${unknown}` : `${weatherMp} MP`;
  const profile = turnActionsUnitMovement(turnActionsUnit());
  const risk = turnActionsMovementRisk(route, profile.allowance);
  const unitMovement = `${profile.allowance} MP · ${profile.mounted ? 'Mounted' : 'Foot'}`;
  const composition = profile.people > 0 ? ` · ${profile.horses}/${profile.people} horses` : '';
  card.classList.add(risk);
  card.innerHTML = `<strong>${coordinate}</strong><span>Unit total: ${unitMovement}${composition}</span><span>Normal: ${normal} · Bad weather: ${weather}</span><span>${turnActionsEscape(commands)}</span><small>${risk === 'safe' ? 'Good in bad weather' : risk === 'warn' ? 'Normal route fits; bad weather or fog is a risk' : 'Too far for this unit'}${unknown ? ' · fog cost unresolved' : ''}</small>`;
  card.classList.remove('hidden');
  turnActionsPositionHoverCard(clientX, clientY);
}

async function turnActionsPreviewHover(event) {
  if (!['unit', 'scout'].includes(turnActionState.active) || !movementPlannerState.active || state.dragging) return;
  const hover = turnActionsHoverPoint(event);
  if (!hover) { turnActionsHideHover(); return; }
  const target = parseCoordinate(coordinateFor(hover.point.globalCol, hover.point.globalRow));
  if (!target) return;
  const hoverKey = `${target.coordinate}:${movementPlannerState.shiftHeld ? 'chain' : 'route'}`;
  if (turnActionState.hover?.key === hoverKey) {
    return;
  }
  const request = ++turnActionState.hoverRequest;
  turnActionState.hover = { ...hover, target, route: null, key: hoverKey };
  const card = turnActionsHoverCard();
  if (card) {
    card.className = 'turn-action-hover-card';
    card.innerHTML = `<strong>${turnActionsEscape(target.coordinate)}</strong><span>Calculating route…</span>`;
    card.classList.remove('hidden');
    turnActionsPositionHoverCard(hover.clientX, hover.clientY);
  }
  try {
    const known = await movementPlannerLoadKnowledge();
    if (request !== turnActionState.hoverRequest || !['unit', 'scout'].includes(turnActionState.active)) return;
    const route = movementPlannerState.shiftHeld && movementPlannerState.route?.status === 'ok'
      ? turnActionsHoverAppendPreview(movementPlannerState.route, target, known)
      : movementPlannerPrepareRoute(MovementPlannerCore.findFastestRoute(known, movementPlannerState.origin.coordinate, target.coordinate));
    turnActionState.hover.route = route;
    turnActionsRenderHover(route, target, hover.clientX, hover.clientY);
    draw();
  } catch (_) {
    if (request !== turnActionState.hoverRequest) return;
    turnActionsRenderHover({ status: 'error' }, target, hover.clientX, hover.clientY);
  }
}

function turnActionsRefreshHover() {
  const hover = turnActionState.hover;
  if (!hover?.target || !Number.isFinite(hover.clientX) || !Number.isFinite(hover.clientY)) return;
  turnActionsPreviewHover({ clientX: hover.clientX, clientY: hover.clientY });
}

function turnActionsBindHover() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.addEventListener('mousemove', turnActionsPreviewHover);
  canvas.addEventListener('mouseleave', turnActionsHideHover);
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

async function turnActionsStart(type, options = {}) {
  const unit = turnActionsUnit();
  if (!unit) return;
  turnActionsHideHover();
  if (type === 'unit' && !savedMovementCanMoveUnit(unit)) {
    turnActionsSetStatus(unit.plannedSplit ? 'This unit was created after its parent moved and must remain Still this turn.' : savedMovementSetStationaryStatus());
    return;
  }
  if (type === 'scout') {
    const editingRoute = options.route?.routeType === 'scout' ? options.route : null;
    if (editingRoute) {
      savedMovementPlansState.scoutCount = Math.max(1, Number(editingRoute.noOfScouts || savedMovementPlansState.scoutCount || 2));
      savedMovementPlansState.scoutHorses = Math.max(0, Number(editingRoute.noOfHorses || savedMovementPlansState.scoutHorses || 2));
      savedMovementPlansState.scoutMission = String(editingRoute.mission || savedMovementPlansState.scoutMission || 'PATROL').toUpperCase();
    }
    savedMovementPlansState.scoutCount = Math.max(1, Number(savedMovementPlansState.scoutCount || 2));
    savedMovementPlansState.scoutHorses = Math.max(0, Number(savedMovementPlansState.scoutHorses || 2));
    if (savedMovementPlansState.scoutHorses > savedMovementPlansState.scoutCount) savedMovementPlansState.scoutHorses = savedMovementPlansState.scoutCount;
    const status = savedMovementScoutGroupStatus(unit);
    if (!status || (status.count >= 8 && !editingRoute)) {
      turnActionsSetStatus(`Tribe ${status?.tribeCode || savedMovementRootTribe(unit.unitCode)} has used all 8 scout moves this turn.`);
      return;
    }
  }
  savedMovementPlansState.selectedUnitCode = unit.unitCode;
  savedMovementPlansState.routeType = type;
  state.selectedRouteId = null;
  turnActionState.active = type;
  turnActionState.editingRouteId = type === 'scout' && options.route?.id != null ? Number(options.route.id) : null;
  turnActionState.shiftChainStarted = false;
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = null;
  turnActionState.followOceanMode = Boolean(options.followOcean);
  turnActionState.status = `Click a destination${type === 'scout' ? ' to trace the scout route' : ''}. Hold Shift to chain commands.`;
  if (turnActionState.followOceanMode) turnActionState.status = 'Follow Ocean armed · select an adjacent ocean hex, then a land or unexplored hex for direction.';
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
  if (type === 'scout' && options.followOcean && !movementPlannerState.route) {
    movementPlannerState.route = {
      status: 'ok', origin: point.coordinate, requestedTarget: point.coordinate, actualTarget: point.coordinate,
      path: [{ ...point, terrain: originRow?.terrain || 'UNKNOWN', entryMp: 0, cumulativeMp: 0, knownCumulativeMp: 0, unknownCumulativeCount: 0, kind: 'exact' }],
      directions: [], steps: 0, knownMp: 0, badWeatherMp: 0, unknownEntryCount: 0, totalMp: 0
    };
  }
  turnActionsRender();
  draw();
}

function turnActionsCancel() {
  turnActionsHideHover();
  turnActionState.active = null;
  turnActionState.shiftChainStarted = false;
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = null;
  turnActionState.editingRouteId = null;
  turnActionState.followOceanMode = false;
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
    turnActionsSetStatus('Finish the coastal trace by selecting an adjacent land or unexplored hex.');
    return;
  }
  const route = movementPlannerState.route;
  if (!route?.status || route.status !== 'ok' || !route.directions?.length) {
    turnActionsSetStatus('Choose a destination before committing the action.');
    return;
  }
  const selectedUnitCode = state.selectedUnit;
  const selectedUnitHex = state.selectedUnitHex;
  try {
    const saved = await savedMovementSaveCurrentRoute();
    if (!saved) {
      turnActionsSetStatus(turnActionState.active === 'scout' ? 'The scout action could not be saved. Check the scout count, horses, or Tribe limit.' : 'The movement action could not be saved.');
      return;
    }
    const label = turnActionsActiveLabel();
    const wasEditing = turnActionState.editingRouteId != null;
    const clearedScoutRoutes = Number(saved.clearedScoutRoutes || 0);
    turnActionsCancel();
    if (selectedUnitCode) {
      state.selectedUnit = selectedUnitCode;
      state.selectedUnitHex = selectedUnitHex || state.selectedUnitHex;
      savedMovementPlansState.selectedUnitCode = String(selectedUnitCode);
    }
    turnActionState.status = `${wasEditing ? `${label} updated` : `${label} committed`} for ${savedMovementPlansState.selectedUnitCode}.${clearedScoutRoutes ? ` ${clearedScoutRoutes} scouting route${clearedScoutRoutes === 1 ? '' : 's'} cleared because the destination changed.` : ''}`;
    turnActionsRender();
  } catch (error) {
    turnActionsSetStatus(error.message || String(error));
  }
}

function turnActionsDirectionBetween(from, to) {
  return MovementPlannerCore.adjacentHexes(from).find(point => point.coordinate === to.coordinate)?.direction || null;
}

function turnActionsOceanPoint(coordinate) {
  const row = state.hexCache?.get?.(coordinate) || movementPlannerState.knownHexes?.get?.(coordinate);
  const terrain = String(row?.terrain ?? row?.terrainCode ?? '').trim().toUpperCase();
  return ['O', 'OCEAN'].includes(terrain) ? parseCoordinate(coordinate) : null;
}

async function turnActionsApplyFollowOcean(ocean, target) {
  const route = movementPlannerState.route;
  const path = route?.path || [];
  const endpoint = path[path.length - 1];
  const heading = endpoint && target ? directionBetween(endpoint.coordinate, target.coordinate) : null;
  const order = heading && typeof ConditionalOrders !== 'undefined'
    ? ConditionalOrders.orderForFeature(state.hexCache, endpoint, heading, ocean)
    : null;
  if (!order || !/^FO[LR]$/.test(order)) {
    turnActionsSetStatus('That ocean edge does not resolve to FOL/FOR from the current heading.');
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
  const commitFollowOcean = turnActionState.followOceanMode && !movementPlannerState.shiftHeld;
  turnActionState.followOceanMode = false;
  turnActionsSetStatus(`${order} inferred. ${commitFollowOcean ? 'Saving…' : 'Release Shift to commit, or cancel to discard.'}`);
  draw();
  if (commitFollowOcean) await turnActionsCommit();
  return true;
}

async function turnActionsHandleScoutTrace(targetCoordinate) {
  if (turnActionState.active !== 'scout' || (!movementPlannerState.shiftHeld && !turnActionState.followOceanMode && !turnActionState.pendingOcean)) return false;
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
    if (!endpoint || !route) {
      turnActionsSetStatus('Start scouting before selecting a coastline.');
      return true;
    }
    const adjacentToEndpoint = MovementPlannerCore.adjacentHexes(endpoint).some(point => point.coordinate === ocean.coordinate);
    if (!adjacentToEndpoint) {
      turnActionsSetStatus('Select an ocean hex adjacent to the scout route endpoint.');
      return true;
    }
    turnActionState.pendingOcean = ocean;
    turnActionState.tracePoint = ocean;
    turnActionState.shiftChainStarted = true;
    turnActionsSetStatus(`Ocean ${ocean.coordinate} selected. Now select the land or unexplored hex to set the direction.`);
    draw();
    return true;
  }

  if (!turnActionState.pendingOcean) return false;
  const targetRow = state.hexCache?.get?.(target.coordinate) || movementPlannerState.knownHexes?.get?.(target.coordinate);
  const targetTerrain = String(targetRow?.terrain ?? targetRow?.terrainCode ?? '').trim().toUpperCase();
  const targetIsUnexplored = !targetRow || ['UNKNOWN', '?', 'UNEXPLORED'].includes(targetTerrain)
    || ['ATTEMPTED', 'PARTIAL', 'FOG', 'UNEXPLORED', 'UNKNOWN'].includes(String(targetRow?.knowledgeLevel ?? targetRow?.knowledge ?? '').trim().toUpperCase());
  const adjacentToOcean = MovementPlannerCore.adjacentHexes(turnActionState.pendingOcean).some(point => point.coordinate === target.coordinate);
  const landOrUnexplored = targetIsUnexplored || MovementPlannerCore.isRevealedLand(targetRow);
  const endpoint = (route?.path || [])[route?.path?.length - 1];
  const heading = endpoint ? directionBetween(endpoint.coordinate, target.coordinate) : null;
  if (!adjacentToOcean || !landOrUnexplored || !heading) {
    turnActionsSetStatus('After selecting ocean, select an adjacent land or unexplored hex in the direction you want to follow.');
    return true;
  }
  return turnActionsApplyFollowOcean(turnActionState.pendingOcean, target);
}

const turnActionsOriginalSelectHex = selectHex;
selectHex = async function selectHexWithTurnActions(globalCol, globalRow) {
  if (!turnActionState.active) return turnActionsOriginalSelectHex(globalCol, globalRow);
  // Map selection is asynchronous because route calculation may need to load
  // the current turn's terrain knowledge. Keep the promise visible so a quick
  // Shift release cannot commit the previous route before this click has been
  // appended to it.
  const clickWork = (async () => {
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
  })();
  turnActionState.pendingMapClick = clickWork;
  try {
    await clickWork;
  } finally {
    if (turnActionState.pendingMapClick === clickWork) turnActionState.pendingMapClick = null;
  }
};

function turnActionsOpenSplit() {
  if (turnActionState.active) return;
  const dialog = document.getElementById('unitSplitDialog');
  if (!dialog) return;
  savedMovementPopulateCreationForm();
  dialog.showModal();
}

async function turnActionsResetMovement() {
  const unit = turnActionsUnit();
  if (!unit) return;
  const removed = await savedMovementResetMovementForUnit(unit.unitCode);
  turnActionsSetStatus(`Movement cancelled for ${unit.unitCode}.${removed.scouting ? ` ${removed.scouting} scouting route${removed.scouting === 1 ? '' : 's'} also cancelled.` : ''}`);
}

async function turnActionsResetScouting() {
  const unit = turnActionsUnit();
  if (!unit) return;
  const removed = await savedMovementResetScoutingForUnit(unit.unitCode);
  turnActionsSetStatus(`${removed ? `${removed} scouting route${removed === 1 ? '' : 's'}` : 'No scouting routes'} cancelled for ${unit.unitCode}.`);
}

function turnActionsSelectedScout() {
  if (state.selectedRouteId == null) return null;
  const route = savedMovementPlansState.routes.find(item => savedMovementRouteKey(item) === String(state.selectedRouteId));
  return route?.routeType === 'scout' ? route : null;
}

async function turnActionsEditSelectedScout() {
  const route = turnActionsSelectedScout();
  if (route) await turnActionsStart('scout', { route });
}

async function turnActionsCancelSelectedScout() {
  const route = turnActionsSelectedScout();
  if (!route?.id) return;
  const routeId = route.id;
  state.selectedRouteId = null;
  savedMovementPlansState.routes = savedMovementPlansState.routes.filter(item => Number(item.id) !== Number(routeId));
  turnActionsHideHover();
  draw();
  const removed = await window.tribenet.removePlannedRoute(routeId);
  await savedMovementRefresh();
  turnActionsSetStatus(removed ? `Scouting S${route.scoutNumber} cancelled for ${route.unitCode}.` : 'The scouting route was already removed.');
}

function turnActionsArmFollowOcean() {
  if (turnActionState.active !== 'scout') return turnActionsStart('scout', { followOcean: true });
  const route = movementPlannerState.route;
  if (!route?.path?.length) {
    const origin = movementPlannerState.origin;
    if (!origin) {
      turnActionsSetStatus('Start scouting before starting Follow Ocean.');
      return;
    }
    movementPlannerState.route = {
      status: 'ok', origin: origin.coordinate, requestedTarget: origin.coordinate, actualTarget: origin.coordinate,
      path: [{ ...origin, terrain: state.hexCache?.get?.(origin.coordinate)?.terrain || 'UNKNOWN', entryMp: 0, cumulativeMp: 0, knownCumulativeMp: 0, unknownCumulativeCount: 0, kind: 'exact' }],
      directions: [], steps: 0, knownMp: 0, badWeatherMp: 0, unknownEntryCount: 0, totalMp: 0
    };
  }
  if (movementPlannerState.route.directions?.some(order => /^FO[LR]$/i.test(String(order)))) {
    turnActionsSetStatus('Follow Ocean is already the final order on this route.');
    return;
  }
  turnActionState.followOceanMode = true;
  turnActionState.pendingOcean = null;
  turnActionState.tracePoint = null;
  turnActionsSetStatus('Follow Ocean armed · select an adjacent ocean hex, then a land or unexplored hex for direction.');
  draw();
}

function turnActionsScoutRouteSummary(route) {
  const start = route.originHex || route.startHex || route.path?.[0]?.coordinate || '—';
  const end = route.destinationHex || route.path?.[route.path.length - 1]?.coordinate || '—';
  const commands = (route.directions || []).join(' → ') || 'No commands';
  const mission = route.mission ? ` · ${route.mission}` : '';
  return `${start} → ${end}${mission} · ${commands}`;
}

function turnActionsCloseScoutRoutes() {
  document.getElementById('scoutRoutesDialog')?.close();
}

function turnActionsBindDialogDrag(dialog) {
  const handle = dialog?.querySelector('[data-drag-handle="scout-routes"]');
  if (!dialog || !handle || handle.dataset.dragBound) return;
  handle.dataset.dragBound = '1';
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = dialog.getBoundingClientRect();
    drag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!drag) return;
    const maxLeft = Math.max(8, window.innerWidth - dialog.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - dialog.offsetHeight - 8);
    const left = Math.max(8, Math.min(maxLeft, drag.left + event.clientX - drag.startX));
    const top = Math.max(8, Math.min(maxTop, drag.top + event.clientY - drag.startY));
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  });
  const stopDrag = event => {
    if (!drag) return;
    drag = null;
    handle.releasePointerCapture?.(event.pointerId);
  };
  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
}

function turnActionsOpenScoutRoutes() {
  const unit = turnActionsUnit();
  const dialog = document.getElementById('scoutRoutesDialog');
  const list = document.getElementById('turnActionScoutRoutesList');
  if (!unit || !dialog || !list) return;
  const routes = savedMovementPlansState.routes.filter(route => route.routeType === 'scout'
    && String(route.unitCode).toLowerCase() === String(unit.unitCode).toLowerCase());
  if (!routes.length) {
    list.innerHTML = '<p class="turn-action-dialog-empty">No scouting routes saved for this unit.</p>';
    state.selectedRouteId = null;
    turnActionsHideHover();
    draw();
    turnActionsSetStatus(`No scouting routes saved for ${unit.unitCode}.`);
    return;
  }
  const previousSelection = state.selectedRouteId;
  list.innerHTML = routes.map(route => {
    const key = savedMovementRouteKey(route);
    return `<div class="turn-action-route-row" data-scout-route-id="${turnActionsEscape(key)}">
      <button type="button" class="turn-action-route-main" data-route-select="${turnActionsEscape(key)}">
        <strong>R${savedMovementVisibleRouteNumber(route)} · Scout S${turnActionsEscape(route.scoutNumber || '?')}</strong>
        <span>${turnActionsEscape(turnActionsScoutRouteSummary(route))}</span>
      </button>
      <div class="turn-action-route-actions">
        <button type="button" class="turn-action-button route-action" data-route-edit="${turnActionsEscape(key)}" aria-label="Edit scouting route" title="Edit scouting · C">${TURN_ACTION_ICONS.edit}</button>
        <button type="button" class="turn-action-button secondary route-action" data-route-cancel="${turnActionsEscape(key)}" aria-label="Cancel scouting route" title="Cancel scouting">${TURN_ACTION_ICONS.remove}</button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-scout-route-id]').forEach(row => {
    const key = row.dataset.scoutRouteId;
    row.addEventListener('mouseenter', () => {
      savedMovementSelectSavedRoute(key);
      row.classList.add('selected');
    });
    row.addEventListener('mouseleave', () => {
      if (row.dataset.pinned !== '1') {
        if (previousSelection == null) state.selectedRouteId = null;
        else savedMovementSelectSavedRoute(previousSelection);
        row.classList.remove('selected');
        draw();
      }
    });
    row.querySelector('[data-route-select]')?.addEventListener('click', () => {
      row.dataset.pinned = '1';
      savedMovementSelectSavedRoute(key);
    });
    row.querySelector('[data-route-edit]')?.addEventListener('click', async event => {
      event.stopPropagation();
      row.dataset.pinned = '1';
      savedMovementSelectSavedRoute(key);
      await turnActionsEditSelectedScout();
    });
    row.querySelector('[data-route-cancel]')?.addEventListener('click', async event => {
      event.stopPropagation();
      row.dataset.pinned = '1';
      savedMovementSelectSavedRoute(key);
      await turnActionsCancelSelectedScout();
      // Keep the non-modal route picker open and refresh its options so more
      // than one scouting order can be reviewed or cancelled in one pass.
      if (dialog.open) turnActionsOpenScoutRoutes();
    });
  });
  turnActionsBindTooltips(list);
  turnActionsBindDialogDrag(dialog);
  if (!dialog.open) dialog.show();
  if (!dialog.dataset.positioned) {
    const rect = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(16, (window.innerWidth - rect.width) / 2)}px`;
    dialog.style.top = `${Math.max(16, (window.innerHeight - rect.height) / 2)}px`;
    dialog.dataset.positioned = '1';
  }
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
  if (action === 'edit-scout') return turnActionsEditSelectedScout();
  if (action === 'cancel-scout') return turnActionsCancelSelectedScout();
  if (action === 'follow-ocean') return turnActionsArmFollowOcean();
  if (action === 'open-scouts') return turnActionsOpenScoutRoutes();
  if (action === 'reset-movement') return turnActionsResetMovement();
  if (action === 'reset-scouting') return turnActionsResetScouting();
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
  if (turnActionState.active && route?.status === 'ok' && route.path?.length > 1) {
    const scout = turnActionState.active === 'scout';
    drawRoute(route.path, {
      color: scout ? '#78c9e6' : '#8dd7a1',
      certainColor: scout ? '#78c9e6' : '#8dd7a1',
      maybeColor: '#e4bb65',
      badWeatherAllowance: scout ? turnActionsScoutAllowance() : turnActionsUnitMovement(turnActionsUnit()).allowance,
      width: Math.max(2.5, state.scale * .11),
      alpha: .98,
      dashed: scout
    });
  }
  const hoverRoute = ['unit', 'scout'].includes(turnActionState.active) ? turnActionState.hover?.route : null;
  if (hoverRoute?.status === 'ok' && hoverRoute.path?.length > 1) {
    const committedLength = movementPlannerState.route?.path?.length || 1;
    const previewPath = movementPlannerState.shiftHeld && movementPlannerState.route?.status === 'ok'
      ? hoverRoute.path.slice(Math.max(0, committedLength - 1))
      : hoverRoute.path;
    drawRoute(previewPath, {
      color: '#ffe08a',
      certainColor: '#ffe08a',
      maybeColor: '#e4bb65',
      width: Math.max(2.2, state.scale * .095),
      alpha: .92,
      dashed: true
    });
    const endpoint = hoverRoute.path[hoverRoute.path.length - 1];
    if (endpoint) movementPlannerDrawRing(endpoint, endpoint.terrain === 'UNKNOWN' ? '#9ec9db' : '#ffe08a', endpoint.terrain === 'UNKNOWN', .72);
  }
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
function turnActionsCancelRightClick(event) {
  const isContextMenu = event.type === 'contextmenu';
  const isRightButton = isContextMenu || event.button === 2;
  if (!isRightButton) return;

  const suppressContextMenu = turnActionState.suppressContextMenuUntil > Date.now();
  if (!turnActionState.active && !suppressContextMenu) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (!isContextMenu) {
    turnActionState.suppressContextMenuUntil = Date.now() + 1000;
    if (turnActionState.active) turnActionsCancel();
  } else {
    turnActionState.suppressContextMenuUntil = 0;
  }
}
window.addEventListener('mousedown', turnActionsCancelRightClick, true);
window.addEventListener('mouseup', turnActionsCancelRightClick, true);
window.addEventListener('contextmenu', turnActionsCancelRightClick, true);
window.addEventListener('keydown', event => {
  if (event.key === 'Shift') { setTimeout(turnActionsRefreshHover, 0); return; }
  if (event.key === 'Escape' && turnActionState.active) { event.preventDefault(); turnActionsCancel(); return; }
  const key = String(event.key || '').toUpperCase();
  if (key === 'F' && turnActionState.active === 'scout' && !event.repeat) { event.preventDefault(); turnActionsArmFollowOcean(); return; }
  if (event.repeat || turnActionState.active || !state.selectedUnit || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (key === 'M' && savedMovementCanMoveUnit(turnActionsUnit())) { event.preventDefault(); turnActionsStart('unit'); }
  if (key === 'X') { event.preventDefault(); turnActionsOpenSplit(); }
  if (key === 'C') { event.preventDefault(); const selectedScout = turnActionsSelectedScout(); selectedScout ? turnActionsEditSelectedScout() : turnActionsStart('scout'); }
  if (key === 'F') { event.preventDefault(); turnActionsArmFollowOcean(); }
  if (key === 'V' && savedMovementPlansState.routes.some(route => route.routeType === 'scout' && String(route.unitCode).toLowerCase() === String(state.selectedUnit).toLowerCase())) { event.preventDefault(); turnActionsOpenScoutRoutes(); }
});
window.addEventListener('keyup', async event => {
  if (event.key !== 'Shift') return;
  // The key can be released immediately after mouseup. Wait for that click's
  // async append/route calculation before committing the complete chain.
  if (turnActionState.pendingMapClick) await turnActionState.pendingMapClick;
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

turnActionsBindHover();
turnActionsRender();

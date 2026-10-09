/* Turn-scoped route persistence and unit data for the mapper action bar. */
const savedMovementPlansState = {
  routes: [],
  selectedUnitCode: '',
  routeType: 'unit',
  turnKey: null,
  ready: false,
  scoutCount: 2,
  scoutHorses: 2,
  scoutMission: 'PATROL',
  unitSplits: []
};

function savedMovementEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function savedMovementRootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

function savedMovementRouteKey(route) {
  return typeof planRouteKey === 'function'
    ? planRouteKey(route)
    : String(route?.id ?? `${route?.routeType || 'route'}:${route?.unitCode || ''}:${route?.scoutNumber ?? ''}`);
}

function savedMovementCompareUnits(left, right) {
  const parse = unit => {
    const value = String(unit?.unitCode || unit?.unit || '').toLowerCase();
    const root = Number(value.slice(0, 4)) || 0;
    const suffix = value.slice(4);
    const typeOrder = suffix === '' ? 0 : suffix[0] === 'e' ? 1 : suffix[0] === 'f' ? 2 : suffix[0] === 'g' ? 3 : suffix[0] === 'c' ? 4 : 9;
    return [root, typeOrder, Number(suffix.slice(1)) || 0, value];
  };
  const a = parse(left); const b = parse(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3].localeCompare(b[3]);
}

function savedMovementCurrentTurnKey() {
  return resultsTimeline?.turn?.turnKey || state?.planImport?.turnKey || state?.planImport?.plan?.turnKey || null;
}

function savedMovementNormalizeUnit(unit, fallbackHex = null) {
  const unitCode = String(unit?.unitCode || unit?.unit || '').trim();
  const currentHex = unit?.currentHex || unit?.startHex || fallbackHex || null;
  if (!unitCode || !parseCoordinate(currentHex)) return null;
  return {
    ...unit,
    unitCode,
    unitType: unit?.unitType || unit?.type || 'Unit',
    currentHex
  };
}

function savedMovementUnits() {
  const byCode = new Map();
  const unitStats = new Map((state?.planImport?.plan?.unitStats || [])
    .map(row => [String(row.unit || row.unitCode || '').trim().toLowerCase(), row]));
  const add = (unit, priority) => {
    const unitCode = String(unit?.unitCode || unit?.unit || '').trim();
    const stats = unitStats.get(unitCode.toLowerCase()) || null;
    const normalized = savedMovementNormalizeUnit({
      ...(stats || {}),
      ...unit,
      unitCode: unitCode || stats?.unit || stats?.unitCode,
      currentHex: unit?.currentHex || unit?.startHex || stats?.currentHex || stats?.startHex
    });
    if (!normalized) return;
    const key = normalized.unitCode.toLowerCase();
    const existing = byCode.get(key);
    if (!existing || priority >= existing.priority) byCode.set(key, { unit: normalized, priority });
  };

  for (const unit of state?.planImport?.plan?.units || []) add(unit, 1);
  for (const movement of state?.planImport?.plan?.movements || []) add(movement, 2);
  for (const unit of resultsTimeline?.turn?.units || []) add(unit, 3);
  for (const split of savedMovementPlansState.unitSplits || []) add({
    unitCode: split.unitCode,
    unitType: split.unitType,
    unitName: split.unitName,
    currentHex: split.startHex,
    startHex: split.startHex,
    parentUnit: split.parentUnit,
    plannedSplit: true
  }, 4);

  return [...byCode.values()].map(row => row.unit).sort(savedMovementCompareUnits);
}

function savedMovementSelectableUnits() {
  return savedMovementUnits();
}

function savedMovementSelectedUnit() {
  return savedMovementUnits().find(unit => String(unit.unitCode) === String(savedMovementPlansState.selectedUnitCode)) || null;
}

function savedMovementCreationParents() {
  return savedMovementUnits().filter(unit => String(unit.unitType || unit.type) === 'Tribe' && !unit.plannedSplit);
}

async function savedMovementPopulateCreationForm() {
  const parentSelect = document.getElementById('movementPlannerCreateParent');
  if (!parentSelect) return;
  const parents = savedMovementCreationParents();
  parentSelect.innerHTML = parents.map(unit => `<option value="${savedMovementEscape(unit.unitCode)}">${savedMovementEscape(unit.unitCode)} · ${savedMovementEscape(unit.unitName || 'Tribe')}</option>`).join('');
  const selected = savedMovementSelectedUnit();
  if (selected && String(selected.unitType) === 'Tribe') parentSelect.value = selected.unitCode;
  const type = document.getElementById('movementPlannerCreateType');
  const code = document.getElementById('movementPlannerCreateCode');
  if (type && code && !code.value) code.value = type.value === 'Tribe' ? '1485' : `${parentSelect.value || '0000'}e1`;
  await savedMovementLoadCreationSkills();
}

async function savedMovementLoadCreationSkills() {
  const host = document.getElementById('movementPlannerCreateSkills');
  const parent = document.getElementById('movementPlannerCreateParent')?.value;
  const type = document.getElementById('movementPlannerCreateType')?.value;
  if (!host || !parent) return;
  host.innerHTML = '';
  if (type !== 'Tribe') return;
  try {
    const managed = savedMovementCurrentTurnKey() ? await window.tribenet.getManagedTurn(savedMovementCurrentTurnKey()) : null;
    const skills = managed?.start?.data?.skillsByTribe?.[savedMovementRootTribe(parent)] || [];
    if (!skills.length) {
      host.textContent = 'No source-Tribe skills were found in the Results baseline.';
      return;
    }
    host.innerHTML = '<span>Move entire skills to the new Tribe (optional)</span>' + skills.map(row => `
      <label><input type="checkbox" data-creation-skill="${savedMovementEscape(row.skill || row.shortname || '')}" data-creation-level="${Number(row.level || 0)}" /> ${savedMovementEscape(row.skill || row.shortname)} ${Number(row.level || 0)}</label>
    `).join('');
  } catch (error) {
    host.textContent = `Could not load source skills: ${error.message || error}`;
  }
}

async function savedMovementCreateUnit() {
  const status = document.getElementById('movementPlannerCreateStatus');
  const turnKey = savedMovementCurrentTurnKey();
  const parentUnit = document.getElementById('movementPlannerCreateParent')?.value;
  const unitType = document.getElementById('movementPlannerCreateType')?.value;
  const unitCode = document.getElementById('movementPlannerCreateCode')?.value.trim().toLowerCase();
  const unitName = document.getElementById('movementPlannerCreateName')?.value.trim();
  const skills = [...document.querySelectorAll('#movementPlannerCreateSkills input[data-creation-skill]:checked')].map(input => ({
    skill: input.dataset.creationSkill,
    level: Number(input.dataset.creationLevel || 0)
  }));
  if (!turnKey || !parentUnit || !unitType || !unitCode) {
    if (status) status.textContent = 'Choose a source Tribe and enter a unit code.';
    return;
  }
  try {
    const created = await window.tribenet.addPlannedUnitSplit(turnKey, { parentUnit, unitCode, unitType, unitName, skills });
    savedMovementPlansState.selectedUnitCode = created.unitCode;
    state.selectedUnit = created.unitCode;
    state.selectedUnitHex = created.startHex || null;
    await savedMovementRefresh();
    document.getElementById('unitSplitDialog')?.close();
    if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementUnitMove(unitCode) {
  return savedMovementPlansState.routes.find(route => route.routeType === 'unit' && String(route.unitCode).toLowerCase() === String(unitCode).toLowerCase()) || null;
}

function savedMovementIsStationaryUnit(unit) {
  return ['garrison', 'fleet', 'courier'].includes(String(unit?.unitType || unit?.type || '').trim().toLowerCase());
}

function savedMovementOriginFor(unitCode = savedMovementPlansState.selectedUnitCode, routeType = savedMovementPlansState.routeType) {
  const unit = savedMovementUnits().find(row => String(row.unitCode).toLowerCase() === String(unitCode).toLowerCase());
  if (!unit) return null;
  if (routeType === 'scout') {
    const unitMove = savedMovementUnitMove(unitCode);
    if (unitMove?.destinationHex) return unitMove.destinationHex;
  }
  return unit.currentHex || null;
}

function savedMovementScoutUsesUnitMove() {
  return savedMovementPlansState.routeType === 'scout'
    && Boolean(savedMovementUnitMove(savedMovementPlansState.selectedUnitCode)?.destinationHex);
}

function savedMovementCanMoveUnit(unit = savedMovementSelectedUnit()) {
  if (!unit) return false;
  if (savedMovementIsStationaryUnit(unit)) return false;
  if (unit.plannedSplit && savedMovementUnitMove(unit.parentUnit)) return false;
  return true;
}

// Kept as a compatibility hook for lifecycle and split modules. The mapper
// no longer creates a planner card or a second unit selector.
function savedMovementEnsureCardControls() {}
function savedMovementPopulateUnits() {
  if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
}
function savedMovementRenderSaveControls() {
  if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
}

function savedMovementSelectSavedRoute(routeKey) {
  const route = savedMovementPlansState.routes.find(item => savedMovementRouteKey(item) === String(routeKey));
  if (!route) return;
  state.selectedRouteId = savedMovementRouteKey(route);
  state.selectedUnit = route.unitCode || route.unit || null;
  savedMovementPlansState.selectedUnitCode = state.selectedUnit;
  const origin = parseCoordinate(route.originHex || route.startHex);
  state.selectedUnitHex = origin?.coordinate || null;
  if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
  draw();
}

function savedMovementVisibleRouteNumber(route) {
  const visible = savedMovementPlansState.routes.filter(candidate => {
    if (candidate.routeType === 'unit') return Boolean(state.planningVisible);
    if (candidate.routeType === 'scout') return Boolean(state.planningVisible && state.scoutingVisible);
    return false;
  });
  const index = visible.indexOf(route);
  return index >= 0 ? index + 1 : 1;
}

function savedMovementRouteLabelBounds(route) {
  const end = route?.path?.[route.path.length - 1];
  if (!end || route.routeType !== 'scout' || !state.scoutingVisible) return null;
  const point = screenFromBase(baseCenter(end.globalCol, end.globalRow));
  const text = `R${savedMovementVisibleRouteNumber(route)} · S${route.scoutNumber} ${route.unitCode}`;
  ctx.save();
  ctx.font = `700 ${Math.max(8, Math.min(10, state.scale * .25))}px Segoe UI`;
  const width = ctx.measureText(text).width + 10;
  ctx.restore();
  return {
    route,
    left: point.x - width / 2,
    right: point.x + width / 2,
    top: point.y + state.scale * .48,
    bottom: point.y + state.scale * .48 + 16
  };
}

function savedMovementHandleRouteLabelClick(clientX, clientY) {
  if (state.mode !== 'detail' || (typeof turnActionState !== 'undefined' && turnActionState.active)) return false;
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  const hit = savedMovementPlansState.routes
    .filter(route => route.routeType === 'scout' && state.planningVisible && state.scoutingVisible)
    .map(savedMovementRouteLabelBounds)
    .find(bounds => bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom);
  if (!hit) return false;
  savedMovementSelectSavedRoute(savedMovementRouteKey(hit.route));
  return true;
}

async function savedMovementRefresh() {
  const turnKey = savedMovementCurrentTurnKey();
  savedMovementPlansState.turnKey = turnKey;
  savedMovementPlansState.routes = turnKey ? await window.tribenet.listPlannedRoutes(turnKey) : [];
  if (state.selectedRouteId != null && !savedMovementPlansState.routes.some(route => savedMovementRouteKey(route) === String(state.selectedRouteId))) {
    state.selectedRouteId = null;
  }
  savedMovementPlansState.ready = true;
  savedMovementPopulateUnits();
  draw();
}

function savedMovementScoutGroupStatus(unit = savedMovementSelectedUnit()) {
  if (!unit) return null;
  const tribeCode = savedMovementRootTribe(unit.unitCode);
  const scouts = savedMovementPlansState.routes.filter(route => route.routeType === 'scout'
    && String(route.tribeCode || savedMovementRootTribe(route.unitCode)) === tribeCode);
  return { tribeCode, count: scouts.length, remaining: Math.max(0, 8 - scouts.length) };
}

async function savedMovementSaveCurrentRoute() {
  const unit = savedMovementSelectedUnit();
  const route = movementPlannerState.route;
  const turnKey = savedMovementCurrentTurnKey();
  const type = savedMovementPlansState.routeType;
  if (!unit || !turnKey || route?.status !== 'ok' || !route.directions?.length) return false;
  if (type === 'unit' && !savedMovementCanMoveUnit(unit)) return false;

  const scoutCount = Math.max(1, Number(savedMovementPlansState.scoutCount || 2));
  const scoutHorses = Math.max(0, Number(savedMovementPlansState.scoutHorses || 2));
  const scoutStatus = savedMovementScoutGroupStatus(unit);
  if (type === 'scout' && (!scoutStatus || scoutStatus.count >= 8 || scoutHorses > scoutCount)) return false;

  const previousUnitMove = type === 'unit' ? savedMovementUnitMove(unit.unitCode) : null;
  const previousDestination = previousUnitMove?.destinationHex || unit.currentHex || null;

  const payload = {
    turnKey,
    tribeCode: savedMovementRootTribe(unit.unitCode),
    unitCode: unit.unitCode,
    routeType: type,
    originHex: movementPlannerState.origin?.coordinate || route.origin,
    destinationHex: route.destinationHex || route.actualTarget || route.path?.[route.path.length - 1]?.coordinate,
    directions: route.directions,
    path: route.path,
    knownMp: Number(route.knownMp ?? route.totalMp ?? 0),
    badWeatherMp: Number(route.badWeatherMp ?? route.knownMp ?? route.totalMp ?? 0),
    noOfScouts: type === 'scout' ? scoutCount : null,
    noOfHorses: type === 'scout' ? scoutHorses : null,
    mission: type === 'scout' ? String(savedMovementPlansState.scoutMission || 'PATROL').toUpperCase() : null,
    unknownEntryCount: Number(route.unknownEntryCount || 0)
  };
  const editingRouteId = typeof turnActionState !== 'undefined' ? turnActionState.editingRouteId : null;
  if (type === 'scout' && editingRouteId != null) payload.id = Number(editingRouteId);
  await window.tribenet.savePlannedRoute(payload);
  let clearedScoutRoutes = 0;
  if (type === 'unit'
    && payload.destinationHex
    && String(previousDestination || '').toUpperCase() !== String(payload.destinationHex).toUpperCase()
    && typeof window.tribenet.removeAllScoutRoutesForUnit === 'function') {
    clearedScoutRoutes = Number(await window.tribenet.removeAllScoutRoutesForUnit(turnKey, unit.unitCode) || 0);
  }
  await savedMovementRefresh();
  return { ...payload, clearedScoutRoutes };
}

async function savedMovementResetMovementForUnit(unitCode = savedMovementPlansState.selectedUnitCode) {
  const turnKey = savedMovementCurrentTurnKey();
  const unit = savedMovementUnits().find(row => String(row.unitCode).toLowerCase() === String(unitCode || '').toLowerCase());
  if (!turnKey || !unit) return { movement: 0, scouting: 0 };
  const movement = savedMovementUnitMove(unit.unitCode);
  let removedMovement = 0;
  if (movement?.id != null) removedMovement = Number(await window.tribenet.removePlannedRoute(movement.id) ? 1 : 0);
  const removedScouting = typeof window.tribenet.removeAllScoutRoutesForUnit === 'function'
    ? Number(await window.tribenet.removeAllScoutRoutesForUnit(turnKey, unit.unitCode) || 0)
    : 0;
  state.selectedRouteId = null;
  await savedMovementRefresh();
  return { movement: removedMovement, scouting: removedScouting };
}

async function savedMovementResetScoutingForUnit(unitCode = savedMovementPlansState.selectedUnitCode) {
  const turnKey = savedMovementCurrentTurnKey();
  const unit = savedMovementUnits().find(row => String(row.unitCode).toLowerCase() === String(unitCode || '').toLowerCase());
  if (!turnKey || !unit || typeof window.tribenet.removeAllScoutRoutesForUnit !== 'function') return 0;
  const removed = Number(await window.tribenet.removeAllScoutRoutesForUnit(turnKey, unit.unitCode) || 0);
  state.selectedRouteId = null;
  await savedMovementRefresh();
  return removed;
}

async function savedMovementResetAllUnitChanges() {
  const turnKey = savedMovementCurrentTurnKey();
  if (!turnKey) return [];
  const removed = await window.tribenet.deleteAllPlannedUnitSplits(turnKey);
  savedMovementPlansState.selectedUnitCode = '';
  state.selectedUnit = null;
  state.selectedUnitHex = null;
  await savedMovementRefresh();
  return removed;
}

function savedMovementSetStationaryStatus() {
  return 'Fleets, Couriers and Garrisons are stationary; MOVEMENT_1 will be Still.';
}

function savedMovementConditionalPredictions(route) {
  const order = String(route?.directions?.[route.directions.length - 1] || '').toUpperCase();
  if (typeof ConditionalOrders === 'undefined' || !ConditionalOrders.DEFINITIONS?.[order]) return [];
  const path = route?.path || [];
  const anchor = path[path.length - 1];
  const previous = path[path.length - 2];
  if (!anchor || !previous || !state.hexCache) return [];
  const heading = directionBetween(previous.coordinate, anchor.coordinate);
  return ConditionalOrders.preview(state.hexCache, anchor, heading, order, { maxSteps: 6 }).predictionPaths || [];
}

function savedMovementDrawLabel(point, text, color, alpha = 1) {
  if (!point) return;
  const p = screenFromBase(baseCenter(point.globalCol, point.globalRow));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${Math.max(8, Math.min(11, state.scale * .27))}px Segoe UI`;
  const width = ctx.measureText(text).width + 10;
  const x = p.x - width / 2;
  const y = p.y - state.scale * .35;
  roundedRect(ctx, x, y, width, 17, 5);
  ctx.fillStyle = 'rgba(8,17,22,.9)'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + 8.5);
  ctx.restore();
}

function savedMovementRouteWeatherAllowance(route) {
  if (route?.routeType === 'scout') {
    const scouts = Math.max(1, Number(route.noOfScouts || route.scoutCount || 1));
    const horses = Math.max(0, Number(route.noOfHorses || route.horseCount || 0));
    return horses >= scouts ? 15 : 8;
  }
  const unit = savedMovementUnits().find(candidate => String(candidate.unitCode).toLowerCase() === String(route?.unitCode || '').toLowerCase());
  return MovementPlannerCore.unitMovementProfile(unit).allowance;
}

function savedMovementDrawOverlay() {
  if (state.mode !== 'detail' || !savedMovementPlansState.routes.length) return;
  for (const route of savedMovementPlansState.routes) {
    if (route.routeType === 'unit' && !state.planningVisible) continue;
    if (route.routeType === 'scout' && (!state.planningVisible || !state.scoutingVisible)) continue;
    const scout = route.routeType === 'scout';
    const color = scout ? '#78c9e6' : '#f0b45e';
    const certainColor = scout ? '#78c9e6' : '#8dd7a1';
    const maybeColor = '#e4bb65';
    const routeId = savedMovementRouteKey(route);
    const style = routeStyle(route.unitCode || route.unit, {
      color, certainColor, maybeColor,
      badWeatherAllowance: savedMovementRouteWeatherAllowance(route),
      width: Math.max(1.8, state.scale * (scout ? .07 : .09)), alpha: .58, dashed: scout
    }, routeId);
    drawRoute(route.path, style);
    drawConditionalPredictions({ predictionPaths: savedMovementConditionalPredictions(route) }, routeStyle(route.unitCode || route.unit, {
      color, width: Math.max(1.2, state.scale * (scout ? .05 : .06)), alpha: .3, dashed: true
    }, routeId));
    const end = route.path?.[route.path.length - 1];
    savedMovementDrawLabel(end, `R${savedMovementVisibleRouteNumber(route)} · ${scout ? `S${route.scoutNumber}` : 'M'} ${route.unitCode}`, color, style.alpha);
  }
}

const savedMovementOriginalDraw = draw;
draw = function drawWithSavedMovementPlans() {
  savedMovementOriginalDraw();
  savedMovementDrawOverlay();
};

const savedMovementOriginalApplyResultTurn = applyResultTurn;
applyResultTurn = async function applyResultTurnWithSavedPlans(turnKey, options = {}) {
  const result = await savedMovementOriginalApplyResultTurn(turnKey, options);
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  if (movementPlannerState.active) movementPlannerReset();
  await savedMovementRefresh();
  return result;
};

savedMovementRefresh().catch(error => console.error('Could not initialise saved movement plans', error));
setTimeout(() => savedMovementRefresh().catch(() => {}), 300);
setTimeout(() => savedMovementRefresh().catch(() => {}), 1200);

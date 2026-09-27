const savedMovementPlansState = {
  routes: [],
  selectedUnitCode: '',
  routeType: 'unit',
  turnKey: null,
  ready: false
};

function savedMovementEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function savedMovementRootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

function savedMovementCurrentTurnKey() {
  return resultsTimeline?.turn?.turnKey || null;
}

function savedMovementUnits() {
  return (resultsTimeline?.turn?.units || [])
    .filter(unit => unit?.unitCode && parseCoordinate(unit.currentHex))
    .sort((a, b) => {
      const order = { Tribe: 0, Element: 1, Fleet: 2, Garrison: 3 };
      return (order[a.unitType] ?? 9) - (order[b.unitType] ?? 9) || String(a.unitCode).localeCompare(String(b.unitCode));
    });
}

function savedMovementSelectedUnit() {
  return savedMovementUnits().find(unit => String(unit.unitCode) === String(savedMovementPlansState.selectedUnitCode)) || null;
}

function savedMovementUnitMove(unitCode) {
  return savedMovementPlansState.routes.find(route => route.routeType === 'unit' && String(route.unitCode) === String(unitCode)) || null;
}

function savedMovementOriginFor(unitCode = savedMovementPlansState.selectedUnitCode, routeType = savedMovementPlansState.routeType) {
  const unit = savedMovementUnits().find(row => String(row.unitCode) === String(unitCode));
  if (!unit) return null;
  if (routeType === 'scout') {
    const unitMove = savedMovementUnitMove(unitCode);
    if (unitMove?.destinationHex) return unitMove.destinationHex;
  }
  return unit.currentHex || null;
}

function savedMovementEnsureToolbarControls() {
  if (document.getElementById('movementPlannerUnitSelect')) return;
  const button = document.getElementById('movementPlannerButton');
  if (!button?.parentElement) return;

  const unitSelect = document.createElement('select');
  unitSelect.id = 'movementPlannerUnitSelect';
  unitSelect.className = 'turn-select movement-planner-unit-select';
  unitSelect.title = 'Unit whose movement/scouting is being planned';

  const typeSelect = document.createElement('select');
  typeSelect.id = 'movementPlannerRouteType';
  typeSelect.className = 'turn-select movement-planner-type-select';
  typeSelect.innerHTML = '<option value="unit">Unit Move</option><option value="scout">Scout Move</option>';
  typeSelect.title = 'Whether this route will be saved as unit movement or scouting';

  button.insertAdjacentElement('afterend', unitSelect);
  unitSelect.insertAdjacentElement('afterend', typeSelect);

  unitSelect.addEventListener('change', async () => {
    savedMovementPlansState.selectedUnitCode = unitSelect.value;
    await savedMovementApplySelectedOrigin(true);
    savedMovementRenderSaveControls();
  });

  typeSelect.addEventListener('change', async () => {
    savedMovementPlansState.routeType = typeSelect.value === 'scout' ? 'scout' : 'unit';
    await savedMovementApplySelectedOrigin(true);
    savedMovementRenderSaveControls();
  });
}

function savedMovementEnsureCardControls() {
  if (document.getElementById('movementPlannerSavePanel')) return;
  const note = document.getElementById('movementPlannerNote');
  if (!note) return;

  const panel = document.createElement('div');
  panel.id = 'movementPlannerSavePanel';
  panel.className = 'movement-planner-save-panel';
  panel.innerHTML = `
    <div class="movement-planner-save-row">
      <button id="movementPlannerSaveRoute" class="button accent" disabled>Save Route</button>
      <span id="movementPlannerSaveStatus"></span>
    </div>
    <div id="movementPlannerScoutLimit" class="movement-planner-scout-limit"></div>
    <div id="movementPlannerSavedList" class="movement-planner-saved-list"></div>
  `;
  note.insertAdjacentElement('afterend', panel);
  document.getElementById('movementPlannerSaveRoute').addEventListener('click', savedMovementSaveCurrentRoute);
  panel.addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-planned-route]');
    if (!button) return;
    await window.tribenet.removePlannedRoute(Number(button.dataset.removePlannedRoute));
    await savedMovementRefresh();
    document.getElementById('movementPlannerSaveStatus').textContent = 'Saved route removed.';
  });
}

function savedMovementPopulateUnits() {
  savedMovementEnsureToolbarControls();
  const select = document.getElementById('movementPlannerUnitSelect');
  const typeSelect = document.getElementById('movementPlannerRouteType');
  if (!select || !typeSelect) return;

  const units = savedMovementUnits();
  const previous = savedMovementPlansState.selectedUnitCode;
  select.innerHTML = '<option value="">Select unit…</option>' + units.map(unit =>
    `<option value="${savedMovementEscape(unit.unitCode)}">${savedMovementEscape(unit.unitCode)} · ${savedMovementEscape(unit.unitType || 'Unit')} · ${savedMovementEscape(unit.currentHex || 'Unknown')}</option>`
  ).join('');

  if (previous && units.some(unit => String(unit.unitCode) === String(previous))) {
    select.value = previous;
  } else {
    savedMovementPlansState.selectedUnitCode = '';
    select.value = '';
  }
  typeSelect.value = savedMovementPlansState.routeType;
  select.disabled = !units.length;
  typeSelect.disabled = !units.length;
}

async function savedMovementRefresh() {
  savedMovementEnsureToolbarControls();
  savedMovementEnsureCardControls();
  const turnKey = savedMovementCurrentTurnKey();
  savedMovementPlansState.turnKey = turnKey;
  savedMovementPlansState.routes = turnKey ? await window.tribenet.listPlannedRoutes(turnKey) : [];
  savedMovementPopulateUnits();
  savedMovementRenderSaveControls();
  savedMovementPlansState.ready = true;
  draw();
}

function savedMovementScoutGroupStatus() {
  const unit = savedMovementSelectedUnit();
  if (!unit) return null;
  const tribeCode = savedMovementRootTribe(unit.unitCode);
  const scouts = savedMovementPlansState.routes.filter(route => route.routeType === 'scout' && String(route.tribeCode || savedMovementRootTribe(route.unitCode)) === tribeCode);
  return { tribeCode, count: scouts.length, remaining: Math.max(0, 8 - scouts.length) };
}

function savedMovementRenderSaveControls() {
  savedMovementEnsureCardControls();
  const saveButton = document.getElementById('movementPlannerSaveRoute');
  const limit = document.getElementById('movementPlannerScoutLimit');
  const list = document.getElementById('movementPlannerSavedList');
  if (!saveButton || !limit || !list) return;

  const unit = savedMovementSelectedUnit();
  const route = movementPlannerState.route;
  const type = savedMovementPlansState.routeType;
  const scoutStatus = savedMovementScoutGroupStatus();
  const canSave = Boolean(
    unit && savedMovementCurrentTurnKey() && route?.status === 'ok' && route.directions?.length &&
    (type !== 'scout' || (scoutStatus && scoutStatus.count < 8))
  );

  saveButton.textContent = type === 'scout' ? 'Save Scout Move' : 'Save Unit Move';
  saveButton.disabled = !canSave;
  saveButton.title = !unit
    ? 'Select a unit first.'
    : !route?.directions?.length
      ? 'Plan at least one movement command first.'
      : type === 'scout' && scoutStatus?.count >= 8
        ? `Tribe ${scoutStatus.tribeCode} has already used all 8 scout moves this turn.`
        : '';

  limit.textContent = scoutStatus
    ? `Tribe ${scoutStatus.tribeCode} scout moves: ${scoutStatus.count}/8 · shared by the Tribe and linked Elements`
    : 'Select a unit to see its Tribe scout allowance.';

  if (!unit) {
    list.innerHTML = '<div class="movement-planner-saved-empty">Select a unit to view saved movement for this turn.</div>';
    return;
  }

  const rows = savedMovementPlansState.routes.filter(item => String(item.unitCode) === String(unit.unitCode));
  if (!rows.length) {
    list.innerHTML = '<div class="movement-planner-saved-empty">No saved routes for this unit on this turn.</div>';
    return;
  }

  list.innerHTML = rows.map(item => {
    const label = item.routeType === 'scout' ? `Scout ${item.scoutNumber}` : 'Unit Move';
    const mp = `${item.knownMp}${item.unknownEntryCount ? ` + ?×${item.unknownEntryCount}` : ''} MP`;
    const commands = item.directions.join(' → ');
    return `
      <div class="movement-planner-saved-route">
        <div><strong>${savedMovementEscape(label)}</strong><span>${savedMovementEscape(item.originHex)} → ${savedMovementEscape(item.destinationHex)} · ${savedMovementEscape(mp)}</span></div>
        <small>${savedMovementEscape(commands)}</small>
        <button class="button danger movement-planner-remove-route" data-remove-planned-route="${item.id}">Remove</button>
      </div>
    `;
  }).join('');
}

async function savedMovementApplySelectedOrigin(center = false) {
  const coordinate = savedMovementOriginFor();
  if (!coordinate) return;
  const point = parseCoordinate(coordinate);
  if (!point) return;

  const wasActive = movementPlannerState.active;
  if (wasActive) movementPlannerState.active = false;
  try {
    await selectHex(point.globalCol, point.globalRow);
  } finally {
    movementPlannerState.active = wasActive;
  }
  if (center) centerOnHex(point.globalCol, point.globalRow);

  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = null;
  if (wasActive) {
    movementPlannerUpdateButton();
    movementPlannerSetStatus(`${savedMovementPlansState.routeType === 'scout' ? 'Scout' : 'Unit'} origin ${point.coordinate} · click a destination`);
    const card = document.getElementById('movementPlannerCard');
    const title = document.getElementById('movementPlannerTitle');
    const summary = document.getElementById('movementPlannerSummary');
    const routeText = document.getElementById('movementPlannerDirections');
    const note = document.getElementById('movementPlannerNote');
    card?.classList.remove('hidden');
    if (title) title.textContent = `${savedMovementPlansState.routeType === 'scout' ? 'Scout' : 'Movement'} from ${point.coordinate}`;
    if (summary) summary.textContent = 'Click a destination to plan this route.';
    movementPlannerRenderAllowances(null);
    if (routeText) routeText.textContent = '';
    if (note) note.textContent = savedMovementPlansState.routeType === 'scout' && savedMovementUnitMove(savedMovementPlansState.selectedUnitCode)
      ? 'Scout origin is the saved Unit Move destination. Hold Shift to append adjacent moves into fog.'
      : 'Hold Shift to append adjacent movement commands into fog.';
    draw();
  }
  savedMovementRenderSaveControls();
}

function savedMovementActivateUnknownOrigin(coordinate) {
  const point = parseCoordinate(coordinate);
  if (!point) return;
  movementPlannerState.active = true;
  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = {
    status: 'ok',
    origin: point.coordinate,
    requestedTarget: point.coordinate,
    actualTarget: point.coordinate,
    targetIsUnknown: true,
    path: [{ coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow, terrain: 'UNKNOWN', entryMp: 0, cumulativeMp: 0, knownCumulativeMp: 0, unknownCumulativeCount: 0, kind: 'approx' }],
    directions: [], steps: 0, knownMp: 0, unknownEntryCount: 0, totalMp: 0
  };
  movementPlannerUpdateButton();
  movementPlannerRenderCard(movementPlannerState.route);
  movementPlannerSetStatus(`Origin ${point.coordinate} is fog · Shift-click an adjacent hex to add commands`);
  savedMovementRenderSaveControls();
  draw();
}

async function savedMovementSaveCurrentRoute() {
  const unit = savedMovementSelectedUnit();
  const route = movementPlannerState.route;
  const turnKey = savedMovementCurrentTurnKey();
  const status = document.getElementById('movementPlannerSaveStatus');
  if (!unit || !turnKey || route?.status !== 'ok' || !route.directions?.length) return;

  const payload = {
    turnKey,
    tribeCode: savedMovementRootTribe(unit.unitCode),
    unitCode: unit.unitCode,
    routeType: savedMovementPlansState.routeType,
    originHex: movementPlannerState.origin?.coordinate || route.origin,
    destinationHex: route.actualTarget || route.path?.[route.path.length - 1]?.coordinate,
    directions: route.directions,
    path: route.path,
    knownMp: Number(route.knownMp ?? route.totalMp ?? 0),
    unknownEntryCount: Number(route.unknownEntryCount || 0)
  };

  try {
    const saved = await window.tribenet.savePlannedRoute(payload);
    await savedMovementRefresh();
    if (status) status.textContent = saved.routeType === 'scout'
      ? `Scout ${saved.scoutNumber} saved for ${saved.unitCode}.`
      : `Unit Move saved for ${saved.unitCode}.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementDrawLabel(point, text, color) {
  if (!point) return;
  const p = screenFromBase(baseCenter(point.globalCol, point.globalRow));
  ctx.save();
  ctx.font = `800 ${Math.max(8, Math.min(11, state.scale * .27))}px Segoe UI`;
  const width = ctx.measureText(text).width + 10;
  const x = p.x - width / 2;
  const y = p.y - state.scale * .35;
  roundedRect(ctx, x, y, width, 17, 5);
  ctx.fillStyle = 'rgba(8,17,22,.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + 8.5);
  ctx.restore();
}

function savedMovementDrawOverlay() {
  if (state.mode !== 'detail' || !savedMovementPlansState.routes.length) return;
  for (const route of savedMovementPlansState.routes) {
    if (route.routeType === 'unit' && !state.planningVisible) continue;
    if (route.routeType === 'scout' && (!state.planningVisible || !state.scoutingVisible)) continue;
    const scout = route.routeType === 'scout';
    const color = scout ? '#78c9e6' : '#f0b45e';
    drawRoute(route.path, { color, width: Math.max(1.8, state.scale * (scout ? .07 : .09)), alpha: .58, dashed: scout });
    const end = route.path?.[route.path.length - 1];
    savedMovementDrawLabel(end, scout ? `S${route.scoutNumber} ${route.unitCode}` : `M ${route.unitCode}`, color);
  }
}

const savedMovementOriginalDraw = draw;
draw = function drawWithSavedMovementPlans() {
  savedMovementOriginalDraw();
  savedMovementDrawOverlay();
};

const savedMovementOriginalRenderCard = movementPlannerRenderCard;
movementPlannerRenderCard = function movementPlannerRenderCardWithSave(result) {
  savedMovementOriginalRenderCard(result);
  savedMovementRenderSaveControls();
};

const savedMovementOriginalReset = movementPlannerReset;
movementPlannerReset = function movementPlannerResetWithSave(options = {}) {
  savedMovementOriginalReset(options);
  savedMovementRenderSaveControls();
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

const savedMovementPlannerButton = document.getElementById('movementPlannerButton');
if (savedMovementPlannerButton) {
  savedMovementPlannerButton.addEventListener('click', event => {
    if (movementPlannerState.active || savedMovementPlansState.routeType !== 'scout' || !savedMovementPlansState.selectedUnitCode) return;
    const unitMove = savedMovementUnitMove(savedMovementPlansState.selectedUnitCode);
    const origin = savedMovementOriginFor();
    const last = unitMove?.path?.[unitMove.path.length - 1];
    if (!origin || last?.terrain !== 'UNKNOWN') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    savedMovementActivateUnknownOrigin(origin);
  }, true);
}

savedMovementEnsureToolbarControls();
savedMovementEnsureCardControls();
setTimeout(savedMovementRefresh, 180);
setTimeout(savedMovementRefresh, 700);

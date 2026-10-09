const movementPlannerState = {
  active: false,
  origin: null,
  route: null,
  knownHexes: null,
  knowledgeKey: null,
  loading: false,
  shiftHeld: false
};

const movementPlannerOriginalDraw = draw;
const movementPlannerOriginalSelectHex = selectHex;

function movementPlannerTurnKey() {
  const knowledgeKey = typeof resultsTimeline !== 'undefined'
    ? (resultsTimeline.turn?.knowledgeTurnKey || resultsTimeline.turn?.baselineTurnKey || resultsTimeline.turn?.turnKey)
    : null;
  return knowledgeKey
    ? `results:${knowledgeKey}`
    : 'current-map';
}

function movementPlannerSetStatus(message) {
  const readout = document.getElementById('movementPlannerReadout');
  if (readout) readout.textContent = message || '';
}

function movementPlannerUpdateButton() {
  const button = document.getElementById('movementPlannerButton');
  if (!button) return;
  button.disabled = !movementPlannerState.active && !state.selected;
  button.classList.toggle('active', movementPlannerState.active);
  button.textContent = movementPlannerState.active ? 'Stop Movement' : 'Movement';
  button.title = movementPlannerState.active
    ? `Movement from ${movementPlannerState.origin?.coordinate || 'selected origin'} · Shift-click appends a route`
    : 'Use the currently selected hex as the movement origin';
}

function movementPlannerHideCard() {
  const card = document.getElementById('movementPlannerCard');
  if (card) card.classList.add('hidden');
}

function movementPlannerEnsureAllowancesHost() {
  let host = document.getElementById('movementPlannerAllowances');
  if (host) return host;
  const summary = document.getElementById('movementPlannerSummary');
  if (!summary) return null;
  host = document.createElement('div');
  host.id = 'movementPlannerAllowances';
  host.className = 'movement-planner-allowances';
  summary.insertAdjacentElement('afterend', host);
  return host;
}

function movementPlannerUnknownMpLabel(count) {
  const n = Math.max(0, Number(count || 0));
  if (!n) return '';
  return n === 1 ? '?' : `?×${n}`;
}

function movementPlannerRenderAllowances(route = null) {
  const host = movementPlannerEnsureAllowancesHost();
  if (!host) return;
  const hasRoute = route?.status === 'ok';
  const knownMp = hasRoute ? Number(route.knownMp ?? route.totalMp ?? 0) : 0;
  const unknownEntries = hasRoute ? Number(route.unknownEntryCount || 0) : 0;
  const unknownLabel = movementPlannerUnknownMpLabel(unknownEntries);
  const rows = MovementPlannerCore.movementAllowanceSummary(knownMp);
  host.innerHTML = rows.map(row => {
    let detail;
    let value;
    if (!hasRoute) {
      detail = `${row.mp} MP available`;
      value = `${row.mp} MP`;
    } else if (unknownEntries > 0) {
      detail = row.canComplete
        ? `${row.remaining} MP remains before ${unknownEntries} unknown entr${unknownEntries === 1 ? 'y' : 'ies'}`
        : `at least ${row.overBy} MP over`;
      value = `${row.used}+${unknownLabel}/${row.mp} MP`;
    } else {
      detail = row.canComplete ? `${row.remaining} MP left` : `${row.overBy} MP over`;
      value = `${row.used}/${row.mp} MP`;
    }
    const cls = hasRoute && !unknownEntries ? (row.canComplete ? ' within' : ' over') : hasRoute && !row.canComplete ? ' over' : '';
    return `
      <div class="movement-mode${cls}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    `;
  }).join('');
}

function movementPlannerReset(options = {}) {
  const keepActive = Boolean(options.keepActive);
  const keepCard = Boolean(options.keepCard);
  movementPlannerState.route = null;
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  movementPlannerState.loading = false;
  movementPlannerState.shiftHeld = false;
  if (!keepActive) {
    movementPlannerState.active = false;
    movementPlannerState.origin = null;
  }
  if (!keepCard) movementPlannerHideCard();
  movementPlannerSetStatus('');
  movementPlannerUpdateButton();
  draw();
}

async function movementPlannerLoadKnowledge() {
  const key = movementPlannerTurnKey();
  if (movementPlannerState.knownHexes && movementPlannerState.knowledgeKey === key) {
    return movementPlannerState.knownHexes;
  }

  const bounds = { minCol: 0, maxCol: TOTAL_COLS - 1, minRow: 0, maxRow: TOTAL_ROWS - 1 };
  const knowledgeKey = typeof resultsTimeline !== 'undefined'
    ? (resultsTimeline.turn?.knowledgeTurnKey || resultsTimeline.turn?.baselineTurnKey || resultsTimeline.turn?.turnKey)
    : null;
  const rows = knowledgeKey
    ? await window.tribenet.getResultHexesInArea(bounds, knowledgeKey)
    : await window.tribenet.getHexesInArea(bounds);

  movementPlannerState.knownHexes = MovementPlannerCore.buildKnownHexMap(rows);
  movementPlannerState.knowledgeKey = key;
  return movementPlannerState.knownHexes;
}

function movementPlannerDirectionBetween(fromCoordinate, toCoordinate) {
  const from = MovementPlannerCore.parseCoordinate(fromCoordinate);
  if (!from) return null;
  return MovementPlannerCore.adjacentHexes(from).find(next => next.coordinate === toCoordinate)?.direction || null;
}

function movementPlannerPrepareRoute(result) {
  if (!result || result.status !== 'ok') return result;
  const prepared = {
    ...result,
    path: (result.path || []).map(point => ({ ...point })),
    directions: [...(result.directions || [])],
    knownMp: Number(result.totalMp || 0),
    badWeatherMp: Number(result.badWeatherMp || result.totalMp || 0),
    unknownEntryCount: 0
  };

  if (!result.targetIsUnknown) return prepared;
  const direction = movementPlannerDirectionBetween(result.actualTarget, result.requestedTarget);
  const target = MovementPlannerCore.parseCoordinate(result.requestedTarget);
  if (!direction || !target) return prepared;

  prepared.approachTarget = result.actualTarget;
  prepared.actualTarget = result.requestedTarget;
  prepared.directions.push(direction);
  prepared.steps += 1;
  prepared.unknownEntryCount = 1;
  prepared.totalMp = null;
  prepared.badWeatherMp = Number(prepared.badWeatherMp || 0);
  prepared.path.push({
    coordinate: target.coordinate,
    globalCol: target.globalCol,
    globalRow: target.globalRow,
    terrain: 'UNKNOWN',
    entryMp: null,
    baseEntryMp: null,
    weatherPenalty: null,
    cumulativeMp: null,
    knownCumulativeMp: prepared.knownMp,
    unknownCumulativeCount: 1,
    kind: 'approx'
  });
  return prepared;
}

function movementPlannerResultMessage(result) {
  if (!result) return 'No route calculated.';
  if (result.status === 'origin-unknown') return 'The origin is not revealed land on this turn.';
  if (result.status === 'target-impassable') return `${result.requestedTarget} is ${result.targetTerrain} and cannot be entered by a land unit.`;
  if (result.status === 'no-revealed-adjacent') return `${result.requestedTarget} is unknown and has no revealed adjacent land hex yet. Route to the edge first, then Shift-click adjacent fog hexes to append moves.`;
  if (result.status === 'no-route') {
    return result.targetIsUnknown
      ? `No route through revealed land reaches an adjacent hex of ${result.requestedTarget}.`
      : `No route through revealed land reaches ${result.requestedTarget}.`;
  }
  if (result.status === 'not-adjacent') return 'The current endpoint is unrevealed; extend it one adjacent hex at a time.';
  if (result.status === 'conditional-terminal') return 'FOL/FOR is the final scouting order. Release Shift to commit or cancel the action.';
  if (result.status === 'invalid-coordinate') return 'The origin or destination coordinate is invalid.';
  return 'No route available.';
}

function movementPlannerRouteMpText(result) {
  const knownMp = Number(result?.knownMp ?? result?.totalMp ?? 0);
  const unknownEntries = Number(result?.unknownEntryCount || 0);
  const badWeather = Number(result?.badWeatherMp ?? knownMp);
  const weatherText = `bad weather ${badWeather}${unknownEntries ? '+?' : ''}`;
  if (!unknownEntries) return `${knownMp} MP · ${weatherText} MP`;
  return `${knownMp} known MP + ${movementPlannerUnknownMpLabel(unknownEntries)} unknown · ${weatherText} MP`;
}

function movementPlannerRenderCard(result) {
  const card = document.getElementById('movementPlannerCard');
  const title = document.getElementById('movementPlannerTitle');
  const summary = document.getElementById('movementPlannerSummary');
  const routeText = document.getElementById('movementPlannerDirections');
  const note = document.getElementById('movementPlannerNote');
  if (!card || !title || !summary || !routeText || !note) return;

  card.classList.remove('hidden');
  title.textContent = `Movement from ${movementPlannerState.origin?.coordinate || '—'}`;

  if (result.status !== 'ok') {
    summary.textContent = movementPlannerResultMessage(result);
    movementPlannerRenderAllowances(null);
    routeText.textContent = '';
    note.textContent = 'Automatic routing only uses revealed, land-passable terrain. Hold Shift to append a route from the current endpoint.';
    return;
  }

  const endpoint = result.actualTarget || result.path?.[result.path.length - 1]?.coordinate || '—';
  const fogSuffix = result.targetIsUnknown || result.path?.[result.path.length - 1]?.terrain === 'UNKNOWN' ? ' · fog' : '';
  summary.textContent = `${endpoint}${fogSuffix} · ${movementPlannerRouteMpText(result)} · ${result.steps} move${result.steps === 1 ? '' : 's'}`;
  movementPlannerRenderAllowances(result);
  routeText.textContent = result.directions.length
    ? `Movement commands: ${result.directions.map((direction, index) => `${index + 1}. ${direction}`).join(' → ')}`
    : 'Movement commands: none — already at the destination.';
  note.textContent = result.unknownEntryCount > 0
    ? `Fog moves are included in the commands, but their terrain MP cannot be known until revealed. Hold Shift and click any reachable destination to append a route; a fog endpoint can still be extended one adjacent hex at a time.`
    : 'Hold Shift and click any destination to append the lowest-MP route from the current endpoint. Scouts use the same terrain costs but have 8 MP on foot or 15 MP mounted. The second total is a conservative bad-weather warning; the selected route still uses normal MP.';
}

async function movementPlannerPlanTo(targetCoordinate) {
  if (!movementPlannerState.active || !movementPlannerState.origin) return;
  movementPlannerState.loading = true;
  movementPlannerSetStatus('Calculating route…');
  try {
    const known = await movementPlannerLoadKnowledge();
    const rawResult = MovementPlannerCore.findFastestRoute(
      known,
      movementPlannerState.origin.coordinate,
      targetCoordinate
    );
    const result = movementPlannerPrepareRoute(rawResult);
    movementPlannerState.route = result;
    movementPlannerRenderCard(result);
    if (result.status === 'ok') {
      movementPlannerSetStatus(`${movementPlannerRouteMpText(result)} · ${result.steps} command${result.steps === 1 ? '' : 's'}`);
    } else {
      movementPlannerSetStatus(movementPlannerResultMessage(result));
    }
  } catch (error) {
    movementPlannerState.route = null;
    movementPlannerSetStatus(`Route failed: ${error.message}`);
    movementPlannerRenderCard({ status: 'error' });
    const summary = document.getElementById('movementPlannerSummary');
    if (summary) summary.textContent = `Route failed: ${error.message}`;
  } finally {
    movementPlannerState.loading = false;
    draw();
  }
}

function movementPlannerMergeAppendedRoute(route, tail) {
  const unknownEntryCount = Number(route.unknownEntryCount || 0) + Number(tail.unknownEntryCount || 0);
  const knownMp = Number(route.knownMp ?? route.totalMp ?? 0) + Number(tail.knownMp ?? tail.totalMp ?? 0);
  return {
    ...route,
    ...tail,
    status: 'ok',
    origin: route.origin,
    requestedTarget: tail.requestedTarget,
    actualTarget: tail.actualTarget,
    targetIsUnknown: Boolean(tail.targetIsUnknown),
    path: [...route.path, ...(tail.path || []).slice(1)],
    directions: [...(route.directions || []), ...(tail.directions || [])],
    steps: Number(route.steps || 0) + Number(tail.steps || 0),
    knownMp,
    badWeatherMp: Number(route.badWeatherMp || 0) + Number(tail.badWeatherMp || 0),
    unknownEntryCount,
    totalMp: unknownEntryCount ? null : knownMp,
    appended: true
  };
}

function movementPlannerAppendSingleMoveResult(route, targetCoordinate, known) {
  const target = MovementPlannerCore.parseCoordinate(targetCoordinate);
  const targetHex = known.get(targetCoordinate);
  if (!target) return { status: 'invalid-coordinate', requestedTarget: targetCoordinate };
  if (targetHex && !MovementPlannerCore.isRevealedLand(targetHex)) {
    return { status: 'target-impassable', requestedTarget: targetCoordinate, targetTerrain: targetHex.terrain };
  }

  const endpoint = route.path[route.path.length - 1];
  const direction = movementPlannerDirectionBetween(endpoint.coordinate, targetCoordinate);
  if (!direction) return { status: 'not-adjacent', requestedTarget: targetCoordinate };

  const entryMp = targetHex ? MovementPlannerCore.terrainMovementCost(targetHex.terrain, 0) : null;
  const knownMp = Number(route.knownMp ?? route.totalMp ?? 0) + (entryMp == null ? 0 : entryMp);
  const unknownEntryCount = Number(route.unknownEntryCount || 0) + (entryMp == null ? 1 : 0);
  const point = {
    coordinate: target.coordinate,
    globalCol: target.globalCol,
    globalRow: target.globalRow,
    terrain: targetHex?.terrain || 'UNKNOWN',
    entryMp,
    baseEntryMp: entryMp,
    weatherPenalty: 0,
    cumulativeMp: unknownEntryCount ? null : knownMp,
    knownCumulativeMp: knownMp,
    unknownCumulativeCount: unknownEntryCount,
    kind: entryMp == null ? 'approx' : 'exact'
  };
  return {
    ...route,
    status: 'ok',
    requestedTarget: targetCoordinate,
    actualTarget: targetCoordinate,
    targetIsUnknown: entryMp == null,
    path: [...route.path, point],
    directions: [...route.directions, direction],
    steps: Number(route.steps || 0) + 1,
    knownMp,
    badWeatherMp: Number(route.badWeatherMp || 0) + (entryMp == null ? 0 : entryMp + MovementPlannerCore.BAD_WEATHER_ENTRY_PENALTY),
    unknownEntryCount,
    totalMp: unknownEntryCount ? null : knownMp,
    appended: true
  };
}

function movementPlannerFindAppendedRoute(route, targetCoordinate, known) {
  if (!route?.path?.length) return { status: 'no-route', requestedTarget: targetCoordinate };
  if ((route.directions || []).some(order => /^FO[LR]$/i.test(String(order)))) {
    return { status: 'conditional-terminal', requestedTarget: targetCoordinate };
  }
  const target = MovementPlannerCore.parseCoordinate(targetCoordinate);
  const endpoint = route.path[route.path.length - 1];
  if (!target) return { status: 'invalid-coordinate', requestedTarget: targetCoordinate };
  if (endpoint.coordinate === target.coordinate) return route;

  const endpointHex = known.get(endpoint.coordinate);
  if (!endpointHex || !MovementPlannerCore.isRevealedLand(endpointHex)) {
    return movementPlannerAppendSingleMoveResult(route, targetCoordinate, known);
  }

  const tail = movementPlannerPrepareRoute(MovementPlannerCore.findFastestRoute(
    known,
    endpoint.coordinate,
    target.coordinate
  ));
  if (tail?.status !== 'ok') return tail;
  return movementPlannerMergeAppendedRoute(route, tail);
}

async function movementPlannerAppendRouteTo(targetCoordinate) {
  const route = movementPlannerState.route;
  if (!movementPlannerState.active || route?.status !== 'ok' || !route.path?.length) return;
  const known = await movementPlannerLoadKnowledge();
  const result = movementPlannerFindAppendedRoute(route, targetCoordinate, known);
  if (result.status !== 'ok') {
    movementPlannerSetStatus(result.status === 'not-adjacent'
      ? 'The current endpoint is unrevealed; extend it one adjacent hex at a time.'
      : movementPlannerResultMessage(result));
    return;
  }
  movementPlannerState.route = result;
  movementPlannerRenderCard(result);
  movementPlannerSetStatus(`${movementPlannerRouteMpText(result)} · ${result.steps} commands`);
  draw();
}

async function movementPlannerToggle() {
  if (movementPlannerState.active) {
    movementPlannerReset();
    return;
  }
  if (!state.selected?.coordinate) {
    movementPlannerSetStatus('Select an origin hex first.');
    return;
  }

  const known = await movementPlannerLoadKnowledge();
  const originHex = known.get(state.selected.coordinate);
  if (!MovementPlannerCore.isRevealedLand(originHex)) {
    movementPlannerSetStatus('Select a revealed land hex as the origin.');
    return;
  }

  movementPlannerState.active = true;
  movementPlannerState.origin = {
    coordinate: state.selected.coordinate,
    globalCol: state.selected.globalCol,
    globalRow: state.selected.globalRow
  };
  movementPlannerState.route = null;
  movementPlannerUpdateButton();
  movementPlannerSetStatus(`Origin ${movementPlannerState.origin.coordinate} · click a destination`);

  const card = document.getElementById('movementPlannerCard');
  const title = document.getElementById('movementPlannerTitle');
  const summary = document.getElementById('movementPlannerSummary');
  const routeText = document.getElementById('movementPlannerDirections');
  const note = document.getElementById('movementPlannerNote');
  if (card) card.classList.remove('hidden');
  if (title) title.textContent = `Movement from ${movementPlannerState.origin.coordinate}`;
  if (summary) summary.textContent = 'Click a destination for the lowest-MP known route. Fog destinations include the final move into fog.';
  movementPlannerRenderAllowances(null);
  if (routeText) routeText.textContent = '';
  if (note) note.textContent = 'After a route is shown, hold Shift and click any destination to append a route from its endpoint.';
  draw();
}

function movementPlannerDrawRing(point, color, dashed = false, radiusScale = .78) {
  if (!point) return;
  const p = screenFromBase(baseCenter(point.globalCol, point.globalRow));
  ctx.save();
  hexPath(p.x, p.y, state.scale * radiusScale);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, state.scale * .09);
  ctx.setLineDash(dashed ? [7, 5] : []);
  ctx.stroke();
  ctx.restore();
}

function drawMovementPlannerOverlay() {
  if (!movementPlannerState.active || state.mode !== 'detail') return;
  movementPlannerDrawRing(movementPlannerState.origin, '#f4df72', false, .76);

  const result = movementPlannerState.route;
  if (!result || result.status !== 'ok') return;
  const selectedUnit = typeof savedMovementSelectedUnit === 'function' ? savedMovementSelectedUnit() : null;
  drawRoute(result.path, {
    color: '#8dd7a1',
    certainColor: '#8dd7a1',
    maybeColor: '#e4bb65',
    badWeatherAllowance: MovementPlannerCore.unitMovementProfile(selectedUnit).allowance,
    width: Math.max(2.5, state.scale * .12),
    alpha: .96
  });

  const endpoint = result.path[result.path.length - 1];
  movementPlannerDrawRing(endpoint, endpoint.terrain === 'UNKNOWN' ? '#9ec9db' : '#8dd7a1', endpoint.terrain === 'UNKNOWN', .68);

  for (let i = 1; i < result.path.length; i++) {
    const step = result.path[i];
    const p = screenFromBase(baseCenter(step.globalCol, step.globalRow));
    const unknownCount = Number(step.unknownCumulativeCount || 0);
    const label = unknownCount
      ? `${Number(step.knownCumulativeMp || 0)}+${movementPlannerUnknownMpLabel(unknownCount)}`
      : String(step.cumulativeMp);
    ctx.save();
    ctx.font = `800 ${Math.max(9, Math.min(12, state.scale * .3))}px Segoe UI`;
    const width = ctx.measureText(label).width + 10;
    const height = 18;
    const x = p.x - width / 2;
    const y = p.y + state.scale * .34;
    ctx.fillStyle = 'rgba(7,18,14,.94)';
    ctx.strokeStyle = step.terrain === 'UNKNOWN' ? '#9ec9db' : '#8dd7a1';
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = step.terrain === 'UNKNOWN' ? '#d8edf5' : '#dff7e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2 + .5);
    ctx.restore();
  }
}

draw = function drawWithMovementPlanner() {
  movementPlannerOriginalDraw();
  drawMovementPlannerOverlay();
};

selectHex = async function selectHexWithMovementPlanner(globalCol, globalRow) {
  const coordinate = coordinateFor(globalCol, globalRow);
  if (movementPlannerState.active && movementPlannerState.origin) {
    if (movementPlannerState.shiftHeld && movementPlannerState.route?.status === 'ok') {
      await movementPlannerAppendRouteTo(coordinate);
      return;
    }
    if (coordinate !== movementPlannerState.origin.coordinate) {
      await movementPlannerPlanTo(coordinate);
      return;
    }
  }
  const result = await movementPlannerOriginalSelectHex(globalCol, globalRow);
  movementPlannerUpdateButton();
  return result;
};

function movementPlannerInvalidateForTurn() {
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  if (movementPlannerState.active) {
    movementPlannerState.route = null;
    movementPlannerSetStatus(`Origin ${movementPlannerState.origin?.coordinate || '—'} · turn changed · click a destination`);
    const summary = document.getElementById('movementPlannerSummary');
    const routeText = document.getElementById('movementPlannerDirections');
    if (summary) summary.textContent = 'Turn changed. Click a destination to recalculate using knowledge available on this turn.';
    movementPlannerRenderAllowances(null);
    if (routeText) routeText.textContent = '';
    draw();
  }
}

const movementPlannerButton = document.getElementById('movementPlannerButton');
if (movementPlannerButton) movementPlannerButton.addEventListener('click', movementPlannerToggle);

window.addEventListener('keydown', event => {
  if (event.key === 'Shift') movementPlannerState.shiftHeld = true;
});
window.addEventListener('keyup', event => {
  if (event.key === 'Shift') movementPlannerState.shiftHeld = false;
});
window.addEventListener('blur', () => { movementPlannerState.shiftHeld = false; });
window.addEventListener('storage', event => {
  if (event.key === 'tribenet:selectedResultTurn') movementPlannerInvalidateForTurn();
});

movementPlannerUpdateButton();

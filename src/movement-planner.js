const movementPlannerState = {
  active: false,
  origin: null,
  route: null,
  knownHexes: null,
  knowledgeKey: null,
  loading: false
};

const movementPlannerOriginalDraw = draw;
const movementPlannerOriginalSelectHex = selectHex;

function movementPlannerTurnKey() {
  return (typeof resultsTimeline !== 'undefined' && resultsTimeline.turn?.turnKey)
    ? `results:${resultsTimeline.turn.turnKey}`
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
  button.textContent = movementPlannerState.active ? 'Stop Movement Planner' : 'Plan Movement';
  button.title = movementPlannerState.active
    ? `Planning from ${movementPlannerState.origin?.coordinate || 'selected origin'}`
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

function movementPlannerRenderAllowances(totalMp = null) {
  const host = movementPlannerEnsureAllowancesHost();
  if (!host) return;
  const hasRoute = totalMp != null && Number.isFinite(Number(totalMp));
  const rows = MovementPlannerCore.movementAllowanceSummary(hasRoute ? Number(totalMp) : 0);
  host.innerHTML = rows.map(row => {
    const detail = !hasRoute
      ? `${row.mp} MP available`
      : row.canComplete
        ? `${row.remaining} MP left`
        : `${row.overBy} MP over`;
    const value = hasRoute ? `${row.used}/${row.mp} MP` : `${row.mp} MP`;
    return `
      <div class="movement-mode${hasRoute ? (row.canComplete ? ' within' : ' over') : ''}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    `;
  }).join('');
}

function movementPlannerReset(options = {}) {
  const keepActive = Boolean(options.keepActive);
  movementPlannerState.route = null;
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  movementPlannerState.loading = false;
  if (!keepActive) {
    movementPlannerState.active = false;
    movementPlannerState.origin = null;
  }
  movementPlannerHideCard();
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
  const rows = (typeof resultsTimeline !== 'undefined' && resultsTimeline.turn?.turnKey)
    ? await window.tribenet.getResultHexesInArea(bounds, resultsTimeline.turn.turnKey)
    : await window.tribenet.getHexesInArea(bounds);

  movementPlannerState.knownHexes = MovementPlannerCore.buildKnownHexMap(rows);
  movementPlannerState.knowledgeKey = key;
  return movementPlannerState.knownHexes;
}

function movementPlannerResultMessage(result) {
  if (!result) return 'No route calculated.';
  if (result.status === 'origin-unknown') return 'The origin is not revealed land on this turn.';
  if (result.status === 'target-impassable') return `${result.requestedTarget} is ${result.targetTerrain} and cannot be entered by a land unit.`;
  if (result.status === 'no-revealed-adjacent') return `${result.requestedTarget} is unknown and has no revealed adjacent land hex yet.`;
  if (result.status === 'no-route') {
    return result.targetIsUnknown
      ? `No route through revealed land reaches an adjacent hex of ${result.requestedTarget}.`
      : `No route through revealed land reaches ${result.requestedTarget}.`;
  }
  if (result.status === 'invalid-coordinate') return 'The origin or destination coordinate is invalid.';
  return 'No route available.';
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
    note.textContent = 'Planner only routes through revealed, land-passable terrain.';
    return;
  }

  const destination = result.targetIsUnknown
    ? `${result.requestedTarget} unknown · stop at ${result.actualTarget}`
    : result.actualTarget;
  summary.textContent = `${destination} · ${result.totalMp} MP route · ${result.steps} hex${result.steps === 1 ? '' : 'es'}`;
  movementPlannerRenderAllowances(result.totalMp);
  routeText.textContent = result.directions.length ? result.directions.join(' → ') : 'Already at the best revealed adjacent hex.';
  note.textContent = result.targetIsUnknown
    ? `Fastest route to any revealed adjacent land hex (${result.candidateGoalCount} candidate${result.candidateGoalCount === 1 ? '' : 's'}). Scouts use the same terrain costs but have 8 MP on foot or 15 MP mounted; they return automatically without spending return MP. Base terrain MP only; weather and river/ford/pass modifiers are not yet applied.`
    : 'Scouts use the same terrain costs but have 8 MP on foot or 15 MP mounted; they return automatically without spending return MP. Base terrain MP only; weather and river/ford/pass modifiers are not yet applied.';
}

async function movementPlannerPlanTo(targetCoordinate) {
  if (!movementPlannerState.active || !movementPlannerState.origin) return;
  movementPlannerState.loading = true;
  movementPlannerSetStatus('Calculating route…');
  try {
    const known = await movementPlannerLoadKnowledge();
    const result = MovementPlannerCore.findFastestRoute(
      known,
      movementPlannerState.origin.coordinate,
      targetCoordinate
    );
    movementPlannerState.route = result;
    movementPlannerRenderCard(result);
    if (result.status === 'ok') {
      movementPlannerSetStatus(`${result.totalMp} MP${result.targetIsUnknown ? ` · adjacent to ${result.requestedTarget}` : ''}`);
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
  if (summary) summary.textContent = 'Click another hex to find the lowest-MP route.';
  movementPlannerRenderAllowances(null);
  if (routeText) routeText.textContent = '';
  if (note) note.textContent = 'Unknown destinations route to the cheapest revealed adjacent land hex.';
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

function movementPlannerDrawUnknownConnector(actualTarget, requestedTarget) {
  const actual = MovementPlannerCore.parseCoordinate(actualTarget);
  const requested = MovementPlannerCore.parseCoordinate(requestedTarget);
  if (!actual || !requested || actual.coordinate === requested.coordinate) return;
  const a = screenFromBase(baseCenter(actual.globalCol, actual.globalRow));
  const b = screenFromBase(baseCenter(requested.globalCol, requested.globalRow));
  ctx.save();
  ctx.strokeStyle = '#9ec9db';
  ctx.globalAlpha = .72;
  ctx.lineWidth = Math.max(1.5, state.scale * .055);
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawMovementPlannerOverlay() {
  if (!movementPlannerState.active || state.mode !== 'detail') return;
  movementPlannerDrawRing(movementPlannerState.origin, '#f4df72', false, .76);

  const result = movementPlannerState.route;
  if (!result || result.status !== 'ok') return;
  drawRoute(result.path, { color: '#8dd7a1', width: Math.max(2.5, state.scale * .12), alpha: .96 });

  const endpoint = result.path[result.path.length - 1];
  movementPlannerDrawRing(endpoint, '#8dd7a1', false, .68);

  if (result.targetIsUnknown) {
    const requested = MovementPlannerCore.parseCoordinate(result.requestedTarget);
    movementPlannerDrawRing(requested, '#9ec9db', true, .72);
    movementPlannerDrawUnknownConnector(result.actualTarget, result.requestedTarget);
  }

  for (let i = 1; i < result.path.length; i++) {
    const step = result.path[i];
    const p = screenFromBase(baseCenter(step.globalCol, step.globalRow));
    const label = String(step.cumulativeMp);
    ctx.save();
    ctx.font = `800 ${Math.max(9, Math.min(12, state.scale * .3))}px Segoe UI`;
    const width = ctx.measureText(label).width + 10;
    const height = 18;
    const x = p.x - width / 2;
    const y = p.y + state.scale * .34;
    ctx.fillStyle = 'rgba(7,18,14,.94)';
    ctx.strokeStyle = '#8dd7a1';
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dff7e6';
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
  if (movementPlannerState.active && movementPlannerState.origin && coordinate !== movementPlannerState.origin.coordinate) {
    await movementPlannerPlanTo(coordinate);
    return;
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

window.addEventListener('storage', event => {
  if (event.key === 'tribenet:selectedResultTurn') movementPlannerInvalidateForTurn();
});

movementPlannerUpdateButton();

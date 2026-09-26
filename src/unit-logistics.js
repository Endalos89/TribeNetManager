// Unit logistics interactions are layered on top of the mapper so the core hex renderer stays focused.
// This script is loaded after renderer.js and shares its global lexical scope.

function logisticsNumber(value, maximumFractionDigits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits });
}

function logisticsProvisionTurns(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 10) return `${n.toFixed(1)} turns`;
  if (n >= 1) return `${n.toFixed(2)} turns`;
  return `${n.toFixed(2)} turns`;
}

function logisticsStatsForUnit(unit) {
  return (state.planImport?.plan?.unitStats || []).find(row => String(row.unit) === String(unit)) || null;
}

function plannerLabelHitboxes() {
  if (!state.planningVisible || !state.planImport?.plan || !state.routeCache || state.mode !== 'detail') return [];
  const hits = [];
  const labelSlots = new Map();

  const add = (point, unit, type, offsetIndex = 0, extra = '') => {
    if (!point) return;
    const p = screenFromBase(baseCenter(point.globalCol, point.globalRow));
    const text = `${type === 'Element' ? 'E' : type === 'Tribe' ? 'T' : 'U'} ${unit}${extra ? ` ${extra}` : ''}`;
    ctx.save();
    ctx.font = `700 ${Math.max(9, Math.min(12, state.scale * .32))}px Segoe UI`;
    const w = ctx.measureText(text).width + 12;
    ctx.restore();
    const h = 19;
    const x = p.x - w / 2;
    const y = p.y - state.scale * .78 - offsetIndex * (h + 3);
    hits.push({ x, y, w, h, unit, type, point, text });
  };

  for (const movement of state.routeCache.movements || []) {
    const start = movement.route?.points?.[0];
    const end = movement.route?.points?.[movement.route.points.length - 1];
    if (!start) continue;
    const key = start.coordinate;
    const slot = labelSlots.get(key) || 0;
    add(start, movement.unit, movement.type, slot, 'start');
    labelSlots.set(key, slot + 1);
    if (end && end.coordinate !== start.coordinate) add(end, movement.unit, movement.type, 0, '→');
  }
  return hits;
}

function plannerUnitLabelAt(x, y) {
  const hits = plannerLabelHitboxes();
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) return hit;
  }
  return null;
}

function showUnitLogistics(unit) {
  const stats = logisticsStatsForUnit(unit);
  const unitRecord = (state.planImport?.plan?.units || []).find(row => String(row.unit) === String(unit));
  const movement = (state.planImport?.plan?.movements || []).find(row => String(row.unit) === String(unit));
  const fallbackType = stats?.type || unitRecord?.type || movement?.type || 'Unit';
  const fallbackName = stats?.unitName || unitRecord?.unitName || movement?.unitName || '';

  state.selectedUnit = String(unit);
  state.selected = null;
  $('selectionEditor').classList.add('hidden');
  $('noSelection').classList.add('hidden');
  $('unitEditor').classList.remove('hidden');

  $('selectedUnitCode').textContent = unit;
  $('selectedUnitType').textContent = fallbackType;
  $('selectedUnitName').textContent = fallbackName || '';
  $('unitTurnContext').textContent = state.planImport?.turnKey ? `Turn ${state.planImport.turnKey} · movement-time estimate` : 'Movement-time estimate';

  const warningsHost = $('unitWarnings');
  const warningSection = $('unitWarningsSection');
  const inventoryHost = $('unitInventoryList');
  warningsHost.innerHTML = '';
  inventoryHost.innerHTML = '';

  if (!stats) {
    $('unitProvisions').textContent = '—';
    $('unitProvisionTurns').textContent = '—';
    $('unitEaters').textContent = '—';
    $('unitPeople').textContent = '—';
    $('unitLoadPercent').textContent = '—';
    $('unitLoadText').textContent = 'Re-import this turn workbook to calculate logistics.';
    $('unitTransportText').textContent = 'This turn was imported by an older app version and does not contain calculated unit statistics.';
    $('unitCapacityFill').style.width = '0%';
    $('unitCapacityFill').className = 'capacity-fill';
    warningSection.classList.add('hidden');
    inventoryHost.innerHTML = '<div class="history-empty">No calculated inventory for this stored import.</div>';
    $('unitCalculationBasis').textContent = '';
    return;
  }

  $('unitProvisions').textContent = logisticsNumber(stats.provs);
  $('unitProvisionTurns').textContent = logisticsProvisionTurns(stats.provisionTurns);
  $('unitEaters').textContent = logisticsNumber(stats.eaters);
  $('unitPeople').textContent = logisticsNumber(stats.totalPeople);

  const pct = Number(stats.loadPercent);
  const finitePct = Number.isFinite(pct) ? pct : 0;
  $('unitLoadPercent').textContent = Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—';
  $('unitLoadText').textContent = `${logisticsNumber(stats.carriedWeight)} lb / ${logisticsNumber(stats.carryingCapacity)} lb`;
  const fill = $('unitCapacityFill');
  fill.style.width = `${Math.max(0, Math.min(100, finitePct))}%`;
  fill.className = `capacity-fill${finitePct > 100 ? ' over' : finitePct >= 85 ? ' warning' : ''}`;

  const transport = [];
  if (stats.wagonCount) transport.push(`${logisticsNumber(stats.wagonCount)} wagon${stats.wagonCount === 1 ? '' : 's'}`);
  if (stats.cattlePulling || stats.horsePulling) {
    transport.push(`${logisticsNumber(stats.cattlePulling)} cattle + ${logisticsNumber(stats.horsePulling)} horses pulling`);
  }
  const packHorses = Math.max(0, Number(stats.horseCount || 0) - Number(stats.horsePulling || 0) - (stats.fullyMounted ? Number(stats.totalPeople || 0) : 0));
  if (stats.fullyMounted) transport.push(`fully mounted (${logisticsNumber(stats.totalPeople)} ridden horses)`);
  if (packHorses) transport.push(`${logisticsNumber(packHorses)} pack horse${packHorses === 1 ? '' : 's'}`);
  if (stats.backpacksUsed) transport.push(`${logisticsNumber(stats.backpacksUsed)} backpack${stats.backpacksUsed === 1 ? '' : 's'} in use`);
  if (stats.saddlebagsUsed) transport.push(`${logisticsNumber(stats.saddlebagsUsed)} saddlebag${stats.saddlebagsUsed === 1 ? '' : 's'} in use`);
  $('unitTransportText').textContent = transport.join(' · ') || 'No transport capacity recorded.';

  const warnings = Array.isArray(stats.warnings) ? stats.warnings : [];
  warningSection.classList.toggle('hidden', warnings.length === 0);
  for (const warning of warnings) {
    const div = document.createElement('div');
    div.className = 'unit-warning';
    div.textContent = warning;
    warningsHost.appendChild(div);
  }

  const inventory = (stats.inventory || []).filter(row => row.quantity).slice(0, 8);
  if (!inventory.length) {
    inventoryHost.innerHTML = '<div class="history-empty">No carried goods found.</div>';
  } else {
    for (const row of inventory) {
      const div = document.createElement('div');
      div.className = 'inventory-row';
      const weightText = Number.isFinite(Number(row.totalWeight)) ? `${logisticsNumber(row.totalWeight)} lb` : 'weight ?';
      div.innerHTML = `<span>${escapeHtml(row.item)} × ${escapeHtml(logisticsNumber(row.quantity))}</span><span>${escapeHtml(weightText)}</span>`;
      inventoryHost.appendChild(div);
    }
  }

  $('unitCalculationBasis').textContent = stats.calculationBasis || '';
}

// Intercept a simple click on a drawn Tribe/Element label before the ordinary hex click handler runs.
window.addEventListener('mouseup', event => {
  if (!state.dragging || state.mode !== 'detail' || !state.planningVisible) return;
  const moved = state.dragStart ? Math.hypot(event.clientX - state.dragStart.x, event.clientY - state.dragStart.y) : Infinity;
  if (moved >= 5) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = plannerUnitLabelAt(x, y);
  if (!hit) return;

  state.dragging = false;
  canvas.classList.remove('dragging');
  showUnitLogistics(hit.unit);
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

// If a different stored turn is loaded, refresh or dismiss the open unit panel.
$('turnSelect').addEventListener('change', () => {
  setTimeout(() => {
    if (!state.selectedUnit) return;
    const exists = (state.planImport?.plan?.units || []).some(row => String(row.unit) === String(state.selectedUnit)) ||
      (state.planImport?.plan?.movements || []).some(row => String(row.unit) === String(state.selectedUnit));
    if (exists) showUnitLogistics(state.selectedUnit);
    else {
      state.selectedUnit = null;
      $('unitEditor').classList.add('hidden');
      if (!state.selected) $('noSelection').classList.remove('hidden');
    }
  }, 0);
});

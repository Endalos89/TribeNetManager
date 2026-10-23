// Planned units are turn-scoped and originate from the parent Tribe's beginning-of-turn hex.
// This layer adds those virtual units to the existing Movement Planner without changing imported workbook data.

savedMovementPlansState.unitSplits = [];

const plannedSplitOriginalSavedMovementUnits = savedMovementUnits;
savedMovementUnits = function savedMovementUnitsWithPlannedSplits() {
  const base = plannedSplitOriginalSavedMovementUnits();
  const byCode = new Map(base.map(unit => [String(unit.unitCode).toLowerCase(), unit]));

  for (const split of savedMovementPlansState.unitSplits || []) {
    const key = String(split.unitCode || '').toLowerCase();
    if (!key || !parseCoordinate(split.startHex)) continue;
    const existing = byCode.get(key);
    if (existing && !existing.plannedSplit) continue;
    byCode.set(key, {
      ...(existing || {}),
      unitCode: split.unitCode,
      unitType: split.unitType,
      unitName: split.unitName || '',
      currentHex: plannedSplitMapHex(split),
      startHex: split.startHex,
      parentUnit: split.parentUnit,
      creationPhase: split.creationPhase === 'after' ? 'after' : 'before',
      plannedSplit: true,
      splitId: split.id
    });
  }

  return [...byCode.values()].sort((a, b) =>
    savedMovementCompareUnits(a, b)
  );
};

const plannedSplitOriginalSavedMovementRefresh = savedMovementRefresh;
savedMovementRefresh = async function savedMovementRefreshWithPlannedSplits() {
  const turnKey = savedMovementCurrentTurnKey();
  try {
    savedMovementPlansState.unitSplits = turnKey
      ? await window.tribenet.listPlannedUnitSplits(turnKey)
      : [];
  } catch (error) {
    console.error('Could not load planned unit splits', error);
    savedMovementPlansState.unitSplits = [];
  }
  const refreshed = await plannedSplitOriginalSavedMovementRefresh();
  if (typeof turnActionsRenderUnitCreationOverviewButton === 'function') turnActionsRenderUnitCreationOverviewButton();
  return refreshed;
};

const plannedSplitOriginalPopulateUnits = savedMovementPopulateUnits;
savedMovementPopulateUnits = function savedMovementPopulateUnitsWithSplitHints() {
  plannedSplitOriginalPopulateUnits();
  const selected = savedMovementSelectedUnit();
  const hint = document.getElementById('movementPlannerOriginHint');
  if (selected?.plannedSplit && hint && savedMovementPlansState.routeType === 'unit') {
    hint.textContent = `${selected.unitCode} · planned ${selected.unitType} split from ${selected.parentUnit} · ${selected.creationPhase === 'after' ? `created after movement at ${selected.currentHex}` : `starts before movement at ${selected.startHex}`}`;
  }
};

function plannedSplitDrawStartingUnits() {
  if (state.mode !== 'detail' || !state.planningVisible) return;
  const slots = new Map();
  for (const split of savedMovementPlansState.unitSplits || []) {
    const point = parseCoordinate(plannedSplitMapHex(split));
    if (!point) continue;
    const key = point.coordinate;
    const slot = slots.get(key) || 0;
    drawUnitLabel(point, split.unitCode, split.unitType, slot, 'new');
    slots.set(key, slot + 1);
  }
}

function plannedSplitMapHex(split) {
  if (split?.creationPhase !== 'after') return split?.startHex || null;
  const parent = plannedSplitOriginalSavedMovementUnits().find(unit => String(unit.unitCode).toLowerCase() === String(split.parentUnit).toLowerCase());
  return savedMovementUnitMoveDestination(split.parentUnit) || parent?.currentHex || split.startHex || null;
}

const plannedSplitOriginalDraw = draw;
draw = function drawWithPlannedUnitSplits() {
  plannedSplitOriginalDraw();
  plannedSplitDrawStartingUnits();
};

savedMovementRefresh().catch(error => console.error('Could not refresh planned split units', error));

// Planned Tribe/Element splits are turn-scoped and originate from the parent Tribe's beginning-of-turn hex.
// This layer adds those virtual units to the existing Movement Planner without changing imported workbook data.

savedMovementPlansState.unitSplits = [];

const plannedSplitOriginalSavedMovementUnits = savedMovementUnits;
savedMovementUnits = function savedMovementUnitsWithPlannedSplits() {
  const base = plannedSplitOriginalSavedMovementUnits();
  const byCode = new Map(base.map(unit => [String(unit.unitCode).toLowerCase(), unit]));

  for (const split of savedMovementPlansState.unitSplits || []) {
    const key = String(split.unitCode || '').toLowerCase();
    if (!key || byCode.has(key) || !parseCoordinate(split.startHex)) continue;
    byCode.set(key, {
      unitCode: split.unitCode,
      unitType: split.unitType,
      unitName: split.unitName || '',
      currentHex: split.startHex,
      startHex: split.startHex,
      parentUnit: split.parentUnit,
      plannedSplit: true
    });
  }

  const order = { Tribe: 0, Element: 1, Fleet: 2, Garrison: 3, Courier: 4 };
  return [...byCode.values()].sort((a, b) =>
    (order[a.unitType] ?? 9) - (order[b.unitType] ?? 9)
    || String(a.unitCode).localeCompare(String(b.unitCode), undefined, { numeric: true })
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
  return plannedSplitOriginalSavedMovementRefresh();
};

const plannedSplitOriginalPopulateUnits = savedMovementPopulateUnits;
savedMovementPopulateUnits = function savedMovementPopulateUnitsWithSplitHints() {
  plannedSplitOriginalPopulateUnits();
  const selected = savedMovementSelectedUnit();
  const hint = document.getElementById('movementPlannerOriginHint');
  if (selected?.plannedSplit && hint && savedMovementPlansState.routeType === 'unit') {
    hint.textContent = `${selected.unitCode} · planned ${selected.unitType} split from ${selected.parentUnit} · starts at ${selected.startHex} (parent Tribe's beginning-of-turn location)`;
  }
};

savedMovementRefresh().catch(error => console.error('Could not refresh planned split units', error));

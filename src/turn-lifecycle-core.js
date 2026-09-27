const TurnLifecycleCore = (() => {
  const DIRECTIONS = new Set(['N', 'NE', 'SE', 'S', 'SW', 'NW']);

  function planningTurnKey(resultTurn) {
    const explicit = String(resultTurn?.metadata?.nextTurn || '').trim();
    if (explicit) return explicit;
    const current = String(resultTurn?.turnKey || '').trim();
    const match = current.match(/^(\d+)([-_])(\d+)$/);
    if (!match) return current || null;
    const nextPart = String(Number(match[3]) + 1).padStart(match[3].length, '0');
    return `${match[1]}${match[2]}${nextPart}`;
  }

  function planningTimelineEntry(resultTurns) {
    const actualTurns = (resultTurns || [])
      .filter(row => row?.turnKey && !row.isPlanningTurn)
      .sort((a, b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
    const latest = actualTurns[actualTurns.length - 1];
    if (!latest) return null;
    const nextTurn = planningTurnKey(latest);
    if (!nextTurn || actualTurns.some(row => String(row.turnKey) === String(nextTurn))) return null;
    return {
      turnKey: nextTurn,
      turnSort: Number(latest.turnSort || 0) + 0.5,
      sourceFile: `Planning baseline from Turn ${latest.turnKey}`,
      importedAt: latest.importedAt || null,
      metadata: { ...(latest.metadata || {}), baselineTurn: latest.turnKey, planningTurn: nextTurn },
      isPlanningTurn: true,
      baselineTurnKey: latest.turnKey,
      baselineTurnSort: Number(latest.turnSort || 0),
      baselineSourceFile: latest.sourceFile || null
    };
  }

  function actualDirections(rawText) {
    const text = String(rawText || '').split(/Not enough M\.P'?s/i)[0];
    const directions = [];
    const re = /(?:^|[,\\\s])(?:Move\s+)?(N|NE|SE|S|SW|NW)-[A-Za-z]+/gi;
    let match;
    while ((match = re.exec(text))) {
      const direction = String(match[1] || '').toUpperCase();
      if (DIRECTIONS.has(direction)) directions.push(direction);
    }
    return directions;
  }

  function actualPlanFromResult(resultTurn) {
    if (!resultTurn?.turnKey) return null;
    const units = [];
    const movements = [];
    const scouts = [];
    let hasActualRoutes = false;

    for (const unit of resultTurn.units || []) {
      const unitCode = String(unit.unitCode || '').trim();
      if (!unitCode) continue;
      const unitType = unit.unitType || 'Unit';
      units.push({ unit: unitCode, unitName: unit.unitName || null, type: unitType, startHex: unit.currentHex || unit.previousHex || null });

      const movementOrders = actualDirections(unit.movement);
      if (unit.movement != null || (unit.scouts || []).length) {
        movements.push({ unit: unitCode, unitName: unit.unitName || null, type: unitType, startHex: unit.previousHex || unit.currentHex || null, orders: movementOrders, actualResult: true });
        if (movementOrders.length) hasActualRoutes = true;
      }

      for (const scout of unit.scouts || []) {
        const orders = actualDirections(scout.raw || scout.report);
        scouts.push({ id: Number(scout.id || scouts.length + 1), unit: unitCode, unitName: unit.unitName || null, noOfScouts: Number(scout.noOfScouts || 0), noOfHorses: Number(scout.noOfHorses || 0), mission: scout.mission || 'ACTUAL', orders, actualResult: true, report: scout.report || scout.raw || '' });
        if (orders.length || scout.report || scout.raw) hasActualRoutes = true;
      }
    }

    return { formatVersion: 2, turnKey: resultTurn.turnKey, sourceFile: resultTurn.sourceFile || `Turn ${resultTurn.turnKey} Results`, importedAt: resultTurn.importedAt || null, units, movements, scouts, unitCreations: [], transfers: [], activities: [], actualResult: true, hasActualRoutes };
  }

  return { planningTurnKey, planningTimelineEntry, actualDirections, actualPlanFromResult };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TurnLifecycleCore;

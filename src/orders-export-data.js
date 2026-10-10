function exportUnitKey(value) {
  return String(value || '').trim().toLowerCase();
}

function exportRouteKey(route) {
  const type = route?.routeType === 'scout' ? 'scout' : 'unit';
  const unit = exportUnitKey(route?.unitCode);
  if (type === 'unit') return `${type}:${unit}`;
  return `${type}:${unit}:${route?.scoutNumber ?? route?.id ?? ''}`;
}

function mergeDraftRoutes(routeGroups = []) {
  const merged = [];
  const seen = new Set();
  for (const group of routeGroups) {
    for (const route of group || []) {
      if (!route?.unitCode) continue;
      const key = exportRouteKey(route);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(route);
    }
  }
  return merged;
}

function mergeDraftSplits(splitGroups = []) {
  const merged = [];
  const seen = new Set();
  for (const group of splitGroups) {
    for (const split of group || []) {
      if (!split?.unitCode) continue;
      const key = exportUnitKey(split.unitCode);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(split);
    }
  }
  return merged;
}

function buildOrdersExportData({ baselineUnits = [], routeGroups = [], splitGroups = [] } = {}) {
  const unitsByCode = new Map();
  for (const unit of baselineUnits || []) {
    const unitCode = String(unit?.unit || unit?.unitCode || '').trim();
    if (!unitCode) continue;
    unitsByCode.set(exportUnitKey(unitCode), {
      unitCode,
      unitType: unit.type || unit.unitType || 'Unit',
      unitName: unit.unitName || '',
      currentHex: unit.startHex || unit.currentHex || null
    });
  }

  const splits = mergeDraftSplits(splitGroups);
  for (const split of splits) {
    unitsByCode.set(exportUnitKey(split.unitCode), {
      unitCode: split.unitCode,
      unitType: split.unitType,
      unitName: split.unitName || '',
      currentHex: split.startHex,
      parentUnit: split.parentUnit,
      plannedSplit: true
    });
  }

  const routes = mergeDraftRoutes(routeGroups);
  for (const route of routes) {
    if (route.routeType === 'unit' && !unitsByCode.has(exportUnitKey(route.unitCode))) {
      unitsByCode.set(exportUnitKey(route.unitCode), {
        unitCode: route.unitCode,
        unitType: 'Unit',
        unitName: '',
        currentHex: route.originHex
      });
    }
  }

  const units = [...unitsByCode.values()].sort((a, b) => String(a.unitCode).localeCompare(String(b.unitCode), undefined, { numeric: true }));
  const unitTypeByCode = new Map(units.map(unit => [exportUnitKey(unit.unitCode), String(unit.unitType || '')]));
  const unitRoutes = new Map(routes
    .filter(route => route.routeType === 'unit' && unitTypeByCode.get(exportUnitKey(route.unitCode))?.toLowerCase() !== 'garrison')
    .map(route => [exportUnitKey(route.unitCode), route]));
  const movements = units
    .filter(unit => String(unit.unitType || '').toLowerCase() !== 'garrison')
    .map(unit => ({
      unitCode: unit.unitCode,
      unitName: unit.unitName || '',
      directions: unitRoutes.get(exportUnitKey(unit.unitCode))?.directions?.length
        ? unitRoutes.get(exportUnitKey(unit.unitCode)).directions
        : ['Still']
    }));
  const scouts = routes
    .filter(route => route.routeType === 'scout')
    .map(route => ({
      unitCode: route.unitCode,
      scoutNumber: route.scoutNumber,
      noOfScouts: route.noOfScouts || 1,
      noOfHorses: route.noOfHorses || 0,
      mission: route.mission || 'PATROL',
      directions: route.directions
    }));
  const gmActions = [];
  for (const split of splits.sort((a, b) => String(a.unitCode).localeCompare(String(b.unitCode), undefined, { numeric: true }))) {
    const moved = unitRoutes.has(exportUnitKey(split.unitCode));
    gmActions.push({
      unit: split.parentUnit,
      text: `Create ${split.unitType} ${split.unitCode} from ${split.parentUnit}${moved ? '' : ' after movement'}`
    });
    if (split.unitType === 'Tribe') {
      for (const skill of split.skills || []) {
        gmActions.push({
          unit: split.unitCode,
          text: `Skill ${skill.skill} ${skill.level} should be moved from Tribe ${String(split.parentUnit).slice(0, 4)} to Tribe ${split.unitCode}`
        });
      }
    }
  }
  return {
    movements,
    scouts,
    gmActions,
    validUnits: units.map(unit => ({ unitCode: unit.unitCode, unitName: unit.unitName || '' }))
  };
}

module.exports = { buildOrdersExportData, mergeDraftRoutes, mergeDraftSplits };

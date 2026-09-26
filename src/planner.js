const path = require('path');
const XLSX = require('xlsx');

function sheetRecords(workbook, name, headerRow = 0) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, range: headerRow });
}

function clean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

function cleanUnit(value) {
  const v = clean(value);
  return v === null ? null : String(v).trim();
}

function normalizeHex(value) {
  const v = clean(value);
  if (!v) return null;
  const compact = String(v).toUpperCase().replace(/\s+/g, '');
  const m = compact.match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!m) return String(v).toUpperCase();
  return `${m[1]}${m[2]}${m[3]}${m[4]}`;
}

function collectMovement(row, prefix, count) {
  const orders = [];
  for (let i = 1; i <= count; i++) {
    const raw = clean(row[`${prefix}${i}`] ?? row[`${prefix}_${i}`]);
    if (!raw) continue;
    const value = String(raw).trim().toUpperCase();
    if (value === 'EMPTY') continue;
    orders.push(value);
  }
  return orders;
}

function inferTurnKey(filename) {
  const base = path.basename(filename, path.extname(filename));
  const patterns = [
    /(?:^|_)(\d{3})[_-](\d{1,2})(?:_|$)/,
    /(?:^|\s)(\d{3})[-_](\d{1,2})(?:\s|$)/
  ];
  for (const pattern of patterns) {
    const m = base.match(pattern);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return base;
}

function parseCreation(text, unitHint = null) {
  const s = String(text || '');
  const m = s.match(/create\s+(tribe|element|fleet|garrison|courier)\s+([0-9]{4}(?:[a-z]\d+)?)\s+from\s+(?:tribe|element|fleet|garrison|courier)?\s*([0-9]{4}(?:[a-z]\d+)?)/i);
  if (!m) return null;
  return {
    type: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(),
    unit: m[2],
    parentUnit: m[3],
    source: unitHint || null,
    text: s
  };
}

function unitType(unit) {
  const s = String(unit || '').toLowerCase();
  if (/^\d{4}$/.test(s)) return 'Tribe';
  if (/^\d{4}e\d+$/.test(s)) return 'Element';
  if (/^\d{4}f\d+$/.test(s)) return 'Fleet';
  if (/^\d{4}g\d+$/.test(s)) return 'Garrison';
  if (/^\d{4}c\d+$/.test(s)) return 'Courier';
  return 'Unit';
}

function parseOrdersWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellFormula: true });
  const sourceFile = path.basename(filePath);
  const turnKey = inferTurnKey(sourceFile);

  const clan = sheetRecords(workbook, 'Clan')
    .filter(r => cleanUnit(r.Unit) && String(r.Unit).toLowerCase() !== 'totals')
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.Unit), gt: cleanUnit(r.GT),
      warrior: Number(r.Warrior || 0), active: Number(r.Active || 0), inactive: Number(r.Inactive || 0),
      eaters: Number(r.Eaters || 0), provs: Number(r.Provs || 0), months: Number(r.Months || 0),
      cattle: Number(r.Cattle || 0), goat: Number(r.Goat || 0), horse: Number(r.Horse || 0), camel: Number(r.Camel || 0),
      type: unitType(r.Unit)
    }));

  const gmActions = sheetRecords(workbook, 'GM Actions')
    .filter(r => cleanUnit(r.Unit) && clean(r['What does the GM need to do?']))
    .map(r => ({ unit: cleanUnit(r.Unit), text: String(r['What does the GM need to do?']).trim() }));

  // Auto-GM has a descriptive first row; its actual headings are on row 2.
  const autoGm = sheetRecords(workbook, 'Auto-GM', 1)
    .filter(r => clean(r.From_Unit) || clean(r.Action) || clean(r.To_Unit))
    .map(r => ({
      fromUnit: cleanUnit(r.From_Unit), action: clean(r.Action), timing: clean(r.Timing),
      toUnit: cleanUnit(r.To_Unit), newUnitDirection: clean(r.NewUnitDirection)
    }));

  const unitCreations = gmActions.map(a => parseCreation(a.text, a.unit)).filter(Boolean);
  for (const row of autoGm) {
    if (String(row.action || '').toLowerCase().includes('create') && row.toUnit) {
      unitCreations.push({
        type: unitType(row.toUnit), unit: row.toUnit, parentUnit: row.fromUnit,
        source: 'Auto-GM', direction: row.newUnitDirection || null,
        text: `${row.action}: ${row.fromUnit || '?'} -> ${row.toUnit}`
      });
    }
  }

  const movements = sheetRecords(workbook, 'Tribe_Movement')
    .filter(r => cleanUnit(r.TRIBE) && normalizeHex(r.Hex))
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE), type: unitType(r.TRIBE),
      followTribe: cleanUnit(r.FOLLOW_TRIBE), movementType: clean(r.MovementType),
      startHex: normalizeHex(r.Hex), orders: collectMovement(r, 'MOVEMENT_', 40), processed: clean(r.Processed)
    }));

  const scouts = sheetRecords(workbook, 'Scout_Movement')
    .filter(r => cleanUnit(r.TRIBE) && Number(r.No_of_Scouts || 0) > 0)
    .map((r, index) => ({
      id: index + 1, unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE),
      noOfScouts: Number(r.No_of_Scouts || 0), noOfHorses: Number(r.No_of_Horses || 0),
      mission: clean(r.Mission) || 'PATROL', orders: collectMovement(r, 'Movement', 9), processed: clean(r.Processed)
    }));

  const transfers = sheetRecords(workbook, 'Transfers')
    .filter(r => cleanUnit(r.From) && cleanUnit(r.To) && clean(r.Item))
    .map(r => ({
      from: cleanUnit(r.From), to: cleanUnit(r.To), item: clean(r.Item),
      quantity: Number(r.Quantity || 0), timing: clean(r.Transfer_Timing), notes: clean(r.Notes), description: clean(r['Description of Transfer units'])
    }));

  const activities = sheetRecords(workbook, 'Tribes_Activities')
    .filter(r => cleanUnit(r.TRIBE) && clean(r.ACTIVITY))
    .map(r => ({
      unitName: clean(r.UnitName), unit: cleanUnit(r.TRIBE), activity: clean(r.ACTIVITY),
      item: clean(r.ITEM), distinction: clean(r.DISTINCTION), people: Number(r.PEOPLE || 0),
      miningDirection: clean(r.MINING_DIRECTION)
    }));

  const unitsById = new Map();
  for (const u of clan) unitsById.set(u.unit, { unit: u.unit, unitName: u.unitName, type: u.type });
  for (const m of movements) unitsById.set(m.unit, { ...(unitsById.get(m.unit) || {}), unit: m.unit, unitName: m.unitName, type: m.type, startHex: m.startHex });
  for (const c of unitCreations) unitsById.set(c.unit, { ...(unitsById.get(c.unit) || {}), unit: c.unit, type: c.type, parentUnit: c.parentUnit });

  return {
    formatVersion: 1,
    turnKey,
    sourceFile,
    importedAt: new Date().toISOString(),
    clan,
    units: Array.from(unitsById.values()),
    unitCreations,
    gmActions,
    autoGm,
    transfers,
    activities,
    movements,
    scouts
  };
}

module.exports = { parseOrdersWorkbook };

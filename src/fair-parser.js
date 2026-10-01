const path = require('path');
const XLSX = require('xlsx');

function canonical(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function parseTurnKey(value) {
  const match = String(value || '').match(/(\d{3,4})\D+(\d{1,2})/);
  if (!match) return null;
  return { year:Number(match[1]), month:Number(match[2]), turnKey:`${match[1]}-${String(Number(match[2])).padStart(2, '0')}` };
}

function assertFairTurn(turnKey) {
  const parsed = parseTurnKey(turnKey);
  if (!parsed) throw new Error(`Could not identify the Fair turn from "${turnKey}".`);
  if (![4, 10].includes(parsed.month)) throw new Error(`Turn ${parsed.turnKey} is not a Fair month. Fair workbooks are expected in Months 04 and 10.`);
  return parsed;
}

function compactSheetRows(sheet) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, raw:true, defval:null });
  const nonEmpty = rows.filter(row => Array.isArray(row) && row.some(cell => cell != null && String(cell).trim() !== ''));
  let maxColumn = 0;
  for (const row of nonEmpty) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index] != null && String(row[index]).trim() !== '') {
        maxColumn = Math.max(maxColumn, index + 1);
        break;
      }
    }
  }
  return nonEmpty.map(row => row.slice(0, maxColumn).map(value => value == null ? '' : value));
}

function parseSupplementalSheets(input) {
  const workbook = typeof input === 'string'
    ? XLSX.readFile(input, { cellDates:false, raw:true })
    : input;
  if (!workbook?.Sheets) return {};
  const mappings = [
    ['culturalActivities', 'Cultural Activities'],
    ['researchSpecials', 'Research and Specials']
  ];
  const result = {};
  for (const [key, sheetName] of mappings) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    result[key] = { name:sheetName, rows:compactSheetRows(sheet) };
  }
  return result;
}

function parseFairWorkbook(filePath, requestedTurnKey = null) {
  const workbook = XLSX.readFile(filePath, { cellDates:false, raw:true });
  const sheet = workbook.Sheets['Exchange List'];
  if (!sheet) throw new Error('The workbook does not contain the expected "Exchange List" sheet.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, raw:true, defval:null });
  const inferred = parseTurnKey(requestedTurnKey) || parseTurnKey(path.basename(filePath));
  if (!inferred) throw new Error('Select a Fair planning turn (Month 04 or 10) before importing this workbook.');
  const fairTurn = assertFairTurn(inferred.turnKey);

  const workbookYear = numberOrNull(rows?.[0]?.[0]);
  if (workbookYear != null && Number(workbookYear) !== fairTurn.year) {
    throw new Error(`This workbook is for Year ${workbookYear}, but the selected Fair is ${fairTurn.turnKey}.`);
  }

  const maximumRow = rows.find(row => canonical(row?.[0]) === 'MAXIMUM TRANSACTIONS');
  const maxTransactions = Math.max(1, Math.floor(numberOrNull(maximumRow?.[1]) || 10));
  const headerIndex = rows.findIndex(row => canonical(row?.[0]) === 'BUY ITEMS' && canonical(row?.[7]) === 'SELL ITEMS');
  if (headerIndex < 0) throw new Error('Could not find the Clan → Fair / Fair → Clan item table in Exchange List.');

  const items = [];
  const warnings = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const leftName = String(row?.[0] || '').trim();
    const rightName = String(row?.[7] || '').trim();
    if (!leftName && !rightName) continue;
    const name = leftName || rightName;
    if (leftName && rightName && canonical(leftName) !== canonical(rightName)) {
      warnings.push(`Row item names differ: "${leftName}" / "${rightName}".`);
    }
    items.push({
      name,
      status:String(row?.[1] || row?.[8] || '').trim(),
      sellPrice:numberOrNull(row?.[2]),
      sellQuantityLimit:numberOrNull(row?.[3]),
      purchasePrice:numberOrNull(row?.[9]),
      purchaseQuantityLimit:numberOrNull(row?.[10])
    });
  }

  if (!items.length) throw new Error('No Fair items were found in Exchange List.');
  return {
    turnKey:fairTurn.turnKey,
    turnSort:fairTurn.year * 100 + fairTurn.month,
    year:fairTurn.year,
    month:fairTurn.month,
    sourceFile:path.basename(filePath),
    importedAt:new Date().toISOString(),
    maxTransactions,
    warnings,
    items,
    supplementalSheets:parseSupplementalSheets(workbook)
  };
}

module.exports = { canonical, numberOrNull, parseTurnKey, assertFairTurn, compactSheetRows, parseSupplementalSheets, parseFairWorkbook };

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const MOVEMENT_COLUMNS = Array.from({ length: 40 }, (_, index) => `MOVEMENT_${index + 1}`);
const SCOUT_COLUMNS = Array.from({ length: 9 }, (_, index) => `Movement${index + 1}`);
const VALID_DIRECTIONS = new Set(['EMPTY', 'FCL', 'FCR', 'FLL', 'FLR', 'FML', 'FMR', 'FOL', 'FOR', 'FOLLOW', 'FRL', 'FRR', 'GOTO', 'N', 'NE', 'NEL', 'NL', 'NW', 'NWL', 'S', 'SE', 'SEL', 'SL', 'Still', 'SW', 'SWL']);
const VALID_SCOUT_DIRECTIONS = new Set([...VALID_DIRECTIONS].filter(value => value !== 'GOTO'));
const VALID_MISSIONS = new Set(['LOCATE', 'PATROL', 'RAID', 'SPY']);

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[character]));
}

function xmlUnescape(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of String(tag || '').matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g)) {
    attributes[match[1]] = xmlUnescape(match[2]);
  }
  return attributes;
}

function columnName(number) {
  let value = Number(number);
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function columnNumber(value) {
  let result = 0;
  for (const character of String(value || '').toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function cellAddress(column, row) {
  return `${column}${row}`;
}

function rowCapacity(sheet) {
  const reference = sheet?.['!ref'];
  const match = String(reference || '').match(/:(?:[A-Z]+)(\d+)$/i);
  return match ? Number(match[1]) : 1;
}

function sheetHeaders(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })[0] || [];
}

function validateOrdersTemplate(filePath) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('The blank Orders workbook could not be found.');
  if (/\.xls$/i.test(filePath)) throw new Error('The workbook must be .xlsx or .xlsm so its validation rules and formatting can be preserved.');
  const workbook = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true, bookVBA: true });
  const required = {
    'GM Actions': ['Unit', 'What does the GM need to do?'],
    Tribe_Movement: ['TRIBE', 'MOVEMENT_1', 'MOVEMENT_40', 'Processed'],
    Scout_Movement: ['TRIBE', 'No_of_Scouts', 'No_of_Horses', 'Mission', 'Movement1', 'Movement9', 'Processed'],
    'Valid Units': ['Unit', 'Description']
  };
  for (const [sheetName, headers] of Object.entries(required)) {
    if (!workbook.Sheets[sheetName]) throw new Error(`The Orders workbook is missing the ${sheetName} sheet.`);
    const actual = new Set(sheetHeaders(workbook, sheetName));
    const missing = headers.filter(header => !actual.has(header));
    if (missing.length) throw new Error(`${sheetName} is missing required column(s): ${missing.join(', ')}.`);
  }
  if (rowCapacity(workbook.Sheets.Tribe_Movement) < 3) throw new Error('Tribe_Movement must contain at least two input rows.');
  if (rowCapacity(workbook.Sheets.Scout_Movement) < 3) throw new Error('Scout_Movement must contain at least two input rows.');
  if (rowCapacity(workbook.Sheets['GM Actions']) < 2) throw new Error('GM Actions must contain at least one input row.');
  return {
    filePath,
    workbook,
    sheetNames: [...workbook.SheetNames],
    movementRows: rowCapacity(workbook.Sheets.Tribe_Movement) - 1,
    scoutRows: rowCapacity(workbook.Sheets.Scout_Movement) - 1,
    gmRows: rowCapacity(workbook.Sheets['GM Actions']) - 1
  };
}

function inferTurnKey(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/(?:^|_)(\d{3})[_-](\d{1,2})(?:_|$)/) || base.match(/(?:^|\s)(\d{3})[-_](\d{1,2})(?:\s|$)/);
  return match ? `${match[1]}-${match[2]}` : base;
}

function rootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

function unitSortKey(unitCode) {
  const value = String(unitCode || '').toLowerCase();
  const root = rootTribe(value);
  const suffix = value.slice(root.length);
  const typeOrder = suffix === '' ? 0 : suffix[0] === 'e' ? 1 : suffix[0] === 'f' ? 2 : suffix[0] === 'g' ? 3 : suffix[0] === 'c' ? 4 : 9;
  const number = Number(suffix.slice(1)) || 0;
  return [Number(root) || 0, typeOrder, number, value];
}

function compareUnitCodes(a, b) {
  const left = unitSortKey(a);
  const right = unitSortKey(b);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2] || String(left[3]).localeCompare(String(right[3]));
}

function skillTransferText(skill, parentUnit, targetUnit) {
  const name = String(skill?.skill || skill?.name || skill?.shortname || '').trim();
  if (!name) throw new Error('A skill transfer is missing its skill name.');
  const level = Number(skill?.level || 0);
  if (!Number.isFinite(level) || level <= 0) throw new Error(`Skill transfer for ${name} has an invalid level.`);
  const sourceTribe = String(parentUnit || '').slice(0, 4);
  return `Skill ${name} ${level} should be moved from Tribe ${sourceTribe} to Tribe ${targetUnit}`;
}

function normalizeDirections(directions, max, label, allowed = VALID_DIRECTIONS) {
  const values = (directions || []).map(value => String(value || '').trim()).filter(Boolean);
  if (values.length > max) throw new Error(`${label} has ${values.length} commands, but the workbook allows only ${max}.`);
  for (const value of values) {
    const candidate = value.toLowerCase() === 'still' ? 'Still' : value.toUpperCase();
    if (!allowed.has(candidate)) throw new Error(`${label} contains invalid movement value “${value}”.`);
  }
  return values.map(value => value.toLowerCase() === 'still' ? 'Still' : value.toUpperCase());
}

function normalizeMovementRows(rows, maxRows) {
  const sorted = [...(rows || [])].filter(row => row?.unitCode).sort((a, b) => compareUnitCodes(a.unitCode, b.unitCode));
  if (sorted.length > maxRows) throw new Error(`The blank workbook has room for ${maxRows} movement rows, but ${sorted.length} units are planned.`);
  return sorted.map(row => {
    const directions = normalizeDirections(row.directions, 40, `Movement for ${row.unitCode}`);
    return {
      unitCode: String(row.unitCode).trim(),
      unitName: String(row.unitName || '').trim(),
      directions: directions.length ? directions : ['Still']
    };
  });
}

function validUnitCells(workbook, units) {
  const sheet = workbook.Sheets['Valid Units'];
  if (!sheet) throw new Error('The Orders workbook is missing the Valid Units sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const existing = new Map();
  for (let index = 1; index < rows.length; index++) {
    const code = String(rows[index]?.[0] || '').trim().toLowerCase();
    if (code) existing.set(code, index + 1);
  }
  const cells = [];
  const usedRows = new Set(existing.values());
  let nextRow = 2;
  for (const unit of units || []) {
    const code = String(unit.unitCode || '').trim();
    if (!code) continue;
    const key = code.toLowerCase();
    let row = existing.get(key);
    if (!row) {
      while (usedRows.has(nextRow) && nextRow <= rowCapacity(sheet)) nextRow += 1;
      if (nextRow > rowCapacity(sheet)) throw new Error(`Valid Units has no empty row for ${code}.`);
      row = nextRow;
      usedRows.add(row);
      existing.set(key, row);
      cells.push({ address: `A${row}`, value: code });
    }
    const description = String(unit.unitName || '').trim();
    if (description) cells.push({ address: `B${row}`, value: description });
  }
  return cells;
}

function normalizeScoutRows(rows, maxRows) {
  const sorted = [...(rows || [])].filter(row => row?.unitCode).sort((a, b) => compareUnitCodes(a.unitCode, b.unitCode) || Number(a.scoutNumber || 0) - Number(b.scoutNumber || 0));
  if (sorted.length > maxRows) throw new Error(`The blank workbook has room for ${maxRows} scouting rows, but ${sorted.length} are planned.`);
  return sorted.map((row, index) => {
    const directions = normalizeDirections(row.directions, 9, `Scouting row ${index + 1}`, VALID_SCOUT_DIRECTIONS);
    const scouts = Number(row.noOfScouts ?? row.scoutCount ?? 0);
    const horses = Number(row.noOfHorses ?? row.horseCount ?? 0);
    const mission = String(row.mission || 'PATROL').trim().toUpperCase();
    if (!Number.isInteger(scouts) || scouts < 1) throw new Error(`Scouting for ${row.unitCode} needs at least one scout.`);
    if (!Number.isInteger(horses) || horses < 0 || horses > scouts) throw new Error(`Scouting for ${row.unitCode} must have horses from 0 to the number of scouts.`);
    if (!VALID_MISSIONS.has(mission)) throw new Error(`Scouting for ${row.unitCode} has invalid mission “${mission}”.`);
    return {
      unitCode: String(row.unitCode).trim(),
      noOfScouts: scouts,
      noOfHorses: horses,
      mission,
      directions: directions.length ? directions : ['EMPTY']
    };
  });
}

function sheetPathsFromWorkbookXml(workbookXml, relsXml) {
  const relationships = new Map();
  for (const match of String(relsXml || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.Id && attributes.Target) relationships.set(attributes.Id, attributes.Target);
  }
  const result = new Map();
  for (const match of String(workbookXml || '').matchAll(/<sheet\b[^>]*>/g)) {
    const attributes = parseAttributes(match[0]);
    const target = relationships.get(attributes['r:id']);
    if (!attributes.name || !target) continue;
    const relative = target.replace(/^\//, '').replace(/^xl\//, '');
    result.set(attributes.name, `xl/${relative}`);
  }
  return result;
}

function replaceCell(sheetXml, address, value, kind = 'text') {
  const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<c\\b(?=[^>]*\\br="${escapedAddress}")(?:[^>]*?\\/>|[^>]*>[\\s\\S]*?<\\/c>)`, 'i');
  const match = sheetXml.match(pattern);
  const cellBody = value === null || value === undefined || value === ''
    ? ''
    : kind === 'number'
      ? `<v>${Number(value)}</v>`
      : `<is><t xml:space="preserve">${xmlEscape(value)}</t></is>`;
  const makeCell = original => {
    const opening = String(original || `<c r="${address}">`).match(/^<c\b[^>]*>/i)?.[0] || `<c r="${address}">`;
    const attributes = parseAttributes(opening);
    delete attributes.t;
    const attributeText = Object.entries(attributes).map(([key, item]) => `${key}="${xmlEscape(item)}"`).join(' ');
    const typeAttribute = value === null || value === undefined || value === '' ? '' : kind === 'number' ? ' t="n"' : ' t="inlineStr"';
    return `<c${attributeText ? ` ${attributeText}` : ''}${typeAttribute}>${cellBody}</c>`;
  };
  if (match) return sheetXml.replace(pattern, makeCell(match[0]));

  const rowNumber = Number((address.match(/\d+$/) || [0])[0]);
  const rowPattern = new RegExp(`<row\\b(?=[^>]*\\br="${rowNumber}")[^>]*>[\\s\\S]*?<\\/row>`, 'i');
  const rowMatch = sheetXml.match(rowPattern);
  if (!rowMatch) throw new Error(`Could not find workbook row ${rowNumber} while writing ${address}.`);
  const rowXml = rowMatch[0];
  const targetColumn = columnNumber(address.match(/^[A-Z]+/i)?.[0]);
  const nextCell = [...rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"(?:[^>]*?\/>|[^>]*>[\s\S]*?<\/c>)/gi)]
    .find(match => columnNumber(String(match[1]).replace(/\d+$/, '')) > targetColumn);
  const inserted = nextCell
    ? rowXml.slice(0, nextCell.index) + makeCell(null) + rowXml.slice(nextCell.index)
    : rowXml.replace(/<\/row>\s*$/i, `${makeCell(null)}</row>`);
  return sheetXml.replace(rowPattern, inserted);
}

function patchCells(sheetXml, cells) {
  let output = sheetXml;
  for (const cell of cells) output = replaceCell(output, cell.address, cell.value, cell.kind);
  return output;
}

function makeMovementCells(rowNumber, row) {
  const values = [...row.directions, ...Array(40 - row.directions.length).fill('EMPTY')];
  const cells = [
    { address: cellAddress('B', rowNumber), value: row.unitCode },
    { address: cellAddress('AT', rowNumber), value: 'N' }
  ];
  values.forEach((value, index) => cells.push({ address: cellAddress(columnName(6 + index), rowNumber), value }));
  return cells;
}

function makeScoutCells(rowNumber, row) {
  const values = [...row.directions, ...Array(9 - row.directions.length).fill('EMPTY')];
  const cells = [
    { address: cellAddress('B', rowNumber), value: row.unitCode },
    { address: cellAddress('C', rowNumber), value: row.noOfScouts, kind: 'number' },
    { address: cellAddress('D', rowNumber), value: row.noOfHorses, kind: 'number' },
    { address: cellAddress('E', rowNumber), value: row.mission },
    { address: cellAddress('O', rowNumber), value: 'N' }
  ];
  values.forEach((value, index) => cells.push({ address: cellAddress(columnName(6 + index), rowNumber), value }));
  return cells;
}

function validatePatchedWorkbook(sourceXml, outputPath, expected) {
  const output = XLSX.readFile(outputPath, { cellFormula: true, cellStyles: true, bookVBA: true });
  const source = XLSX.readFile(expected.templatePath, { cellFormula: true, cellStyles: true, bookVBA: true });
  if (JSON.stringify(output.SheetNames) !== JSON.stringify(source.SheetNames)) throw new Error('Workbook validation failed: sheet names or order changed.');
  const readRows = (sheetName, options = {}) => XLSX.utils.sheet_to_json(output.Sheets[sheetName], { defval: null, raw: true, ...options });
  const movement = readRows('Tribe_Movement').filter(row => expected.movements.some(item => String(item.unitCode) === String(row.TRIBE)));
  for (const item of expected.movements) {
    const actual = movement.find(row => String(row.TRIBE) === String(item.unitCode));
    if (!actual) throw new Error(`Workbook validation failed: movement row for ${item.unitCode} was not written.`);
    const commands = MOVEMENT_COLUMNS.map(column => String(actual[column] || '')).filter(value => value && value !== 'EMPTY');
    if (commands.join('|') !== item.directions.join('|')) throw new Error(`Workbook validation failed: movement commands for ${item.unitCode} changed.`);
  }
  const validUnits = new Set(readRows('Valid Units').map(row => String(row.Unit || '').trim().toLowerCase()).filter(Boolean));
  for (const item of [...(expected.movements || []), ...(expected.validUnits || [])]) {
    if (!validUnits.has(String(item.unitCode).trim().toLowerCase())) throw new Error(`Workbook validation failed: ${item.unitCode} is missing from Valid Units.`);
  }
  const scouts = readRows('Scout_Movement').filter(row => expected.scouts.some(item => String(item.unitCode) === String(row.TRIBE)) && Number(row.No_of_Scouts || 0));
  if (scouts.length !== expected.scouts.length) throw new Error('Workbook validation failed: scouting rows were not written.');
  const actions = readRows('GM Actions').map(row => String(row['What does the GM need to do?'] || '')).filter(Boolean);
  for (const action of expected.gmActions) if (!actions.includes(action.text)) throw new Error('Workbook validation failed: a GM Action was not written.');
  return output;
}

async function patchOrdersWorkbook({ templatePath, outputPath, movements = [], scouts = [], gmActions = [], validUnits = [] }) {
  const template = validateOrdersTemplate(templatePath);
  const normalizedMovements = normalizeMovementRows(movements, template.movementRows);
  const normalizedScouts = normalizeScoutRows(scouts, template.scoutRows);
  const normalizedValidUnits = [...(validUnits || []), ...normalizedMovements]
    .filter(row => row?.unitCode)
    .map(row => ({ unitCode: String(row.unitCode).trim(), unitName: String(row.unitName || '').trim() }))
    .filter((row, index, rows) => rows.findIndex(item => item.unitCode.toLowerCase() === row.unitCode.toLowerCase()) === index);
  const normalizedActions = (gmActions || []).filter(action => action?.text).map(action => ({ unit: String(action.unit || '').trim(), text: String(action.text).trim() }));
  if (normalizedActions.length > template.gmRows) throw new Error(`The blank workbook has room for ${template.gmRows} GM Action rows, but ${normalizedActions.length} are planned.`);
  const sourceReal = path.resolve(templatePath);
  const outputReal = path.resolve(outputPath);
  if (sourceReal === outputReal) throw new Error('Choose a different output file so the blank template remains available.');

  const buffer = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const paths = sheetPathsFromWorkbookXml(workbookXml, relsXml);
  for (const sheetName of ['Tribe_Movement', 'Scout_Movement', 'GM Actions', 'Valid Units']) if (!paths.has(sheetName)) throw new Error(`Could not locate ${sheetName} inside the workbook archive.`);

  let movementXml = await zip.file(paths.get('Tribe_Movement')).async('string');
  normalizedMovements.forEach((row, index) => { movementXml = patchCells(movementXml, makeMovementCells(index + 2, row)); });
  zip.file(paths.get('Tribe_Movement'), movementXml);

  let scoutXml = await zip.file(paths.get('Scout_Movement')).async('string');
  normalizedScouts.forEach((row, index) => { scoutXml = patchCells(scoutXml, makeScoutCells(index + 2, row)); });
  zip.file(paths.get('Scout_Movement'), scoutXml);

  let gmXml = await zip.file(paths.get('GM Actions')).async('string');
  const actionCells = [];
  normalizedActions.forEach((action, index) => {
    const row = index + 2;
    actionCells.push({ address: `A${row}`, value: action.unit });
    actionCells.push({ address: `B${row}`, value: action.text });
  });
  gmXml = patchCells(gmXml, actionCells);
  zip.file(paths.get('GM Actions'), gmXml);

  let validUnitsXml = await zip.file(paths.get('Valid Units')).async('string');
  validUnitsXml = patchCells(validUnitsXml, validUnitCells(template.workbook, normalizedValidUnits));
  zip.file(paths.get('Valid Units'), validUnitsXml);

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  validatePatchedWorkbook(buffer, outputPath, { templatePath, movements: normalizedMovements, scouts: normalizedScouts, gmActions: normalizedActions, validUnits: normalizedValidUnits });
  return { outputPath, movements: normalizedMovements, scouts: normalizedScouts, gmActions: normalizedActions, validUnits: normalizedValidUnits };
}

function templateDirectory(userDataPath) {
  return path.join(userDataPath, 'data', 'orders-templates');
}

async function saveOrderTemplate(filePath, userDataPath, turnKey) {
  validateOrdersTemplate(filePath);
  const directory = path.join(templateDirectory(userDataPath), String(turnKey));
  await fs.promises.mkdir(directory, { recursive: true });
  const destination = path.join(directory, `blank-orders${path.extname(filePath).toLowerCase() || '.xlsx'}`);
  await fs.promises.copyFile(filePath, destination);
  return { turnKey, sourceFile: path.basename(filePath), storedPath: destination };
}

async function findOrderTemplate(userDataPath, turnKey) {
  const directory = path.join(templateDirectory(userDataPath), String(turnKey));
  try {
    const names = (await fs.promises.readdir(directory)).filter(name => /\.(xlsx|xlsm|xls)$/i.test(name)).sort();
    return names.length ? path.join(directory, names[0]) : null;
  } catch (_) { return null; }
}

module.exports = {
  MOVEMENT_COLUMNS,
  SCOUT_COLUMNS,
  VALID_DIRECTIONS,
  VALID_SCOUT_DIRECTIONS,
  VALID_MISSIONS,
  inferTurnKey,
  rootTribe,
  compareUnitCodes,
  skillTransferText,
  validateOrdersTemplate,
  patchOrdersWorkbook,
  saveOrderTemplate,
  findOrderTemplate
};

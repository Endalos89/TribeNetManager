const path = require('path');
const XLSX = require('xlsx');
const { parseOrdersWorkbook } = require('./planner');

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function canonical(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function rootTribe(unit) {
  const m = String(unit || '').match(/^(\d{4})/);
  return m ? m[1] : String(unit || '');
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

function inferTurnKey(filename) {
  const base = path.basename(filename, path.extname(filename));
  for (const re of [/(?:^|_)(\d{3})[_-](\d{1,2})(?:_|$)/, /(?:^|\s)(\d{3})[-_](\d{1,2})(?:\s|$)/]) {
    const match = base.match(re);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return base;
}

function rowsFromSheet(sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function extractSkillMatrix(workbook) {
  const skillsByTribe = new Map();
  const skillMeta = new Map();
  const sheetNames = workbook.SheetNames.filter(name => !/^valid\s+skills?$/i.test(name));

  const putSkill = (tribe, skill, level, group = null, shortname = null) => {
    const tribeCode = clean(tribe);
    const skillName = clean(skill);
    const n = Number(level);
    if (!tribeCode || !/^\d{4}$/.test(tribeCode) || !skillName || !Number.isFinite(n) || n <= 0) return;
    if (!skillsByTribe.has(tribeCode)) skillsByTribe.set(tribeCode, new Map());
    skillsByTribe.get(tribeCode).set(canonical(skillName), {
      skill: String(skillName), group: clean(group), shortname: clean(shortname), level: n
    });
    if (!skillMeta.has(canonical(skillName))) skillMeta.set(canonical(skillName), { skill: String(skillName), group: clean(group), shortname: clean(shortname) });
  };

  for (const sheetName of sheetNames) {
    const rows = rowsFromSheet(workbook.Sheets[sheetName]);
    if (!rows.length) continue;

    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 20); headerIndex++) {
      const header = (rows[headerIndex] || []).map(canonical);
      const skillCol = header.findIndex(v => v === 'SKILL' || v === 'SKILLS');
      if (skillCol < 0) continue;

      const groupCol = header.findIndex(v => v === 'GROUP');
      const shortCol = header.findIndex(v => v === 'SHORTNAME' || v === 'SHORT NAME');
      const unitCol = header.findIndex(v => v === 'UNIT' || v === 'TRIBE');
      const levelCol = header.findIndex(v => v === 'LEVEL' || v === 'SKILL LEVEL');

      // Long form: Unit | Skill | Level
      if (unitCol >= 0 && levelCol >= 0) {
        for (let r = headerIndex + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          putSkill(row[unitCol], row[skillCol], row[levelCol], groupCol >= 0 ? row[groupCol] : null, shortCol >= 0 ? row[shortCol] : null);
        }
        continue;
      }

      // Matrix form used by the Orders workbook: Skill | Group | Shortname | 0485 | 0486 ...
      const tribeColumns = [];
      for (let c = 0; c < header.length; c++) {
        const raw = clean((rows[headerIndex] || [])[c]);
        if (raw && /^\d{4}$/.test(raw)) tribeColumns.push({ c, tribe: raw });
      }
      if (tribeColumns.length) {
        for (let r = headerIndex + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const skill = row[skillCol];
          if (!clean(skill)) continue;
          for (const tc of tribeColumns) {
            putSkill(tc.tribe, skill, row[tc.c], groupCol >= 0 ? row[groupCol] : null, shortCol >= 0 ? row[shortCol] : null);
          }
        }
      }
    }
  }

  return {
    skillsByTribe: Object.fromEntries([...skillsByTribe.entries()].map(([tribe, map]) => [tribe, [...map.values()].sort((a, b) => a.skill.localeCompare(b.skill))])),
    skillMeta: [...skillMeta.values()].sort((a, b) => a.skill.localeCompare(b.skill))
  };
}

function extractClanWorkforce(workbook) {
  const sheet = workbook.Sheets.Clan;
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const result = {};
  for (const row of rows) {
    const unit = clean(row.Unit);
    if (!unit || String(unit).toLowerCase() === 'totals') continue;
    result[unit] = {
      workers: Number(row.Workers || 0),
      used: Number(row.Used || 0),
      remains: Number(row.Remains || 0)
    };
  }
  return result;
}

function buildUnits(plan, skillsByTribe, workforceByUnit) {
  const map = new Map();
  const add = raw => {
    if (!raw?.unit) return;
    const unit = String(raw.unit);
    const root = rootTribe(unit);
    const existing = map.get(unit) || {};
    map.set(unit, {
      ...existing,
      unit,
      unitName: raw.unitName || existing.unitName || null,
      type: raw.type || existing.type || unitType(unit),
      parentTribe: root,
      startHex: raw.startHex || existing.startHex || null,
      warrior: Number(raw.warrior ?? existing.warrior ?? 0),
      active: Number(raw.active ?? existing.active ?? 0),
      inactive: Number(raw.inactive ?? existing.inactive ?? 0),
      slave: Number(raw.slave ?? existing.slave ?? 0),
      eaters: Number(raw.eaters ?? existing.eaters ?? 0),
      locals: Number(raw.locals ?? existing.locals ?? 0),
      workers: Number(workforceByUnit[unit]?.workers || 0),
      used: Number(workforceByUnit[unit]?.used || 0),
      remains: Number(workforceByUnit[unit]?.remains || 0),
      skills: skillsByTribe[root] || []
    });
  };

  for (const row of plan.clan || []) add(row);
  for (const row of plan.unitStats || []) add(row);
  for (const row of plan.units || []) add(row);
  for (const row of plan.movements || []) add(row);

  return [...map.values()].sort((a, b) => a.parentTribe.localeCompare(b.parentTribe, undefined, { numeric: true }) || a.unit.localeCompare(b.unit, undefined, { numeric: true }));
}

function parseTurnWorkbook(filePath, role) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellFormula: true, bookVBA: true });
  const plan = parseOrdersWorkbook(filePath);
  const skills = extractSkillMatrix(workbook);
  const workforce = extractClanWorkforce(workbook);
  const units = buildUnits(plan, skills.skillsByTribe, workforce);

  return {
    role,
    turnKey: plan.turnKey || inferTurnKey(filePath),
    sourceFile: path.basename(filePath),
    importedAt: new Date().toISOString(),
    units,
    skillsByTribe: skills.skillsByTribe,
    skillMeta: skills.skillMeta,
    activities: plan.activities || [],
    scouts: plan.scouts || [],
    movements: plan.movements || [],
    transfers: plan.transfers || [],
    rawPlan: plan
  };
}

module.exports = { parseTurnWorkbook, extractSkillMatrix, rootTribe, unitType };

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { canonicalTurnKey } = require('./turn-key');

function normalizeUnitCode(value) {
  return String(value || '').trim().toLowerCase();
}

function unitTypeFromCode(unit) {
  const code = normalizeUnitCode(unit);
  if (/^\d{4}$/.test(code)) return 'Tribe';
  if (/^\d{4}e\d+$/.test(code)) return 'Element';
  if (/^\d{4}f\d+$/.test(code)) return 'Fleet';
  if (/^\d{4}g\d+$/.test(code)) return 'Garrison';
  if (/^\d{4}c\d+$/.test(code)) return 'Courier';
  return 'Unit';
}

function rootTribe(unit) {
  const match = String(unit || '').match(/^(\d{4})/);
  return match ? match[1] : String(unit || '').trim();
}

function skillKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function skillLevel(skills, names) {
  const wanted = new Set((names || []).map(skillKey));
  const row = (skills || []).find(item => wanted.has(skillKey(item.skill)) || wanted.has(skillKey(item.shortname)));
  return Number(row?.level || 0);
}

class TurnManagerDatabase {
  constructor(userDataPath) {
    this.dataDir = path.join(userDataPath, 'data');
    this.backupDir = path.join(userDataPath, 'backups');
    this.dbPath = path.join(this.dataDir, 'turn-manager.sqlite');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS turn_workbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_key TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('start','final')),
        source_file TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        workbook_json TEXT NOT NULL,
        UNIQUE(turn_key, role)
      );
      CREATE INDEX IF NOT EXISTS idx_tm_workbooks_turn ON turn_workbooks(turn_key);

      CREATE TABLE IF NOT EXISTS planned_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_key TEXT NOT NULL,
        unit TEXT NOT NULL,
        activity_code TEXT NOT NULL,
        people INTEGER NOT NULL DEFAULT 0,
        target TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tm_activities_turn ON planned_activities(turn_key, unit);

      CREATE TABLE IF NOT EXISTS planned_unit_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_key TEXT NOT NULL,
        parent_unit TEXT NOT NULL,
        unit_code TEXT NOT NULL,
        unit_type TEXT NOT NULL CHECK(unit_type IN ('Tribe','Element','Fleet','Garrison','Courier')),
        unit_name TEXT NOT NULL DEFAULT '',
        start_hex TEXT NOT NULL,
        creation_phase TEXT NOT NULL DEFAULT 'before',
        skills_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(turn_key, unit_code)
      );
      CREATE INDEX IF NOT EXISTS idx_tm_splits_turn_parent ON planned_unit_splits(turn_key, parent_unit, unit_code);

      CREATE TABLE IF NOT EXISTS planned_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_key TEXT NOT NULL,
        from_unit TEXT NOT NULL,
        to_unit TEXT NOT NULL,
        item TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        timing TEXT NOT NULL CHECK(timing IN ('BM','AM')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tm_transfers_turn ON planned_transfers(turn_key, id);

      CREATE TABLE IF NOT EXISTS turn_context (
        turn_key TEXT PRIMARY KEY,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS planned_skill_attempts (
        turn_key TEXT NOT NULL,
        tribe TEXT NOT NULL,
        order_number INTEGER NOT NULL CHECK(order_number BETWEEN 1 AND 3),
        skill TEXT NOT NULL,
        skill_group TEXT,
        baseline_level INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(turn_key, tribe, order_number),
        UNIQUE(turn_key, tribe, skill)
      );
      CREATE INDEX IF NOT EXISTS idx_skill_attempts_turn ON planned_skill_attempts(turn_key, tribe, order_number);

      CREATE TABLE IF NOT EXISTS skill_attempt_streaks (
        tribe TEXT NOT NULL,
        skill_key TEXT NOT NULL,
        skill TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 9,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_turn_key TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(tribe, skill_key)
      );
      CREATE TABLE IF NOT EXISTS skill_attempt_reconciled_turns (
        turn_key TEXT PRIMARY KEY,
        reconciled_at TEXT NOT NULL
      );
    `);

    const columns = new Set(this.db.prepare('PRAGMA table_info(planned_unit_splits)').all().map(row => row.name));
    if (!columns.has('creation_phase') || !columns.has('skills_json')) {
      this.db.exec(`
        CREATE TABLE planned_unit_splits_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          turn_key TEXT NOT NULL,
          parent_unit TEXT NOT NULL,
          unit_code TEXT NOT NULL,
          unit_type TEXT NOT NULL CHECK(unit_type IN ('Tribe','Element','Fleet','Garrison','Courier')),
          unit_name TEXT NOT NULL DEFAULT '',
          start_hex TEXT NOT NULL,
          creation_phase TEXT NOT NULL DEFAULT 'before',
          skills_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(turn_key, unit_code)
        );
        INSERT INTO planned_unit_splits_v2(id, turn_key, parent_unit, unit_code, unit_type, unit_name, start_hex, created_at, updated_at)
          SELECT id, turn_key, parent_unit, unit_code, unit_type, unit_name, start_hex, created_at, updated_at FROM planned_unit_splits;
        DROP TABLE planned_unit_splits;
        ALTER TABLE planned_unit_splits_v2 RENAME TO planned_unit_splits;
        CREATE INDEX IF NOT EXISTS idx_tm_splits_turn_parent ON planned_unit_splits(turn_key, parent_unit, unit_code);
      `);
    }
  }

  saveWorkbook(parsed) {
    const now = parsed.importedAt || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO turn_workbooks(turn_key, role, source_file, imported_at, workbook_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(turn_key, role) DO UPDATE SET
        source_file = excluded.source_file,
        imported_at = excluded.imported_at,
        workbook_json = excluded.workbook_json
    `).run(parsed.turnKey, parsed.role, parsed.sourceFile, now, JSON.stringify(parsed));
    return this.getTurn(parsed.turnKey);
  }

  listTurns() {
    return this.db.prepare(`
      SELECT turn_key AS turnKey,
             MAX(CASE WHEN role='start' THEN source_file END) AS startFile,
             MAX(CASE WHEN role='start' THEN imported_at END) AS startImportedAt,
             MAX(CASE WHEN role='final' THEN source_file END) AS finalFile,
             MAX(CASE WHEN role='final' THEN imported_at END) AS finalImportedAt
      FROM turn_workbooks
      GROUP BY turn_key
      ORDER BY turn_key DESC
    `).all();
  }

  getTurn(turnKey) {
    const rows = this.db.prepare('SELECT * FROM turn_workbooks WHERE turn_key = ?').all(turnKey);
    if (!rows.length) return null;
    const result = {
      turnKey,
      start: null,
      final: null,
      activities: this.listActivities(turnKey),
      unitSplits: this.listUnitSplits(turnKey),
      transfers: this.listTransfers(turnKey),
      context: this.getContext(turnKey)
    };
    for (const row of rows) {
      const parsed = JSON.parse(row.workbook_json);
      result[row.role] = { id: Number(row.id), sourceFile: row.source_file, importedAt: row.imported_at, data: parsed };
    }
    return result;
  }

  addActivity(turnKey, activity) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO planned_activities(turn_key, unit, activity_code, people, target, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(turnKey, activity.unit, activity.activityCode, Math.max(0, Number(activity.people || 0)), activity.target || '', activity.notes || '', now, now);
    return this.db.prepare(`SELECT id, turn_key AS turnKey, unit, activity_code AS activityCode, people, target, notes, created_at AS createdAt, updated_at AS updatedAt FROM planned_activities WHERE id = ?`).get(Number(result.lastInsertRowid));
  }

  updateActivity(id, activity) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE planned_activities SET unit=?, activity_code=?, people=?, target=?, notes=?, updated_at=? WHERE id=?
    `).run(activity.unit, activity.activityCode, Math.max(0, Number(activity.people || 0)), activity.target || '', activity.notes || '', now, id);
    return this.db.prepare(`SELECT id, turn_key AS turnKey, unit, activity_code AS activityCode, people, target, notes, created_at AS createdAt, updated_at AS updatedAt FROM planned_activities WHERE id = ?`).get(id) || null;
  }

  deleteActivity(id) {
    this.db.prepare('DELETE FROM planned_activities WHERE id=?').run(id);
    return true;
  }

  listActivities(turnKey) {
    return this.db.prepare(`
      SELECT id, turn_key AS turnKey, unit, activity_code AS activityCode, people, target, notes, created_at AS createdAt, updated_at AS updatedAt
      FROM planned_activities WHERE turn_key=? ORDER BY id
    `).all(turnKey);
  }

  beginningUnits(turnKey) {
    const row = this.db.prepare(`SELECT workbook_json FROM turn_workbooks WHERE turn_key=? AND role='start'`).get(turnKey);
    if (!row) return [];
    try { return JSON.parse(row.workbook_json)?.units || []; }
    catch (_) { return []; }
  }

  beginningSkills(turnKey) {
    const row = this.db.prepare(`SELECT workbook_json FROM turn_workbooks WHERE turn_key=? AND role='start'`).get(turnKey);
    if (!row) return {};
    try { return JSON.parse(row.workbook_json)?.skillsByTribe || {}; }
    catch (_) { return {}; }
  }

  validateCreationCapacity(turnKey, parentUnit, unitType) {
    const tribe = rootTribe(parentUnit);
    const startUnits = this.beginningUnits(turnKey);
    const planned = this.listUnitSplits(turnKey);
    const skillsByTribe = this.beginningSkills(turnKey);
    const skills = skillsByTribe[tribe] || skillsByTribe[parentUnit] || [];
    const skillDataAvailable = Object.prototype.hasOwnProperty.call(skillsByTribe, tribe) || Object.prototype.hasOwnProperty.call(skillsByTribe, parentUnit);
    const allUnits = [...startUnits, ...planned.map(row => ({ unit: row.unitCode, type: row.unitType }))];

    if (skillDataAvailable && (unitType === 'Element' || unitType === 'Fleet')) {
      const administration = skillLevel(skills, ['Administration', 'Admin', 'Adm']);
      const capacity = Math.floor(administration / 2);
      const used = allUnits.filter(unit => rootTribe(unit.unit) === tribe && (String(unit.type || unitTypeFromCode(unit.unit)) === 'Element' || String(unit.type || unitTypeFromCode(unit.unit)) === 'Fleet')).length;
      if (used >= capacity) throw new Error(`${tribe} cannot create another ${unitType}: Administration ${administration} allows ${capacity} Element/Fleet unit${capacity === 1 ? '' : 's'} and ${used} already exist.`);
    }

    if (skillDataAvailable && unitType === 'Tribe') {
      const diplomacy = skillLevel(skills, ['Diplomacy', 'Dip']);
      const tribes = allUnits.filter(unit => String(unit.type || unitTypeFromCode(unit.unit)) === 'Tribe').length;
      if (tribes >= diplomacy) throw new Error(`${tribe} cannot create another Tribe: Diplomacy ${diplomacy} allows ${diplomacy} Tribe${diplomacy === 1 ? '' : 's'} and ${tribes} already exist.`);
    }

    if (skillDataAvailable && unitType === 'Courier') {
      const courier = skillLevel(skills, ['Courier', 'Cour']);
      const couriers = allUnits.filter(unit => String(unit.type || unitTypeFromCode(unit.unit)) === 'Courier').length;
      if (courier > 0 && couriers >= courier) throw new Error(`${tribe} cannot create another Courier: Courier ${courier} allows ${courier} Courier${courier === 1 ? '' : 's'} and ${couriers} already exist.`);
    }
  }

  nextUnitSplitCode(turnKey, parentUnit, unitType, startUnits) {
    const used = new Set([
      ...startUnits.map(unit => normalizeUnitCode(unit.unit)),
      ...this.listUnitSplits(turnKey).map(split => normalizeUnitCode(split.unitCode))
    ]);
    if (unitType === 'Tribe') {
      const stem = parentUnit.slice(1);
      for (let digit = 0; digit <= 9; digit++) {
        const candidate = `${digit}${stem}`;
        if (!used.has(candidate)) return candidate;
      }
      throw new Error(`All Tribe codes 0–9 ending in ${stem} are already in use.`);
    }

    const suffix = unitType === 'Element' ? 'e' : unitType === 'Fleet' ? 'f' : unitType === 'Garrison' ? 'g' : 'c';
    for (let number = 1; number <= 9999; number++) {
      const candidate = `${parentUnit}${suffix}${number}`;
      if (!used.has(candidate)) return candidate;
    }
    throw new Error(`No available ${unitType} codes remain for ${parentUnit}.`);
  }

  addUnitSplit(turnKey, split) {
    turnKey = canonicalTurnKey(turnKey) || turnKey;
    const parentUnit = normalizeUnitCode(split?.parentUnit);
    let unitCode = normalizeUnitCode(split?.unitCode);
    const unitType = ['Tribe', 'Element', 'Fleet', 'Garrison', 'Courier'].includes(split?.unitType) ? split.unitType : null;
    const unitName = String(split?.unitName || '').trim();
    if (!turnKey || !parentUnit || !unitType) throw new Error('Turn, parent Tribe and unit type are required.');

    const startUnits = this.beginningUnits(turnKey);
    if (!startUnits.length) throw new Error(`Import the beginning-of-turn workbook for ${turnKey} before creating a split.`);
    const parent = startUnits.find(unit => normalizeUnitCode(unit.unit) === parentUnit);

    if (!parent || String(parent.type || unitTypeFromCode(parent.unit)) !== 'Tribe') throw new Error('The split parent must be an existing Tribe from the beginning-of-turn workbook.');
    const startHex = String(parent.startHex || '').trim().toUpperCase();
    if (!startHex) throw new Error(`${parent.unit} has no starting hex in the beginning-of-turn workbook.`);

    if (!unitCode) unitCode = this.nextUnitSplitCode(turnKey, parentUnit, unitType, startUnits);

    if (unitType === 'Tribe' && !/^\d{4}$/.test(unitCode)) throw new Error('A new Tribe code must be exactly four digits, for example 1485.');
    if (unitType !== 'Tribe') {
      const suffix = unitType === 'Element' ? 'e' : unitType === 'Fleet' ? 'f' : unitType === 'Garrison' ? 'g' : 'c';
      const expected = new RegExp(`^${parentUnit}${suffix}\\d+$`);
      if (!expected.test(unitCode)) throw new Error(`A ${unitType} from ${parent.unit} must use a code such as ${parent.unit}${suffix}1.`);
    }

    if (startUnits.some(unit => normalizeUnitCode(unit.unit) === unitCode)) throw new Error(`${unitCode} already exists in the beginning-of-turn workbook.`);
    const existing = this.listUnitSplits(turnKey).find(row => normalizeUnitCode(row.unitCode) === unitCode);
    if (existing) throw new Error(`${unitCode} is already planned for Turn ${turnKey}.`);

    this.validateCreationCapacity(turnKey, parentUnit, unitType);
    const creationPhase = split?.creationPhase === 'after' ? 'after' : 'before';
    const skillsByTribe = this.beginningSkills(turnKey);
    const sourceSkills = skillsByTribe[rootTribe(parentUnit)] || [];
    const selectedSkills = (Array.isArray(split?.skills) ? split.skills : []).map(row => {
      const requested = typeof row === 'string' ? row : String(row?.skill || row?.name || '').trim();
      const source = sourceSkills.find(item => skillKey(item.skill) === skillKey(requested) || skillKey(item.shortname) === skillKey(requested));
      if (!source) return null;
      return { skill: source.skill || source.shortname, level: Number(source.level || 0) };
    }).filter(row => row && row.skill && Number.isFinite(row.level) && row.level > 0);

    const now = new Date().toISOString();
    const inserted = this.db.prepare(`
      INSERT INTO planned_unit_splits(turn_key, parent_unit, unit_code, unit_type, unit_name, start_hex, creation_phase, skills_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(turnKey, parent.unit, unitCode, unitType, unitName, startHex, creationPhase, JSON.stringify(selectedSkills), now, now);
    return this.getUnitSplit(Number(inserted.lastInsertRowid));
  }

  getUnitSplit(id) {
    const row = this.db.prepare(`
      SELECT id, turn_key AS turnKey, parent_unit AS parentUnit, unit_code AS unitCode,
             unit_type AS unitType, unit_name AS unitName, start_hex AS startHex,
             creation_phase AS creationPhase, skills_json AS skillsJson,
             created_at AS createdAt, updated_at AS updatedAt
      FROM planned_unit_splits WHERE id=?
    `).get(Number(id));
    return row ? { ...row, skills: JSON.parse(row.skillsJson || '[]') } : null;
  }

  listUnitSplits(turnKey) {
    if (!turnKey) return [];
    const requested = canonicalTurnKey(turnKey) || turnKey;
    return this.db.prepare(`
      SELECT id, turn_key AS turnKey, parent_unit AS parentUnit, unit_code AS unitCode,
             unit_type AS unitType, unit_name AS unitName, start_hex AS startHex,
             creation_phase AS creationPhase, skills_json AS skillsJson,
             created_at AS createdAt, updated_at AS updatedAt
      FROM planned_unit_splits ORDER BY parent_unit, unit_code
    `).all().filter(row => (canonicalTurnKey(row.turnKey) || row.turnKey) === requested)
      .map(row => ({ ...row, skills: JSON.parse(row.skillsJson || '[]') }));
  }

  deleteUnitSplit(id) {
    const row = this.getUnitSplit(id);
    if (!row) return null;
    const key = canonicalTurnKey(row.turnKey) || row.turnKey;
    const aliases = this.db.prepare('SELECT id, turn_key AS turnKey FROM planned_unit_splits WHERE lower(unit_code)=lower(?)').all(row.unitCode)
      .filter(candidate => (canonicalTurnKey(candidate.turnKey) || candidate.turnKey) === key)
      .map(candidate => Number(candidate.id));
    for (const candidate of aliases) this.db.prepare('DELETE FROM planned_unit_splits WHERE id=?').run(candidate);
    this.db.prepare('DELETE FROM planned_transfers WHERE turn_key=? AND (lower(from_unit)=lower(?) OR lower(to_unit)=lower(?))')
      .run(key, row.unitCode, row.unitCode);
    return row;
  }

  deleteAllUnitSplits(turnKey) {
    if (!turnKey) return [];
    const rows = this.listUnitSplits(turnKey);
    if (!rows.length) return [];
    const key = canonicalTurnKey(turnKey) || turnKey;
    const ids = this.db.prepare('SELECT id, turn_key AS turnKey FROM planned_unit_splits').all()
      .filter(candidate => (canonicalTurnKey(candidate.turnKey) || candidate.turnKey) === key)
      .map(candidate => Number(candidate.id));
    const unitCodes = new Set(rows.map(row => normalizeUnitCode(row.unitCode)));
    const linkedTransfers = this.listTransfers(key).filter(row => unitCodes.has(normalizeUnitCode(row.from)) || unitCodes.has(normalizeUnitCode(row.to)));
    for (const transfer of linkedTransfers) this.db.prepare('DELETE FROM planned_transfers WHERE id=?').run(transfer.id);
    for (const id of ids) this.db.prepare('DELETE FROM planned_unit_splits WHERE id=?').run(id);
    return rows;
  }

  addTransfer(turnKey, transfer) {
    turnKey = canonicalTurnKey(turnKey) || turnKey;
    const from = normalizeUnitCode(transfer?.from);
    const to = normalizeUnitCode(transfer?.to);
    const item = String(transfer?.item || '').trim();
    const quantity = Number(transfer?.quantity);
    const timing = String(transfer?.timing || 'BM').toUpperCase() === 'AM' ? 'AM' : 'BM';
    if (!turnKey || !from || !to || from === to || !item) throw new Error('Choose two different units and an item to transfer.');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Transfer quantity must be a positive whole number.');
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO planned_transfers(turn_key, from_unit, to_unit, item, quantity, timing, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(turnKey, from, to, item, quantity, timing, String(transfer?.notes || '').trim(), now, now);
    return this.getTransfer(Number(result.lastInsertRowid));
  }

  getTransfer(id) {
    return this.db.prepare(`SELECT id, turn_key AS turnKey, from_unit AS "from", to_unit AS "to", item, quantity,
      timing, notes, created_at AS createdAt, updated_at AS updatedAt FROM planned_transfers WHERE id=?`).get(Number(id)) || null;
  }

  listTransfers(turnKey) {
    if (!turnKey) return [];
    const key = canonicalTurnKey(turnKey) || turnKey;
    return this.db.prepare(`SELECT id, turn_key AS turnKey, from_unit AS "from", to_unit AS "to", item, quantity,
      timing, notes, created_at AS createdAt, updated_at AS updatedAt FROM planned_transfers ORDER BY id`)
      .all().filter(row => (canonicalTurnKey(row.turnKey) || row.turnKey) === key);
  }

  deleteTransfer(id) {
    const transfer = this.getTransfer(id);
    if (transfer) this.db.prepare('DELETE FROM planned_transfers WHERE id=?').run(Number(id));
    return transfer;
  }

  replaceTransferGroup(turnKey, unitA, unitB, timing, transfers = []) {
    turnKey = canonicalTurnKey(turnKey) || turnKey;
    const a = normalizeUnitCode(unitA); const b = normalizeUnitCode(unitB);
    const phase = String(timing || 'BM').toUpperCase();
    if (!turnKey || !a || !b || a === b || !['BM', 'AM'].includes(phase)) {
      throw new Error('Choose two different units and a valid transfer phase.');
    }
    const normalized = (transfers || []).map(row => {
      const from = normalizeUnitCode(row?.from); const to = normalizeUnitCode(row?.to);
      const item = String(row?.item || '').trim(); const quantity = Number(row?.quantity);
      if (!((from === a && to === b) || (from === b && to === a)) || !item) {
        throw new Error('Each transfer must use the selected pair of units and include an item.');
      }
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Transfer quantity must be a positive whole number.');
      return { from, to, item, quantity, timing: phase, notes: String(row?.notes || '').trim() };
    });
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO planned_transfers(turn_key, from_unit, to_unit, item, quantity, timing, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const replacedIds = this.listTransfers(turnKey).filter(row => String(row.timing).toUpperCase() === phase &&
      ((normalizeUnitCode(row.from) === a && normalizeUnitCode(row.to) === b) ||
       (normalizeUnitCode(row.from) === b && normalizeUnitCode(row.to) === a))).map(row => Number(row.id));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const remove = this.db.prepare('DELETE FROM planned_transfers WHERE id=?');
      for (const id of replacedIds) remove.run(id);
      for (const row of normalized) insert.run(turnKey, row.from, row.to, row.item, row.quantity, phase, row.notes, now, now);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.listTransfers(turnKey).filter(row => row.timing === phase &&
      ((normalizeUnitCode(row.from) === a && normalizeUnitCode(row.to) === b) ||
       (normalizeUnitCode(row.from) === b && normalizeUnitCode(row.to) === a)));
  }

  deleteAllTransfers(turnKey) {
    const transfers = this.listTransfers(turnKey);
    if (!transfers.length) return [];
    const key = canonicalTurnKey(turnKey) || turnKey;
    const ids = this.db.prepare('SELECT id, turn_key AS turnKey FROM planned_transfers').all()
      .filter(row => (canonicalTurnKey(row.turnKey) || row.turnKey) === key).map(row => Number(row.id));
    for (const id of ids) this.db.prepare('DELETE FROM planned_transfers WHERE id=?').run(id);
    return transfers;
  }

  saveSkillAttempts(turnKey, tribe, attempts = []) {
    turnKey = canonicalTurnKey(turnKey) || turnKey;
    tribe = String(tribe || '').trim().slice(0, 4);
    if (!turnKey || !/^\d{4}$/.test(tribe)) throw new Error('A planning turn and four-digit Tribe are required for skill attempts.');
    const normalized = (attempts || []).map((row, index) => ({
      order: Number(row?.order ?? row?.orderNumber ?? index + 1),
      skill: String(row?.skill || '').trim(),
      group: String(row?.group || '').trim().toUpperCase() || null,
      baselineLevel: Math.max(0, Math.min(10, Math.floor(Number(row?.baselineLevel || 0))))
    })).filter(row => row.skill).sort((a, b) => a.order - b.order);
    if (normalized.length > 3) throw new Error('A Tribe can select no more than three skill attempts per turn.');
    if (new Set(normalized.map(row => row.order)).size !== normalized.length || normalized.some(row => ![1, 2, 3].includes(row.order))) {
      throw new Error('Skill attempt order must use each of 1, 2 and 3 at most once.');
    }
    if (new Set(normalized.map(row => skillKey(row.skill))).size !== normalized.length) throw new Error('A Tribe cannot attempt the same skill more than once in a turn.');
    const now = new Date().toISOString();
    const write = this.db.prepare(`
      INSERT INTO planned_skill_attempts(turn_key, tribe, order_number, skill, skill_group, baseline_level, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.db.prepare('DELETE FROM planned_skill_attempts WHERE turn_key=? AND tribe=?').run(turnKey, tribe);
    for (const row of normalized) write.run(turnKey, tribe, row.order, row.skill, row.group, row.baselineLevel, now);
    return this.getSkillAttempts(turnKey, tribe);
  }

  getSkillAttempts(turnKey, tribe = null) {
    if (!turnKey) return [];
    const key = canonicalTurnKey(turnKey) || turnKey;
    return this.db.prepare(`
      SELECT turn_key AS turnKey, tribe, order_number AS "order", skill, skill_group AS "group",
             baseline_level AS baselineLevel, updated_at AS updatedAt
      FROM planned_skill_attempts WHERE turn_key=? ORDER BY tribe, order_number
    `).all(key).filter(row => !tribe || row.tribe === String(tribe).trim().slice(0, 4));
  }

  getSkillStreaks(tribe) {
    const code = String(tribe || '').trim().slice(0, 4);
    if (!/^\d{4}$/.test(code)) return [];
    return this.db.prepare(`
      SELECT tribe, skill_key AS skillKey, skill, level, failure_count AS failureCount,
             last_turn_key AS lastTurnKey, updated_at AS updatedAt
      FROM skill_attempt_streaks WHERE tribe=? ORDER BY skill
    `).all(code);
  }

  setSkillStreak(tribe, skill, failureCount, lastTurnKey = null) {
    const code = String(tribe || '').trim().slice(0, 4);
    const name = String(skill || '').trim();
    if (!/^\d{4}$/.test(code) || !name) throw new Error('A Tribe and skill are required to set a skill streak.');
    const count = Math.max(0, Math.min(11, Math.floor(Number(failureCount || 0))));
    const now = new Date().toISOString();
    const key = skillKey(name);
    if (!count) this.db.prepare('DELETE FROM skill_attempt_streaks WHERE tribe=? AND skill_key=?').run(code, key);
    else this.db.prepare(`
      INSERT INTO skill_attempt_streaks(tribe, skill_key, skill, level, failure_count, last_turn_key, updated_at)
      VALUES (?, ?, ?, 9, ?, ?, ?)
      ON CONFLICT(tribe, skill_key) DO UPDATE SET skill=excluded.skill, level=9,
        failure_count=excluded.failure_count, last_turn_key=excluded.last_turn_key, updated_at=excluded.updated_at
    `).run(code, key, name, count, lastTurnKey, now);
    return this.getSkillStreaks(code);
  }

  reconcileSkillAttemptResults(turnKey, skillsByTribe = {}) {
    turnKey = canonicalTurnKey(turnKey) || turnKey;
    if (!turnKey) return { reconciled: false, updated: 0 };
    if (this.db.prepare('SELECT 1 FROM skill_attempt_reconciled_turns WHERE turn_key=?').get(turnKey)) return { reconciled: false, updated: 0 };
    const attempts = this.getSkillAttempts(turnKey);
    const byTribe = new Map();
    for (const row of attempts) {
      if (!byTribe.has(row.tribe)) byTribe.set(row.tribe, []);
      byTribe.get(row.tribe).push(row);
    }
    const allTribes = new Set([
      ...this.db.prepare('SELECT DISTINCT tribe FROM skill_attempt_streaks').all().map(row => row.tribe),
      ...byTribe.keys()
    ]);
    let updated = 0;
    const thisTurn = turnKey.match(/^(\d{3})-(\d{1,2})$/);
    const previousKey = thisTurn ? (() => {
      let year = Number(thisTurn[1]); let month = Number(thisTurn[2]) - 1;
      if (month < 1) { month = 12; year -= 1; }
      return `${String(year).padStart(3, '0')}-${String(month).padStart(2, '0')}`;
    })() : null;
    const currentLevel = (tribe, skill) => {
      const rows = skillsByTribe?.[tribe] || [];
      const wanted = skillKey(skill);
      const row = rows.find(item => skillKey(item.skill) === wanted || skillKey(item.shortname) === wanted);
      return Number(row?.level || 0);
    };
    for (const tribe of allTribes) {
      const first = (byTribe.get(tribe) || []).find(row => Number(row.order) === 1);
      const target = first && Number(first.baselineLevel) === 9 ? first : null;
      const resultingLevel = target ? currentLevel(tribe, target.skill) : null;
      if (target && resultingLevel === 9) {
        this.db.prepare('DELETE FROM skill_attempt_streaks WHERE tribe=? AND skill_key<>?').run(tribe, skillKey(target.skill));
        const previous = this.db.prepare('SELECT failure_count AS failureCount, last_turn_key AS lastTurnKey FROM skill_attempt_streaks WHERE tribe=? AND skill_key=?').get(tribe, skillKey(target.skill));
        const continues = previous && previous.lastTurnKey === previousKey;
        const failureCount = Math.min(11, (continues ? Number(previous.failureCount) : 0) + 1);
        const now = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO skill_attempt_streaks(tribe, skill_key, skill, level, failure_count, last_turn_key, updated_at)
          VALUES (?, ?, ?, 9, ?, ?, ?)
          ON CONFLICT(tribe, skill_key) DO UPDATE SET skill=excluded.skill, level=9,
            failure_count=excluded.failure_count, last_turn_key=excluded.last_turn_key, updated_at=excluded.updated_at
        `).run(tribe, skillKey(target.skill), target.skill, failureCount, turnKey, now);
        updated += 1;
      } else {
        // A miss, different first attempt, or successful increase ends a consecutive streak.
        updated += this.db.prepare('DELETE FROM skill_attempt_streaks WHERE tribe=?').run(tribe).changes;
      }
    }
    this.db.prepare('INSERT INTO skill_attempt_reconciled_turns(turn_key, reconciled_at) VALUES (?, ?)').run(turnKey, new Date().toISOString());
    return { reconciled: true, updated };
  }

  getContext(turnKey) {
    return this.db.prepare('SELECT turn_key AS turnKey, notes, updated_at AS updatedAt FROM turn_context WHERE turn_key=?').get(turnKey) || { turnKey, notes: '', updatedAt: null };
  }

  saveContext(turnKey, notes) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO turn_context(turn_key, notes, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(turn_key) DO UPDATE SET notes=excluded.notes, updated_at=excluded.updated_at
    `).run(turnKey, notes || '', now);
    return this.getContext(turnKey);
  }

  createBackup() {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `turn-manager-${stamp}.sqlite`);
    fs.copyFileSync(this.dbPath, backupPath);
    return backupPath;
  }

  close() { if (this.db) this.db.close(); }
}

module.exports = { TurnManagerDatabase, normalizeUnitCode, unitTypeFromCode };

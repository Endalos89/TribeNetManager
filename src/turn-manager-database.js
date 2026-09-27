const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function normalizeUnitCode(value) {
  return String(value || '').trim().toLowerCase();
}

function unitTypeFromCode(unit) {
  const code = normalizeUnitCode(unit);
  if (/^\d{4}$/.test(code)) return 'Tribe';
  if (/^\d{4}e\d+$/.test(code)) return 'Element';
  return 'Unit';
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
        unit_type TEXT NOT NULL CHECK(unit_type IN ('Tribe','Element')),
        unit_name TEXT NOT NULL DEFAULT '',
        start_hex TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(turn_key, unit_code)
      );
      CREATE INDEX IF NOT EXISTS idx_tm_splits_turn_parent ON planned_unit_splits(turn_key, parent_unit, unit_code);

      CREATE TABLE IF NOT EXISTS turn_context (
        turn_key TEXT PRIMARY KEY,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );
    `);
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

  addUnitSplit(turnKey, split) {
    const parentUnit = normalizeUnitCode(split?.parentUnit);
    const unitCode = normalizeUnitCode(split?.unitCode);
    const unitType = split?.unitType === 'Tribe' ? 'Tribe' : split?.unitType === 'Element' ? 'Element' : null;
    const unitName = String(split?.unitName || '').trim();
    if (!turnKey || !parentUnit || !unitCode || !unitType) throw new Error('Turn, parent Tribe, unit code and unit type are required.');

    const startUnits = this.beginningUnits(turnKey);
    if (!startUnits.length) throw new Error(`Import the beginning-of-turn workbook for ${turnKey} before creating a split.`);
    const parent = startUnits.find(unit => normalizeUnitCode(unit.unit) === parentUnit);
    if (!parent || String(parent.type || unitTypeFromCode(parent.unit)) !== 'Tribe') throw new Error('The split parent must be an existing Tribe from the beginning-of-turn workbook.');
    const startHex = String(parent.startHex || '').trim().toUpperCase();
    if (!startHex) throw new Error(`${parent.unit} has no starting hex in the beginning-of-turn workbook.`);

    if (unitType === 'Tribe' && !/^\d{4}$/.test(unitCode)) throw new Error('A new Tribe code must be exactly four digits, for example 1485.');
    if (unitType === 'Element') {
      const expected = new RegExp(`^${parentUnit}e\\d+$`);
      if (!expected.test(unitCode)) throw new Error(`An Element split from ${parent.unit} must use a code such as ${parent.unit}e1.`);
    }

    if (startUnits.some(unit => normalizeUnitCode(unit.unit) === unitCode)) throw new Error(`${unitCode} already exists in the beginning-of-turn workbook.`);
    const existing = this.db.prepare(`SELECT id FROM planned_unit_splits WHERE turn_key=? AND unit_code=?`).get(turnKey, unitCode);
    if (existing) throw new Error(`${unitCode} is already planned for Turn ${turnKey}.`);

    const now = new Date().toISOString();
    const inserted = this.db.prepare(`
      INSERT INTO planned_unit_splits(turn_key, parent_unit, unit_code, unit_type, unit_name, start_hex, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(turnKey, parent.unit, unitCode, unitType, unitName, startHex, now, now);
    return this.getUnitSplit(Number(inserted.lastInsertRowid));
  }

  getUnitSplit(id) {
    return this.db.prepare(`
      SELECT id, turn_key AS turnKey, parent_unit AS parentUnit, unit_code AS unitCode,
             unit_type AS unitType, unit_name AS unitName, start_hex AS startHex,
             created_at AS createdAt, updated_at AS updatedAt
      FROM planned_unit_splits WHERE id=?
    `).get(Number(id)) || null;
  }

  listUnitSplits(turnKey) {
    if (!turnKey) return [];
    return this.db.prepare(`
      SELECT id, turn_key AS turnKey, parent_unit AS parentUnit, unit_code AS unitCode,
             unit_type AS unitType, unit_name AS unitName, start_hex AS startHex,
             created_at AS createdAt, updated_at AS updatedAt
      FROM planned_unit_splits WHERE turn_key=? ORDER BY parent_unit, unit_code
    `).all(turnKey);
  }

  deleteUnitSplit(id) {
    const row = this.getUnitSplit(id);
    if (!row) return null;
    this.db.prepare('DELETE FROM planned_unit_splits WHERE id=?').run(Number(id));
    return row;
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

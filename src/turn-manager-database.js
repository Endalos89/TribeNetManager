const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

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
    const result = { turnKey, start: null, final: null, activities: this.listActivities(turnKey), context: this.getContext(turnKey) };
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

module.exports = { TurnManagerDatabase };

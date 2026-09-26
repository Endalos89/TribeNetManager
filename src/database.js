const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const CURRENT_SCHEMA = 2;

class TribeNetDatabase {
  constructor(userDataPath) {
    this.dataDir = path.join(userDataPath, 'data');
    this.backupDir = path.join(userDataPath, 'backups');
    this.dbPath = path.join(this.dataDir, 'tribenet.sqlite');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = this.db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get();
    const current = Number(row.version || 0);

    if (current > 0 && current < CURRENT_SCHEMA && fs.existsSync(this.dbPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `tribenet-before-schema-${CURRENT_SCHEMA}-${stamp}.sqlite`);
      try {
        this.db.exec('PRAGMA wal_checkpoint(FULL);');
        fs.copyFileSync(this.dbPath, backupPath);
      } catch (error) {
        console.warn('Database pre-migration backup failed:', error);
      }
    }

    if (current < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS hexes (
          coordinate TEXT PRIMARY KEY,
          map_row INTEGER NOT NULL,
          map_col INTEGER NOT NULL,
          hex_col INTEGER NOT NULL,
          hex_row INTEGER NOT NULL,
          global_col INTEGER NOT NULL,
          global_row INTEGER NOT NULL,
          terrain TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_hexes_global ON hexes(global_col, global_row);
        CREATE INDEX IF NOT EXISTS idx_hexes_submap ON hexes(map_row, map_col);
        INSERT INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
      `);
    }

    if (current < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS turn_imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          turn_key TEXT NOT NULL,
          source_file TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          plan_json TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_turn_imports_turn ON turn_imports(turn_key, imported_at DESC);
        CREATE INDEX IF NOT EXISTS idx_turn_imports_active ON turn_imports(is_active);

        CREATE TABLE IF NOT EXISTS hex_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          coordinate TEXT NOT NULL,
          turn_key TEXT,
          event_type TEXT NOT NULL,
          old_terrain TEXT,
          new_terrain TEXT,
          old_notes TEXT,
          new_notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_hex_history_coord ON hex_history(coordinate, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_hex_history_turn ON hex_history(turn_key, created_at DESC);
        INSERT INTO schema_migrations(version, applied_at) VALUES (2, datetime('now'));
      `);
    }
  }

  getHexesInArea(bounds) {
    const { minCol, maxCol, minRow, maxRow } = bounds;
    return this.db.prepare(`
      SELECT coordinate, terrain, notes, global_col AS globalCol, global_row AS globalRow,
             map_row AS mapRow, map_col AS mapCol, hex_col AS hexCol, hex_row AS hexRow, updated_at AS updatedAt
      FROM hexes
      WHERE global_col BETWEEN ? AND ? AND global_row BETWEEN ? AND ?
    `).all(minCol, maxCol, minRow, maxRow);
  }

  getHex(coordinate) {
    return this.db.prepare(`
      SELECT coordinate, terrain, notes, global_col AS globalCol, global_row AS globalRow,
             map_row AS mapRow, map_col AS mapCol, hex_col AS hexCol, hex_row AS hexRow, updated_at AS updatedAt
      FROM hexes WHERE coordinate = ?
    `).get(coordinate) || null;
  }

  addHexHistory(coordinate, turnKey, eventType, oldValue, newValue) {
    this.db.prepare(`
      INSERT INTO hex_history(coordinate, turn_key, event_type, old_terrain, new_terrain, old_notes, new_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      coordinate,
      turnKey || null,
      eventType,
      oldValue?.terrain || null,
      newValue?.terrain || null,
      oldValue?.notes || '',
      newValue?.notes || '',
      new Date().toISOString()
    );
  }

  saveHex(hex, context = {}) {
    const oldValue = this.getHex(hex.coordinate);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO hexes(
        coordinate, map_row, map_col, hex_col, hex_row, global_col, global_row, terrain, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(coordinate) DO UPDATE SET
        terrain = excluded.terrain,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run(
      hex.coordinate,
      hex.mapRow,
      hex.mapCol,
      hex.hexCol,
      hex.hexRow,
      hex.globalCol,
      hex.globalRow,
      hex.terrain,
      hex.notes || '',
      now
    );
    const saved = this.getHex(hex.coordinate);
    if (!oldValue || oldValue.terrain !== saved.terrain || oldValue.notes !== saved.notes) {
      this.addHexHistory(hex.coordinate, context.turnKey, oldValue ? 'updated' : 'revealed', oldValue, saved);
    }
    return saved;
  }

  clearHex(coordinate, context = {}) {
    const oldValue = this.getHex(coordinate);
    if (oldValue) {
      this.db.prepare('DELETE FROM hexes WHERE coordinate = ?').run(coordinate);
      this.addHexHistory(coordinate, context.turnKey, 'fogged', oldValue, null);
    }
    return true;
  }

  getHexHistory(coordinate) {
    return this.db.prepare(`
      SELECT id, coordinate, turn_key AS turnKey, event_type AS eventType,
             old_terrain AS oldTerrain, new_terrain AS newTerrain,
             old_notes AS oldNotes, new_notes AS newNotes, created_at AS createdAt
      FROM hex_history WHERE coordinate = ? ORDER BY id DESC LIMIT 100
    `).all(coordinate);
  }

  getSubmapSummaries() {
    return this.db.prepare(`
      SELECT map_row AS mapRow, map_col AS mapCol, COUNT(*) AS mapped
      FROM hexes
      GROUP BY map_row, map_col
    `).all();
  }

  saveTurnPlan(plan) {
    const importedAt = plan.importedAt || new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare('UPDATE turn_imports SET is_active = 0 WHERE is_active = 1').run();
      const result = this.db.prepare(`
        INSERT INTO turn_imports(turn_key, source_file, imported_at, plan_json, is_active)
        VALUES (?, ?, ?, ?, 1)
      `).run(plan.turnKey, plan.sourceFile, importedAt, JSON.stringify(plan));
      this.db.exec('COMMIT;');
      return this.getTurnPlan(Number(result.lastInsertRowid));
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  getTurnImports() {
    return this.db.prepare(`
      SELECT id, turn_key AS turnKey, source_file AS sourceFile, imported_at AS importedAt, is_active AS isActive
      FROM turn_imports ORDER BY id DESC
    `).all().map(r => ({ ...r, isActive: Boolean(r.isActive) }));
  }

  getTurnPlan(id = null) {
    const row = id
      ? this.db.prepare('SELECT * FROM turn_imports WHERE id = ?').get(id)
      : this.db.prepare('SELECT * FROM turn_imports WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
    if (!row) return null;
    return {
      id: Number(row.id), turnKey: row.turn_key, sourceFile: row.source_file,
      importedAt: row.imported_at, isActive: Boolean(row.is_active), plan: JSON.parse(row.plan_json)
    };
  }

  setActiveTurnPlan(id) {
    const row = this.db.prepare('SELECT id FROM turn_imports WHERE id = ?').get(id);
    if (!row) return null;
    this.db.prepare('UPDATE turn_imports SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END').run(id);
    return this.getTurnPlan(id);
  }

  createManualBackup() {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `tribenet-manual-${stamp}.sqlite`);
    fs.copyFileSync(this.dbPath, backupPath);
    return backupPath;
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { TribeNetDatabase };

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const CURRENT_SCHEMA = 1;

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

  saveHex(hex) {
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
    return this.getHex(hex.coordinate);
  }

  clearHex(coordinate) {
    this.db.prepare('DELETE FROM hexes WHERE coordinate = ?').run(coordinate);
    return true;
  }

  getSubmapSummaries() {
    return this.db.prepare(`
      SELECT map_row AS mapRow, map_col AS mapCol, COUNT(*) AS mapped
      FROM hexes
      GROUP BY map_row, map_col
    `).all();
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

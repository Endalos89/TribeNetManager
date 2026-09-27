const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

class PlannedRoutesDatabase {
  constructor(userDataPath) {
    const dataDir = path.join(userDataPath, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'planned-routes.sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS planned_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_key TEXT NOT NULL,
        unit_code TEXT NOT NULL,
        route_type TEXT NOT NULL CHECK(route_type IN ('unit','scout')),
        scout_number INTEGER,
        origin_hex TEXT NOT NULL,
        destination_hex TEXT NOT NULL,
        directions_json TEXT NOT NULL,
        path_json TEXT NOT NULL,
        known_mp INTEGER NOT NULL DEFAULT 0,
        unknown_entry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_planned_routes_turn ON planned_routes(turn_key, unit_code, route_type, scout_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_planned_routes_unit_unique
        ON planned_routes(turn_key, unit_code, route_type)
        WHERE route_type = 'unit';
    `);
  }

  rowToRecord(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      turnKey: row.turn_key,
      unitCode: row.unit_code,
      routeType: row.route_type,
      scoutNumber: row.scout_number == null ? null : Number(row.scout_number),
      originHex: row.origin_hex,
      destinationHex: row.destination_hex,
      directions: JSON.parse(row.directions_json || '[]'),
      path: JSON.parse(row.path_json || '[]'),
      knownMp: Number(row.known_mp || 0),
      unknownEntryCount: Number(row.unknown_entry_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  list(turnKey) {
    if (!turnKey) return [];
    return this.db.prepare(`
      SELECT * FROM planned_routes
      WHERE turn_key = ?
      ORDER BY CASE route_type WHEN 'unit' THEN 0 ELSE 1 END, unit_code, COALESCE(scout_number, 0), id
    `).all(turnKey).map(row => this.rowToRecord(row));
  }

  save(route) {
    const now = new Date().toISOString();
    const type = route.routeType === 'scout' ? 'scout' : 'unit';
    if (!route.turnKey || !route.unitCode || !route.originHex || !route.destinationHex) {
      throw new Error('Turn, unit, origin and destination are required to save a route.');
    }

    if (type === 'unit') {
      const existing = this.db.prepare(`
        SELECT id, created_at FROM planned_routes
        WHERE turn_key = ? AND unit_code = ? AND route_type = 'unit'
        LIMIT 1
      `).get(route.turnKey, route.unitCode);
      if (existing) {
        this.db.prepare(`
          UPDATE planned_routes SET
            origin_hex = ?, destination_hex = ?, directions_json = ?, path_json = ?,
            known_mp = ?, unknown_entry_count = ?, updated_at = ?
          WHERE id = ?
        `).run(
          route.originHex, route.destinationHex, JSON.stringify(route.directions || []), JSON.stringify(route.path || []),
          Number(route.knownMp || 0), Number(route.unknownEntryCount || 0), now, Number(existing.id)
        );
        return this.get(Number(existing.id));
      }
    }

    let scoutNumber = null;
    if (type === 'scout') {
      const next = this.db.prepare(`
        SELECT COALESCE(MAX(scout_number), 0) + 1 AS next
        FROM planned_routes WHERE turn_key = ? AND unit_code = ? AND route_type = 'scout'
      `).get(route.turnKey, route.unitCode);
      scoutNumber = Number(next?.next || 1);
    }

    const result = this.db.prepare(`
      INSERT INTO planned_routes(
        turn_key, unit_code, route_type, scout_number, origin_hex, destination_hex,
        directions_json, path_json, known_mp, unknown_entry_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      route.turnKey, route.unitCode, type, scoutNumber, route.originHex, route.destinationHex,
      JSON.stringify(route.directions || []), JSON.stringify(route.path || []),
      Number(route.knownMp || 0), Number(route.unknownEntryCount || 0), now, now
    );
    return this.get(Number(result.lastInsertRowid));
  }

  get(id) {
    return this.rowToRecord(this.db.prepare('SELECT * FROM planned_routes WHERE id = ?').get(Number(id)));
  }

  remove(id) {
    return this.db.prepare('DELETE FROM planned_routes WHERE id = ?').run(Number(id)).changes > 0;
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { PlannedRoutesDatabase };

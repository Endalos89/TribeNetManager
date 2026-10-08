const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function rootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

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
        tribe_code TEXT,
        unit_code TEXT NOT NULL,
        route_type TEXT NOT NULL CHECK(route_type IN ('unit','scout')),
        scout_number INTEGER,
        origin_hex TEXT NOT NULL,
        destination_hex TEXT NOT NULL,
        directions_json TEXT NOT NULL,
        path_json TEXT NOT NULL,
        known_mp INTEGER NOT NULL DEFAULT 0,
        unknown_entry_count INTEGER NOT NULL DEFAULT 0,
        scout_count INTEGER,
        horse_count INTEGER,
        mission TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const columns = new Set(this.db.prepare('PRAGMA table_info(planned_routes)').all().map(row => row.name));
    if (!columns.has('tribe_code')) this.db.exec('ALTER TABLE planned_routes ADD COLUMN tribe_code TEXT;');
    if (!columns.has('scout_count')) this.db.exec('ALTER TABLE planned_routes ADD COLUMN scout_count INTEGER;');
    if (!columns.has('horse_count')) this.db.exec('ALTER TABLE planned_routes ADD COLUMN horse_count INTEGER;');
    if (!columns.has('mission')) this.db.exec('ALTER TABLE planned_routes ADD COLUMN mission TEXT;');
    this.db.prepare(`UPDATE planned_routes SET tribe_code = substr(unit_code, 1, 4) WHERE tribe_code IS NULL OR tribe_code = ''`).run();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_planned_routes_turn ON planned_routes(turn_key, tribe_code, unit_code, route_type, scout_number);
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
      tribeCode: row.tribe_code || rootTribe(row.unit_code),
      unitCode: row.unit_code,
      routeType: row.route_type,
      scoutNumber: row.scout_number == null ? null : Number(row.scout_number),
      originHex: row.origin_hex,
      destinationHex: row.destination_hex,
      directions: JSON.parse(row.directions_json || '[]'),
      path: JSON.parse(row.path_json || '[]'),
      knownMp: Number(row.known_mp || 0),
      unknownEntryCount: Number(row.unknown_entry_count || 0),
      noOfScouts: row.scout_count == null ? null : Number(row.scout_count),
      noOfHorses: row.horse_count == null ? null : Number(row.horse_count),
      mission: row.mission || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  list(turnKey) {
    if (!turnKey) return [];
    return this.db.prepare(`
      SELECT * FROM planned_routes
      WHERE turn_key = ?
      ORDER BY tribe_code, CASE route_type WHEN 'unit' THEN 0 ELSE 1 END, COALESCE(scout_number, 0), unit_code, id
    `).all(turnKey).map(row => this.rowToRecord(row));
  }

  save(route) {
    const now = new Date().toISOString();
    const type = route.routeType === 'scout' ? 'scout' : 'unit';
    const tribeCode = String(route.tribeCode || rootTribe(route.unitCode));
    if (!route.turnKey || !route.unitCode || !tribeCode || !route.originHex || !route.destinationHex) {
      throw new Error('Turn, Tribe, unit, origin and destination are required to save a route.');
    }

    if (type === 'unit') {
      const existing = this.db.prepare(`
        SELECT id FROM planned_routes
        WHERE turn_key = ? AND unit_code = ? AND route_type = 'unit'
        LIMIT 1
      `).get(route.turnKey, route.unitCode);
      if (existing) {
        this.db.prepare(`
          UPDATE planned_routes SET
            tribe_code = ?, origin_hex = ?, destination_hex = ?, directions_json = ?, path_json = ?,
            known_mp = ?, unknown_entry_count = ?, scout_count = ?, horse_count = ?, mission = ?, updated_at = ?
          WHERE id = ?
        `).run(
          tribeCode, route.originHex, route.destinationHex, JSON.stringify(route.directions || []), JSON.stringify(route.path || []),
          Number(route.knownMp || 0), Number(route.unknownEntryCount || 0), route.noOfScouts == null ? null : Number(route.noOfScouts), route.noOfHorses == null ? null : Number(route.noOfHorses), route.mission || null, now, Number(existing.id)
        );
        return this.get(Number(existing.id));
      }
    }

    let scoutNumber = null;
    if (type === 'scout') {
      const existingScouts = this.db.prepare(`
        SELECT scout_number AS scoutNumber FROM planned_routes
        WHERE turn_key = ? AND tribe_code = ? AND route_type = 'scout'
        ORDER BY scout_number
      `).all(route.turnKey, tribeCode);
      if (existingScouts.length >= 8) {
        throw new Error(`Tribe ${tribeCode} and its linked Elements already have the maximum 8 scout moves for Turn ${route.turnKey}.`);
      }
      const used = new Set(existingScouts.map(row => Number(row.scoutNumber)));
      scoutNumber = Array.from({ length: 8 }, (_, index) => index + 1).find(number => !used.has(number));
    }

    const result = this.db.prepare(`
      INSERT INTO planned_routes(
        turn_key, tribe_code, unit_code, route_type, scout_number, origin_hex, destination_hex,
        directions_json, path_json, known_mp, unknown_entry_count, created_at, updated_at
      , scout_count, horse_count, mission
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      route.turnKey, tribeCode, route.unitCode, type, scoutNumber, route.originHex, route.destinationHex,
      JSON.stringify(route.directions || []), JSON.stringify(route.path || []),
      Number(route.knownMp || 0), Number(route.unknownEntryCount || 0), now, now,
      route.noOfScouts == null ? null : Number(route.noOfScouts), route.noOfHorses == null ? null : Number(route.noOfHorses), route.mission || null
    );
    return this.get(Number(result.lastInsertRowid));
  }

  get(id) {
    return this.rowToRecord(this.db.prepare('SELECT * FROM planned_routes WHERE id = ?').get(Number(id)));
  }

  remove(id) {
    return this.db.prepare('DELETE FROM planned_routes WHERE id = ?').run(Number(id)).changes > 0;
  }

  removeForUnit(turnKey, unitCode) {
    if (!turnKey || !unitCode) return 0;
    return Number(this.db.prepare('DELETE FROM planned_routes WHERE turn_key = ? AND unit_code = ?').run(turnKey, unitCode).changes || 0);
  }

  removeAllUnitRoutes(turnKey) {
    if (!turnKey) return 0;
    return Number(this.db.prepare("DELETE FROM planned_routes WHERE turn_key = ? AND route_type = 'unit'").run(turnKey).changes || 0);
  }

  removeAllScoutRoutesForUnit(turnKey, unitCode) {
    if (!turnKey || !unitCode) return 0;
    return Number(this.db.prepare("DELETE FROM planned_routes WHERE turn_key = ? AND unit_code = ? AND route_type = 'scout'").run(turnKey, unitCode).changes || 0);
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { PlannedRoutesDatabase, rootTribe };

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const CURRENT_SCHEMA = 2;

function deepDelta(current, previous) {
  const delta = {};
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(previous || {})]);
  for (const key of keys) {
    const a = current?.[key];
    const b = previous?.[key];
    if (typeof a === 'number' || typeof b === 'number') delta[key] = Number(a || 0) - Number(b || 0);
  }
  return delta;
}

function snapshotDeltas(current, previous) {
  const resourceDeltas = {};
  const sections = new Set([
    ...Object.keys(current?.resources || {}),
    ...Object.keys(previous?.resources || {})
  ]);
  for (const section of sections) {
    resourceDeltas[section] = deepDelta(current?.resources?.[section] || {}, previous?.resources?.[section] || {});
  }
  return {
    people: deepDelta(current?.people || {}, previous?.people || {}),
    resources: resourceDeltas,
    skills: deepDelta(current?.skills || {}, previous?.skills || {}),
    morale: current?.morale == null ? null : Number(current.morale || 0) - Number(previous?.morale || 0),
    weight: current?.weight == null ? null : Number(current.weight || 0) - Number(previous?.weight || 0),
    walkingCapacity: current?.walkingCapacity == null ? null : Number(current.walkingCapacity || 0) - Number(previous?.walkingCapacity || 0),
    mountedCapacity: current?.mountedCapacity == null ? null : Number(current.mountedCapacity || 0) - Number(previous?.mountedCapacity || 0)
  };
}

function parseStoredCoordinate(coordinate) {
  const match = String(coordinate || '').match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!match) return null;
  const mapRow = match[1].charCodeAt(0) - 65;
  const mapCol = match[2].charCodeAt(0) - 65;
  const hexCol = Number(match[3]);
  const hexRow = Number(match[4]);
  return {
    mapRow,
    mapCol,
    hexCol,
    hexRow,
    globalCol: mapCol * 30 + hexCol - 1,
    globalRow: mapRow * 21 + hexRow - 1
  };
}

function safeSourceFileName(turnKey) {
  const safeTurn = String(turnKey || 'unknown-turn').replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${safeTurn}.docx`;
}

class ResultsDatabase {
  constructor(userDataPath) {
    this.dataDir = path.join(userDataPath, 'data');
    this.backupDir = path.join(userDataPath, 'backups');
    this.sourceDir = path.join(this.dataDir, 'result-reports');
    this.dbPath = path.join(this.dataDir, 'results.sqlite');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(this.sourceDir, { recursive: true });
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
      try {
        this.db.exec('PRAGMA wal_checkpoint(FULL);');
        fs.copyFileSync(this.dbPath, path.join(this.backupDir, `results-before-schema-${CURRENT_SCHEMA}-${stamp}.sqlite`));
      } catch (error) {
        console.warn('Results database pre-migration backup failed:', error);
      }
    }
    if (current < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS result_turns (
          turn_key TEXT PRIMARY KEY,
          turn_sort INTEGER NOT NULL,
          source_file TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_result_turns_sort ON result_turns(turn_sort);

        CREATE TABLE IF NOT EXISTS result_units (
          turn_key TEXT NOT NULL,
          unit_code TEXT NOT NULL,
          unit_type TEXT NOT NULL,
          current_hex TEXT,
          previous_hex TEXT,
          snapshot_json TEXT NOT NULL,
          PRIMARY KEY(turn_key, unit_code),
          FOREIGN KEY(turn_key) REFERENCES result_turns(turn_key) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_result_units_code ON result_units(unit_code, turn_key);
        CREATE INDEX IF NOT EXISTS idx_result_units_hex ON result_units(current_hex);

        CREATE TABLE IF NOT EXISTS result_hex_knowledge (
          turn_key TEXT NOT NULL,
          coordinate TEXT NOT NULL,
          terrain TEXT NOT NULL,
          knowledge_level TEXT NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          source_unit TEXT,
          scout_id INTEGER,
          observed_units_json TEXT NOT NULL DEFAULT '[]',
          evidence_json TEXT NOT NULL DEFAULT '[]',
          PRIMARY KEY(turn_key, coordinate),
          FOREIGN KEY(turn_key) REFERENCES result_turns(turn_key) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_result_hex_coordinate ON result_hex_knowledge(coordinate, turn_key);

        CREATE TABLE IF NOT EXISTS result_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          turn_key TEXT NOT NULL,
          unit_code TEXT,
          event_type TEXT NOT NULL,
          message TEXT NOT NULL,
          details_json TEXT NOT NULL DEFAULT '{}',
          FOREIGN KEY(turn_key) REFERENCES result_turns(turn_key) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_result_events_turn ON result_events(turn_key, id);
        CREATE INDEX IF NOT EXISTS idx_result_events_unit ON result_events(unit_code, turn_key);

        INSERT INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
      `);
    }
    if (current < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS result_sources (
          turn_key TEXT PRIMARY KEY,
          original_file_name TEXT NOT NULL,
          stored_file_name TEXT NOT NULL,
          archived_at TEXT NOT NULL
        );
        INSERT INTO schema_migrations(version, applied_at) VALUES (2, datetime('now'));
      `);
    }
  }

  archiveSource(turnKey, filePath, originalFileName = null) {
    if (!turnKey || !filePath) throw new Error('A turn key and source report path are required.');
    if (!fs.existsSync(filePath)) throw new Error(`Source report was not found: ${filePath}`);
    const storedFileName = safeSourceFileName(turnKey);
    const storedPath = path.join(this.sourceDir, storedFileName);
    const originalName = originalFileName || path.basename(filePath);
    fs.copyFileSync(filePath, storedPath);
    this.db.prepare(`
      INSERT INTO result_sources(turn_key, original_file_name, stored_file_name, archived_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(turn_key) DO UPDATE SET
        original_file_name = excluded.original_file_name,
        stored_file_name = excluded.stored_file_name,
        archived_at = excluded.archived_at
    `).run(turnKey, originalName, storedFileName, new Date().toISOString());
    return { turnKey, originalFileName: originalName, storedFileName, storedPath, exists: true };
  }

  listSources() {
    return this.db.prepare(`
      SELECT rs.turn_key AS turnKey, rs.original_file_name AS originalFileName,
             rs.stored_file_name AS storedFileName, rs.archived_at AS archivedAt,
             COALESCE(rt.turn_sort, 999999999) AS turnSort
      FROM result_sources rs
      LEFT JOIN result_turns rt ON rt.turn_key = rs.turn_key
      ORDER BY turnSort ASC, rs.turn_key ASC
    `).all().map(row => {
      const storedPath = path.join(this.sourceDir, row.storedFileName);
      return {
        turnKey: row.turnKey,
        originalFileName: row.originalFileName,
        storedFileName: row.storedFileName,
        storedPath,
        archivedAt: row.archivedAt,
        turnSort: Number(row.turnSort),
        exists: fs.existsSync(storedPath)
      };
    });
  }

  getReprocessStatus() {
    const turns = this.listTurns();
    const sources = this.listSources();
    const sourceTurns = new Set(sources.filter(source => source.exists).map(source => source.turnKey));
    return {
      totalTurns: turns.length,
      archivedSources: sources.filter(source => source.exists).length,
      missingSourceTurns: turns.filter(turn => !sourceTurns.has(turn.turnKey)).map(turn => turn.turnKey)
    };
  }

  saveReport(report) {
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare('DELETE FROM result_turns WHERE turn_key = ?').run(report.turnKey);
      this.db.prepare(`
        INSERT INTO result_turns(turn_key, turn_sort, source_file, imported_at, metadata_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(report.turnKey, report.turnSort, report.sourceFile, now, JSON.stringify(report.metadata || {}));

      const unitInsert = this.db.prepare(`
        INSERT INTO result_units(turn_key, unit_code, unit_type, current_hex, previous_hex, snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const unit of report.units || []) {
        unitInsert.run(report.turnKey, unit.unitCode, unit.unitType, unit.currentHex || null, unit.previousHex || null, JSON.stringify(unit));
      }

      const hexInsert = this.db.prepare(`
        INSERT INTO result_hex_knowledge(
          turn_key, coordinate, terrain, knowledge_level, reason, source_unit, scout_id, observed_units_json, evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const hex of report.hexKnowledge || []) {
        hexInsert.run(
          report.turnKey,
          hex.coordinate,
          hex.terrain || 'UNKNOWN',
          hex.knowledgeLevel || 'observed',
          hex.reason || '',
          hex.sourceUnit || null,
          hex.scoutId ?? null,
          JSON.stringify(hex.observedUnits || []),
          JSON.stringify(hex.evidence || [])
        );
      }

      const eventInsert = this.db.prepare(`
        INSERT INTO result_events(turn_key, unit_code, event_type, message, details_json)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const event of report.events || []) {
        eventInsert.run(report.turnKey, event.unitCode || null, event.eventType || 'note', event.message || '', JSON.stringify(event.details || {}));
      }
      this.db.exec('COMMIT;');
      return this.getTurn(report.turnKey);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  listTurns() {
    return this.db.prepare(`
      SELECT turn_key AS turnKey, turn_sort AS turnSort, source_file AS sourceFile, imported_at AS importedAt, metadata_json AS metadataJson
      FROM result_turns ORDER BY turn_sort ASC, turn_key ASC
    `).all().map(row => ({
      turnKey: row.turnKey,
      turnSort: Number(row.turnSort),
      sourceFile: row.sourceFile,
      importedAt: row.importedAt,
      metadata: JSON.parse(row.metadataJson || '{}')
    }));
  }

  previousUnitSnapshot(unitCode, turnSortValue) {
    const row = this.db.prepare(`
      SELECT ru.snapshot_json AS snapshotJson, rt.turn_key AS turnKey
      FROM result_units ru
      JOIN result_turns rt ON rt.turn_key = ru.turn_key
      WHERE ru.unit_code = ? AND rt.turn_sort < ?
      ORDER BY rt.turn_sort DESC LIMIT 1
    `).get(unitCode, turnSortValue);
    if (!row) return null;
    return { turnKey: row.turnKey, snapshot: JSON.parse(row.snapshotJson) };
  }

  getTurn(turnKey) {
    const turn = this.db.prepare(`
      SELECT turn_key AS turnKey, turn_sort AS turnSort, source_file AS sourceFile, imported_at AS importedAt, metadata_json AS metadataJson
      FROM result_turns WHERE turn_key = ?
    `).get(turnKey);
    if (!turn) return null;

    const units = this.db.prepare(`
      SELECT snapshot_json AS snapshotJson FROM result_units WHERE turn_key = ? ORDER BY unit_type, unit_code
    `).all(turnKey).map(row => JSON.parse(row.snapshotJson));

    const enrichedUnits = units.map(unit => {
      const previous = this.previousUnitSnapshot(unit.unitCode, Number(turn.turnSort));
      return {
        ...unit,
        previousTurnKey: previous?.turnKey || null,
        previous: previous?.snapshot || null,
        deltas: snapshotDeltas(unit, previous?.snapshot || null)
      };
    });

    const events = this.db.prepare(`
      SELECT id, unit_code AS unitCode, event_type AS eventType, message, details_json AS detailsJson
      FROM result_events WHERE turn_key = ? ORDER BY id ASC
    `).all(turnKey).map(row => ({ ...row, details: JSON.parse(row.detailsJson || '{}') }));

    return {
      turnKey: turn.turnKey,
      turnSort: Number(turn.turnSort),
      sourceFile: turn.sourceFile,
      importedAt: turn.importedAt,
      metadata: JSON.parse(turn.metadataJson || '{}'),
      units: enrichedUnits,
      events
    };
  }

  getHexesInArea(bounds, turnKey) {
    const turn = this.db.prepare('SELECT turn_sort AS turnSort FROM result_turns WHERE turn_key = ?').get(turnKey);
    if (!turn) return [];
    const { minCol, maxCol, minRow, maxRow } = bounds;
    return this.db.prepare(`
      WITH ranked AS (
        SELECT hk.*, rt.turn_sort,
               ROW_NUMBER() OVER (PARTITION BY hk.coordinate ORDER BY rt.turn_sort DESC) AS rn
        FROM result_hex_knowledge hk
        JOIN result_turns rt ON rt.turn_key = hk.turn_key
        WHERE rt.turn_sort <= ?
      )
      SELECT coordinate, terrain, knowledge_level AS knowledgeLevel, reason, source_unit AS sourceUnit, scout_id AS scoutId,
             observed_units_json AS observedUnitsJson, evidence_json AS evidenceJson, turn_key AS discoveredTurn
      FROM ranked
      WHERE rn = 1
    `).all(Number(turn.turnSort)).map(row => {
      const parsed = parseStoredCoordinate(row.coordinate);
      return {
        coordinate: row.coordinate,
        terrain: row.terrain,
        knowledgeLevel: row.knowledgeLevel,
        reason: row.reason,
        sourceUnit: row.sourceUnit,
        scoutId: row.scoutId,
        observedUnits: JSON.parse(row.observedUnitsJson || '[]'),
        evidence: JSON.parse(row.evidenceJson || '[]'),
        discoveredTurn: row.discoveredTurn,
        ...parsed
      };
    }).filter(row => row.globalCol >= minCol && row.globalCol <= maxCol && row.globalRow >= minRow && row.globalRow <= maxRow);
  }

  getHexHistory(coordinate) {
    return this.db.prepare(`
      SELECT hk.turn_key AS turnKey, rt.turn_sort AS turnSort, hk.terrain, hk.knowledge_level AS knowledgeLevel,
             hk.reason, hk.source_unit AS sourceUnit, hk.scout_id AS scoutId,
             hk.observed_units_json AS observedUnitsJson, hk.evidence_json AS evidenceJson
      FROM result_hex_knowledge hk
      JOIN result_turns rt ON rt.turn_key = hk.turn_key
      WHERE hk.coordinate = ?
      ORDER BY rt.turn_sort ASC
    `).all(coordinate).map(row => ({
      turnKey: row.turnKey,
      turnSort: Number(row.turnSort),
      terrain: row.terrain,
      knowledgeLevel: row.knowledgeLevel,
      reason: row.reason,
      sourceUnit: row.sourceUnit,
      scoutId: row.scoutId,
      observedUnits: JSON.parse(row.observedUnitsJson || '[]'),
      evidence: JSON.parse(row.evidenceJson || '[]')
    }));
  }

  getSubmapSummaries(turnKey) {
    const turn = this.db.prepare('SELECT turn_sort AS turnSort FROM result_turns WHERE turn_key = ?').get(turnKey);
    if (!turn) return [];
    const rows = this.db.prepare(`
      WITH ranked AS (
        SELECT hk.coordinate, rt.turn_sort,
               ROW_NUMBER() OVER (PARTITION BY hk.coordinate ORDER BY rt.turn_sort DESC) AS rn
        FROM result_hex_knowledge hk
        JOIN result_turns rt ON rt.turn_key = hk.turn_key
        WHERE rt.turn_sort <= ?
      )
      SELECT coordinate FROM ranked WHERE rn = 1
    `).all(Number(turn.turnSort));
    const counts = new Map();
    for (const row of rows) {
      const parsed = parseStoredCoordinate(row.coordinate);
      if (!parsed) continue;
      const key = `${parsed.mapRow}:${parsed.mapCol}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([key, mapped]) => {
      const [mapRow, mapCol] = key.split(':').map(Number);
      return { mapRow, mapCol, mapped };
    });
  }

  createBackup() {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `results-manual-${stamp}.sqlite`);
    fs.copyFileSync(this.dbPath, backupPath);
    return backupPath;
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { ResultsDatabase, snapshotDeltas, deepDelta, safeSourceFileName };

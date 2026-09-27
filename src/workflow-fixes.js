const { canonicalTurnKey } = require('./turn-key');

function patchTurnManagerParser() {
  const parser = require('./turn-manager-parser');
  const original = parser.parseTurnWorkbook;
  parser.parseTurnWorkbook = function parseTurnWorkbookCanonical(filePath, role) {
    const parsed = original(filePath, role);
    const key = canonicalTurnKey(parsed.turnKey);
    parsed.turnKey = key;
    if (parsed.rawPlan) parsed.rawPlan = { ...parsed.rawPlan, turnKey: key };
    return parsed;
  };
}

function patchMainDatabase() {
  const { TribeNetDatabase } = require('./database');
  const originalMigrate = TribeNetDatabase.prototype.migrate;
  TribeNetDatabase.prototype.migrate = function migrateAndNormalizeTurns() {
    originalMigrate.call(this);
    const rows = this.db.prepare('SELECT id, turn_key AS turnKey, plan_json AS planJson FROM turn_imports').all();
    for (const row of rows) {
      const key = canonicalTurnKey(row.turnKey);
      if (!key) continue;
      let planJson = row.planJson;
      try {
        const plan = JSON.parse(row.planJson || '{}');
        plan.turnKey = key;
        planJson = JSON.stringify(plan);
      } catch (_) {}
      if (key !== row.turnKey || planJson !== row.planJson) {
        this.db.prepare('UPDATE turn_imports SET turn_key=?, plan_json=? WHERE id=?').run(key, planJson, row.id);
      }
    }
  };

  const originalSave = TribeNetDatabase.prototype.saveTurnPlan;
  TribeNetDatabase.prototype.saveTurnPlan = function saveCanonicalTurnPlan(plan) {
    const key = canonicalTurnKey(plan?.turnKey);
    const normalized = { ...(plan || {}), turnKey: key };
    // A completed workbook is authoritative for its turn: retain one submitted copy per turn.
    if (key) this.db.prepare('DELETE FROM turn_imports WHERE turn_key=?').run(key);
    return originalSave.call(this, normalized);
  };

  const originalImports = TribeNetDatabase.prototype.getTurnImports;
  TribeNetDatabase.prototype.getTurnImports = function getCanonicalTurnImports(turnKey = null) {
    return originalImports.call(this, turnKey ? canonicalTurnKey(turnKey) : null);
  };

  const originalTurnPlan = TribeNetDatabase.prototype.getTurnPlanForTurn;
  TribeNetDatabase.prototype.getTurnPlanForTurn = function getCanonicalTurnPlan(turnKey) {
    return originalTurnPlan.call(this, canonicalTurnKey(turnKey));
  };
}

function patchTurnManagerDatabase() {
  const { TurnManagerDatabase } = require('./turn-manager-database');
  const originalMigrate = TurnManagerDatabase.prototype.migrate;
  TurnManagerDatabase.prototype.migrate = function migrateAndNormalizeTurns() {
    originalMigrate.call(this);
    const rows = this.db.prepare('SELECT id, turn_key AS turnKey, role, workbook_json AS workbookJson FROM turn_workbooks ORDER BY id').all();
    for (const row of rows) {
      const key = canonicalTurnKey(row.turnKey);
      if (!key) continue;
      let workbookJson = row.workbookJson;
      try {
        const data = JSON.parse(row.workbookJson || '{}');
        data.turnKey = key;
        if (data.rawPlan) data.rawPlan.turnKey = key;
        workbookJson = JSON.stringify(data);
      } catch (_) {}
      const conflict = this.db.prepare('SELECT id FROM turn_workbooks WHERE turn_key=? AND role=? AND id<>?').get(key, row.role, row.id);
      if (conflict) {
        // Keep the newest record when legacy 906-4 and canonical 906-04 both exist.
        const keepId = Math.max(Number(conflict.id), Number(row.id));
        const dropId = keepId === Number(row.id) ? Number(conflict.id) : Number(row.id);
        if (keepId === Number(row.id)) {
          this.db.prepare('DELETE FROM turn_workbooks WHERE id=?').run(dropId);
          this.db.prepare('UPDATE turn_workbooks SET turn_key=?, workbook_json=? WHERE id=?').run(key, workbookJson, keepId);
        } else {
          this.db.prepare('DELETE FROM turn_workbooks WHERE id=?').run(dropId);
        }
      } else if (key !== row.turnKey || workbookJson !== row.workbookJson) {
        this.db.prepare('UPDATE turn_workbooks SET turn_key=?, workbook_json=? WHERE id=?').run(key, workbookJson, row.id);
      }
    }

    for (const table of ['planned_activities', 'planned_unit_splits']) {
      const keys = this.db.prepare(`SELECT DISTINCT turn_key AS turnKey FROM ${table}`).all();
      for (const row of keys) {
        const key = canonicalTurnKey(row.turnKey);
        if (key && key !== row.turnKey) {
          try { this.db.prepare(`UPDATE ${table} SET turn_key=? WHERE turn_key=?`).run(key, row.turnKey); } catch (_) {}
        }
      }
    }
    const contextRows = this.db.prepare('SELECT turn_key AS turnKey, notes, updated_at AS updatedAt FROM turn_context').all();
    for (const row of contextRows) {
      const key = canonicalTurnKey(row.turnKey);
      if (!key || key === row.turnKey) continue;
      const existing = this.db.prepare('SELECT turn_key FROM turn_context WHERE turn_key=?').get(key);
      if (existing) this.db.prepare('DELETE FROM turn_context WHERE turn_key=?').run(row.turnKey);
      else this.db.prepare('UPDATE turn_context SET turn_key=? WHERE turn_key=?').run(key, row.turnKey);
    }
  };

  const originalSave = TurnManagerDatabase.prototype.saveWorkbook;
  TurnManagerDatabase.prototype.saveWorkbook = function saveCanonicalWorkbook(parsed) {
    const key = canonicalTurnKey(parsed?.turnKey);
    const normalized = { ...(parsed || {}), turnKey: key };
    if (normalized.rawPlan) normalized.rawPlan = { ...normalized.rawPlan, turnKey: key };
    return originalSave.call(this, normalized);
  };

  const originalGet = TurnManagerDatabase.prototype.getTurn;
  TurnManagerDatabase.prototype.getTurn = function getCanonicalManagedTurn(turnKey) {
    return originalGet.call(this, canonicalTurnKey(turnKey));
  };
}

function patchResultsDatabase() {
  const { ResultsDatabase } = require('./results-database');
  const originalSave = ResultsDatabase.prototype.saveReport;
  ResultsDatabase.prototype.saveReport = function saveCanonicalResult(report) {
    const key = canonicalTurnKey(report?.turnKey);
    return originalSave.call(this, { ...(report || {}), turnKey: key });
  };
  const originalGet = ResultsDatabase.prototype.getTurn;
  ResultsDatabase.prototype.getTurn = function getCanonicalResult(turnKey) {
    return originalGet.call(this, canonicalTurnKey(turnKey));
  };
  const originalArchive = ResultsDatabase.prototype.archiveSource;
  ResultsDatabase.prototype.archiveSource = function archiveCanonicalSource(turnKey, filePath, originalFileName) {
    return originalArchive.call(this, canonicalTurnKey(turnKey), filePath, originalFileName);
  };
}

function patchPlannedRoutesDatabase() {
  const { PlannedRoutesDatabase } = require('./planned-routes-database');
  const originalList = PlannedRoutesDatabase.prototype.list;
  PlannedRoutesDatabase.prototype.list = function listCanonicalRoutes(turnKey) {
    return originalList.call(this, canonicalTurnKey(turnKey));
  };
  const originalSave = PlannedRoutesDatabase.prototype.save;
  PlannedRoutesDatabase.prototype.save = function saveCanonicalRoute(route) {
    return originalSave.call(this, { ...(route || {}), turnKey: canonicalTurnKey(route?.turnKey) });
  };
  const originalRemove = PlannedRoutesDatabase.prototype.removeForUnit;
  PlannedRoutesDatabase.prototype.removeForUnit = function removeCanonicalRoutes(turnKey, unitCode) {
    return originalRemove.call(this, canonicalTurnKey(turnKey), unitCode);
  };
}

patchTurnManagerParser();
patchMainDatabase();
patchTurnManagerDatabase();
patchResultsDatabase();
patchPlannedRoutesDatabase();

module.exports = { canonicalTurnKey };

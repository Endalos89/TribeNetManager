const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

class FairDatabase {
  constructor(userDataPath) {
    this.dataDir = path.join(userDataPath, 'data');
    this.backupDir = path.join(userDataPath, 'backups');
    this.sourceDir = path.join(this.dataDir, 'fair-workbooks');
    this.dbPath = path.join(this.dataDir, 'fair.sqlite');
    fs.mkdirSync(this.dataDir, { recursive:true });
    fs.mkdirSync(this.backupDir, { recursive:true });
    fs.mkdirSync(this.sourceDir, { recursive:true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fair_snapshots (
        turn_key TEXT PRIMARY KEY,
        turn_sort INTEGER NOT NULL,
        source_file TEXT NOT NULL,
        archive_file TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fair_snapshots_sort ON fair_snapshots(turn_sort);
    `);
  }

  archiveSource(snapshot, filePath) {
    const ext = path.extname(filePath) || '.xlsx';
    const archiveName = `${String(snapshot.turnKey).replace(/[^A-Za-z0-9._-]+/g, '_')}${ext.toLowerCase()}`;
    const destination = path.join(this.sourceDir, archiveName);
    fs.copyFileSync(filePath, destination);
    return archiveName;
  }

  saveSnapshot(snapshot, filePath) {
    if (!snapshot?.turnKey) throw new Error('A Fair turn key is required.');
    const archiveFile = this.archiveSource(snapshot, filePath);
    const stored = { ...snapshot, archiveFile };
    this.db.prepare(`
      INSERT INTO fair_snapshots(turn_key, turn_sort, source_file, archive_file, imported_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(turn_key) DO UPDATE SET
        turn_sort=excluded.turn_sort,
        source_file=excluded.source_file,
        archive_file=excluded.archive_file,
        imported_at=excluded.imported_at,
        snapshot_json=excluded.snapshot_json
    `).run(stored.turnKey, Number(stored.turnSort || 0), stored.sourceFile || '', archiveFile, stored.importedAt, JSON.stringify(stored));
    return this.getSnapshot(stored.turnKey);
  }

  listSnapshots() {
    return this.db.prepare(`
      SELECT turn_key AS turnKey, turn_sort AS turnSort, source_file AS sourceFile,
             archive_file AS archiveFile, imported_at AS importedAt, snapshot_json AS snapshotJson
      FROM fair_snapshots ORDER BY turn_sort ASC, turn_key ASC
    `).all().map(row => {
      let snapshot = {};
      try { snapshot = JSON.parse(row.snapshotJson); } catch (_) {}
      return {
        turnKey:row.turnKey,
        turnSort:Number(row.turnSort || 0),
        year:Number(snapshot.year || 0),
        month:Number(snapshot.month || 0),
        sourceFile:row.sourceFile,
        importedAt:row.importedAt,
        maxTransactions:Number(snapshot.maxTransactions || 10),
        itemCount:Array.isArray(snapshot.items) ? snapshot.items.length : 0
      };
    });
  }

  getSnapshot(turnKey) {
    const row = this.db.prepare('SELECT snapshot_json AS snapshotJson FROM fair_snapshots WHERE turn_key=?').get(turnKey);
    if (!row) return null;
    try { return JSON.parse(row.snapshotJson); }
    catch (_) { return null; }
  }

  createBackup() {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `fair-${stamp}.sqlite`);
    fs.copyFileSync(this.dbPath, backupPath);
    return backupPath;
  }

  close() { if (this.db) this.db.close(); }
}

module.exports = { FairDatabase };

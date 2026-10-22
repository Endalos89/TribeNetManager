const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveOrdersExportPath, canonicalOrdersFilename } = require('../src/orders-export-path');
const { preferredLibraryRoot, legacyLibraryRoot, migrateLegacyLibrary } = require('../src/tribenet-files-path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-orders-path-'));
const app = { isPackaged: true, getPath: name => name === 'userData' ? temp : path.join(temp, 'Documents') };
const preferred = path.join(temp, 'preferred', 'TribeNet Files');

try {
  assert.equal(preferredLibraryRoot(app), path.join(temp, 'Documents', 'TribeNet Files'));
  assert.equal(legacyLibraryRoot(app, { executablePath: path.join(temp, 'Program Files', 'TribeNet Manager.exe') }), path.join(temp, 'Program Files', 'TribeNet Files'));

  const first = resolveOrdersExportPath(app, '906-04', { preferredRoot: preferred });
  assert.equal(path.basename(first.outputPath), canonicalOrdersFilename('906-04'));
  assert.equal(first.updatedExisting, false);
  fs.writeFileSync(first.outputPath, 'existing');
  const second = resolveOrdersExportPath(app, '906-04', { preferredRoot: preferred });
  assert.equal(second.outputPath, first.outputPath);
  assert.equal(second.updatedExisting, true);

  const legacy = path.join(temp, 'legacy-install', 'TribeNet Files');
  const documents = path.join(temp, 'Documents', 'TribeNet Files');
  fs.mkdirSync(path.join(legacy, 'Completed Orders'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'Completed Orders', '906_04_Orders Complete.xlsx'), 'legacy workbook');
  fs.writeFileSync(path.join(legacy, 'Completed Orders', '~$906_04_Orders Complete.xlsx'), 'Excel lock file');
  const migration = migrateLegacyLibrary(legacy, documents);
  assert.equal(migration.moved, 1);
  assert.equal(fs.readFileSync(path.join(documents, 'Completed Orders', '906_04_Orders Complete.xlsx'), 'utf8'), 'legacy workbook');
  assert.equal(fs.existsSync(path.join(legacy, 'Completed Orders', '906_04_Orders Complete.xlsx')), false);
  assert.equal(fs.existsSync(path.join(legacy, 'Completed Orders', '~$906_04_Orders Complete.xlsx')), true, 'Excel lock files must not be copied or moved.');

  const lockedLegacy = path.join(temp, 'locked-install', 'TribeNet Files');
  const lockedDestination = path.join(temp, 'locked-documents', 'TribeNet Files');
  const workbookName = '906_10_Orders Complete.xlsx';
  fs.mkdirSync(path.join(lockedLegacy, 'Completed Orders'), { recursive: true });
  fs.writeFileSync(path.join(lockedLegacy, 'Completed Orders', workbookName), 'workbook data');
  const lockedFile = path.join(lockedLegacy, 'Completed Orders', workbookName);
  const lockFs = Object.create(fs);
  lockFs.unlinkSync = target => {
    if (target === lockedFile) throw new Error('simulated Excel file lock');
    return fs.unlinkSync(target);
  };
  const lockedMigration = migrateLegacyLibrary(lockedLegacy, lockedDestination, lockFs);
  assert.equal(lockedMigration.moved, 0);
  assert.equal(lockedMigration.remaining, 1);
  assert.equal(fs.readFileSync(path.join(lockedDestination, 'Completed Orders', workbookName), 'utf8'), 'workbook data');
  assert.equal(fs.existsSync(lockedFile), true, 'a locked legacy workbook must remain safely in place until a later migration attempt.');
  const retryMigration = migrateLegacyLibrary(lockedLegacy, lockedDestination);
  assert.equal(retryMigration.moved, 1);
  assert.equal(retryMigration.remaining, 0);
  assert.equal(fs.readdirSync(path.join(lockedDestination, 'Completed Orders')).filter(name => name.includes('(migrated')).length, 0, 'retry should recognize the already copied file instead of creating a duplicate.');
  assert.equal(fs.existsSync(lockedFile), false);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('orders export path tests passed');

const fs = require('fs');
const path = require('path');
const { canonicalTurnKey } = require('./turn-key');

function installationDirectory(appLike, options = {}) {
  if (options.installationDirectory) return path.resolve(options.installationDirectory);
  // `preferredRoot` remains a convenient explicit root for local callers and
  // tests; production passes no override and uses the installed executable's
  // directory. Development builds use userData so generated workbooks do not
  // end up beside source files or in the watched Completed Orders library.
  if (options.preferredRoot) return path.resolve(options.preferredRoot);
  if (appLike?.isPackaged) return path.dirname(options.executablePath || process.execPath);
  return appLike?.getPath ? appLike.getPath('userData') : process.cwd();
}

function exportedOrdersDirectory(appLike, options = {}) {
  const directory = path.join(installationDirectory(appLike, options), 'Exported Files');
  fs.mkdirSync(directory, { recursive: true });
  const probe = path.join(directory, `.write-test-${process.pid}`);
  try {
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
  } catch (error) {
    try { fs.unlinkSync(probe); } catch (_) {}
    const wrapped = new Error(`Cannot write to the Orders export folder at ${directory}: ${error.message}`);
    wrapped.code = error.code;
    throw wrapped;
  }
  return directory;
}

function canonicalOrdersFilename(turnKey) {
  return `Orders_${String(turnKey)}.xlsx`;
}

function resolveOrdersExportPath(appLike, requestedTurnKey, options = {}) {
  const turnKey = canonicalTurnKey(requestedTurnKey);
  if (!turnKey) throw new Error('A planning turn is required before exporting Orders.');
  const directory = exportedOrdersDirectory(appLike, options);
  const outputPath = path.join(directory, canonicalOrdersFilename(turnKey));
  return { turnKey, outputPath, outputDirectory: directory, updatedExisting: fs.existsSync(outputPath) };
}

module.exports = {
  canonicalOrdersFilename,
  installationDirectory,
  exportedOrdersDirectory,
  resolveOrdersExportPath
};

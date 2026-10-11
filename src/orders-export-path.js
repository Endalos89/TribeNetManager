const fs = require('fs');
const path = require('path');
const { canonicalTurnKey, inferTurnKeyFromFilename } = require('./turn-key');

function preferredRoot(appLike) {
  const parent = appLike.isPackaged ? path.dirname(process.execPath) : process.cwd();
  return path.join(parent, 'TribeNet Files');
}

function completedOrdersDirectory(appLike, options = {}) {
  const preferred = options.preferredRoot || preferredRoot(appLike);
  try {
    const directory = path.join(preferred, 'Completed Orders');
    fs.mkdirSync(directory, { recursive: true });
    const probe = path.join(directory, '.write-test');
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return directory;
  } catch (_) {
    const directory = path.join(appLike.getPath('userData'), 'TribeNet Files', 'Completed Orders');
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }
}

function canonicalOrdersFilename(turnKey) {
  return `${String(turnKey).replace(/-/g, '_')}_Orders Complete.xlsx`;
}

function resolveOrdersExportPath(appLike, requestedTurnKey, options = {}) {
  const turnKey = canonicalTurnKey(requestedTurnKey);
  if (!turnKey) throw new Error('A planning turn is required before exporting Orders.');
  const directory = completedOrdersDirectory(appLike, options);
  const canonicalName = canonicalOrdersFilename(turnKey);
  const names = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(xlsx|xlsm)$/i.test(entry.name))
    .map(entry => entry.name);
  const exact = names.find(name => name.toLowerCase() === canonicalName.toLowerCase());
  if (exact) return { turnKey, outputPath: path.join(directory, exact), updatedExisting: true };

  const sameTurn = names
    .filter(name => canonicalTurnKey(inferTurnKeyFromFilename(name)) === turnKey)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (sameTurn.length) return { turnKey, outputPath: path.join(directory, sameTurn[0]), updatedExisting: true };
  return { turnKey, outputPath: path.join(directory, canonicalName), updatedExisting: false };
}

module.exports = { canonicalOrdersFilename, completedOrdersDirectory, resolveOrdersExportPath };

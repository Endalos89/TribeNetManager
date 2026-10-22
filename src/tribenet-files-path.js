const fs = require('fs');
const path = require('path');

function preferredLibraryRoot(appLike) {
  return path.join(appLike.getPath('documents'), 'TribeNet Files');
}

function legacyLibraryRoot(appLike, options = {}) {
  const executablePath = options.executablePath || process.execPath;
  const workingDirectory = options.workingDirectory || process.cwd();
  const parent = appLike.isPackaged ? path.dirname(executablePath) : workingDirectory;
  return path.join(parent, 'TribeNet Files');
}

function availableDestination(destination, fsApi) {
  if (!fsApi.existsSync(destination)) return destination;
  const extension = path.extname(destination);
  const base = destination.slice(0, destination.length - extension.length);
  let index = 1;
  let candidate;
  do {
    candidate = `${base} (migrated ${index})${extension}`;
    index += 1;
  } while (fsApi.existsSync(candidate));
  return candidate;
}

function migrateLegacyLibrary(sourceRoot, destinationRoot, fsApi = fs) {
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  if (source === destination || !fsApi.existsSync(source)) return { moved: 0, remaining: 0 };

  let moved = 0;
  let remaining = 0;
  const visit = (sourceDirectory, destinationDirectory) => {
    let entries;
    try {
      entries = fsApi.readdirSync(sourceDirectory, { withFileTypes: true });
      fsApi.mkdirSync(destinationDirectory, { recursive: true });
    } catch (_) {
      remaining += 1;
      return;
    }

    for (const entry of entries) {
      if (entry.name === '.write-test') continue;
      if (/^~\$/.test(entry.name)) {
        remaining += 1;
        continue;
      }
      const oldPath = path.join(sourceDirectory, entry.name);
      const newPath = path.join(destinationDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(oldPath, newPath);
        continue;
      }
      if (!entry.isFile()) continue;

      let targetPath = newPath;
      try {
        if (fsApi.existsSync(targetPath)) {
          const sourceBytes = fsApi.readFileSync(oldPath);
          const destinationBytes = fsApi.readFileSync(targetPath);
          if (!sourceBytes.equals(destinationBytes)) targetPath = availableDestination(newPath, fsApi);
        }
        fsApi.copyFileSync(oldPath, targetPath);
        try {
          fsApi.unlinkSync(oldPath);
          moved += 1;
        } catch (_) {
          // The copy is safe in Documents, but keep the source until its lock clears.
          remaining += 1;
        }
      } catch (_) {
        remaining += 1;
      }
    }

    try { fsApi.rmdirSync(sourceDirectory); } catch (_) {}
  };

  visit(source, destination);
  try { fsApi.rmdirSync(source); } catch (_) {}
  return { moved, remaining };
}

module.exports = { preferredLibraryRoot, legacyLibraryRoot, migrateLegacyLibrary };

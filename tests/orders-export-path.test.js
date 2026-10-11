const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveOrdersExportPath, canonicalOrdersFilename } = require('../src/orders-export-path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-orders-path-'));
const app = { isPackaged: true, getPath: name => name === 'userData' ? temp : temp };
const preferred = path.join(temp, 'preferred', 'TribeNet Files');

try {
  const first = resolveOrdersExportPath(app, '906-04', { preferredRoot: preferred });
  assert.equal(path.basename(first.outputPath), canonicalOrdersFilename('906-04'));
  assert.equal(first.updatedExisting, false);
  fs.writeFileSync(first.outputPath, 'existing');
  const second = resolveOrdersExportPath(app, '906-04', { preferredRoot: preferred });
  assert.equal(second.outputPath, first.outputPath);
  assert.equal(second.updatedExisting, true);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('orders export path tests passed');

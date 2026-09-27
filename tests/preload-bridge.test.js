const assert = require('assert');
const fs = require('fs');
const path = require('path');

const preloadPath = path.join(__dirname, '..', 'src', 'preload.js');
const preload = fs.readFileSync(preloadPath, 'utf8');

assert.match(preload, /require\(['"]electron['"]\)/, 'preload should use Electron bridge APIs');
assert.doesNotMatch(preload, /require\(['"]\.\//, 'sandboxed preload must not require local application modules');
assert.match(preload, /ipcRenderer\.invoke\(['"]planned-routes:list['"]/, 'planned routes should go through IPC');
assert.match(preload, /ipcRenderer\.invoke\(['"]planned-routes:save['"]/, 'planned route saves should go through IPC');
assert.match(preload, /ipcRenderer\.invoke\(['"]planned-routes:remove['"]/, 'planned route removal should go through IPC');
assert.match(preload, /script\.src\s*=\s*['"]session-snapshot\.js['"]/, 'preload should load the renderer session snapshot client');
assert.doesNotMatch(preload, /app:consume-startup-view[^\n]+DOMContentLoaded/, 'preload must not consume restore state before renderer state is ready');

console.log('preload bridge regression tests passed');

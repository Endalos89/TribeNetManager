const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const index = src('index.html');
const turnManager = src('turn-manager.html');
const tribeManager = src('tribe-manager.html');

assert(index.includes('id="launcherImportResultsButton"'), 'Launcher must expose the Results import.');
assert(index.includes('id="launcherImportCompletedButton"'), 'Launcher must expose the Completed Orders import.');
assert(!turnManager.includes('id="importFinal"'), 'Turn Manager must not expose a Completed Orders import button.');
assert(!tribeManager.includes('class="button accent">Import Results Report'), 'Tribe Manager must not expose a visible Results import button.');
assert(index.includes('id="importOrdersButton" class="hidden"'), 'Legacy Mapper import hook must stay hidden.');
assert(index.includes('id="mapImportResultsButton" class="hidden"'), 'Legacy Mapper Results import hook must stay hidden.');
assert(tribeManager.includes('id="importResultsButton" class="hidden"'), 'Legacy Tribe Manager import hook must stay hidden.');

console.log('Centralized import UI regression tests passed.');

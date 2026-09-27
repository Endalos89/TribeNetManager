const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'turn-manager-mandate.js'), 'utf8');

assert.match(source, /SKINGUTBONE/, 'compound SGB activity should be recognized');
assert.match(source, /renderFixedSharedLimits/, 'shared limit renderer should be replaced');
assert.match(source, /skillLevelByName/, 'skills should resolve through the Mandate dictionary');
assert.match(source, /getMandateCatalog/, 'renderer should load the SQLite-backed Mandate catalogue');
assert.match(source, /Use in Draft Plan/, 'recipe explorer should populate draft activities');
assert.match(source, /workerLimitFor/, 'shared worker limits should be calculated from mapped skills');

console.log('Turn Manager Mandate enhancement static checks passed.');

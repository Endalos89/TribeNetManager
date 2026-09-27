const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'session-snapshot.js'), 'utf8');

assert.match(source, /cameraX:\s*finite\(state\.cameraX\)/, 'snapshot should capture map camera X');
assert.match(source, /scale:\s*finite\(state\.scale\)/, 'snapshot should capture map zoom');
assert.match(source, /route:\s*jsonClone\(movementPlannerState\.route\)/, 'snapshot should capture the unsaved movement route');
assert.match(source, /selectedUnitCode:/, 'snapshot should capture the movement-planner unit');
assert.match(source, /scoutOriginMode:/, 'snapshot should capture scout origin mode');
assert.match(source, /captureDraftFields\(\)/, 'snapshot should capture unsaved form text');
assert.match(source, /captureScrolls\(\)/, 'snapshot should capture scroll positions');
assert.match(source, /await window\.tribenet\.reportCurrentView\(capture\(\)\);[\s\S]*await window\.tribenet\.installUpdate\(\);/, 'update install must wait for snapshot persistence before restarting');
assert.match(source, /consumeStartupView\(\)/, 'startup should consume the update snapshot for restoration');

console.log('session snapshot regression tests passed');

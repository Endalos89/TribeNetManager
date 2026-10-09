const assert = require('assert');
const fs = require('fs');

const actions = fs.readFileSync('src/turn-actions.js', 'utf8');
const savedPlans = fs.readFileSync('src/saved-movement-plans.js', 'utf8');
const index = fs.readFileSync('src/index.html', 'utf8');
const mapperStyles = fs.readFileSync('src/movement-planner.css', 'utf8');

assert.match(index, /id="turnActionBar"/, 'The mapper must expose the selected-unit action bar.');
assert.match(index, /id="unitSplitDialog"/, 'Split Off Unit must have a dedicated dialog.');
assert.match(actions, /Move Unit/, 'Move Unit action is missing.');
assert.match(actions, /Split Off Unit/, 'Split Off Unit action is missing.');
assert.match(actions, /Send Out Scout/, 'Send Out Scout action is missing.');
assert.match(actions, /key === 'M'/, 'Move Unit hotkey is missing.');
assert.match(actions, /key === 'X'/, 'Split Off Unit hotkey is missing.');
assert.match(actions, /key === 'C'/, 'Send Out Scout hotkey is missing.');
assert.match(actions, /event\.key !== 'Shift'/, 'Shift release must be the chain commit boundary.');
assert.match(actions, /turnActionsCommit\(\)/, 'Turn actions must commit after a completed click/chain.');
assert.match(actions, /pendingOcean/, 'Scout coastal traces must retain the selected ocean tile.');
assert.match(actions, /orderForFeature/, 'Scout coastal traces must infer FOL/FOR.');
assert.match(actions, /unitType.*garrison|garrison.*unitType/i, 'Garrisons must be handled as stationary units.');
assert.match(savedPlans, /plannedSplit && savedMovementUnitMove\(unit\.parentUnit\)/, 'A split created after parent movement must remain stationary.');
assert.match(savedPlans, /scoutCount\s*:\s*2/, 'Scouting must default to two people.');
assert.match(savedPlans, /scoutHorses\s*:\s*2/, 'Scouting must default to two horses.');
assert.ok(!actions.includes('Smart Scout') && !actions.includes('smartScout'), 'Smart Scout must be removed completely.');
assert.ok(!mapperStyles.includes('movement-planner-smart'), 'Smart Scout styling must be removed completely.');
assert.ok(!index.includes('movementPlannerCard') && !index.includes('plannerOverlayCard'), 'The old planning panel must not be present.');

console.log('Turn action UI regression tests passed');

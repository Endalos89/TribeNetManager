const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const fixes = src('feedback-review-fixes.js');
const cultural = src('feedback-review-cultural-profit.js');
const followup = src('feedback-followup-fixes.js');
const history = src('turn-file-library-ui.js');
const launcherImports = src('launcher-imports.js');
const bridge = src('feedback-storage-bridge.js');
const preload = src('preload.js');

assert.doesNotThrow(() => new Function(fixes), 'exported feedback review script should parse');
assert.doesNotThrow(() => new Function(cultural), 'cultural Fair income refinement should parse');
assert.doesNotThrow(() => new Function(followup), 'follow-up feedback refinements should parse');
assert.doesNotThrow(() => new Function(history), 'turn file history should parse');
assert.doesNotThrow(() => new Function(launcherImports), 'launcher import handling should parse');
assert.match(bridge, /feedback-review-fixes\.js/, 'feedback review fixes should load renderer-side');
assert.match(bridge, /feedback-review-cultural-profit\.js/, 'cultural Fair income refinement should load renderer-side');
assert.match(bridge, /feedback-followup-fixes\.js/, 'follow-up feedback refinements should load renderer-side');
assert.doesNotMatch(preload, /require\(['"]fs['"]\)/, 'review changes must not reintroduce fs into sandboxed preload');
assert.doesNotMatch(preload, /require\(['"]path['"]\)/, 'review changes must not reintroduce path into sandboxed preload');

assert.match(fixes, /Import Results here/, 'launcher hero should use the requested Results wording');
assert.match(fixes, /openFairButton/, 'classic Fair launcher card should be removed');
assert.match(history, /Completed Orders<\/div><div>Results<\/div><div>Fair/, 'stable history should show Completed Orders before Results and include Fair');
assert.match(history, /Not required/, 'first completed orders slot should be marked not required');
assert.match(history, /\[4,10\]/, 'history should recognize Fair months 04 and 10');
assert.match(history, /tribenet-fair-import-complete/, 'Fair imports should refresh stable history');
assert.match(launcherImports, /MutationObserver/, 'launcher should bind the Fair button even when it is created later');
assert.match(launcherImports, /filter\(Boolean\)/, 'Fair turn detection should ignore unrelated managed-turn keys');
assert.match(launcherImports, /feedbackFairBound/, 'stable importer should prevent a second compatibility importer');
assert.match(followup, /robustNextFairTurn/, 'follow-up layer should keep the Fair button stable after compatibility refreshes');

assert.match(fixes, /centre Mapper on main Tribe/, 'Mapper should centre on the main Tribe when opened');
assert.match(fixes, /getResultHexHistory/, 'partial map markers should inspect earlier hex knowledge');
assert.match(fixes, /visited','scouted/, 'fully explored hexes should suppress later partial markers');

assert.match(fixes, /Skill groups/, 'Compendium skill-group navigation should be removed');
assert.match(fixes, /data-skill-filter/, 'skill groups should filter the current skill table');
assert.match(fixes, /comp-item-table-wrap/, 'items should be converted to a compact table');
assert.match(fixes, /appendChild\(food\)/, 'Food Gathering should move to the bottom of Compendium navigation');
assert.match(followup, /item-inline-icon/, 'duplicate inline item-name icons should be removed from compact item rows');

assert.match(fixes, /item-icon-manifest\.js/, 'Fairground should reuse the Compendium icon manifest');
assert.match(fixes, /fair-item-placeholder/, 'Fairground should use a static placeholder when no Compendium icon exists');
assert.match(fixes, /\[1,2,4,8,16\]/, 'workshop should use expected-turn horizons of 1, 2, 4, 8 and 16');
assert.match(fixes, /\(11 - level\) \/ 10/, 'skill timing should use the primary success chance by target level');
assert.match(followup, /Skills to raise:/, 'Workshop cards should name the skills and level jumps required');
assert.match(followup, /Current Silver/, 'Fair trading summary should show current Silver');
assert.match(followup, /After Fair/, 'Fair trading summary should show the projected post-trade Silver balance');
assert.match(followup, /exceed current Silver/, 'negative projected Silver should produce a warning');
assert.match(followup, /cultural-activity-section/, 'cultural activity sections should receive Fairground theme styling');
assert.match(cultural, /participants \* \(8 \+ skill \+ economics\) \/ 4/, 'cultural Fair income should use the Mandate base formula');
assert.match(cultural, /Math\.min\(500, enteredParticipants\)/, 'cultural Fair income should apply the 500 participant cap');
assert.match(cultural, /workbookReturns/, 'workbook return values should take precedence where present');
assert.match(cultural, /implementsUsed/, 'allocated implements should be surfaced per cultural activity');

console.log('exported feedback review regression tests passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const fixes = src('feedback-review-fixes.js');
const bridge = src('feedback-storage-bridge.js');
const preload = src('preload.js');

assert.match(bridge, /feedback-review-fixes\.js/, 'feedback review fixes should load renderer-side');
assert.doesNotMatch(preload, /require\(['"]fs['"]\)/, 'review changes must not reintroduce fs into sandboxed preload');
assert.doesNotMatch(preload, /require\(['"]path['"]\)/, 'review changes must not reintroduce path into sandboxed preload');

assert.match(fixes, /Import Results here/, 'launcher hero should use the requested Results wording');
assert.match(fixes, /openFairButton/, 'classic Fair launcher card should be removed');
assert.match(fixes, /launcherImportFairButton/, 'Fair workbook import should be managed after the dynamic launcher exists');
assert.match(fixes, /Import Fair \$\{target\}/, 'Fair import should be enabled for the next Fair turn');
assert.match(fixes, /Completed Orders<\/span><span>Results<\/span><span>Fair/, 'history should show Completed Orders before Results and include Fair');
assert.match(fixes, /Not required/, 'first completed orders slot should be marked not required');

assert.match(fixes, /centre Mapper on main Tribe/, 'Mapper should centre on the main Tribe when opened');
assert.match(fixes, /getResultHexHistory/, 'partial map markers should inspect earlier hex knowledge');
assert.match(fixes, /visited','scouted/, 'fully explored hexes should suppress later partial markers');

assert.match(fixes, /Skill groups/, 'Compendium skill-group navigation should be removed');
assert.match(fixes, /data-skill-filter/, 'skill groups should filter the current skill table');
assert.match(fixes, /comp-item-table-wrap/, 'items should be converted to a compact table');
assert.match(fixes, /appendChild\(food\)/, 'Food Gathering should move to the bottom of Compendium navigation');

assert.match(fixes, /item-icon-manifest\.js/, 'Fairground should reuse the Compendium icon manifest');
assert.match(fixes, /fair-item-placeholder/, 'Fairground should use a static placeholder when no Compendium icon exists');
assert.match(fixes, /Current silver/, 'Fair trading summary should show current Silver');
assert.match(fixes, /\[1,2,4,8,16\]/, 'workshop should use expected-turn horizons of 1, 2, 4, 8 and 16');
assert.match(fixes, /\(11 - level\) \/ 10/, 'skill timing should use the primary success chance by target level');
assert.match(fixes, /cultural-activity-section/, 'cultural activities should have their own sections');
assert.match(fixes, /Potential profit \/ return/, 'cultural activities should surface workbook profit/return values');

console.log('exported feedback review regression tests passed');

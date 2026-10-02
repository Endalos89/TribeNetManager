const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const files = [
  'src/feedback-round5.js',
  'src/mapper-food-gathering-followup.js',
  'src/compendium-item-progressive.js',
  'src/feedback-storage-bridge.js'
];

for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio:'pipe' });

const feedback = fs.readFileSync('src/feedback-round5.js', 'utf8');
assert.match(feedback, /notes\.filter\(note => note\.status !== 'resolved'\)/, 'resolved feedback must be excluded from JSON exports');
assert.match(feedback, /context\?\.compendium/, 'feedback jumps must use captured Compendium context');
assert.match(feedback, /type:'entity'/, 'Compendium item context must deep-link to an entity article');
assert.match(feedback, /holdReason = 'amended'/, 'amended feedback must enter the held/actioned state');
assert.match(feedback, /awaiting next update/, 'held feedback must explain when it will return');
assert.match(feedback, /linear-gradient\(165deg,#efe0b8,#cfb77f\)/, 'cultural sections must use the Fairground parchment palette');

const mapper = fs.readFileSync('src/mapper-food-gathering-followup.js', 'utf8');
assert.match(mapper, /getManagedTurn/, 'Mapper food estimates must load the managed beginning-of-turn state');
assert.match(mapper, /managed\?\.start\?\.data/, 'Mapper food estimates must prefer the start workbook');
assert.match(mapper, /row\?\.skill, row\?\.name, row\?\.shortname/, 'skill normalization must support workbook skill rows');
assert.match(mapper, /unit\.startHex/, 'unit auto-selection must use beginning-of-turn hexes');
assert.match(mapper, /beginning-of-turn unit/, 'the UI must identify beginning-of-turn unit selection');

const progressive = fs.readFileSync('src/compendium-item-progressive.js', 'utf8');
assert.match(progressive, /requestIdleCallback/, 'large item lists should continue during browser idle time');
assert.match(progressive, /INITIAL_BATCH = 48/, 'the item list should paint an intentionally small initial batch');
assert.match(progressive, /loading="lazy"|comp-entity-card/, 'item cards must remain compatible with lazy icon decoration');

const bridge = fs.readFileSync('src/feedback-storage-bridge.js', 'utf8');
for (const script of ['feedback-round5.js','mapper-food-gathering-followup.js','compendium-item-progressive.js']) {
  assert.match(bridge, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${script} must be loaded by the app`);
}

console.log('Feedback round 5 regression checks passed.');

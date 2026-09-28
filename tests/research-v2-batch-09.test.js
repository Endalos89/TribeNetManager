const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
for (let i = 1; i <= 9; i++) require(`../src/research-v2-batch-${String(i).padStart(2,'0')}.js`);

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 9);
assert.strictEqual(R.batches[8].id, 'research-v2-batch-09');
assert.strictEqual(R.batches[8].pages, '205–209');
const batch = R.topics.filter(t => t.batchId === 'research-v2-batch-09');
assert.strictEqual(batch.length, 7, 'Batch 9 should contain 7 structured research entries');
const find=(skill,name)=>R.topics.find(t=>R.canon(t.skill)===R.canon(skill)&&R.canon(t.name)===R.canon(name));

const basket=find('Weaving','Basket');
assert(basket.effects.some(x=>/doubles.*productivity/i.test(x)));
assert(basket.effects.some(x=>/additive rather than compounded/i.test(x)));
assert(R.affectingSkill('Farming').some(t=>t.skill==='Weaving'&&t.name==='Basket'));
assert.strictEqual(R.entity('Basket').kind,'item');

const epic=find('Weaving','Epic Tapestry');
assert(epic.effects.some(x=>/\+0\.04 General Morale/.test(x)));
assert(epic.effects.some(x=>/\+0\.06 Military Morale/.test(x)));
assert(epic.effects.some(x=>/-0\.05 Morale/.test(x)));
assert(epic.restrictions.some(x=>/more than one/i.test(x)));

const exotic=find('Weaving','Exotic Weaving');
assert(exotic.effects.some(x=>/twice the normal Silver price/i.test(x)));
assert(exotic.effects.some(x=>/these prices are tripled/i.test(x)));
assert(exotic.restrictions.some(x=>/Fair Trade Multipliers do not apply/i.test(x)));
assert(exotic.sourceGaps.some(x=>/OCR-fragmented/i.test(x)));
assert(exotic.sourceIssues.some(x=>/does not explicitly state/i.test(x)));

const whaler=find('Whaling','Whaler');
assert(whaler.effects.some(x=>/does not change the chance/i.test(x)));
assert(whaler.effects.some(x=>/two whales/i.test(x)));
assert(whaler.requirements.some(x=>/6 Oars.*Longboat/i.test(x)));
assert(whaler.sourceIssues.some(x=>/Metalwork 8.*Metalwork 5/i.test(x)));
assert(whaler.sourceGaps.some(x=>/Sheath 150/i.test(x)));
assert.strictEqual(R.entity('Whaler').kind,'ship');

const bunk=find('Woodwork','Bunk');
assert(bunk.effects.some(x=>/Every 2 Bunks add 1/i.test(x)));
assert(bunk.effects.some(x=>/maximum.*base/i.test(x)));
assert.strictEqual(R.entity('Bunk').kind,'item');

const ladder=find('Woodwork','Mining Ladder');
assert(ladder.effects.some(x=>/\+100% Mining output/i.test(x)));
assert(ladder.effects.some(x=>/additive rather than compounded/i.test(x)));
assert(R.affectingSkill('Mining').some(t=>t.skill==='Woodwork'&&t.name==='Mining Ladder'));
assert(ladder.relatedSkills.includes('Engineering'));

const wheel=find('Woodwork','Wheelbarrow');
assert(wheel.effects.some(x=>/Mining output by 50%/i.test(x)));
assert(wheel.effects.some(x=>/Engineering output by 50%/i.test(x)));
assert(wheel.effects.some(x=>/doubles Quarrying output/i.test(x)));
assert(R.affectingSkill('Quarrying').some(t=>t.skill==='Woodwork'&&t.name==='Wheelbarrow'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}
console.log('Research V2 batch 09 regression tests passed.');

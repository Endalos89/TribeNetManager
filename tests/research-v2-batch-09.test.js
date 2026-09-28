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
assert(whaler.sourceIssues.some(x=>/Metalwork 8.*Mtl 5/i.test(x)));
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

// Final pages 209–212 are a reconciliation/change-log pass rather than another set of research articles.
require('../src/research-v2-final-audit.js');
const A=global.window.TribeNetResearchFinalAudit;
assert(A, 'Final research audit should load');
assert.strictEqual(R.batches.length,10);
assert.strictEqual(R.batches[9].id,'research-v2-final-audit');
assert.strictEqual(R.batches[9].pages,'209–212');
assert.strictEqual(R.topics.length,322,'Final audit must not invent new active research topics');
assert(A.added.includes('Spy Glass'));
assert(A.added.includes('Militia Mobilisation (05/05/2026)'));
assert.deepStrictEqual(A.removed,['Feudal Security','Astral Navigation','Terracotta Army','Fortress','Castle','Keep','Boat People']);
assert(A.proposals.some(p=>p.name==='Stained Glass'&&p.status==='proposal'));
assert(A.proposals.some(p=>p.skill==='Intelligence'&&p.status==='rejected'));

const castle=find('Politics','Castle');
assert(castle && castle.status==='removed');
const fortress=find('Politics','Fortress');
assert(fortress && fortress.status==='removed');
const terracotta=R.topics.find(t=>R.canon(t.name)===R.canon('Terracotta Army'));
assert(terracotta && terracotta.status==='removed');

const sewers=find('Sanitation','Sewers');
assert(sewers.restrictions.some(x=>/Fleets are not affected/i.test(x)));
const saw=find('Forestry','Saw');
assert(saw.notes.some(x=>/7 Bronze or 7 Brass with 30 Coal/i.test(x)));
assert(saw.recipe.variants.some(v=>v.inputs.some(i=>i.item==='Bronze'&&i.quantity===7)&&v.inputs.some(i=>i.item==='Coal'&&i.quantity===30)));
assert(saw.recipe.variants.some(v=>v.inputs.some(i=>i.item==='Brass'&&i.quantity===7)&&v.inputs.some(i=>i.item==='Coal'&&i.quantity===30)));
const mv1=find('Scouting','Extra Movement 1');
const mv2=find('Scouting','Extra Movement 2');
assert(mv1.effects.some(x=>/Locating/i.test(x)));
assert(mv2.effects.some(x=>/Locating/i.test(x)));
const guild=find('Triball','Triball Guild');
assert(guild.effects.some(x=>/1,600 Warriors/i.test(x)));

const full=R.topics.find(t=>R.canon(t.name)===R.canon('Full Plate'));
if(full){
  assert(!full.prerequisites.some(p=>['GREAVES','BASCINET'].includes(R.canon(p.label))));
  assert(full.restrictions.some(x=>/Greaves and Bascinet.*cannot be used/i.test(x)));
}
const ulf=find('Weapons','Ulfbehrt Sword');
assert(ulf.notes.some(x=>/Gold is not required/i.test(x)));
assert(!ulf.recipe.inputs.some(i=>R.canon(i.item)==='GOLD'));

console.log('Research V2 batch 09 and final reconciliation audit regression tests passed.');

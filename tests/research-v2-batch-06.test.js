const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');
require('../src/research-v2-batch-03.js');
require('../src/research-v2-batch-04.js');
require('../src/research-v2-batch-05.js');
require('../src/research-v2-batch-06.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 6);
assert.strictEqual(R.batches[5].id, 'research-v2-batch-06');
assert.strictEqual(R.batches[5].pages, '129–157');
const batch = R.topics.filter(t => t.batchId === 'research-v2-batch-06');
assert.strictEqual(batch.length, 43, 'Batch 6 should contain 43 structured research entries');
const find=(skill,name)=>R.topics.find(t=>R.canon(t.skill)===R.canon(skill)&&R.canon(t.name)===R.canon(name));

const militia=find('Mobilisation','Militia Mobilisation');
assert(militia.effects.some(x=>/20 per hex to 25 per hex/.test(x)));
const band=find('Music','Military Band');
assert(band.effects.some(x=>/\+0\.04 Military Morale/.test(x)));
assert(band.requirements.some(x=>/20–30 Actives/.test(x)));
const field=find('Music','Music in the Field');
assert(field.affectsSkills.includes('Leadership'));
assert(field.affectsSkills.includes('Captaincy'));
assert(field.effects.some(x=>/\+2 effective Tactics/.test(x)));
const wayfinder=find('Navigation','Wetlands Wayfinder');
assert(wayfinder.effects.some(x=>/12 MP/.test(x) && /6 MP/.test(x)));
const corridor=find('Navigation','Wetlands Corridor');
assert(corridor.effects.some(x=>/8 MP/.test(x) && /4 MP/.test(x)));
assert.strictEqual(R.entity('Wetlands Corridor').kind,'facility');

const castle=find('Politics','Castle');
assert.strictEqual(castle.status,'under review');
assert(castle.effects.some(x=>/30-foot Stone Wall/.test(x)));
assert.strictEqual(R.entity('Castle').kind,'facility');
const doom=find('Politics','Doomsday Book');
assert(doom.effects.some(x=>/400 Silver per controlled hex/.test(x)));
assert(R.entity('Doomsday Book'));
const mission=find('Politics','Mission');
assert(mission.effects.some(x=>/\+0\.02/.test(x)));
const sheriffs=find('Politics','Sheriffs');
assert(sheriffs.effects.some(x=>/replaces three Pacifiers/.test(x)));
assert(R.entity('Hall of Justice'));

const terracotta=find('Pottery','Terracotta Army');
assert.strictEqual(terracotta.status,'removed');
assert(terracotta.effects.some(x=>/\+2 Combat/.test(x)));
const limestone=find('Quarrying','Limestone');
assert(limestone.effects.some(x=>/normal Stone rate/.test(x)));
assert(R.entity('Limestone').researchOnly === false);
const inactive=find('Quarrying','Inactive Quarriers');
assert(inactive.effects.some(x=>/one-third/.test(x)));

const ranger=find('Ranger','Ranger IV, V, VI');
assert(ranger.affectsSkills.includes('Scouting'));
assert(ranger.effects.filter(x=>/\+2 Scouting/.test(x)).length >= 3);
const coke=find('Refining','Coke');
assert(coke.effects.some(x=>/1 Coke is equivalent to 2 Coal/.test(x)));
assert(R.entity('Coke').researchOnly === false);
const hammer=find('Refining','Hammer Mill');
assert(hammer.affectsSkills.includes('Mining'));
assert(hammer.affectsSkills.includes('Refining'));
assert(hammer.effects.some(x=>/2 workers perform the work of 3/.test(x)));
const steel=find('Refining','Steel');
assert(steel.prerequisites.some(x=>/Coke/.test(x.label)));
assert(steel.effects.some(x=>/one skill level higher/.test(x)));
const orders=find('Religion','Military Orders');
assert(orders.affectsSkills.includes('Leadership'));
assert(orders.effects.some(x=>/half Religion skill/.test(x)));
const silver=find('Research','Silver Age');
assert(silver.effects.some(x=>/one Group A skill/.test(x)));
assert(silver.restrictions.some(x=>/Only one Tribe per Clan/.test(x)));

assert(R.affectingSkill('Leadership').some(t=>t.skill==='Music'&&t.name==='Music in the Field'));
assert(R.affectingSkill('Leadership').some(t=>t.skill==='Religion'&&t.name==='Military Orders'));
assert(R.affectingSkill('Mining').some(t=>t.skill==='Refining'&&t.name==='Hammer Mill'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}
console.log('Research V2 batch 06 regression tests passed.');

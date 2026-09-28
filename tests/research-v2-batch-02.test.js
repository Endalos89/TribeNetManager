const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 2);
assert.strictEqual(R.batches[1].id, 'research-02-cheesemaking-farming');
assert.strictEqual(R.batches[1].pages, '51–78');
const batch = R.topics.filter(t => t.batchId === 'research-02-cheesemaking-farming');
assert.strictEqual(batch.length, 51, 'Batch 2 should contain 51 individual research topics');

const find = (skill,name) => R.topics.find(t => R.canon(t.skill)===R.canon(skill) && R.canon(t.name)===R.canon(name));

const cheese = find('Cheesemaking','Cheesemaking 11');
assert(cheese.effects.some(x=>/10%/.test(x)));
assert(cheese.restrictions.some(x=>/original number of workers/i.test(x)));

const assault = find('Combat','Assault Troops');
assert(assault.effects.some(x=>/Combat Skill/.test(x)));
assert(assault.effects.some(x=>/Assault Attack Terrain Proficiency/.test(x)));
const army = find('Combat','Army');
assert(army.effects.some(x=>/\+0\.10 Combat Morale/.test(x)));
assert(army.requirements.some(x=>/each 50 Warriors/.test(x)));
assert(R.entity('Barracks'), 'Army should create a standardized Barracks entry');
const home = find('Combat','Home Guard');
assert(home.effects.some(x=>/\+0\.5 Terrain Proficiency/.test(x)));

const stew = find('Cooking','Stew');
assert.strictEqual(stew.recipe.output.quantity,40);
assert.strictEqual(stew.recipe.inputs.find(i=>i.item==='Goats').quantity,5);

const dance = find('Dance','Spring Arts Festival Dance');
assert(dance.effects.some(x=>/\+0\.02 General Morale/.test(x)));
assert(dance.sourceIssues.some(x=>/Art/.test(x)), 'Dance source copy wording should be explicit');

const envoy = find('Diplomacy','Trade Envoy');
assert(envoy.effects.some(x=>/50%/.test(x)));
assert(envoy.requirements.some(x=>/remain/.test(x)));

const branded = find('Distilling','Branded Alcohol (Ale, Wine etc)');
assert(branded.effects.some(x=>/1\.5 times/.test(x)));
assert(branded.sourceGaps.length, 'Variable branded alcohol recipe must not be invented');
const road = find('Distilling','Road House');
assert(road.effects.some(x=>/2 Barrels/.test(x)));
assert(road.restrictions.some(x=>/maximum of 6/i.test(x)));
assert.strictEqual(R.entity('Road House').kind,'facility');
const tavern = find('Distilling','Tavern');
assert(tavern.effects.some(x=>/2 times/.test(x)));

const slot1 = find('Economics','Extra Fair Slot 1');
assert.strictEqual(slot1.dl,'Not listed');
assert(slot1.sourceGaps.length);
const market = find('Economics','Market Place');
assert(market.effects.some(x=>/10 to 15/.test(x)));
assert.strictEqual(R.entity('Market Place').researchOnly,false);
const toll = find('Economics','Toll Gate');
assert(toll.effects.some(x=>/100 Gold/.test(x)));
assert(toll.restrictions.some(x=>/Only Cities/.test(x)));

const drawbridge = find('Engineering','Drawbridge');
assert(drawbridge.affectsSkills.includes('Archery'));
assert.strictEqual(drawbridge.recipe.variants.length,2, 'Drawbridge should preserve Brass and Bronze recipe alternatives');
const ladder = find('Engineering','Mining Ladder');
assert(ladder.affectsSkills.includes('Mining'));
assert(ladder.effects.some(x=>/10 miners/.test(x)));
const sewers = find('Engineering','Sewers');
assert(sewers.affectsSkills.includes('Sanitation'));
assert(sewers.sourceIssues.some(x=>/Engineering 10/.test(x) && /Engineering 9/.test(x)));
const watch = find('Engineering','Watchtower');
assert(watch.affectsSkills.includes('Security'));
assert(watch.effects.some(x=>/2 percentage points/.test(x)));
const keep = find('Engineering','Keep');
assert(keep.sourceIssues.some(x=>/radically changed/.test(x)));

assert(R.affectingSkill('Archery').some(t=>t.name==='Barbican'));
assert(R.affectingSkill('Mining').some(t=>t.name==='Mining Ladder'));
assert(R.affectingSkill('Sanitation').some(t=>t.name==='Sewers'));
assert(R.affectingSkill('Security').some(t=>t.name==='Watchtower'));

const holy = find('Excavation','Holy Artefact');
assert.strictEqual(holy.status,'proposed');
assert(holy.effects.some(x=>/12 normal Artefacts/.test(x)));
assert(holy.sourceIssues.length);
const tomb = find('Excavation','Tomb Robbers');
assert(tomb.sourceGaps.some(x=>/See Archaeology/.test(x)));

const ag1 = find('Farming','Agriculture I');
assert(ag1.effects.some(x=>/Unlocks the new Group C skill Agriculture/.test(x)));
assert(ag1.creates.some(x=>x.kind==='skill' && x.name==='Agriculture'));
const flax = find('Farming','Flax');
assert(flax.effects.some(x=>/1 Flax = 1 Cotton/.test(x)));
assert(flax.effects.some(x=>/Scythe doubles/.test(x)));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}

console.log('Research V2 batch 02 regression tests passed.');

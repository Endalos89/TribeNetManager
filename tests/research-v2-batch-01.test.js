const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 1);
assert.strictEqual(R.batches[0].id, 'research-01-administration-captaincy');
assert.strictEqual(R.batches[0].pages, '14–50');
assert.strictEqual(R.topics.length, 64, 'Batch 1 should contain 64 individual research topics');

const find = (skill,name) => R.topics.find(t => R.canon(t.skill)===R.canon(skill) && R.canon(t.name)===R.canon(name));

const extra = find('Administration','Extra Element');
assert(extra.notes.some(x=>/three/i.test(x)));
const move = find('Administration','Extra Movement 6');
assert(move.effects.some(x=>/\+6 total/.test(x)));
assert(move.restrictions.some(x=>/Fleets or Couriers/.test(x)));

const ag11 = find('Agriculture','Agriculture 11');
assert(ag11.sourceGaps.length, 'Sparse source entries must be explicit, not invented');
assert.strictEqual(ag11.effects.length, 0);
assert(R.affectingSkill('Farming').some(t=>t.name==='Agriculture IV'));

const greek = find('Alchemy','Greek Fire');
assert.strictEqual(greek.recipe.activity, 'Refining');
assert.strictEqual(greek.recipe.people, 2);
assert.deepStrictEqual(greek.recipe.inputs.map(i=>[i.item,i.quantity]), [['Jar',1],['Oil',1],['Tar',2],['Sulphur',4]]);
assert(greek.effects.some(x=>/maximum of 40 people/i.test(x)));

const propolis = find('Apiarism','Propolis');
assert(propolis.affectsSkills.includes('Healing'));
assert(propolis.effects.some(x=>/twice as powerful as Herbs/i.test(x)));
assert(propolis.restrictions.some(x=>/Only Tribes/.test(x)));

const salves = find('Apothecary','Salves');
assert(salves.recipe);
assert(salves.effects.some(x=>/2 Herbs/.test(x)));

const secondSite = find('Archaeology','Second Site');
assert(secondSite.effects.some(x=>/within 30 hexes/.test(x)));
const secondRelic3 = find('Archaeology','Second Site Relic 3');
assert(secondRelic3.effects.some(x=>/3 Relics/.test(x)));
assert(secondRelic3.sourceGaps.length);

const plate = find('Armour','Plate Barding');
assert(plate.effects.some(x=>/75%/.test(x)));
assert(plate.sourceIssues.some(x=>/Chain Barding/.test(x)));

const bronze = find('Art','Bronze Statue');
assert(bronze.affectsSkills.includes('Metalwork'));
assert.strictEqual(bronze.recipe.inputs.find(i=>i.item==='Bronze').quantity,1000);
const marble = find('Art','Marble Statue');
assert(marble.affectsSkills.includes('Stonework'));

const amph = R.entity('Amphitheatre');
assert(amph, 'Amphitheatre should be a standardized research building');
assert.strictEqual(amph.kind,'facility');
assert.strictEqual(amph.researchOnly,false, 'Research List says any Tribe may build the Amphitheatre');
assert.strictEqual(amph.recipes[0].inputs.find(i=>i.item==='Stone').quantity,10000);

assert(R.affectingSkill('Navigation').some(t=>t.name==='Astronomy 1'));
assert(R.affectingSkill('Leadership').some(t=>t.name==='Military Orders'));
assert(R.affectingSkill('Seeking').some(t=>t.name==='Bush Lore IV'));

const waybread = R.entity('Waybread');
assert(waybread && waybread.recipes.length);
assert.strictEqual(waybread.recipes[0].output.quantity,6);
assert.strictEqual(waybread.recipes[0].variants[0].output.quantity,15);

const improved = find('Brickmaking','Improved Brickmaking');
assert(improved.effects.some(x=>/180 Bricks/.test(x)));
assert(improved.sourceIssues.length, 'Known source arithmetic tension should be shown, not silently recalculated');

const admiralty = find('Captaincy','Admiralty');
assert(admiralty.affectsSkills.includes('Captaincy'));
assert(admiralty.effects.some(x=>/one-half of Admiralty/.test(x)));
const jno = find('Captaincy','Junior Naval Officer');
assert(jno.effects.some(x=>/rout severity by 5%/.test(x)));
const nsic = find('Captaincy','Naval Second in Command (NSIC)');
assert(nsic.effects.some(x=>/Potential Casualties/.test(x)));
assert(nsic.effects.some(x=>/\+2 Captaincy/.test(x)));
assert(nsic.sourceIssues.length);

for (const topic of R.topics) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}

console.log('Research V2 batch 01 regression tests passed.');

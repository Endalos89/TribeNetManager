const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');
require('../src/research-v2-batch-03.js');
require('../src/research-v2-batch-04.js');
require('../src/research-v2-batch-05.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 5);
assert.strictEqual(R.batches[4].id, 'research-v2-batch-05');
assert.strictEqual(R.batches[4].pages, '110–128');
const batch = R.topics.filter(t => t.batchId === 'research-v2-batch-05');
assert.strictEqual(batch.length, 35, 'Batch 5 should contain 35 individual research topics');

const find = (skill,name) => R.topics.find(t => R.canon(t.skill)===R.canon(skill) && R.canon(t.name)===R.canon(name));

const boots = find('Leatherwork','Combat Boots');
assert(boots.effects.some(x=>/Combat Morale.*0\.02/.test(x)));
assert(boots.sourceIssues.some(x=>/does not make clear/.test(x)));
const leash = find('Leatherwork','Dog Leash');
assert(leash.effects.some(x=>/\+2 Security/.test(x)));
assert(leash.affectsSkills.includes('Security'));
const saddle = find('Leatherwork','Triball Saddle');
assert(saddle.effects.some(x=>/\+2 effective Triball/.test(x)));
assert(saddle.requirements.some(x=>/Horse/.test(x)));

const haiku = find('Literacy','Haiku');
assert(haiku.effects.some(x=>/\+0\.05 General Morale/.test(x)));
assert(haiku.sourceIssues.some(x=>/books may not be written/i.test(x)));
const scroll = find('Literacy','Scroll');
assert(scroll.recipe.output.item==='Scroll' && scroll.recipe.output.quantity===5);
assert(scroll.notes.some(x=>/Special Ink/.test(x)));

const amphib1 = find('Maintain Boats','Amphibious Warfare I');
const amphib2 = find('Maintain Boats','Amphibious Warfare II');
assert(amphib1.effects.some(x=>/25%/.test(x)));
assert(amphib2.effects.some(x=>/aggregate \+50%/.test(x)));

const marines = find('Mariner','Marines');
assert(marines.effects.some(x=>/\+3 effective Mariner/.test(x)));
const pro = find('Mariner','Professional Sailor');
assert.strictEqual(pro.status,'proposed');
assert(pro.effects.some(x=>/1\.5 sailors/.test(x)));
assert(pro.prerequisites.some(x=>/Captaincy 10/.test(x.label)));

const statue = find('Metalwork','Bronze Statue');
assert(statue.effects.some(x=>/trade good/.test(x)));
assert(statue.recipe.inputs.some(i=>i.item==='Bronze' && i.quantity===1000));
const chisel = find('Metalwork','Chisel');
assert(chisel.effects.some(x=>/15 Stone/.test(x)));
assert(chisel.affectsSkills.includes('Stonework'));
const knife = find('Metalwork','Knife');
for (const skill of ['Skinning','Gutting','Boning','Farming']) assert(knife.affectsSkills.includes(skill));
const water = find('Metalwork','Water Tank');
assert(water.effects.some(x=>/1,000 lb/.test(x)));
assert.strictEqual(water.recipe.variants.length,3);
assert(water.recipe.variants.some(v=>v.inputs.some(i=>i.item==='Copper'&&i.quantity===40)));

const milk11 = find('Milking','Milking 11');
assert(milk11.effects.some(x=>/10%/.test(x)));
const maids = find('Milking','Milk Maids');
assert(maids.effects.some(x=>/13 Cattle/.test(x)));
assert(maids.sourceIssues.some(x=>/1,300 Milk/.test(x)));

const oilmill = find('Milling','Oilmill');
assert.strictEqual(R.entity('Oilmill').kind,'facility');
assert(oilmill.effects.some(x=>/1 Oil and 10 Fodder/.test(x)));
assert(oilmill.restrictions.some(x=>/10 Oilmills per Clan/.test(x)));
assert(oilmill.sourceIssues.some(x=>/do not arithmetically align/.test(x)));
const sawmill = find('Milling','Sawmill');
assert(sawmill.effects.some(x=>/×8/.test(x)));
assert(sawmill.requirements.some(x=>/River or Canal/.test(x)));
assert(sawmill.restrictions.some(x=>/may not use an Adze or Saw/.test(x)));
const windmill = find('Milling','Windmill');
assert(windmill.effects.some(x=>/8,000 Grain.*12,000 Flour/.test(x)));

const appropriate = find('Mining','Appropriate Mining Tool');
assert(appropriate.effects.some(x=>/both a Pick and a Shovel/.test(x)));
const geo1 = find('Mining','Geology I');
const geo2 = find('Mining','Geology II');
const geo3 = find('Mining','Geology III');
assert(geo1.effects.some(x=>/\+2 to Mining/.test(x)));
assert(geo2.effects.some(x=>/\+2 to Mining/.test(x)));
assert(geo3.effects.some(x=>/\+2 to Mining/.test(x)));
assert(R.entity('Geology') && R.entity('Geology').kind==='skill');
const cart = find('Mining','Ore Cart');
assert(cart.effects.some(x=>/\+100% Mining output/.test(x)));
assert(cart.recipe.variants.some(v=>v.inputs.some(i=>i.item==='Bronze'&&i.quantity===20)));
assert(cart.sourceGaps.some(x=>/does not explicitly state the production activity/.test(x)));
const salt = find('Mining','Salt Panning');
assert(salt.effects.some(x=>/Salt Mine.*Prairie Hex/.test(x)));

assert(R.affectingSkill('Triball').some(t=>t.skill==='Leatherwork'&&t.name==='Triball Saddle'));
assert(R.affectingSkill('Security').some(t=>t.name==='Dog Leash'));
assert(R.affectingSkill('Farming').some(t=>t.name==='Knife'));
assert(R.affectingSkill('Forestry').some(t=>t.skill==='Milling'&&t.name==='Sawmill'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}

console.log('Research V2 batch 05 regression tests passed.');

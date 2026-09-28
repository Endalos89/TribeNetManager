const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');
require('../src/research-v2-batch-03.js');
require('../src/research-v2-batch-04.js');
require('../src/research-v2-batch-05.js');
require('../src/research-v2-batch-06.js');
require('../src/research-v2-batch-07.js');
require('../src/research-v2-batch-08.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 8);
assert.strictEqual(R.batches[7].id, 'research-v2-batch-08');
assert.strictEqual(R.batches[7].pages, '185–204');
const batch = R.topics.filter(t => t.batchId === 'research-v2-batch-08');
assert.strictEqual(batch.length, 26, 'Batch 8 should contain 26 structured research entries');
const find=(skill,name)=>R.topics.find(t=>R.canon(t.skill)===R.canon(skill)&&R.canon(t.name)===R.canon(name));

const productivity=find('Shipwright','Improved Productivity I (ShipW 25)');
assert(productivity.effects.some(x=>/3 workers.*4 effective/.test(x)));
assert(productivity.notes.some(x=>/ShipW 25/.test(x)));
const drydock=find('Shipwright','Drydock');
assert(drydock.effects.some(x=>/1\.5 effective/.test(x)));
assert.strictEqual(R.entity('Drydock').kind,'facility');

const treb=find('Siege Equipment','Trebuchet');
assert(treb.effects.some(x=>/5 Stones/.test(x)));
assert(treb.sourceIssues.length >= 2);
assert(R.entity('Trebuchet'));
const press=find('Slavery','Press Gang');
assert(press.effects.some(x=>/50 \+ 4d12/.test(x)));
const spies=find('Spying','Expert Spies');
assert(spies.effects.some(x=>/25%/.test(x)));

const marble=find('Stonework','Marble Statue');
assert(marble.effects.some(x=>/Marble mine/.test(x)));
assert(R.entity('Marble Statue'));
assert.strictEqual(R.entity('Marble Mine').kind,'facility');
const laager=find('Tactics','Wagon Laager');
assert(laager.requirements.some(x=>/1 Wagon or Ore Cart.*10 Warriors/.test(x)));
assert(laager.restrictions.some(x=>/Mountains/.test(x)));
const pits=find('Tanning','Cascade Tanning Pits');
assert(pits.effects.some(x=>/8 Leather/.test(x)));
assert.strictEqual(R.entity('Cascade Tanning Pits').kind,'facility');

const dungeon=find('Torture','Dungeon');
assert(dungeon.sourceGaps.some(x=>/See Engineering/.test(x)));
const thumbs=find('Torture','Thumb Screws');
assert(thumbs.effects.some(x=>/additional question/.test(x)));

const arena=find('Triball','Triball Arena');
assert(arena.effects.some(x=>/\+50% Silver/.test(x)));
assert(arena.recipe.variants.length === 1);
assert.strictEqual(R.entity('Triball Arena').kind,'facility');
const club=find('Triball','Triball Club');
assert(club.effects.some(x=>/doubled/.test(x)));
const guild=find('Triball','Triball Guild');
assert(guild.effects.some(x=>/additional 800 Warriors/.test(x)));
assert(guild.restrictions.some(x=>/10 Clans/.test(x)));
assert.strictEqual(R.entity('Minor League Arena').kind,'facility');

const crossbow=find('Weapons','Crossbow');
assert(crossbow.recipe.variants.length === 1);
assert(crossbow.restrictions.some(x=>/Desert or Arid/.test(x)));
const katana=find('Weapons','Katana');
assert(katana.effects.some(x=>/Steel Sword/.test(x)));
const repeating=find('Weapons','Repeating Arbalest');
assert(repeating.effects.some(x=>/one-third more casualties/.test(x)));
assert(repeating.effects.some(x=>/20 Quarrels/.test(x)));
const scimitar=find('Weapons','Scimitar');
assert(scimitar.restrictions.some(x=>/150 people/.test(x)));
const ulf=find('Weapons','Ulfbehrt Sword');
assert(ulf.restrictions.some(x=>/Infantry/.test(x)));
assert(ulf.restrictions.some(x=>/200 people/.test(x)));

assert(R.notesForSkill('Siegecraft').some(n=>/no research topics/.test(n.note)));
assert(R.notesForSkill('Waxworks').some(n=>/no research topics/.test(n.note)));
assert(R.affectingSkill('Farming').some(t=>t.skill==='Skinning'&&t.name==='Knife'));
assert(R.affectingSkill('Quarrying').some(t=>t.skill==='Stonework'&&t.name==='Chisel'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}
console.log('Research V2 batch 08 regression tests passed.');

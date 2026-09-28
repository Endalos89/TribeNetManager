const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');
require('../src/research-v2-batch-03.js');
require('../src/research-v2-batch-04.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 4);
assert.strictEqual(R.batches[3].id, 'research-04-healing-leadership');
assert.strictEqual(R.batches[3].pages, '94–109');
const batch = R.topics.filter(t => t.batchId === 'research-04-healing-leadership');
assert.strictEqual(batch.length, 32, 'Batch 4 should contain 32 individual research topics');

const find = (skill,name) => R.topics.find(t => R.canon(t.skill)===R.canon(skill) && R.canon(t.name)===R.canon(name));

const hospital = find('Healing','Hospital');
assert(hospital.effects.some(x=>/\+0\.4% population growth/.test(x)));
assert(hospital.effects.some(x=>/\+4 to Healing/.test(x)));
assert(hospital.requirements.some(x=>/Healing must be at least level 10/.test(x)));
assert.strictEqual(R.entity('Hospital').kind,'facility');

const med1 = find('Healing','Medicine 1');
const med2 = find('Healing','Medicine 2');
assert(med1.effects.some(x=>/\+0\.2% population growth/.test(x)));
assert(med1.effects.some(x=>/\+4 Healing/.test(x)));
assert(med2.effects.some(x=>/further \+0\.2%/.test(x)));
assert(med2.sourceGaps.some(x=>/does not state.*second \+4/i.test(x)));
const triage = find('Healing','Triage');
assert(triage.effects.some(x=>/25%/.test(x)));

const artillery = find('Heavy Weapons','Artillerists');
assert(artillery.effects.some(x=>/Siege or Assault/.test(x) && /\+2/.test(x)));

const dairy = find('Herding','Dairy Cattle');
assert(dairy.effects.some(x=>/Milking/.test(x)));
assert(dairy.effects.some(x=>/Cheesemaking/.test(x)));
assert(R.entity('Milking') && R.entity('Milking').kind === 'skill');
assert(R.entity('Cheesemaking') && R.entity('Cheesemaking').kind === 'skill');
assert(R.entity('Milk').recipes.some(r=>r.output.item==='Milk' && r.output.quantity===100));
assert(R.entity('Cheese').recipes.some(r=>r.output.item==='Cheese' && r.output.quantity===30));
const expert = find('Herding','Expert Breeding');
assert(expert.effects.some(x=>/\+3 to Herding/.test(x)));
assert(R.notesForSkill('Herding').some(n=>/Numerous topics under review/.test(n.note)));

const close = find('Horsemanship','Close Formation (Close Order Cavalry)');
assert(close.effects.some(x=>/\+3 effective Horsemanship/.test(x)));
assert(close.prerequisites.some(x=>/Tactics 5/.test(x.label)));
const maneuvers = find('Horsemanship','Triball Maneuvers');
assert(maneuvers.affectsSkills.includes('Triball'));
assert(maneuvers.effects.some(x=>/\+2 effective Triball/.test(x)));

const huntDog = find('Hunting','Hunting Dogs');
assert(huntDog.effects.some(x=>/counts as three Hunters/.test(x)));
assert(huntDog.restrictions.some(x=>/do not breed/.test(x)));
assert(R.entity('Hunting Dog'));
const mongol = find('Hunting','Mongol Hunt');
assert(mongol.effects.some(x=>/1\.2/.test(x)));
assert(mongol.requirements.some(x=>/1,000 Hunters/.test(x)));
const mongol2 = find('Hunting','Mongol Hunt 2');
assert(mongol2.effects.some(x=>/1\.4/.test(x)));
const trappers = find('Hunting','Trappers');
assert(trappers.effects.some(x=>/10 Improved Traps/.test(x)));
assert(trappers.effects.some(x=>/2 Advanced Traps/.test(x)));

const audit = find('Intelligence','Goods Audit');
assert(audit.effects.some(x=>/highest quantity/.test(x)));
assert(audit.restrictions.some(x=>/No Books/.test(x)));
assert(audit.sourceIssues.some(x=>/Good Audit II/.test(x)));
const marketResearch = find('Intelligence','Market Research');
assert(marketResearch.effects.some(x=>/repeatable/.test(x)));
assert(marketResearch.restrictions.some(x=>/maximum of four/.test(x)));

const generalship = find('Leadership','Generalship');
assert(generalship.effects.some(x=>/Group B skill Generalship/.test(x)));
assert(generalship.effects.some(x=>/one-half.*Generalship.*rounded down/i.test(x)));
assert(R.entity('Generalship') && R.entity('Generalship').kind === 'skill');
const junior = find('Leadership','Junior Officer');
assert(junior.effects.some(x=>/\+1 to Leadership/.test(x)));
assert(junior.effects.some(x=>/rout severity by 5%/.test(x)));

assert(R.affectingSkill('Hunting').some(t=>t.skill==='Herding' && t.name==='Hunting Dogs'));
assert(R.affectingSkill('Triball').some(t=>t.name==='Triball Maneuvers'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}

console.log('Research V2 batch 04 regression tests passed.');

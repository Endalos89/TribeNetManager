const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
require('../src/research-v2-batch-01.js');
require('../src/research-v2-batch-02.js');
require('../src/research-v2-batch-03.js');

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 3);
assert.strictEqual(R.batches[2].id, 'research-03-fire-control-glasswork');
assert.strictEqual(R.batches[2].pages, '79–93');
const batch = R.topics.filter(t => t.batchId === 'research-03-fire-control-glasswork');
assert.strictEqual(batch.length, 21, 'Batch 3 should contain 21 individual research topics');

const find = (skill,name) => R.topics.find(t => R.canon(t.skill)===R.canon(skill) && R.canon(t.name)===R.canon(name));

const trawler = find('Fishing','Trawler');
assert(trawler.effects.some(x=>/increase Fish output/.test(x)));
assert(trawler.sourceGaps.some(x=>/numeric Fishing multiplier/.test(x)));
assert(trawler.sourceGaps.some(x=>/Oar quantity/.test(x)));
assert.strictEqual(R.entity('Trawler').kind,'ship');
assert(R.entity('Trawler').notes.some(x=>/Defense Points 16/.test(x)));

const net = find('Fishing','Trawling Net');
assert(net.effects.some(x=>/\+2 Active Months/.test(x)));
assert(net.restrictions.some(x=>/either a Net or a Trawling Net/.test(x)));

const log10 = find('Forestry','10 Logs / Person');
assert(log10.effects.some(x=>/10 Logs per person/.test(x)));
const burner = find('Forestry','Burner Improvements');
assert(burner.effects.some(x=>/doubles the effective workers/.test(x)));
assert.strictEqual(R.entity('Burner Improvement').kind,'facility');
const scraperMetal = find('Forestry','Scraper (Metal)');
assert.strictEqual(scraperMetal.recipe.variants.length,1);
assert(scraperMetal.recipe.variants[0].inputs.some(i=>i.item==='Bronze' && i.quantity===1));
const scraperStone = find('Forestry','Scraper (Stone)');
assert(scraperStone.recipe.skills.some(s=>s.name==='Stonework' && s.level===2));
const saw = find('Forestry','Saw');
assert(saw.effects.some(x=>/multiplies.*four/i.test(x)));
assert.strictEqual(saw.recipe.variants.length,2);
assert(saw.restrictions.some(x=>/Adze/.test(x)));

const advanced = find('Furrier','Advanced Trap');
assert(advanced.affectsSkills.includes('Hunting'));
assert(advanced.effects.some(x=>/\+1\.0 effective Hunting/.test(x)));
const improved = find('Furrier','Improved Trap');
assert(improved.effects.some(x=>/\+0\.15 effective Hunting/.test(x)));
assert(improved.effects.some(x=>/without owning the research|do not possess the research/.test(x)));
const winter = find('Furrier','Winter Furs');
assert(winter.effects.some(x=>/twice the price/.test(x)));
assert(winter.requirements.some(x=>/five Traps/.test(x)));

const geo11 = find('Geology','Geology 11');
assert(geo11.effects.some(x=>/\+1 level to Geology/.test(x)));
assert(geo11.notes.some(x=>/no benefit.*greater than 10/i.test(x)));
const geo4 = find('Geology','Geology IV');
assert(geo4.affectsSkills.includes('Mining'));
assert(geo4.effects.some(x=>/\+2 levels to Mining/.test(x)));
assert(geo4.sourceIssues.length, 'Geology grouped Leads To inconsistency should be preserved');
assert(R.affectingSkill('Mining').some(t=>t.skill==='Geology'));

const field = find('Glasswork','Field Glasses');
assert(field.affectsSkills.includes('Leadership'));
assert(field.effects.some(x=>/\+2 Leadership/.test(x)));
assert(field.restrictions.some(x=>/not Siege or Assault/.test(x)));
assert(R.entity('Field Glasses').effects.some(x=>/\+2 Leadership/.test(x)));
const spy = find('Glasswork','Spy Glass');
assert(spy.affectsSkills.includes('Captaincy'));
assert(spy.effects.some(x=>/\+2 Captaincy/.test(x)));
assert(spy.requirements.some(x=>/Each Fleet/.test(x)));
assert(R.affectingSkill('Captaincy').some(t=>t.name==='Spy Glass'));

const fireNotes = R.notesForSkill('Fire Control');
assert(fireNotes.some(n=>/no research topics/.test(n.note)));
const fletchingNotes = R.notesForSkill('Fletching');
assert(fletchingNotes.length===1);
const generalshipNotes = R.notesForSkill('Generalship');
assert(generalshipNotes.some(n=>n.status==='under-review'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}

console.log('Research V2 batch 03 regression tests passed.');

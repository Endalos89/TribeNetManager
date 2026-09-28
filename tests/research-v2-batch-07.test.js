const assert = require('assert');

global.window = {};
require('../src/research-v2-schema.js');
for (let i = 1; i <= 7; i++) require(`../src/research-v2-batch-0${i}.js`);

const R = global.window.TribeNetResearchV2;
assert(R, 'Research V2 registry should load');
assert.strictEqual(R.batches.length, 7);
assert.strictEqual(R.batches[6].id, 'research-v2-batch-07');
assert.strictEqual(R.batches[6].pages, '158–184');
const batch = R.topics.filter(t => t.batchId === 'research-v2-batch-07');
assert.strictEqual(batch.length, 43, 'Batch 7 should contain 43 structured research entries');
const find=(skill,name)=>R.topics.find(t=>R.canon(t.skill)===R.canon(skill)&&R.canon(t.name)===R.canon(name));

assert(find('Rowing','Rowing 11').effects.some(x=>/\+1/.test(x)));
const expert=find('Sailing','Expert Sailors 1');
assert(expert.affectsSkills.includes('Navigation'));
assert(expert.affectsSkills.includes('Seamanship'));
assert(expert.requirements.some(x=>/Navigation.*10/.test(x)));
const rain=find('Sailing','Raincatching');
assert(rain.effects.some(x=>/25%/.test(x)));
assert(rain.requirements.some(x=>/5 Cloth per ship/.test(x)));
const camp=find('Sanitation','Camp Sanitation');
assert(camp.effects.some(x=>/same Sanitation skill/.test(x)));
assert(camp.requirements.some(x=>/0\.5%/.test(x)));
const sewers=find('Sanitation','Sewers');
assert(sewers.effects.some(x=>/\+4 Sanitation/.test(x)));
assert(sewers.effects.some(x=>/\+0\.4%/.test(x)));
assert(sewers.sourceIssues.some(x=>/Engineering 10/.test(x) && /Engineering 9/.test(x)));

const ranger1=find('Scouting','Ranger I');
assert(ranger1.effects.some(x=>/Group C skill Ranger/.test(x)));
assert(R.entity('Ranger') && R.entity('Ranger').kind==='skill');
const scout11=find('Scouting','Scouting 11');
assert(scout11.notes.some(x=>/no benefit.*above 10/i.test(x)));
const fm6=find('Seamanship','Fleet Movement 6');
assert(fm6.effects.some(x=>/\+6 MV total/.test(x)));
const outpost=find('Security','Outpost');
assert.strictEqual(R.entity('Outpost').kind,'facility');
assert(outpost.effects.some(x=>/2 additional scouting groups/.test(x)));
const patrol=find('Security','Security Patrol');
assert(patrol.effects.some(x=>/3 percentage points per Security level/.test(x)));

const bush1=find('Seeking','Bush Lore I');
assert(R.entity('Bush Lore') && R.entity('Bush Lore').kind==='skill');
const experienced=find('Seeking','Experienced Seekers');
assert(experienced.effects.some(x=>/doubled/.test(x)));
const track=find('Seeking','Trackers');
assert(track.effects.some(x=>/\+10%/.test(x)));
const veteran=find('Seeking','Veteran Trackers');
assert(veteran.effects.some(x=>/\+30% total/.test(x)));
assert(veteran.affectsSkills.includes('Hunting'));

const tent=find('Sewing','Command Tent');
assert(tent.affectsSkills.includes('Leadership'));
assert(tent.affectsSkills.includes('Tactics'));
assert(tent.effects.some(x=>/\+1 Leadership Modifier/.test(x)));
assert(R.entity('Command Tent'));
const fel1=find('Shipbuilding','Felucca Class I');
assert.strictEqual(R.entity('Felucca Class I').kind,'ship');
assert(fel1.effects.some(x=>/58 MV/.test(x) && /54 MV/.test(x)));
const fel3=find('Shipbuilding','Felucca Class III');
assert(fel3.sourceIssues.some(x=>/9\+2/.test(x)));
const frigate=find('Shipbuilding','Frigate');
assert.strictEqual(R.entity('Frigate').kind,'ship');
assert(frigate.effects.some(x=>/12 Naval Cannons/.test(x)));
const whaler=find('Shipbuilding','Whaler');
assert.strictEqual(R.entity('Whaler').kind,'ship');
assert(whaler.requirements.some(x=>/Whaling licence/.test(x)));
assert(whaler.sourceIssues.some(x=>/Metalwork 8/.test(x) && /Metalwork 5/.test(x)));

assert(R.affectingSkill('Navigation').some(t=>t.skill==='Sailing'&&t.name==='Expert Sailors 1'));
assert(R.affectingSkill('Hunting').some(t=>t.skill==='Seeking'&&t.name==='Veteran Trackers'));
assert(R.affectingSkill('Leadership').some(t=>t.skill==='Sewing'&&t.name==='Command Tent'));

for (const topic of batch) {
  assert(topic.skill && topic.name && topic.dl && topic.page, `Required fields missing for ${topic.name}`);
  assert(topic.effects.length || topic.description || topic.sourceGaps.length, `No rule content/gap marker for ${topic.skill} / ${topic.name}`);
}
console.log('Research V2 batch 07 regression tests passed.');

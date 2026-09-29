const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const context = { window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console };
context.globalThis = context.window;
vm.createContext(context);
const run = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename:name });
run('skill-overhaul-data.js');
run('skill-overhaul-profile-registry.js');
run('skill-overhaul-category-b-1.js');
run('skill-overhaul-category-b-2.js');
run('skill-overhaul-category-b-3.js');
run('skill-overhaul-category-b-4.js');
run('skill-overhaul-category-b-5.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const finalBatch = ['Triball','Admiralty','Generalship'];
for (const name of finalBatch) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Final Group B profile missing: ${name}`);
  if (profile.category !== 'B') throw new Error(`${name} should be a Group B dossier`);
  if (profile.baseline !== 'Economics') throw new Error(`${name} should use the approved Economics scaling baseline`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const triball = S.profile('Triball');
if (triball.primarySection !== '15.1' || triball.mechanic !== 'scaling') throw new Error('Triball Fair dossier mismatch');
if (!/Participants × \(2 \+ Triball\/2 \+ Economics\/4\) Silver/.test(triball.levelDetail)) throw new Error('Triball Silver formula missing');
if (!/maximum 800 Warriors, 800 Horses and 800 Clubs/i.test(triball.workerRule)) throw new Error('Triball normal team cap missing');
if (!triball.factors.some(x => x.factor === 'Participant values' && /Warrior 1/.test(x.effect) && /Horse 1/.test(x.effect) && /Club 0.5/.test(x.effect))) throw new Error('Triball participant weights missing');
if (!triball.factors.some(x => x.factor === 'Fair timing' && /Months 4 and 10/.test(x.effect))) throw new Error('Triball Fair timing missing');
if (!/1,600 Warriors, Horses and Clubs/.test(triball.researchEffectOverrides['Large Teams'])) throw new Error('Triball Large Teams effect missing');
if (!/months 1 and 7/.test(triball.researchEffectOverrides['Off Season']) || !/1,000 Silver per Gold/.test(triball.researchEffectOverrides['Off Season'])) throw new Error('Triball Off Season effect missing');
if (!/\+50% Silver/.test(triball.researchEffectOverrides['Triball Arena'])) throw new Error('Triball Arena effect missing');
if (!/doubled/.test(triball.researchEffectOverrides['Triball Club'])) throw new Error('Triball Club effect missing');
if (!/Silver ÷ 250/.test(triball.researchEffectOverrides['Triball Guild'])) throw new Error('Triball Guild Gold conversion missing');
if (!/\+2 effective Triball/.test(triball.researchEffectOverrides['Triball Maneuvers'])) throw new Error('Triball Maneuvers effect missing');
if (!/\+2 effective Triball/.test(triball.researchEffectOverrides['Triball Saddle'])) throw new Error('Triball Saddle effect missing');
if (!S.itemBenefitsFor('Triball Club').some(x => x.skill === 'Triball')) throw new Error('Triball Club backlink missing');
if (!S.itemBenefitsFor('Triball Saddle').some(x => x.skill === 'Triball')) throw new Error('Triball Saddle backlink missing');
if (!S.itemBenefitsFor('Triball Arena').some(x => x.skill === 'Triball')) throw new Error('Triball Arena backlink missing');

const admiralty = S.profile('Admiralty');
if (admiralty.primarySection !== '17.15' || admiralty.mechanic !== 'scaling') throw new Error('Admiralty naval-command dossier mismatch');
if (!/Captaincy \+ floor\(Admiralty\/2\)/.test(admiralty.levelDetail)) throw new Error('Admiralty Captaincy formula missing');
if (!admiralty.factors.some(x => x.factor === 'Unlock' && /Captaincy research/.test(x.effect))) throw new Error('Admiralty research unlock missing');
if (!admiralty.factors.some(x => x.factor === 'Captaincy modifier' && /floor\(Admiralty ÷ 2\)/.test(x.effect))) throw new Error('Admiralty modifier missing');
if (!/\+0.20 Combat Morale/.test(admiralty.researchEffectOverrides.Navy)) throw new Error('Navy Admiralty effect missing');
if (!/\+0.02 to \+0.03/.test(admiralty.researchEffectOverrides['Naval Tradition'])) throw new Error('Naval Tradition effect missing');

const generalship = S.profile('Generalship');
if (generalship.primarySection !== '17.13' || generalship.mechanic !== 'scaling') throw new Error('Generalship land-command dossier mismatch');
if (!/Leadership \+ floor\(Generalship\/2\)/.test(generalship.levelDetail)) throw new Error('Generalship Leadership formula missing');
if (!generalship.factors.some(x => x.factor === 'Unlock prerequisite' && /Leadership 10/.test(x.effect))) throw new Error('Generalship Leadership 10 prerequisite missing');
if (!generalship.factors.some(x => x.factor === 'Leadership modifier' && /floor\(Generalship ÷ 2\)/.test(x.effect))) throw new Error('Generalship modifier missing');
if (!generalship.factors.some(x => x.factor === 'Order of attacks' && /No effect/.test(x.effect))) throw new Error('Generalship order-of-attacks exclusion missing');
if (!generalship.factors.some(x => x.factor === 'Current own-topic status' && /Under review/.test(x.effect))) throw new Error('Generalship research source-gap note missing');

// Current N02.2 base Group B table, plus the two explicit research-unlocked Category B skills.
const currentGroupB = [
  'Administration','Apothecary','Archery','Captaincy','Combat','Courier','Diplomacy','Economics',
  'Garrison','Healing','Heavy Weapons','Horsemanship','Intelligence','Leadership','Mariner',
  'Mobilisation','Navigation','Politics','Religion / Atheism','Rowing','Sailing','Scouting',
  'Seamanship','Security','Shipwright','Slavery','Spying','Tactics','Torture','Triball',
  'Admiralty','Generalship'
];
for (const name of currentGroupB) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Group B final audit: dossier missing for ${name}`);
  if (profile.category !== 'B') throw new Error(`Group B final audit: ${name} not categorised as B`);
}
if (S.profile('Atheism') !== S.profile('Religion / Atheism')) throw new Error('Atheism alias should resolve to the combined Religion dossier');

// These remain in old/Excel valid-skill data but are not current N02.2 base skills nor explicit new research skills.
for (const stale of ['Raiding','Artillery','Influence','Supervision','Understanding']) {
  if (S.profile(stale)) throw new Error(`Stale/future-only valid-skill entry should not receive a current Group B dossier: ${stale}`);
}

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-b-5.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-b-5.js')) throw new Error('Final Group B skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-b-5.js') < html.indexOf('skill-overhaul-category-b-4.js')) throw new Error('B5 data must load after B4');
if (html.indexOf('skill-overhaul-category-b-5.js') > html.indexOf('compendium.js')) throw new Error('B5 data must load before the Compendium renderer');

console.log(`Group B final audit passed: ${currentGroupB.length} current/research-unlocked dossiers accounted for; stale Excel-only entries excluded`);

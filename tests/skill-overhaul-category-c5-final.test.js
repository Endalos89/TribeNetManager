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
for (const name of [
  'skill-overhaul-category-c-1.js',
  'skill-overhaul-category-c-2.js',
  'skill-overhaul-category-c-3.js',
  'skill-overhaul-category-c-4.js',
  'skill-overhaul-category-c-5.js'
]) run(name);

const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const expectedBase = [
  'Archaeology','Architecture','Alchemy','Apiarism','Art','Banking','Baking',
  'Brick Making','Cooking','Dance','Distilling','Engineering','Farming','Glasswork',
  'Literacy','Maintain Boats','Milling','Music','Refining','Research','Sanitation',
  'Seeking','Shipbuilding','Stonework'
];
const expectedUnlocked = ['Apiology','Agriculture','Cheesemaking','Geology','Ranger','Bush Lore'];
const expectedAll = [...expectedBase, ...expectedUnlocked];

for (const name of expectedAll) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Final Group C profile missing: ${name}`);
  if (profile.category !== 'C') throw new Error(`${name} should be a Group C dossier`);
  if (!['Forestry','Woodwork','Hunting','Economics'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const actualC = Object.values(S.profiles)
  .filter(profile => profile?.category === 'C')
  .map(profile => profile.name)
  .sort();
const expectedSorted = [...expectedAll].sort();
if (JSON.stringify(actualC) !== JSON.stringify(expectedSorted)) {
  throw new Error(`Final Group C set mismatch. Expected ${expectedSorted.join(', ')}; got ${actualC.join(', ')}`);
}
if (actualC.length !== 30) throw new Error(`Expected exactly 30 current Group C dossiers, got ${actualC.length}`);

const ranger = S.profile('Ranger');
if (S.profile('Rangers') !== ranger) throw new Error('Ranger alias missing');
if (ranger.mechanic !== 'research-access' || ranger.baseline !== 'Woodwork') throw new Error('Ranger research-access dossier mismatch');
if (!ranger.factors.some(x => x.factor === 'Unlock' && /Ranger I/.test(x.effect))) throw new Error('Ranger I unlock missing');
if (!ranger.factors.some(x => x.factor === 'Ranger I–III' && /\+1 \/ \+3 \/ \+5 Scouting/.test(x.effect))) throw new Error('Ranger I-III Scouting progression missing');
if (!ranger.factors.some(x => x.factor === 'Skill requirement' && /Ranger 10/.test(x.effect))) throw new Error('Ranger 10 requirement missing');
if (!/\+2 Scouting/.test(ranger.researchEffectOverrides['Ranger IV, Ranger V, Ranger VI'])) throw new Error('Ranger IV-VI Scouting bonus missing');
if (!/level 7 or higher/.test(ranger.researchEffectOverrides['Ranger 7+'])) throw new Error('Ranger 7+ progression missing');
if (ranger.workerRule !== 'No Ranger worker activity is published') throw new Error('Ranger should not invent a worker activity');

const bush = S.profile('Bush Lore');
if (S.profile('BushLore') !== bush) throw new Error('Bush Lore alias missing');
if (bush.mechanic !== 'research-access' || bush.baseline !== 'Woodwork') throw new Error('Bush Lore research-access dossier mismatch');
if (!bush.factors.some(x => x.factor === 'Unlock' && /Bush Lore I/.test(x.effect))) throw new Error('Bush Lore I unlock missing');
if (!bush.factors.some(x => x.factor === 'Bush Lore I–III' && /\+1 \/ \+3 \/ \+5 Seeking/.test(x.effect))) throw new Error('Bush Lore I-III Seeking progression missing');
if (!bush.factors.some(x => x.factor === 'Skill requirement' && /Bush Lore 10/.test(x.effect))) throw new Error('Bush Lore 10 requirement missing');
if (!/\+2 Seeking/.test(bush.researchEffectOverrides['Bush Lore IV, Bush Lore V, Bush Lore VI'])) throw new Error('Bush Lore IV-VI Seeking bonus missing');
if (!/level 7 or higher/.test(bush.researchEffectOverrides['Bush Lore 7+'])) throw new Error('Bush Lore 7+ progression missing');
if (bush.workerRule !== 'No Bush Lore worker activity is published') throw new Error('Bush Lore should not invent a worker activity');

const audit = S.groupCAudit;
if (!audit) throw new Error('Final Group C audit metadata missing');
if (audit.mandateRevision !== 'N02.2' || audit.researchRevision !== 'April 11 2026') throw new Error('Group C audit source revisions missing');
if (JSON.stringify([...audit.baseTableSkills]) !== JSON.stringify(expectedBase)) throw new Error('Group C base-table audit set mismatch');
if (JSON.stringify([...audit.researchUnlockedSkills]) !== JSON.stringify(expectedUnlocked)) throw new Error('Group C research-unlocked audit set mismatch');
if (audit.currentSkills.length !== 30) throw new Error('Group C audit should contain exactly 30 current skills');
for (const stale of ['Design','Furniture','Astronomy']) {
  if (!audit.notCurrentGroupCSkillAttempts.some(x => x.name === stale)) throw new Error(`${stale} exclusion is not documented in final Group C audit`);
  const p = S.profile(stale);
  if (p?.category === 'C') throw new Error(`${stale} must not be restored as a current Group C dossier`);
}

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-c-5.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-c-5.js')) throw new Error('C5 final skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-c-5.js') < html.indexOf('skill-overhaul-category-c-4.js')) throw new Error('C5 final data must load after C4');
if (html.indexOf('skill-overhaul-category-c-5.js') > html.indexOf('compendium.js')) throw new Error('C5 final data must load before the Compendium renderer');

console.log('Final Group C reconciliation passed: 24 N02.2 table skills + 6 research-unlocked skills = 30 current dossiers');

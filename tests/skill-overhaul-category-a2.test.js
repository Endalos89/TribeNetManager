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
run('skill-overhaul-category-a-2.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

for (const name of ['Excavation','Fishing','Furrier','Gutting','Herding','Jewellery','Leatherwork']) {
  const p = S.profile(name);
  if (!p || p.category !== 'A') throw new Error(`A2 Group A profile missing: ${name}`);
}

const excavation = S.profile('Excavation');
if (excavation.layout !== 'category-a-activity' || !/10 workers per skill level/i.test(excavation.workerRule)) throw new Error('Excavation worker-cap dossier mismatch');
if (!excavation.outputs.some(x => x.item === 'Artefact' && x.rate === '1 / turn')) throw new Error('Excavation base Artefact return missing');
const artefacts = excavation.factTables.find(x => /Artefacts can be used/i.test(x.title));
for (const result of ['50 Actives','75 Warriors','1,200 Silver each','+0.01 General Morale']) {
  if (!artefacts?.rows.some(x => x.result === result)) throw new Error(`Excavation Artefact use missing: ${result}`);
}
if (!/Two Artefacts/.test(excavation.researchEffectOverrides['Expert Dig'])) throw new Error('Expert Dig summary missing');

const fishing = S.profile('Fishing');
if (fishing.layout !== 'category-a-activity' || fishing.mechanic !== 'efficiency') throw new Error('Fishing should use the Hunting-style activity dossier');
if (!fishing.outputs.some(x => x.item === 'Fish')) throw new Error('Fishing output missing');
const trawlNet = fishing.implements.find(x => x.name === 'Trawling Net');
if (!trawlNet || trawlNet.value !== '+2 AM' || trawlNet.baseMaxBenefit !== '+2 AM' || !/cannot be combined/i.test(trawlNet.detail)) throw new Error('Trawling Net +2 AM / exclusivity rule missing');
if (!fishing.supportImplements.some(x => x.name === 'Trawler' && /Greater Fishing output/.test(x.value))) throw new Error('Trawler Fishing support missing');

const furrier = S.profile('Furrier');
if (!furrier.factors.some(x => x.factor === 'Season') || !furrier.outputs.some(x => x.item === 'Furs')) throw new Error('Furrier output/factor model missing');
for (const [name,max] of [['Trap','+0.50 AM'],['Improved Trap','+0.75 AM'],['Advanced Trap','+1.00 AM']]) {
  const row = furrier.implements.find(x => x.name === name);
  if (!row || row.baseMaxBenefit !== max) throw new Error(`Furrier implement incorrect: ${name}`);
}
if (!/4 Winter Furs/.test(furrier.researchEffectOverrides['Winter Furs'])) throw new Error('Winter Furs summary missing');

const netSkills = S.itemBenefitsFor('Net').map(x => x.skill);
for (const skill of ['Hunting','Fishing','Furrier']) if (!netSkills.includes(skill)) throw new Error(`Net item benefit keyword missing: ${skill}`);
for (const skill of ['Hunting','Furrier']) if (!S.itemBenefitsFor('Advanced Trap').some(x => x.skill === skill)) throw new Error(`Advanced Trap benefit line missing: ${skill}`);

const gutting = S.profile('Gutting');
if (gutting.layout !== 'category-a-process' || !/10 workers per skill level/i.test(gutting.workerRule)) throw new Error('Gutting capacity/output model missing');
for (const [activity,gut,provs] of [['Gut Goats','12 Gut','24 Provisions'],['Gut Elephant','12 Gut','60 Provisions'],['Gut Dogs','8 Gut','24 Provisions']]) {
  const row = gutting.processRows.find(x => x.activity === activity);
  if (!row || !row.outputs.some(x => x.label === gut) || !row.outputs.some(x => x.label === provs)) throw new Error(`Gutting row missing: ${activity}`);
}
if (!gutting.combinedWith.includes('Skinning') || !gutting.combinedWith.includes('Boning')) throw new Error('Gutting combined processing rules missing');

const herding = S.profile('Herding');
if (herding.layout !== 'category-a-activity' || !/Fixed staffing/i.test(herding.workerRule)) throw new Error('Herding fixed-staffing model missing');
const herdTable = herding.factTables.find(x => /Herding requirements/i.test(x.title));
for (const [entity,amount] of [['Goat','20'],['Cattle','10'],['Horse','10'],['Elephant','5'],['Dog','10']]) {
  if (!herdTable?.rows.some(x => x.animal?.entity === entity && x.amount === amount)) throw new Error(`Herding staffing missing: ${entity}`);
}
if (herding.researchEffectOverrides['Expert Breeding'] !== '+3 effective Herding for Herd Growth.') throw new Error('Expert Breeding +3 Herding missing');
if (!/150 Cotton/.test(herding.researchEffectOverrides['Angora Goats'])) throw new Error('Angora Goats output missing');

const jewellery = S.profile('Jewellery');
if (jewellery.layout !== 'category-a-craft' || jewellery.directCrafts.length !== 4) throw new Error('Jewellery craft dossier mismatch');
const inlay = jewellery.directCrafts.find(x => x.entity === 'Inlay');
if (!inlay || inlay.level !== 8 || inlay.people !== 2 || !inlay.inputs.some(x => x.entity === 'Gold' && x.quantity === 20) || !inlay.inputs.some(x => x.entity === 'Jade' && x.quantity === 1)) throw new Error('Jewellery Inlay recipe incorrect');

const leather = S.profile('Leatherwork');
if (leather.layout !== 'category-a-craft' || leather.directCrafts.length !== 9) throw new Error('Leatherwork craft dossier mismatch');
if (!leather.directCrafts.some(x => x.entity === 'Backpack' && /30 lb/.test(x.detail))) throw new Error('Backpack carry benefit missing');
if (!leather.directCrafts.some(x => x.entity === 'Saddlebags' && /100 lb/.test(x.detail) && /50 lb/.test(x.detail))) throw new Error('Saddlebags carry benefit missing');
for (const [topic,text] of [['Combat Boots','+0.02 Combat Morale'],['Dog Leash','+2 Security'],['Triball Saddle','+2 effective Triball']]) {
  if (!leather.researchEffectOverrides[topic]?.includes(text)) throw new Error(`Leatherwork research summary missing: ${topic}`);
}
for (const [item,skill,value] of [['Combat Boots','Combat','+0.02 Combat Morale'],['Dog Leash','Security','+2 Security'],['Triball Saddle','Triball','+2 effective Triball']]) {
  if (!S.itemBenefitsFor(item).some(x => x.skill === skill && x.value === value)) throw new Error(`${item} item benefit line missing`);
}

const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul-category-a.js'), 'utf8');
for (const marker of ['category-a-activity','Other factors affecting','Base max benefit','researchEffectForSkill','implementTitle']) {
  if (!ui.includes(marker)) throw new Error(`A2 activity renderer missing marker: ${marker}`);
}
new Function(ui);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-a-2.js')) throw new Error('A2 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-a-2.js') < html.indexOf('skill-overhaul-profile-registry.js') || html.indexOf('skill-overhaul-category-a-2.js') > html.indexOf('compendium.js')) throw new Error('A2 skill data script load order is wrong');

console.log('Group A batch A2 checks passed: Excavation, Fishing, Furrier, Gutting, Herding, Jewellery and Leatherwork');
require('./skill-overhaul-category-a3.test.js');

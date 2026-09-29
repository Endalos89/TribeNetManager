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

const expected = ['Excavation','Fishing','Furrier','Gutting','Herding','Jewellery','Leatherwork'];
for (const name of expected) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`A2 profile missing: ${name}`);
  if (profile.category !== 'A') throw new Error(`${name} should be a Group A dossier`);
}

const excavation = S.profile('Excavation');
if (excavation.layout !== 'category-a-activity' || !/10 workers per skill level/i.test(excavation.workerRule)) throw new Error('Excavation worker-cap dossier mismatch');
if (!excavation.outputs.some(row => row.item === 'Artefact' && row.rate === '1 / turn')) throw new Error('Excavation base Artefact return missing');
const artefacts = excavation.factTables?.find(row => /Artefacts can be used/i.test(row.title));
if (!artefacts || !artefacts.rows.some(row => row.cost === '10' && /50 Actives/i.test(row.result))) throw new Error('Excavation 10 Artefacts -> 50 Actives use missing');
if (!artefacts.rows.some(row => row.cost === '15' && /75 Warriors/i.test(row.result))) throw new Error('Excavation 15 Artefacts -> 75 Warriors use missing');
if (!artefacts.rows.some(row => /Up to 5/.test(row.cost) && /1,200 Silver each/.test(row.result))) throw new Error('Excavation Fair sale rule missing');
if (excavation.researchEffectOverrides['Expert Dig'] !== 'Two Artefacts may be dug per turn using 20 people with implements; the unit may carry unlimited Artefacts.') throw new Error('Expert Dig skill-specific summary missing');

const fishing = S.profile('Fishing');
if (fishing.layout !== 'category-a-activity' || fishing.mechanic !== 'efficiency') throw new Error('Fishing should use the Hunting-style activity dossier');
if (!fishing.outputs.some(row => row.item === 'Fish')) throw new Error('Fishing Fish output missing');
const net = fishing.implements.find(row => row.name === 'Net');
const trawlNet = fishing.implements.find(row => row.name === 'Trawling Net');
if (!net || !/Improves Fishing returns/.test(net.value)) throw new Error('Fishing Net benefit missing');
if (!trawlNet || trawlNet.value !== '+2 AM' || trawlNet.baseMaxBenefit !== '+2 AM') throw new Error('Trawling Net +2 AM benefit missing');
if (!/not both/i.test(trawlNet.detail)) throw new Error('Trawling Net / Net exclusivity missing');
if (!fishing.supportImplements.some(row => row.name === 'Trawler' && /Greater Fishing output/.test(row.value))) throw new Error('Trawler support missing');

const furrier = S.profile('Furrier');
if (furrier.layout !== 'category-a-activity' || !furrier.factors.some(row => row.factor === 'Season')) throw new Error('Furrier Hunting-style factors missing');
for (const [name, value, max] of [['Trap','+0.10 AM','+0.50 AM'],['Improved Trap','+0.15 AM','+0.75 AM'],['Advanced Trap','+1.00 AM','+1.00 AM']]) {
  const row = furrier.implements.find(item => item.name === name);
  if (!row || row.value !== value || row.baseMaxBenefit !== max) throw new Error(`Furrier implement missing/incorrect: ${name}`);
}
if (!/4 Winter Furs/.test(furrier.researchEffectOverrides['Winter Furs'])) throw new Error('Furrier Winter Furs summary missing');

const netSkills = S.itemBenefitsFor('Net').map(row => row.skill);
for (const skill of ['Hunting','Fishing','Furrier']) if (!netSkills.includes(skill)) throw new Error(`Net item page keyword/benefit missing: ${skill}`);
const trapSkills = S.itemBenefitsFor('Advanced Trap').map(row => row.skill);
for (const skill of ['Hunting','Furrier']) if (!trapSkills.includes(skill)) throw new Error(`Advanced Trap benefit line missing: ${skill}`);

const gutting = S.profile('Gutting');
if (gutting.layout !== 'category-a-process' || !/10 workers per skill level/i.test(gutting.workerRule)) throw new Error('Gutting worker-cap dossier mismatch');
if (!gutting.processRows.some(row => row.activity === 'Gut Goats' && row.outputs.some(out => out.label === '12 Gut') && row.outputs.some(out => out.label === '24 Provisions'))) throw new Error('Gutting Goat output missing');
if (!gutting.processRows.some(row => row.activity === 'Gut Elephant' && row.outputs.some(out => out.label === '12 Gut'))) throw new Error('Gutting Elephant summary row missing');
if (!gutting.processRows.some(row => row.activity === 'Gut Dogs' && row.outputs.some(out => out.label === '8 Gut'))) throw new Error('Gutting Dog summary row missing');
if (!gutting.combinedWith.includes('Skinning') || !gutting.combinedWith.includes('Boning')) throw new Error('Gutting combined processing rules missing');

const herding = S.profile('Herding');
if (herding.layout !== 'category-a-activity' || !/Fixed staffing/i.test(herding.workerRule)) throw new Error('Herding special staffing dossier mismatch');
const herdTable = herding.factTables?.find(row => /Herding requirements/i.test(row.title));
if (!herdTable || !herdTable.rows.some(row => row.animal?.entity === 'Goat' && row.amount === '20')) throw new Error('Herding Goat staffing missing');
if (!herdTable.rows.some(row => row.animal?.entity === 'Elephant' && row.amount === '5')) throw new Error('Herding Elephant staffing missing');
if (herding.researchEffectOverrides['Expert Breeding'] !== '+3 effective Herding for Herd Growth.') throw new Error('Expert Breeding +3 Herding summary missing');
if (!/150 Cotton/.test(herding.researchEffectOverrides['Angora Goats'])) throw new Error('Angora Goats production summary missing');

const jewellery = S.profile('Jewellery');
if (jewellery.layout !== 'category-a-craft' || jewellery.directCrafts.length !== 4) throw new Error('Jewellery direct-craft dossier mismatch');
const inlay = jewellery.directCrafts.find(row => row.entity === 'Inlay');
if (!inlay || inlay.level !== 8 || inlay.people !== 2 || !inlay.inputs.some(row => row.entity === 'Gold' && row.quantity === 20) || !inlay.inputs.some(row => row.entity === 'Jade' && row.quantity === 1)) throw new Error('Jewellery Inlay recipe incorrect');

const leather = S.profile('Leatherwork');
if (leather.layout !== 'category-a-craft' || leather.directCrafts.length !== 9) throw new Error('Leatherwork direct-craft dossier mismatch');
if (!leather.directCrafts.some(row => row.entity === 'Backpack' && row.level === 4 && /30 lb/.test(row.detail))) throw new Error('Leatherwork Backpack benefit missing');
if (!leather.directCrafts.some(row => row.entity === 'Saddlebags' && row.level === 5 && /100 lb/.test(row.detail) && /50 lb/.test(row.detail))) throw new Error('Leatherwork Saddlebags benefit missing');
if (leather.researchEffectOverrides['Combat Boots'].indexOf('+0.02 Combat Morale') === -1) throw new Error('Leatherwork Combat Boots effect missing');
if (leather.researchEffectOverrides['Dog Leash'].indexOf('+2 Security') === -1) throw new Error('Leatherwork Dog Leash effect missing');
if (leather.researchEffectOverrides['Triball Saddle'].indexOf('+2 effective Triball') === -1) throw new Error('Leatherwork Triball Saddle effect missing');

if (!S.itemBenefitsFor('Combat Boots').some(row => row.skill === 'Combat' && row.value === '+0.02 Combat Morale')) throw new Error('Combat Boots item benefit line missing');
if (!S.itemBenefitsFor('Dog Leash').some(row => row.skill === 'Security' && row.value === '+2 Security')) throw new Error('Dog Leash item benefit line missing');
if (!S.itemBenefitsFor('Triball Saddle').some(row => row.skill === 'Triball' && row.value === '+2 effective Triball')) throw new Error('Triball Saddle item benefit line missing');

const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul-category-a.js'), 'utf8');
for (const marker of ['category-a-activity','Other factors affecting','Base max benefit','researchEffectForSkill','Fishing implements']) {
  if (!ui.includes(marker)) throw new Error(`A2 activity renderer missing marker: ${marker}`);
}
new Function(ui);

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-a-2.js')) throw new Error('A2 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-a-2.js') < html.indexOf('skill-overhaul-profile-registry.js')) throw new Error('A2 data must load after the profile registry');
if (html.indexOf('skill-overhaul-category-a-2.js') > html.indexOf('compendium.js')) throw new Error('A2 data must load before the Compendium renderer');

console.log('Group A batch A2 checks passed: Excavation, Fishing, Furrier, Gutting, Herding, Jewellery and Leatherwork');

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
run('skill-overhaul-woodwork-refinement.js');
run('skill-overhaul-category-a-1.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

if (!/Active Month/i.test(S.amDefinition) || !/one person can do in a month/i.test(S.amDefinition)) throw new Error('AM definition should describe Active Month and monthly work capacity');
const hunting = S.profile('Hunting');
const ordered = S.sortByBaseMaxBenefit(hunting.implements);
if (ordered[0]?.name !== 'Advanced Trap') throw new Error('Hunting primary implements should sort by Base Max Benefit with Advanced Trap first');
if (ordered.at(-1)?.baseMaxBenefit !== '+0.05 AM') throw new Error('Lowest Base Max Benefit should sort to the bottom');

const woodwork = S.profile('Woodwork');
if (!woodwork || S.profile('Woodworking') !== woodwork) throw new Error('Woodwork profile/alias missing');
if (woodwork.layout !== 'unlock' || woodwork.workerRule !== 'No worker limit') throw new Error('Woodwork dossier type/worker rule mismatch');
if (!Array.isArray(woodwork.directCrafts) || !Array.isArray(woodwork.requiredUses)) throw new Error('Woodwork split tables are not defined');
for (const [level, entity, label] of [[1,'Club','Clubs ×4'],[4,'Plank','Planks ×2'],[5,'Table','Table']]) {
  if (!woodwork.directCrafts.some(row => row.level === level && row.entity === entity && row.label === label)) throw new Error(`Woodwork direct craft missing: ${label}`);
}
if (woodwork.directCrafts.some(row => (row.requirements || []).length)) throw new Error('Direct Woodwork craft table should not contain second-skill requirements');

const courthouse = woodwork.requiredUses.find(row => row.entity === 'Courthouse');
if (!courthouse || courthouse.level !== 3) throw new Error('Courthouse Woodwork 3 use missing');
if (!courthouse.requirements.some(row => row.skill === 'Engineering' && row.level === 7)) throw new Error('Courthouse Engineering 7 requirement missing');
if (!courthouse.requirements.some(row => row.skill === 'Stonework' && row.level === 4)) throw new Error('Courthouse Stonework 4 requirement missing');
if (!woodwork.requiredUses.some(row => row.entity === 'Apiary' && row.level === 4 && row.requirements.some(req => req.skill === 'Engineering' && req.level === 6))) throw new Error('Alternate Apiary Woodwork/Engineering requirements missing');
if (!woodwork.requiredUses.some(row => row.entity === 'Onager' && row.level === 6 && row.requirements.some(req => req.skill === 'Siege Equipment' && req.level === 8))) throw new Error('Onager Woodwork/Siege Equipment requirements missing');
if (!woodwork.requiredUses.some(row => row.entity === 'Barge' && row.level === 5 && row.requirements.some(req => req.skill === 'Shipbuilding' && req.level === 3) && row.requirements.some(req => req.skill === 'Metalwork' && req.level === 3))) throw new Error('Barge combined skill requirements missing');
if (!woodwork.requiredUses.some(row => row.entity === 'Warship' && row.level === 8 && row.requirements.some(req => req.skill === 'Shipbuilding' && req.level === 9) && row.requirements.some(req => req.skill === 'Metalwork' && req.level === 7))) throw new Error('Shipbuilding Woodwork uses should include the full vessel table');
if (woodwork.requiredUses.some(row => row.entity === 'Trumpet') || woodwork.levelUses.some(row => row.item === 'Trumpet')) throw new Error('Trumpet must not be listed as a Woodwork use; Mandate requires Metalwork 6 instead');
if (!woodwork.additionalSections.includes('20.4')) throw new Error('Woodwork sources should include Shipbuilding §20.4');

const economics = S.profile('Economics');
if (!economics || S.profile('Economy') !== economics) throw new Error('Economics/Economy profile alias missing');
if (economics.layout !== 'unlock') throw new Error('Economics should use level-unlock dossier layout');
if (!economics.levelUses.some(row => row.level === 'Any' && /Fair income scaling/i.test(row.use))) throw new Error('Economics ongoing Fair-income scaling use missing');
if (!economics.levelUses.some(row => row.level === 4 && /Trading Post/i.test(row.use))) throw new Error('Economics 4 Trading Post use missing');
if (!economics.levelUses.some(row => row.level === 5 && /Nomadic Fair/i.test(row.use))) throw new Error('Economics 5 nomadic Fair use missing');
if (!economics.levelUses.some(row => row.level === 10 && /Bank/i.test(row.use))) throw new Error('Economics 10 Bank use missing');
if (!economics.levelUses.some(row => row.level === 10 && /Banking skill/i.test(row.use))) throw new Error('Economics 10 Banking skill unlock missing');

const forestry = S.profile('Forestry');
if (!forestry) throw new Error('Forestry dossier missing');
if (forestry.layout !== 'forestry' || forestry.mechanic !== 'capacity-output') throw new Error('Forestry dossier behaviour mismatch');
if (!/10 workers per skill level/i.test(forestry.workerRule) || !/shared across Forestry work/i.test(forestry.workerDetail)) throw new Error('Forestry shared worker cap not described');
if (!forestry.outputs.some(row => row.item === 'Logs' && row.rate === '4 / worker')) throw new Error('Forestry base Logs output missing');
if (!forestry.outputs.some(row => row.item === 'Bark' && row.rate === '20 lb / worker')) throw new Error('Forestry base Bark output missing');
if (!forestry.outputs.some(row => row.item === 'Charcoal' && /10 Coal-equivalent/.test(row.rate))) throw new Error('Forestry Charcoal output missing');
for (const [name, effect] of [['Adze','×2 log output'],['Saw','×4 log output'],['Scraper (Metal)','×2 bark output'],['Burner Improvement','×2 effective workers'],['Sawmill','×8 normal log output']]) {
  const row = forestry.modifiers.find(item => item.name === name);
  if (!row || row.value !== effect) throw new Error(`Forestry modifier missing/incorrect: ${name}`);
}
if (!S.itemBenefitsFor('Saw').some(row => row.skill === 'Forestry')) throw new Error('Saw entity should link back to Forestry');

for (const name of ['Armour','Bonework','Boning','Curing','Dressing','Fletching']) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Category A dossier profile missing: ${name}`);
  if (profile.category !== 'A') throw new Error(`Category A marker missing: ${name}`);
  if (!['Woodwork','Forestry'].includes(profile.baseline)) throw new Error(`Approved baseline not recorded for ${name}`);
}
const armour = S.profile('Armour');
if (armour.layout !== 'category-a-craft' || armour.directCrafts.length !== 7) throw new Error('Armour should use the Woodwork-style craft dossier with seven direct recipes');
if (!armour.directCrafts.some(row => row.entity === 'Breastplate' && row.level === 8 && row.people === 4)) throw new Error('Armour Breastplate recipe missing');
if (!armour.ruleGroups?.[0]?.rows.some(row => row.label === 'Shielding' && row.values.includes('Scutum'))) throw new Error('Armour category rules missing');

const bonework = S.profile('Bonework');
const boneSpear = bonework.directCrafts.find(row => row.entity === 'Bone Spear');
if (!boneSpear || boneSpear.variants?.length !== 2) throw new Error('Bone Spear terrain/Shaft alternatives missing');
if (!bonework.directCrafts.some(row => row.entity === 'Bone Axe' && row.inputs.some(input => input.entity === 'Club'))) throw new Error('Bone Axe Club input missing');

const boning = S.profile('Boning');
if (boning.layout !== 'category-a-process' || !/10 workers per skill level/i.test(boning.workerRule)) throw new Error('Boning should use the Forestry-style capacity/output dossier');
if (!boning.processRows.some(row => row.outputs.some(output => output.entity === 'Bones' && /12 Bones/.test(output.label)))) throw new Error('Boning 12 Bones output missing');
if (!boning.combinedWith.includes('Skinning') || !boning.combinedWith.includes('Gutting')) throw new Error('Boning combined activities missing');

const curing = S.profile('Curing');
if (!curing.processRows.some(row => row.inputs.some(input => input.entity === 'Gut' && /5 Gut/.test(input.label)) && row.outputs.some(output => output.entity === 'Leather' && /2 Leather/.test(output.label)))) throw new Error('Curing conversion missing');
const dressing = S.profile('Dressing');
if (!dressing.processRows.some(row => row.inputs.some(input => input.entity === 'Salt' && /1 Salt/.test(input.label)) && row.outputs.some(output => output.entity === 'Leather' && /4 Leather/.test(output.label)))) throw new Error('Dressing conversion missing');
const fletching = S.profile('Fletching');
if (fletching.processRows.length !== 3 || !fletching.processRows.some(row => row.activity === 'Steel Arrows' && row.outputs.some(output => output.entity === 'Arrow Steel'))) throw new Error('Fletching metal arrow recipes missing');
if (!fletching.notes.some(note => /10 arrows/i.test(note))) throw new Error('Fletching combat ammunition rule missing');

const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.js'), 'utf8');
const woodUi = fs.readFileSync(path.join(root, 'compendium-skill-overhaul-woodwork.js'), 'utf8');
const categoryAUi = fs.readFileSync(path.join(root, 'compendium-skill-overhaul-category-a.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
for (const marker of ['AM = Active Month.','data-equipment-sort','Base max benefit','renderUnlockSkill','What each level unlocks','Research recipes / prerequisites using','renderForestry','Forestry worker limit','Tools, facilities & direct output modifiers']) {
  if (!ui.includes(marker)) throw new Error(`Expanded skill dossier UI missing marker: ${marker}`);
}
for (const marker of ['Things you can make with Woodwork alone','Where Woodwork is required','Other skills required','skill-woodwork-direct-table','skill-woodwork-required-table','Courthouse','data-entity']) {
  if (!woodUi.includes(marker)) throw new Error(`Woodwork split UI missing marker: ${marker}`);
}
for (const marker of ['Things you can make with','What each worker does','Capacity vs output','Other research affecting','category-a-craft-table','category-a-process-table','Direct recipes']) {
  if (!categoryAUi.includes(marker)) throw new Error(`Category A baseline renderer missing marker: ${marker}`);
}
for (const script of ['skill-overhaul-profile-registry.js','skill-overhaul-category-a-1.js','compendium-skill-overhaul-category-a.js']) {
  if (!html.includes(script)) throw new Error(`Compendium is not loading ${script}`);
}
if (html.indexOf('skill-overhaul-profile-registry.js') < html.indexOf('skill-overhaul-data.js')) throw new Error('Profile registry must load after the base skill data');
if (html.indexOf('skill-overhaul-category-a-1.js') < html.indexOf('skill-overhaul-profile-registry.js')) throw new Error('Category A data must load after the profile registry');
if (html.indexOf('compendium-skill-overhaul-category-a.js') < html.indexOf('compendium-skill-overhaul.js')) throw new Error('Category A renderer must load after the base dossier renderer');
if (!html.includes('skill-overhaul-woodwork-refinement.js') || !html.includes('compendium-skill-overhaul-woodwork.js')) throw new Error('Woodwork refinement scripts are not loaded by the Compendium');
if (html.indexOf('skill-overhaul-woodwork-refinement.js') < html.indexOf('skill-overhaul-data.js')) throw new Error('Woodwork data refinement must load after the base skill data');
if (html.indexOf('compendium-skill-overhaul-woodwork.js') < html.indexOf('compendium-skill-overhaul.js')) throw new Error('Woodwork UI refinement must load after the base dossier renderer');
for (const marker of ['.skill-dossier-mode','.skill-glance-grid','.skill-implement-table','.skill-item-benefit','.skill-benefit-keyword','.skill-callout','.skill-equipment-subhead','.skill-craft-list','.skill-research-required','.skill-am-note','.skill-sort-button','.skill-capacity-banner','.skill-level-use-table','.skill-research-use-table']) {
  if (!css.includes(marker)) throw new Error(`Expanded skill dossier CSS missing marker: ${marker}`);
}
new Function(ui);
new Function(woodUi);
new Function(categoryAUi);
console.log('Skill overhaul checks passed: approved baselines plus first Group A dossiers are wired');
require('./skill-overhaul-category-a2.test.js');

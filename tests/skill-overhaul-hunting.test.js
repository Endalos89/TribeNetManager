const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const context = { window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console };
context.globalThis = context.window;
vm.createContext(context);

const run = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename:name });
run('skill-overhaul-data.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const hunting = S.profile('Hunting');
if (!hunting) throw new Error('Hunting dossier missing');
if (hunting.mechanic !== 'efficiency') throw new Error(`Unexpected Hunting mechanic: ${hunting.mechanic}`);
if (hunting.workerRule !== 'No worker limit') throw new Error('Hunting worker rule missing');
if (hunting.primarySection !== '13.1.15') throw new Error('Hunting primary Mandate source mismatch');
if (!hunting.additionalSections.includes('23.5')) throw new Error('Hunting high-level research rule reference missing');
if (!hunting.outputs.some(row => row.item === 'Provs' && row.label === 'Provisions')) throw new Error('Hunting output table is missing linked Provisions output');
for (const factor of ['Terrain','River / Lake / Ocean border','Season','Weather']) {
  if (!hunting.factors.some(row => row.factor === factor)) throw new Error(`Hunting factor missing: ${factor}`);
}
if (hunting.orderRules) throw new Error('Conditional stop amounts should not be surfaced as a Hunting skill rule');
if (/Different Hunters/i.test(hunting.implementRule)) throw new Error('Group-level different-Hunter explanation should not remain in implement rule');
if (!hunting.supportImplements?.some(row => row.name === 'Hunting Dog')) throw new Error('Hunting Dog must be in the separate stacking-support table');
if (hunting.implements.some(row => row.name === 'Hunting Dog')) throw new Error('Hunting Dog must not be in the primary implement table');

const expected = {
  Trap:'+0.10 AM',
  Snare:'+0.05 AM',
  Bow:'+0.15 AM',
  Sling:'+0.10 AM',
  Arbalest:'+0.20 AM',
  Spear:'+0.05 AM',
  'Bone Spear':'+0.05 AM',
  'Stone Spear':'+0.05 AM',
  Spetum:'+0.05 AM',
  Net:'+0.10 AM',
  'Improved Trap':'+0.15 AM',
  'Advanced Trap':'+1.00 AM',
  'Hunting Dog':'+2 AM'
};
for (const [name, value] of Object.entries(expected)) {
  const benefit = S.itemBenefit(name);
  if (!benefit) throw new Error(`Missing Hunting item benefit for ${name}`);
  if (benefit.value !== value) throw new Error(`Unexpected ${name} benefit: ${benefit.value}`);
  if (benefit.skill !== 'Hunting') throw new Error(`${name} does not link back to Hunting`);
  if (!benefit.keywords.includes('Hunting')) throw new Error(`${name} benefit is missing Hunting keyword`);
  if (S.itemBenefitsFor(name).length !== 1) throw new Error(`${name} should currently have exactly one indexed skill-benefit line`);
}
if (S.itemBenefit('Trap').baseMax !== '5') throw new Error('Base Trap allowance should be five per Hunter');
if (S.itemBenefit('Bow').baseMax !== '1') throw new Error('Base Bow allowance should be one per Hunter');
if (S.itemBenefit('Improved Trap').baseMaxBenefit !== '+0.75 AM') throw new Error('Improved Trap maximum base AM is incorrect');
if (S.itemBenefit('Advanced Trap').baseMax !== '1') throw new Error('Advanced Trap base allowance should be one per Hunter');
if (S.itemBenefit('Hunting Dog').baseMaxBenefit !== '+2 AM') throw new Error('Hunting Dog should contribute +2 AM');

const craftExpectation = {
  Trap:['Metalwork',2,false],
  'Bone Spear':['Bonework',3,false],
  'Stone Spear':['Stonework',4,false],
  Arbalest:['Weapons',8,false],
  'Improved Trap':['Metalwork',3,true],
  'Advanced Trap':['Metalwork',10,true],
  'Hunting Dog':['Herding',10,true]
};
for (const [name, [skill, level, research]] of Object.entries(craftExpectation)) {
  const item = S.itemBenefit(name);
  if (!item.craft?.some(row => row.skill === skill && row.level === level)) throw new Error(`${name} craft source should include ${skill} ${level}`);
  if (item.requiresResearch !== research) throw new Error(`${name} research-required flag is incorrect`);
}
if (S.itemBenefit('Sling').craft.length < 3) throw new Error('Sling should retain its multiple crafting-skill routes');
if (!S.itemBenefit('Net').craft.some(row => row.skill === 'Weaving' && row.level === 3)) throw new Error('Net should show Weaving 3 as a crafting source');
if (hunting.researchEffectOverrides['Expert Trackers'] !== '+5% Hunting returns.') throw new Error('Expert Trackers compact Hunting summary override missing');
if (hunting.researchEffectOverrides['Veteran Trackers'] !== '+5% Hunting returns.') throw new Error('Veteran Trackers compact Hunting summary override missing');

const researchContext = { window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console };
researchContext.globalThis = researchContext.window;
vm.createContext(researchContext);
const runResearch = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), researchContext, { filename:name });
runResearch('research-v2-schema.js');
runResearch('research-v2-batch-04.js');
runResearch('research-v2-batch-05.js');
runResearch('research-v2-batch-07.js');
const R = researchContext.window.TribeNetResearchV2;
const own = R.topicsForSkill('Hunting');
for (const topic of ['Advanced Trap','Hunting 11','Hunting Dogs','Improved Trap','Mongol Hunt','Mongol Hunt 2','Trappers']) {
  if (!own.some(row => row.name === topic)) throw new Error(`Hunting research topic missing from detailed data: ${topic}`);
}
if (!R.affectingSkill('Hunting').some(row => row.skill === 'Herding' && row.name === 'Hunting Dogs')) throw new Error('Cross-skill Hunting Dogs research link missing');
if (!R.affectingSkill('Hunting').some(row => row.skill === 'Metalwork' && row.name === 'Advanced Trap')) throw new Error('Cross-skill Advanced Trap research link missing');
const expertTrackers = R.affectingSkill('Hunting').find(row => row.name === 'Expert Trackers');
if (!expertTrackers) throw new Error('Expert Trackers should be indexed as affecting Hunting');
if (!expertTrackers.effects.some(effect => /\+5% Hunting return/i.test(effect))) throw new Error('Expert Trackers Hunting-specific effect is missing');
const veteranTrackers = R.affectingSkill('Hunting').find(row => row.name === 'Veteran Trackers');
if (!veteranTrackers?.effects.some(effect => /\+5% Hunting return/i.test(effect))) throw new Error('Veteran Trackers Hunting-specific effect is missing');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.css'), 'utf8');
for (const asset of ['skill-overhaul-data.js','compendium-skill-overhaul.js','compendium-skill-overhaul.css']) {
  if (!html.includes(asset)) throw new Error(`Compendium missing ${asset}`);
}
if (html.indexOf('compendium-skill-overhaul.js') < html.indexOf('compendium-mandate.js')) throw new Error('Skill overhaul UI must load after Mandate integration');
for (const marker of ['skill-glance-grid','Hunting output','Other factors affecting Hunting','Primary implement — choose one type','Additional support — may be used alongside a primary implement','Made / converted with','Base max / Hunter','Hunting research','Shared / cross-skill research','skill-item-benefit','skill-benefit-keyword','researchEffectForSkill','researchEffectOverrides','removeGenericMandatePanels','data-mandate-open','data-research-v2']) {
  if (!ui.includes(marker)) throw new Error(`Hunting UI missing marker: ${marker}`);
}
for (const obsolete of ['What your Hunting level changes','No Hunting-return benefit:','Sources & other Mandate mentions','Conditional stop amounts','Different Hunters in the same group','<th>Category</th>']) {
  if (ui.includes(obsolete)) throw new Error(`Obsolete Hunting UI remains: ${obsolete}`);
}
for (const marker of ['.skill-dossier-mode','.skill-glance-grid','.skill-implement-table','.skill-item-benefit','.skill-benefit-keyword','.skill-callout','.skill-equipment-subhead','.skill-craft-list','.skill-research-required']) {
  if (!css.includes(marker)) throw new Error(`Hunting CSS missing marker: ${marker}`);
}
new Function(ui);
console.log('Hunting skill overhaul checks passed: grouped equipment, crafting sources, concise research effects and separated environmental factors are wired');

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

const expected = {
  Trap:'+0.10 effective AM each',
  Snare:'+0.05 effective AM each',
  Bow:'+0.15 effective AM',
  Sling:'+0.10 effective AM',
  Arbalest:'+0.20 effective AM',
  Spear:'+0.05 effective AM',
  'Bone Spear':'+0.05 effective AM',
  'Stone Spear':'+0.05 effective AM',
  Spetum:'+0.05 effective AM',
  Net:'+0.10 effective AM',
  'Improved Trap':'+0.15 effective AM each',
  'Advanced Trap':'+1.00 effective Hunting',
  'Hunting Dog':'+2 Hunter-equivalents'
};
for (const [name, value] of Object.entries(expected)) {
  const benefit = S.itemBenefit(name);
  if (!benefit) throw new Error(`Missing Hunting item benefit for ${name}`);
  if (benefit.value !== value) throw new Error(`Unexpected ${name} benefit: ${benefit.value}`);
  if (benefit.skill !== 'Hunting') throw new Error(`${name} does not link back to Hunting`);
}
if (!hunting.noBenefit.some(row => row.name === 'Horse')) throw new Error('Explicit no-benefit Hunting items missing');

const researchContext = { window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console };
researchContext.globalThis = researchContext.window;
vm.createContext(researchContext);
const runResearch = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), researchContext, { filename:name });
runResearch('research-v2-schema.js');
runResearch('research-v2-batch-04.js');
runResearch('research-v2-batch-05.js');
const R = researchContext.window.TribeNetResearchV2;
const own = R.topicsForSkill('Hunting');
for (const topic of ['Advanced Trap','Hunting 11','Hunting Dogs','Improved Trap','Mongol Hunt','Mongol Hunt 2','Trappers']) {
  if (!own.some(row => row.name === topic)) throw new Error(`Hunting research topic missing from detailed data: ${topic}`);
}
if (!R.affectingSkill('Hunting').some(row => row.skill === 'Herding' && row.name === 'Hunting Dogs')) throw new Error('Cross-skill Hunting Dogs research link missing');
if (!R.affectingSkill('Hunting').some(row => row.skill === 'Metalwork' && row.name === 'Advanced Trap')) throw new Error('Cross-skill Advanced Trap research link missing');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.css'), 'utf8');
for (const asset of ['skill-overhaul-data.js','compendium-skill-overhaul.js','compendium-skill-overhaul.css']) {
  if (!html.includes(asset)) throw new Error(`Compendium missing ${asset}`);
}
if (html.indexOf('compendium-skill-overhaul.js') < html.indexOf('compendium-mandate.js')) throw new Error('Skill overhaul UI must load after Mandate integration');
for (const marker of ['skill-glance-grid','Implements & direct Hunting benefit','Hunting research','Shared / cross-skill research','skill-item-benefit','data-mandate-open','data-research-v2']) {
  if (!ui.includes(marker)) throw new Error(`Hunting UI missing marker: ${marker}`);
}
for (const marker of ['.skill-dossier-mode','.skill-glance-grid','.skill-implement-table','.skill-item-benefit']) {
  if (!css.includes(marker)) throw new Error(`Hunting CSS missing marker: ${marker}`);
}
new Function(ui);
console.log('Hunting skill overhaul checks passed: compact dossier, research links and item benefits are wired');

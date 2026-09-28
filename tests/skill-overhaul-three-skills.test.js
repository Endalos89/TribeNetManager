const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const context = { window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console };
context.globalThis = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'skill-overhaul-data.js'), 'utf8'), context, { filename:'skill-overhaul-data.js' });
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
for (const [level, text] of [[1,'Clubs ×4'],[3,'Courthouse'],[4,'Wood in stone buildings'],[5,'Barge construction'],[6,'Onager'],[8,'Lute']]) {
  if (!woodwork.levelUses.some(row => row.level === level && row.use === text)) throw new Error(`Woodwork level ${level} use missing: ${text}`);
}
if (!woodwork.levelUses.some(row => row.level === 4 && row.use === 'Alternate Apiary construction')) throw new Error('Woodwork 4 alternate Apiary use missing');
if (!woodwork.levelUses.some(row => row.level === 3 && row.use === 'Drum')) throw new Error('Woodwork/Music cross-use missing');

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

const ui = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'compendium-skill-overhaul.css'), 'utf8');
for (const marker of ['AM = Active Month.','data-equipment-sort','Base max benefit','renderUnlockSkill','What each level unlocks','Research recipes / prerequisites using','renderForestry','Forestry worker limit','Tools, facilities & direct output modifiers']) {
  if (!ui.includes(marker)) throw new Error(`Expanded skill dossier UI missing marker: ${marker}`);
}
for (const marker of ['.skill-am-note','.skill-sort-button','.skill-capacity-banner','.skill-level-use-table','.skill-research-use-table']) {
  if (!css.includes(marker)) throw new Error(`Expanded skill dossier CSS missing marker: ${marker}`);
}
new Function(ui);
console.log('Skill overhaul checks passed: AM definition, benefit sorting, Woodwork, Economics and Forestry dossiers are wired');

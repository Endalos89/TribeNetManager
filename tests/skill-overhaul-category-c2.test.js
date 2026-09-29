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
run('skill-overhaul-category-c-2.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const c2 = ['Brick Making','Cooking','Dance','Distilling','Engineering','Farming','Glasswork'];
for (const name of c2) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`C2 Group C profile missing: ${name}`);
  if (profile.category !== 'C') throw new Error(`${name} should be a Group C dossier`);
  if (!['Forestry','Woodwork','Hunting','Economics'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const brick = S.profile('Brick Making');
if (S.profile('Brickmaking') !== brick) throw new Error('Brickmaking alias should resolve to Brick Making');
if (brick.primarySection !== '14.5.1' || brick.mechanic !== 'capacity' || brick.baseline !== 'Forestry') throw new Error('Brick Making capacity dossier mismatch');
if (!/10 Brick Making workers per skill level; unlimited at level 10/.test(brick.workerRule)) throw new Error('Brick Making worker cap missing');
if (!brick.outputs.some(x => x.label === 'Standard Bricks' && /120 Bricks.*30 Stone/.test(x.detail) && /20 Clay/.test(x.detail) && /10 Fodder/.test(x.detail) && /4 Coal/.test(x.detail))) throw new Error('Brick Making standard output missing');
if (!brick.outputs.some(x => x.label === 'House Bricks' && /160 House Bricks/.test(x.detail))) throw new Error('House Brick output missing');
if (!brick.factors.some(x => x.factor === 'Kiln capacity' && /10 workers per Kiln/.test(x.effect))) throw new Error('Brick Making Kiln capacity missing');
if (!/180 Bricks/.test(brick.researchEffectOverrides['Improved Brickmaking'])) throw new Error('Improved Brickmaking output missing');
if (!/240 Bricks/.test(brick.researchEffectOverrides['Advanced Brickmaking'])) throw new Error('Advanced Brickmaking output missing');
if (!/300 Bricks/.test(brick.researchEffectOverrides['Greater Brickmaking'])) throw new Error('Greater Brickmaking output missing');
if (!S.itemBenefitsFor('Brickworks').some(x => x.skill === 'Brick Making')) throw new Error('Brickworks backlink missing');

const cooking = S.profile('Cooking');
if (cooking.primarySection !== '13.1.4' || cooking.baseline !== 'Forestry') throw new Error('Cooking mixed production dossier mismatch');
if (!/10 Cooking workers per skill level; unlimited at level 10/.test(cooking.workerRule)) throw new Error('Cooking worker cap missing');
if (!cooking.outputs.some(x => /4 Gruel/.test(x.detail) && /6 when using Grain/.test(x.detail))) throw new Error('Cooking base Gruel output missing');
if (!cooking.factors.some(x => x.factor === 'At sea' && x.effect === 'Allowed')) throw new Error('Cooking at sea rule missing');
if (!/Participants × \(2 \+ Cooking\/4 \+ Economics\/4\)/.test(cooking.levelDetail)) throw new Error('Cooking Fair formula missing');
if (!/40 Stew\/Provisions/.test(cooking.researchEffectOverrides.Stew)) throw new Error('Cooking Stew effect missing');
if (!/\+0.02 General Morale/.test(cooking.researchEffectOverrides.Banquet)) throw new Error('Cooking Banquet morale effect missing');

const dance = S.profile('Dance');
if (dance.primarySection !== '15.1' || dance.mechanic !== 'scaling' || dance.baseline !== 'Economics') throw new Error('Dance Fair scaling dossier mismatch');
if (!/Participants × \(2 \+ Dance\/4 \+ Economics\/4\)/.test(dance.levelDetail)) throw new Error('Dance Fair formula missing');
if (!/Maximum 500 participants/.test(dance.workerRule)) throw new Error('Dance Fair participant cap missing');
if (!dance.factors.some(x => x.factor === 'Trade limit' && /1 Fair slot/.test(x.effect))) throw new Error('Dance Fair slot rule missing');
if (!/\+0.02 General Morale/.test(dance.researchEffectOverrides['Spring Arts Festival Dance']) || !/20 Gold/.test(dance.researchEffectOverrides['Spring Arts Festival Dance'])) throw new Error('Spring Arts Festival Dance effect missing');

const distilling = S.profile('Distilling');
if (distilling.primarySection !== '14.7.1' || distilling.mechanic !== 'unlock-capacity' || distilling.baseline !== 'Woodwork') throw new Error('Distilling unlock/capacity dossier mismatch');
if (!/10 Distilling workers per installed Still/.test(distilling.workerRule) || !/5 workers produce 100 lb/.test(distilling.workerRule)) throw new Error('Distilling Still capacity/output missing');
for (const [level,item] of [[2,'Ale'],[4,'Mead'],[5,'Ale'],[6,'Wine'],[8,'Rum'],[9,'Brandy']]) {
  if (!distilling.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Distilling level ${level} ${item} unlock missing`);
}
if (!distilling.factors.some(x => x.factor === 'Barrels' && /1 empty Barrel per 100 lb/.test(x.effect))) throw new Error('Distilling Barrel requirement missing');
if (!distilling.factors.some(x => x.factor === 'Arid / desert water' && /100 lb Water per 100 lb beverage/.test(x.effect))) throw new Error('Distilling water requirement missing');
if (!/1.5× normal price/.test(distilling.researchEffectOverrides['Branded Alcohol (Ale, Wine etc)'])) throw new Error('Branded Alcohol price effect missing');
if (!/Distilling 7/.test(distilling.researchEffectOverrides['Port Wine'])) throw new Error('Port Wine skill requirement missing');
if (!/2× normal Fair alcohol limits/.test(distilling.researchEffectOverrides.Tavern)) throw new Error('Tavern Fair multiplier missing');
if (!S.itemBenefitsFor('Still').some(x => x.skill === 'Distilling' && /10 workers/.test(x.value))) throw new Error('Still Distilling backlink missing');

const engineering = S.profile('Engineering');
if (engineering.primarySection !== '14.8' || engineering.mechanic !== 'unlock' || engineering.baseline !== 'Woodwork') throw new Error('Engineering unlock dossier mismatch');
if (engineering.workerRule !== 'No general Engineering worker limit') throw new Error('Engineering unlimited-worker rule missing');
for (const [level,item] of [[2,'Meeting House'],[3,'Bakery'],[4,'Distillery'],[5,'Brickworks'],[6,'Apiary'],[8,'Stone Tower']]) {
  if (!engineering.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Engineering level ${level} ${item} unlock missing`);
}
if (!engineering.factors.some(x => x.factor === 'Container buildings' && /Two activity orders/.test(x.effect))) throw new Error('Engineering container-building rule missing');
if (!/\+4 effective Archery/.test(engineering.researchEffectOverrides.Barbican)) throw new Error('Barbican Archery effect missing');
if (!/\+2 effective Archery/.test(engineering.researchEffectOverrides.Drawbridge)) throw new Error('Drawbridge Archery effect missing');
if (!/200 Slaves/.test(engineering.researchEffectOverrides.Dungeon) || !/1 Overseer/.test(engineering.researchEffectOverrides.Dungeon)) throw new Error('Dungeon capacity effect missing');
if (!/2%/.test(engineering.researchEffectOverrides.Watchtower) || !/maximum 6 Watchtowers/.test(engineering.researchEffectOverrides.Watchtower)) throw new Error('Watchtower Engineering effect missing');
if (!S.itemBenefitsFor('Meeting House').some(x => x.skill === 'Engineering')) throw new Error('Meeting House Engineering backlink missing');

const farming = S.profile('Farming');
if (farming.primarySection !== '14.9' || farming.mechanic !== 'efficiency' || farming.baseline !== 'Hunting') throw new Error('Farming seasonal-output dossier mismatch');
if (!/No published 10×Farming-level worker cap/.test(farming.workerRule)) throw new Error('Farming source-specific worker treatment missing');
if (!farming.factors.some(x => x.factor === 'Crop cycle' && /\+3 turns/.test(x.effect))) throw new Error('Farming three-turn crop cycle missing');
if (!farming.factors.some(x => x.factor === 'Plowing tools' && /Rake 1/.test(x.effect) && /Hoe 2/.test(x.effect) && /Plow 8/.test(x.effect))) throw new Error('Farming plowing tool rates missing');
if (!farming.factors.some(x => x.factor === 'Skill-output formula' && /Not published/.test(x.effect))) throw new Error('Farming source-gap disclosure missing');
const cropTable = farming.factTables.find(x => /planting and harvesting acres/.test(x.title));
if (!cropTable?.rows.some(x => x.crop === 'Grain' && x.plant === '5' && x.harvest === '3' && /6 with Scythe/.test(x.tool))) throw new Error('Farming Grain rates missing');
if (!cropTable?.rows.some(x => x.crop === 'Sugar' && x.plant === '3' && x.harvest === '2' && /4 with Scythe/.test(x.tool))) throw new Error('Farming Sugar rates missing');
if (!/Group C Agriculture skill/.test(farming.researchEffectOverrides['Agriculture I, Agriculture II, Agriculture III'])) throw new Error('Agriculture skill unlock missing');
if (!/plants 3 acres and harvests 2/.test(farming.researchEffectOverrides.Flax)) throw new Error('Flax crop rates missing');
if (!S.itemBenefitsFor('Plow').some(x => x.skill === 'Farming' && /8 acres/.test(x.value))) throw new Error('Plow Farming backlink missing');

const glasswork = S.profile('Glasswork');
if (glasswork.primarySection !== '13.1.11' || glasswork.mechanic !== 'unlock' || glasswork.baseline !== 'Woodwork') throw new Error('Glasswork unlock dossier mismatch');
if (glasswork.workerRule !== 'No Glasswork worker limit') throw new Error('Glasswork unlimited-worker rule missing');
for (const [level,item] of [[1,'Beads'],[4,'Beaker'],[4,'Glass Pane'],[6,'Bottle'],[7,'Bottle Perfume'],[8,'Lens']]) {
  if (!glasswork.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Glasswork level ${level} ${item} recipe missing`);
}
if (!glasswork.factors.some(x => x.factor === 'Sand source' && /20 Sand per gatherer/.test(x.effect))) throw new Error('Glasswork Sand gathering rate missing');
if (!glasswork.factors.some(x => x.factor === 'Shovel' && /×2 Sand gathering/.test(x.effect))) throw new Error('Glasswork Shovel modifier missing');
if (!/\+2 Leadership/.test(glasswork.researchEffectOverrides['Field Glasses']) || !/not Siege\/Assault/.test(glasswork.researchEffectOverrides['Field Glasses'])) throw new Error('Field Glasses effect missing');
if (!/\+2 Captaincy/.test(glasswork.researchEffectOverrides['Spy Glass'])) throw new Error('Spy Glass effect missing');
if (!S.itemBenefitsFor('Glasspipe').some(x => x.skill === 'Glasswork')) throw new Error('Glasspipe Glasswork backlink missing');
if (!S.itemBenefitsFor('Field Glasses').some(x => x.skill === 'Leadership')) throw new Error('Field Glasses Leadership backlink missing');
if (!S.itemBenefitsFor('Spy Glass').some(x => x.skill === 'Captaincy')) throw new Error('Spy Glass Captaincy backlink missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-c-2.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-c-2.js')) throw new Error('C2 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-c-2.js') < html.indexOf('skill-overhaul-category-c-1.js')) throw new Error('C2 data must load after C1');
if (html.indexOf('skill-overhaul-category-c-2.js') > html.indexOf('compendium.js')) throw new Error('C2 data must load before the Compendium renderer');

console.log('Group C batch C2 checks passed: Brick Making, Cooking, Dance, Distilling, Engineering, Farming and Glasswork');

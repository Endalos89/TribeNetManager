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
run('skill-overhaul-category-a-2.js');
run('skill-overhaul-category-a-3.js');
run('skill-overhaul-category-a-4.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

for (const name of ['Milking','Siege Equipment','Skinning','Tanning','Waxwork','Weapons','Weaving','Whaling']) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`A4 profile missing: ${name}`);
  if (profile.category !== 'A') throw new Error(`${name} should be a Group A dossier`);
  if (!['Hunting','Forestry','Woodwork'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline`);
}

const milking = S.profile('Milking');
if (milking.layout !== 'category-a-process' || !/10 workers per skill level/i.test(milking.workerRule)) throw new Error('Milking worker-cap dossier mismatch');
const milk = milking.processRows.find(row => row.activity === 'Milk Cattle');
if (!milk || !milk.inputs.some(row => /10 Cattle/.test(row.label)) || !milk.outputs.some(row => /100 Milk/.test(row.label))) throw new Error('Milking base production rule missing');
if (!/1,300 Milk/.test(milking.researchEffectOverrides['Milk Maids'])) throw new Error('Milk Maids 1,300 Milk rule missing');
if (!/10%/.test(milking.researchEffectOverrides['Milking 11'])) throw new Error('Milking 11 +10% rule missing');

const siege = S.profile('Siege Equipment');
if (S.profile('Siege Equipment Making') !== siege) throw new Error('Siege Equipment alias missing');
if (siege.layout !== 'category-a-craft' || siege.directCrafts.length !== 4) throw new Error('Siege Equipment should contain the four base Mandate engines');
if (!siege.directCrafts.some(row => row.entity === 'Ballista' && row.people === 10 && /300 lb/.test(row.detail))) throw new Error('Ballista recipe/detail missing');
if (!siege.requiredUses.some(row => row.entity === 'Onager' && row.requirements.some(req => req.skill === 'Woodwork' && req.level === 6))) throw new Error('Onager Woodwork 6 prerequisite missing');
if (!/5 Stones/.test(siege.researchEffectOverrides['Trebuchet'])) throw new Error('Trebuchet ammunition/consumption rule missing');

const skinning = S.profile('Skinning');
if (skinning.layout !== 'category-a-process' || !/10 workers per skill level/i.test(skinning.workerRule)) throw new Error('Skinning worker-cap dossier mismatch');
for (const [activity,output] of [['Skin Goats','3 Skins'],['Skin Cattle','2 Skins'],['Skin Horses','3 Skins']]) {
  const row = skinning.processRows.find(x => x.activity === activity);
  if (!row || !row.outputs.some(x => x.label === output)) throw new Error(`Skinning row missing: ${activity}`);
}
if (!skinning.combinedWith.includes('Gutting') || !skinning.combinedWith.includes('Boning')) throw new Error('Skinning combined activity links missing');
if (!/doubles Skinning/i.test(skinning.researchEffectOverrides['Knife'])) throw new Error('Knife Skinning research summary missing');

const tanning = S.profile('Tanning');
if (tanning.layout !== 'category-a-process' || !/10 workers per skill level/i.test(tanning.workerRule)) throw new Error('Tanning worker-cap dossier mismatch');
const tan = tanning.processRows.find(row => row.activity === 'Tan hides');
if (!tan || !tan.inputs.some(row => /4 Skins or Furs/.test(row.label)) || !tan.inputs.some(row => /10 Bark/.test(row.label)) || !tan.outputs.some(row => /4 Leather/.test(row.label))) throw new Error('Tanning base conversion missing');
if (!/Doubles Tanning output/.test(tanning.researchEffectOverrides['Cascade Tanning Pits'])) throw new Error('Cascade Tanning Pits summary missing');

const wax = S.profile('Waxwork');
if (S.profile('Waxworks') !== wax) throw new Error('Waxwork/Waxworks alias missing');
if (wax.layout !== 'category-a-craft' || wax.directCrafts.length !== 5) throw new Error('Waxwork should contain five base recipes');
if (!wax.directCrafts.some(row => row.entity === 'Candle' && row.people === 4 && row.inputs.some(i => i.entity === 'Wax' && i.quantity === 20))) throw new Error('Candle recipe missing');
if (!wax.directCrafts.some(row => row.entity === 'Cuirboilli' && /Cauldron/.test(row.detail))) throw new Error('Cuirboilli reusable-Cauldron requirement missing');

const weapons = S.profile('Weapons');
if (S.profile('Weapon Making') !== weapons) throw new Error('Weapons/Weapon Making alias missing');
if (weapons.layout !== 'category-a-craft' || weapons.directCrafts.length !== 11) throw new Error('Weapons base recipe count mismatch');
const bow = weapons.directCrafts.find(row => row.entity === 'Bow');
if (!bow || bow.variants.length !== 2 || !bow.variants.some(row => row.inputs.some(i => i.entity === 'Stave'))) throw new Error('Bow terrain/Stave alternatives missing');
const spear = weapons.directCrafts.find(row => row.entity === 'Spear');
if (!spear || spear.variants.length !== 2) throw new Error('Spear terrain/component alternatives missing');
const arbalest = weapons.directCrafts.find(row => row.entity === 'Arbalest');
if (!arbalest || arbalest.variants.length !== 2 || !arbalest.variants.some(row => /Brass/.test(row.detail || ''))) throw new Error('Arbalest Iron/Bronze/Brass alternatives missing');
if (!/one-third more casualties/.test(weapons.researchEffectOverrides['Repeating Arbalest'])) throw new Error('Repeating Arbalest combat improvement missing');

const weaving = S.profile('Weaving');
if (weaving.layout !== 'category-a-craft' || weaving.directCrafts.length !== 10) throw new Error('Weaving base recipe count mismatch');
if (weaving.directCrafts.filter(row => row.entity === 'Net').length !== 2) throw new Error('Both base Net recipes should be represented');
if (!weaving.directCrafts.some(row => row.entity === 'Snare' && row.inputs.some(i => i.entity === 'Rope' && i.quantity === 1))) throw new Error('Weaving Snare recipe missing');
if (!/Doubles crop-harvesting worker effectiveness/.test(weaving.researchEffectOverrides['Basket'])) throw new Error('Basket farming effect missing');
if (!/\+0.06 Military Morale/.test(weaving.researchEffectOverrides['Epic Tapestry'])) throw new Error('Epic Tapestry military morale effect missing');

const whaling = S.profile('Whaling');
if (whaling.layout !== 'category-a-activity' || whaling.primarySection !== '29.39') throw new Error('Whaling Mandate dossier mismatch');
if (!/chance of catching whales/.test(whaling.levelDetail)) throw new Error('Whaling skill effect missing');
if (!whaling.supportImplements.some(row => row.name === 'Whaler' && /at-sea processing/.test(row.value))) throw new Error('Whaler support vessel missing');
if (!/two whales/.test(whaling.researchEffectOverrides['Whaler'])) throw new Error('Whaler two-whale processing rule missing');

const expectedGroupA = [
  'Armour','Bonework','Boning','Curing','Dressing','Excavation','Fishing','Fletching','Forestry','Furrier',
  'Gutting','Herding','Hunting','Jewellery','Leatherwork','Metalwork','Milking','Mining','Pottery','Quarrying',
  'Salting','Sewing','Siege Equipment','Skinning','Tanning','Waxwork','Weapons','Weaving','Whaling','Woodwork'
];
for (const name of expectedGroupA) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Final Group A completeness audit: dossier missing for ${name}`);
}
if (expectedGroupA.length !== 30) throw new Error('Group A audit list should contain 30 skills');

for (const [item,skill] of [['Knife','Skinning'],['Cauldron','Waxwork'],['Net','Weaving'],['Snare','Weaving'],['Basket','Farming'],['Whaler','Whaling']]) {
  if (!S.itemBenefitsFor(item).some(row => row.skill === skill)) throw new Error(`${item} item-benefit backlink missing for ${skill}`);
}

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-a-4.js')) throw new Error('A4 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-a-4.js') < html.indexOf('skill-overhaul-profile-registry.js')) throw new Error('A4 data must load after the profile registry');
if (html.indexOf('skill-overhaul-category-a-4.js') > html.indexOf('compendium.js')) throw new Error('A4 data must load before the Compendium renderer');

console.log('Group A batch A4 checks passed: remaining 8 skills converted and all 30 Group A dossiers accounted for');

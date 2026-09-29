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
run('skill-overhaul-category-c-4.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const c4 = ['Seeking','Shipbuilding','Stonework','Apiology','Agriculture','Cheesemaking','Geology'];
for (const name of c4) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`C4 Group C profile missing: ${name}`);
  if (profile.category !== 'C') throw new Error(`${name} should be a Group C dossier`);
  if (!['Forestry','Woodwork','Hunting','Economics'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const seeking = S.profile('Seeking');
if (S.profile('Seek') !== seeking) throw new Error('Seeking alias missing');
if (seeking.primarySection !== '13.1.26' || seeking.baseline !== 'Hunting' || seeking.mechanic !== 'efficiency') throw new Error('Seeking efficiency dossier mismatch');
if (!seeking.factors.some(x => x.factor === 'Season' && /Spring month 01/.test(x.effect))) throw new Error('Seeking season missing');
if (!seeking.factors.some(x => x.factor === 'Clan limit' && /1 Seeking Tribe/.test(x.effect))) throw new Error('Seeking one-Tribe Clan limit missing');
if (!seeking.factors.some(x => x.factor === 'Skills' && /Seeking \+ Scouting/.test(x.effect))) throw new Error('Seeking/Scouting interaction missing');
if (!seeking.factors.some(x => x.factor === 'Published formula' && /Not published/.test(x.effect))) throw new Error('Seeking source-gap disclosure missing');
if (!/double the Seeking return/.test(seeking.researchEffectOverrides['Experienced Seekers'])) throw new Error('Experienced Seekers effect missing');
if (!/equal number of Inactives/.test(seeking.researchEffectOverrides['Seek Population'])) throw new Error('Seek Population effect missing');
if (!/\+30% total/.test(seeking.researchEffectOverrides['Veteran Trackers'])) throw new Error('Veteran Trackers total missing');
if (!/Group C Bush Lore skill/.test(seeking.researchEffectOverrides['Bush Lore 1, 2, 3'])) throw new Error('Bush Lore unlock missing from Seeking');
if (!S.itemBenefitsFor('Backpack').some(x => x.skill === 'Seeking')) throw new Error('Backpack Seeking backlink missing');

const shipbuilding = S.profile('Shipbuilding');
if (shipbuilding.primarySection !== '20.4' || shipbuilding.baseline !== 'Woodwork' || shipbuilding.mechanic !== 'unlock') throw new Error('Shipbuilding unlock dossier mismatch');
if (!/Shipwright and Shipyard capacity/.test(shipbuilding.workerRule)) throw new Error('Shipbuilding/Shipwright worker distinction missing');
for (const [level,item] of [[1,'Boat'],[2,'Ferry'],[2,'Fisher'],[3,'Barge'],[3,'Coaster'],[4,'Small Galley'],[5,'Medium Galley'],[6,'Large Galley'],[6,'Trader'],[8,'Longship'],[9,'Merchant'],[9,'Warship']]) {
  if (!shipbuilding.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Shipbuilding level ${level} ${item} recipe missing`);
}
if (!/58 sail \/ 54 row/.test(shipbuilding.researchEffectOverrides['Felucca Class I, Felucca Class II'])) throw new Error('Felucca I movement missing');
if (!/82 sail \/ 78 row/.test(shipbuilding.researchEffectOverrides['Felucca Class III, Felucca Class IV'])) throw new Error('Felucca IV movement missing');
if (!/12 Naval Cannons/.test(shipbuilding.researchEffectOverrides.Frigate)) throw new Error('Frigate cannon capacity missing');
if (!/10% increase/.test(shipbuilding.researchEffectOverrides['Shipbuilding 11'])) throw new Error('Shipbuilding 11 output bonus missing');
if (!/catch size \(not catch chance\)/.test(shipbuilding.researchEffectOverrides.Whaler)) throw new Error('Whaler catch-size distinction missing');
if (!S.itemBenefitsFor('Shipyard').some(x => x.skill === 'Shipbuilding')) throw new Error('Shipyard Shipbuilding backlink missing');

const stonework = S.profile('Stonework');
if (stonework.primarySection !== '13.1.32' || stonework.baseline !== 'Woodwork' || stonework.mechanic !== 'unlock') throw new Error('Stonework unlock dossier mismatch');
if (stonework.workerRule !== 'No Stonework worker limit') throw new Error('Stonework unlimited-worker rule missing');
for (const [level,item] of [[2,'Stone Axe'],[4,'Stone Spear'],[5,'Sculpture'],[6,'Millstone'],[8,'Statue'],[4,'Baking Oven'],[5,'Brickworks Kiln'],[6,'Charring Burner'],[8,'Refining Smelter']]) {
  if (!stonework.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Stonework level ${level} ${item} use missing`);
}
if (!stonework.factors.some(x => x.factor === 'Stone installation rate' && /5 Stones per person/.test(x.effect))) throw new Error('Stonework installation rate missing');
if (!/doubles Stonework or Art output/.test(stonework.researchEffectOverrides.Chisel)) throw new Error('Stonework Chisel effect missing');
if (!/Stonework 6, Art 6 and 200 Marble/.test(stonework.researchEffectOverrides['Marble Statue'])) throw new Error('Marble Statue recipe missing');
if (!S.itemBenefitsFor('Chisel').some(x => x.skill === 'Stonework')) throw new Error('Chisel Stonework backlink missing');

const apiology = S.profile('Apiology');
if (S.profile('Apiol') !== apiology) throw new Error('Apiology alias missing');
if (apiology.mechanic !== 'research-access' || apiology.baseline !== 'Woodwork') throw new Error('Apiology research-access dossier mismatch');
if (!apiology.factors.some(x => x.factor === 'Unlock' && /Apiology I/.test(x.effect))) throw new Error('Apiology unlock missing');
if (!apiology.factors.some(x => x.factor === 'Purpose' && /Apiology IV\+/.test(x.effect))) throw new Error('Apiology research-access purpose missing');
if (!apiology.factors.some(x => x.factor === 'Direct production effect' && /None published/.test(x.effect))) throw new Error('Apiology no-direct-output disclosure missing');
if (!/\+2 Apiarism/.test(apiology.researchEffectOverrides['Apiology IV, Apiology V, Apiology VI'])) throw new Error('Apiology IV-VI bonus missing');

const agriculture = S.profile('Agriculture');
if (S.profile('Agr') !== agriculture) throw new Error('Agriculture alias missing');
if (agriculture.mechanic !== 'research-access' || agriculture.baseline !== 'Woodwork') throw new Error('Agriculture research-access dossier mismatch');
if (!agriculture.factors.some(x => x.factor === 'Unlock chain' && /Farming 11/.test(x.effect))) throw new Error('Agriculture Farming 11 unlock chain missing');
if (!agriculture.factors.some(x => x.factor === 'Agriculture I–III' && /\+2 Farming each/.test(x.effect))) throw new Error('Agriculture I-III Farming bonus missing');
if (!agriculture.factors.some(x => x.factor === 'Agriculture 11 source gap' && /Effect not published/.test(x.effect))) throw new Error('Agriculture 11 source-gap disclosure missing');
if (!/does not state its effect/.test(agriculture.researchEffectOverrides['Agriculture 11'])) throw new Error('Agriculture 11 no-invention note missing');
if (!/\+2 Farming/.test(agriculture.researchEffectOverrides['Agriculture IV, Agriculture V, Agriculture VI'])) throw new Error('Agriculture IV-VI Farming bonus missing');

const cheese = S.profile('Cheesemaking');
if (S.profile('Cheese') !== cheese) throw new Error('Cheesemaking alias missing');
if (cheese.mechanic !== 'capacity' || cheese.baseline !== 'Forestry') throw new Error('Cheesemaking capacity dossier mismatch');
if (!/10 Cheesemakers per Cheesemaking level; unlimited at level 10/.test(cheese.workerRule)) throw new Error('Cheesemaking worker cap missing');
if (!cheese.outputs.some(x => /90 Milk/.test(x.detail) && /30 Cheese/.test(x.detail) && /1 Provision/.test(x.detail))) throw new Error('Cheesemaking conversion missing');
if (!cheese.factors.some(x => x.factor === 'Unlock' && /Dairy Cattle research/.test(x.effect))) throw new Error('Cheesemaking Dairy unlock missing');
if (!/10%/.test(cheese.researchEffectOverrides['Cheesemaking 11'])) throw new Error('Cheesemaking 11 output bonus missing');
if (!S.itemBenefitsFor('Cheese').some(x => x.skill === 'Cheesemaking')) throw new Error('Cheese backlink missing');

const geology = S.profile('Geology');
if (S.profile('Geo') !== geology || S.profile('Geol') !== geology) throw new Error('Geology aliases missing');
if (geology.mechanic !== 'research-access' || geology.baseline !== 'Woodwork') throw new Error('Geology research-access dossier mismatch');
if (!geology.factors.some(x => x.factor === 'Unlock chain' && /Mining 11/.test(x.effect))) throw new Error('Geology Mining 11 unlock chain missing');
if (!geology.factors.some(x => x.factor === 'Geology I–III' && /\+2 Mining each/.test(x.effect))) throw new Error('Geology I-III Mining bonus missing');
if (!/\+1 Geology level/.test(geology.researchEffectOverrides['Geology 11'])) throw new Error('Geology 11 effect missing');
if (!/\+2 Mining/.test(geology.researchEffectOverrides['Geology IV, Geology V, Geology VI'])) throw new Error('Geology IV-VI Mining bonus missing');
if (!/no separate benefit/.test(geology.researchEffectOverrides['Geology 11'])) throw new Error('Geology >10 limitation missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-c-4.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-c-4.js')) throw new Error('C4 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-c-4.js') < html.indexOf('skill-overhaul-category-c-3.js')) throw new Error('C4 data must load after C3');
if (html.indexOf('skill-overhaul-category-c-4.js') > html.indexOf('compendium.js')) throw new Error('C4 data must load before the Compendium renderer');

console.log('Group C batch C4 checks passed: Seeking, Shipbuilding, Stonework, Apiology, Agriculture, Cheesemaking and Geology');

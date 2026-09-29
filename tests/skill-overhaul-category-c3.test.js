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
run('skill-overhaul-category-c-3.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const c3 = ['Literacy','Maintain Boats','Milling','Music','Refining','Research','Sanitation'];
for (const name of c3) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`C3 Group C profile missing: ${name}`);
  if (profile.category !== 'C') throw new Error(`${name} should be a Group C dossier`);
  if (!['Forestry','Woodwork','Hunting','Economics'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const literacy = S.profile('Literacy');
if (literacy.primarySection !== '23.1' || literacy.mechanic !== 'scaling' || literacy.baseline !== 'Economics') throw new Error('Literacy scaling dossier mismatch');
if (!/5% × Literacy level/.test(literacy.levelDetail)) throw new Error('Literacy 5% per level rule missing');
if (!literacy.factors.some(x => x.factor === 'Library' && /×1.5/.test(x.effect))) throw new Error('Literacy Library multiplier missing');
if (!literacy.factors.some(x => x.factor === 'Book materials' && /10×DL²/.test(x.effect) && /3×DL Gold/.test(x.effect))) throw new Error('Literacy Book materials formula missing');
if (!/\+0.05 General Morale/.test(literacy.researchEffectOverrides.Haiku)) throw new Error('Literacy Haiku effect missing');
if (!/5 Scrolls/.test(literacy.researchEffectOverrides.Scroll)) throw new Error('Literacy Scroll effect missing');
if (!S.itemBenefitsFor('Library').some(x => x.skill === 'Literacy' && /50%/.test(x.value))) throw new Error('Library Literacy backlink missing');

const maintain = S.profile('Maintain Boats');
if (maintain.primarySection !== '21.2' || maintain.mechanic !== 'scaling' || maintain.baseline !== 'Economics') throw new Error('Maintain Boats scaling dossier mismatch');
if (!maintain.factors.some(x => x.factor === 'Maintain Boats 10' && /No additional maintenance crew/.test(x.effect))) throw new Error('Maintain Boats 10 endpoint missing');
if (!maintain.factors.some(x => x.factor === 'Levels 1–9' && /No published formula/.test(x.effect))) throw new Error('Maintain Boats source-gap disclosure missing');
if (!/25%/.test(maintain.researchEffectOverrides['Amphibious Warfare I'])) throw new Error('Amphibious Warfare I effect missing');
if (!/50%/.test(maintain.researchEffectOverrides['Amphibious Warfare II'])) throw new Error('Amphibious Warfare II aggregate effect missing');

const milling = S.profile('Milling');
if (milling.primarySection !== '14.11.1' || milling.mechanic !== 'capacity' || milling.baseline !== 'Forestry') throw new Error('Milling capacity dossier mismatch');
if (!/10 Milling workers per skill level; unlimited at level 10/.test(milling.workerRule)) throw new Error('Milling worker cap missing');
if (!milling.outputs.some(x => /80 Grain into 120 Flour/.test(x.detail))) throw new Error('Milling normal conversion missing');
if (!milling.factors.some(x => x.factor === 'Mill capacity' && /10 workers per Mill/.test(x.effect))) throw new Error('Milling Mill capacity missing');
if (!milling.factors.some(x => x.factor === 'Animal power' && /2 Cattle or Horses/.test(x.effect))) throw new Error('Milling animal power missing');
if (!/8,000 Grain.*12,000 Flour/.test(milling.researchEffectOverrides.Windmill)) throw new Error('Windmill output missing');
if (!/1 Oil \+ 10 Fodder/.test(milling.researchEffectOverrides.Oilmill)) throw new Error('Oilmill output missing');
if (!/×8/.test(milling.researchEffectOverrides.Sawmill)) throw new Error('Sawmill output multiplier missing');
if (!S.itemBenefitsFor('Sawmill').some(x => x.skill === 'Milling' && /×8/.test(x.value))) throw new Error('Sawmill Milling backlink missing');

const music = S.profile('Music');
if (music.primarySection !== '15.1' || music.mechanic !== 'scaling' || music.baseline !== 'Economics') throw new Error('Music Fair scaling dossier mismatch');
if (!/Participants × \(2 \+ Music\/4 \+ Economics\/4\)/.test(music.levelDetail)) throw new Error('Music Fair formula missing');
if (!music.factors.some(x => x.factor === 'Musical instruments' && /\+0.5 participant/.test(x.effect))) throw new Error('Music instrument Fair bonus missing');
for (const [level,item] of [[1,'Drum'],[3,'Horn'],[4,'Flute'],[6,'Trumpet'],[7,'Harp'],[8,'Lute']]) {
  if (!music.levelUses.some(x => x.level === level && x.item === item)) throw new Error(`Music level ${level} ${item} recipe missing`);
}
if (!/\+0.04 Military Morale/.test(music.researchEffectOverrides['Military Band'])) throw new Error('Military Band effect missing');
if (!/\+1 effective Leadership/.test(music.researchEffectOverrides['Music in the Field']) || !/\+1 effective Captaincy/.test(music.researchEffectOverrides['Music in the Field']) || !/\+2 effective Tactics/.test(music.researchEffectOverrides['Music in the Field'])) throw new Error('Music in the Field bonuses missing');
if (!S.itemBenefitsFor('Drum').some(x => x.skill === 'Music' && /0.5/.test(x.value))) throw new Error('Drum Music backlink missing');

const refining = S.profile('Refining');
if (refining.primarySection !== '14.12.1' || refining.mechanic !== 'capacity' || refining.baseline !== 'Forestry') throw new Error('Refining capacity dossier mismatch');
if (!/10 Refining workers per skill level; unlimited at level 10/.test(refining.workerRule)) throw new Error('Refining worker cap missing');
if (!refining.factors.some(x => x.factor === 'Smelter capacity' && /10 workers per Smelter/.test(x.effect))) throw new Error('Refining Smelter capacity missing');
if (!refining.factors.some(x => x.factor === 'Transformation restriction' && /1 transformation type per Refinery per turn/.test(x.effect))) throw new Error('Refining one-transformation rule missing');
if (!refining.outputs.some(x => x.item === 'Iron' && /20 Iron Ore \+ 10 Coal → 15 Iron/.test(x.detail))) throw new Error('Refining Iron conversion missing');
if (!refining.outputs.some(x => x.item === 'Bronze' && /25 Copper \+ 5 Tin \+ 10 Coal → 30 Bronze/.test(x.detail))) throw new Error('Refining Bronze conversion missing');
if (!/20 Coal into 15 Coke/.test(refining.researchEffectOverrides.Coke)) throw new Error('Coke conversion missing');
if (!/2 workers count as 3/.test(refining.researchEffectOverrides['Hammer Mill'])) throw new Error('Hammer Mill productivity effect missing');
if (!/20 Iron \+ 15 Silver \+ 10 Coke into 15 Steel/.test(refining.researchEffectOverrides.Steel)) throw new Error('Steel conversion missing');
if (!S.itemBenefitsFor('Smelter').some(x => x.skill === 'Refining' && /10 refiners/.test(x.value))) throw new Error('Smelter Refining backlink missing');

const research = S.profile('Research');
if (research.primarySection !== '29.31' || research.mechanic !== 'unlock' || research.baseline !== 'Woodwork') throw new Error('Research University-unlock dossier mismatch');
if (!research.levelUses.some(x => x.level === 10 && x.item === 'University')) throw new Error('Research 10 University unlock missing');
if (!research.factors.some(x => x.factor === 'Normal research eligibility' && /Relevant skill level 10/.test(x.effect))) throw new Error('Generic research skill-10 rule missing');
if (!research.factors.some(x => x.factor === 'DL0' && /12 consecutive failed turns/.test(x.effect))) throw new Error('Research DL0 auto-award rule missing');
if (!research.factors.some(x => x.factor === 'University build' && /Research 10 \+ Engineering 8 \+ Stonework 4/.test(x.effect))) throw new Error('University build requirements missing');
if (!/300 Silver per turn before DL0/.test(research.researchEffectOverrides['Silver Age']) || !/900 Silver per turn after DL0/.test(research.researchEffectOverrides['Silver Age'])) throw new Error('Silver Age costs missing');
if (!/one Category A, one Category B and one Category C skill/.test(research.researchEffectOverrides['Silver Age'])) throw new Error('Silver Age skill boosts missing');
if (!S.itemBenefitsFor('University').some(x => x.skill === 'Research')) throw new Error('University Research backlink missing');

const sanitation = S.profile('Sanitation');
if (sanitation.primarySection !== '29.35' || sanitation.mechanic !== 'scaling' || sanitation.baseline !== 'Economics') throw new Error('Sanitation scaling dossier mismatch');
if (!/50 Barrels.*10 additional Barrels per Sanitation level/.test(sanitation.levelDetail)) throw new Error('Sanitation Well formula missing');
if (!sanitation.factors.some(x => x.factor === 'Siege losses' && /Moderated by Sanitation/.test(x.effect) && /does not provide a numeric/.test(x.detail))) throw new Error('Sanitation siege source-gap treatment missing');
if (!/0.5%/.test(sanitation.researchEffectOverrides['Camp Sanitation'])) throw new Error('Camp Sanitation worker ratio missing');
if (!/\+4 Sanitation during Sieges/.test(sanitation.researchEffectOverrides.Sewers) || !/\+0.4% population growth/.test(sanitation.researchEffectOverrides.Sewers)) throw new Error('Sewers benefits missing');
if (!S.itemBenefitsFor('Well').some(x => x.skill === 'Sanitation' && /10 Barrels/.test(x.value))) throw new Error('Well Sanitation backlink missing');
if (!S.itemBenefitsFor('Sewers').some(x => x.skill === 'Sanitation')) throw new Error('Sewers Sanitation backlink missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-c-3.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-c-3.js')) throw new Error('C3 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-c-3.js') < html.indexOf('skill-overhaul-category-c-2.js')) throw new Error('C3 data must load after C2');
if (html.indexOf('skill-overhaul-category-c-3.js') > html.indexOf('compendium.js')) throw new Error('C3 data must load before the Compendium renderer');

console.log('Group C batch C3 checks passed: Literacy, Maintain Boats, Milling, Music, Refining, Research and Sanitation');

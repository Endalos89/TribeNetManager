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
run('skill-overhaul-category-b-2.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const b2 = ['Garrison','Healing','Heavy Weapons','Horsemanship','Intelligence','Leadership','Mariner'];
for (const name of b2) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`B2 Group B profile missing: ${name}`);
  if (profile.category !== 'B') throw new Error(`${name} should be a Group B dossier`);
  if (!['Hunting','Woodwork'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
}

const garrison = S.profile('Garrison');
if (garrison.primarySection !== '8.7.8' || garrison.mechanic !== 'capacity') throw new Error('Garrison capacity dossier mismatch');
if (!garrison.factors.some(x => x.factor === 'Unit capacity' && /1 Garrison per skill level/.test(x.effect))) throw new Error('Garrison one-per-level rule missing');
if (!garrison.factors.some(x => x.factor === 'Administration' && /Independent of Admin/.test(x.effect))) throw new Error('Garrison Administration independence missing');
if (!garrison.factors.some(x => x.factor === 'Movement' && /Normally immobile/.test(x.effect))) throw new Error('Garrison immobility rule missing');
if (!garrison.factors.some(x => x.factor === 'Meeting House exception' && /Adjacent placement/.test(x.effect))) throw new Error('Garrison Meeting House placement rule missing');
if (!garrison.factors.some(x => x.factor === 'Current hard limit' && /9 per Tribe/.test(x.effect))) throw new Error('Garrison designation ceiling missing');

const healing = S.profile('Healing');
if (healing.primarySection !== '13.1.13' || healing.mechanic !== 'efficiency') throw new Error('Healing dossier mismatch');
if (!healing.factors.some(x => x.factor === 'Healer capacity' && /5 wounded/.test(x.effect))) throw new Error('Healing 5 wounded per healer rule missing');
if (!healing.factors.some(x => x.factor === 'Orders' && /Not a normal Activity/.test(x.effect))) throw new Error('Healing non-activity rule missing');
const consumables = healing.factTables.find(x => /Healing consumables/.test(x.title));
if (!consumables?.rows.some(x => x.item?.entity === 'Herbs' && /1 Herb treats 1 wounded Warrior/.test(x.effect))) throw new Error('Healing Herb rule missing');
if (!consumables?.rows.some(x => x.item?.entity === 'Salve' && /Counts as 2 Herbs/.test(x.effect))) throw new Error('Healing Salve relationship missing');
if (!/\+4 effective Healing/.test(healing.researchEffectOverrides.Hospital)) throw new Error('Hospital Healing bonus missing');
if (!/25%/.test(healing.researchEffectOverrides.Triage)) throw new Error('Triage 25% saving missing');
if (!S.itemBenefitsFor('Herbs').some(x => x.skill === 'Healing')) throw new Error('Herbs Healing item backlink missing');

const heavy = S.profile('Heavy Weapons');
if (heavy.primarySection !== '29.21' || heavy.mechanic !== 'efficiency') throw new Error('Heavy Weapons dossier mismatch');
const hwTable = heavy.factTables.find(x => /published crew rules/.test(x.title));
for (const [weapon,crew] of [['Ballista','4'],['Onager','4'],['Catapult','6']]) {
  if (!hwTable?.rows.some(x => x.weapon?.entity === weapon && x.crew === crew)) throw new Error(`Heavy Weapons crew rule missing: ${weapon}`);
  if (!S.itemBenefitsFor(weapon).some(x => x.skill === 'Heavy Weapons')) throw new Error(`${weapon} Heavy Weapons backlink missing`);
}
if (!heavy.factors.some(x => x.factor === 'Deployment limit' && /1 attacking piece \/ 20 yd wall/.test(x.effect))) throw new Error('Heavy Weapons siege deployment limit missing');
if (heavy.researchEffectOverrides.Artillerists !== '+2 effective Heavy Weapons in Siege/Assault for the owning Tribe.') throw new Error('Artillerists +2 Heavy Weapons missing');

const horse = S.profile('Horsemanship');
if (!horse.factors.some(x => x.factor === 'Horse requirement' && /1 Horse per Cavalry Warrior/.test(x.effect))) throw new Error('Horsemanship Horse requirement missing');
if (!horse.factors.some(x => x.factor === 'Fords' && /Attacking Cavalry prohibited/.test(x.effect))) throw new Error('Horsemanship ford restriction missing');
if (!horse.factors.some(x => x.factor === 'Naval combat' && /No Cavalry/.test(x.effect))) throw new Error('Horsemanship naval no-Cavalry rule missing');
if (!/\+3 Horsemanship/.test(horse.researchEffectOverrides['Close Formation'])) throw new Error('Close Formation Horsemanship bonus missing');
if (!S.itemBenefitsFor('Horse').some(x => x.skill === 'Horsemanship')) throw new Error('Horse Horsemanship backlink missing');

const intel = S.profile('Intelligence');
if (intel.layout !== 'unlock' || intel.primarySection !== '13.1.16') throw new Error('Intelligence unlock dossier mismatch');
for (const level of [3,4,5,6,7,9,10]) if (!intel.levelUses.some(x => x.level === level)) throw new Error(`Intelligence ${level} unlock missing`);
if (intel.levelUses.filter(x => x.level === 3).length !== 2) throw new Error('Intelligence level 3 should expose terrain and base-ore requests');
if (!intel.levelUses.some(x => x.level === 10 && /Diamonds, Silver, Jade, Frankincense, Rubies or Gold/.test(x.detail))) throw new Error('Intelligence 10 exotic source request missing');
if (!intel.ruleGroups[0].rows.some(x => x.label === 'Frequency' && /one request per Clan per 12 months/i.test(x.values[0]))) throw new Error('Intelligence yearly request limit missing');
if (!/highest quantity/.test(intel.researchEffectOverrides['Goods Audit'])) throw new Error('Goods Audit summary missing');
if (!/maximum of four additional slots/.test(intel.researchEffectOverrides['Market Research'])) throw new Error('Market Research repeat cap missing');

const leadership = S.profile('Leadership');
if (leadership.primarySection !== '29.23' || leadership.mechanic !== 'efficiency') throw new Error('Leadership dossier mismatch');
if (!leadership.factors.some(x => x.factor === 'Naval combat' && /Captaincy/.test(x.effect))) throw new Error('Leadership Captaincy replacement missing');
if (!/half Generalship level/.test(leadership.researchEffectOverrides.Generalship)) throw new Error('Generalship/Leadership relationship missing');
if (!/\+1 Leadership and reduces rout severity by 5%/.test(leadership.researchEffectOverrides['Junior Officer'])) throw new Error('Junior Officer summary missing');
if (!S.itemBenefitsFor('Field Glasses').some(x => x.skill === 'Leadership' && x.value === '+2 Leadership')) throw new Error('Field Glasses Leadership benefit missing');

const mariner = S.profile('Mariner');
if (mariner.primarySection !== '29.26' || mariner.mechanic !== 'efficiency') throw new Error('Mariner dossier mismatch');
if (!mariner.factors.some(x => x.factor === 'Naval melee' && /Replaces Combat/.test(x.effect))) throw new Error('Mariner Combat replacement missing');
if (!mariner.factors.some(x => x.factor === 'Command skill' && /Captaincy replaces Leadership/.test(x.effect))) throw new Error('Mariner Captaincy relationship missing');
if (!mariner.factors.some(x => x.factor === 'Warrior availability' && /One-third rule \+ ship DP cap/.test(x.effect))) throw new Error('Mariner Warrior availability limits missing');
if (mariner.researchEffectOverrides.Marines !== '+3 Mariner. Requires Mariner 10.') throw new Error('Marines +3 Mariner missing');
if (!/33%/.test(mariner.researchEffectOverrides['Professional Sailor'])) throw new Error('Professional Sailor crew reduction missing');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-b-2.js')) throw new Error('B2 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-b-2.js') < html.indexOf('skill-overhaul-category-b-1.js')) throw new Error('B2 data must load after B1');
if (html.indexOf('skill-overhaul-category-b-2.js') > html.indexOf('compendium.js')) throw new Error('B2 data must load before the Compendium renderer');

console.log('Group B batch B2 checks passed: Garrison, Healing, Heavy Weapons, Horsemanship, Intelligence, Leadership and Mariner');

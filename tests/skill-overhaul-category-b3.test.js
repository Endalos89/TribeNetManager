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
run('skill-overhaul-category-b-3.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const b3 = ['Mobilisation','Navigation','Politics','Religion / Atheism','Rowing','Sailing','Scouting'];
for (const name of b3) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`B3 Group B profile missing: ${name}`);
  if (profile.category !== 'B') throw new Error(`${name} should be a Group B dossier`);
  if (!['Economics','Hunting'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const mobilisation = S.profile('Mobilisation');
if (mobilisation.primarySection !== '17.2.1' || mobilisation.mechanic !== 'scaling') throw new Error('Mobilisation scaling dossier mismatch');
if (!/3% × skill level/.test(mobilisation.levelDetail)) throw new Error('Mobilisation 3% per level rule missing');
if (!mobilisation.factors.some(x => x.factor === 'When it activates' && /attacked/.test(x.effect))) throw new Error('Mobilisation defensive-only trigger missing');
if (!mobilisation.factors.some(x => x.factor === 'Overall combat ceiling' && /33%/.test(x.effect))) throw new Error('Mobilisation one-third combat ceiling missing');
if (!mobilisation.factors.some(x => x.factor === 'Initiating combat' && /does not apply/.test(x.effect) && /Raids/.test(x.detail))) throw new Error('Mobilisation attacker exclusion missing');
if (!/20 to 25 per controlled hex/.test(mobilisation.researchEffectOverrides['Militia Mobilisation'])) throw new Error('Militia Mobilisation research effect missing');
if (!/30%.*33%/.test(mobilisation.researchEffectOverrides['Mobilisation 11'])) throw new Error('Mobilisation 11 research effect missing');

const navigation = S.profile('Navigation');
if (navigation.primarySection !== '21.1' || navigation.mechanic !== 'scaling') throw new Error('Navigation scaling dossier mismatch');
if (!navigation.factors.some(x => /Longship/.test(x.factor) && /\+3 MP per Navigation level/.test(x.effect) && /40 \+ 3×Navigation \+ 2×Seamanship \+ 4×Sailing/.test(x.detail))) throw new Error('Navigation sailing Longship formula missing');
if (!navigation.factors.some(x => /Rowing example/.test(x.factor) && /\+1 MP per Navigation level/.test(x.effect) && /36 \+ Navigation \+ Seamanship \+ 2×Rowing/.test(x.detail))) throw new Error('Navigation rowing Longship formula missing');
if (!/Navigation 10 to 11/.test(navigation.researchEffectOverrides['Navigation 11'])) throw new Error('Navigation 11 research effect missing');
if (!/12 MP.*6 MP/.test(navigation.researchEffectOverrides['Wetlands Wayfinder'])) throw new Error('Wetlands Wayfinder movement costs missing');
if (!/8 MP.*4 MP/.test(navigation.researchEffectOverrides['Wetlands Corridor'])) throw new Error('Wetlands Corridor movement costs missing');

const politics = S.profile('Politics');
if (politics.layout !== 'unlock' || politics.primarySection !== '24' || politics.mechanic !== 'scaling-unlock') throw new Error('Politics unlock/scaling dossier mismatch');
if (!politics.levelUses.some(x => x.level === 10 && /Home City/.test(x.use))) throw new Error('Politics 10 Home City unlock missing');
if (!politics.factors.some(x => x.factor === 'Pacifiers' && /10 Warriors per pacified controlled hex/.test(x.effect) && /GL5\+/.test(x.detail))) throw new Error('Politics Pacifier requirement/GL5 exception missing');
if (!politics.factors.some(x => x.factor === 'Governors' && /10 Actives per Government Level/.test(x.effect) && /Courthouse halves/.test(x.detail))) throw new Error('Politics Governor/Courthouse requirement missing');
if (!politics.factors.some(x => x.factor === 'Militia' && /20 per controlled hex/.test(x.effect))) throw new Error('Politics Militia rule missing');
const glTable = politics.factTables.find(x => /Government Level control/.test(x.title));
for (const [level,hexes] of [['GL0','1'],['GL1','7'],['GL2','19'],['GL3','37'],['GL4','61'],['GL5','91']]) {
  if (!glTable?.rows.some(x => x.level === level && x.hexes === hexes)) throw new Error(`Politics controlled-hex count missing: ${level}`);
}
if (!S.itemBenefitsFor('Courthouse').some(x => x.skill === 'Politics' && /Halves Governing/.test(x.value))) throw new Error('Courthouse Politics backlink missing');

const religion = S.profile('Religion / Atheism');
if (!religion || S.profile('Religion') !== religion || S.profile('Atheism') !== religion) throw new Error('Religion / Atheism aliases missing');
if (religion.name !== 'Religion') throw new Error('Combined Religion / Atheism dossier should use Religion as its research-index name');
if (religion.layout !== 'unlock' || religion.primarySection !== '27') throw new Error('Religion / Atheism unlock dossier mismatch');
for (const level of [2,3,4,5,6]) if (!religion.levelUses.some(x => x.level === level)) throw new Error(`Religion / Atheism level ${level} unlock missing`);
if (!religion.levelUses.some(x => x.level === 2 && /join/.test(x.use))) throw new Error('Religion 2 joining threshold missing');
if (!religion.levelUses.some(x => x.level === 3 && /found/.test(x.use))) throw new Error('Religion 3 founding threshold missing');
if (!religion.levelUses.some(x => x.level === 5 && /Missionary Element/.test(x.use))) throw new Error('Religion 5 Missionary Element unlock missing');
if (!religion.factors.some(x => x.factor === 'Movement formation' && /At least 4 Clans/.test(x.effect))) throw new Error('Religion four-Clan formation rule missing');
if (!religion.factors.some(x => x.factor === 'Festival month' && /20%/.test(x.effect))) throw new Error('Religion Festival-month meditation rule missing');
if (!/additional member/i.test(religion.researchEffectOverrides['Additional Member (Atheism / Religion)'])) throw new Error('Religion Additional Member research missing');
if (!/half Religion level, rounded up/.test(religion.researchEffectOverrides['Military Orders'])) throw new Error('Military Orders Leadership formula missing');

const rowing = S.profile('Rowing');
if (rowing.primarySection !== '21.3.8' || rowing.mechanic !== 'scaling') throw new Error('Rowing movement dossier mismatch');
if (!rowing.factors.some(x => x.factor === 'Longship example' && /\+2 MP per Rowing level/.test(x.effect) && /36 \+ Navigation \+ Seamanship \+ 2×Rowing/.test(x.detail))) throw new Error('Rowing Longship formula missing');
if (!rowing.factors.some(x => x.factor === 'Oars' && /Required/.test(x.effect))) throw new Error('Rowing Oar requirement missing');
if (rowing.researchEffectOverrides['Rowing 11'] !== '+1 Rowing level, taking Rowing 10 to 11.') throw new Error('Rowing 11 research effect missing');
if (!S.itemBenefitsFor('Oar').some(x => x.skill === 'Rowing')) throw new Error('Oar Rowing backlink missing');

const sailing = S.profile('Sailing');
if (sailing.primarySection !== '21.3.9' || sailing.mechanic !== 'scaling') throw new Error('Sailing movement dossier mismatch');
if (!sailing.factors.some(x => x.factor === 'Longship example' && /\+4 MP per Sailing level/.test(x.effect) && /40 \+ 3×Navigation \+ 2×Seamanship \+ 4×Sailing/.test(x.detail))) throw new Error('Sailing Longship formula missing');
if (!sailing.factors.some(x => x.factor === 'Wind' && /Calm/.test(x.detail))) throw new Error('Sailing Calm/wind rule missing');
if (!/\+3 Seamanship and \+3 Navigation/.test(sailing.researchEffectOverrides['Expert Sailors 1'])) throw new Error('Expert Sailors research effect missing');
if (!/25%/.test(sailing.researchEffectOverrides.Raincatching) || !/5 Cloth/.test(sailing.researchEffectOverrides.Raincatching)) throw new Error('Raincatching capacity/material rules missing');
if (sailing.researchEffectOverrides['Sailing 11'] !== '+1 Sailing level.') throw new Error('Sailing 11 research effect missing');
if (!/two Ocean\/Lake hexes/.test(sailing.researchEffectOverrides['Two Hex Ferry'])) throw new Error('Two Hex Ferry research effect missing');

const scouting = S.profile('Scouting');
if (scouting.primarySection !== '16.3' || scouting.mechanic !== 'efficiency' || scouting.baseline !== 'Hunting') throw new Error('Scouting exploration dossier mismatch');
if (!/8 scouting parties per Tribe/.test(scouting.workerRule)) throw new Error('Scouting eight-party limit missing');
if (!scouting.factors.some(x => x.factor === 'Timing' && /After unit movement/.test(x.effect))) throw new Error('Scouting timing rule missing');
if (!scouting.factors.some(x => x.factor === 'Locate / Spy / Raid' && /Locate and Raid are scouting missions/.test(x.detail) && /Spying is both a scout mission and a separate Group B skill/.test(x.detail))) throw new Error('Scouting mission/skill distinction missing');
if (!scouting.factors.some(x => x.factor === 'Raid party size' && /10 raiders per Tactics level/.test(x.effect))) throw new Error('Raid party Tactics cap missing');
if (!scouting.factors.some(x => x.factor === 'Fleet scouts' && /Land scouting only/.test(x.effect))) throw new Error('Fleet land-scouting restriction missing');
if (!/\+2 scouting movement points/.test(scouting.researchEffectOverrides['Extra Movement 1'])) throw new Error('Scouting Extra Movement 1 missing');
if (!/\+1 \/ \+3 \/ \+5 Scouting levels/.test(scouting.researchEffectOverrides['Ranger 1, 2, 3'])) throw new Error('Ranger Scouting bonuses missing');
if (scouting.researchEffectOverrides['Scout Veterans'] !== '+2 Scouting levels.') throw new Error('Scout Veterans Scouting bonus missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-b-3.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-b-3.js')) throw new Error('B3 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-b-3.js') < html.indexOf('skill-overhaul-category-b-2.js')) throw new Error('B3 data must load after B2');
if (html.indexOf('skill-overhaul-category-b-3.js') > html.indexOf('compendium.js')) throw new Error('B3 data must load before the Compendium renderer');

console.log('Group B batch B3 checks passed: Mobilisation, Navigation, Politics, Religion/Atheism, Rowing, Sailing and Scouting');

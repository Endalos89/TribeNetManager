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
run('skill-overhaul-category-b-4.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const b4 = ['Seamanship','Security','Shipwright','Slavery','Spying','Tactics','Torture'];
for (const name of b4) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`B4 Group B profile missing: ${name}`);
  if (profile.category !== 'B') throw new Error(`${name} should be a Group B dossier`);
  if (!['Economics','Hunting','Woodwork'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const seamanship = S.profile('Seamanship');
if (seamanship.primarySection !== '29.36' || seamanship.mechanic !== 'scaling') throw new Error('Seamanship scaling dossier mismatch');
if (!seamanship.factors.some(x => /Longship/.test(x.factor) && /\+2 MP per Seamanship level/.test(x.effect) && /40 \+ 3×Navigation \+ 2×Seamanship \+ 4×Sailing/.test(x.detail))) throw new Error('Seamanship sailing Longship formula missing');
if (!seamanship.factors.some(x => /Rowing example/.test(x.factor) && /\+1 MP per Seamanship level/.test(x.effect) && /36 \+ Navigation \+ Seamanship \+ 2×Rowing/.test(x.detail))) throw new Error('Seamanship rowing Longship formula missing');
if (!/^\+4 Fleet movement points/.test(seamanship.researchEffectOverrides['Fleet Movement 4'])) throw new Error('Fleet Movement 4 effect missing');
if (!/\+6 total/.test(seamanship.researchEffectOverrides['Fleet Movement 6'])) throw new Error('Fleet Movement 6 cumulative effect missing');
if (seamanship.researchEffectOverrides['Seamanship 11'] !== 'Raises Seamanship to level 11.') throw new Error('Seamanship 11 effect missing');
if (!/\+3 Seamanship and \+3 Navigation/.test(seamanship.researchEffectOverrides['Expert Sailors 1'])) throw new Error('Expert Sailors cross-skill effect missing');

const security = S.profile('Security');
if (security.primarySection !== '16.5' || security.mechanic !== 'efficiency' || security.baseline !== 'Hunting') throw new Error('Security detection dossier mismatch');
if (!security.factors.some(x => x.factor === 'Targets' && /Spies and Raiders/.test(x.effect) && /Suppression/.test(x.detail))) throw new Error('Security targets/distinction missing');
if (!security.factors.some(x => x.factor === 'Defence availability' && /50%/.test(x.effect) && /one-third/.test(x.detail))) throw new Error('Security half-to-defence rule missing');
if (!security.factors.some(x => x.factor === 'Who is protected' && /Clan/.test(x.effect) && /Suppression/.test(x.detail))) throw new Error('Security Clan-vs-hex distinction missing');
if (!/Security 6/.test(security.researchEffectOverrides.Outpost) || !/20\+ Warriors/.test(security.researchEffectOverrides.Outpost) || !/\+2 scout groups/.test(security.researchEffectOverrides.Outpost)) throw new Error('Security Outpost effect missing');
if (!/3 percentage points per Security level/.test(security.researchEffectOverrides['Security Patrol'])) throw new Error('Security Patrol effect missing');
if (!S.itemBenefitsFor('Dog Leash').some(x => x.skill === 'Security' && x.value === '+2 Security')) throw new Error('Dog Leash Security backlink missing');
if (!S.itemBenefitsFor('Watchtower').some(x => x.skill === 'Security' && /\+2% detection/.test(x.value))) throw new Error('Watchtower Security backlink missing');

const shipwright = S.profile('Shipwright');
if (shipwright.primarySection !== '20.3' || shipwright.mechanic !== 'capacity' || shipwright.baseline !== 'Woodwork') throw new Error('Shipwright capacity dossier mismatch');
if (!/10 Shipbuilding workers per Shipwright level; unlimited at level 10/.test(shipwright.workerRule)) throw new Error('Shipwright worker cap missing');
if (!shipwright.factors.some(x => x.factor === 'Shipyard' && /actual worker capacity/.test(x.effect))) throw new Error('Shipwright Shipyard capacity relationship missing');
if (!shipwright.factors.some(x => x.factor === 'Joint Projects' && /own Shipwright/.test(x.effect))) throw new Error('Shipwright Joint Project rule missing');
if (!/3 actual workers.*4 effective workers/.test(shipwright.researchEffectOverrides['Improved Productivity I (ShipW 25)'])) throw new Error('Shipwright Improved Productivity effect missing');
if (!/1.5 effective workers/.test(shipwright.researchEffectOverrides.Drydock) || !/100 actual workers/.test(shipwright.researchEffectOverrides.Drydock)) throw new Error('Shipwright Drydock effect missing');
if (!S.itemBenefitsFor('Drydock').some(x => x.skill === 'Shipwright')) throw new Error('Drydock Shipwright backlink missing');
if (!S.itemBenefitsFor('Shipyard').some(x => x.skill === 'Shipwright')) throw new Error('Shipyard Shipwright backlink missing');

const slavery = S.profile('Slavery');
if (slavery.primarySection !== '13.1.31' || slavery.mechanic !== 'scaling') throw new Error('Slavery scaling dossier mismatch');
if (!slavery.factors.some(x => x.factor === 'Passive control' && /Slavery level per 10 Clan members/.test(x.effect) && /Slavery 10 controls 10 per 10/.test(x.detail))) throw new Error('Slavery passive control formula missing');
if (!slavery.factors.some(x => x.factor === 'Active overseers' && /1 overseer per 10/.test(x.effect))) throw new Error('Slavery overseer ratio missing');
if (!slavery.factors.some(x => x.factor === 'Shackles' && /count as half/.test(x.effect))) throw new Error('Slavery Shackles rule missing');
if (!slavery.factors.some(x => x.factor === 'Unsupervised Slaves' && /1 in 5 flee/.test(x.effect))) throw new Error('Slavery escape rate missing');
if (!/50 \+ 4d12 Locals/.test(slavery.researchEffectOverrides['Press Gang'])) throw new Error('Press Gang research effect missing');
if (!S.itemBenefitsFor('Shackles').some(x => x.skill === 'Slavery' && /0.5/.test(x.value))) throw new Error('Shackles Slavery backlink missing');

const spying = S.profile('Spying');
if (spying.primarySection !== '16.4.5' || spying.mechanic !== 'efficiency' || spying.baseline !== 'Hunting') throw new Error('Spying scout-mission dossier mismatch');
if (!spying.factors.some(x => x.factor === 'Targeting' && /1 spy group/.test(x.effect))) throw new Error('Spying one-group/one-unit rule missing');
if (!spying.factors.some(x => x.factor === 'Truced Clans' && /prohibited/.test(x.effect))) throw new Error('Spying Truce restriction missing');
if (!spying.factors.some(x => x.factor === 'Locate' && /Spying and Scouting/.test(x.effect))) throw new Error('Spying Locate relationship missing');
const spyTable = spying.factTables.find(x => /successful spy attempt/.test(x.title));
for (const target of ['Defence / Security','Suppression','Total Warriors']) if (!spyTable?.rows.some(x => x.target === target)) throw new Error(`Spying information target missing: ${target}`);
if (!/\+25 percentage points/.test(spying.researchEffectOverrides['Expert Spies'])) throw new Error('Expert Spies effect missing');

const tactics = S.profile('Tactics');
if (tactics.primarySection !== '29.37' || tactics.mechanic !== 'scaling') throw new Error('Tactics scaling dossier mismatch');
if (!tactics.factors.some(x => x.factor === 'Raid party capacity' && /10 Raiders per Tactics level/.test(x.effect) && /Tactics 10/.test(x.detail))) throw new Error('Tactics raid-party limit missing');
if (!tactics.factors.some(x => x.factor === 'Ranged troop ratio' && /25% \+ 1% per Tactics level/.test(x.effect))) throw new Error('Tactics ranged ratio missing');
if (tactics.researchEffectOverrides['Tactics 11'] !== '+1 Tactics level, taking Tactics 10 to 11.') throw new Error('Tactics 11 effect missing');
if (!/1 Wagon or Ore Cart per 10 Warriors/.test(tactics.researchEffectOverrides['Wagon Laager']) || !/Palisade/.test(tactics.researchEffectOverrides['Wagon Laager'])) throw new Error('Wagon Laager effect missing');
if (!/\+2 Tactics/.test(tactics.researchEffectOverrides['Command Tent'])) throw new Error('Command Tent Tactics effect missing');
if (!S.itemBenefitsFor('Command Tent').some(x => x.skill === 'Tactics' && x.value === '+2 Tactics in combat')) throw new Error('Command Tent Tactics backlink missing');

const torture = S.profile('Torture');
if (torture.primarySection !== '16.7' || torture.mechanic !== 'scaling') throw new Error('Torture scaling dossier mismatch');
if (!/10% \+ 10% × Torture level/.test(torture.levelDetail)) throw new Error('Torture success formula missing');
if (!torture.factors.some(x => x.factor === 'Question allowance' && /1 question per discrete captured group/.test(x.effect))) throw new Error('Torture question allowance missing');
if (!torture.factors.some(x => x.factor === 'Timing' && /Immediately after capture/.test(x.effect))) throw new Error('Torture timing rule missing');
if (!torture.factors.some(x => x.factor === 'Skill sharing' && /same-hex sub-Tribe/.test(x.effect))) throw new Error('Torture same-hex skill sharing missing');
if (!torture.factors.some(x => x.factor === 'Question scope' && /no unit locations/.test(x.effect))) throw new Error('Torture unit-location exclusion missing');
if (!/one additional Torture question/.test(torture.researchEffectOverrides['Thumb Screws'])) throw new Error('Thumb Screws Torture effect missing');
if (!/no numeric Torture bonus is stated/.test(torture.researchEffectOverrides.Dungeon)) throw new Error('Dungeon source-gap treatment missing');
if (!S.itemBenefitsFor('Thumb Screws').some(x => x.skill === 'Torture' && /\+1 question/.test(x.value))) throw new Error('Thumb Screws Torture backlink missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-b-4.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-b-4.js')) throw new Error('B4 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-b-4.js') < html.indexOf('skill-overhaul-category-b-3.js')) throw new Error('B4 data must load after B3');
if (html.indexOf('skill-overhaul-category-b-4.js') > html.indexOf('compendium.js')) throw new Error('B4 data must load before the Compendium renderer');

console.log('Group B batch B4 checks passed: Seamanship, Security, Shipwright, Slavery, Spying, Tactics and Torture');

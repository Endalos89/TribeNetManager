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
run('skill-overhaul-category-b-1.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const b1 = ['Administration','Apothecary','Archery','Captaincy','Combat','Courier','Diplomacy'];
for (const name of b1) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`B1 Group B profile missing: ${name}`);
  if (profile.category !== 'B') throw new Error(`${name} should be a Group B dossier`);
  if (!['Hunting','Woodwork'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
}

const admin = S.profile('Administration');
if (admin.layout !== 'unlock' || admin.primarySection !== '8.7.5') throw new Error('Administration should use the level-unlock dossier');
for (const [level,count] of [[2,1],[4,2],[6,3],[8,4],[10,5]]) {
  const row = admin.levelUses.find(x => x.level === level);
  if (!row || !row.use.startsWith(String(count))) throw new Error(`Administration ${level} unit capacity missing`);
}
if (!/three times/i.test(admin.researchEffectOverrides['Extra Element'])) throw new Error('Extra Element repeat limit missing');
if (!/\+4 MP/.test(admin.researchEffectOverrides['Extra Movement 4']) || !/Fleets or Couriers/.test(admin.researchEffectOverrides['Extra Movement 4'])) throw new Error('Administration Extra Movement 4 rule missing');
if (!/\+6 MP total/.test(admin.researchEffectOverrides['Fleet Movement 6'])) throw new Error('Administration Fleet Movement 6 total missing');

const apoth = S.profile('Apothecary');
if (apoth.layout !== 'category-a-activity' || apoth.mechanic !== 'research-access') throw new Error('Apothecary should be a research-access dossier');
if (!/Group B research skill/.test(apoth.factTables[0].rows[0].detail)) throw new Error('Apothecary Mandate role missing');
if (!/1,000 Hashish/.test(apoth.researchEffectOverrides.Hashish) || !/six-month/.test(apoth.researchEffectOverrides.Hashish)) throw new Error('Hashish production rule missing');
if (!/Counts as 2 Herbs|counts as 2 Herbs/i.test(S.itemBenefitsFor('Salve')[0]?.value || '')) throw new Error('Salve Healing benefit missing');

const archery = S.profile('Archery');
if (archery.mechanic !== 'efficiency' || archery.primarySection !== '29.5') throw new Error('Archery efficiency dossier mismatch');
if (!archery.factors.some(x => x.factor === 'Ranged troop limit' && /25% \+ 1% per Tactics level/.test(x.effect))) throw new Error('Archery ranged troop limit missing');
if (!archery.factors.some(x => x.factor === 'Fords' && x.effect === '+4 Archery when defending')) throw new Error('Archery ford defence bonus missing');
if (!archery.factors.some(x => x.factor === 'Naval combat' && /remains Archery/.test(x.effect))) throw new Error('Archery naval rule missing');
const missile = archery.factTables.find(x => /Missile weapons/.test(x.title));
for (const item of ['Sling','Bow','Arbalest']) if (!missile?.rows.some(x => x.weapon?.entity === item)) throw new Error(`Archery weapon link missing: ${item}`);
if (archery.researchEffectOverrides.Marksmen !== '+3 Archery.') throw new Error('Marksmen +3 Archery missing');
for (const item of ['Sling','Bow','Arbalest']) if (!S.itemBenefitsFor(item).some(x => x.skill === 'Archery')) throw new Error(`${item} Archery item benefit missing`);

const captaincy = S.profile('Captaincy');
if (!captaincy.factors.some(x => x.factor === 'Naval command' && /Replaces Leadership/.test(x.effect))) throw new Error('Captaincy Leadership replacement missing');
if (!/half Admiralty level/.test(captaincy.researchEffectOverrides.Admiralty)) throw new Error('Admiralty/Captaincy relationship missing');
if (!/\+1 Captaincy and reduces rout severity by 5%/.test(captaincy.researchEffectOverrides['Junior Naval Officer'])) throw new Error('Junior Naval Officer summary missing');
if (!/Potential Casualties/.test(captaincy.researchEffectOverrides['Naval Second in Command (NSIC)'])) throw new Error('NSIC Captaincy modifier missing');

const combat = S.profile('Combat');
if (!combat.factors.some(x => x.factor === 'Numbers' && /Major factor/.test(x.effect))) throw new Error('Combat numbers factor missing');
if (!combat.factors.some(x => x.factor === 'Fords' && x.effect === '+4 Combat when defending')) throw new Error('Combat ford defence bonus missing');
if (!combat.factors.some(x => x.factor === 'Naval combat' && /Mariner/.test(x.effect))) throw new Error('Combat naval replacement missing');
if (!/\+2 Combat and \+2 Assault Attack Terrain Proficiency/.test(combat.researchEffectOverrides['Assault Troops'])) throw new Error('Assault Troops effect missing');
if (!/\+0.10 Combat Morale/.test(combat.researchEffectOverrides.Army)) throw new Error('Army Combat Morale effect missing');
if (!/\+0.5 Terrain Proficiency/.test(combat.researchEffectOverrides['Home Guard'])) throw new Error('Home Guard terrain proficiency missing');
const phases = combat.factTables.find(x => /land-combat sequence/.test(x.title));
if (!phases || phases.rows.length !== 2) throw new Error('Combat phase table missing');

const courier = S.profile('Courier');
if (courier.mechanic !== 'capacity' || courier.primarySection !== '8.7.9') throw new Error('Courier capacity dossier mismatch');
if (!courier.factors.some(x => x.factor === 'Unit capacity' && /1 Courier per skill level/.test(x.effect))) throw new Error('Courier one-per-level rule missing');
if (!courier.factors.some(x => x.factor === 'Movement' && x.effect === '+14 MP')) throw new Error('Courier +14 MP missing');
if (!courier.factors.some(x => x.factor === 'Prohibited activities' && /Engineering, Shipbuilding or Scouting/.test(x.detail))) throw new Error('Courier prohibited activities missing');
if (!courier.factors.some(x => x.factor === 'Combat' && /Cannot initiate/.test(x.effect))) throw new Error('Courier combat restriction missing');
if (!courier.factors.some(x => x.factor === 'Village / Goods Tribe' && /cannot own a Village/.test(x.detail))) throw new Error('Courier Village/Goods Tribe restrictions missing');

const dip = S.profile('Diplomacy');
if (dip.layout !== 'unlock' || dip.primarySection !== '8.7.1') throw new Error('Diplomacy unlock dossier mismatch');
if (!dip.levelUses.some(x => x.level === 'Any' && /one Tribe per Diplomacy level/.test(x.detail))) throw new Error('Diplomacy Clan Tribe capacity missing');
if (!dip.levelUses.some(x => x.level === 7 && x.item === 'Trading Post' && /Economics 4/.test(x.detail))) throw new Error('Diplomacy 7 Trading Post/Fair use missing');
if (!/closest International City or Trading Town/.test(dip.researchEffectOverrides['Diplomatic Rumours'])) throw new Error('Diplomatic Rumours summary missing');
if (!/\+50%/.test(dip.researchEffectOverrides['Trade Envoy'])) throw new Error('Trade Envoy +50% terms missing');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-b-1.js')) throw new Error('B1 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-b-1.js') < html.indexOf('skill-overhaul-profile-registry.js')) throw new Error('B1 data must load after the profile registry');
if (html.indexOf('skill-overhaul-category-b-1.js') > html.indexOf('compendium.js')) throw new Error('B1 data must load before the Compendium renderer');

const cleanup = fs.readFileSync(path.join(root, 'compendium-group-a-mandate-cleanup.js'), 'utf8');
if (/skill\.skillGroup\s*!==\s*['"]A['"]/.test(cleanup)) throw new Error('Legacy Mandate cleanup must no longer be limited to Group A');
if (!cleanup.includes("!S.profile(skill.name)")) throw new Error('Legacy Mandate cleanup should target any migrated dossier profile');

console.log('Group B batch B1 checks passed: Administration, Apothecary, Archery, Captaincy, Combat, Courier and Diplomacy');

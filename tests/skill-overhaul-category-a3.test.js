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
run('skill-overhaul-category-a-3.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

for (const name of ['Metalwork','Mining','Pottery','Quarrying','Salting','Sewing']) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`A3 profile missing: ${name}`);
  if (profile.category !== 'A') throw new Error(`${name} should be a Group A dossier`);
  if (!['Hunting','Forestry','Woodwork'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline`);
}

const metal = S.profile('Metalwork');
if (S.profile('Metalworking') !== metal) throw new Error('Metalwork/Metalworking alias missing');
if (metal.layout !== 'category-a-craft' || metal.directCrafts.length !== 15) throw new Error('Metalwork direct craft table should contain 15 Mandate recipes');
if (!metal.directCrafts.some(row => row.entity === 'Pellets' && row.inputs.some(i => i.entity === 'Lead' && i.quantity === 10) && row.inputs.some(i => i.entity === 'Coal' && i.quantity === 1))) throw new Error('Metalwork Pellets recipe incorrect');
if (!metal.directCrafts.some(row => row.entity === 'Quarrels' && /IRON ONLY/.test(row.detail))) throw new Error('Metalwork Quarrels iron-only rule missing');
if (!metal.directCrafts.some(row => row.entity === 'Lamp' && row.inputs.some(i => i.entity === 'Brass' && i.quantity === 1) && row.inputs.some(i => i.entity === 'Oil' && i.quantity === 20))) throw new Error('Metalwork Lamp recipe incorrect');
if (!metal.requiredUses.some(row => row.entity === 'Trumpet' && row.level === 6 && row.requirements.some(req => req.skill === 'Music' && req.level === 6))) throw new Error('Trumpet Metalwork 6 requirement missing');
if (!metal.requiredUses.some(row => row.entity === 'Barge' && row.level === 3 && row.requirements.some(req => req.skill === 'Shipbuilding' && req.level === 3) && row.requirements.some(req => req.skill === 'Woodwork' && req.level === 5))) throw new Error('Barge Metalwork requirement missing');
if (!metal.requiredUses.some(row => row.entity === 'Warship' && row.level === 7 && row.requirements.some(req => req.skill === 'Shipbuilding' && req.level === 9))) throw new Error('Warship Metalwork requirement missing');
if (!metal.notes.some(note => /75% of the Coal/i.test(note))) throw new Error('Metalwork Bronze/Brass substitution rule missing');

const mining = S.profile('Mining');
if (mining.layout !== 'category-a-activity' || mining.mechanic !== 'efficiency') throw new Error('Mining should use the Hunting-style activity dossier');
if (!mining.implements.some(row => row.name === 'Pick' && row.value === '×2 output')) throw new Error('Mining Pick benefit missing');
if (!mining.implements.some(row => row.name === 'Shovel' && row.value === '+50% output')) throw new Error('Mining Shovel benefit missing');
if (!mining.implements.some(row => row.name === 'Mining Ladder' && /10 miners/.test(row.value))) throw new Error('Mining Ladder benefit missing');
if (!mining.researchEffectOverrides['Appropriate Mining Tool'].includes('Pick and a Shovel')) throw new Error('Appropriate Mining Tool summary missing');
const deposits = mining.factTables.find(table => /Minerals explicitly listed/.test(table.title));
if (!deposits || !deposits.rows.some(row => row.material?.entity === 'Gold')) throw new Error('Mining deposit reference table missing Gold');

for (const skill of ['Mining','Pottery','Quarrying']) {
  if (!S.itemBenefitsFor('Shovel').some(row => row.skill === skill)) throw new Error(`Shovel multi-benefit keyword missing: ${skill}`);
}
if (!S.itemBenefitsFor('Mattock').some(row => row.skill === 'Mining') || !S.itemBenefitsFor('Mattock').some(row => row.skill === 'Quarrying')) throw new Error('Mattock Mining/Quarrying benefit split missing');

const pottery = S.profile('Pottery');
if (pottery.layout !== 'category-a-craft' || !/10 workers per skill level/i.test(pottery.workerRule)) throw new Error('Pottery worker-cap dossier mismatch');
if (pottery.directCrafts.length !== 3) throw new Error('Pottery should have Ewer, Jar and Urn base recipes');
const jar = pottery.directCrafts.find(row => row.entity === 'Jar');
if (!jar || jar.people !== 2 || !/50 lb/.test(jar.detail)) throw new Error('Pottery Jar recipe/capacity incorrect');
const clay = pottery.factTables.find(table => /Clay sourcing/.test(table.title));
if (!clay || !clay.rows.some(row => row.rate === '40 Clay / person')) throw new Error('Pottery Shovel Clay-digging rate missing');
if (!/two Ewers\/Jars\/Urns/i.test(pottery.researchEffectOverrides['Advanced Pottery'])) throw new Error('Advanced Pottery summary missing');

const quarry = S.profile('Quarrying');
if (quarry.layout !== 'category-a-activity' || !/10 workers per skill level/i.test(quarry.workerRule)) throw new Error('Quarrying worker-cap dossier mismatch');
if (!quarry.outputs.some(row => row.item === 'Stones' && row.rate === '5 / worker')) throw new Error('Quarrying base output missing');
if (!quarry.implements.some(row => row.name === 'Mattock' && row.value === '×2 output')) throw new Error('Quarrying Mattock benefit missing');
if (!/10 Stones per person/.test(quarry.researchEffectOverrides['10 Stones / Person'])) throw new Error('Quarrying 10 Stones/person progression missing');
if (!/one-third/.test(quarry.researchEffectOverrides['Inactive Quarriers'])) throw new Error('Inactive Quarriers summary missing');

const salting = S.profile('Salting');
if (salting.layout !== 'category-a-process' || !/10 workers per skill level/i.test(salting.workerRule)) throw new Error('Salting worker-cap dossier mismatch');
const saltRow = salting.processRows.find(row => row.activity === 'Salt Fish');
if (!saltRow || !/100 provs/.test(saltRow.perWorker) || !saltRow.inputs.some(i => /0.1 Salt per prov/.test(i.label))) throw new Error('Salting 100 provs / 0.1 Salt rule missing');
if (!/Prairie hex/.test(salting.researchEffectOverrides['Salt Panning'])) throw new Error('Salting Salt Panning research summary missing');

const sewing = S.profile('Sewing');
if (sewing.layout !== 'category-a-craft' || sewing.directCrafts.length !== 6 || sewing.requiredUses.length !== 2) throw new Error('Sewing direct/prerequisite split incorrect');
if (!sewing.directCrafts.some(row => row.entity === 'Bladder' && /10 lb of water/.test(row.detail))) throw new Error('Sewing Bladder capacity missing');
if (!sewing.requiredUses.some(row => row.entity === 'Ring Mail' && row.level === 3 && row.requirements.some(req => req.skill === 'Armour' && req.level === 4))) throw new Error('Ring Mail Sewing/Armour requirements missing');
if (!sewing.requiredUses.some(row => row.entity === 'Scale Mail' && row.requirements.some(req => req.skill === 'Armour' && req.level === 3))) throw new Error('Scale Mail Sewing/Armour requirements missing');
if (!/Only 2 people per Tribe/.test(sewing.researchEffectOverrides['Brocade'])) throw new Error('Brocade monthly worker restriction missing');
if (!/\+1 Leadership Modifier/.test(sewing.researchEffectOverrides['Command Tent']) || !/\+2 Tactics/.test(sewing.researchEffectOverrides['Command Tent'])) throw new Error('Command Tent combat bonuses missing');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-a-3.js')) throw new Error('A3 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-a-3.js') < html.indexOf('skill-overhaul-profile-registry.js')) throw new Error('A3 data must load after the profile registry');
if (html.indexOf('skill-overhaul-category-a-3.js') > html.indexOf('compendium.js')) throw new Error('A3 data must load before the Compendium renderer');

console.log('Group A batch A3 checks passed: Metalwork, Mining, Pottery, Quarrying, Salting and Sewing');

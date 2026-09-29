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
run('skill-overhaul-category-c-1.js');
const S = context.window.TribeNetSkillOverhaul;
if (!S) throw new Error('Skill overhaul data did not register');

const c1 = ['Archaeology','Architecture','Alchemy','Apiarism','Art','Banking','Baking'];
for (const name of c1) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`C1 Group C profile missing: ${name}`);
  if (profile.category !== 'C') throw new Error(`${name} should be a Group C dossier`);
  if (!['Forestry','Woodwork','Hunting','Economics'].includes(profile.baseline)) throw new Error(`${name} uses an unapproved baseline pattern`);
  if (profile.status !== 'baseline-derived') throw new Error(`${name} should be marked baseline-derived`);
}

const archaeology = S.profile('Archaeology');
if (archaeology.primarySection !== '26' || archaeology.mechanic !== 'unlock' || archaeology.baseline !== 'Woodwork') throw new Error('Archaeology unlock dossier mismatch');
if (!archaeology.levelUses.some(x => x.level === 1 && /Archaeology Tribe/.test(x.use))) throw new Error('Archaeology 1 designation missing');
if (!/10 excavators.*1 Artefact per turn/.test(archaeology.workerRule)) throw new Error('Archaeology fixed excavation output missing');
if (!archaeology.factors.some(x => x.factor === 'Required supporting skill' && /Excavation 1/.test(x.effect))) throw new Error('Archaeology Excavation 1 requirement missing');
if (!archaeology.factors.some(x => x.factor === 'Eligible excavation units' && /Parent Tribe, Element or Garrison/.test(x.effect))) throw new Error('Archaeology eligible unit rule missing');
const artefactUses = archaeology.factTables.find(x => /exchange options/.test(x.title));
for (const cost of ['10','15','1 each']) if (!artefactUses?.rows.some(x => x.cost === cost)) throw new Error(`Archaeology Artefact use missing: ${cost}`);
if (!/1,200 Silver/.test(artefactUses.rows.find(x => x.cost === '1 each').benefit)) throw new Error('Archaeology Fair value missing');
if (!/third immediate and annual/.test(archaeology.researchEffectOverrides['Relic 3'])) throw new Error('Archaeology Relic 3 effect missing');
if (!/second Ruin site within 30 hexes/.test(archaeology.researchEffectOverrides['Second Site'])) throw new Error('Archaeology Second Site effect missing');
if (!S.itemBenefitsFor('Artefact').some(x => x.skill === 'Archaeology')) throw new Error('Artefact Archaeology backlink missing');

const architecture = S.profile('Architecture');
if (architecture.primarySection !== '29.6' || architecture.mechanic !== 'unlock' || architecture.baseline !== 'Woodwork') throw new Error('Architecture prerequisite dossier mismatch');
if (!architecture.levelUses.some(x => x.level === 3 && x.item === 'Moulding')) throw new Error('Architecture 3 Moulding prerequisite missing');
if (!/does not publish a generic per-level production formula/.test(architecture.levelDetail)) throw new Error('Architecture source-gap treatment missing');

const alchemy = S.profile('Alchemy');
if (alchemy.primarySection !== '29.2' || alchemy.mechanic !== 'research-access') throw new Error('Alchemy research-access dossier mismatch');
if (!alchemy.levelUses.some(x => x.level === 10 && x.item === 'Greek Fire')) throw new Error('Alchemy 10 Greek Fire prerequisite missing');
if (!/Refining 3/.test(alchemy.researchEffectOverrides['Greek Fire']) || !/40 assigned people/.test(alchemy.researchEffectOverrides['Greek Fire']) || !/Catapult may use 5/.test(alchemy.researchEffectOverrides['Greek Fire'])) throw new Error('Greek Fire rule chain missing');
if (!S.itemBenefitsFor('Greek Fire').some(x => x.skill === 'Alchemy')) throw new Error('Greek Fire Alchemy backlink missing');

const apiarism = S.profile('Apiarism');
if (apiarism.primarySection !== '14.3.1' || apiarism.baseline !== 'Hunting') throw new Error('Apiarism tending dossier mismatch');
if (!/1 person tends 5 Hives/.test(apiarism.workerRule)) throw new Error('Apiarism tending workload missing');
if (!apiarism.factors.some(x => x.factor === 'Apiary capacity' && /20 Hives/.test(x.effect))) throw new Error('Apiary capacity missing');
if (!apiarism.factors.some(x => x.factor === 'Per-level base output' && /Not published/.test(x.effect))) throw new Error('Apiarism missing-mechanic disclosure absent');
if (!/24 new Hives/.test(apiarism.researchEffectOverrides['Breed New Queens'])) throw new Error('Breed New Queens effect missing');
if (!/twice the effectiveness of Herbs/.test(apiarism.researchEffectOverrides.Propolis)) throw new Error('Propolis Healing effect missing');
if (!/Group C Apiology skill/.test(apiarism.researchEffectOverrides['Apiology I, Apiology II, Apiology III'])) throw new Error('Apiology unlock missing');
if (!S.itemBenefitsFor('Propolis').some(x => x.skill === 'Apiarism')) throw new Error('Propolis Apiarism backlink missing');
if (!S.itemBenefitsFor('Propolis').some(x => x.skill === 'Healing' && /2 Herbs/.test(x.value))) throw new Error('Propolis Healing backlink missing');

const art = S.profile('Art');
if (art.primarySection !== '15.1' || art.mechanic !== 'scaling' || art.baseline !== 'Economics') throw new Error('Art Fair scaling dossier mismatch');
if (!/Participants × \(2 \+ Art\/4 \+ Economics\/4\)/.test(art.levelDetail)) throw new Error('Art Fair formula missing');
if (!/Maximum 500 participants/.test(art.workerRule)) throw new Error('Art participant cap missing');
if (!art.factors.some(x => x.factor === 'Trade limit' && /1 Fair slot/.test(x.effect))) throw new Error('Art Fair slot rule missing');
if (!/\+0.02 General Morale/.test(art.researchEffectOverrides['Spring Arts Festival Art']) || !/20 Gold/.test(art.researchEffectOverrides['Spring Arts Festival Art'])) throw new Error('Spring Arts Festival Art effect missing');
if (!/Art 6/.test(art.researchEffectOverrides['Marble Statue'])) throw new Error('Marble Statue Art requirement missing');
if (!S.itemBenefitsFor('Bronze Statue').some(x => x.skill === 'Art')) throw new Error('Bronze Statue Art backlink missing');
if (!S.itemBenefitsFor('Marble Statue').some(x => x.skill === 'Art')) throw new Error('Marble Statue Art backlink missing');

const banking = S.profile('Banking');
if (banking.primarySection !== '25' || banking.mechanic !== 'scaling' || banking.baseline !== 'Economics') throw new Error('Banking scaling dossier mismatch');
if (!/1.5% interest/.test(banking.levelDetail) || !/Banking 8 = 12%/.test(banking.levelDetail)) throw new Error('Banking interest formula missing');
if (!banking.factors.some(x => x.factor === 'Skill unlock' && /Economics 10/.test(x.effect))) throw new Error('Banking Economics 10 unlock missing');
if (!banking.factors.some(x => x.factor === 'Deposit term' && /12 months/.test(x.effect))) throw new Error('Banking fixed term missing');
if (!banking.factors.some(x => x.factor === 'Clan Bank limit' && /1 Silver \+ up to 3 other Banks/.test(x.effect))) throw new Error('Banking Clan bank limit missing');
if (!/one Silver-priced purchase per Fair/.test(banking.researchEffectOverrides['Letter of Credit'])) throw new Error('Letter of Credit effect missing');
if (!S.itemBenefitsFor('Bank').some(x => x.skill === 'Banking')) throw new Error('Bank Banking backlink missing');

const baking = S.profile('Baking');
if (baking.primarySection !== '14.4.1' || baking.mechanic !== 'capacity' || baking.baseline !== 'Forestry') throw new Error('Baking capacity/output dossier mismatch');
if (!/10 Baking workers per skill level; unlimited at level 10/.test(baking.workerRule)) throw new Error('Baking skill worker cap missing');
if (!baking.outputs.some(x => x.label === 'Bread from Grain' && /20 lb Grain.*5 Bread/.test(x.detail))) throw new Error('Baking Grain recipe missing');
if (!baking.outputs.some(x => x.label === 'Bread from Flour' && /40 Flour.*15 Bread/.test(x.detail))) throw new Error('Baking Flour recipe missing');
if (!baking.factors.some(x => x.factor === 'Oven capacity' && /10 bakers per Oven/.test(x.effect))) throw new Error('Baking Oven capacity missing');
if (!/6 Waybread from 20 Grain/.test(baking.researchEffectOverrides.Waybread)) throw new Error('Waybread Grain recipe missing');
if (!/50%/.test(baking.researchEffectOverrides.Yeast)) throw new Error('Yeast Baking bonus missing');
if (!S.itemBenefitsFor('Waybread').some(x => x.skill === 'Baking')) throw new Error('Waybread Baking backlink missing');
if (!S.itemBenefitsFor('Bakery').some(x => x.skill === 'Baking')) throw new Error('Bakery Baking backlink missing');

const source = fs.readFileSync(path.join(root, 'skill-overhaul-category-c-1.js'), 'utf8');
new Function(source);
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-category-c-1.js')) throw new Error('C1 skill data script is not loaded');
if (html.indexOf('skill-overhaul-category-c-1.js') < html.indexOf('skill-overhaul-category-b-5.js')) throw new Error('C1 data must load after Group B');
if (html.indexOf('skill-overhaul-category-c-1.js') > html.indexOf('compendium.js')) throw new Error('C1 data must load before the Compendium renderer');

console.log('Group C batch C1 checks passed: Archaeology, Architecture, Alchemy, Apiarism, Art, Banking and Baking');

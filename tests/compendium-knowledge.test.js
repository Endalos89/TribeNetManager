const assert = require('assert');
const { recipeAlternatives, enrichCompendiumCatalog } = require('../src/compendium-knowledge');

(function metalworkAlternativesRespectMandate() {
  const shovel = {
    recipeKey:'metal-shovel', name:'Shovel', primarySkill:'Metalwork', skillLevel:2, people:2, section:'13.1.21',
    inputs:[{item:'Iron',quantity:2},{item:'Coal',quantity:10}], facilities:[], conditions:[]
  };
  const variants = recipeAlternatives(shovel);
  assert(variants.some(v => v.inputs.some(i => i.item === 'Iron' && i.quantity === 2)));
  assert(variants.some(v => v.inputs.some(i => i.item === 'Bronze' && i.quantity === 2) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 8)));
  assert(variants.some(v => v.inputs.some(i => i.item === 'Brass' && i.quantity === 2) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 8)));

  const quarrels = { ...shovel, recipeKey:'metal-quarrels', name:'Quarrels x10', inputs:[{item:'Iron',quantity:1},{item:'Coal',quantity:10}] };
  const quarrelVariants = recipeAlternatives(quarrels);
  assert.strictEqual(quarrelVariants.length, 1, 'Quarrels are Iron only');
})();

(function shipBrassIsMandatoryButSheathingHasChoice() {
  const longship = {
    recipeKey:'ship-longship', name:'Longship', primarySkill:'Shipbuilding', section:'20.4',
    inputs:[{item:'Logs',quantity:150},{item:'Brass',quantity:20},{item:'Coal',quantity:100},{item:'Copper/Lead',quantity:100}], facilities:[], conditions:[]
  };
  const variants = recipeAlternatives(longship);
  assert.strictEqual(variants.length, 2, 'Copper/Lead sheathing should create two valid variants');
  assert(variants.every(v => v.inputs.some(i => i.item === 'Brass' && i.quantity === 20)), 'Brass must remain mandatory on every ship variant');
  assert(!variants.some(v => v.inputs.some(i => i.item === 'Bronze')), 'Bronze must not replace ship Brass');
})();

(function shipyardAndApiaryAlternativesAreExplicit() {
  const shipyard = {
    recipeKey:'eng-shipyard', name:'Shipyard 1', primarySkill:'Engineering', section:'20.2',
    inputs:[{item:'Logs',quantity:50},{item:'Iron',quantity:10},{item:'Coal',quantity:20}], facilities:[], conditions:[]
  };
  const variants = recipeAlternatives(shipyard);
  assert(variants.some(v => v.inputs.some(i => i.item === 'Iron' && i.quantity === 10) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 20)));
  assert(variants.some(v => v.inputs.some(i => i.item === 'Brass' && i.quantity === 10) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 15)));
  assert(variants.some(v => v.inputs.some(i => i.item === 'Bronze' && i.quantity === 10) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 15)));

  const apiary = {
    recipeKey:'eng-apiary-metal', name:'Apiary (metal)', primarySkill:'Engineering', section:'14.3.2',
    inputs:[{item:'Logs',quantity:100},{item:'Iron',quantity:20},{item:'Coal',quantity:100},{item:'Cloth/Leather',quantity:2}], facilities:[], conditions:[]
  };
  const apiaryVariants = recipeAlternatives(apiary);
  assert(apiaryVariants.some(v => v.inputs.some(i => i.item === 'Leather' && i.quantity === 20)), 'Leather alternative is 20 Leather, not 2');
  assert(apiaryVariants.some(v => v.inputs.some(i => i.item === 'Brass' && i.quantity === 30) && v.inputs.some(i => i.item === 'Coal' && i.quantity === 75)));
})();

(function linkedEntitiesExplainSourcesAndUses() {
  const leatherRecipes = [
    { recipeKey:'cure', name:'Cure Leather', primarySkill:'Curing', skillLevel:1, people:1, section:'13.1.5', outputItem:'Leather', outputQuantity:2, inputs:[{item:'Skins',quantity:2}], facilities:[], conditions:[], requirements:[] },
    { recipeKey:'dress', name:'Dress Leather', primarySkill:'Dressing', skillLevel:1, people:1, section:'13.1.6', outputItem:'Leather', outputQuantity:4, inputs:[{item:'Skins',quantity:4}], facilities:[], conditions:[], requirements:[] },
    { recipeKey:'tan', name:'Tan Leather', primarySkill:'Tanning', skillLevel:1, people:1, section:'13.1.33', outputItem:'Leather', outputQuantity:4, inputs:[{item:'Skins',quantity:4}], facilities:[], conditions:[], requirements:[] },
    { recipeKey:'charcoal', name:'Make Charcoal', primarySkill:'Forestry', skillLevel:5, people:1, section:'14.6.1', outputItem:'Charcoal', outputQuantity:10, inputs:[{item:'Logs',quantity:2}], facilities:['Charhouse'], conditions:[], requirements:[] },
    { recipeKey:'charhouse', name:'Charhouse', primarySkill:'Engineering', skillLevel:5, people:50, section:'14.6.2', outputItem:'Charhouse', outputQuantity:1, inputs:[{item:'Logs',quantity:100}], facilities:[], conditions:[], requirements:[] },
    { recipeKey:'sling', name:'Sling', primarySkill:'Leatherwork', skillLevel:2, people:1, section:'13.1.18', outputItem:'Sling', outputQuantity:1, inputs:[{item:'Leather',quantity:1}], facilities:[], conditions:[], requirements:[] }
  ];
  const catalog = { skills: leatherRecipes.map((r,i)=>({name:r.primarySkill,recipes:[r]})), topics:[] };
  const enriched = enrichCompendiumCatalog(catalog);
  const leather = enriched.entities.find(e => e.key === 'LEATHER');
  assert.strictEqual(leather.producers.length, 3, 'Leather should show all three indexed production methods');
  assert(leather.consumers.some(row => row.name === 'Sling'));
  const charhouse = enriched.entities.find(e => e.key === 'CHARHOUSE');
  assert(charhouse.producers.some(row => row.skill === 'Engineering'));
  assert(charhouse.consumers.some(row => row.name === 'Make Charcoal' && row.role === 'facility'));
  const sling = enriched.entities.find(e => e.key === 'SLING');
  assert(sling.uses.some(use => use.skill === 'Hunting'), 'Sling should cross-link to Hunting');
})();

console.log('Compendium knowledge regression tests passed.');

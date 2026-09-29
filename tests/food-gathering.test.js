const assert=require('assert');
const calc=require('../src/food-gathering.js');

assert.strictEqual(calc.seasonLabel(3),'Spring (1-3)');
assert.strictEqual(calc.seasonLabel(4),'Summer (4-6)');

// Known real-world reference supplied by the user:
// Month 03, Temperate context, Fine weather, Prairie, no water border,
// 20,257 people, Hunting 3 => 52,668 provisions.
assert.strictEqual(calc.calculateHuntingYield({people:20257,skill:3,terrain:'PR',month:3,weatherFactor:1,waterBorders:0}),52668);

// Reproduce the supplied Fishing workbook examples.
assert.strictEqual(calc.calculateFishingYield({model:'TN 3.0',skill:3,weatherFactor:1,people:22,nets:222}),83);
const eff=calc.fishingEffectiveYield('TN 3.0',3,1);
assert.ok(Math.abs(eff-2.53)<1e-9);
assert.strictEqual(calc.fishingAmToFeed({eaters:75,nets:10,effectiveYield:eff}),25);
assert.strictEqual(calc.fishingAmToSupportWorkers({otherWorkers:80,nets:10,effectiveYield:eff}),45);

const scenarios=calc.scenarioRows({...calc.DEFAULTS,people:20257,huntingSkill:3,terrain:'PR',month:3,waterBorders:0,fishingSkill:3,nets:0});
assert.strictEqual(scenarios.find(row=>row.key==='fine').hunting,52668);
assert.strictEqual(scenarios.length,6);
console.log('Food gathering calculator tests passed.');

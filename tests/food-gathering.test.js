const assert=require('assert');
const fs=require('fs');
const path=require('path');
const calc=require('../src/food-gathering.js');
const fishing=require('../src/fishing-enhancements.js');

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

// Fishing skill lists non-vessel implements only.
assert.strictEqual(fishing.FISHING_IMPLEMENTS.length,2);
assert.deepStrictEqual(fishing.FISHING_IMPLEMENTS.map(row=>row.name),['Net','Trawling Nets']);
const net=fishing.FISHING_IMPLEMENTS.find(row=>row.name==='Net');
assert.ok(net,'Net must be listed as a Fishing implement');
assert.strictEqual(net.output,'PROVS');
assert.strictEqual(net.bonus,'+0.5 AM');
const trawlingNets=fishing.FISHING_IMPLEMENTS.find(row=>row.name==='Trawling Nets');
assert.strictEqual(trawlingNets.output,'PROVS');
assert.strictEqual(trawlingNets.bonus,'Unknown');
const vesselNames=['Boat','Coaster','Fisher','Large Galley','Longship','Medium Galley','Merchant','Small Galley','Trader','Trawler','Warship'];
for(const vessel of vesselNames){
  assert.ok(!fishing.FISHING_IMPLEMENTS.some(row=>row.name===vessel),`${vessel} must not be treated as a Fishing implement`);
}

// One support target replaces the two legacy workforce-planning inputs.
assert.strictEqual(fishing.supportTargetFromLegacy({otherWorkers:80,eaters:75}),80);
assert.strictEqual(fishing.supportTargetFromLegacy({eaters:75}),75);
assert.strictEqual(fishing.supportTargetFromLegacy({supportTarget:120,otherWorkers:80}),120);

const enhancementSource=fs.readFileSync(path.join(__dirname,'..','src','fishing-enhancements.js'),'utf8');
assert.ok(enhancementSource.includes('People / AM to support'));
assert.ok(enhancementSource.includes('Fishing AM required to support'));
assert.ok(enhancementSource.includes('Fishing implements'));
assert.ok(enhancementSource.includes('Boats and vessels are not included as Fishing modifiers.'));
assert.ok(!enhancementSource.includes('id="fgEaters"'));
assert.ok(!enhancementSource.includes('id="fgOtherWorkers"'));

const html=fs.readFileSync(path.join(__dirname,'..','src','compendium.html'),'utf8');
assert.ok(html.includes('fishing-enhancements.js'),'Compendium must load Fishing enhancements');
assert.ok(html.indexOf('fishing-enhancements.js')>html.indexOf('food-gathering.js'),'Fishing enhancements must load after Food Gathering');

console.log('Food gathering calculator tests passed.');

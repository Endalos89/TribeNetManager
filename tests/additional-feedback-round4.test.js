const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const preload = src('preload.js');
const cleanup = src('compendium-round4-cleanup.js');
const mapper = src('mapper-food-gathering.js');
const itemKnowledge = require('../src/item-knowledge.js');

assert.doesNotThrow(() => new Function(cleanup), 'Compendium round 4 cleanup should parse');
assert.doesNotThrow(() => new Function(mapper), 'Mapper Food Gathering integration should parse');

assert.match(preload, /compendium-round4-cleanup\.js/, 'Compendium cleanup should load on the Compendium page');
assert.match(preload, /mapper-food-gathering\.js/, 'Mapper Food Gathering should load on the Mapper page');
assert.doesNotMatch(preload, /require\(['"]fs['"]\)/, 'round 4 changes must not reintroduce fs into sandboxed preload');
assert.doesNotMatch(preload, /require\(['"]path['"]\)/, 'round 4 changes must not reintroduce path into sandboxed preload');

assert.strictEqual(itemKnowledge.key('Absinth'), itemKnowledge.key('Absinthe'), 'Absinth and Absinthe must resolve to one item identity');
assert.strictEqual(itemKnowledge.key('Absinth'), 'ABSINTHE');

assert.match(cleanup, /iconOnlyGhost/, 'icon catalogue entries must not automatically become item entities');
assert.match(cleanup, /skillKeys\.has\(key\)/, 'skill names should be excluded from icon-only item ghosts');
assert.match(cleanup, /AMPHITHEATRE/, 'Amphitheatre should be classified as a building/facility');
assert.match(cleanup, /removeDemandFromOverview/, 'item overview should remove Fair demand from the summary row');
assert.match(cleanup, /Astronomy is retained as a Group C skill/, 'Astronomy should explain its Valid Skills / Research evidence');
assert.match(cleanup, /latestFairEntry/, 'item details should select one current Fair source');
assert.match(cleanup, /comp-price-summary/, 'legacy price summary should be removed from item and ship details');
assert.match(cleanup, /data\.round4FairBuy|round4FairBuy/, 'Fair buying should be represented once in acquisition details');
assert.match(cleanup, /round4FairSale/, 'Fair selling should be represented in the uses table');

assert.match(mapper, /MovementPlannerCore/, 'Food Gathering should inspect known neighbouring Mapper hexes');
assert.match(mapper, /optimalHuntingEquipment/, 'Mapper estimates should choose optimal owned Hunting implements');
assert.match(mapper, /skillLevel\(unit,'Hunting'\)/, 'Mapper estimates should inherit Hunting skill from the chosen unit');
assert.match(mapper, /skillLevel\(unit,'Fishing'\)/, 'Mapper estimates should inherit Fishing skill from the chosen unit');
assert.match(mapper, /WEATHER/, 'Mapper estimates should calculate a weather range');
assert.match(mapper, /No known adjacent water/, 'Mapper should expose known water access state');
assert.match(mapper, /Fishing is unavailable because no known adjacent Lake, Ocean or water\/river note is present/, 'Fishing must be gated by known water access');
assert.match(mapper, /Actives not reported/, 'Mapper must not invent a workforce when Actives are unavailable');
assert.match(mapper, /Assumption based/, 'Mapper Food Gathering should retain the calculator uncertainty label');

console.log('round 4 additional feedback regression tests passed');

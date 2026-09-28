const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
require('../src/fair-price-data.js');
const prices = global.window.TribeNetFairPriceBenchmark;

assert(prices, 'Fair price benchmark should load');
assert.strictEqual(prices.source.year, 903);
assert.strictEqual(prices.source.marketSheet, 'Exchange List');
assert.strictEqual(prices.rows.length, 171, 'All priced rows from the workbook should be stored');
assert.strictEqual(prices.lookup('Leather').basePrice, 17);
assert.strictEqual(prices.lookup('Logs').basePrice, 4);
assert.strictEqual(prices.lookup('Stones').basePrice, 4);
assert.strictEqual(prices.lookup('Saddlebags').basePrice, 127);
assert.strictEqual(prices.lookup('Ring Mail').basePrice, 228);

const clubs = prices.lookup('Club');
assert.strictEqual(clubs.marketBuyPrice, 4);
assert.strictEqual(clubs.marketBuyQuantity, 398);
assert.strictEqual(clubs.marketDemandSilver, 1592);
assert.strictEqual(clubs.marketDemandSilver, clubs.marketBuyPrice * clubs.marketBuyQuantity);
const gold = prices.lookup('Gold');
assert.strictEqual(gold.marketBuyQuantity, 63);
assert.strictEqual(gold.marketDemandSilver, 27846);
assert.strictEqual(prices.lookup('Bronze Statue').researchOnly, true);

const leatherSling = prices.evaluateRecipe({
  outputItem:'Sling', outputQuantity:1,
  alternatives:[{label:'Standard',inputs:[{item:'Leather',quantity:1}]}]
});
assert.strictEqual(leatherSling.variants[0].outputValue, 9);
assert.strictEqual(leatherSling.variants[0].inputValue, 17);
assert(Math.abs(leatherSling.variants[0].uplift - (-47.0588235294)) < 0.001);

const wovenSlings = prices.evaluateRecipe({
  outputItem:'Sling', outputQuantity:2,
  alternatives:[{label:'Standard',inputs:[{item:'Cotton',quantity:1},{item:'Gut',quantity:1}]}]
});
assert.strictEqual(wovenSlings.variants[0].outputValue, 18);
assert.strictEqual(wovenSlings.variants[0].inputValue, 4);
assert.strictEqual(wovenSlings.variants[0].uplift, 350);

const incomplete = prices.evaluateRecipe({
  outputItem:'Sling', outputQuantity:1,
  alternatives:[{label:'Unknown ingredient',inputs:[{item:'Not Priced',quantity:1}]}]
});
assert.strictEqual(incomplete.variants[0].inputValue, null);
assert.deepStrictEqual(incomplete.variants[0].missingInputs, ['Not Priced']);
assert.strictEqual(incomplete.variants[0].uplift, null, 'Missing inputs must not be silently valued at zero');

const missing = prices.evaluateRecipe({
  outputItem:'Longship', outputQuantity:1,
  alternatives:[{label:'Standard',inputs:[{item:'Logs',quantity:150},{item:'Brass',quantity:20}]}]
});
assert.strictEqual(missing.output, null, 'Do not invent a benchmark for items absent from the workbook');
assert.strictEqual(missing.variants[0].outputValue, null);

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'compendium.html'), 'utf8');
const pricing = fs.readFileSync(path.join(__dirname, '..', 'src', 'compendium-pricing.js'), 'utf8');
assert.match(html, /fair-price-data\.js/);
assert.match(html, /compendium-pricing\.js/);
assert.match(html, /compendium-pricing\.css/);
assert.match(pricing, /Quantity demand/);
assert.match(pricing, /Total silver demand/);
assert.match(pricing, /marketDemandSilver/);

console.log('Fair price benchmark and market-demand regression tests passed.');

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
const batch4Loader = fs.readFileSync(path.join(root, 'compendium-mandate-batch4-loader.js'), 'utf8');
const batch4Integration = fs.readFileSync(path.join(root, 'compendium-mandate-batch4.js'), 'utf8');

const scripts = [
  'mandate-reference-schema.js',
  'mandate-reference-batch-1-01.js',
  'mandate-reference-batch-1-02.js',
  'mandate-reference-batch-1-03.js',
  'mandate-reference-batch-1-04.js',
  'mandate-reference-batch-2-01.js',
  'mandate-reference-batch-2-02.js',
  'mandate-reference-batch-2-03.js',
  'mandate-reference-batch-3-01.js',
  'mandate-reference-batch-3-02.js',
  'mandate-reference-batch-3-03.js',
  'mandate-reference-batch-3-04.js',
  'compendium-mandate.js',
  'compendium-mandate-batch4-loader.js'
];
for (const name of scripts) {
  if (!html.includes(`<script src="${name}"></script>`)) throw new Error(`compendium.html missing ${name}`);
}
if (!html.includes('<link rel="stylesheet" href="compendium-mandate.css" />')) throw new Error('compendium.html missing Mandate stylesheet');
if (html.indexOf('mandate-reference-schema.js') > html.indexOf('compendium.js')) throw new Error('Mandate data must load before base Compendium');
if (html.indexOf('mandate-reference-batch-3-04.js') > html.indexOf('compendium.js')) throw new Error('Batch 3 Mandate data must load before base Compendium');
if (html.indexOf('compendium-mandate.js') < html.indexOf('compendium-research-v2-skill-notes.js')) throw new Error('Mandate integration must load after Compendium extensions');
if (html.indexOf('compendium-mandate-batch4-loader.js') < html.indexOf('compendium-mandate.js')) throw new Error('Batch 4 loader must run after the core Mandate integration');

if (!js.includes("{id:'5'")) throw new Error('Five-batch migration plan missing');
if (!js.includes("{id:'3',title:'Trade, scouting & combat',range:'§§15–19',pages:'90–133',complete:true}")) throw new Error('Batch 3 completion state missing');

for (let i = 1; i <= 8; i++) {
  const name = `mandate-reference-batch-4-${String(i).padStart(2, '0')}.js`;
  if (!batch4Loader.includes(name)) throw new Error(`Batch 4 loader missing ${name}`);
}
if (!batch4Loader.includes('compendium-mandate-batch4.js')) throw new Error('Batch 4 UI integration is not loaded');
for (const marker of ['4 of 5 batches complete · 80%', 'Naval & advanced systems', 'showBatch4', 'patchHome', 'patchNav']) {
  if (!batch4Integration.includes(marker)) throw new Error(`Batch 4 UI integration missing marker: ${marker}`);
}

new Function(batch4Loader);
new Function(batch4Integration);

console.log('Compendium Mandate wiring checks passed through Batch 4');

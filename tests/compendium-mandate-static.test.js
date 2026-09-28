const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');

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
  'compendium-mandate.js'
];
for (const name of scripts) {
  if (!html.includes(`<script src="${name}"></script>`)) throw new Error(`compendium.html missing ${name}`);
}
if (!html.includes('<link rel="stylesheet" href="compendium-mandate.css" />')) throw new Error('compendium.html missing Mandate stylesheet');
if (html.indexOf('mandate-reference-schema.js') > html.indexOf('compendium.js')) throw new Error('Mandate data must load before base Compendium');
if (html.indexOf('mandate-reference-batch-3-04.js') > html.indexOf('compendium.js')) throw new Error('Batch 3 Mandate data must load before base Compendium');
if (html.indexOf('compendium-mandate.js') < html.indexOf('compendium-research-v2-skill-notes.js')) throw new Error('Mandate integration must load after Compendium extensions');
if (!js.includes("{id:'5'")) throw new Error('Five-batch migration plan missing');
if (!js.includes("{id:'2',title:'Activities & villages',range:'§§13–14',pages:'54–89',complete:true}")) throw new Error('Batch 2 completion state missing');
if (!js.includes("{id:'3',title:'Trade, scouting & combat',range:'§§15–19',pages:'90–133',complete:true}")) throw new Error('Batch 3 completion state missing');
if (!js.includes("{id:'4',title:'Naval & advanced systems'")) throw new Error('Later pending batches missing');

console.log('Compendium Mandate wiring checks passed through Batch 3');

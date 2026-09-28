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
  'compendium-mandate.js'
];
for (const name of scripts) {
  if (!html.includes(`<script src="${name}"></script>`)) throw new Error(`compendium.html missing ${name}`);
}
if (!html.includes('<link rel="stylesheet" href="compendium-mandate.css" />')) throw new Error('compendium.html missing Mandate stylesheet');
if (html.indexOf('mandate-reference-schema.js') > html.indexOf('compendium.js')) throw new Error('Mandate data must load before base Compendium');
if (html.indexOf('compendium-mandate.js') < html.indexOf('compendium-research-v2-skill-notes.js')) throw new Error('Mandate integration must load after Compendium extensions');
if (!js.includes("{id:'5'")) throw new Error('Five-batch migration plan missing');
if (!js.includes("complete:true") || !js.includes("complete:false")) throw new Error('Batch progress state missing');

console.log('Compendium Mandate wiring checks passed');

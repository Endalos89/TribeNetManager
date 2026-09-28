const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'compendium-mandate.css'), 'utf8');

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
  'mandate-reference-batch-4-01.js',
  'mandate-reference-batch-4-02.js',
  'mandate-reference-batch-4-03.js',
  'mandate-reference-batch-4-04.js',
  'mandate-reference-batch-4-05.js',
  'mandate-reference-batch-4-06.js',
  'mandate-reference-batch-4-07.js',
  'mandate-reference-batch-4-08.js',
  'mandate-reference-batch-5-01.js',
  'mandate-reference-batch-5-02.js',
  'mandate-reference-batch-5-03.js',
  'compendium-mandate.js'
];
for (const name of scripts) {
  if (!html.includes(`<script src="${name}"></script>`)) throw new Error(`compendium.html missing ${name}`);
}

for (const obsolete of ['compendium-mandate-batch4-loader.js', 'compendium-mandate-batch5-loader.js', 'compendium-mandate-contrast.css']) {
  if (html.includes(obsolete)) throw new Error(`Obsolete migration asset is still wired into compendium.html: ${obsolete}`);
}

if (!html.includes('<link rel="stylesheet" href="compendium-mandate.css" />')) throw new Error('compendium.html missing Mandate reader stylesheet');
if (html.indexOf('mandate-reference-schema.js') > html.indexOf('compendium.js')) throw new Error('Mandate schema must load before base Compendium');
if (html.indexOf('mandate-reference-batch-5-03.js') > html.indexOf('compendium.js')) throw new Error('All Mandate data must load before base Compendium');
if (html.indexOf('compendium-mandate.js') < html.indexOf('compendium-research-v2-skill-notes.js')) throw new Error('Mandate reader must load after Compendium extensions');

for (const marker of [
  'showMandateReader',
  'renderToc',
  'renderDocumentSection',
  'data-view="mandate-reader"',
  'data-mandate-doc-link',
  'navigateMandate',
  'IntersectionObserver',
  'scrollIntoView',
  'Mandate coverage'
]) {
  if (!js.includes(marker)) throw new Error(`Mandate reader integration missing marker: ${marker}`);
}

for (const obsolete of ['Migration progress', 'mandateReferenceModal', 'showMandateBatch', 'Exact reference']) {
  if (js.includes(obsolete)) throw new Error(`Obsolete migration/reference UI remains in Compendium integration: ${obsolete}`);
}

for (const marker of [
  '.mandate-reader-layout',
  '.mandate-reader-toc',
  '.mandate-toc-sticky',
  '.mandate-document',
  '.mandate-inline-reference',
  '.mandate-doc-section'
]) {
  if (!css.includes(marker)) throw new Error(`Mandate reader stylesheet missing marker: ${marker}`);
}

new Function(js);
console.log('Compendium Mandate wiring checks passed for the continuous document reader');
require('./mandate-document-reader.test.js');
require('./skill-overhaul-hunting.test.js');

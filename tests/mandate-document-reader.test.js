const fs = require('fs');
const vm = require('vm');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..', 'src');
  const context = {
    window: {}, atob, Blob, DecompressionStream, Response, Uint8Array,
    Map, Set, Promise, JSON, String, Number, Object, RegExp
  };
  vm.createContext(context);
  const run = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });

  run('mandate-reference-schema.js');
  for (let i = 1; i <= 4; i++) run(`mandate-reference-batch-1-${String(i).padStart(2, '0')}.js`);
  for (let i = 1; i <= 3; i++) run(`mandate-reference-batch-2-${String(i).padStart(2, '0')}.js`);
  for (let i = 1; i <= 4; i++) run(`mandate-reference-batch-3-${String(i).padStart(2, '0')}.js`);
  for (let i = 1; i <= 8; i++) run(`mandate-reference-batch-4-${String(i).padStart(2, '0')}.js`);
  for (let i = 1; i <= 3; i++) run(`mandate-reference-batch-5-${String(i).padStart(2, '0')}.js`);

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.sections.length !== 408) throw new Error(`Expected 408 Mandate sections, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 5) throw new Error(`Expected five Mandate data batches, got ${mandate.batches.length}`);
  for (const id of ['1', '12.2', '13.4', '20.5.1', '28', '35', 'Appendix A']) {
    if (!mandate.getSection(id)) throw new Error(`Missing complete Mandate section ${id}`);
  }

  const sample = 'See section 13.4 and section 20.5.1. Appendix A contains the change history. Page 20 is not a section reference.';
  const refs = mandate.findInlineReferences(sample).map(ref => ref.section);
  for (const id of ['13.4', '20.5.1', 'Appendix A']) {
    if (!refs.includes(id)) throw new Error(`Inline Mandate reference resolver missed ${id}`);
  }
  if (refs.filter(id => id === '20').length) throw new Error('Page number was incorrectly converted into a Mandate section link');
  if (mandate.anchorId('Appendix A') !== 'mandate-section-Appendix-A') throw new Error('Appendix anchor ID is unstable');

  const reader = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
  for (const marker of [
    "data-view=\"mandate-reader\"",
    'mandate-reader-layout',
    'mandate-reader-toc',
    'data-mandate-doc-link',
    'scrollIntoView',
    'IntersectionObserver',
    'M.sections.map(renderDocumentSection)',
    'These links open the full Mandate at the relevant section.'
  ]) {
    if (!reader.includes(marker)) throw new Error(`Mandate document reader missing marker: ${marker}`);
  }
  for (const obsolete of ['mandateReferenceModal', 'Exact reference', 'Migration progress', 'showMandateBatch']) {
    if (reader.includes(obsolete)) throw new Error(`Obsolete migration/reference UI remains in reader: ${obsolete}`);
  }

  console.log('Mandate document reader checks passed: 408 sections, 5 batches, inline cross-references enabled');
}

main().catch(error => { console.error(error); process.exit(1); });

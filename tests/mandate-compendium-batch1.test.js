const fs = require('fs');
const vm = require('vm');
const path = require('path');

async function main() {
  const root = process.argv[2] || path.join(__dirname, '..', 'src');
  const context = {
    window: {}, atob, Blob, DecompressionStream, Response, Uint8Array,
    Map, Set, Promise, JSON, String, Number, Object
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'mandate-reference-schema.js'), 'utf8'), context, { filename: 'mandate-reference-schema.js' });
  for (let i = 1; i <= 4; i++) {
    const name = `mandate-reference-batch-1-${String(i).padStart(2, '0')}.js`;
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.revision !== 'N02.2') throw new Error(`Unexpected revision ${mandate.revision}`);
  if (mandate.sections.length !== 119) throw new Error(`Expected 119 Batch 1 sections, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 1 || mandate.batches[0].id !== '1') throw new Error('Expected exactly logical Batch 1 to be loaded');
  if (mandate.batches[0].topSections.join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12') throw new Error('Batch 1 top-level range is wrong');

  for (const key of ['1','3.15','4.3','6.1','8.7.5','9.3.1','10.5','11.1.1','12.2','12.3.1']) {
    if (!mandate.getSection(key)) throw new Error(`Missing Batch 1 section ${key}`);
  }
  if (mandate.getSection('13')) throw new Error('Batch 2 content leaked into Batch 1');

  if (!mandate.plainText(mandate.getSection('4.3')).includes('18 turns')) throw new Error('New-start protection wording missing from exact reference');
  if (!mandate.plainText(mandate.getSection('6.1')).includes('Transfers Before Movement')) throw new Error('Turn sequence wording missing');
  if (!mandate.plainText(mandate.getSection('8.7.5')).includes('Admin 10')) throw new Error('Element/Fleet limits missing');
  if (!mandate.plainText(mandate.getSection('12.2')).includes('Group A')) throw new Error('Skill groups table missing');

  const extension = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
  for (const marker of [
    'showMandateReader',
    'renderToc',
    'data-view="mandate-reader"',
    'data-mandate-doc-link',
    'M.sections.map(renderDocumentSection)',
    "DANCE: ['dance', 'dancing']"
  ]) {
    if (!extension.includes(marker)) throw new Error(`Compendium Mandate reader missing marker: ${marker}`);
  }
  for (const obsolete of ['mandateReferenceModal', 'Word-for-word Mandate reference', 'Completed Mandate outline']) {
    if (extension.includes(obsolete)) throw new Error(`Obsolete reference UI remains: ${obsolete}`);
  }

  console.log('Mandate Batch 1 checks passed:', mandate.sections.length, 'sections; source data remains isolated and reader wiring is current');
}

main().catch(error => { console.error(error); process.exit(1); });

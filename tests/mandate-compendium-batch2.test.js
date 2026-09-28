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
  for (let i = 1; i <= 3; i++) {
    const name = `mandate-reference-batch-2-${String(i).padStart(2, '0')}.js`;
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.revision !== 'N02.2') throw new Error(`Unexpected revision ${mandate.revision}`);
  if (mandate.sections.length !== 206) throw new Error(`Expected 206 sections after Batch 2, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 2) throw new Error(`Expected two logical batches, got ${mandate.batches.length}`);

  const batch2 = mandate.batches.find(batch => batch.id === '2');
  if (!batch2) throw new Error('Batch 2 metadata missing');
  if (batch2.sectionCount !== 87) throw new Error(`Expected 87 Batch 2 sections, got ${batch2.sectionCount}`);
  if (batch2.topSections.join(',') !== '13,14') throw new Error(`Batch 2 top-level range is wrong: ${batch2.topSections.join(',')}`);

  for (const key of ['13','13.1','13.1.6','13.1.9','13.1.22','13.2','14','14.1.1','14.6','14.10','14.15.2']) {
    if (!mandate.getSection(key)) throw new Error(`Missing Batch 2 section ${key}`);
  }
  if (mandate.getSection('15')) throw new Error('Batch 3 content leaked into Batch 2');

  const forestry = mandate.plainText(mandate.getSection('13.1.9'));
  if (!forestry.includes('Logs may not be used in the turn of acquisition')) throw new Error('Forestry timing rule missing');
  if (!forestry.includes('Charcoal making')) throw new Error('Forestry charcoal cross-use missing');

  const mining = mandate.plainText(mandate.getSection('13.1.22'));
  if (!mining.includes('Pick OR shovel OR Mattock')) throw new Error('Mining tool rule missing');

  const auxiliaries = mandate.plainText(mandate.getSection('13.2'));
  if (!auxiliaries.includes('Mining Ladder')) throw new Error('Uncoded-tool auxiliary example missing');

  const ferrying = mandate.plainText(mandate.getSection('14.10'));
  if (!ferrying.includes('Barges have 30 MP + 2 x Row skill')) throw new Error('Barge movement rule missing');

  const jointResearch = mandate.plainText(mandate.getSection('14.15.2'));
  if (!jointResearch.includes('do not need to have the research')) throw new Error('Joint research-project rule missing');

  if (mandate.getSection('13').page !== 54) throw new Error(`Section 13 page mismatch: ${mandate.getSection('13').page}`);
  if (mandate.getSection('14.15.2').page !== 89) throw new Error(`Section 14.15.2 page mismatch: ${mandate.getSection('14.15.2').page}`);

  const extension = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
  for (const marker of [
    "{id:'2',title:'Activities & villages',range:'§§13–14',pages:'54–89',complete:true}",
    'skillRelatedEntities',
    'Mandate-linked tools, goods & structures',
    'Completed Mandate outline',
    'Mandate sections · completed batches'
  ]) {
    if (!extension.includes(marker)) throw new Error(`Batch 2 Compendium integration missing marker: ${marker}`);
  }

  console.log('Mandate Batch 2 checks passed:', batch2.sectionCount, 'new sections;', mandate.sections.length, 'total; migration progress 2/5');
}

main().catch(error => { console.error(error); process.exit(1); });

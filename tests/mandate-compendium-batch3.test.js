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
  for (let i = 1; i <= 4; i++) {
    const name = `mandate-reference-batch-3-${String(i).padStart(2, '0')}.js`;
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }
  for (let i = 1; i <= 8; i++) {
    const name = `mandate-reference-batch-4-${String(i).padStart(2, '0')}.js`;
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.revision !== 'N02.2') throw new Error(`Unexpected revision ${mandate.revision}`);
  if (mandate.sections.length !== 353) throw new Error(`Expected 353 sections after Batch 4, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 4) throw new Error(`Expected four logical batches, got ${mandate.batches.length}`);

  const batch3 = mandate.batches.find(batch => batch.id === '3');
  if (!batch3 || batch3.sectionCount !== 78) throw new Error('Batch 3 regression metadata missing');
  if (batch3.topSections.join(',') !== '15,16,17,18,19') throw new Error(`Batch 3 top-level range is wrong: ${batch3.topSections.join(',')}`);

  const batch4 = mandate.batches.find(batch => batch.id === '4');
  if (!batch4) throw new Error('Batch 4 metadata missing');
  if (batch4.sectionCount !== 69) throw new Error(`Expected 69 Batch 4 sections, got ${batch4.sectionCount}`);
  if (batch4.topSections.join(',') !== '20,21,22,23,24,25,26,27') throw new Error(`Batch 4 top-level range is wrong: ${batch4.topSections.join(',')}`);

  for (const key of ['20','20.4','20.5.1','21','21.2','21.3.7','22','22.2','23','23.1','23.4.1','24','24.1','25','26','27','27.8','27.10.7','27.15']) {
    if (!mandate.getSection(key)) throw new Error(`Missing Batch 4 section ${key}`);
  }
  if (mandate.getSection('28')) throw new Error('Batch 5 content leaked into Batch 4');

  if (mandate.getSection('20.5.1').title !== 'Catapults and Naval Cannon') throw new Error('Body heading title for §20.5.1 was not preserved');
  if (!mandate.plainText(mandate.getSection('20.4')).includes('Ships may only be built in the hex with the building facilities present')) throw new Error('Shipbuilding location rule missing');
  if (!mandate.plainText(mandate.getSection('21.3.7')).includes('follow Ocean')) throw new Error('Fleet movement coastline rule missing');
  if (!mandate.plainText(mandate.getSection('23.1')).includes('Only one Book may be attempted per turn per Clan')) throw new Error('Book writing limit missing');
  if (!mandate.plainText(mandate.getSection('26')).includes('Only one archaeology tribe per Clan is allowed')) throw new Error('Archaeology tribe limit missing');
  if (!mandate.plainText(mandate.getSection('27.15')).includes('Religion is dynamic and not totally in their control')) throw new Error('Religion final-note wording missing');

  if (mandate.getSection('20').page !== 134) throw new Error(`Section 20 page mismatch: ${mandate.getSection('20').page}`);
  if (mandate.getSection('27.15').page !== 165) throw new Error(`Section 27.15 page mismatch: ${mandate.getSection('27.15').page}`);

  const integration = fs.readFileSync(path.join(root, 'compendium-mandate-batch4.js'), 'utf8');
  for (const marker of [
    '4 of 5 batches complete · 80%',
    'Naval & advanced systems',
    'data-b4-ref',
    "data-mandate-batch=\"4\"",
    '§§20–27 · pages 134–165'
  ]) {
    if (!integration.includes(marker)) throw new Error(`Batch 4 Compendium integration missing marker: ${marker}`);
  }

  console.log('Mandate Batch 4 checks passed:', batch4.sectionCount, 'new sections;', mandate.sections.length, 'total; migration progress 4/5');
}

main().catch(error => { console.error(error); process.exit(1); });

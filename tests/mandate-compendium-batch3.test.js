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

  const chunksByBatch = {1:4, 2:3, 3:4, 4:8, 5:3};
  for (const [batchId, count] of Object.entries(chunksByBatch)) {
    for (let i = 1; i <= count; i++) {
      const name = `mandate-reference-batch-${batchId}-${String(i).padStart(2, '0')}.js`;
      vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
    }
  }

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.revision !== 'N02.2') throw new Error(`Unexpected revision ${mandate.revision}`);
  if (mandate.sections.length !== 408) throw new Error(`Expected the full 408-section Mandate index, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 5) throw new Error(`Expected five logical batches, got ${mandate.batches.length}`);

  const expectedCounts = {'1':119,'2':87,'3':78,'4':69,'5':55};
  for (const [id, expected] of Object.entries(expectedCounts)) {
    const batch = mandate.batches.find(item => item.id === id);
    if (!batch) throw new Error(`Batch ${id} metadata missing`);
    if (batch.sectionCount !== expected) throw new Error(`Expected ${expected} sections in Batch ${id}, got ${batch.sectionCount}`);
  }

  const batch5 = mandate.batches.find(batch => batch.id === '5');
  const expectedTop = '28,29,30,31,32,33,34,35,Appendix A';
  if (batch5.topSections.join(',') !== expectedTop) throw new Error(`Batch 5 top-level range is wrong: ${batch5.topSections.join(',')}`);

  for (const key of [
    '28','29','29.1','29.14','29.25','29.39',
    '30','30.1','30.2','31','31.1','32',
    '33','33.1','33.2','33.3','34','34.1','35','Appendix A'
  ]) {
    if (!mandate.getSection(key)) throw new Error(`Missing Batch 5 section ${key}`);
  }

  const expectedTopLevel = Array.from({length:35}, (_, i) => String(i + 1)).concat('Appendix A');
  for (const key of expectedTopLevel) {
    if (!mandate.getSection(key)) throw new Error(`Final Mandate audit missing top-level section ${key}`);
  }

  if (!mandate.plainText(mandate.getSection('28')).includes('organic growth of the TribeNet world')) throw new Error('International NPC wording missing');
  if (!mandate.plainText(mandate.getSection('29.14')).includes('Group C Fair skill')) throw new Error('Dance skill cross-reference wording missing');
  if (!mandate.plainText(mandate.getSection('29.25')).includes('See section 20 Ship Construction')) throw new Error('Maintain Boats cross-reference wording missing');
  if (!mandate.plainText(mandate.getSection('31.1')).includes('General Usage')) throw new Error('Transfer Codes wording missing');
  if (!mandate.plainText(mandate.getSection('34.1')).includes('distinguish rhetoric, truth and lies')) throw new Error('Rumours ethics wording missing');
  if (!mandate.plainText(mandate.getSection('35')).includes('rules as written cannot cover every game contingency')) throw new Error('Final Word wording missing');

  const appendix = mandate.getSection('Appendix A');
  if (appendix.title !== 'Change History') throw new Error('Appendix A title mismatch');
  if (!mandate.plainText(appendix).includes('13/07/2026')) throw new Error('N02.2 change-history row missing');
  if (!mandate.plainText(appendix).includes('Update revision of Mandate to N02.2')) throw new Error('N02.2 change-history detail missing');

  if (mandate.getSection('28').page !== 165) throw new Error(`Section 28 page mismatch: ${mandate.getSection('28').page}`);
  if (mandate.getSection('35').page !== 177) throw new Error(`Section 35 page mismatch: ${mandate.getSection('35').page}`);
  if (appendix.page !== 178) throw new Error(`Appendix A page mismatch: ${appendix.page}`);

  const integration = fs.readFileSync(path.join(root, 'compendium-mandate-batch5.js'), 'utf8');
  for (const marker of [
    '5 of 5 batches complete · 100%',
    'Remaining references & final audit',
    'data-b5-ref',
    'Migration complete: all',
    '§§28–35 + Appendix A · pages 165–191'
  ]) {
    if (!integration.includes(marker)) throw new Error(`Batch 5 Compendium integration missing marker: ${marker}`);
  }

  console.log('Mandate Batch 5 checks passed:', batch5.sectionCount, 'new sections;', mandate.sections.length, 'total; migration complete 5/5');
}

main().catch(error => { console.error(error); process.exit(1); });

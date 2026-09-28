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

  const mandate = context.window.TRIBENET_MANDATE;
  await mandate.whenReady();

  if (mandate.revision !== 'N02.2') throw new Error(`Unexpected revision ${mandate.revision}`);
  if (mandate.sections.length !== 284) throw new Error(`Expected 284 sections after Batch 3, got ${mandate.sections.length}`);
  if (mandate.batches.length !== 3) throw new Error(`Expected three logical batches, got ${mandate.batches.length}`);

  const batch3 = mandate.batches.find(batch => batch.id === '3');
  if (!batch3) throw new Error('Batch 3 metadata missing');
  if (batch3.sectionCount !== 78) throw new Error(`Expected 78 Batch 3 sections, got ${batch3.sectionCount}`);
  if (batch3.topSections.join(',') !== '15,16,17,18,19') throw new Error(`Batch 3 top-level range is wrong: ${batch3.topSections.join(',')}`);

  for (const key of ['15','15.1','15.1.3','16','16.3.2','16.4.2','17','17.15','18','18.4.2','18.5.8','19','19.3.1','19.5']) {
    if (!mandate.getSection(key)) throw new Error(`Missing Batch 3 section ${key}`);
  }
  if (mandate.getSection('20')) throw new Error('Batch 4 content leaked into Batch 3');

  if (!mandate.plainText(mandate.getSection('15.1')).includes('The Fair is held twice per Year')) throw new Error('Fair schedule wording missing');
  if (!mandate.plainText(mandate.getSection('16.4.2')).includes('Slaves or Horses (only)')) throw new Error('Raiding scout target wording missing');

  const navalCombat = mandate.plainText(mandate.getSection('17.15'));
  if (!navalCombat.includes('Mariner skill replaces Combat')) throw new Error('Naval combat Mariner rule missing');
  if (!navalCombat.includes('Captaincy replaces Leadership')) throw new Error('Naval combat Captaincy rule missing');

  if (!mandate.plainText(mandate.getSection('18.4.2')).includes('Each Onager requires 1 Wooden or Stone Tower')) throw new Error('Siege equipment deployment wording missing');
  if (!mandate.plainText(mandate.getSection('18.5.8')).includes('Wells supply Water during sieges')) throw new Error('Siege well wording missing');
  if (!mandate.plainText(mandate.getSection('19.3.1')).includes('cannot block or destroy the jetty')) throw new Error('Jetty siege wording missing');

  if (mandate.getSection('15').page !== 90) throw new Error(`Section 15 page mismatch: ${mandate.getSection('15').page}`);
  if (mandate.getSection('19.5').page !== 133) throw new Error(`Section 19.5 page mismatch: ${mandate.getSection('19.5').page}`);

  const extension = fs.readFileSync(path.join(root, 'compendium-mandate.js'), 'utf8');
  if (!extension.includes("{id:'3',title:'Trade, scouting & combat',range:'§§15–19',pages:'90–133',complete:true}")) {
    throw new Error('Batch 3 Compendium completion state missing');
  }

  console.log('Mandate Batch 3 checks passed:', batch3.sectionCount, 'new sections;', mandate.sections.length, 'total; migration progress 3/5');
}

main().catch(error => { console.error(error); process.exit(1); });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let builds = 0, observer, snapshotReads = 0, tableBuilds = 0, rendered = "", fairItems = [];
const article = { querySelectorAll: () => [], querySelector: () => null, insertAdjacentHTML: (_, html) => { rendered = html; } };
const context = {
  window: { TribeNetItemKnowledge: { key: x => String(x).toUpperCase(),
      recipesFor: () => { tableBuilds++; return []; }, profilesFor: () => [],
      profileRecipesFor: () => [], researchRecipesFor: () => [], fairRows: () => fairItems },
    TribeNetItemIconCatalogue: [{ key: 'AXE', name: 'Axe' }],
    TribeNetItemIconManifest: { AXE: 'axe.png' },
    addEventListener: (_, fn) => { context.focus = fn; },
    fairnet: { listSnapshots: async () => { snapshotReads++; return []; } } },
  compState: { catalog: { entities: [{ key: 'LOG', name: 'Log' }], skills: [] } },
  entities: () => { builds++; return context.compState.catalog.entities.map(x => ({ ...x })); },
  entityByName: () => null,
  showEntity: () => {},
  skills: () => [], bindLinks: () => {}, skillLink: x => x, fmtNum: x => x,
  canon: x => String(x).toUpperCase(),
  $: () => article,
  esc: x => String(x),
  MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/compendium-item-details.js', 'utf8'), context);
(async () => {
  await context.focus();
  const first = context.entities();
  for (let i = 0; i < 1000; i++) {
    assert.equal(context.entities(), first);
    assert.equal(context.entityByName('axe').name, 'Axe');
    assert.equal(context.entityByName('log').name, 'Log');
  }
  assert.equal(builds, 1, 'repeated links must reuse one catalogue build');
  context.compState.catalog.entities.push({ key: 'STONE', name: 'Stone' });
  assert.equal(context.entityByName('stone').name, 'Stone');
  assert.equal(builds, 2, 'new catalogue entries invalidate the index');
  context.compState.catalog = { entities: [{ key: 'ORE', name: 'Ore' }], skills: [] };
  assert.equal(context.entityByName('ore').name, 'Ore');
  assert.equal(context.entityByName('log'), null);
  assert.equal(builds, 3, 'catalogue replacement invalidates the index');
  let scans = 0, insertions = 0;
  const link = { nodeType: 1, dataset: { entity: 'Axe' }, matches: () => true,
    querySelectorAll: () => { scans++; return []; }, querySelector: () => null,
    insertAdjacentHTML: () => { insertions++; } };
  observer([{ addedNodes: [link] }]);
  observer([{ addedNodes: [link] }]);
  assert.equal(insertions, 1, 'each item link is decorated once');
  const image = { nodeType: 1, matches: () => false, querySelectorAll: () => [] };
  link.nodeType = 1;
  observer([{ addedNodes: [link, image] }]);
  observer([{ addedNodes: [link, image] }]);
  assert.equal(insertions, 1);
  assert.equal(builds, 3);
  context.showEntity('Axe');
  context.showEntity('Axe');
  assert.equal(tableBuilds, 1, 'revisiting an item reuses its tables');
  fairItems = [{ snapshot: { turnKey: '906-04', sourceFile: 'Fair' }, item: { purchasePrice: 12 }, purchasable: true }];
  context.window.fairnet.listSnapshots = async () => { snapshotReads++; return [{ turnKey: '906-04' }]; };
  context.window.fairnet.getSnapshot = async () => ({ turnKey: '906-04', items: [{ name: 'Axe', purchasePrice: 12 }] });
  await context.focus();
  context.showEntity('Axe');
  assert.equal(tableBuilds, 2, 'changed Fair data invalidates cached tables');
  assert.match(rendered, /12 silver/);
  await context.focus();
  context.showEntity('Axe');
  assert.equal(tableBuilds, 2, 'unchanged Fair data preserves cached tables');
  const before = snapshotReads;
  await Promise.all([context.focus(), context.focus(), context.focus()]);
  assert.equal(snapshotReads, before + 1, 'concurrent focus refreshes share one read');
  console.log('Compendium item performance tests passed (1 catalogue build for 3,000 repeated lookups).');
})().catch(error => { console.error(error); process.exitCode = 1; });

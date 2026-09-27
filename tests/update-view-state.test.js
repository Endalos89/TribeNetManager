const assert = require('assert');
const { normalizeView } = require('../src/update-view-state');

(function restoresLauncherByDefault() {
  assert.deepEqual(normalizeView(null), { page: 'index.html', screen: 'launcher' });
  assert.deepEqual(normalizeView({ page: 'unexpected.html' }), { page: 'index.html', screen: 'launcher' });
})();

(function preservesMapperSubscreen() {
  assert.deepEqual(
    normalizeView({ page: 'index.html', screen: 'mapper', mode: 'detail' }),
    { page: 'index.html', screen: 'mapper', mode: 'detail' }
  );
  assert.deepEqual(
    normalizeView({ page: 'index.html', screen: 'mapper', mode: 'anything-else' }),
    { page: 'index.html', screen: 'mapper', mode: 'overview' }
  );
})();

(function preservesManagerPages() {
  assert.deepEqual(
    normalizeView({ page: 'turn-manager.html', turnKey: '048-12', unitCode: '0485E1' }),
    { page: 'turn-manager.html', screen: 'turn-manager', turnKey: '048-12', unitCode: '0485E1' }
  );
  assert.deepEqual(
    normalizeView({ page: 'tribe-manager.html', turnKey: '048-12', unitCode: '0485' }),
    { page: 'tribe-manager.html', screen: 'tribe-manager', turnKey: '048-12', unitCode: '0485' }
  );
})();

console.log('update-view-state tests passed');

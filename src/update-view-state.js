const RESTORABLE_PAGES = new Set(['index.html', 'turn-manager.html', 'tribe-manager.html', 'compendium.html', 'fair.html', 'fairground.html']);
const SNAPSHOT_VERSION = 2;
const MAX_SNAPSHOT_BYTES = 512 * 1024;

function safeClone(value) {
  if (!value || typeof value !== 'object') return {};
  try {
    const json = JSON.stringify(value);
    if (Buffer.byteLength(json, 'utf8') > MAX_SNAPSHOT_BYTES) return {};
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

function normalizeView(view) {
  const cloned = safeClone(view);
  const requestedPage = typeof cloned.page === 'string' ? cloned.page : 'index.html';
  const page = RESTORABLE_PAGES.has(requestedPage) ? requestedPage : 'index.html';

  if (requestedPage !== page) {
    return { snapshotVersion: SNAPSHOT_VERSION, page: 'index.html', screen: 'launcher' };
  }

  const normalized = { ...cloned, snapshotVersion: SNAPSHOT_VERSION, page };

  if (page === 'index.html') {
    normalized.screen = cloned.screen === 'mapper' ? 'mapper' : 'launcher';
    if (normalized.screen === 'mapper') {
      normalized.mode = cloned.mode === 'detail' ? 'detail' : 'overview';
    } else {
      delete normalized.mode;
    }
  } else if (page === 'turn-manager.html') {
    normalized.screen = 'turn-manager';
    if (cloned.turnKey) normalized.turnKey = String(cloned.turnKey);
    else delete normalized.turnKey;
    if (cloned.unitCode) normalized.unitCode = String(cloned.unitCode);
    else delete normalized.unitCode;
  } else if (page === 'tribe-manager.html') {
    normalized.screen = 'tribe-manager';
    if (cloned.turnKey) normalized.turnKey = String(cloned.turnKey);
    else delete normalized.turnKey;
    if (cloned.unitCode) normalized.unitCode = String(cloned.unitCode);
    else delete normalized.unitCode;
  } else if (page === 'compendium.html') {
    normalized.screen = 'compendium';
    const view = cloned.compendium && typeof cloned.compendium === 'object' ? cloned.compendium : { type: 'home', key: null };
    normalized.compendium = {
      type: ['home','group','skill','topic','search'].includes(view.type) ? view.type : 'home',
      key: view.key == null ? null : String(view.key)
    };
  } else if (page === 'fair.html') {
    normalized.screen = 'fair';
    if (cloned.turnKey) normalized.turnKey = String(cloned.turnKey);
    else delete normalized.turnKey;
    if (cloned.fairTurnKey) normalized.fairTurnKey = String(cloned.fairTurnKey);
    else delete normalized.fairTurnKey;
  } else if (page === 'fairground.html') {
    normalized.screen = 'fairground';
    if (cloned.turnKey) normalized.turnKey = String(cloned.turnKey);
    else delete normalized.turnKey;
    if (cloned.fairTurnKey) normalized.fairTurnKey = String(cloned.fairTurnKey);
    else delete normalized.fairTurnKey;
  }

  return normalized;
}

module.exports = { RESTORABLE_PAGES, SNAPSHOT_VERSION, MAX_SNAPSHOT_BYTES, normalizeView };

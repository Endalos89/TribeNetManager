const RESTORABLE_PAGES = new Set(['index.html', 'turn-manager.html', 'tribe-manager.html']);

function normalizeView(view) {
  const page = RESTORABLE_PAGES.has(view?.page) ? view.page : 'index.html';
  const normalized = { page };

  if (page === 'index.html') {
    normalized.screen = view?.screen === 'mapper' ? 'mapper' : 'launcher';
    if (normalized.screen === 'mapper') {
      normalized.mode = view?.mode === 'detail' ? 'detail' : 'overview';
    }
  } else if (page === 'turn-manager.html') {
    normalized.screen = 'turn-manager';
    if (view?.turnKey) normalized.turnKey = String(view.turnKey);
    if (view?.unitCode) normalized.unitCode = String(view.unitCode);
  } else if (page === 'tribe-manager.html') {
    normalized.screen = 'tribe-manager';
    if (view?.turnKey) normalized.turnKey = String(view.turnKey);
    if (view?.unitCode) normalized.unitCode = String(view.unitCode);
  }

  return normalized;
}

module.exports = { RESTORABLE_PAGES, normalizeView };

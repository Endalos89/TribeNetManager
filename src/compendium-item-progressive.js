(() => {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'compendium.html') return;
  const X = window.TribeNetCompendiumExpansion;
  if (!X || typeof window.showCategory !== 'function') return;

  const previousShowCategory = window.showCategory;
  let generation = 0;
  const INITIAL_BATCH = 48;
  const IDLE_BATCH = 64;
  const escText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function scheduleIdle(callback) {
    if (typeof requestIdleCallback === 'function') return requestIdleCallback(callback, { timeout:180 });
    return setTimeout(() => callback({ timeRemaining:() => 8, didTimeout:true }), 18);
  }

  function metadata(entity) {
    const parts = [];
    const kind = String(entity?.kind || '').toLowerCase();
    if (kind === 'ship') parts.push('Ship');
    else if (kind === 'facility') parts.push('Building');
    else parts.push(entity?.validGoods?.table || entity?.kind || 'Item');
    if (X.researchOnly?.(entity)) parts.push('Research');
    return parts.join(' · ');
  }

  function makeCard(entity) {
    const button = document.createElement('button');
    button.className = 'comp-entity-card';
    button.dataset.entity = entity.key;
    button.innerHTML = `<strong>${escText(entity.name)}</strong><span>${escText(metadata(entity))}</span>`;
    button.addEventListener('click', () => showEntity(entity.key));
    return button;
  }

  function progressiveItems(push = true) {
    const myGeneration = ++generation;
    let rows = X.rows('items');
    const hide = Boolean(compState.hideResearchItems);
    if (hide) rows = rows.filter(entity => !X.researchOnly(entity));

    setView({ type:'category', key:'items' }, { push });
    $('compBreadcrumbs').textContent = 'Compendium › Items';
    $('compArticle').innerHTML = `
      <div class="comp-title-row">
        <div><div class="comp-kicker">Items</div><h1>Items</h1><div class="comp-short"><span id="itemProgressCount">0</span> / ${rows.length} entries</div></div>
        <label class="comp-toggle"><input id="hideResearchOnly" type="checkbox" ${hide ? 'checked' : ''}> Hide research-only items</label>
      </div>
      <div class="comp-entity-grid" id="progressiveItemGrid" aria-busy="true"></div>`;

    const grid = document.getElementById('progressiveItemGrid');
    const count = document.getElementById('itemProgressCount');
    const toggle = document.getElementById('hideResearchOnly');
    if (toggle) toggle.onchange = () => {
      compState.hideResearchItems = toggle.checked;
      progressiveItems(false);
    };
    if (!grid) return;

    let index = 0;
    const appendBatch = size => {
      if (myGeneration !== generation || compState.view?.type !== 'category' || compState.view?.key !== 'items') return;
      const fragment = document.createDocumentFragment();
      const end = Math.min(rows.length, index + size);
      for (; index < end; index += 1) fragment.appendChild(makeCard(rows[index]));
      grid.appendChild(fragment);
      if (count) count.textContent = String(index);
      if (index >= rows.length) {
        grid.setAttribute('aria-busy', 'false');
        return;
      }
      scheduleIdle(() => appendBatch(IDLE_BATCH));
    };

    appendBatch(INITIAL_BATCH);
  }

  window.showCategory = function progressiveCategory(key, push = true) {
    if (key === 'items') return progressiveItems(push);
    generation += 1;
    return previousShowCategory(key, push);
  };

  const style = document.createElement('style');
  style.setAttribute('data-progressive-item-style', 'true');
  style.textContent = '.comp-entity-grid .comp-entity-card{content-visibility:auto;contain-intrinsic-size:72px 180px}';
  document.head.appendChild(style);

  if (compState?.view?.type === 'category' && compState.view.key === 'items') progressiveItems(false);
  window.TribeNetProgressiveItems = { INITIAL_BATCH, IDLE_BATCH };
})();

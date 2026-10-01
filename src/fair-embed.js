(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') !== '1') return;

  document.documentElement.classList.add('fair-embedded');
  document.body.classList.add('fair-embedded');
  const requested = new Set(String(params.get('sections') || '').split(',').map(value => value.trim()).filter(Boolean));

  function applyEmbeddedLayout() {
    const app = document.querySelector('.fair-app');
    if (!app) return;
    app.classList.add('embedded-mode');
    document.querySelector('.fair-app > .app-header')?.classList.add('hidden');
    document.querySelector('.fair-hero')?.classList.add('hidden');

    for (const panel of document.querySelectorAll('.fair-panel[data-section]')) {
      panel.classList.toggle('hidden', requested.size > 0 && !requested.has(panel.dataset.section));
      panel.classList.remove('section-collapsed');
    }
    const contextGrid = document.querySelector('.fair-context-grid');
    if (contextGrid) {
      const visible = [...contextGrid.querySelectorAll(':scope > .fair-panel')].some(panel => !panel.classList.contains('hidden'));
      contextGrid.classList.toggle('hidden', !visible);
    }
  }

  let timer = null;
  function notifyParent() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (window.parent === window) return;
      const turnKey = document.getElementById('planningTurnSelect')?.value || localStorage.getItem('tribenet:fair:planningTurn') || null;
      window.parent.postMessage({ type:'tribenet:fair-state-changed', turnKey }, '*');
    }, 180);
  }

  applyEmbeddedLayout();
  window.addEventListener('DOMContentLoaded', applyEmbeddedLayout);
  document.addEventListener('change', notifyParent, true);
  document.addEventListener('click', event => {
    if (event.target.closest('button,input,select')) notifyParent();
  }, true);

  const observer = new MutationObserver(mutations => {
    applyEmbeddedLayout();
    if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'characterData')) notifyParent();
  });
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
})();

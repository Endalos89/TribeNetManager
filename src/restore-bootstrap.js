(() => {
  const script = document.currentScript;
  if (!script) return;
  const screen = script.dataset.screen || 'launcher';
  const mode = script.dataset.mode || 'overview';
  if (screen !== 'mapper' || typeof showMapper !== 'function') return;
  showMapper();
  if (mode === 'detail' && typeof showDetail === 'function') showDetail();
})();

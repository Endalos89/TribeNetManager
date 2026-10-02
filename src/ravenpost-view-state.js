(() => {
  const snapshot = () => ({
    snapshotVersion: 2,
    page: 'ravenpost.html',
    screen: 'ravenpost',
    capturedAt: new Date().toISOString()
  });

  function report() {
    if (!window.tribenet?.reportCurrentView) return;
    window.tribenet.reportCurrentView(snapshot()).catch(() => {});
  }

  report();
  window.addEventListener('pagehide', report);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') report();
  });
})();

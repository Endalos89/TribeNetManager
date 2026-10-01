(() => {
  const grid = document.querySelector('.module-grid');
  if (!grid) return;

  if (!document.getElementById('openFairButton')) {
    const button = document.createElement('button');
    button.id = 'openFairButton';
    button.className = 'module-card enabled';
    button.innerHTML = `
      <div class="module-icon">¤</div>
      <div><h2>Fair</h2><p>Import Month 04/10 Fair workbooks, compare prices, value combined holdings and plan the best craft-and-trade opportunities.</p></div>
      <span class="module-status">Open</span>`;
    button.addEventListener('click', () => { window.location.href = 'fair.html'; });
    grid.appendChild(button);
  }

  if (!document.getElementById('openFairgroundButton')) {
    const preview = document.createElement('button');
    preview.id = 'openFairgroundButton';
    preview.className = 'module-card enabled fairground-preview-card';
    preview.innerHTML = `
      <div class="module-icon">🎪</div>
      <div><h2>Fairground <span style="font-size:10px;opacity:.72;letter-spacing:.08em">PREVIEW</span></h2><p>Explore the Summer and Winter Fairs through an interactive fairground, with live trading, crafting, culture and research hotspots.</p></div>
      <span class="module-status">Preview</span>`;
    preview.addEventListener('click', () => { window.location.href = 'fairground.html'; });
    grid.appendChild(preview);
  }
})();

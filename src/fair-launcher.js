(() => {
  if (document.getElementById('openFairButton')) return;
  const grid = document.querySelector('.module-grid');
  if (!grid) return;
  const button = document.createElement('button');
  button.id = 'openFairButton';
  button.className = 'module-card enabled';
  button.innerHTML = `
    <div class="module-icon">¤</div>
    <div><h2>Fair</h2><p>Import Month 04/10 Fair workbooks, compare prices, value combined holdings and plan the best craft-and-trade opportunities.</p></div>
    <span class="module-status">Open</span>`;
  button.addEventListener('click', () => { window.location.href = 'fair.html'; });
  grid.appendChild(button);
})();

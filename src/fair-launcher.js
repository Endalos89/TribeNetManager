(() => {
  const grid = document.querySelector('.module-grid');
  if (!grid) return;

  const importPanel = document.getElementById('launcherImportResultsButton')?.closest('.data-panel');
  const importActions = importPanel?.querySelector('.header-actions');
  if (importPanel && importActions && !document.getElementById('launcherImportFairButton')) {
    const fairButton = document.createElement('button');
    fairButton.id = 'launcherImportFairButton';
    fairButton.className = 'button accent';
    fairButton.textContent = 'Import Fair Workbook';
    fairButton.disabled = true;
    importActions.appendChild(fairButton);

    const copy = importPanel.querySelector('div:first-child');
    if (copy && !document.getElementById('launcherFairImportStatus')) {
      const fairLine = document.createElement('div');
      fairLine.id = 'launcherFairImportStatus';
      fairLine.className = 'save-status launcher-fair-import-status';
      fairLine.textContent = 'Fair workbook: checking the next Month 04 / Month 10 Fair…';
      copy.appendChild(fairLine);
    }
  }

  if (!document.getElementById('openFairButton')) {
    const button = document.createElement('button');
    button.id = 'openFairButton';
    button.className = 'module-card enabled';
    button.innerHTML = `
      <div class="module-icon">¤</div>
      <div><h2>Fair</h2><p>Classic Fair planner using the Fair workbook loaded on the Launcher, with tables for prices, holdings and craft profitability.</p></div>
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
      <div><h2>Fairground <span style="font-size:10px;opacity:.72;letter-spacing:.08em">PREVIEW</span></h2><p>Walk the Summer and Winter Fair as an interactive marketplace: trade at the wagon, inspect stores, craft at the workshop and visit the pavilions.</p></div>
      <span class="module-status">Preview</span>`;
    preview.addEventListener('click', () => { window.location.href = 'fairground.html'; });
    grid.appendChild(preview);
  }
})();

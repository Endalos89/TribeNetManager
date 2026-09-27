(() => {
  const launcher = document.getElementById('launcherView');
  const importPanel = launcher?.querySelector('.data-panel');
  if (!launcher || !importPanel) return;

  const panel = document.createElement('section');
  panel.className = 'turn-file-library-panel';
  panel.innerHTML = `
    <div class="turn-file-library-head">
      <div>
        <p class="eyebrow">TURN FILE LIBRARY</p>
        <h2>Results &amp; Completed Orders history</h2>
        <div id="turnFileLibraryPath" class="turn-file-library-path">Locating folder…</div>
      </div>
      <div class="turn-file-library-actions">
        <button id="openTurnFilesButton" class="button">Open Folder</button>
        <button id="rescanTurnFilesButton" class="button">Rescan</button>
      </div>
    </div>
    <p class="turn-file-library-note">Keep one Results report and one Completed Orders workbook per turn in the folders below. New or changed files are detected automatically and become the source used by the tools.</p>
    <div id="turnFileHistory" class="turn-file-history"></div>
    <div id="turnFileLibraryStatus" class="turn-file-library-status"></div>`;
  importPanel.insertAdjacentElement('afterend', panel);

  const pathHost = document.getElementById('turnFileLibraryPath');
  const historyHost = document.getElementById('turnFileHistory');
  const statusHost = document.getElementById('turnFileLibraryStatus');
  const openButton = document.getElementById('openTurnFilesButton');
  const rescanButton = document.getElementById('rescanTurnFilesButton');
  let refreshing = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function fileCell(file, filePath, importedAt) {
    if (filePath) return `<div class="turn-file-cell present" title="${esc(filePath)}">${esc(file)}</div>`;
    if (file) {
      const when = importedAt ? ` · imported ${new Date(importedAt).toLocaleDateString()}` : '';
      return `<div class="turn-file-cell imported" title="Source is recorded in the app but is not yet present in the shared folder">${esc(file)}${esc(when)}</div>`;
    }
    return '<div class="turn-file-cell missing">Missing</div>';
  }

  function render(info) {
    pathHost.textContent = `${info.root}  ·  Results/  ·  Completed Orders/${info.fallback ? '  (installation folder was not writable, so the local app-data fallback is being used)' : ''}`;
    const rows = info.history || [];
    historyHost.innerHTML = `
      <div class="turn-file-row header"><div>Turn</div><div>Results</div><div>Completed Orders</div></div>
      ${rows.length ? rows.map(row => `
        <div class="turn-file-row">
          <div class="turn-file-turn">${esc(row.turnKey)}</div>
          ${fileCell(row.resultFile, row.resultPath, row.resultImportedAt)}
          ${fileCell(row.completedFile, row.completedPath, row.completedImportedAt)}
        </div>`).join('') : '<div class="turn-file-row"><div class="turn-file-cell missing">No turn files found yet.</div></div>'}`;
  }

  async function refresh(scan = true) {
    if (refreshing) return;
    refreshing = true;
    if (scan) statusHost.textContent = 'Checking turn folders…';
    try {
      const info = scan ? await window.tribenet.scanTurnFiles() : await window.tribenet.getTurnFilesInfo();
      render(info);
      const processed = info.processed || [];
      const failed = info.failed || [];
      if (processed.length) {
        const details = processed.map(item => `${item.turnKey} ${item.kind === 'results' ? 'Results' : 'Completed Orders'}`).join(', ');
        statusHost.textContent = `Updated: ${details}.${failed.length ? ` ${failed.length} file(s) failed to process.` : ''}`;
        if (typeof refreshResultTurns === 'function') await refreshResultTurns();
      } else if (failed.length) {
        statusHost.textContent = `${failed.length} file(s) could not be processed: ${failed.map(item => `${item.file}: ${item.error}`).join(' · ')}`;
      } else {
        statusHost.textContent = 'Turn file library is up to date.';
      }
    } catch (error) {
      statusHost.textContent = `Could not refresh turn files: ${error.message || error}`;
    } finally {
      refreshing = false;
    }
  }

  openButton?.addEventListener('click', async () => {
    const result = await window.tribenet.openTurnFilesFolder();
    if (!result?.ok) statusHost.textContent = result?.error || 'Could not open the turn files folder.';
  });
  rescanButton?.addEventListener('click', () => refresh(true));
  window.addEventListener('tribenet-import-complete', () => refresh(false));

  refresh(true);
  setInterval(() => {
    if (!launcher.classList.contains('hidden')) refresh(true);
  }, 8000);
})();

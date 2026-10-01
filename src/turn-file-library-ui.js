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
        <h2>Turn &amp; Fair history</h2>
        <div id="turnFileLibraryPath" class="turn-file-library-path">Locating folder…</div>
      </div>
      <div class="turn-file-library-actions">
        <button id="openTurnFilesButton" class="button">Open Folder</button>
        <button id="rescanTurnFilesButton" class="button">Rescan</button>
      </div>
    </div>
    <p class="turn-file-library-note">Completed Orders are shown before Results. Fair workbooks appear at Months 04 and 10 and are shared with Fairground.</p>
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

  function parseTurn(value) {
    if (window.TribeNetFairTurns?.parseTurnKey) return window.TribeNetFairTurns.parseTurnKey(value);
    const match = String(value || '').trim().match(/^(\d+)[-_](\d+)$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return { year, month, turnKey:`${year}-${String(month).padStart(2, '0')}`, sort:year * 12 + month };
  }

  function turnSort(value) {
    return parseTurn(value)?.sort ?? Number.MAX_SAFE_INTEGER;
  }

  function fileCell(file, filePath, importedAt, missingLabel = 'Missing') {
    if (filePath) return `<div class="turn-file-cell present" title="${esc(filePath)}">${esc(file)}</div>`;
    if (file) {
      const when = importedAt ? ` · imported ${new Date(importedAt).toLocaleDateString()}` : '';
      return `<div class="turn-file-cell imported" title="Source is recorded in the app but is not yet present in the shared folder">${esc(file)}${esc(when)}</div>`;
    }
    return `<div class="turn-file-cell missing">${esc(missingLabel)}</div>`;
  }

  function fairTurnsFor(history, snapshots) {
    if (window.TribeNetFairTurns?.buildFairTurnOptions) return window.TribeNetFairTurns.buildFairTurnOptions(history || [], snapshots || []);
    const parsed = (history || []).map(row => parseTurn(row?.turnKey)).filter(Boolean).sort((a,b) => a.sort - b.sort);
    const saved = (snapshots || []).map(row => parseTurn(row?.turnKey)).filter(row => row && [4,10].includes(row.month));
    const options = new Set(saved.map(row => row.turnKey));
    if (!parsed.length) return [...options].sort((a,b) => turnSort(a) - turnSort(b));
    const first = parsed[0];
    const last = parsed.at(-1);
    for (let year = first.year; year <= last.year + 1; year += 1) {
      for (const month of [4,10]) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const sort = year * 12 + month;
        if (sort >= first.sort && sort <= last.sort) options.add(key);
      }
    }
    const next = last.month < 4 ? `${last.year}-04` : last.month < 10 ? `${last.year}-10` : `${last.year + 1}-04`;
    options.add(next);
    return [...options].sort((a,b) => turnSort(a) - turnSort(b));
  }

  function render(info, snapshots = []) {
    pathHost.textContent = `${info.root}  ·  Results/  ·  Completed Orders/${info.fallback ? '  (installation folder was not writable, so the local app-data fallback is being used)' : ''}`;

    const rows = new Map((info.history || []).map(row => [String(row.turnKey), { ...row }]));
    const snapshotMap = new Map((snapshots || []).map(row => [String(row.turnKey), row]));
    for (const snapshot of snapshots || []) {
      const key = String(snapshot.turnKey || '');
      if (key && !rows.has(key)) rows.set(key, { turnKey:key });
    }
    for (const fairTurn of fairTurnsFor(info.history || [], snapshots || [])) {
      if (!rows.has(fairTurn)) rows.set(fairTurn, { turnKey:fairTurn });
    }

    const ordered = [...rows.values()].sort((a,b) => turnSort(a.turnKey) - turnSort(b.turnKey) || String(a.turnKey).localeCompare(String(b.turnKey)));
    const firstResultTurn = ordered.find(row => row.resultFile)?.turnKey || null;

    historyHost.innerHTML = `
      <div class="turn-file-row header"><div>Turn</div><div>Completed Orders</div><div>Results</div><div>Fair</div></div>
      ${ordered.length ? ordered.map(row => {
        const parsed = parseTurn(row.turnKey);
        const isFairTurn = Boolean(parsed && [4,10].includes(parsed.month));
        const fair = snapshotMap.get(String(row.turnKey));
        const completed = row.completedFile
          ? fileCell(row.completedFile, row.completedPath, row.completedImportedAt)
          : row.turnKey === firstResultTurn
            ? '<div class="turn-file-cell not-required">Not required</div>'
            : fileCell(null, null, null);
        const results = fileCell(row.resultFile, row.resultPath, row.resultImportedAt);
        const fairCell = isFairTurn
          ? fair
            ? `<div class="turn-file-cell present" title="${esc(fair.sourceFile || '')}">${esc(fair.sourceFile || 'Fair workbook loaded')}</div>`
            : '<div class="turn-file-cell missing">Missing</div>'
          : '<div class="turn-file-cell missing">—</div>';
        return `<div class="turn-file-row"><div class="turn-file-turn">${esc(row.turnKey)}</div>${completed}${results}${fairCell}</div>`;
      }).join('') : '<div class="turn-file-row"><div class="turn-file-cell missing">No turn files found yet.</div></div>'}`;
  }

  async function refresh(scan = true) {
    if (refreshing) return;
    refreshing = true;
    if (scan) statusHost.textContent = 'Checking turn folders…';
    try {
      const info = scan ? await window.tribenet.scanTurnFiles() : await window.tribenet.getTurnFilesInfo();
      let snapshots = [];
      try { snapshots = window.fairnet?.listSnapshots ? await window.fairnet.listSnapshots() : []; }
      catch (error) { console.warn('Could not load Fair history', error); }
      render(info, snapshots);
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
  window.addEventListener('tribenet-fair-import-complete', () => refresh(false));

  refresh(true);
  setInterval(() => {
    if (!launcher.classList.contains('hidden')) refresh(true);
  }, 8000);
})();

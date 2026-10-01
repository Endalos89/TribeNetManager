(() => {
  const status = document.getElementById('launcherImportStatus');
  const resultsButton = document.getElementById('launcherImportResultsButton');
  const completedButton = document.getElementById('launcherImportCompletedButton');
  const RESULT_TURN_STORAGE_KEY = 'tribenet:selectedResultTurn';
  let busy = false;

  const fairButton = () => document.getElementById('launcherImportFairButton');
  const fairStatus = () => document.getElementById('launcherFairImportStatus');

  function canonicalTurnKey(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d+)[-_](\d+)$/);
    if (!match) return text || null;
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }

  function parseTurnKey(value) {
    if (window.TribeNetFairTurns?.parseTurnKey) return window.TribeNetFairTurns.parseTurnKey(value);
    const match = String(value || '').trim().match(/^(\d+)[-_](\d+)$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return { year, month, turnKey:`${year}-${String(month).padStart(2,'0')}`, sort:year * 12 + month };
  }

  function fairAtOrAfter(turnKey) {
    if (window.TribeNetFairTurns?.fairAtOrAfter) return window.TribeNetFairTurns.fairAtOrAfter(turnKey);
    const turn = parseTurnKey(turnKey);
    if (!turn) return null;
    if (turn.month <= 4) return `${turn.year}-04`;
    if (turn.month <= 10) return `${turn.year}-10`;
    return `${turn.year + 1}-04`;
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    if (resultsButton) resultsButton.disabled = busy;
    if (completedButton) completedButton.disabled = busy;
    const button = fairButton();
    if (button) button.disabled = busy || !button.dataset.turnKey;
  }

  function planningTurnKey(resultTurn) {
    if (typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore?.planningTurnKey) return canonicalTurnKey(TurnLifecycleCore.planningTurnKey(resultTurn));
    const current = String(resultTurn?.metadata?.nextTurn || resultTurn?.turnKey || '').trim();
    if (resultTurn?.metadata?.nextTurn) return canonicalTurnKey(current);
    const match = current.match(/^(\d+)([-_])(\d+)$/);
    if (!match) return canonicalTurnKey(current);
    const year = Number(match[1]);
    const month = Number(match[3]);
    return month >= 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2,'0')}`;
  }

  async function refreshPlanningTurn(turnKey, preferredImportId = null) {
    turnKey = canonicalTurnKey(turnKey);
    if (!turnKey) return;
    localStorage.setItem(RESULT_TURN_STORAGE_KEY, turnKey);
    if (typeof refreshResultTurns === 'function') await refreshResultTurns(turnKey);
    if (preferredImportId != null && typeof syncPlannerOverlayToResultTurn === 'function') {
      await syncPlannerOverlayToResultTurn(turnKey, preferredImportId, { redraw:false });
    }
  }

  async function nextFairTurn() {
    const managedTurns = await window.tribenet.listManagedTurns();
    const managedParsed = (managedTurns || [])
      .map(row => parseTurnKey(row?.turnKey ?? row))
      .filter(Boolean)
      .sort((a,b) => a.sort - b.sort);
    if (managedParsed.length) return fairAtOrAfter(managedParsed.at(-1).turnKey);

    const results = await window.tribenet.listResultTurns();
    const resultParsed = (results || [])
      .map(row => parseTurnKey(row?.turnKey ?? row))
      .filter(Boolean)
      .sort((a,b) => a.sort - b.sort);
    if (!resultParsed.length) return null;
    const latestResult = resultParsed.at(-1);
    const nextPlanning = latestResult.month >= 12
      ? `${latestResult.year + 1}-01`
      : `${latestResult.year}-${String(latestResult.month + 1).padStart(2,'0')}`;
    return fairAtOrAfter(nextPlanning);
  }

  async function refreshFairStatus() {
    const button = fairButton();
    const fairLine = fairStatus();
    if (!button) return;
    const target = await nextFairTurn();
    button.dataset.turnKey = target || '';
    if (!target) {
      button.disabled = true;
      button.textContent = 'Import Fair Workbook';
      if (fairLine) fairLine.textContent = 'Fair workbook: import Results first so the next Month 04 / Month 10 Fair can be identified.';
      return;
    }

    const snapshots = await window.fairnet.listSnapshots();
    const existing = (snapshots || []).find(row => canonicalTurnKey(row.turnKey) === target);
    button.disabled = busy;
    button.textContent = existing ? `Replace Fair ${target}` : `Import Fair ${target}`;
    if (fairLine) {
      fairLine.textContent = existing
        ? `Fair ${target}: ${existing.sourceFile} is loaded and shared with Fairground.`
        : `Fair ${target}: no workbook loaded yet. Import it here for this Month 04 / Month 10 Fair.`;
    }
  }

  async function importResults() {
    setBusy(true);
    if (status) status.textContent = 'Importing Results…';
    try {
      const result = await window.tribenet.importResultsReport();
      if (result?.canceled) {
        if (status) status.textContent = 'Results import cancelled.';
        return;
      }
      if (result?.error) {
        if (status) status.textContent = `Results import failed: ${result.error}`;
        return;
      }
      const nextTurn = planningTurnKey(result.turn);
      await refreshPlanningTurn(nextTurn);
      window.dispatchEvent(new CustomEvent('tribenet-import-complete'));
      if (status) status.textContent = `Turn ${canonicalTurnKey(result.turn.turnKey)} Results imported. Planning Turn ${nextTurn} is ready.`;
    } finally {
      setBusy(false);
      await refreshFairStatus().catch(console.error);
    }
  }

  async function importCompleted() {
    setBusy(true);
    if (status) status.textContent = 'Importing Completed Orders…';
    try {
      const result = await window.tribenet.importOrdersWorkbook();
      if (result?.canceled) {
        if (status) status.textContent = 'Completed Orders import cancelled.';
        return;
      }
      if (result?.error) {
        if (status) status.textContent = `Completed Orders import failed: ${result.error}`;
        return;
      }
      const imported = result.imported;
      const movementCount = imported?.plan?.movements?.filter(row => (row.orders || []).length).length || 0;
      const scoutCount = imported?.plan?.scouts?.length || 0;
      const turnKey = canonicalTurnKey(imported?.turnKey);
      await refreshPlanningTurn(turnKey, imported?.id);
      window.dispatchEvent(new CustomEvent('tribenet-import-complete'));
      if (status) status.textContent = `Turn ${turnKey} Completed Orders imported and made authoritative. ${movementCount} movement route${movementCount === 1 ? '' : 's'} and ${scoutCount} scout route${scoutCount === 1 ? '' : 's'} loaded for verification.`;
    } finally {
      setBusy(false);
      await refreshFairStatus().catch(console.error);
    }
  }

  async function importFair() {
    const button = fairButton();
    const turnKey = button?.dataset.turnKey;
    if (!button || !turnKey) return;
    setBusy(true);
    const fairLine = fairStatus();
    if (fairLine) fairLine.textContent = `Importing Fair ${turnKey} workbook…`;
    try {
      const result = await window.fairnet.importWorkbook(turnKey);
      if (result?.canceled) {
        if (fairLine) fairLine.textContent = `Fair ${turnKey} import cancelled.`;
        return;
      }
      if (result?.error) {
        if (fairLine) fairLine.textContent = `Fair ${turnKey} import failed: ${result.error}`;
        return;
      }
      localStorage.setItem('tribenet:fair:planningTurn', turnKey);
      window.dispatchEvent(new CustomEvent('tribenet-fair-import-complete', { detail:{ turnKey } }));
    } finally {
      setBusy(false);
      await refreshFairStatus().catch(console.error);
    }
  }

  function bindFairButton() {
    const button = fairButton();
    if (!button) return false;
    if (!button.dataset.launcherImportBound) {
      button.dataset.launcherImportBound = 'true';
      // Also tells the older feedback compatibility layer not to attach a second importer.
      button.dataset.feedbackFairBound = 'true';
      button.addEventListener('click', importFair);
    }
    refreshFairStatus().catch(error => {
      console.error('Could not refresh Fair launcher status', error);
      const fairLine = fairStatus();
      if (fairLine) fairLine.textContent = 'Fair workbook status could not be loaded.';
    });
    return true;
  }

  resultsButton?.addEventListener('click', importResults);
  completedButton?.addEventListener('click', importCompleted);
  window.addEventListener('tribenet-import-complete', () => refreshFairStatus().catch(console.error));
  window.addEventListener('tribenet-fair-import-complete', () => refreshFairStatus().catch(console.error));

  if (!bindFairButton()) {
    const observer = new MutationObserver(() => {
      if (bindFairButton()) observer.disconnect();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }
})();

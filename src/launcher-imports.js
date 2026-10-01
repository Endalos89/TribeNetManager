(() => {
  const status = document.getElementById('launcherImportStatus');
  const fairStatus = document.getElementById('launcherFairImportStatus');
  const resultsButton = document.getElementById('launcherImportResultsButton');
  const completedButton = document.getElementById('launcherImportCompletedButton');
  const fairButton = document.getElementById('launcherImportFairButton');
  const RESULT_TURN_STORAGE_KEY = 'tribenet:selectedResultTurn';

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

  function setBusy(busy) {
    if (resultsButton) resultsButton.disabled = busy;
    if (completedButton) completedButton.disabled = busy;
    if (fairButton) fairButton.disabled = busy || !fairButton.dataset.turnKey;
  }

  function planningTurnKey(resultTurn) {
    if (typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore?.planningTurnKey) return canonicalTurnKey(TurnLifecycleCore.planningTurnKey(resultTurn));
    const current = String(resultTurn?.metadata?.nextTurn || resultTurn?.turnKey || '').trim();
    if (resultTurn?.metadata?.nextTurn) return canonicalTurnKey(current);
    const match = current.match(/^(\d+)([-_])(\d+)$/);
    if (!match) return canonicalTurnKey(current);
    return canonicalTurnKey(`${match[1]}-${Number(match[3]) + 1}`);
  }

  async function refreshPlanningTurn(turnKey, preferredImportId = null) {
    turnKey = canonicalTurnKey(turnKey);
    if (!turnKey) return;
    localStorage.setItem(RESULT_TURN_STORAGE_KEY, turnKey);
    if (typeof refreshResultTurns === 'function') await refreshResultTurns(turnKey);

    if (preferredImportId != null && typeof syncPlannerOverlayToResultTurn === 'function') {
      await syncPlannerOverlayToResultTurn(turnKey, preferredImportId, { redraw: false });
    }
  }

  async function nextFairTurn() {
    const managedTurns = await window.tribenet.listManagedTurns();
    const parsed = (managedTurns || []).map(row => parseTurnKey(row?.turnKey)).filter(Boolean).sort((a,b) => a.sort - b.sort);
    if (parsed.length) return fairAtOrAfter(parsed.at(-1).turnKey);

    const results = await window.tribenet.listResultTurns();
    const resultParsed = (results || []).map(row => parseTurnKey(row?.turnKey ?? row)).filter(Boolean).sort((a,b) => a.sort - b.sort);
    if (!resultParsed.length) return null;
    const latestResult = resultParsed.at(-1);
    const nextPlanning = latestResult.month >= 12 ? `${latestResult.year + 1}-01` : `${latestResult.year}-${String(latestResult.month + 1).padStart(2,'0')}`;
    return fairAtOrAfter(nextPlanning);
  }

  async function refreshFairStatus() {
    if (!fairButton) return;
    const target = await nextFairTurn();
    fairButton.dataset.turnKey = target || '';
    if (!target) {
      fairButton.disabled = true;
      fairButton.textContent = 'Import Fair Workbook';
      if (fairStatus) fairStatus.textContent = 'Fair workbook: import Results first so the next Month 04 / Month 10 Fair can be identified.';
      return;
    }

    const snapshots = await window.fairnet.listSnapshots();
    const existing = (snapshots || []).find(row => canonicalTurnKey(row.turnKey) === target);
    fairButton.disabled = false;
    fairButton.textContent = existing ? `Replace Fair ${target}` : `Import Fair ${target}`;
    if (fairStatus) {
      fairStatus.textContent = existing
        ? `Fair ${target}: ${existing.sourceFile} is loaded and shared by Classic Fair and Fairground.`
        : `Fair ${target}: no workbook loaded yet. Both Fair tools will use the latest earlier Fair as a price baseline until you import it here.`;
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
      await refreshFairStatus();
      window.dispatchEvent(new CustomEvent('tribenet-import-complete'));
      if (status) status.textContent = `Turn ${canonicalTurnKey(result.turn.turnKey)} Results imported. Planning Turn ${nextTurn} is ready.`;
    } finally {
      setBusy(false);
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
      await refreshFairStatus();
      window.dispatchEvent(new CustomEvent('tribenet-import-complete'));
      if (status) status.textContent = `Turn ${turnKey} Completed Orders imported and made authoritative. ${movementCount} movement route${movementCount === 1 ? '' : 's'} and ${scoutCount} scout route${scoutCount === 1 ? '' : 's'} loaded for verification.`;
    } finally {
      setBusy(false);
    }
  }

  async function importFair() {
    const turnKey = fairButton?.dataset.turnKey;
    if (!turnKey) return;
    setBusy(true);
    if (fairStatus) fairStatus.textContent = `Importing Fair ${turnKey} workbook…`;
    try {
      const result = await window.fairnet.importWorkbook(turnKey);
      if (result?.canceled) {
        if (fairStatus) fairStatus.textContent = `Fair ${turnKey} import cancelled.`;
        return;
      }
      if (result?.error) {
        if (fairStatus) fairStatus.textContent = `Fair ${turnKey} import failed: ${result.error}`;
        return;
      }
      localStorage.setItem('tribenet:fair:planningTurn', turnKey);
      await refreshFairStatus();
      window.dispatchEvent(new CustomEvent('tribenet-fair-import-complete', { detail:{ turnKey } }));
    } finally {
      setBusy(false);
    }
  }

  resultsButton?.addEventListener('click', importResults);
  completedButton?.addEventListener('click', importCompleted);
  fairButton?.addEventListener('click', importFair);
  window.addEventListener('tribenet-import-complete', () => refreshFairStatus().catch(console.error));
  refreshFairStatus().catch(error => {
    console.error('Could not refresh Fair launcher status', error);
    if (fairStatus) fairStatus.textContent = 'Fair workbook status could not be loaded.';
  });
})();

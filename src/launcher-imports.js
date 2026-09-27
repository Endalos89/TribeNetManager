(() => {
  const status = document.getElementById('launcherImportStatus');
  const resultsButton = document.getElementById('launcherImportResultsButton');
  const completedButton = document.getElementById('launcherImportCompletedButton');
  const RESULT_TURN_STORAGE_KEY = 'tribenet:selectedResultTurn';

  function canonicalTurnKey(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d+)[-_](\d+)$/);
    if (!match) return text || null;
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }

  function setBusy(busy) {
    if (resultsButton) resultsButton.disabled = busy;
    if (completedButton) completedButton.disabled = busy;
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
    }
  }

  resultsButton?.addEventListener('click', importResults);
  completedButton?.addEventListener('click', importCompleted);
})();

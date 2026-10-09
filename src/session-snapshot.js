(() => {
  const page = String(window.location.pathname || '').split('/').pop() || 'index.html';
  let restoring = false;
  let reportTimer = null;

  function jsonClone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  }

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function captureDraftFields() {
    const fields = {};
    for (const element of document.querySelectorAll('input[id], textarea[id]')) {
      const type = String(element.type || '').toLowerCase();
      if (['button', 'submit', 'file', 'hidden', 'checkbox', 'radio', 'range'].includes(type)) continue;
      fields[element.id] = element.value;
    }
    return fields;
  }

  function captureScrolls() {
    const scrolls = {};
    const root = document.scrollingElement;
    if (root && (root.scrollTop || root.scrollLeft)) scrolls.__document = { top: root.scrollTop, left: root.scrollLeft };
    for (const element of document.querySelectorAll('[id]')) {
      if (!element.scrollTop && !element.scrollLeft) continue;
      scrolls[element.id] = { top: element.scrollTop, left: element.scrollLeft };
    }
    return scrolls;
  }

  function captureFocus() {
    const active = document.activeElement;
    return active?.id || null;
  }

  function baseSnapshot() {
    return {
      snapshotVersion: 2,
      page,
      capturedAt: new Date().toISOString(),
      draftFields: captureDraftFields(),
      scrolls: captureScrolls(),
      focusId: captureFocus()
    };
  }

  function captureIndex() {
    const mapperVisible = !document.getElementById('mapperView')?.classList.contains('hidden');
    const snapshot = { ...baseSnapshot(), screen: mapperVisible ? 'mapper' : 'launcher' };
    if (!mapperVisible) return snapshot;

    snapshot.mode = typeof state !== 'undefined' && state.mode === 'detail' ? 'detail' : 'overview';
    snapshot.resultTurnKey = typeof resultsTimeline !== 'undefined' ? resultsTimeline.turn?.turnKey || null : null;
    snapshot.planImportId = typeof state !== 'undefined' ? state.planImport?.id || null : null;
    snapshot.map = typeof state !== 'undefined' ? {
      isometric: typeof IsoMapper !== 'undefined' && IsoMapper.enabled,
      cameraX: finite(state.cameraX),
      cameraY: finite(state.cameraY),
      scale: finite(state.scale),
      planningVisible: Boolean(state.planningVisible),
      scoutingVisible: Boolean(state.scoutingVisible)
    } : null;

    if (typeof state !== 'undefined') {
      if (state.selectedUnit) snapshot.selection = { kind: 'unit', unitCode: String(state.selectedUnit) };
      else if (state.selected?.coordinate) snapshot.selection = { kind: 'hex', coordinate: String(state.selected.coordinate) };
    }

    if (typeof movementPlannerState !== 'undefined') {
      snapshot.movementPlanner = {
        active: Boolean(movementPlannerState.active),
        origin: jsonClone(movementPlannerState.origin),
        route: jsonClone(movementPlannerState.route),
        selectedUnitCode: typeof savedMovementPlansState !== 'undefined' ? savedMovementPlansState.selectedUnitCode || '' : '',
        routeType: typeof savedMovementPlansState !== 'undefined' ? savedMovementPlansState.routeType || 'unit' : 'unit'
      };
    }
    return snapshot;
  }

  function captureTurnManager() {
    const snapshot = {
      ...baseSnapshot(),
      screen: 'turn-manager',
      turnKey: typeof state !== 'undefined' ? state.turn?.turnKey || null : null,
      unitCode: typeof state !== 'undefined' ? state.selectedUnit || null : null,
      turnManager: {}
    };
    const activity = document.getElementById('activitySelect');
    if (activity) snapshot.turnManager.activityCode = activity.value;
    return snapshot;
  }

  function captureTribeManager() {
    return {
      ...baseSnapshot(),
      screen: 'tribe-manager',
      turnKey: typeof tmState !== 'undefined' ? tmState.turn?.turnKey || null : null,
      unitCode: typeof tmState !== 'undefined' ? tmState.selectedUnitCode || null : null
    };
  }

  function capture() {
    if (page === 'turn-manager.html') return captureTurnManager();
    if (page === 'tribe-manager.html') return captureTribeManager();
    return captureIndex();
  }

  async function reportNow() {
    if (restoring || !window.tribenet?.reportCurrentView) return;
    try { await window.tribenet.reportCurrentView(capture()); }
    catch (_) {}
  }

  function scheduleReport() {
    if (restoring) return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(reportNow, 120);
  }

  async function waitFor(predicate, attempts = 120) {
    for (let i = 0; i < attempts; i++) {
      try { if (predicate()) return true; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }

  async function settleManagers() {
    if (page === 'turn-manager.html') {
      await waitFor(() => typeof state !== 'undefined' && Array.isArray(state.catalog) && state.catalog.length > 0);
    } else if (page === 'tribe-manager.html') {
      await waitFor(() => document.getElementById('tribeManagerVersion')?.textContent.startsWith('Version '));
    }
    await new Promise(resolve => setTimeout(resolve, 450));
  }

  function restoreDraftFields(snapshot) {
    for (const [id, value] of Object.entries(snapshot?.draftFields || {})) {
      const element = document.getElementById(id);
      if (!element || value == null) continue;
      const type = String(element.type || '').toLowerCase();
      if (['button', 'submit', 'file', 'hidden', 'checkbox', 'radio', 'range'].includes(type)) continue;
      element.value = String(value);
    }
  }

  function restoreScrolls(snapshot) {
    const apply = () => {
      for (const [id, position] of Object.entries(snapshot?.scrolls || {})) {
        const target = id === '__document' ? document.scrollingElement : document.getElementById(id);
        if (!target) continue;
        if (Number.isFinite(Number(position?.top))) target.scrollTop = Number(position.top);
        if (Number.isFinite(Number(position?.left))) target.scrollLeft = Number(position.left);
      }
    };
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 120);
  }

  function restoreFocus(snapshot) {
    if (!snapshot?.focusId) return;
    setTimeout(() => {
      const element = document.getElementById(snapshot.focusId);
      if (element && !element.disabled && typeof element.focus === 'function') {
        try { element.focus({ preventScroll: true }); } catch (_) { element.focus(); }
      }
    }, 140);
  }

  async function restoreIndex(snapshot) {
    await waitFor(() => typeof resultsTimeline !== 'undefined' && resultsTimeline.ready && typeof savedMovementPlansState !== 'undefined' && savedMovementPlansState.ready);

    if (snapshot.resultTurnKey && resultsTimeline.turns?.some(row => row.turnKey === snapshot.resultTurnKey)) {
      await applyResultTurn(snapshot.resultTurnKey, { persist: true, preservePlayback: true });
    }

    if (snapshot.planImportId) {
      if (resultsTimeline.turn?.turnKey && typeof syncPlannerOverlayToResultTurn === 'function') {
        await syncPlannerOverlayToResultTurn(resultsTimeline.turn.turnKey, snapshot.planImportId, { redraw: false });
      } else if (typeof loadPlan === 'function') {
        await loadPlan(Number(snapshot.planImportId), false);
      }
    }

    if (snapshot.screen === 'mapper') {
      if (typeof IsoMapper !== 'undefined') IsoMapper.setEnabled(Boolean(snapshot.map?.isometric));
      showMapper();
      if (snapshot.mode === 'detail') showDetail();
      else showOverview();
    } else {
      showLauncher();
    }

    if (snapshot.map && typeof state !== 'undefined') {
      if (Number.isFinite(Number(snapshot.map.scale))) state.scale = Math.max(9, Math.min(snapshot.map.isometric ? 180 : 68, Number(snapshot.map.scale)));
      if (Number.isFinite(Number(snapshot.map.cameraX))) state.cameraX = Number(snapshot.map.cameraX);
      if (Number.isFinite(Number(snapshot.map.cameraY))) state.cameraY = Number(snapshot.map.cameraY);
      if (typeof snapshot.map.planningVisible === 'boolean') state.planningVisible = snapshot.map.planningVisible;
      if (typeof snapshot.map.scoutingVisible === 'boolean') state.scoutingVisible = snapshot.map.scoutingVisible;
      const planningToggle = document.getElementById('planningToggle');
      const scoutingToggle = document.getElementById('scoutingToggle');
      if (planningToggle) planningToggle.checked = state.planningVisible;
      if (scoutingToggle) scoutingToggle.checked = state.scoutingVisible;
      updatePlanUI();
    }

    if (snapshot.screen === 'mapper' && snapshot.mode === 'detail') {
      resizeCanvas();
      requestVisibleData();
      await new Promise(resolve => setTimeout(resolve, 90));
    }

    if (snapshot.selection?.kind === 'hex') {
      const point = parseCoordinate(snapshot.selection.coordinate);
      if (point) await selectHex(point.globalCol, point.globalRow);
    } else if (snapshot.selection?.kind === 'unit' && typeof showUnitLogistics === 'function') {
      showUnitLogistics(snapshot.selection.unitCode);
    }

    const planner = snapshot.movementPlanner;
    if (planner && typeof savedMovementPlansState !== 'undefined') {
      savedMovementPlansState.selectedUnitCode = planner.selectedUnitCode || '';
      savedMovementPlansState.routeType = planner.routeType === 'scout' ? 'scout' : 'unit';
      savedMovementPopulateUnits();
      savedMovementRenderSaveControls();
    }

    if (planner && typeof movementPlannerState !== 'undefined') {
      movementPlannerState.knownHexes = null;
      movementPlannerState.knowledgeKey = null;
      movementPlannerState.loading = false;
      movementPlannerState.shiftHeld = false;
      movementPlannerState.active = Boolean(planner.active);
      movementPlannerState.origin = jsonClone(planner.origin);
      movementPlannerState.route = jsonClone(planner.route);
      movementPlannerUpdateButton();

      if (movementPlannerState.active) {
        if (typeof turnActionState !== 'undefined') turnActionState.active = savedMovementPlansState.routeType === 'scout' ? 'scout' : 'unit';
        if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
      } else {
        if (typeof turnActionState !== 'undefined') turnActionState.active = null;
        if (typeof turnActionsRefresh === 'function') turnActionsRefresh();
      }
    }

    restoreDraftFields(snapshot);
    if (snapshot.screen === 'mapper' && snapshot.mode === 'detail') {
      draw();
      requestVisibleData();
    }
    restoreScrolls(snapshot);
    restoreFocus(snapshot);
  }

  async function restoreTurnManager(snapshot) {
    await settleManagers();
    if (snapshot.unitCode) state.selectedUnit = snapshot.unitCode;
    if (snapshot.turnKey && state.turns.some(row => row.turnKey === snapshot.turnKey)) {
      const picker = document.getElementById('turnPicker');
      if (picker) picker.value = snapshot.turnKey;
      await loadTurn(snapshot.turnKey);
    } else if (snapshot.unitCode && selected()) {
      renderAll();
    }

    const activityCode = snapshot.turnManager?.activityCode;
    const activitySelect = document.getElementById('activitySelect');
    if (activityCode && activitySelect && Array.from(activitySelect.options).some(option => option.value === activityCode)) {
      activitySelect.value = activityCode;
    }
    restoreDraftFields(snapshot);
    if (typeof renderActivityRule === 'function') renderActivityRule();
    restoreScrolls(snapshot);
    restoreFocus(snapshot);
  }

  async function restoreTribeManager(snapshot) {
    await settleManagers();
    if (snapshot.turnKey && tmState.turns.some(row => row.turnKey === snapshot.turnKey)) {
      await selectTurn(snapshot.turnKey, false);
    }
    if (snapshot.unitCode && tmState.turn?.units?.some(unit => String(unit.unitCode) === String(snapshot.unitCode))) {
      tmState.selectedUnitCode = snapshot.unitCode;
      renderUnits();
      renderSelectedUnit();
    }
    restoreDraftFields(snapshot);
    restoreScrolls(snapshot);
    restoreFocus(snapshot);
  }

  async function restoreStartupSnapshot() {
    let snapshot = null;
    try { snapshot = await window.tribenet.consumeStartupView(); }
    catch (_) {}
    if (!snapshot || snapshot.page !== page) {
      scheduleReport();
      return;
    }

    restoring = true;
    try {
      if (page === 'turn-manager.html') await restoreTurnManager(snapshot);
      else if (page === 'tribe-manager.html') await restoreTribeManager(snapshot);
      else await restoreIndex(snapshot);
    } catch (error) {
      console.error('Session snapshot restore failed', error);
    } finally {
      restoring = false;
      await reportNow();
    }
  }

  window.captureTribeNetSessionSnapshot = capture;
  window.reportTribeNetSessionSnapshot = reportNow;

  const installButton = document.getElementById('installUpdateButton');
  if (installButton) {
    installButton.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      installButton.disabled = true;
      try {
        await window.tribenet.reportCurrentView(capture());
        await window.tribenet.installUpdate();
      } catch (error) {
        installButton.disabled = false;
        console.error('Could not snapshot session before update', error);
      }
    }, true);
  }

  for (const eventName of ['input', 'change', 'click', 'mouseup', 'keyup', 'wheel']) {
    window.addEventListener(eventName, scheduleReport, true);
  }
  window.addEventListener('scroll', scheduleReport, true);
  window.addEventListener('pagehide', reportNow);
  window.addEventListener('beforeunload', reportNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') reportNow(); });

  setInterval(() => { if (document.visibilityState === 'visible') reportNow(); }, 2000);
  restoreStartupSnapshot();
})();

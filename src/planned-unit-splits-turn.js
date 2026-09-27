// Turn Manager planned unit splits.
// A split is structural only: it creates the new Tribe/Element at the parent Tribe's starting hex.
// Population/goods transfers remain explicit and are not guessed here.

const plannedSplitOriginalAllUnits = allUnits;
allUnits = function allUnitsWithPlannedSplits() {
  const base = plannedSplitOriginalAllUnits();
  const byCode = new Map(base.map(unit => [String(unit.unit).toLowerCase(), unit]));

  for (const split of state.turn?.unitSplits || []) {
    const key = String(split.unitCode || '').toLowerCase();
    if (!key || byCode.has(key)) continue;
    const parent = base.find(unit => String(unit.unit).toLowerCase() === String(split.parentUnit).toLowerCase());
    byCode.set(key, {
      unit: split.unitCode,
      unitName: split.unitName || `Planned split from ${split.parentUnit}`,
      type: split.unitType,
      parentTribe: split.unitType === 'Element' ? split.parentUnit : split.unitCode,
      startHex: split.startHex,
      warrior: 0,
      active: 0,
      inactive: 0,
      slave: 0,
      eaters: 0,
      locals: 0,
      workers: 0,
      used: 0,
      remains: 0,
      skills: split.unitType === 'Element' ? (parent?.skills || skillsForTribe(split.parentUnit)) : [],
      plannedSplit: true,
      splitId: split.id,
      splitParentUnit: split.parentUnit
    });
  }

  return [...byCode.values()].sort((a, b) =>
    String(a.parentTribe || a.unit).localeCompare(String(b.parentTribe || b.unit), undefined, { numeric: true })
    || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true })
  );
};

function plannedSplitEnsurePanel() {
  let panel = document.getElementById('plannedUnitSplitPanel');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = 'plannedUnitSplitPanel';
  panel.className = 'tm-panel hidden';
  panel.innerHTML = `
    <div class="tm-section-title">
      <div><p class="eyebrow">UNIT SPLIT</p><h3>Split off a Tribe / Element</h3></div>
      <span id="plannedUnitSplitOrigin" class="tm-muted"></span>
    </div>
    <div id="plannedUnitSplitBody"></div>
    <div id="plannedUnitSplitStatus" class="tm-validation"></div>
  `;

  const workspace = document.getElementById('tmWorkspace');
  const topGrid = workspace?.querySelector('.tm-top-grid');
  if (topGrid) topGrid.insertAdjacentElement('afterend', panel);
  else workspace?.prepend(panel);

  panel.addEventListener('click', async event => {
    const create = event.target.closest('#createPlannedUnitSplit');
    if (create) {
      const parent = selected();
      if (!parent || parent.type !== 'Tribe' || parent.plannedSplit || !state.turn?.turnKey) return;
      const type = document.getElementById('plannedUnitSplitType')?.value === 'Tribe' ? 'Tribe' : 'Element';
      const code = document.getElementById('plannedUnitSplitCode')?.value.trim();
      const name = document.getElementById('plannedUnitSplitName')?.value.trim();
      const status = document.getElementById('plannedUnitSplitStatus');
      if (!code) {
        status.textContent = 'Enter the new unit code.';
        status.className = 'tm-validation error';
        return;
      }
      try {
        create.disabled = true;
        const split = await window.tribenet.addPlannedUnitSplit(state.turn.turnKey, {
          parentUnit: parent.unit,
          unitCode: code,
          unitType: type,
          unitName: name
        });
        state.selectedUnit = split.unitCode;
        await loadTurn(state.turn.turnKey);
        setStatus(`${split.unitType} ${split.unitCode} will split from ${split.parentUnit} at ${split.startHex}.`);
      } catch (error) {
        status.textContent = error.message || String(error);
        status.className = 'tm-validation error';
      } finally {
        create.disabled = false;
      }
      return;
    }

    const remove = event.target.closest('[data-remove-unit-split]');
    if (remove) {
      const id = Number(remove.dataset.removeUnitSplit);
      const split = (state.turn?.unitSplits || []).find(row => Number(row.id) === id);
      try {
        remove.disabled = true;
        const removed = await window.tribenet.deletePlannedUnitSplit(id);
        if (removed && String(state.selectedUnit).toLowerCase() === String(removed.unitCode).toLowerCase()) {
          state.selectedUnit = removed.parentUnit;
        }
        await loadTurn(state.turn.turnKey);
        setStatus(split ? `${split.unitCode} split removed; its saved movement/scouting routes were also cleared.` : 'Planned split removed.');
      } catch (error) {
        const status = document.getElementById('plannedUnitSplitStatus');
        status.textContent = error.message || String(error);
        status.className = 'tm-validation error';
      }
    }
  });

  return panel;
}

function plannedSplitSuggestedElement(parentUnit) {
  const existing = new Set(allUnits().map(unit => String(unit.unit).toLowerCase()));
  for (let number = 1; number < 100; number++) {
    const code = `${String(parentUnit).toLowerCase()}e${number}`;
    if (!existing.has(code)) return code;
  }
  return `${String(parentUnit).toLowerCase()}e1`;
}

function plannedSplitRenderPanel() {
  const panel = plannedSplitEnsurePanel();
  const body = document.getElementById('plannedUnitSplitBody');
  const origin = document.getElementById('plannedUnitSplitOrigin');
  const status = document.getElementById('plannedUnitSplitStatus');
  const unit = selected();

  if (!state.turn || !unit || (unit.type !== 'Tribe' && !unit.plannedSplit)) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  status.textContent = '';
  status.className = 'tm-validation';

  if (unit.plannedSplit) {
    origin.textContent = `Turn ${state.turn.turnKey}`;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <strong>${esc(unit.unit)} · planned ${esc(unit.type)}</strong>
          <div class="tm-muted" style="margin-top:4px">Splits from ${esc(unit.splitParentUnit)} at ${esc(unit.startHex || 'unknown')} before movement for this turn.</div>
        </div>
        <button class="button danger" data-remove-unit-split="${unit.splitId}">Remove Split</button>
      </div>
      <p class="tm-help" style="margin-bottom:0">This planned unit can already be selected independently in the Mapper's Movement Planner. Removing it also removes routes saved against this planned unit.</p>
    `;
    return;
  }

  const beginning = state.turn.start?.data?.units || [];
  const isBeginningTribe = beginning.some(row => String(row.unit).toLowerCase() === String(unit.unit).toLowerCase() && row.type === 'Tribe');
  if (!isBeginningTribe) {
    origin.textContent = 'Beginning workbook required';
    body.innerHTML = '<div class="history-empty">A split can only originate from a Tribe present in the beginning-of-turn workbook.</div>';
    return;
  }

  origin.textContent = `Starts at ${unit.startHex || 'unknown'}`;
  const children = (state.turn.unitSplits || []).filter(split => String(split.parentUnit).toLowerCase() === String(unit.unit).toLowerCase());
  const suggested = plannedSplitSuggestedElement(unit.unit);

  body.innerHTML = `
    <p class="tm-help" style="margin-top:0">The new unit is created at ${esc(unit.unit)}'s beginning-of-turn location (${esc(unit.startHex || 'unknown')}) and may then be moved separately. This does not invent population or goods transfers.</p>
    <div style="display:grid;grid-template-columns:minmax(140px,.7fr) minmax(160px,1fr) minmax(180px,1.4fr) auto;gap:10px;align-items:end">
      <label><span>New unit type</span><select id="plannedUnitSplitType" class="tm-full"><option value="Element">Element</option><option value="Tribe">Tribe</option></select></label>
      <label><span>Unit code</span><input id="plannedUnitSplitCode" class="tm-full" value="${esc(suggested)}" /></label>
      <label><span>Name (optional)</span><input id="plannedUnitSplitName" class="tm-full" placeholder="Optional unit name" /></label>
      <button id="createPlannedUnitSplit" class="button accent">Create Split</button>
    </div>
    <div id="plannedUnitSplitExisting" style="margin-top:12px">
      ${children.length ? children.map(split => `
        <div class="tm-activity" style="margin-top:8px">
          <div class="tm-activity-head"><strong>${esc(split.unitCode)} · ${esc(split.unitType)}</strong><span>${esc(split.startHex)}</span></div>
          <div class="tm-activity-meta">From ${esc(split.parentUnit)}${split.unitName ? ` · ${esc(split.unitName)}` : ''}</div>
          <div class="tm-activity-actions"><button class="button danger tm-mini" data-remove-unit-split="${split.id}">Remove</button></div>
        </div>
      `).join('') : '<div class="history-empty">No planned splits from this Tribe yet.</div>'}
    </div>
  `;

  const typeSelect = document.getElementById('plannedUnitSplitType');
  const codeInput = document.getElementById('plannedUnitSplitCode');
  typeSelect?.addEventListener('change', () => {
    if (typeSelect.value === 'Element') {
      codeInput.value = plannedSplitSuggestedElement(unit.unit);
      codeInput.placeholder = `${unit.unit}e1`;
    } else {
      codeInput.value = '';
      codeInput.placeholder = 'e.g. 1485';
    }
  });
}

const plannedSplitOriginalRenderAll = renderAll;
renderAll = function renderAllWithUnitSplits() {
  plannedSplitOriginalRenderAll();
  plannedSplitRenderPanel();
};

const plannedSplitOriginalValidateActivity = validateActivity;
validateActivity = function validateActivityWithSplitGuard() {
  const result = plannedSplitOriginalValidateActivity();
  const unit = selected();
  if (!unit?.plannedSplit) return result;
  const host = document.getElementById('activityValidation');
  if (host) {
    const extra = 'Population/goods have not yet been transferred into this planned split, so activity worker validation is unavailable.';
    host.textContent = [host.textContent, extra].filter(Boolean).join(' ');
    host.classList.add('warn');
  }
  return result;
};

plannedSplitEnsurePanel();
if (state.turn) {
  renderUnits();
  renderSelectedUnit();
  plannedSplitRenderPanel();
}

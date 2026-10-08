const savedMovementPlansState = {
  routes: [],
  selectedUnitCode: '',
  routeType: 'unit',
  turnKey: null,
  ready: false,
  scoutCount: 2,
  scoutHorses: 2,
  scoutMission: 'PATROL',
  smartScoutCount: 1,
  smartScoutPeople: 2,
  smartScoutHorses: 2,
  smartScoutMission: 'PATROL',
  smartScoutDrafts: [],
  smartScoutEditingIndex: null
};

function savedMovementEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function savedMovementRootTribe(unitCode) {
  const match = String(unitCode || '').match(/^(\d{4})/);
  return match ? match[1] : String(unitCode || '').trim();
}

function savedMovementRouteKey(route) {
  return typeof planRouteKey === 'function'
    ? planRouteKey(route)
    : String(route?.id ?? `${route?.routeType || 'route'}:${route?.unitCode || ''}:${route?.scoutNumber ?? ''}`);
}

function savedMovementCompareUnits(left, right) {
  const parse = unit => {
    const value = String(unit?.unitCode || unit?.unit || '').toLowerCase();
    const root = Number(value.slice(0, 4)) || 0;
    const suffix = value.slice(4);
    const typeOrder = suffix === '' ? 0 : suffix[0] === 'e' ? 1 : suffix[0] === 'f' ? 2 : suffix[0] === 'g' ? 3 : suffix[0] === 'c' ? 4 : 9;
    return [root, typeOrder, Number(suffix.slice(1)) || 0, value];
  };
  const a = parse(left); const b = parse(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3].localeCompare(b[3]);
}

function savedMovementCurrentTurnKey() {
  return resultsTimeline?.turn?.turnKey || state?.planImport?.turnKey || state?.planImport?.plan?.turnKey || null;
}

function savedMovementNormalizeUnit(unit, fallbackHex = null) {
  const unitCode = String(unit?.unitCode || unit?.unit || '').trim();
  const currentHex = unit?.currentHex || unit?.startHex || fallbackHex || null;
  if (!unitCode || !parseCoordinate(currentHex)) return null;
  return {
    ...unit,
    unitCode,
    unitType: unit?.unitType || unit?.type || 'Unit',
    currentHex
  };
}

function savedMovementUnits() {
  const byCode = new Map();
  const add = (unit, priority) => {
    const normalized = savedMovementNormalizeUnit(unit);
    if (!normalized) return;
    const existing = byCode.get(normalized.unitCode);
    if (!existing || priority >= existing.priority) byCode.set(normalized.unitCode, { unit: normalized, priority });
  };

  for (const unit of state?.planImport?.plan?.units || []) add(unit, 1);
  for (const movement of state?.planImport?.plan?.movements || []) add(movement, 2);
  for (const unit of resultsTimeline?.turn?.units || []) add(unit, 3);

  return [...byCode.values()].map(row => row.unit).sort(savedMovementCompareUnits);
}

function savedMovementSelectableUnits() {
  const units = savedMovementUnits();
  if (savedMovementPlansState.routeType !== 'unit') return units;
  return units.filter(unit => String(unit.unitType || unit.type || '').toLowerCase() !== 'garrison');
}

function savedMovementSelectedUnit() {
  return savedMovementSelectableUnits().find(unit => String(unit.unitCode) === String(savedMovementPlansState.selectedUnitCode)) || null;
}

function savedMovementCreationParents() {
  return savedMovementUnits().filter(unit => String(unit.unitType || unit.type) === 'Tribe' && !unit.plannedSplit);
}

async function savedMovementPopulateCreationForm() {
  const parentSelect = document.getElementById('movementPlannerCreateParent');
  if (!parentSelect) return;
  const parents = savedMovementCreationParents();
  parentSelect.innerHTML = parents.map(unit => `<option value="${savedMovementEscape(unit.unitCode)}">${savedMovementEscape(unit.unitCode)} · ${savedMovementEscape(unit.unitName || 'Tribe')}</option>`).join('');
  const selected = savedMovementSelectedUnit();
  if (selected && String(selected.unitType) === 'Tribe') parentSelect.value = selected.unitCode;
  const type = document.getElementById('movementPlannerCreateType');
  const code = document.getElementById('movementPlannerCreateCode');
  if (type && code && !code.value) code.value = type.value === 'Tribe' ? '1485' : `${parentSelect.value || '0000'}e1`;
  await savedMovementLoadCreationSkills();
}

async function savedMovementLoadCreationSkills() {
  const host = document.getElementById('movementPlannerCreateSkills');
  const parent = document.getElementById('movementPlannerCreateParent')?.value;
  const type = document.getElementById('movementPlannerCreateType')?.value;
  if (!host || !parent) return;
  host.innerHTML = '';
  if (type !== 'Tribe') return;
  try {
    const managed = savedMovementCurrentTurnKey() ? await window.tribenet.getManagedTurn(savedMovementCurrentTurnKey()) : null;
    const skills = managed?.start?.data?.skillsByTribe?.[savedMovementRootTribe(parent)] || [];
    if (!skills.length) {
      host.textContent = 'No source-Tribe skills were found in the Results baseline.';
      return;
    }
    host.innerHTML = '<span>Move entire skills to the new Tribe (optional)</span>' + skills.map((row, index) => `
      <label><input type="checkbox" data-creation-skill="${savedMovementEscape(row.skill || row.shortname || '')}" data-creation-level="${Number(row.level || 0)}" /> ${savedMovementEscape(row.skill || row.shortname)} ${Number(row.level || 0)}</label>
    `).join('');
  } catch (error) {
    host.textContent = `Could not load source skills: ${error.message || error}`;
  }
}

async function savedMovementCreateUnit() {
  const status = document.getElementById('movementPlannerCreateStatus');
  const turnKey = savedMovementCurrentTurnKey();
  const parentUnit = document.getElementById('movementPlannerCreateParent')?.value;
  const unitType = document.getElementById('movementPlannerCreateType')?.value;
  const unitCode = document.getElementById('movementPlannerCreateCode')?.value.trim().toLowerCase();
  const unitName = document.getElementById('movementPlannerCreateName')?.value.trim();
  const skills = [...document.querySelectorAll('#movementPlannerCreateSkills input[data-creation-skill]:checked')].map(input => ({
    skill: input.dataset.creationSkill, level: Number(input.dataset.creationLevel || 0)
  }));
  if (!turnKey || !parentUnit || !unitType || !unitCode) {
    if (status) status.textContent = 'Choose a source Tribe and enter a unit code.';
    return;
  }
  try {
    const created = await window.tribenet.addPlannedUnitSplit(turnKey, { parentUnit, unitCode, unitType, unitName, skills });
    savedMovementPlansState.selectedUnitCode = created.unitCode;
    await savedMovementRefresh();
    const form = document.getElementById('movementPlannerCreateForm');
    form?.classList.add('hidden');
    if (status) status.textContent = `${created.unitType} ${created.unitCode} created. Timing will be inferred from whether a Movement route is saved for it.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementUnitMove(unitCode) {
  return savedMovementPlansState.routes.find(route => route.routeType === 'unit' && String(route.unitCode) === String(unitCode)) || null;
}

function savedMovementOriginFor(
  unitCode = savedMovementPlansState.selectedUnitCode,
  routeType = savedMovementPlansState.routeType
) {
  const unit = savedMovementUnits().find(row => String(row.unitCode) === String(unitCode));
  if (!unit) return null;
  if (routeType === 'scout' || routeType === 'smart-scout') {
    const unitMove = savedMovementUnitMove(unitCode);
    if (unitMove?.destinationHex) return unitMove.destinationHex;
  }
  return unit.currentHex || null;
}

function savedMovementScoutUsesUnitMove() {
  return (savedMovementPlansState.routeType === 'scout' || savedMovementPlansState.routeType === 'smart-scout')
    && Boolean(savedMovementUnitMove(savedMovementPlansState.selectedUnitCode)?.destinationHex);
}

function savedMovementEnsureCardControls() {
  if (document.getElementById('movementPlannerSavePanel')) return;
  const note = document.getElementById('movementPlannerNote');
  if (!note) return;

  const panel = document.createElement('div');
  panel.id = 'movementPlannerSavePanel';
  panel.className = 'movement-planner-save-panel';
  panel.innerHTML = `
    <div class="movement-planner-setup-grid">
      <label class="movement-planner-field">
        <span>Unit</span>
        <select id="movementPlannerUnitSelect" aria-label="Movement unit"><option value="">Select unit…</option></select>
      </label>
      <label class="movement-planner-field">
        <span>Mode</span>
        <select id="movementPlannerRouteType" aria-label="Movement type">
          <option value="unit">Movement</option>
          <option value="scout">Scouting</option>
          <option value="smart-scout">Smart Scout</option>
        </select>
      </label>
      <label id="movementPlannerScoutCountField" class="movement-planner-field hidden">
        <span>People</span><input id="movementPlannerScoutCount" type="number" min="1" max="99" value="2" />
      </label>
      <label id="movementPlannerScoutHorsesField" class="movement-planner-field hidden">
        <span>Horses</span><input id="movementPlannerScoutHorses" type="number" min="0" max="99" value="2" />
      </label>
      <label id="movementPlannerScoutMissionField" class="movement-planner-field hidden">
        <span>Mission</span>
        <select id="movementPlannerScoutMission"><option>LOCATE</option><option selected>PATROL</option><option>RAID</option><option>SPY</option></select>
      </label>
      <label id="movementPlannerSmartScoutCountField" class="movement-planner-field hidden">
        <span>Scout rows</span><input id="movementPlannerSmartScoutCount" type="number" min="1" max="8" value="1" />
      </label>
      <label id="movementPlannerSmartScoutPeopleField" class="movement-planner-field hidden">
        <span>People per row</span><input id="movementPlannerSmartScoutPeople" type="number" min="1" max="99" value="2" />
      </label>
      <label id="movementPlannerSmartScoutHorsesField" class="movement-planner-field hidden">
        <span>Horses per row</span><input id="movementPlannerSmartScoutHorses" type="number" min="0" max="99" value="2" />
      </label>
      <label id="movementPlannerSmartScoutMissionField" class="movement-planner-field hidden">
        <span>Smart mission</span>
        <select id="movementPlannerSmartScoutMission"><option>LOCATE</option><option selected>PATROL</option><option>RAID</option><option>SPY</option></select>
      </label>
    </div>
    <div id="movementPlannerSmartScoutActions" class="movement-planner-smart-actions hidden">
      <button id="movementPlannerSmartScoutGenerate" class="button">Generate Smart Scout</button>
      <span>Scouting always starts after this unit’s saved Movement route, when one exists.</span>
    </div>
    <div class="movement-planner-create-row">
      <button id="movementPlannerNewUnit" class="button">Create unit</button>
      <button id="movementPlannerResetAllUnitChanges" class="button danger" disabled>Reset all unit changes</button>
      <span>Creation timing is inferred automatically: save a Movement route for the new unit to create it before movement; leave it without a route to create it after movement.</span>
      <span id="movementPlannerUnitChangesStatus"></span>
    </div>
    <div id="movementPlannerCreateForm" class="movement-planner-create-form hidden">
      <label class="movement-planner-field"><span>Source Tribe</span><select id="movementPlannerCreateParent"></select></label>
      <label class="movement-planner-field"><span>Type</span><select id="movementPlannerCreateType"><option>Element</option><option>Fleet</option><option>Garrison</option><option>Courier</option><option>Tribe</option></select></label>
      <label class="movement-planner-field"><span>Code</span><input id="movementPlannerCreateCode" placeholder="0485e1" /></label>
      <label class="movement-planner-field"><span>Name</span><input id="movementPlannerCreateName" placeholder="Optional" /></label>
      <div id="movementPlannerCreateSkills" class="movement-planner-create-skills"></div>
      <button id="movementPlannerCreateSubmit" class="button accent">Create</button>
      <span id="movementPlannerCreateStatus"></span>
    </div>
    <div id="movementPlannerOriginHint" class="movement-planner-origin-hint"></div>
    <div class="movement-planner-save-row">
      <button id="movementPlannerSaveRoute" class="button accent" disabled>Save Route</button>
      <button id="movementPlannerResetAll" class="button danger" disabled>Reset all movement</button>
      <span id="movementPlannerSaveStatus"></span>
    </div>
    <div id="movementPlannerScoutLimit" class="movement-planner-scout-limit"></div>
    <div id="movementPlannerSmartScoutDrafts" class="movement-planner-smart-drafts"></div>
    <div id="movementPlannerSavedList" class="movement-planner-saved-list"></div>
  `;
  note.insertAdjacentElement('afterend', panel);

  const unitSelect = document.getElementById('movementPlannerUnitSelect');
  const typeSelect = document.getElementById('movementPlannerRouteType');
  const scoutCount = document.getElementById('movementPlannerScoutCount');
  const scoutHorses = document.getElementById('movementPlannerScoutHorses');
  const scoutMission = document.getElementById('movementPlannerScoutMission');
  const smartScoutCount = document.getElementById('movementPlannerSmartScoutCount');
  const smartScoutPeople = document.getElementById('movementPlannerSmartScoutPeople');
  const smartScoutHorses = document.getElementById('movementPlannerSmartScoutHorses');
  const smartScoutMission = document.getElementById('movementPlannerSmartScoutMission');

  unitSelect.addEventListener('change', async () => {
    savedMovementPlansState.selectedUnitCode = unitSelect.value;
    state.selectedRouteId = null;
    savedMovementPlansState.smartScoutDrafts = [];
    savedMovementPlansState.smartScoutEditingIndex = null;
    savedMovementPopulateUnits();
    await savedMovementApplySelectedOrigin(true);
    savedMovementRenderSaveControls();
    movementPlannerUpdateButton();
  });

  typeSelect.addEventListener('change', async () => {
    savedMovementPlansState.routeType = ['scout', 'smart-scout'].includes(typeSelect.value) ? typeSelect.value : 'unit';
    state.selectedRouteId = null;
    savedMovementPlansState.smartScoutEditingIndex = null;
    if (savedMovementPlansState.routeType === 'smart-scout') {
      movementPlannerReset({ keepCard: true });
      savedMovementPopulateUnits();
      savedMovementRenderSetupPrompt();
      savedMovementRenderSaveControls();
      return;
    }
    savedMovementPopulateUnits();
    await savedMovementApplySelectedOrigin(true);
    savedMovementRenderSaveControls();
    movementPlannerUpdateButton();
  });

  for (const input of [scoutCount, scoutHorses, scoutMission]) input?.addEventListener('change', () => {
    savedMovementPlansState.scoutCount = Math.max(1, Number(scoutCount?.value || 2));
    savedMovementPlansState.scoutHorses = Math.max(0, Number(scoutHorses?.value || 2));
    savedMovementPlansState.scoutMission = String(scoutMission?.value || 'PATROL').toUpperCase();
    savedMovementRenderSaveControls();
  });

  for (const input of [smartScoutCount, smartScoutPeople, smartScoutHorses, smartScoutMission]) input?.addEventListener('change', () => {
    savedMovementPlansState.smartScoutCount = Math.max(1, Math.min(8, Number(smartScoutCount?.value || 1)));
    savedMovementPlansState.smartScoutPeople = Math.max(1, Number(smartScoutPeople?.value || 2));
    savedMovementPlansState.smartScoutHorses = Math.max(0, Number(smartScoutHorses?.value || 2));
    savedMovementPlansState.smartScoutMission = String(smartScoutMission?.value || 'PATROL').toUpperCase();
    savedMovementRenderSaveControls();
  });

  document.getElementById('movementPlannerNewUnit')?.addEventListener('click', async () => {
    const form = document.getElementById('movementPlannerCreateForm');
    form?.classList.toggle('hidden');
    if (form && !form.classList.contains('hidden')) await savedMovementPopulateCreationForm();
  });
  document.getElementById('movementPlannerCreateParent')?.addEventListener('change', savedMovementLoadCreationSkills);
  document.getElementById('movementPlannerCreateType')?.addEventListener('change', async () => {
    const parent = document.getElementById('movementPlannerCreateParent')?.value || '0000';
    const code = document.getElementById('movementPlannerCreateCode');
    if (code) code.value = document.getElementById('movementPlannerCreateType')?.value === 'Tribe' ? '1485' : `${parent}e1`;
    await savedMovementLoadCreationSkills();
  });
  document.getElementById('movementPlannerCreateSubmit')?.addEventListener('click', savedMovementCreateUnit);
  document.getElementById('movementPlannerResetAll')?.addEventListener('click', savedMovementResetAllMovement);
  document.getElementById('movementPlannerResetAllUnitChanges')?.addEventListener('click', savedMovementResetAllUnitChanges);

  document.getElementById('movementPlannerSmartScoutGenerate')?.addEventListener('click', savedMovementGenerateSmartScout);
  document.getElementById('movementPlannerSaveRoute').addEventListener('click', savedMovementSaveCurrentRoute);
  panel.addEventListener('click', async event => {
    const editSmart = event.target.closest('[data-edit-smart-scout]');
    if (editSmart) {
      savedMovementEditSmartScoutDraft(Number(editSmart.dataset.editSmartScout));
      return;
    }
    const removeSmart = event.target.closest('[data-remove-smart-scout]');
    if (removeSmart) {
      savedMovementPlansState.smartScoutDrafts.splice(Number(removeSmart.dataset.removeSmartScout), 1);
      savedMovementPlansState.smartScoutEditingIndex = null;
      movementPlannerReset({ keepCard: true });
      savedMovementRenderSaveControls();
      return;
    }
    const selectedRoute = event.target.closest('[data-select-planned-route]');
    if (selectedRoute && !event.target.closest('[data-remove-planned-route]')) {
      savedMovementSelectSavedRoute(selectedRoute.dataset.selectPlannedRoute);
      return;
    }
    const button = event.target.closest('[data-remove-planned-route]');
    if (!button) return;
    await window.tribenet.removePlannedRoute(Number(button.dataset.removePlannedRoute));
    await savedMovementRefresh();
    const status = document.getElementById('movementPlannerSaveStatus');
    if (status) status.textContent = 'Saved route removed.';
  });
}

function savedMovementSelectSavedRoute(routeKey) {
  const route = savedMovementPlansState.routes.find(item => savedMovementRouteKey(item) === String(routeKey));
  if (!route) return;
  state.selectedRouteId = savedMovementRouteKey(route);
  state.selectedUnit = route.unitCode || route.unit || null;
  const origin = parseCoordinate(route.originHex || route.startHex);
  state.selectedUnitHex = origin?.coordinate || null;
  if (origin) centerOnHex(origin.globalCol, origin.globalRow);
  draw();
}

function savedMovementPopulateUnits() {
  savedMovementEnsureCardControls();
  const select = document.getElementById('movementPlannerUnitSelect');
  const typeSelect = document.getElementById('movementPlannerRouteType');
  const hint = document.getElementById('movementPlannerOriginHint');
  if (!select || !typeSelect) return;

  const units = savedMovementSelectableUnits();
  const previous = savedMovementPlansState.selectedUnitCode;
  select.innerHTML = '<option value="">Select unit…</option>' + units.map(unit =>
    `<option value="${savedMovementEscape(unit.unitCode)}">${savedMovementEscape(unit.unitCode)} · ${savedMovementEscape(unit.unitType || 'Unit')} · ${savedMovementEscape(unit.currentHex || 'Unknown')}</option>`
  ).join('');

  if (previous && units.some(unit => String(unit.unitCode) === String(previous))) {
    select.value = previous;
  } else {
    savedMovementPlansState.selectedUnitCode = '';
    select.value = '';
  }

  typeSelect.value = savedMovementPlansState.routeType;
  const selectedUnit = savedMovementSelectedUnit();
  const unitMove = selectedUnit ? savedMovementUnitMove(selectedUnit.unitCode) : null;
  const scoutFields = [
    document.getElementById('movementPlannerScoutCountField'),
    document.getElementById('movementPlannerScoutHorsesField'),
    document.getElementById('movementPlannerScoutMissionField')
  ];
  for (const field of scoutFields) field?.classList.toggle('hidden', savedMovementPlansState.routeType !== 'scout' || savedMovementPlansState.smartScoutEditingIndex != null);
  const smartFields = [
    document.getElementById('movementPlannerSmartScoutCountField'),
    document.getElementById('movementPlannerSmartScoutPeopleField'),
    document.getElementById('movementPlannerSmartScoutHorsesField'),
    document.getElementById('movementPlannerSmartScoutMissionField'),
    document.getElementById('movementPlannerSmartScoutActions')
  ];
  for (const field of smartFields) field?.classList.toggle('hidden', savedMovementPlansState.routeType !== 'smart-scout');
  const values = {
    movementPlannerScoutCount: savedMovementPlansState.scoutCount,
    movementPlannerScoutHorses: savedMovementPlansState.scoutHorses,
    movementPlannerScoutMission: savedMovementPlansState.scoutMission,
    movementPlannerSmartScoutCount: savedMovementPlansState.smartScoutCount,
    movementPlannerSmartScoutPeople: savedMovementPlansState.smartScoutPeople,
    movementPlannerSmartScoutHorses: savedMovementPlansState.smartScoutHorses,
    movementPlannerSmartScoutMission: savedMovementPlansState.smartScoutMission
  };
  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (field && document.activeElement !== field) field.value = value;
  }

  select.disabled = !units.length;
  typeSelect.disabled = !units.length;

  if (hint) {
    if (!units.length) {
      hint.textContent = `No units with a known location are available for ${savedMovementCurrentTurnKey() ? `Turn ${savedMovementCurrentTurnKey()}` : 'this map'}. Import/reprocess that turn's results or orders workbook.`;
    } else if (!selectedUnit) {
      hint.textContent = 'Select a unit. Its known location becomes the movement origin.';
    } else {
      const origin = savedMovementOriginFor();
      const scout = savedMovementPlansState.routeType !== 'unit';
      const source = scout && savedMovementScoutUsesUnitMove() ? 'saved Movement destination' : 'current unit location';
      hint.textContent = `${selectedUnit.unitCode} · ${savedMovementPlansState.routeType === 'smart-scout' ? 'Smart Scout' : savedMovementPlansState.routeType === 'scout' ? 'Scouting' : 'Movement'} · origin ${origin || 'unknown'}${scout ? ` (${source})` : ''}`;
    }
  }
}

async function savedMovementRefresh() {
  savedMovementEnsureCardControls();
  const turnKey = savedMovementCurrentTurnKey();
  savedMovementPlansState.turnKey = turnKey;
  savedMovementPlansState.routes = turnKey ? await window.tribenet.listPlannedRoutes(turnKey) : [];
  if (state.selectedRouteId != null && !savedMovementPlansState.routes.some(route => savedMovementRouteKey(route) === String(state.selectedRouteId))) {
    state.selectedRouteId = null;
  }
  savedMovementPopulateUnits();
  savedMovementRenderSaveControls();
  savedMovementPlansState.ready = true;
  movementPlannerUpdateButton();
  draw();
}

function savedMovementSmartDraftDestination(draft) {
  return draft?.destinationHex || draft?.targetCoordinate || draft?.path?.[draft.path.length - 1]?.coordinate || null;
}

function savedMovementRenderSmartDrafts() {
  const host = document.getElementById('movementPlannerSmartScoutDrafts');
  if (!host) return;
  const drafts = savedMovementPlansState.smartScoutDrafts || [];
  if (savedMovementPlansState.routeType !== 'smart-scout' && savedMovementPlansState.smartScoutEditingIndex == null) {
    host.innerHTML = '';
    return;
  }
  if (!drafts.length) {
    host.innerHTML = '<div class="movement-planner-smart-empty">No Smart Scout draft routes yet. Generate routes to review them before saving.</div>';
    return;
  }
  host.innerHTML = `<div class="movement-planner-smart-heading"><strong>Smart Scout draft routes</strong><span>${drafts.length}/8 rows · edit before saving</span></div>${drafts.map((draft, index) => {
    const scenario = draft.scenarioMp || {};
    const coverage = Number(draft.coverageCount || draft.coverage?.length || 0);
    const routeLabel = draft.specialOrder ? ` · ${draft.specialOrder} considered` : '';
    return `<div class="movement-planner-smart-draft">
      <div><strong>Row ${index + 1}</strong><span>${savedMovementEscape(draft.originHex || draft.origin || '—')} → ${savedMovementEscape(savedMovementSmartDraftDestination(draft) || '—')}</span></div>
      <small>${savedMovementEscape((draft.directions || []).join(' → '))}</small>
      <small>${coverage} unique reveal${coverage === 1 ? '' : 's'}${routeLabel} · ${Number(draft.knownMp || 0)} MP · bad weather ${Number(draft.badWeatherMp || draft.knownMp || 0)} MP · unknown what-if ${Number(scenario.low || draft.estimatedMp || 0)}–${Number(scenario.high || draft.worstCaseMp || 0)} MP</small>
      <div class="movement-planner-smart-draft-actions"><button class="button" data-edit-smart-scout="${index}">Edit route</button><button class="button danger" data-remove-smart-scout="${index}">Remove</button></div>
    </div>`;
  }).join('')}`;
}

async function savedMovementGenerateSmartScout() {
  const status = document.getElementById('movementPlannerSaveStatus');
  const unit = savedMovementSelectedUnit();
  const origin = unit ? savedMovementOriginFor(unit.unitCode, 'smart-scout') : null;
  if (!unit || !origin) {
    if (status) status.textContent = 'Select a unit with a known Movement/scouting origin first.';
    return;
  }
  if (typeof SmartScoutCore === 'undefined') {
    if (status) status.textContent = 'Smart Scout is not available until the mapper finishes loading.';
    return;
  }
  try {
    const known = await movementPlannerLoadKnowledge();
    const result = SmartScoutCore.generate([...known.values()], origin, {
      unitCode: unit.unitCode,
      scoutCount: savedMovementPlansState.smartScoutCount,
      noOfScouts: savedMovementPlansState.smartScoutPeople,
      noOfHorses: savedMovementPlansState.smartScoutHorses,
      mission: savedMovementPlansState.smartScoutMission,
      maxCommands: 9
    });
    savedMovementPlansState.smartScoutDrafts = result.routes.map(route => ({
      ...route,
      unitCode: unit.unitCode,
      originHex: origin,
      destinationHex: savedMovementSmartDraftDestination(route)
    }));
    savedMovementPlansState.smartScoutEditingIndex = null;
    movementPlannerReset({ keepCard: true });
    savedMovementRenderSaveControls();
    savedMovementRenderSetupPrompt();
    if (status) status.textContent = `${result.routes.length} Smart Scout route${result.routes.length === 1 ? '' : 's'} generated for review${result.warnings.length ? `. ${result.warnings.join(' ')}` : '.'}`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementEditSmartScoutDraft(index) {
  const draft = savedMovementPlansState.smartScoutDrafts?.[index];
  const point = parseCoordinate(draft?.originHex || draft?.origin);
  if (!draft || !point) return;
  savedMovementPlansState.selectedUnitCode = draft.unitCode || savedMovementPlansState.selectedUnitCode;
  savedMovementPlansState.routeType = 'scout';
  savedMovementPlansState.smartScoutEditingIndex = index;
  savedMovementPlansState.scoutCount = Math.max(1, Number(draft.noOfScouts || 2));
  savedMovementPlansState.scoutHorses = Math.max(0, Number(draft.noOfHorses || 2));
  savedMovementPlansState.scoutMission = String(draft.mission || 'PATROL').toUpperCase();
  movementPlannerState.active = true;
  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = { ...draft, status: 'ok', origin: point.coordinate, requestedTarget: savedMovementSmartDraftDestination(draft), actualTarget: savedMovementSmartDraftDestination(draft) };
  savedMovementPopulateUnits();
  movementPlannerUpdateButton();
  movementPlannerRenderCard(movementPlannerState.route);
  movementPlannerSetStatus(`Editing Smart Scout row ${index + 1} · click a destination or Shift-click to append`);
  savedMovementRenderSaveControls();
  draw();
}

async function savedMovementSaveSmartScout() {
  const status = document.getElementById('movementPlannerSaveStatus');
  const unit = savedMovementSelectedUnit();
  const turnKey = savedMovementCurrentTurnKey();
  const drafts = savedMovementPlansState.smartScoutDrafts || [];
  if (!unit || !turnKey || !drafts.length) return;
  const invalid = drafts.find(draft => !draft.directions?.length || draft.directions.length > 9 || draft.directions.some(order => order === 'GOTO' || !SmartScoutCore.VALID_SCOUT_ORDERS.has(order)));
  if (invalid) {
    if (status) status.textContent = 'A Smart Scout draft contains an invalid or empty scouting order. Edit or remove it before saving.';
    return;
  }
  const existing = savedMovementPlansState.routes.filter(route => route.routeType === 'scout' && String(route.unitCode).toLowerCase() === String(unit.unitCode).toLowerCase());
  const group = savedMovementScoutGroupStatus();
  const otherGroupRoutes = Math.max(0, Number(group?.count || 0) - existing.length);
  if (otherGroupRoutes + drafts.length > 8) {
    if (status) status.textContent = `The Tribe scout limit is 8 rows; this replacement would require ${otherGroupRoutes + drafts.length}.`;
    return;
  }
  if (existing.length && !window.confirm(`Replace ${existing.length} existing scouting route${existing.length === 1 ? '' : 's'} for ${unit.unitCode} with these ${drafts.length} Smart Scout route${drafts.length === 1 ? '' : 's'}?`)) return;
  try {
    if (existing.length) await window.tribenet.removeAllScoutRoutesForUnit(turnKey, unit.unitCode);
    for (const draft of drafts) {
      await window.tribenet.savePlannedRoute({
        turnKey,
        tribeCode: savedMovementRootTribe(unit.unitCode),
        unitCode: unit.unitCode,
        routeType: 'scout',
        originHex: draft.originHex || draft.origin,
        destinationHex: savedMovementSmartDraftDestination(draft),
        directions: draft.directions,
        path: draft.path,
        knownMp: Number(draft.knownMp || 0),
        badWeatherMp: Number(draft.badWeatherMp || draft.knownMp || 0),
        noOfScouts: Math.max(1, Number(draft.noOfScouts || 2)),
        noOfHorses: Math.max(0, Number(draft.noOfHorses || 2)),
        mission: String(draft.mission || 'PATROL').toUpperCase(),
        unknownEntryCount: Number(draft.unknownEntryCount || 0)
      });
    }
    savedMovementPlansState.smartScoutDrafts = [];
    savedMovementPlansState.smartScoutEditingIndex = null;
    movementPlannerReset({ keepCard: true });
    await savedMovementRefresh();
    savedMovementRenderSetupPrompt();
    if (status) status.textContent = `${drafts.length} Smart Scout route${drafts.length === 1 ? '' : 's'} saved for ${unit.unitCode}.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementUpdateSmartScoutDraft() {
  const index = savedMovementPlansState.smartScoutEditingIndex;
  const draft = savedMovementPlansState.smartScoutDrafts?.[index];
  const route = movementPlannerState.route;
  if (index == null || !draft || route?.status !== 'ok' || !route.directions?.length) return false;
  savedMovementPlansState.smartScoutDrafts[index] = {
    ...draft,
    ...route,
    unitCode: draft.unitCode || savedMovementPlansState.selectedUnitCode,
    originHex: movementPlannerState.origin?.coordinate || draft.originHex,
    destinationHex: route.actualTarget || route.path?.[route.path.length - 1]?.coordinate,
    noOfScouts: savedMovementPlansState.scoutCount,
    noOfHorses: savedMovementPlansState.scoutHorses,
    mission: savedMovementPlansState.scoutMission,
    coverage: draft.coverage || [],
    coverageCount: draft.coverageCount || 0
  };
  savedMovementPlansState.smartScoutEditingIndex = null;
  savedMovementPlansState.routeType = 'smart-scout';
  movementPlannerReset({ keepCard: true });
  savedMovementPopulateUnits();
  savedMovementRenderSetupPrompt();
  savedMovementRenderSaveControls();
  return true;
}

function savedMovementScoutGroupStatus() {
  const unit = savedMovementSelectedUnit();
  if (!unit) return null;
  const tribeCode = savedMovementRootTribe(unit.unitCode);
  const scouts = savedMovementPlansState.routes.filter(route =>
    route.routeType === 'scout'
    && String(route.tribeCode || savedMovementRootTribe(route.unitCode)) === tribeCode
  );
  return { tribeCode, count: scouts.length, remaining: Math.max(0, 8 - scouts.length) };
}

function savedMovementRenderSaveControls() {
  savedMovementEnsureCardControls();
  const saveButton = document.getElementById('movementPlannerSaveRoute');
  const resetButton = document.getElementById('movementPlannerResetAll');
  const resetUnitChangesButton = document.getElementById('movementPlannerResetAllUnitChanges');
  const limit = document.getElementById('movementPlannerScoutLimit');
  const list = document.getElementById('movementPlannerSavedList');
  if (!saveButton || !limit || !list) return;

  const unit = savedMovementSelectedUnit();
  const route = movementPlannerState.route;
  const type = savedMovementPlansState.routeType;
  const smart = type === 'smart-scout';
  const editingSmart = savedMovementPlansState.smartScoutEditingIndex != null;
  const scoutStatus = savedMovementScoutGroupStatus();
  const stationary = String(unit?.unitType || unit?.type || '') === 'Garrison' && type === 'unit';
  const scoutCount = Math.max(1, Number(document.getElementById('movementPlannerScoutCount')?.value || savedMovementPlansState.scoutCount || 1));
  const scoutHorses = Math.max(0, Number(document.getElementById('movementPlannerScoutHorses')?.value || savedMovementPlansState.scoutHorses || 0));
  const canSave = Boolean(
    unit && !stationary && savedMovementCurrentTurnKey()
    && (smart
      ? savedMovementPlansState.smartScoutDrafts?.length > 0
      : route?.status === 'ok' && route.directions?.length
        && (type !== 'scout' || editingSmart || (scoutStatus && scoutStatus.count < 8 && scoutHorses <= scoutCount)))
  );

  saveButton.textContent = smart ? 'Save Smart Scout' : editingSmart ? 'Update Smart Scout row' : type === 'scout' ? 'Save Scout Move' : 'Save Unit Move';
  saveButton.disabled = !canSave;
  saveButton.title = !unit
    ? 'Select a unit first.'
    : stationary
      ? 'Garrisons are stationary and use Still.'
      : !route?.directions?.length
        ? smart ? 'Generate Smart Scout routes first.' : 'Plan at least one movement command first.'
      : type === 'scout' && scoutStatus?.count >= 8
        ? `Tribe ${scoutStatus.tribeCode} has already used all 8 scout moves this turn.`
        : type === 'scout' && scoutHorses > scoutCount
          ? 'Horses cannot exceed the number of scouts.'
          : '';

  const unitRouteCount = savedMovementPlansState.routes.filter(item => item.routeType === 'unit').length;
  if (resetButton) {
    resetButton.disabled = !savedMovementCurrentTurnKey() || unitRouteCount === 0;
    resetButton.title = unitRouteCount ? `Remove all ${unitRouteCount} saved Movement route${unitRouteCount === 1 ? '' : 's'} for this turn. Scouting routes will be kept.` : 'No saved Movement routes for this turn.';
  }

  const unitChangeCount = (savedMovementPlansState.unitSplits || []).length;
  if (resetUnitChangesButton) {
    resetUnitChangesButton.disabled = !savedMovementCurrentTurnKey() || unitChangeCount === 0;
    resetUnitChangesButton.title = unitChangeCount
      ? `Remove all ${unitChangeCount} unit${unitChangeCount === 1 ? '' : 's'} created for this turn, including their saved routes.`
      : 'No units created for this turn.';
  }

  if (smart) {
    limit.textContent = unit
      ? `Smart Scout creates ${savedMovementPlansState.smartScoutDrafts?.length || 0}/${savedMovementPlansState.smartScoutCount} draft row${savedMovementPlansState.smartScoutCount === 1 ? '' : 's'} · ${savedMovementPlansState.smartScoutPeople}/${savedMovementPlansState.smartScoutHorses} people/horses per row · replaces existing scouting only when saved`
      : 'Select a unit to generate Smart Scout routes.';
  } else if (type === 'scout') {
    limit.textContent = scoutStatus
      ? `Tribe ${scoutStatus.tribeCode} scout moves: ${scoutStatus.count}/8 · shared by the Tribe and linked Elements`
      : 'Select a unit to see its Tribe scout allowance.';
  } else {
    limit.textContent = unit
      ? stationary
        ? 'Garrisons are stationary and will be exported with Still as MOVEMENT_1.'
        : 'Unit Move is independent of scouting. Saving again replaces this unit’s saved move for the turn.'
      : 'Select a unit to record movement for this turn.';
  }

  savedMovementRenderSmartDrafts();

  if (!unit) {
    list.innerHTML = '<div class="movement-planner-saved-empty">Select a unit to view saved movement for this turn.</div>';
    return;
  }

  const rows = savedMovementPlansState.routes.filter(item => String(item.unitCode) === String(unit.unitCode));
  if (!rows.length) {
    list.innerHTML = '<div class="movement-planner-saved-empty">No saved routes for this unit on this turn.</div>';
    return;
  }

  list.innerHTML = rows.map(item => {
    const label = item.routeType === 'scout' ? `Scout ${item.scoutNumber}` : 'Unit Move';
    const mp = `${item.knownMp}${item.unknownEntryCount ? ` + ?×${item.unknownEntryCount}` : ''} MP`;
    const commands = item.directions.join(' → ');
    const routeKey = savedMovementRouteKey(item);
    const selected = String(state.selectedRouteId || '') === routeKey;
    return `
      <div class="movement-planner-saved-route${selected ? ' selected' : ''}" data-select-planned-route="${savedMovementEscape(routeKey)}" role="button" tabindex="0" title="Highlight this route on the map">
        <div><strong>${savedMovementEscape(label)}</strong><span>${savedMovementEscape(item.originHex)} → ${savedMovementEscape(item.destinationHex)} · ${savedMovementEscape(mp)}</span></div>
        <small>${savedMovementEscape(commands)}</small>
        <button class="button danger movement-planner-remove-route" data-remove-planned-route="${item.id}">Remove</button>
      </div>
    `;
  }).join('');
}

async function savedMovementResetAllMovement() {
  const turnKey = savedMovementCurrentTurnKey();
  const status = document.getElementById('movementPlannerSaveStatus');
  if (!turnKey) {
    if (status) status.textContent = 'Select or import a planning turn first.';
    return;
  }
  const count = savedMovementPlansState.routes.filter(item => item.routeType === 'unit').length;
  if (!count) {
    if (status) status.textContent = 'No saved Movement routes to reset.';
    return;
  }
  if (!window.confirm(`Reset all ${count} saved Movement route${count === 1 ? '' : 's'} for Turn ${turnKey}? Scouting routes will be kept.`)) return;
  try {
    const removed = await window.tribenet.removeAllUnitRoutes(turnKey);
    if (movementPlannerState.active) movementPlannerReset();
    await savedMovementRefresh();
    if (status) status.textContent = `${removed} Movement route${removed === 1 ? '' : 's'} reset. Scouting routes were kept.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

async function savedMovementResetAllUnitChanges() {
  const turnKey = savedMovementCurrentTurnKey();
  const status = document.getElementById('movementPlannerUnitChangesStatus');
  const count = (savedMovementPlansState.unitSplits || []).length;
  if (!turnKey) {
    if (status) status.textContent = 'Select or import a planning turn first.';
    return;
  }
  if (!count) {
    if (status) status.textContent = 'No created units to reset.';
    return;
  }
  if (!window.confirm(`Reset all ${count} unit change${count === 1 ? '' : 's'} for Turn ${turnKey}? Their saved routes will also be removed.`)) return;
  try {
    if (movementPlannerState.active) movementPlannerReset({ keepCard: true });
    const removed = await window.tribenet.deleteAllPlannedUnitSplits(turnKey);
    savedMovementPlansState.selectedUnitCode = '';
    await savedMovementRefresh();
    savedMovementRenderSetupPrompt();
    if (status) status.textContent = `${removed.length} created unit${removed.length === 1 ? '' : 's'} reset. Their saved routes were removed.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementRenderSetupPrompt() {
  const card = document.getElementById('movementPlannerCard');
  const title = document.getElementById('movementPlannerTitle');
  const summary = document.getElementById('movementPlannerSummary');
  const routeText = document.getElementById('movementPlannerDirections');
  const note = document.getElementById('movementPlannerNote');
  card?.classList.remove('hidden');

  const unit = savedMovementSelectedUnit();
  const origin = savedMovementOriginFor();
  if (title) title.textContent = unit
    ? `${savedMovementPlansState.routeType === 'smart-scout' ? 'Smart Scout' : savedMovementPlansState.routeType === 'scout' ? 'Scouting' : 'Movement'} from ${origin || '—'}`
    : 'Movement';
  if (summary) summary.textContent = unit
    ? savedMovementPlansState.routeType === 'smart-scout' ? 'Generate Smart Scout routes, review/edit the drafts, then save them.' : 'Click Movement, then choose a destination.'
    : 'Select a unit below, choose Movement, Scouting, or Smart Scout, then choose the route.';
  movementPlannerRenderAllowances(null);
  if (routeText) routeText.textContent = '';
  if (note) {
    note.textContent = savedMovementPlansState.routeType === 'scout' || savedMovementPlansState.routeType === 'smart-scout'
      ? (savedMovementScoutUsesUnitMove()
        ? 'Scouting always starts after the saved Movement route. The saved Movement destination is the scouting origin.'
        : 'Scouting always happens after movement. With no saved Movement route, the current unit location is used.')
      : 'Unit movement and scouting are saved separately for the selected turn.';
  }
  savedMovementPopulateUnits();
  savedMovementRenderSaveControls();
}

async function savedMovementApplySelectedOrigin(center = false) {
  const coordinate = savedMovementOriginFor();
  if (!coordinate) {
    savedMovementRenderSetupPrompt();
    return;
  }
  const point = parseCoordinate(coordinate);
  if (!point) return;

  const unitMove = savedMovementScoutUsesUnitMove() ? savedMovementUnitMove(savedMovementPlansState.selectedUnitCode) : null;
  const last = unitMove?.path?.[unitMove.path.length - 1];
  const originIsUnknown = Boolean(savedMovementScoutUsesUnitMove() && last?.terrain === 'UNKNOWN');
  const wasActive = movementPlannerState.active;

  if (!originIsUnknown) {
    if (wasActive) movementPlannerState.active = false;
    try {
      await selectHex(point.globalCol, point.globalRow);
    } finally {
      movementPlannerState.active = wasActive;
    }
  }
  if (center) centerOnHex(point.globalCol, point.globalRow);

  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = null;

  if (wasActive && originIsUnknown) {
    savedMovementActivateUnknownOrigin(coordinate);
    return;
  }

  if (wasActive) {
    movementPlannerUpdateButton();
    movementPlannerSetStatus(`${savedMovementPlansState.routeType === 'scout' || savedMovementPlansState.routeType === 'smart-scout' ? 'Scout' : 'Unit'} origin ${point.coordinate} · click a destination`);
  }
  savedMovementRenderSetupPrompt();
  draw();
}

function savedMovementActivateUnknownOrigin(coordinate) {
  const point = parseCoordinate(coordinate);
  if (!point) return;
  movementPlannerState.active = true;
  movementPlannerState.origin = { coordinate: point.coordinate, globalCol: point.globalCol, globalRow: point.globalRow };
  movementPlannerState.route = {
    status: 'ok',
    origin: point.coordinate,
    requestedTarget: point.coordinate,
    actualTarget: point.coordinate,
    targetIsUnknown: true,
    path: [{
      coordinate: point.coordinate,
      globalCol: point.globalCol,
      globalRow: point.globalRow,
      terrain: 'UNKNOWN',
      entryMp: 0,
      cumulativeMp: 0,
      knownCumulativeMp: 0,
      unknownCumulativeCount: 0,
      kind: 'approx'
    }],
    directions: [],
    steps: 0,
    knownMp: 0,
    unknownEntryCount: 0,
    totalMp: 0
  };
  movementPlannerUpdateButton();
  movementPlannerRenderCard(movementPlannerState.route);
  movementPlannerSetStatus(`Scout origin ${point.coordinate} is fog · Shift-click an adjacent hex to add commands`);
  savedMovementRenderSaveControls();
  draw();
}

async function savedMovementSaveCurrentRoute() {
  const unit = savedMovementSelectedUnit();
  const route = movementPlannerState.route;
  const turnKey = savedMovementCurrentTurnKey();
  const status = document.getElementById('movementPlannerSaveStatus');
  if (savedMovementPlansState.routeType === 'smart-scout') {
    await savedMovementSaveSmartScout();
    return;
  }
  if (!unit || !turnKey || route?.status !== 'ok' || !route.directions?.length) return;
  if (savedMovementPlansState.smartScoutEditingIndex != null) {
    if (savedMovementUpdateSmartScoutDraft() && status) status.textContent = 'Smart Scout draft updated. Review it before saving the rows.';
    return;
  }
  if (savedMovementPlansState.routeType === 'unit' && String(unit.unitType || unit.type || '').toLowerCase() === 'garrison') {
    savedMovementSetStationaryStatus();
    return;
  }

  const payload = {
    turnKey,
    tribeCode: savedMovementRootTribe(unit.unitCode),
    unitCode: unit.unitCode,
    routeType: savedMovementPlansState.routeType,
    originHex: movementPlannerState.origin?.coordinate || route.origin,
    destinationHex: route.actualTarget || route.path?.[route.path.length - 1]?.coordinate,
    directions: route.directions,
    path: route.path,
    knownMp: Number(route.knownMp ?? route.totalMp ?? 0),
    badWeatherMp: Number(route.badWeatherMp ?? route.knownMp ?? route.totalMp ?? 0),
    noOfScouts: savedMovementPlansState.routeType === 'scout' ? Math.max(1, Number(document.getElementById('movementPlannerScoutCount')?.value || 1)) : null,
    noOfHorses: savedMovementPlansState.routeType === 'scout' ? Math.max(0, Number(document.getElementById('movementPlannerScoutHorses')?.value || 0)) : null,
    mission: savedMovementPlansState.routeType === 'scout' ? String(document.getElementById('movementPlannerScoutMission')?.value || 'PATROL').toUpperCase() : null,
    unknownEntryCount: Number(route.unknownEntryCount || 0)
  };

  try {
    const saved = await window.tribenet.savePlannedRoute(payload);
    if (movementPlannerState.active) movementPlannerReset({ keepCard: true });
    await savedMovementRefresh();
    savedMovementRenderSetupPrompt();
    if (status) status.textContent = saved.routeType === 'scout'
      ? `Scout ${saved.scoutNumber} saved for ${saved.unitCode}.`
      : `Unit Move saved for ${saved.unitCode}.`;
  } catch (error) {
    if (status) status.textContent = error.message || String(error);
  }
}

function savedMovementSetStationaryStatus() {
  const status = document.getElementById('movementPlannerSaveStatus');
  if (status) status.textContent = 'Garrisons are stationary; MOVEMENT_1 will be Still.';
}

function savedMovementDrawLabel(point, text, color) {
  if (!point) return;
  const p = screenFromBase(baseCenter(point.globalCol, point.globalRow));
  ctx.save();
  ctx.font = `800 ${Math.max(8, Math.min(11, state.scale * .27))}px Segoe UI`;
  const width = ctx.measureText(text).width + 10;
  const x = p.x - width / 2;
  const y = p.y - state.scale * .35;
  roundedRect(ctx, x, y, width, 17, 5);
  ctx.fillStyle = 'rgba(8,17,22,.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + 8.5);
  ctx.restore();
}

function savedMovementDrawOverlay() {
  if (state.mode !== 'detail' || !savedMovementPlansState.routes.length) return;
  for (const route of savedMovementPlansState.routes) {
    if (route.routeType === 'unit' && !state.planningVisible) continue;
    if (route.routeType === 'scout' && (!state.planningVisible || !state.scoutingVisible)) continue;
    const scout = route.routeType === 'scout';
    const color = scout ? '#78c9e6' : '#f0b45e';
    drawRoute(route.path, {
      color,
      width: Math.max(1.8, state.scale * (scout ? .07 : .09)),
      alpha: .58,
      dashed: scout
    });
    const end = route.path?.[route.path.length - 1];
    savedMovementDrawLabel(end, scout ? `S${route.scoutNumber} ${route.unitCode}` : `M ${route.unitCode}`, color);
  }
}

const savedMovementOriginalDraw = draw;
draw = function drawWithSavedMovementPlans() {
  savedMovementOriginalDraw();
  savedMovementDrawOverlay();
};

const savedMovementOriginalRenderCard = movementPlannerRenderCard;
movementPlannerRenderCard = function movementPlannerRenderCardWithSave(result) {
  savedMovementOriginalRenderCard(result);
  savedMovementPopulateUnits();
  savedMovementRenderSaveControls();
};

const savedMovementOriginalReset = movementPlannerReset;
movementPlannerReset = function movementPlannerResetWithSave(options = {}) {
  savedMovementOriginalReset(options);
  savedMovementRenderSaveControls();
};

const savedMovementOriginalUpdateButton = movementPlannerUpdateButton;
movementPlannerUpdateButton = function movementPlannerUpdateButtonWithUnits() {
  savedMovementOriginalUpdateButton();
  const button = document.getElementById('movementPlannerButton');
  if (!button || movementPlannerState.active) return;
  if (savedMovementUnits().length) {
    button.disabled = false;
    button.title = savedMovementPlansState.selectedUnitCode
      ? `Plan ${savedMovementPlansState.routeType === 'scout' ? 'scouting' : 'movement'} for ${savedMovementPlansState.selectedUnitCode}`
      : 'Open Movement and select a unit';
  }
};

const savedMovementOriginalApplyResultTurn = applyResultTurn;
applyResultTurn = async function applyResultTurnWithSavedPlans(turnKey, options = {}) {
  const result = await savedMovementOriginalApplyResultTurn(turnKey, options);
  movementPlannerState.knownHexes = null;
  movementPlannerState.knowledgeKey = null;
  if (movementPlannerState.active) movementPlannerReset();
  await savedMovementRefresh();
  return result;
};

const savedMovementPlannerButton = document.getElementById('movementPlannerButton');
if (savedMovementPlannerButton) {
  savedMovementPlannerButton.addEventListener('click', async event => {
    if (movementPlannerState.active) return;

    if (!savedMovementPlansState.selectedUnitCode) {
      if (!state.selected && savedMovementUnits().length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        savedMovementRenderSetupPrompt();
        movementPlannerSetStatus('Select a unit in the planner card.');
      }
      return;
    }

    if (savedMovementPlansState.routeType === 'smart-scout') {
      event.preventDefault();
      event.stopImmediatePropagation();
      await savedMovementGenerateSmartScout();
      return;
    }

    if (savedMovementPlansState.routeType === 'unit' && savedMovementSelectedUnit()?.unitType === 'Garrison') {
      event.preventDefault();
      event.stopImmediatePropagation();
      savedMovementSetStationaryStatus();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    await savedMovementApplySelectedOrigin(false);

    const origin = savedMovementOriginFor();
    const unitMove = savedMovementScoutUsesUnitMove() ? savedMovementUnitMove(savedMovementPlansState.selectedUnitCode) : null;
    const last = unitMove?.path?.[unitMove.path.length - 1];
    if (savedMovementScoutUsesUnitMove() && origin && last?.terrain === 'UNKNOWN') {
      savedMovementActivateUnknownOrigin(origin);
      return;
    }

    await movementPlannerToggle();
  }, true);
}

savedMovementEnsureCardControls();
savedMovementRefresh().catch(error => console.error('Could not initialise saved movement plans', error));
setTimeout(() => savedMovementRefresh().catch(() => {}), 300);
setTimeout(() => savedMovementRefresh().catch(() => {}), 1200);

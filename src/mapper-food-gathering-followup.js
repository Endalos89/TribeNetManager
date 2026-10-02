(() => {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'index.html') return;

  const api = window.TribeNetMapperFoodGathering;
  if (!api || !window.tribenet?.getManagedTurn) return;

  let requestId = 0;
  let selectedUnit = '';
  const managedCache = new Map();
  const canon = value => String(value || '').trim().toUpperCase();
  const fmt = value => Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString() : '—';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function selectedCoordinate() {
    return String(document.getElementById('selectedCoordinate')?.textContent || '').trim().toUpperCase();
  }

  function candidateTurnKeys() {
    const values = [];
    try { values.push(state?.planImport?.turnKey); } catch (_) {}
    for (const id of ['planningTurnSelect','turnPicker','turnSelect']) values.push(document.getElementById(id)?.value);
    try { values.push(resultsTimeline?.turn?.metadata?.nextTurn); } catch (_) {}
    try { values.push(resultsTimeline?.turn?.turnKey); } catch (_) {}
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
  }

  async function managedTurn(turnKey) {
    if (managedCache.has(turnKey)) return managedCache.get(turnKey);
    const promise = window.tribenet.getManagedTurn(turnKey).catch(() => null);
    managedCache.set(turnKey, promise);
    return promise;
  }

  async function beginningState() {
    for (const turnKey of candidateTurnKeys()) {
      const managed = await managedTurn(turnKey);
      const data = managed?.start?.data;
      if (Array.isArray(data?.units) && data.units.length) return { turnKey, managed, data };
    }
    return null;
  }

  function resultUnit(code) {
    try {
      return (resultsTimeline?.turn?.units || []).find(unit => String(unit.unitCode || unit.unit || '') === String(code || '')) || null;
    } catch (_) {
      return null;
    }
  }

  function flattenInventory(value) {
    const stock = {};
    const add = (name, quantity) => {
      const key = String(name || '').trim();
      const amount = Number(quantity);
      if (!key || !Number.isFinite(amount)) return;
      stock[key] = (stock[key] || 0) + amount;
    };
    const visit = node => {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const row of node) {
          if (row && typeof row === 'object') {
            const name = row.item ?? row.name ?? row.resource ?? row.good ?? row.material ?? row.label;
            const qty = row.quantity ?? row.qty ?? row.count ?? row.amount ?? row.value;
            if (name != null && qty != null) add(name, qty);
            else visit(row);
          }
        }
        return;
      }
      if (typeof node !== 'object') return;
      for (const [key, item] of Object.entries(node)) {
        if (item && typeof item === 'object') visit(item);
        else add(key, item);
      }
    };
    visit(value);
    return stock;
  }

  function normalizedUnit(unit) {
    const code = String(unit?.unit || unit?.unitCode || '').trim();
    const skills = {};
    if (Array.isArray(unit?.skills)) {
      for (const row of unit.skills) {
        const level = Number(row?.level ?? row?.value ?? 0);
        for (const name of [row?.skill, row?.name, row?.shortname]) {
          if (name && Number.isFinite(level)) skills[String(name)] = level;
        }
      }
    } else if (unit?.skills && typeof unit.skills === 'object') {
      for (const [name,value] of Object.entries(unit.skills)) {
        const level = Number(value?.level ?? value);
        if (Number.isFinite(level)) skills[name] = level;
      }
    }

    const startStock = flattenInventory(unit?.inventory || unit?.resources);
    const result = resultUnit(code);
    const fallbackStock = flattenInventory(result?.resources);
    const resources = Object.keys(startStock).length ? startStock : fallbackStock;
    const active = Number(unit?.active ?? unit?.actives ?? unit?.people?.Actives ?? result?.people?.Actives ?? result?.people?.Active ?? 0);

    return {
      unitCode:code,
      unitType:unit?.type || unit?.unitType || result?.unitType || 'Unit',
      currentHex:String(unit?.startHex || unit?.currentHex || '').toUpperCase(),
      people:{ Actives:Number.isFinite(active) ? active : 0 },
      skills,
      resources
    };
  }

  function skillValue(unit, name) {
    const wanted = canon(name);
    if (Array.isArray(unit?.skills)) {
      const row = unit.skills.find(skill => [skill?.skill, skill?.name, skill?.shortname].some(value => canon(value) === wanted));
      return Number(row?.level ?? row?.value ?? 0) || 0;
    }
    for (const [key,value] of Object.entries(unit?.skills || {})) {
      if (canon(key) !== wanted) continue;
      return Number(value?.level ?? value) || 0;
    }
    return 0;
  }

  function renderEstimate(panel, source, units, unit, coordinate) {
    const normalized = normalizedUnit(unit);
    const result = api.estimate(normalized);
    const code = normalized.unitCode;
    selectedUnit = code;
    const atHex = units.filter(row => canon(row.startHex) === coordinate);
    const options = (atHex.length ? atHex : units).map(row => {
      const rowCode = String(row.unit || row.unitCode || '');
      const label = `${rowCode}${row.type ? ` · ${row.type}` : ''}${row.startHex ? ` · starts ${row.startHex}` : ''}`;
      return `<option value="${esc(rowCode)}" ${rowCode === code ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
    const huntEquipment = result.equipment?.labels?.length ? result.equipment.labels.join(' · ') : 'No beneficial Hunting implement found';
    const terrain = result.terrainCode || 'No calculator terrain row';
    const water = result.water?.available ? `${result.water.borders} known water border${result.water.borders === 1 ? '' : 's'}` : 'No known adjacent water';
    const hereText = atHex.length ? `${atHex.length} beginning-of-turn unit${atHex.length === 1 ? '' : 's'} here` : 'No beginning-of-turn unit here';

    panel.dataset.beginningTurn = source.turnKey;
    panel.innerHTML = `
      <div class="mfg-head"><h3>Food Gathering estimate</h3><span>Assumption based</span></div>
      <div class="mfg-unit"><label>Beginning-of-turn unit (${esc(source.turnKey)})</label><select id="mapperFoodUnit">${options}</select></div>
      <div class="mfg-context">
        <span class="mfg-chip ${atHex.length ? 'good' : 'warn'}">${esc(hereText)}</span>
        <span class="mfg-chip">${fmt(result.workers)} Actives</span>
        <span class="mfg-chip">Terrain ${esc(terrain)}</span>
        <span class="mfg-chip ${result.water?.available ? 'good' : 'warn'}">${esc(water)}</span>
      </div>
      <div class="mfg-results">
        <div class="mfg-card ${result.huntingRange ? '' : 'unavailable'}">
          <h4>Hunting · skill ${skillValue(unit,'Hunting')}</h4>
          ${result.huntingRange ? `<div class="mfg-range">${fmt(result.huntingRange.min)}–${fmt(result.huntingRange.max)}</div><small>Possible provisions across weather scenarios. Fine weather: ${fmt(result.huntingFine)}.</small><small>Optimal owned equipment: ${esc(huntEquipment)}. Effective Hunting AM: ${Number(result.equipment?.effectiveAM || 0).toFixed(2)}.</small>` : '<div class="mfg-range">—</div><small>No Hunting total is available for the selected terrain.</small>'}
        </div>
        <div class="mfg-card ${result.fishingRange ? '' : 'unavailable'}">
          <h4>Fishing · skill ${skillValue(unit,'Fishing')}</h4>
          ${result.fishingRange ? `<div class="mfg-range">${fmt(result.fishingRange.min)}–${fmt(result.fishingRange.max)}</div><small>Possible provisions across weather scenarios. Fine weather: ${fmt(result.fishingFine)}.</small><small>${fmt(result.nets)} Net${result.nets === 1 ? '' : 's'} used automatically, capped at one per fisher.</small>` : '<div class="mfg-range">—</div><small>Fishing is only available when the selected hex has a known adjacent Lake, Ocean, river or other water source.</small>'}
        </div>
      </div>
      <div class="mfg-note">Unit location, Actives, inherited Tribe skills and holdings come from the beginning-of-turn workbook. The selected hex and known neighbouring terrain provide terrain/water context. Weather remains a range because it is unknown during planning.</div>`;

    panel.querySelector('#mapperFoodUnit')?.addEventListener('change', event => {
      selectedUnit = event.currentTarget.value;
      schedule(0);
    });
  }

  async function render() {
    const id = ++requestId;
    const panel = document.getElementById('mapperFoodGathering');
    const coordinate = selectedCoordinate();
    if (!panel || !coordinate || coordinate === '—') return;
    const source = await beginningState();
    if (id !== requestId || !source) return;
    const units = source.data.units || [];
    if (!units.length) return;
    const here = units.filter(unit => canon(unit.startHex) === coordinate);
    let unit = (here.length ? here : units).find(row => String(row.unit || row.unitCode || '') === selectedUnit);
    if (!unit) unit = (here.length ? here : units)[0];
    if (!unit || id !== requestId) return;
    renderEstimate(panel, source, units, unit, coordinate);
  }

  let timer = null;
  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(console.error), delay);
  }

  const coordinate = document.getElementById('selectedCoordinate');
  if (coordinate) new MutationObserver(() => { selectedUnit = ''; schedule(120); }).observe(coordinate, { childList:true, subtree:true, characterData:true });
  document.getElementById('terrainSelect')?.addEventListener('change', () => schedule(80));
  window.addEventListener('tribenet-import-complete', () => { managedCache.clear(); selectedUnit = ''; schedule(420); });

  if (typeof selectHex === 'function') {
    const previousSelectHex = selectHex;
    selectHex = async function beginningTurnFoodGatheringSelectHex() {
      const result = await previousSelectHex.apply(this, arguments);
      selectedUnit = '';
      schedule(120);
      return result;
    };
  }

  schedule(650);
  window.TribeNetMapperFoodGatheringBeginningTurn = { normalizedUnit, skillValue, flattenInventory };
})();

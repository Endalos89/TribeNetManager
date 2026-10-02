(() => {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'index.html') return;

  const WATER_TERRAINS = new Set(['L','O']);
  const TERRAIN = {
    ALPS:[0,0,0,0], AR:[1,.5,1,.6], BH:[2.6,1.9,1.7,.6], BR:[2.3,1.8,1.5,.4],
    CH:[2.9,1.9,1.8,.6], DE:[.4,0,.3,.2], DF:[3,2,1.9,.3], DH:[3,2.1,1.9,.3],
    GH:[2,1.8,1.5,.6], HSM:[1,.1,.1,.05], JG:[3,1.8,2,1], JH:[3,1.8,2,1],
    LCM:[1.8,1.4,1,.3], LJM:[2.5,1.4,1.7,.8], LSM:[.5,.5,.2,.1], PI:[.5,.8,.3,.3],
    PR:[2,1.7,1.4,.5], RH:[1,1.5,1.5,.6], SH:[.5,.8,.3,.3], SW:[1,.7,.5,.2], TU:[.5,.8,.5,.1]
  };
  const WEATHER = [
    { label:'Fine', fishing:1, hunting:1 },
    { label:'Light rain', fishing:.95, hunting:.9 },
    { label:'Heavy rain', fishing:.5, hunting:.5 },
    { label:'Light snow', fishing:.9, hunting:.7 },
    { label:'Heavy snow', fishing:.8, hunting:.4 },
    { label:'Wind', fishing:.8, hunting:.8 }
  ];
  const HUNTING_IMPLEMENTS = [
    { name:'Advanced Trap', aliases:['Advanced Traps'], bonus:1, max:1 },
    { name:'Improved Trap', aliases:['Improved Traps'], bonus:.15, max:5 },
    { name:'Trap', aliases:['Traps'], bonus:.10, max:5 },
    { name:'Snare', aliases:['Snares'], bonus:.05, max:5 },
    { name:'Arbalest', aliases:['Arbalests'], bonus:.20, max:1 },
    { name:'Bow', aliases:['Bows'], bonus:.15, max:1 },
    { name:'Sling', aliases:['Slings'], bonus:.10, max:1 },
    { name:'Net', aliases:['Nets'], bonus:.10, max:1 },
    { name:'Spear', aliases:['Spears'], bonus:.05, max:1 },
    { name:'Bone Spear', aliases:['Bone Spears'], bonus:.05, max:1 },
    { name:'Stone Spear', aliases:['Stone Spears'], bonus:.05, max:1 },
    { name:'Spetum', aliases:['Spetums'], bonus:.05, max:1 }
  ];
  const LAST_UNIT_KEY = 'tribenet.mapper.foodGathering.unit';
  let rememberedUnit = localStorage.getItem(LAST_UNIT_KEY) || '';
  let renderQueued = false;

  const canon = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const fmt = value => Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString() : '—';
  const monthIndex = month => Math.max(1, Math.min(12, Number(month) || 1));
  const seasonIndex = month => Math.floor((monthIndex(month) - 1) / 3);
  const seasonLabel = month => ['Spring','Summer','Autumn','Winter'][seasonIndex(month)];

  function mapperTerrainToFood(code) {
    const value = canon(code).replace(/ /g,'');
    if (value === 'D') return 'DF';
    if (value === 'PP' || value === 'PPR') return 'PR';
    if (value === 'GHP' || value === 'PGH') return 'GH';
    return TERRAIN[value] ? value : null;
  }

  function currentTurn() {
    try {
      if (typeof resultsTimeline !== 'undefined' && resultsTimeline?.turn) return resultsTimeline.turn;
    } catch (_) {}
    return null;
  }

  function currentUnits() {
    const turn = currentTurn();
    return Array.isArray(turn?.units) ? turn.units : [];
  }

  function currentMonth() {
    const candidates = [];
    try { candidates.push(resultsTimeline?.turn?.turnKey); } catch (_) {}
    try { candidates.push(state?.planImport?.turnKey); } catch (_) {}
    for (const value of candidates) {
      const match = String(value || '').match(/(?:^|\D)(\d{1,2})$/);
      if (match) {
        const month = Number(match[1]);
        if (month >= 1 && month <= 12) return month;
      }
    }
    return 3;
  }

  function selectedCoordinate() {
    return String(document.getElementById('selectedCoordinate')?.textContent || '').trim();
  }

  function selectedTerrain() {
    const select = document.getElementById('terrainSelect');
    const value = select?.value || '';
    if (value) return value;
    const coordinate = selectedCoordinate();
    try { return state?.hexCache?.get(coordinate)?.terrain || state?.selected?.existing?.terrain || 'UNKNOWN'; } catch (_) { return 'UNKNOWN'; }
  }

  function unitCode(unit) {
    return String(unit?.unitCode || unit?.unit || unit?.code || '').trim();
  }

  function findUnit(code) {
    return currentUnits().find(unit => unitCode(unit) === String(code || '')) || null;
  }

  function chooseUnit() {
    const units = currentUnits();
    if (!units.length) return null;
    if (rememberedUnit) {
      const remembered = findUnit(rememberedUnit);
      if (remembered) return remembered;
    }
    const coordinate = selectedCoordinate();
    const here = units.find(unit => String(unit.currentHex || '').toUpperCase() === coordinate.toUpperCase());
    if (here) return here;
    const tribe = units.find(unit => /tribe/i.test(String(unit.unitType || unit.type || '')));
    return tribe || units[0];
  }

  function skillLevel(unit, name) {
    const target = canon(name);
    const skills = unit?.skills || {};
    if (Array.isArray(skills)) {
      const row = skills.find(skill => canon(skill.name) === target);
      return Number(row?.level || 0);
    }
    for (const [key,value] of Object.entries(skills)) if (canon(key) === target) return Number(value || 0);
    return 0;
  }

  function activeWorkers(unit) {
    for (const [name,value] of Object.entries(unit?.people || {})) {
      if (/^ACTIVES?$/i.test(String(name).trim())) return Math.max(0, Number(value || 0));
    }
    return null;
  }

  function inventory(unit) {
    const map = new Map();
    const add = (name,value) => {
      const key = canon(name);
      const qty = Number(value || 0);
      if (!key || !Number.isFinite(qty)) return;
      map.set(key, (map.get(key) || 0) + qty);
    };
    for (const [section,value] of Object.entries(unit?.resources || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [name,qty] of Object.entries(value)) add(name,qty);
      } else add(section,value);
    }
    for (const [name,qty] of Object.entries(unit?.people || {})) add(name,qty);
    return map;
  }

  function itemCount(stock, names) {
    for (const name of names) {
      const key = canon(name);
      if (stock.has(key)) return Math.max(0, Number(stock.get(key) || 0));
    }
    return 0;
  }

  function optimalHuntingEquipment(unit, workers) {
    const stock = inventory(unit);
    const bundles = [];
    for (const implement of HUNTING_IMPLEMENTS) {
      let available = itemCount(stock, [implement.name, ...(implement.aliases || [])]);
      while (available > 0) {
        const copies = Math.min(implement.max, available);
        bundles.push({ name:implement.name, copies, bonus:copies * implement.bonus });
        available -= copies;
      }
    }
    bundles.sort((a,b) => b.bonus - a.bonus || b.copies - a.copies || a.name.localeCompare(b.name));
    const chosen = bundles.slice(0, Math.max(0, Math.floor(workers)));
    const primaryBonus = chosen.reduce((sum,row) => sum + row.bonus, 0);
    const grouped = new Map();
    for (const row of chosen) {
      const prior = grouped.get(row.name) || { hunters:0, copies:0, bonus:0 };
      prior.hunters += 1; prior.copies += row.copies; prior.bonus += row.bonus;
      grouped.set(row.name, prior);
    }
    const dogs = Math.min(Math.max(0, Math.floor(workers)), itemCount(stock, ['Hunting Dog','Hunting Dogs']));
    const dogBonus = dogs * 2;
    const labels = [...grouped.entries()].map(([name,row]) => `${row.copies} ${name}${row.copies === 1 ? '' : 's'} (+${row.bonus.toFixed(2)} AM)`);
    if (dogs) labels.push(`${dogs} Hunting Dog${dogs === 1 ? '' : 's'} (+${dogBonus} AM)`);
    return { primaryBonus, dogBonus, effectiveAM:workers + primaryBonus + dogBonus, labels };
  }

  function knownHex(coordinate) {
    try {
      const fromCache = state?.hexCache?.get(coordinate);
      if (fromCache) return fromCache;
    } catch (_) {}
    const turn = currentTurn();
    return (turn?.hexes || turn?.mapKnowledge || []).find?.(row => String(row.coordinate || '').toUpperCase() === String(coordinate || '').toUpperCase()) || null;
  }

  function waterContext() {
    const coordinate = selectedCoordinate();
    const core = window.MovementPlannerCore;
    const parsed = core?.parseCoordinate?.(coordinate);
    const selected = knownHex(coordinate);
    let borders = 0;
    const sources = [];
    if (WATER_TERRAINS.has(canon(selected?.terrain || selectedTerrain()))) sources.push('selected hex is water');
    if (/\b(river|lake|ocean|water)\b/i.test(String(selected?.notes || selected?.statusNotes || ''))) {
      borders = Math.max(1,borders);
      sources.push('selected hex notes mention water');
    }
    if (parsed && core?.adjacentHexes) {
      for (const adjacent of core.adjacentHexes(parsed)) {
        const row = knownHex(adjacent.coordinate);
        if (!row) continue;
        const terrain = canon(row.terrain);
        const water = WATER_TERRAINS.has(terrain) || /\b(river|lake|ocean|water)\b/i.test(String(row.notes || row.statusNotes || ''));
        if (water) {
          borders += 1;
          sources.push(`${adjacent.direction} ${adjacent.coordinate}`);
        }
      }
    }
    if (WATER_TERRAINS.has(canon(selected?.terrain || selectedTerrain()))) borders = Math.max(1,borders);
    return { available:borders > 0 || WATER_TERRAINS.has(canon(selected?.terrain || selectedTerrain())), borders, sources };
  }

  function huntingYield({ people, skill, terrain, month, weatherFactor, waterBorders }) {
    const row = TERRAIN[terrain];
    if (!row) return null;
    const terrainSeason = row[seasonIndex(month)];
    const waterFactor = waterBorders >= 1 ? 1.1 + .01 * (waterBorders - 1) : 1;
    return Math.round(Math.max(0,people) * terrainSeason * (1 + skill * .1) * weatherFactor * waterFactor);
  }

  function fishingYield({ people, skill, nets, weatherFactor }) {
    const effective = (1 + skill * .05) * 2.2 * weatherFactor;
    return Math.floor(effective * (Math.max(0,people) + Math.min(Math.max(0,nets), Math.max(0,people)) / 2));
  }

  function range(values) {
    const finite = values.filter(value => Number.isFinite(value));
    if (!finite.length) return null;
    return { min:Math.min(...finite), max:Math.max(...finite) };
  }

  function estimate(unit) {
    const workers = activeWorkers(unit);
    const terrainCode = mapperTerrainToFood(selectedTerrain());
    const month = currentMonth();
    const water = waterContext();
    if (workers == null) return { workers:null, terrainCode, month, water };
    const huntingSkill = skillLevel(unit,'Hunting');
    const fishingSkill = skillLevel(unit,'Fishing');
    const equipment = optimalHuntingEquipment(unit, workers);
    const stock = inventory(unit);
    const nets = Math.min(workers, itemCount(stock,['Net','Nets']));
    const huntingValues = terrainCode ? WEATHER.map(weather => huntingYield({ people:equipment.effectiveAM, skill:huntingSkill, terrain:terrainCode, month, weatherFactor:weather.hunting, waterBorders:water.borders })) : [];
    const fishingValues = water.available ? WEATHER.map(weather => fishingYield({ people:workers, skill:fishingSkill, nets, weatherFactor:weather.fishing })) : [];
    return {
      workers, terrainCode, month, water, huntingSkill, fishingSkill, equipment, nets,
      huntingRange:range(huntingValues), fishingRange:range(fishingValues),
      huntingFine:terrainCode ? huntingYield({ people:equipment.effectiveAM, skill:huntingSkill, terrain:terrainCode, month, weatherFactor:1, waterBorders:water.borders }) : null,
      fishingFine:water.available ? fishingYield({ people:workers, skill:fishingSkill, nets, weatherFactor:1 }) : null
    };
  }

  function ensurePanel() {
    const editor = document.getElementById('selectionEditor');
    if (!editor) return null;
    let panel = document.getElementById('mapperFoodGathering');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'mapperFoodGathering';
    panel.className = 'mapper-food-gathering';
    const history = editor.querySelector('.history-section');
    if (history) history.insertAdjacentElement('beforebegin', panel); else editor.appendChild(panel);
    return panel;
  }

  function installStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .mapper-food-gathering{margin-top:16px;padding-top:14px;border-top:1px solid #29404d}
      .mfg-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}.mfg-head h3{margin:0;font-size:14px}.mfg-head span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#d6a959}
      .mfg-unit{display:grid;grid-template-columns:1fr;gap:5px;margin-bottom:9px}.mfg-unit label{font-size:10px;color:#92a5b1}.mfg-unit select{width:100%;padding:7px 8px;border:1px solid #38505f;border-radius:7px;background:#0e181e;color:#e7eef2}
      .mfg-context{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}.mfg-chip{padding:4px 6px;border-radius:999px;background:#17262e;border:1px solid #304a58;color:#aebfc9;font-size:9px}.mfg-chip.good{border-color:#477c58;color:#a6d7b1}.mfg-chip.warn{border-color:#8e6c38;color:#e0c27e}
      .mfg-results{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mfg-card{padding:9px;border:1px solid #304957;border-radius:8px;background:#101b22}.mfg-card h4{margin:0 0 4px;font-size:11px}.mfg-range{font-size:16px;font-weight:800;color:#edf4f8}.mfg-card small{display:block;margin-top:4px;color:#91a5b1;font-size:9px;line-height:1.35}.mfg-card.unavailable{opacity:.65}.mfg-note{margin-top:8px;color:#8095a1;font-size:9px;line-height:1.4}
      @media(max-width:900px){.mfg-results{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    renderQueued = false;
    const panel = ensurePanel();
    const coordinate = selectedCoordinate();
    if (!panel || !coordinate || coordinate === '—') return;
    const units = currentUnits();
    const unit = chooseUnit();
    if (!unit) {
      panel.innerHTML = '<div class="mfg-head"><h3>Food Gathering estimate</h3><span>Assumption based</span></div><div class="mfg-note">No unit data is available for the selected Results turn, so skill-based totals cannot be calculated.</div>';
      return;
    }
    const selectedCode = unitCode(unit);
    rememberedUnit = selectedCode;
    localStorage.setItem(LAST_UNIT_KEY, selectedCode);
    const result = estimate(unit);
    const unitOptions = units.map(row => {
      const code = unitCode(row);
      const label = `${code}${row.unitType ? ` · ${row.unitType}` : ''}${row.currentHex ? ` · ${row.currentHex}` : ''}`;
      return `<option value="${code.replace(/"/g,'&quot;')}" ${code === selectedCode ? 'selected' : ''}>${label.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</option>`;
    }).join('');
    const terrainLabel = result.terrainCode || `${selectedTerrain()} (no calculator row)`;
    const waterLabel = result.water.available ? `${result.water.borders} known water border${result.water.borders === 1 ? '' : 's'}` : 'No known adjacent water';
    const workersLabel = result.workers == null ? 'Actives not reported' : `${fmt(result.workers)} Actives`;
    const huntEquipment = result.equipment?.labels?.length ? result.equipment.labels.join(' · ') : 'No beneficial Hunting implement found';

    panel.innerHTML = `
      <div class="mfg-head"><h3>Food Gathering estimate</h3><span>Assumption based</span></div>
      <div class="mfg-unit"><label>Use skills &amp; equipment from</label><select id="mapperFoodUnit">${unitOptions}</select></div>
      <div class="mfg-context"><span class="mfg-chip">${workersLabel}</span><span class="mfg-chip">Terrain ${terrainLabel}</span><span class="mfg-chip">Month ${String(result.month).padStart(2,'0')} · ${seasonLabel(result.month)}</span><span class="mfg-chip ${result.water.available ? 'good' : 'warn'}">${waterLabel}</span></div>
      ${result.workers == null ? '<div class="mfg-note">The report does not expose an Actives count for this unit, so totals are withheld rather than guessing the workforce.</div>' : `<div class="mfg-results">
        <div class="mfg-card ${result.huntingRange ? '' : 'unavailable'}"><h4>Hunting · skill ${result.huntingSkill}</h4>${result.huntingRange ? `<div class="mfg-range">${fmt(result.huntingRange.min)}–${fmt(result.huntingRange.max)}</div><small>Possible provisions across the calculator weather scenarios. Fine weather: ${fmt(result.huntingFine)}.</small><small>Optimal owned equipment: ${huntEquipment}. Effective Hunting AM: ${Number(result.equipment.effectiveAM).toFixed(2)}.</small>` : `<div class="mfg-range">—</div><small>${selectedTerrain()} is not represented in the current community Hunting calculator, so no total is invented.</small>`}</div>
        <div class="mfg-card ${result.fishingRange ? '' : 'unavailable'}"><h4>Fishing · skill ${result.fishingSkill}</h4>${result.fishingRange ? `<div class="mfg-range">${fmt(result.fishingRange.min)}–${fmt(result.fishingRange.max)}</div><small>Possible provisions across the calculator weather scenarios. Fine weather: ${fmt(result.fishingFine)}.</small><small>${fmt(result.nets)} standard Net${result.nets === 1 ? '' : 's'} automatically used, capped at one per fisher.</small>` : '<div class="mfg-range">—</div><small>Fishing is unavailable because no known adjacent Lake, Ocean or water/river note is present. Unknown neighbouring hexes are not assumed to contain water.</small>'}</div>
      </div>`}
      <div class="mfg-note">Uses the same assumption-based Fishing/Hunting model as the Compendium calculator. Skills and holdings come from the selected unit; terrain and water access come from the selected hex plus known adjacent hexes. Weather is shown as a range because it is not known when orders are planned.</div>`;

    panel.querySelector('#mapperFoodUnit')?.addEventListener('change', event => {
      rememberedUnit = event.currentTarget.value;
      localStorage.setItem(LAST_UNIT_KEY, rememberedUnit);
      queueRender();
    });
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  installStyle();
  ensurePanel();

  if (typeof showUnitLogistics === 'function') {
    const priorShowUnitLogistics = showUnitLogistics;
    showUnitLogistics = function mapperFoodRememberUnit(unit) {
      rememberedUnit = String(unit || '');
      if (rememberedUnit) localStorage.setItem(LAST_UNIT_KEY, rememberedUnit);
      return priorShowUnitLogistics.apply(this, arguments);
    };
  }

  if (typeof selectHex === 'function') {
    const priorSelectHex = selectHex;
    selectHex = async function mapperFoodSelectHex() {
      const result = await priorSelectHex.apply(this, arguments);
      queueRender();
      return result;
    };
  }

  document.getElementById('terrainSelect')?.addEventListener('change', queueRender);
  const coordinate = document.getElementById('selectedCoordinate');
  if (coordinate) new MutationObserver(queueRender).observe(coordinate,{childList:true,subtree:true,characterData:true});
  window.addEventListener('tribenet-import-complete', () => setTimeout(queueRender,250));
  queueRender();

  window.TribeNetMapperFoodGathering = { mapperTerrainToFood, optimalHuntingEquipment, huntingYield, fishingYield, estimate };
})();

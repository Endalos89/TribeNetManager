// Tabbed, mapper-native details for the currently selected unit.
(function installSelectedUnitPanel(root) {
  const paneKeys = ['overview', 'skills', 'sustenance', 'inventory', 'orders'];
  let activeTab = 'overview';
  let selectionVersion = 0;

  const byId = id => document.getElementById(id);
  const appState = () => typeof state !== 'undefined' ? state : (root.state || {});
  const num = value => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const displayNumber = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const canonical = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function skillNameLookup() {
    const rows = root.TribeNetOrdersReferenceRaw?.skills || [];
    const byShortName = new Map();
    const ambiguous = new Set();
    for (const row of rows) {
      const key = canonical(row.shortname);
      if (!key) continue;
      if (byShortName.has(key) && canonical(byShortName.get(key)) !== canonical(row.name)) ambiguous.add(key);
      else byShortName.set(key, row.name);
    }
    return value => ambiguous.has(canonical(value)) ? value : byShortName.get(canonical(value)) || value;
  }

  function resultEaters(unit) {
    const people = unit?.people || {};
    const explicitPeople = num(people.People);
    const ordinaryFields = [
      people.Warriors, people.Actives, people.Inactives,
      people.Hirelings, people.Mercenaries ?? people.Mercs,
      people.Locals, people.Residents, people.Followers, people.Auxiliaries
    ];
    const ordinary = ordinaryFields.reduce((sum, value) => sum + (num(value) || 0), 0);
    const slaves = num(people.Slaves ?? people.Slave) || 0;
    return Math.max(0, Math.max(explicitPeople || 0, ordinary) + slaves);
  }

  function compendiumHref(type, key) {
    const params = new URLSearchParams({ entry: type, key: String(key || '') });
    return `compendium.html?${params.toString()}`;
  }

  function infoButton(type, key, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'unit-compendium-info';
    button.textContent = 'i';
    button.title = `Open ${label} in the Compendium`;
    button.setAttribute('aria-label', `Open ${label} in the Compendium`);
    button.dataset.compendiumEntry = type;
    button.dataset.compendiumKey = key;
    return button;
  }

  function setActiveTab(key) {
    if (!paneKeys.includes(key)) return;
    activeTab = key;
    for (const button of document.querySelectorAll('[data-unit-tab]')) {
      const active = button.dataset.unitTab === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const pane of document.querySelectorAll('[data-unit-pane]')) {
      const active = pane.dataset.unitPane === key;
      pane.classList.toggle('active', active);
      pane.hidden = !active;
    }
  }

  function resultUnit(code) {
    return (root.resultsTimeline?.turn?.units || []).find(unit => String(unit.unitCode) === String(code)) || null;
  }

  function rootTribeCode(code) {
    const match = String(code || '').match(/^(\d{4})/);
    return match ? match[1] : String(code || '');
  }

  function renderOverview(unit, code) {
    const snapshot = unit || {};
    const people = snapshot.people || snapshot.resources?.Humans || {};
    const stats = (appState().planImport?.plan?.unitStats || []).find(row => String(row.unit) === String(code)) || null;
    const peopleCount = num(people.People) ?? num(stats?.totalPeople)
      ?? ['Warriors','Actives','Inactives','Slaves','Locals'].reduce((sum, key) => sum + (num(people[key]) || 0), 0);
    byId('unitPeople').textContent = displayNumber(peopleCount);
    byId('unitMorale').textContent = displayNumber(num(snapshot.morale));
    byId('unitLocation').textContent = snapshot.currentHex || appState().selectedUnitHex || 'Unknown';
    byId('unitTerrain').textContent = snapshot.statusTerrain && snapshot.statusTerrain !== 'UNKNOWN' ? snapshot.statusTerrain : 'Unknown terrain';
  }

  function renderSkills(unit, code) {
    const host = byId('unitSkillsList');
    const source = byId('unitSkillsSource');
    host.replaceChildren();
    let skills = unit?.skills || {};
    let label = 'This unit';
    if (!Object.keys(skills).length) {
      const tribe = resultUnit(rootTribeCode(code));
      if (tribe && Object.keys(tribe.skills || {}).length) {
        skills = tribe.skills;
        label = `Tribe ${tribe.unitCode}`;
      }
    }
    source.textContent = label === 'This unit' ? '' : `Shared from ${label}`;
    const fullSkillName = skillNameLookup();
    const rows = Object.entries(skills).map(([name, value]) => [fullSkillName(name), value])
      .sort(([a], [b]) => a.localeCompare(b));
    if (!rows.length) {
      host.innerHTML = '<div class="unit-panel-empty">No skills were reported for this unit.</div>';
      return;
    }
    for (const [name, value] of rows) {
      const row = document.createElement('div');
      row.className = 'unit-skill-row';
      const skill = document.createElement('span');
      skill.textContent = name;
      const level = document.createElement('strong');
      level.textContent = displayNumber(value);
      row.append(skill, level, infoButton('skill', name, name));
      host.appendChild(row);
    }
  }

  function findStock(unit, stats, names) {
    const targets = new Set(names.map(canonical));
    let total = 0;
    let found = false;
    for (const [section, items] of Object.entries(unit?.resources || {})) {
      if (section === 'Humans') continue;
      for (const [name, quantity] of Object.entries(items || {})) {
        if (!targets.has(canonical(name))) continue;
        const value = num(quantity);
        if (value == null) continue;
        total += value;
        found = true;
      }
    }
    if (!found) {
      for (const row of stats?.inventory || []) {
        if (!targets.has(canonical(row.item))) continue;
        const value = num(row.quantity);
        if (value == null) continue;
        total += value;
        found = true;
      }
    }
    return found ? total : null;
  }

  function provisionConsumption(code) {
    const events = root.resultsTimeline?.turn?.events || [];
    let total = 0;
    let found = false;
    for (const event of events) {
      if (String(event.unitCode || '') !== String(code) || event.eventType !== 'final activities') continue;
      for (const action of event.details?.actions || []) {
        if (action.type !== 'consumption') continue;
        for (const item of action.items || []) {
          if (canonical(item.item) !== 'provs') continue;
          const amount = num(item.quantity);
          if (amount != null) { total += amount; found = true; }
        }
      }
    }
    return found && total > 0 ? total : null;
  }

  function supplyCard(title, stock, perTurn, reserveMonths, note) {
    const duration = reserveMonths == null
      ? (perTurn === 0 ? 'No demand' : stock == null ? 'Stock not reported' : 'Rate unavailable')
      : `${displayNumber(reserveMonths)} months`;
    const stockText = stock == null ? 'Stock ?' : `${displayNumber(stock)} lb in stores`;
    const rateText = perTurn == null ? 'Dry-terrain rate unavailable' : `${displayNumber(perTurn)} lb per turn in dry terrain`;
    return `<article class="unit-supply-card"><span>${esc(title)}</span><strong>${esc(duration)}</strong><small>${esc(stockText)} · ${esc(rateText)}${note ? ` · ${esc(note)}` : ''}</small></article>`;
  }

  async function renderSustenance(unit, code, version) {
    const host = byId('unitSustenanceGrid');
    const location = byId('unitSupplyLocation');
    const basis = byId('unitSupplyBasis');
    const stats = (appState().planImport?.plan?.unitStats || []).find(row => String(row.unit) === String(code)) || null;
    const provisions = findStock(unit, stats, ['Provs']) ?? num(stats?.provs);
    const plannedTurns = num(stats?.provisionTurns);
    const consumedPerTurn = provisionConsumption(code);
    const eaters = num(stats?.eaters) ?? (unit ? resultEaters(unit) : null);
    const provisionTurns = plannedTurns ?? (provisions != null && consumedPerTurn
      ? provisions / consumedPerTurn
      : provisions != null && eaters > 0 ? provisions / eaters : null);
    byId('unitProvisions').textContent = displayNumber(provisions);
    byId('unitProvisionTurns').textContent = provisionTurns == null
      ? 'Duration unavailable for this report'
      : `${displayNumber(provisionTurns * 3)} months of food · ${displayNumber(provisionTurns)} turns`;
    byId('unitEaters').textContent = displayNumber(eaters);

    host.innerHTML = '<div class="unit-panel-empty">Calculating dry-terrain supply reserves…</div>';
    const turnKey = root.resultsTimeline?.turn?.turnKey || appState().planImport?.turnKey;
    try {
      const requirement = turnKey ? await root.tribenet.getUnitSupplyRequirements(turnKey, code) : null;
      if (version !== selectionVersion || String(appState().selectedUnit || '') !== String(code)) return;
      const counts = requirement?.counts || null;
      const rates = counts ? root.UnitSustenance.dryTerrainRates(counts) : { waterPerTurn:null, fodderPerTurn:null };
      const water = findStock(unit, stats, ['Water']);
      const fodder = findStock(unit, stats, ['Fodder','Grain']);
      const waterMonths = water == null ? null : root.UnitSustenance.reserveMonths(water, rates.waterPerTurn);
      const fodderMonths = fodder == null ? null : root.UnitSustenance.reserveMonths(fodder, rates.fodderPerTurn);
      host.innerHTML = supplyCard('Water reserve', water, rates.waterPerTurn, waterMonths)
        + supplyCard('Fodder / Grain reserve', fodder, rates.fodderPerTurn, fodderMonths, 'Grain counts 1:1');
      location.textContent = requirement?.endHex
        ? `${requirement.endHex} · ${requirement.terrain || 'terrain unknown'}`
        : 'Current terrain unknown';
      byId('unitEaters').textContent = displayNumber(num(stats?.eaters) ?? (counts
        ? Number(counts.ordinaryPeople || 0) + Number(counts.slaves || 0)
        : eaters));
      basis.textContent = 'Dry-terrain estimates assume the same unit population and herd for a full season (3 months), with no local water or fodder replenishment. Current terrain access can reduce or remove these requirements.';
    } catch (error) {
      if (version !== selectionVersion) return;
      host.innerHTML = '<div class="unit-panel-empty">Dry-terrain reserve calculation is unavailable for this unit.</div>';
      location.textContent = 'Could not determine current position';
      basis.textContent = error?.message || String(error);
    }
  }

  function inventoryRows(unit, code) {
    const stats = (appState().planImport?.plan?.unitStats || []).find(row => String(row.unit) === String(code)) || null;
    const host = byId('unitInventoryList');
    const basis = byId('unitInventoryBasis');
    host.replaceChildren();
    const entries = [];
    for (const [section, items] of Object.entries(unit?.resources || {})) {
      if (section === 'Humans') continue;
      for (const [item, quantity] of Object.entries(items || {})) {
        if (num(quantity) > 0) entries.push({ section, item, quantity: num(quantity), weight: null });
      }
    }
    if (!entries.length && stats?.inventory?.length) {
      for (const row of stats.inventory) if (num(row.quantity) > 0) entries.push({ section: row.category || 'Cargo', item: row.item, quantity: num(row.quantity), weight: num(row.totalWeight) });
    }
    if (!entries.length) {
      host.innerHTML = '<div class="unit-panel-empty">No equipment or cargo was reported for this unit.</div>';
      basis.textContent = stats ? 'Based on the selected turn workbook.' : 'Based on the selected Results report.';
      return;
    }
    entries.sort((a,b) => a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
    let lastSection = '';
    for (const entry of entries) {
      if (entry.section !== lastSection) {
        const heading = document.createElement('h3');
        heading.className = 'unit-inventory-heading';
        heading.textContent = entry.section;
        host.appendChild(heading);
        lastSection = entry.section;
      }
      const row = document.createElement('div');
      row.className = 'inventory-row';
      const name = document.createElement('span');
      name.textContent = `${entry.item} × ${displayNumber(entry.quantity)}`;
      const weight = document.createElement('span');
      weight.textContent = entry.weight == null ? '' : `${displayNumber(entry.weight)} lb`;
      row.append(name, weight, infoButton('item', entry.item, entry.item));
      host.appendChild(row);
    }
    basis.textContent = stats ? 'Inventory from the selected turn workbook.' : `Reported stock · Turn ${unit?.turnKey || root.resultsTimeline?.turn?.turnKey || '—'}`;
  }

  function routeSummary(row) {
    const route = row?.route || row;
    const points = route?.points || route?.path || [];
    const coordinates = points.map(point => point.coordinate || point.hex || point.ref).filter(Boolean);
    if (coordinates.length) return `${coordinates[0]} → ${coordinates[coordinates.length - 1]}${coordinates.length > 2 ? ` · ${coordinates.length - 1} steps` : ''}`;
    const orders = row?.orders || route?.orders;
    return Array.isArray(orders) ? orders.map(order => typeof order === 'string' ? order : order.direction || order.order || '').filter(Boolean).join(' → ') : String(orders || 'Route saved');
  }

  function renderOrders(unit, code) {
    const host = byId('unitOrdersList');
    const basis = byId('unitOrdersBasis');
    const rows = [];
    const app = appState();
    const actionHost = byId('unitOrderActions');
    actionHost.hidden = !(typeof root.turnActionsPlanningAvailable === 'function' && root.turnActionsPlanningAvailable());
    const movements = app.routeCache?.movements || [];
    const scouts = app.routeCache?.scouts || [];
    const movement = movements.find(row => String(row.unit) === String(code));
    if (movement) rows.push({ title:'Planned movement', text:routeSummary(movement), type:'movement' });
    const plannedScouts = scouts.filter(row => String(row.unit) === String(code));
    for (const [index, scout] of plannedScouts.entries()) rows.push({ title:`Planned scout ${scout.scoutNumber || index + 1}`, text:`${scout.mission || 'Scout'} · ${routeSummary(scout)}`, type:'scout' });
    if (unit?.movement) rows.push({ title:'Reported movement', text:unit.movement, type:'report' });
    for (const scout of unit?.scouts || []) rows.push({ title:`Reported scout ${scout.id}`, text:scout.report || scout.raw, type:'report' });

    host.replaceChildren();
    if (!rows.length) host.innerHTML = '<div class="unit-panel-empty">No movement or scouting orders are recorded for this unit.</div>';
    else for (const item of rows) {
      const row = document.createElement('article');
      row.className = `unit-order-row ${item.type}`;
      const title = document.createElement('strong');
      title.textContent = item.title;
      const text = document.createElement('span');
      text.textContent = item.text || 'No route details';
      row.append(title, text);
      host.appendChild(row);
    }
    basis.textContent = root.resultsTimeline?.turn?.turnKey ? `Turn ${root.resultsTimeline.turn.turnKey}` : 'Current plan';
  }

  function renderPanel(unitCode, providedSnapshot = null) {
    const code = String(unitCode || '');
    if (!code || !byId('unitEditor')) return;
    const version = ++selectionVersion;
    const unit = providedSnapshot || resultUnit(code);
    activeTab = 'overview';
    setActiveTab(activeTab);
    renderOverview(unit, code);
    renderSkills(unit, code);
    inventoryRows(unit, code);
    renderOrders(unit, code);
    renderSustenance(unit, code, version);
  }

  document.addEventListener('click', event => {
    const compendiumLink = event.target.closest('[data-compendium-entry]');
    if (compendiumLink) {
      const entry = compendiumLink.dataset.compendiumEntry;
      const key = compendiumLink.dataset.compendiumKey;
      if (root.tribenet?.openCompendium) root.tribenet.openCompendium(entry, key);
      else root.open?.(compendiumHref(entry, key), 'tribenet-compendium', 'popup,width=1120,height=820,resizable=yes');
      return;
    }
    const tab = event.target.closest('[data-unit-tab]');
    if (tab) setActiveTab(tab.dataset.unitTab);
    const action = event.target.closest('[data-unit-action]');
    if (action) {
      if (typeof root.turnActionsRefresh === 'function') root.turnActionsRefresh();
      document.querySelector(`#turnActionBar [data-turn-action="${action.dataset.unitAction}"]`)?.click();
    }
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-unit-tab]');
    if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = paneKeys.indexOf(tab.dataset.unitTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? paneKeys.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : paneKeys.length - 1)) % paneKeys.length;
    const target = byId(`unitTab${paneKeys[next][0].toUpperCase()}${paneKeys[next].slice(1)}`);
    setActiveTab(paneKeys[next]);
    target?.focus();
  });

  if (typeof root.showUnitLogistics === 'function') {
    const originalShowUnitLogistics = root.showUnitLogistics;
    root.showUnitLogistics = function showUnitLogisticsWithTabs(unitCode, snapshot = null) {
      const result = originalShowUnitLogistics.call(this, unitCode, snapshot);
      renderPanel(unitCode, snapshot);
      return result;
    };
  }

  root.renderSelectedUnitPanel = renderPanel;
  root.SelectedUnitPanelUtils = { resultEaters, skillNameLookup, compendiumHref };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SelectedUnitPanelUtils;
})(window);

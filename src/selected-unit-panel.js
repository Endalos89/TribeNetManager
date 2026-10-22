Warning: truncated output (original token count: 9655)
Total output lines: 702

// Tabbed, mapper-native details for the currently selected unit.
(function installSelectedUnitPanel(root) {
  const paneKeys = ['overview', 'skills', 'sustenance', 'inventory', 'orders'];
  let activeTab = 'overview';
  let selectionVersion = 0;
  let activeSkillContext = null;
  const skillStudyByTribe = new Map();
  const skillFilterByTribe = new Map();
  const skillStudyLoads = new Map();
  let skillSearchResults = [];
  let skillSearchOpen = false;

  const byId = id => document.getElementById(id);
  const appState = () => typeof state !== 'undefined' ? state : (root.state || {});
  const num = value => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const displayNumber = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const chanceText = value => value == null ? '—' : `${Number(Number(value).toFixed(1))}%`;
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
    button.setAttribute('data-compendium-entry', type);
    button.setAttribute('data-compendium-key', key);
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

  function skillTurnKey() {
    return appState().planImport?.turnKey || appState().planningTurnKey || root.resultsTimeline?.turn?.turnKey || '';
  }

  function previousSkillTurnKey(value) {
    const match = String(value || '').match(/^(\d{3})-(\d{1,2})$/);
    if (!match) return null;
    let year = Number(match[1]);
    let month = Number(match[2]) - 1;
    if (month < 1) { month = 12; year -= 1; }
    return `${String(year).padStart(3, '0')}-${String(month).padStart(2, '0')}`;
  }

  function getSkillState(tribe) {
    return skillStudyByTribe.get(`${skillTurnKey()}:${tribe}`) || { attempts: [], streaks: [], loaded: false };
  }

  function filterKey(tribe) { return `tribenet.skillGroupFilter.${tribe}`; }

  function getSkillFilter(tribe) {
    if (skillFilterByTribe.has(tribe)) return skillFilterByTribe.get(tribe);
    let value = null;
    try { value = root.localStorage?.getItem(filterKey(tribe)) || null; } catch {}
    if (!['A', 'B', 'C'].includes(value)) value = null;
    skillFilterByTribe.set(tribe, value);
    return value;
  }

  async function loadSkillState(turnKey, tribe) {
    const cacheKey = `${turnKey}:${tribe}`;
    const cached = skillStudyByTribe.get(cacheKey);
    if (cached?.loaded) return cached;
    if (skillStudyLoads.has(cacheKey)) return skillStudyLoads.get(cacheKey);
    const loading = (async () => {
      const api = root.tribenet;
      const [attempts, streaks] = await Promise.all([
        api?.getSkillAttempts ? api.getSkillAttempts(turnKey, tribe) : [],
        api?.getSkillStreaks ? api.getSkillStreaks(tribe) : []
      ]);
      let currentAttempts = attempts || [];
      const context = activeSkillContext?.turnKey === turnKey && activeSkillContext?.tribe === tribe
        ? activeSkillContext : null;
      if (context) {
        const refreshed = refreshSkillAttemptLevels(currentAttempts, context.unit?.skills || {});
        const changed = refreshed.some((row, index) => Number(currentAttempts[index]?.baselineLevel || 0) !== row.baselineLevel);
        if (changed) {
          currentAttempts = refreshed;
          try {
            const saved = await api?.saveSkillAttempts?.(turnKey, tribe, refreshed);
            if (saved) currentAttempts = saved;
          } catch (error) {
            console.error('Could not refresh saved skill attempt levels', error);
          }
        }
      }
      const next = { attempts: currentAttempts, streaks: streaks || [], loaded: true };
      skillStudyByTribe.set(cacheKey, next);
      if (activeSkillContext?.turnKey === turnKey && activeSkillContext?.tribe === tribe) {
        renderSkillAttemptStrip();
        renderSkills(activeSkillContext.unit, activeSkillContext.code);
      }
      return next;
    })().finally(() => skillStudyLoads.delete(cacheKey));
    skillStudyLoads.set(cacheKey, loading);
    return loading;
  }

  function skillLevelEntries(skills) {
    if (Array.isArray(skills)) {
      return skills
        .filter(row => row && typeof row === 'object')
        .map(row => [row.skill || row.name || row.shortname, row.level ?? row.value]);
    }
    return Object.entries(skills || {}).map(([name, value]) => [
      name,
      value && typeof value === 'object' ? (value.level ?? value.value) : value
    ]);
  }

  function levelForSkill(skillName, skills) {
    const wanted = root.SkillAttemptRules?.key(skillName) || canonical(skillName).replace(/\s/g, '');
    const lookup = skillNameLookup();
    const match = skillLevelEntries(skills).find(([name]) => {
      const fullName = lookup(name);
      return (root.SkillAttemptRules?.key(fullName) || canonical(fullName).replace(/\s/g, '')) === wanted;
    });
    const level = Number(match?.[1] ?? 0);
    return Number.isFinite(level) ? Math.max(0, level) : 0;
  }

  function refreshSkillAttemptLevels(attempts, skills) {
    return (attempts || []).map(attempt => ({
      ...attempt,
      baselineLevel: levelForSkill(attempt.skill, skills)
    }));
  }

  function skillCatalog() {
    const rows = root.TribeNetOrdersReferenceRaw?.skills || [];
    const unique = new Map();
    for (const row of rows) {
      if (!row?.name || !['A', 'B', 'C'].includes(String(row.group || '').toUpperCase())) continue;
      const key = root.SkillAttemptRules?.key(row.name) || canonical(row.name).replace(/\s/g, '');
      if (!unique.has(key)) unique.set(key, { name: row.name, shortname: row.shortname || '', group: String(row.group).toUpperCase() });
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function skillAvailability(unit, code) {
    const tribe = rootTribeCode(code);
    const clan = appState().planImport?.plan?.clan || [];
    const clanRow = clan.find(row => String(row.unit || '') === tribe);
    const goodsCode = String(clanRow?.gt || tribe);
    const goodsUnit = resultUnit(goodsCode) || resultUnit(tribe);
    const stats = (appState().planImport?.plan?.unitStats || []).find(row => String(row.unit || '') === goodsCode)
      || (appState().planImport?.plan?.unitStats || []).find(row => String(row.unit || '') === tribe);
    return findStock(goodsUnit, stats, ['Silver']);
  }

  function renderSkillAttemptStrip() {
    const host = byId('unitSkillAttempts');
    if (!host || !activeSkillContext) return;
    const { turnKey, tribe, code } = activeSkillContext;
    const state = getSkillState(tribe);
    const attempts = root.SkillAttemptRules?.calculate(state.attempts, state.streaks) || [];
    const silver = skillAvailability(activeSkillContext.unit, code);
    const error = root.SkillAttemptRules?.validationError(state.attempts) || '';
    host.hidden = attempts.length === 0;
    if (!attempts.length) { host.replaceChildren(); return; }
    host.innerHTML = `<div class="unit-skill-attempts-title">Skill Attempts · ${esc(tribe)}</div>${attempts.map((attempt, index) => {
      const unaffordable = attempt.teacher && silver != null && silver < attempt.cost;
      const chance = chanceText(attempt.chance);
      const details = attempt.teacher
        ? `${attempt.cost.toLocaleString()} silver · ${chance}`
        : `${chance} chance`;
      const streak = attempt.order === 1 && attempt.targetLevel === 10 && Number(state.streaks.find(row => (root.SkillAttemptRules?.key(row.skill) || '') === (root.SkillAttemptRules?.key(attempt.skill) || ''))?.failureCount || 0) > 0
        ? `<small class="unit-skill-streak"> · ${Number(state.streaks.find(row => (root.SkillAttemptRules?.key(row.skill) || '') === (root.SkillAttemptRules?.key(attempt.skill) || ''))?.failureCount || 0)}/12 failed first attempts</small>` : '';
      return `<div class="unit-skill-attempt"><span class="unit-skill-attempt-number">${attempt.order}.</span><span class="unit-skill-attempt-name" title="${esc(attempt.skill)}">${esc(attempt.skill)}${streak}</span><span class="unit-skill-attempt-details${unaffordable ? ' unaffordable' : ''}" title="${attempt.teacher && silver != null ? `Available Silver: ${silver.toLocaleString()}` : ''}">${esc(details)}</span><span class="unit-skill-attempt-actions"><button type="button" data-skill-attempt-move="-1" data-skill-attempt-index="${index}" aria-label="Move ${esc(attempt.skill)} earlier" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-skill-attempt-move="1" data-skill-attempt-index="${index}" aria-label="Move ${esc(attempt.skill)} later" ${index === attempts.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-skill-attempt-remove="${esc(attempt.skill)}" aria-label="Remove ${esc(attempt.skill)} attempt">×</button></span></div>`;
    }).join('')}${error ? `<p class="unit-skill-attempts-error">${esc(error)}</p>` : ''}`;
  }

  async function saveSkillAttempts(attempts) {
    if (!activeSkillContext) return;
    const { turnKey, tribe } = activeSkillContext;
    const cacheKey = `${turnKey}:${tribe}`;
    const normalized = attempts.map((row, index) => ({ ...row, order: index + 1 }));
    const state = { ...getSkillState(tribe), attempts: normalized, loaded: true };
    skillStudyByTribe.set(cacheKey…3655 tokens truncated…ter == null ? null : root.UnitSustenance.reserveMonths(water, rates.waterPerTurn);
      const fodderMonths = fodder == null ? null : root.UnitSustenance.reserveMonths(fodder, rates.fodderPerTurn);
      host.innerHTML = supplyCard('Water reserve', water, rates.waterPerTurn, waterMonths)
        + supplyCard('Fodder / Grain reserve', fodder, rates.fodderPerTurn, fodderMonths, 'Grain counts 1:1');
      location.textContent = requirement?.endHex
        ? `${requirement.endHex} · ${requirement.terrain || 'terrain unknown'}`
        : 'Current terrain unknown';
      byId('unitEaters').textContent = displayNumber(num(stats?.eaters) ?? (counts
        ? Number(counts.ordinaryPeople || 0) + Number(counts.slaves || 0)
        : eaters));
      basis.textContent = 'Dry-terrain estimates assume the same unit population and herd for a full season (3 turns / 3 months), with no local water or fodder replenishment. Current terrain access can reduce or remove these requirements.';
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
    setActiveTab(activeTab);
    renderOverview(unit, code);
    renderSkills(unit, code);
    inventoryRows(unit, code);
    renderOrders(unit, code);
    renderSustenance(unit, code, version);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.unit-skill-add')) {
      skillSearchOpen = false;
      const searchResults = byId('unitSkillSearchResults');
      if (searchResults) searchResults.hidden = true;
    }
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
    const filter = event.target.closest('[data-skill-group-filter]');
    if (filter && activeSkillContext) updateSkillFilter(activeSkillContext.tribe, filter.dataset.skillGroupFilter);
    const searchResult = event.target.closest('[data-skill-search-index]');
    if (searchResult) {
      const skill = skillSearchResults[Number(searchResult.dataset.skillSearchIndex)];
      if (skill) addSkillAttempt(skill);
    }
    const study = event.target.closest('[data-skill-study]');
    if (study && activeSkillContext) {
      const tribe = activeSkillContext.tribe;
      const state = getSkillState(tribe);
      const name = study.dataset.skillStudy;
      const key = root.SkillAttemptRules.key(name);
      const existing = state.attempts.find(row => root.SkillAttemptRules.key(row.skill) === key);
      if (existing) saveSkillAttempts(state.attempts.filter(row => root.SkillAttemptRules.key(row.skill) !== key));
      else {
        const skill = skillCatalog().find(row => root.SkillAttemptRules.key(row.name) === key)
          || { name, group: study.closest('.unit-skill-row')?.querySelector('.unit-skill-name')?.dataset.group || 'C' };
        addSkillAttempt(skill);
      }
    }
    const moveAttempt = event.target.closest('[data-skill-attempt-move]');
    if (moveAttempt && activeSkillContext) {
      const state = getSkillState(activeSkillContext.tribe);
      const next = root.SkillAttemptRules.swap(state.attempts, Number(moveAttempt.dataset.skillAttemptIndex), Number(moveAttempt.dataset.skillAttemptMove));
      saveSkillAttempts(next);
    }
    const removeAttempt = event.target.closest('[data-skill-attempt-remove]');
    if (removeAttempt && activeSkillContext) {
      const state = getSkillState(activeSkillContext.tribe);
      const wanted = root.SkillAttemptRules.key(removeAttempt.dataset.skillAttemptRemove);
      saveSkillAttempts(state.attempts.filter(row => root.SkillAttemptRules.key(row.skill) !== wanted));
    }
    const action = event.target.closest('[data-unit-action]');
    if (action) {
      if (typeof root.turnActionsRefresh === 'function') root.turnActionsRefresh();
      document.querySelector(`#turnActionBar [data-turn-action="${action.dataset.unitAction}"]`)?.click();
    }
  });
  document.addEventListener('focusin', event => {
    if (event.target?.id !== 'unitSkillSearch' || !activeSkillContext) return;
    skillSearchOpen = true;
    renderSkills(activeSkillContext.unit, activeSkillContext.code);
  });
  document.addEventListener('input', event => {
    if (event.target?.id === 'unitSkillSearch' && activeSkillContext) renderSkills(activeSkillContext.unit, activeSkillContext.code);
  });
  document.addEventListener('change', async event => {
    const input = event.target.closest('[data-skill-streak]');
    if (!input || !activeSkillContext) return;
    const { tribe, turnKey } = activeSkillContext;
    const count = Math.max(0, Math.min(11, Math.floor(Number(input.value || 0))));
    input.value = String(count);
    try {
      const previousTurn = previousSkillTurnKey(turnKey);
      const streaks = await root.tribenet.setSkillStreak(tribe, input.dataset.skillStreak, count, previousTurn);
      skillStudyByTribe.set(`${turnKey}:${tribe}`, { ...getSkillState(tribe), streaks: streaks || [] });
      renderSkills(activeSkillContext.unit, activeSkillContext.code);
    } catch (error) {
      input.title = `Could not save streak: ${error?.message || error}`;
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
  root.SelectedUnitPanelUtils = { resultEaters, skillNameLookup, compendiumHref, levelForSkill, refreshSkillAttemptLevels };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SelectedUnitPanelUtils;
})(window);

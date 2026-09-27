(() => {
  const enhancementState = {
    catalog: { skills: [], recipes: [] },
    baselineResult: null,
    selectedSkill: null
  };

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function installStyles() {
    if (document.getElementById('mandateTurnManagerStyles')) return;
    const style = document.createElement('style');
    style.id = 'mandateTurnManagerStyles';
    style.textContent = `
      .tm-skill-button{appearance:none;color:inherit;cursor:pointer;font-family:inherit;text-align:left}
      .tm-skill-button:hover,.tm-skill-button.active{border-color:#8fc49a;background:#173126}
      .tm-skill-button .tm-skill-short{color:#759083;font-size:8px;margin-left:4px}
      .tm-mandate-explorer{margin:10px 0 12px;border:1px solid #345244;background:#0b1713;border-radius:9px;padding:10px}
      .tm-mandate-explorer.hidden{display:none}
      .tm-mandate-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
      .tm-mandate-head strong{font-size:12px}.tm-mandate-head small{display:block;color:#80988a;font-size:9px;margin-top:2px}
      .tm-recipe-list{display:grid;gap:7px;max-height:360px;overflow:auto}
      .tm-recipe{border:1px solid #29443a;background:#0c1714;border-radius:8px;padding:8px}
      .tm-recipe.available{border-left:3px solid #6bad75}.tm-recipe.blocked{border-left:3px solid #c96b63}.tm-recipe.caution{border-left:3px solid #c79a4d}
      .tm-recipe-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.tm-recipe-top strong{font-size:11px}
      .tm-recipe-section{color:#778e83;font-size:8px;white-space:nowrap}.tm-recipe-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
      .tm-recipe-badge{font-size:8px;border:1px solid #345046;border-radius:999px;padding:2px 5px;color:#9eb0a7}.tm-recipe-badge.bad{border-color:#744740;color:#e59b94}.tm-recipe-badge.warn{border-color:#715e38;color:#dfbd79}.tm-recipe-badge.good{border-color:#416d4b;color:#a8d7af}
      .tm-recipe-note{margin-top:5px;color:#83978d;font-size:8px;line-height:1.4}.tm-recipe-use{margin-top:7px;padding:4px 7px;font-size:9px}
      .tm-limit-compound-note{margin-top:7px;color:#d8ae68;font-size:9px}
    `;
    document.head.appendChild(style);
  }

  function skillDef(value) {
    const key = canon(value);
    if (!key) return null;
    return enhancementState.catalog.skills.find(skill => {
      const aliases = [skill.name, skill.shortname, ...(skill.aliases || [])].filter(Boolean).map(canon);
      return aliases.includes(key);
    }) || null;
  }

  function skillKey(value) {
    return canon(skillDef(value)?.name || value);
  }

  function skillLevelByName(skillName, tribe) {
    if (!skillName) return null;
    const wanted = skillKey(skillName);
    for (const row of skillsForTribe(tribe) || []) {
      if ([row.skill, row.shortname].filter(Boolean).some(value => skillKey(value) === wanted)) return Number(row.level || 0);
    }
    return 0;
  }

  function limitLevel(activity, tribe) {
    return skillLevelByName(activity?.limitSkill || activity?.skill, tribe);
  }

  function workerLimitFor(activity, tribe) {
    if (activity?.limitType !== 'sharedPerSkill10') return null;
    const level = Number(limitLevel(activity, tribe) || 0);
    return level >= 10 ? Infinity : level * 10;
  }

  function resolveActivityLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const compact = raw.toUpperCase().replace(/[^A-Z]/g, '');
    const compound = {
      SKINGUTBONE: 'SKIN_GUT_BONE', SGB: 'SKIN_GUT_BONE',
      SKINGUT: 'SKIN_GUT', SKINBONE: 'SKIN_BONE', GUTBONE: 'GUT_BONE'
    }[compact];
    if (compound) return activityFor(compound);
    const wanted = canon(raw).replace(/\bMAKING\b/g, '').trim();
    return state.catalog.find(activity => [activity.code, activity.name, ...(activity.orderAliases || [])]
      .map(value => canon(value).replace(/\bMAKING\b/g, '').trim()).includes(wanted)) || null;
  }

  function parentUnitIds(parent) {
    return new Set(allUnits().filter(unit => unitParent(unit) === parent).map(unit => String(unit.unit)));
  }

  function rowsForParent(parent) {
    const units = parentUnitIds(parent);
    if (finalized()) {
      return (state.turn?.final?.data?.activities || [])
        .filter(row => units.has(String(row.unit)))
        .map(row => ({ activity: resolveActivityLabel(row.activity), people: Math.max(0, Math.round(Number(row.people || 0))), source: row }));
    }
    return (state.turn?.activities || [])
      .filter(row => units.has(String(row.unit)))
      .map(row => ({ activity: activityFor(row.activityCode), people: Math.max(0, Math.round(Number(row.people || 0))), source: row }));
  }

  function sharedUsage(parent) {
    const usage = {};
    const compounds = [];
    for (const row of rowsForParent(parent)) {
      if (!row.activity || !row.people) continue;
      if (row.activity.limitType === 'compound') compounds.push(row);
      else if (row.activity.limitType === 'sharedPerSkill10') usage[row.activity.code] = Number(usage[row.activity.code] || 0) + row.people;
    }

    for (const row of compounds) {
      const components = (row.activity.components || []).map(activityFor).filter(Boolean);
      const added = Object.fromEntries(components.map(component => [component.code, 0]));
      for (let i = 0; i < row.people; i++) {
        let candidates = components.filter(component => {
          const limit = workerLimitFor(component, parent);
          return !Number.isFinite(limit) || Number(usage[component.code] || 0) + Number(added[component.code] || 0) < limit;
        });
        if (!candidates.length) candidates = components;
        candidates.sort((a, b) => Number(added[a.code] || 0) - Number(added[b.code] || 0) || a.code.localeCompare(b.code));
        const picked = candidates[0];
        if (picked) added[picked.code] = Number(added[picked.code] || 0) + 1;
      }
      for (const [code, amount] of Object.entries(added)) usage[code] = Number(usage[code] || 0) + amount;
    }
    return usage;
  }

  function flattenResources(unitCode) {
    const totals = new Map();
    const add = (name, quantity) => {
      const key = canon(name);
      if (!key) return;
      totals.set(key, Number(totals.get(key) || 0) + Number(quantity || 0));
      if (key.endsWith('S')) totals.set(key.slice(0, -1), Number(totals.get(key.slice(0, -1)) || 0) + Number(quantity || 0));
      else totals.set(`${key}S`, Number(totals.get(`${key}S`) || 0) + Number(quantity || 0));
    };

    const selectedUnit = allUnits().find(row => String(row.unit) === String(unitCode));
    for (const [section, values] of Object.entries(selectedUnit?.resources || {})) {
      void section;
      for (const [name, quantity] of Object.entries(values || {})) add(name, quantity);
    }

    const resultUnit = (enhancementState.baselineResult?.units || []).find(row => String(row.unitCode) === String(unitCode));
    for (const values of Object.values(resultUnit?.resources || {})) {
      for (const [name, quantity] of Object.entries(values || {})) add(name, quantity);
    }
    return totals;
  }

  function availableResource(resourceMap, item) {
    const alternatives = String(item || '').split('/').map(canon).filter(Boolean);
    let best = 0;
    for (const alternative of alternatives) best = Math.max(best, Number(resourceMap.get(alternative) || 0));
    return best;
  }

  function evaluateRecipe(recipe, unit) {
    const parent = unit?.parentTribe || rootTribe(unit?.unit);
    const reasons = [];
    const warnings = [];
    for (const requirement of recipe.requirements || []) {
      const level = skillLevelByName(requirement.skill, parent);
      if (Number(level || 0) < Number(requirement.level || 0)) reasons.push(`${requirement.skill} ${requirement.level} required (have ${level || 0})`);
    }
    const resources = flattenResources(unit?.unit);
    for (const required of recipe.inputs || []) {
      const have = availableResource(resources, required.item);
      if (!required.optional && have < Number(required.quantity || 0)) reasons.push(`${required.item}: ${have}/${required.quantity}`);
    }
    const availablePeople = Math.max(0, workforce(unit) - plannedPeopleForUnit(unit?.unit));
    if (!finalized() && Number(recipe.people || 0) > availablePeople) warnings.push(`People: ${availablePeople}/${recipe.people}`);
    for (const facility of recipe.facilities || []) warnings.push(`Requires ${facility}`);
    for (const condition of recipe.conditions || []) warnings.push(condition);
    return { reasons, warnings, available: reasons.length === 0 };
  }

  function ensureExplorer() {
    let host = document.getElementById('mandateSkillExplorer');
    if (host) return host;
    const select = document.getElementById('activitySelect');
    if (!select) return null;
    host = document.createElement('div');
    host.id = 'mandateSkillExplorer';
    host.className = 'tm-mandate-explorer hidden';
    select.insertAdjacentElement('afterend', host);
    return host;
  }

  function renderRecipeExplorer() {
    const host = ensureExplorer();
    if (!host) return;
    const unit = selected();
    if (!enhancementState.selectedSkill || !unit) {
      host.classList.add('hidden');
      host.innerHTML = '';
      return;
    }
    const def = skillDef(enhancementState.selectedSkill);
    const skillName = def?.name || enhancementState.selectedSkill;
    const recipes = enhancementState.catalog.recipes.filter(recipe => skillKey(recipe.primarySkill) === skillKey(skillName));
    const level = skillLevelByName(skillName, unit.parentTribe || rootTribe(unit.unit));
    host.classList.remove('hidden');
    host.innerHTML = `<div class="tm-mandate-head"><div><strong>${html(skillName)} ${html(level)}</strong><small>Mandate production/build options · click Use to populate Draft Plan</small></div><small>${html(enhancementState.catalog.sourceDocument || 'Mandate')}</small></div>`;
    if (!recipes.length) {
      host.innerHTML += '<div class="history-empty">No fixed make/build recipes are catalogued for this skill in the current Mandate database.</div>';
      return;
    }
    const list = document.createElement('div');
    list.className = 'tm-recipe-list';
    list.innerHTML = recipes.map(recipe => {
      const evaluation = evaluateRecipe(recipe, unit);
      const blocked = evaluation.reasons.length > 0;
      const caution = !blocked && evaluation.warnings.length > 0;
      const badges = [];
      for (const requirement of recipe.requirements || []) {
        const have = skillLevelByName(requirement.skill, unit.parentTribe || rootTribe(unit.unit));
        badges.push(`<span class="tm-recipe-badge ${have >= requirement.level ? 'good' : 'bad'}">${html(requirement.skill)} ${html(have)}/${html(requirement.level)}</span>`);
      }
      const resources = flattenResources(unit.unit);
      for (const required of recipe.inputs || []) {
        const have = availableResource(resources, required.item);
        badges.push(`<span class="tm-recipe-badge ${have >= required.quantity ? 'good' : 'bad'}">${html(required.item)} ${html(have)}/${html(required.quantity)}</span>`);
      }
      if (recipe.people) badges.push(`<span class="tm-recipe-badge">${html(recipe.people)} people/AM</span>`);
      const warnings = [...(recipe.facilities || []).map(value => `Requires ${value}`), ...(recipe.conditions || [])];
      return `<div class="tm-recipe ${blocked ? 'blocked' : caution ? 'caution' : 'available'}" data-recipe="${html(recipe.recipeKey)}">
        <div class="tm-recipe-top"><strong>${html(recipe.name)}</strong><span class="tm-recipe-section">§ ${html(recipe.section)}</span></div>
        <div class="tm-recipe-badges">${badges.join('')}</div>
        ${warnings.length ? `<div class="tm-recipe-note">${warnings.map(html).join(' · ')}</div>` : ''}
        ${recipe.notes ? `<div class="tm-recipe-note">${html(recipe.notes)}</div>` : ''}
        <button class="button tm-recipe-use" data-use-recipe="${html(recipe.recipeKey)}" ${finalized() ? 'disabled' : ''}>Use in Draft Plan</button>
      </div>`;
    }).join('');
    host.appendChild(list);
    host.querySelectorAll('[data-use-recipe]').forEach(button => button.addEventListener('click', () => useRecipe(button.dataset.useRecipe)));
  }

  function useRecipe(recipeKey) {
    const recipe = enhancementState.catalog.recipes.find(row => row.recipeKey === recipeKey);
    if (!recipe || finalized()) return;
    const activity = activityFor(recipe.activityCode);
    if (activity) document.getElementById('activitySelect').value = activity.code;
    document.getElementById('activityPeople').value = String(Math.max(0, Number(recipe.people || 0)));
    document.getElementById('activityTarget').value = recipe.outputItem || recipe.name;
    const detail = [`Mandate ${recipe.section}`];
    if (recipe.distinction) detail.push(recipe.distinction);
    if (recipe.facilities?.length) detail.push(`Requires: ${recipe.facilities.join(', ')}`);
    if (recipe.conditions?.length) detail.push(`Conditions: ${recipe.conditions.join(', ')}`);
    if (recipe.notes) detail.push(recipe.notes);
    document.getElementById('activityNotes').value = detail.join(' · ');
    renderActivityRule();
    document.getElementById('activityPeople').focus();
  }

  function renderFullSkills(unit) {
    const skills = unit.skills || skillsForTribe(unit.parentTribe);
    const host = document.getElementById('skillList');
    if (!skills.length) {
      host.innerHTML = '<div class="history-empty">No skill levels were detected in the Results baseline. Activity validation will warn rather than block on unknown skills.</div>';
      return;
    }
    const sorted = [...skills].sort((a, b) => {
      const an = skillDef(a.skill)?.name || skillDef(a.shortname)?.name || a.skill || a.shortname || '';
      const bn = skillDef(b.skill)?.name || skillDef(b.shortname)?.name || b.skill || b.shortname || '';
      return an.localeCompare(bn);
    });
    host.innerHTML = sorted.map(row => {
      const def = skillDef(row.skill) || skillDef(row.shortname);
      const full = def?.name || row.skill || row.shortname;
      const short = def?.shortname || row.shortname || '';
      const active = skillKey(enhancementState.selectedSkill) === skillKey(full);
      return `<button class="tm-skill tm-skill-button ${unit.type === 'Tribe' ? '' : 'inherited'} ${active ? 'active' : ''}" data-mandate-skill="${html(full)}"><b>${html(full)}</b> ${html(Number(row.level || 0).toLocaleString())}${short && canon(short) !== canon(full) ? `<span class="tm-skill-short">${html(short)}</span>` : ''}</button>`;
    }).join('');
    host.querySelectorAll('[data-mandate-skill]').forEach(button => button.addEventListener('click', () => {
      enhancementState.selectedSkill = button.dataset.mandateSkill;
      renderFullSkills(unit);
      renderRecipeExplorer();
      const explorer = ensureExplorer();
      explorer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
  }

  function renderFixedSharedLimits(unit) {
    const parent = unit.parentTribe || rootTribe(unit.unit);
    document.getElementById('sharedLimitTitle').textContent = `Tribe ${parent}`;
    const usage = sharedUsage(parent);
    const entries = [];
    for (const activity of state.catalog.filter(row => row.limitType === 'sharedPerSkill10')) {
      const level = limitLevel(activity, parent);
      const used = Number(usage[activity.code] || 0);
      const limit = workerLimitFor(activity, parent);
      if (!used && (!level || level <= 0)) continue;
      const limitSkillName = skillDef(activity.limitSkill || activity.skill)?.name || activity.limitSkill || activity.skill;
      entries.push({ name: activity.name, used, limit, detail: `${limitSkillName} ${level || 0}${activity.limitSkill ? ' controls worker limit' : ''}` });
    }
    const scoutSource = state.turn?.final?.data;
    const scoutCount = (scoutSource?.scouts || []).filter(row => rootTribe(row.unit) === parent).length;
    entries.push({ name: 'Scout groups', used: scoutCount, limit: 8, detail: finalized() ? 'from completed orders' : 'draft routes are managed in the Mapper' });
    const host = document.getElementById('sharedLimits');
    host.innerHTML = entries.map(entry => {
      const finite = Number.isFinite(entry.limit);
      const pct = finite && entry.limit > 0 ? entry.used / entry.limit * 100 : 0;
      const cls = finite && entry.used > entry.limit ? 'over' : finite && pct >= 85 ? 'warn' : '';
      return `<div class="tm-limit"><div class="tm-limit-head"><span>${html(entry.name)}</span><strong>${html(entry.used.toLocaleString())} / ${finite ? html(entry.limit.toLocaleString()) : '∞'}</strong></div>${finite ? `<div class="tm-limit-bar"><div class="tm-limit-fill ${cls}" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>` : ''}<div class="tm-limit-detail">${html(entry.detail)}</div></div>`;
    }).join('') || '<div class="history-empty">No shared limits currently in use.</div>';
  }

  function validateFixedActivity() {
    const unit = selected();
    const activity = activityFor(document.getElementById('activitySelect').value);
    const people = Math.max(0, Math.round(Number(document.getElementById('activityPeople').value || 0)));
    const host = document.getElementById('activityValidation');
    host.className = 'tm-validation';
    if (finalized()) {
      host.textContent = 'Planning is closed because completed orders have been imported. Re-importing completed orders replaces the submitted copy.';
      host.classList.add('warn');
      return { ok: false, errors: ['Turn is finalized.'], warnings: [] };
    }
    if (!unit || !activity) { host.textContent = ''; return { ok: false, errors: [], warnings: [] }; }
    const errors = [], warnings = [];
    const parent = unit.parentTribe || rootTribe(unit.unit);
    const skills = skillsForTribe(parent);
    if (activity.tribeOnly && unit.type !== 'Tribe') errors.push('This activity is Tribe-only.');
    if (activity.skill && skills.length) {
      const level = skillLevelByName(activity.skill, parent);
      const required = Number(activity.minimumSkill || (activity.levelZeroAllowed ? 0 : 1));
      if (level < required) errors.push(`${skillDef(activity.skill)?.name || activity.skill} ${required} required; Tribe ${parent} has ${level}.`);
    } else if (activity.skill && !skills.length) warnings.push('Skill levels were not detected, so skill eligibility cannot be validated yet.');

    const currentUsage = sharedUsage(parent);
    if (activity.limitType === 'sharedPerSkill10' && skills.length) {
      const limit = workerLimitFor(activity, parent);
      const used = Number(currentUsage[activity.code] || 0);
      if (Number.isFinite(limit) && used + people > limit) errors.push(`Shared ${activity.name} allocation would be ${used + people}/${limit}.`);
    }
    if (activity.limitType === 'compound' && skills.length) {
      const simulated = Object.fromEntries(Object.entries(currentUsage));
      const components = (activity.components || []).map(activityFor).filter(Boolean);
      const additions = Object.fromEntries(components.map(component => [component.code, 0]));
      for (let i = 0; i < people; i++) {
        let candidates = components.filter(component => {
          const limit = workerLimitFor(component, parent);
          return !Number.isFinite(limit) || Number(simulated[component.code] || 0) + Number(additions[component.code] || 0) < limit;
        });
        if (!candidates.length) candidates = components;
        candidates.sort((a, b) => Number(additions[a.code] || 0) - Number(additions[b.code] || 0) || a.code.localeCompare(b.code));
        if (candidates[0]) additions[candidates[0].code] += 1;
      }
      for (const component of components) {
        const limit = workerLimitFor(component, parent);
        const total = Number(simulated[component.code] || 0) + Number(additions[component.code] || 0);
        if (Number.isFinite(limit) && total > limit) errors.push(`${component.name} share would be ${total}/${limit}.`);
      }
    }

    const pool = workforce(unit), already = plannedPeopleForUnit(unit.unit);
    if (pool > 0 && already + people > pool) errors.push(`Unit workforce would be ${already + people}/${pool}.`);
    if (activity.code === 'CUSTOM') warnings.push('Custom activities are not rule-validated.');
    host.textContent = [...errors, ...warnings].join(' ');
    if (errors.length) host.classList.add('error'); else if (warnings.length) host.classList.add('warn');
    return { ok: errors.length === 0, errors, warnings };
  }

  async function loadBaselineResult() {
    enhancementState.baselineResult = null;
    const key = state.turn?.start?.data?.resultTurnKey;
    if (!key || !window.tribenet.getResultTurn) return;
    try { enhancementState.baselineResult = await window.tribenet.getResultTurn(key); }
    catch (_) { enhancementState.baselineResult = null; }
  }

  async function boot() {
    installStyles();
    enhancementState.catalog = await window.tribenet.getMandateCatalog();
    state.mandateCatalog = enhancementState.catalog;

    // Replace Turn Manager skill matching with the Mandate canonical skill dictionary.
    skillLevel = (activity, tribe) => activity?.skill ? skillLevelByName(activity.skill, tribe) : null;
    renderSkills = renderFullSkills;
    renderSharedLimits = renderFixedSharedLimits;
    validateActivity = validateFixedActivity;

    const originalRule = renderActivityRule;
    renderActivityRule = function mandateRule() {
      originalRule();
      renderRecipeExplorer();
    };

    const originalLoad = loadTurn;
    loadTurn = async function mandateLoad(turnKey) {
      await originalLoad(turnKey);
      await loadBaselineResult();
      if (selected()) {
        renderFullSkills(selected());
        renderFixedSharedLimits(selected());
        renderRecipeExplorer();
      }
    };

    await loadBaselineResult();
    if (selected()) {
      renderFullSkills(selected());
      renderFixedSharedLimits(selected());
    }
    renderRecipeExplorer();
  }

  function waitForTurnManager(attempt = 0) {
    if (typeof state !== 'undefined' && typeof renderSkills === 'function' && typeof activityFor === 'function' && window.tribenet?.getMandateCatalog) {
      boot().catch(error => console.error('Mandate Turn Manager enhancement failed', error));
      return;
    }
    if (attempt < 50) setTimeout(() => waitForTurnManager(attempt + 1), 50);
  }

  waitForTurnManager();
})();

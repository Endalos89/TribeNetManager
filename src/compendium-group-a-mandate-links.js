(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S || typeof showSkill !== 'function') return;

  const c = value => (typeof canon === 'function' ? canon(value) : S.canon(value));
  const add = (set, value) => {
    const text = String(value || '').trim();
    if (text) set.add(text);
  };
  const addResourceRows = (set, rows) => {
    for (const row of rows || []) {
      if (!row || typeof row !== 'object') continue;
      add(set, row.entity);
      add(set, row.item);
      addResourceRows(set, row.inputs);
      addResourceRows(set, row.outputs);
      for (const variant of row.variants || []) addResourceRows(set, [variant]);
    }
  };

  function structuredNamesForProfile(profile) {
    const names = new Set();
    if (!profile) return names;

    addResourceRows(names, profile.directCrafts);
    addResourceRows(names, profile.requiredUses);
    addResourceRows(names, profile.processRows);
    addResourceRows(names, profile.outputs);

    for (const row of profile.levelUses || []) add(names, row.item);

    for (const field of ['implements', 'supportImplements', 'modifiers', 'benefitItems']) {
      for (const row of profile[field] || []) {
        if (c(row?.source) === 'MANDATE') add(names, row.name);
      }
    }

    for (const group of profile.ruleGroups || []) {
      for (const row of group.rows || []) {
        for (const value of row.values || []) add(names, value);
      }
    }

    for (const table of profile.factTables || []) {
      for (const row of table.rows || []) {
        for (const value of Object.values(row || {})) {
          if (value && typeof value === 'object') add(names, value.entity);
        }
      }
    }

    for (const value of profile.mandateEntities || []) add(names, value);
    return names;
  }

  function linkedNamesForSkill(skillName) {
    const profile = S.profile?.(skillName);
    const names = structuredNamesForProfile(profile);
    if (!profile) return names;

    // Item-benefit rows are explicit semantic links. Only Mandate-sourced
    // benefits belong in this Mandate-linked block; Research List items stay
    // in the research/equipment areas of the dossier instead.
    if (typeof entities === 'function' && typeof S.itemBenefitsFor === 'function') {
      for (const entity of entities() || []) {
        const benefits = S.itemBenefitsFor(entity.name || entity.key) || [];
        if (benefits.some(row => c(row?.skill) === c(profile.name) && c(row?.source) === 'MANDATE')) {
          add(names, entity.name || entity.key);
        }
      }
    }
    return names;
  }

  function resolveEntity(name) {
    if (typeof entityByName === 'function') {
      const direct = entityByName(name);
      if (direct) return direct;
    }
    if (typeof entities !== 'function') return null;
    const key = c(name);
    return (entities() || []).find(entity => c(entity.name) === key || c(entity.key) === key) || null;
  }

  function resolvedEntitiesForSkill(skillName) {
    const seen = new Set();
    const out = [];
    for (const name of linkedNamesForSkill(skillName)) {
      const entity = resolveEntity(name);
      if (!entity) continue;
      const key = c(entity.key || entity.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entity);
    }
    return out.sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key)));
  }

  window.TribeNetGroupAMandateLinks = {
    structuredNamesForProfile,
    linkedNamesForSkill,
    resolvedEntitiesForSkill
  };

  const oldShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const result = oldShowSkill(name, push);
    const skill = typeof skillByName === 'function' ? skillByName(name) : null;
    if (!skill || skill.skillGroup !== 'A' || !S.profile?.(skill.name)) return result;

    const article = typeof $ === 'function' ? $('compArticle') : null;
    if (!article) return result;

    // The old Mandate integration inferred entity links from every full section
    // that happened to mention a skill. That produced false positives such as
    // Adze on Armour. Group A now uses only explicit dossier relationships.
    article.querySelectorAll('.mandate-skill-entities').forEach(node => node.remove());

    const related = resolvedEntitiesForSkill(skill.name);
    if (related.length) {
      article.insertAdjacentHTML('beforeend', `<section class="comp-section mandate-skill-entities"><h2>Mandate-linked tools, goods & structures</h2><p class="comp-muted">Explicit Group A relationships only. Incidental co-occurrence elsewhere in the Mandate is excluded.</p><div class="comp-tags">${related.map(item => `<button class="comp-link" data-entity="${esc(item.key)}">${esc(item.name)}</button>`).join('')}</div></section>`);
      if (typeof bindLinks === 'function') bindLinks(article);
    }
    return result;
  };
})();
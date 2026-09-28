(() => {
  const S = window.TribeNetSkillOverhaul;
  const D = window.TribeNetResearchV2;
  const M = window.TRIBENET_MANDATE;
  if (!S) return;

  const e = value => esc(value);
  const canon = value => S.canon(value);

  function mandateLink(section, label = null) {
    const target = M?.getSection?.(section);
    const text = label || `Mandate § ${section}`;
    if (!target) return `<span class="skill-source-chip">${e(text)}</span>`;
    return `<a class="skill-source-chip mandate" href="#${e(M.anchorId(target.section))}" data-mandate-open="${e(target.section)}">${e(label || `Mandate § ${target.section}`)}</a>`;
  }

  function entityLink(name, label = name) {
    const entity = typeof entityByName === 'function' ? entityByName(name) : null;
    return entity ? `<button class="comp-text-link" data-entity="${e(entity.key || entity.name)}">${e(label)}</button>` : e(label);
  }

  function skillLink(name) {
    const skill = typeof skillByName === 'function' ? skillByName(name) : null;
    return skill ? `<button class="comp-link" data-skill="${e(skill.name)}">${e(skill.name)}</button>` : `<span class="comp-link inert">${e(name)}</span>`;
  }

  function resourceList(rows, joiner = ' · ') {
    return (rows || []).map(row => {
      const label = row.label || `${row.quantity ?? ''} ${row.entity || ''}`.trim();
      return row.entity ? entityLink(row.entity, label) : e(label);
    }).join(joiner) || '—';
  }

  function researchCard(topic, compact = false) {
    const effect = topic.effects?.[0] || topic.description || topic.sourceGaps?.[0] || 'Open research entry';
    return `<button class="skill-research-card ${compact ? 'compact' : ''}" data-research-v2="${e(topic.key)}">
      <span class="skill-research-head"><strong>${e(topic.name)}</strong><small>${e(topic.skill)} · DL ${e(topic.dl)} · p. ${e(topic.page)}</small></span>
      <span class="skill-research-effect">${e(effect)}</span>
    </button>`;
  }

  function researchSection(profile) {
    if (!D) return '';
    const own = (D.topicsForSkill?.(profile.name) || []).slice().sort((a,b) => Number(a.page || 0) - Number(b.page || 0) || a.name.localeCompare(b.name));
    const ownKeys = new Set(own.map(row => canon(`${row.skill}|${row.name}`)));
    const inbound = (D.affectingSkill?.(profile.name) || []).filter(row => !ownKeys.has(canon(`${row.skill}|${row.name}`)));
    if (!own.length && !inbound.length) return '';
    return `<section class="skill-dossier-section">
      <div class="skill-section-heading"><div><span>Research List</span><h2>${e(profile.name)} research</h2></div></div>
      ${own.length ? `<div class="skill-research-grid">${own.map(row => researchCard(row)).join('')}</div>` : '<p class="skill-table-note">No dedicated research topics are indexed for this skill.</p>'}
      ${inbound.length ? `<div class="skill-cross-research"><h3>Other research affecting ${e(profile.name)}</h3><div class="skill-research-grid compact-grid">${inbound.map(row => researchCard(row, true)).join('')}</div></div>` : ''}
    </section>`;
  }

  function titleAndGlance(profile, skill) {
    const mappedCount = profile.layout === 'category-a-craft' ? (profile.directCrafts || []).length : (profile.processRows || []).length;
    const mappedLabel = profile.layout === 'category-a-craft' ? 'Direct recipes' : 'Activity outputs';
    return `<div class="skill-dossier-title">
      <div><div class="comp-kicker">Group ${e(skill.skillGroup)} skill · ${e(skill.shortname || '')}</div><h1>${e(skill.name)}</h1><p>${e(profile.summary)}</p></div>
      <div class="skill-dossier-sources">${mandateLink(profile.primarySection)}</div>
    </div>
    <section class="skill-glance-grid" aria-label="${e(profile.name)} at a glance">
      <div class="skill-glance"><span>Skill behaviour</span><strong>${e(profile.mechanicLabel)}</strong><small>${e(profile.levelDetail || '')}</small></div>
      <div class="skill-glance"><span>Workers</span><strong>${e(profile.workerRule)}</strong><small>${e(profile.workerDetail || '')}</small></div>
      <div class="skill-glance"><span>${e(mappedLabel)}</span><strong>${e(mappedCount)} mapped</strong><small>Research, linked items and related skills are shown below.</small></div>
    </section>`;
  }

  function craftVariant(row) {
    const rows = row.variants || [{ people:row.people, inputs:row.inputs, detail:row.detail }];
    if (rows.length === 1) return `<div><strong>${e(rows[0].people ?? '—')}</strong></div><div>${resourceList(rows[0].inputs)}</div><div>${e(rows[0].detail || row.detail || '—')}</div>`;
    return `<div class="skill-craft-list">${rows.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${e(variant.people ?? '—')} people</span>`).join('')}</div>
      <div class="skill-craft-list">${rows.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${resourceList(variant.inputs)}</span>`).join('')}</div>
      <div class="skill-craft-list">${rows.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${e(variant.detail || row.detail || '—')}</span>`).join('')}</div>`;
  }

  function craftTable(profile) {
    const rows = [...(profile.directCrafts || [])].sort((a,b) => Number(a.level) - Number(b.level) || String(a.label).localeCompare(String(b.label)));
    if (!rows.length) return '';
    return `<section class="skill-dossier-section category-a-direct-crafts">
      <div class="skill-section-heading"><div><span>Direct production</span><h2>Things you can make with ${e(profile.name)} alone</h2></div>${mandateLink(profile.primarySection)}</div>
      <div class="skill-callout"><strong>Production skill:</strong> These are direct ${e(profile.name)} recipes. Inputs and labour still apply, but no second production skill is required unless a row explicitly says otherwise.</div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table category-a-craft-table"><thead><tr><th>${e(profile.name)}</th><th>Result</th><th>People</th><th>Inputs</th><th>Notes</th><th>Source</th></tr></thead><tbody>
        ${rows.map(row => { const parts = craftVariant(row); const cells = parts.match(/<div[\s\S]*?<\/div>/g) || []; return `<tr><td><strong>${e(row.level)}</strong></td><td>${row.entity ? entityLink(row.entity,row.label) : e(row.label)}</td><td>${cells[0] || e(row.people ?? '—')}</td><td>${cells[1] || resourceList(row.inputs)}</td><td>${cells[2] || e(row.detail || '—')}</td><td>${mandateLink(row.source)}</td></tr>`; }).join('')}
      </tbody></table></div>
    </section>`;
  }

  function requiredUses(profile) {
    const rows = profile.requiredUses || [];
    if (!rows.length) return '';
    return `<section class="skill-dossier-section category-a-required-uses">
      <div class="skill-section-heading"><div><span>Prerequisite uses</span><h2>Where ${e(profile.name)} is required</h2></div></div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>${e(profile.name)}</th><th>Result / use</th><th>Other skills required</th><th>Notes</th><th>Source</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${e(row.level)}</strong></td><td>${row.entity ? entityLink(row.entity,row.label) : e(row.label)}</td><td>${(row.requirements || []).map(req => `${skillLink(req.skill)} <strong>${e(req.level)}</strong>`).join('<br>') || e(row.requirementsText || '—')}</td><td>${e(row.detail || '—')}</td><td>${mandateLink(row.source)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  function processTable(profile) {
    const rows = profile.processRows || [];
    if (!rows.length) return '';
    return `<section class="skill-dossier-section category-a-process-output">
      <div class="skill-section-heading"><div><span>Activity output</span><h2>What each worker does</h2></div>${mandateLink(profile.primarySection)}</div>
      <div class="skill-callout"><strong>Capacity vs output:</strong> ${e(profile.levelDetail || 'The skill controls worker capacity; the conversion shown below is per worker.')}</div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table category-a-process-table"><thead><tr><th>Activity</th><th>Labour</th><th>Inputs / subjects</th><th>Output</th><th>Notes</th><th>Source</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${e(row.activity)}</strong></td><td>${e(row.perWorker || '—')}</td><td>${resourceList(row.inputs,row.inputJoin || ' ')}</td><td>${resourceList(row.outputs)}</td><td>${e(row.detail || '—')}</td><td>${mandateLink(row.source)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  function ruleGroups(profile) {
    if (!profile.ruleGroups?.length) return '';
    return profile.ruleGroups.map(group => `<section class="skill-dossier-section"><div class="skill-section-heading"><div><span>Rules</span><h2>${e(group.title)}</h2></div></div>${group.detail ? `<p class="skill-table-note">${e(group.detail)}</p>` : ''}<div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>Category</th><th>Items</th></tr></thead><tbody>${(group.rows || []).map(row => `<tr><td><strong>${e(row.label)}</strong></td><td>${(row.values || []).map(value => entityLink(value)).join(' · ')}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
  }

  function supportingRules(profile) {
    const combined = profile.combinedWith || [];
    const notes = profile.notes || [];
    if (!combined.length && !notes.length) return '';
    return `<section class="skill-dossier-section"><div class="skill-section-heading"><div><span>Rules</span><h2>Special rules & interactions</h2></div></div>
      ${combined.length ? `<div class="skill-callout"><strong>Can be combined with:</strong> ${combined.map(skillLink).join(' · ')}</div>` : ''}
      ${notes.length ? `<ul>${notes.map(note => `<li>${e(note)}</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  function footer(profile) {
    const sections = [profile.primarySection, ...(profile.additionalSections || [])];
    return `<section class="skill-dossier-section skill-related-section"><div class="skill-section-heading"><div><span>Connections</span><h2>Related skills</h2></div></div><div class="comp-tags">${(profile.relatedSkills || []).map(skillLink).join('')}</div></section>
    <section class="skill-dossier-section skill-sources-section"><div class="skill-section-heading"><div><span>References</span><h2>Sources</h2></div></div><div class="skill-source-row">${[...new Set(sections)].map(section => mandateLink(section)).join('')}</div></section>`;
  }

  function renderCategoryA(profile, skill) {
    const article = $('compArticle');
    if (!article) return;
    article.classList.add('skill-dossier-mode');
    $('compBreadcrumbs').textContent = `Compendium › Skills › Group ${skill.skillGroup} › ${skill.name}`;
    article.innerHTML = `${titleAndGlance(profile,skill)}${profile.layout === 'category-a-craft' ? `${craftTable(profile)}${requiredUses(profile)}` : processTable(profile)}${ruleGroups(profile)}${supportingRules(profile)}${researchSection(profile)}${footer(profile)}`;
    bindLinks(article);
  }

  const previousShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const profile = S.profile(name);
    if (!profile || !['category-a-craft','category-a-process'].includes(profile.layout)) return previousShowSkill(name,push);
    previousShowSkill(name,push);
    const skill = skillByName(profile.name) || skillByName(name);
    if (skill) renderCategoryA(profile,skill);
  };
})();

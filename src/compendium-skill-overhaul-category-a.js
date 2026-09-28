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

  function researchEffectForSkill(topic, profile) {
    const override = profile?.researchEffectOverrides?.[topic.name];
    if (override) return override;
    const effects = topic.effects || [];
    const needles = [profile?.name, ...(profile?.aliases || []), ...(profile?.researchAliases || [])]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    for (const needle of needles) {
      const rx = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      const tagged = effects.find(effect => rx.test(String(effect)));
      if (tagged) return tagged;
    }
    return topic.summary || effects[0] || topic.description || topic.sourceGaps?.[0] || 'Open research entry';
  }

  function researchCard(topic, profile, compact = false) {
    const effect = researchEffectForSkill(topic, profile);
    return `<button class="skill-research-card ${compact ? 'compact' : ''}" data-research-v2="${e(topic.key)}">
      <span class="skill-research-head"><strong>${e(topic.name)}</strong><small>${e(topic.skill)} · DL ${e(topic.dl)} · p. ${e(topic.page)}</small></span>
      <span class="skill-research-effect">${e(effect)}</span>
    </button>`;
  }

  function researchRows(profile) {
    if (!D) return { own:[], inbound:[] };
    const own = (D.topicsForSkill?.(profile.name) || []).slice().sort((a,b) => Number(a.page || 0) - Number(b.page || 0) || a.name.localeCompare(b.name));
    const ownKeys = new Set(own.map(row => canon(`${row.skill}|${row.name}`)));
    const inbound = (D.affectingSkill?.(profile.name) || []).filter(row => !ownKeys.has(canon(`${row.skill}|${row.name}`)));
    return { own, inbound };
  }

  function researchSection(profile) {
    const { own, inbound } = researchRows(profile);
    if (!own.length && !inbound.length) return '';
    return `<section class="skill-dossier-section">
      <div class="skill-section-heading"><div><span>Research List</span><h2>${e(profile.name)} research</h2></div></div>
      ${own.length ? `<div class="skill-research-grid">${own.map(row => researchCard(row, profile)).join('')}</div>` : '<p class="skill-table-note">No dedicated research topics are indexed for this skill.</p>'}
      ${inbound.length ? `<div class="skill-cross-research"><h3>Other research affecting ${e(profile.name)}</h3><div class="skill-research-grid compact-grid">${inbound.map(row => researchCard(row, profile, true)).join('')}</div></div>` : ''}
    </section>`;
  }

  function titleAndGlance(profile, skill) {
    const { own, inbound } = researchRows(profile);
    const researchLabel = own.length ? `${own.length} dedicated topic${own.length === 1 ? '' : 's'}` : 'No dedicated topics';
    const researchDetail = inbound.length ? `${inbound.length} additional cross-skill research link${inbound.length === 1 ? '' : 's'}` : 'Cross-skill effects appear here when indexed.';
    return `<div class="skill-dossier-title">
      <div><div class="comp-kicker">Group ${e(skill.skillGroup)} skill · ${e(skill.shortname || '')}</div><h1>${e(skill.name)}</h1><p>${e(profile.summary)}</p></div>
      <div class="skill-dossier-sources">${mandateLink(profile.primarySection)}</div>
    </div>
    <section class="skill-glance-grid" aria-label="${e(profile.name)} at a glance">
      <div class="skill-glance"><span>Skill behaviour</span><strong>${e(profile.mechanicLabel)}</strong><small>${e(profile.levelDetail || '')}</small></div>
      <div class="skill-glance"><span>Workers</span><strong>${e(profile.workerRule)}</strong><small>${e(profile.workerDetail || '')}</small></div>
      <div class="skill-glance"><span>Research</span><strong>${e(researchLabel)}</strong><small>${e(researchDetail)}</small></div>
    </section>`;
  }

  function craftCells(row) {
    const variants = row.variants || [{ people:row.people, inputs:row.inputs, detail:row.detail }];
    if (variants.length === 1) {
      const variant = variants[0];
      return {
        people:e(variant.people ?? row.people ?? '—'),
        inputs:resourceList(variant.inputs || row.inputs),
        notes:e(variant.detail || row.detail || '—')
      };
    }
    return {
      people:`<div class="skill-craft-list">${variants.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${e(variant.people ?? '—')} people</span>`).join('')}</div>`,
      inputs:`<div class="skill-craft-list">${variants.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${resourceList(variant.inputs)}</span>`).join('')}</div>`,
      notes:`<div class="skill-craft-list">${variants.map(variant => `<span class="skill-craft-path"><strong>${e(variant.label || 'Option')}</strong> · ${e(variant.detail || row.detail || '—')}</span>`).join('')}</div>`
    };
  }

  function craftTable(profile) {
    const rows = [...(profile.directCrafts || [])].sort((a,b) => Number(a.level) - Number(b.level) || String(a.label).localeCompare(String(b.label)));
    if (!rows.length) return '';
    return `<section class="skill-dossier-section category-a-direct-crafts">
      <div class="skill-section-heading"><div><span>Direct production</span><h2>Things you can make with ${e(profile.name)} alone</h2></div>${mandateLink(profile.primarySection)}</div>
      <div class="skill-callout"><strong>Direct recipes:</strong> These are the items listed directly under ${e(profile.name)}. Inputs and labour still apply, but no second production skill is required unless a row explicitly says otherwise.</div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table category-a-craft-table"><thead><tr><th>${e(profile.name)}</th><th>Result</th><th>People</th><th>Inputs</th><th>Notes</th><th>Source</th></tr></thead><tbody>
        ${rows.map(row => { const cells = craftCells(row); return `<tr><td><strong>${e(row.level)}</strong></td><td>${row.entity ? entityLink(row.entity,row.label) : e(row.label)}</td><td>${cells.people}</td><td>${cells.inputs}</td><td>${cells.notes}</td><td>${mandateLink(row.source)}</td></tr>`; }).join('')}
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

  function activityOutputs(profile) {
    if (!profile.outputs?.length) return '';
    return `<section class="skill-dossier-section category-a-activity-output">
      <div class="skill-section-heading"><div><span>Outputs</span><h2>${e(profile.name)} output</h2></div>${mandateLink(profile.primarySection)}</div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-output-table"><thead><tr><th>Output</th><th>Base rate</th><th>Type</th><th>How it is produced</th><th>Source</th></tr></thead><tbody>${profile.outputs.map(row => `<tr><td>${row.item ? entityLink(row.item,row.label || row.item) : `<strong>${e(row.label || 'Output')}</strong>`}</td><td><strong>${e(row.rate || 'Variable')}</strong></td><td>${e(row.type || '')}</td><td>${e(row.detail || '')}</td><td>${mandateLink(row.source || profile.primarySection)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  function factorTable(profile) {
    if (!profile.factors?.length) return '';
    return `<section class="skill-dossier-section category-a-factors">
      <div class="skill-section-heading"><div><span>Factors</span><h2>Other factors affecting ${e(profile.name)}</h2></div></div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-factor-table"><thead><tr><th>Factor</th><th>Effect</th><th>Known detail</th></tr></thead><tbody>${profile.factors.map(row => `<tr><td><strong>${e(row.factor)}</strong></td><td>${e(row.effect)}</td><td>${e(row.detail || '')}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  function researchTopicFor(item) {
    if (!item?.research || !D?.topics) return null;
    return D.topics.find(topic => canon(`${topic.skill} / ${topic.name}`) === canon(item.research)) || null;
  }

  function equipmentSource(item) {
    if (item.source === 'Mandate') return mandateLink(item.section || item.sourceSection);
    const topic = researchTopicFor(item);
    if (topic) return `<button class="skill-source-chip research" data-research-v2="${e(topic.key)}">Research p. ${e(topic.page)}</button>`;
    return '<span class="skill-source-chip research">Research List</span>';
  }

  function madeWith(item) {
    const rows = item.craft || [];
    if (!rows.length) return item.requiresResearch ? '<span class="skill-research-required">Research required</span>' : '—';
    const skills = rows.map(row => `<span class="skill-craft-path">${skillLink(row.skill)} <strong>${e(row.level)}</strong>${row.note ? ` <small>${e(row.note)}</small>` : ''}</span>`).join('');
    return `<div class="skill-craft-list">${skills}${item.requiresResearch ? '<span class="skill-research-required">Research required</span>' : ''}</div>`;
  }

  function equipmentTable(rows, title, note = '') {
    if (!rows?.length) return '';
    const sorted = S.sortByBaseMaxBenefit ? S.sortByBaseMaxBenefit(rows) : [...rows];
    return `<section class="skill-dossier-section category-a-equipment">
      <div class="skill-section-heading"><div><span>Implements</span><h2>${e(title)}</h2></div></div>
      ${note ? `<p class="skill-table-note">${e(note)}</p>` : ''}
      <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>Implement / support</th><th>Made / converted with</th><th>Benefit</th><th>Base amount</th><th>Base max benefit</th><th>Source</th></tr></thead><tbody>${sorted.map(item => `<tr><td>${entityLink(item.name)}</td><td>${madeWith(item)}</td><td><strong>${e(item.value || '')}</strong><small class="skill-block-detail">${e(item.detail || '')}</small></td><td>${e(item.baseMax || '—')}</td><td>${e(item.baseMaxBenefit || '—')}</td><td>${equipmentSource(item)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  function factCell(value) {
    if (value == null || value === '') return '—';
    if (typeof value !== 'object') return e(value);
    if (value.entity) return entityLink(value.entity, value.label || value.text || value.entity);
    if (value.skill) return skillLink(value.skill);
    return value.strong ? `<strong>${e(value.text || value.label || '')}</strong>` : e(value.text || value.label || '');
  }

  function factTables(profile) {
    return (profile.factTables || []).map(table => `<section class="skill-dossier-section category-a-fact-table">
      <div class="skill-section-heading"><div><span>${e(table.kicker || 'Reference')}</span><h2>${e(table.title)}</h2></div>${table.source ? mandateLink(table.source) : ''}</div>
      ${table.note ? `<p class="skill-table-note">${e(table.note)}</p>` : ''}
      <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr>${(table.columns || []).map(col => `<th>${e(col.label)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(row => `<tr>${(table.columns || []).map(col => `<td>${factCell(row[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    </section>`).join('');
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
    let main = '';
    if (profile.layout === 'category-a-craft') main = `${craftTable(profile)}${requiredUses(profile)}`;
    else if (profile.layout === 'category-a-process') main = processTable(profile);
    else if (profile.layout === 'category-a-activity') main = `${activityOutputs(profile)}${factorTable(profile)}${equipmentTable(profile.implements, profile.implementTitle || `${profile.name} implements`, profile.implementRule || '')}${equipmentTable(profile.supportImplements, profile.supportTitle || 'Additional support', profile.supportRule || '')}${factTables(profile)}`;
    article.innerHTML = `${titleAndGlance(profile,skill)}${main}${ruleGroups(profile)}${supportingRules(profile)}${researchSection(profile)}${footer(profile)}`;
    bindLinks(article);
  }

  const previousShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const profile = S.profile(name);
    if (!profile || !['category-a-craft','category-a-process','category-a-activity'].includes(profile.layout)) return previousShowSkill(name,push);
    previousShowSkill(name,push);
    const skill = skillByName(profile.name) || skillByName(name);
    if (skill) renderCategoryA(profile,skill);
  };
})();

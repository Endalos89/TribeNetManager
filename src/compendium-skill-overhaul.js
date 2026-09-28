(() => {
  const S = window.TribeNetSkillOverhaul;
  const D = window.TribeNetResearchV2;
  const M = window.TRIBENET_MANDATE;
  if (!S) return;

  const e = value => esc(value);
  const canon = value => S.canon(value);

  function mandateLink(section, label = null) {
    const target = M?.getSection?.(section);
    if (!target) return `<span class="skill-source-chip">${e(label || `Mandate § ${section}`)}</span>`;
    const text = label || (/^Appendix/i.test(target.section) ? target.section : `Mandate § ${target.section}`);
    return `<a class="skill-source-chip mandate" href="#${e(M.anchorId(target.section))}" data-mandate-open="${e(target.section)}">${e(text)}</a>`;
  }

  function researchEffectForSkill(topic, profile) {
    const override = profile?.researchEffectOverrides?.[topic.name];
    if (override) return override;
    const effects = topic.effects || [];
    if (!effects.length) return topic.description || topic.summary || topic.sourceGaps?.[0] || 'Open research entry';
    const needles = [profile?.name, ...(profile?.aliases || [])].map(value => String(value || '').trim()).filter(Boolean);
    for (const needle of needles) {
      const rx = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      const tagged = effects.find(effect => rx.test(String(effect)));
      if (tagged) return tagged;
    }
    return topic.summary || effects[0];
  }

  function researchButton(topic, profile, compact = false) {
    const effect = researchEffectForSkill(topic, profile);
    return `<button class="skill-research-card ${compact ? 'compact' : ''}" data-research-v2="${e(topic.key)}">
      <span class="skill-research-head"><strong>${e(topic.name)}</strong><small>DL ${e(topic.dl)} · p. ${e(topic.page)}</small></span>
      <span class="skill-research-effect">${e(effect)}</span>
    </button>`;
  }

  function entityButton(name, label = name) {
    const entity = typeof entityByName === 'function' ? entityByName(name) : null;
    return entity ? `<button class="comp-text-link" data-entity="${e(entity.key || entity.name)}">${e(label)}</button>` : e(label);
  }

  function skillButton(name) {
    const skill = typeof skillByName === 'function' ? skillByName(name) : null;
    return skill ? `<button class="comp-link" data-skill="${e(skill.name)}">${e(skill.name)}</button>` : `<span class="comp-link inert">${e(name)}</span>`;
  }

  function researchTopicFor(item) {
    if (!item?.research) return null;
    return (D?.topics || []).find(topic => canon(`${topic.skill} / ${topic.name}`) === canon(item.research)) || null;
  }

  function sourceForImplement(item) {
    if (item.source === 'Mandate') return mandateLink(item.section, `Mandate § ${item.section}`);
    const match = researchTopicFor(item);
    if (match) return `<button class="skill-source-chip research" data-research-v2="${e(match.key)}">Research p. ${e(match.page)}</button>`;
    return '<span class="skill-source-chip research">Research List</span>';
  }

  function craftingSource(item) {
    const rows = (item.craft || []).map(row => {
      const note = row.note ? ` <small>${e(row.note)}</small>` : '';
      return `<span class="skill-craft-path">${skillButton(row.skill)} <strong>${e(row.level)}</strong>${note}</span>`;
    });
    if (!rows.length) rows.push('<span class="skill-craft-path muted">—</span>');
    if (item.requiresResearch) rows.push('<span class="skill-research-required">Research required</span>');
    return `<div class="skill-craft-list">${rows.join('')}</div>`;
  }

  function equipmentTable(items, tableId) {
    const sorted = S.sortByBaseMaxBenefit(items || []);
    return `<div class="skill-implement-table-wrap"><table class="skill-implement-table" data-equipment-table="${e(tableId)}" data-sort-dir="desc"><thead><tr><th>Implement</th><th>Made / converted with</th><th>Bonus / item</th><th>Base max / Hunter</th><th><button class="skill-sort-button" data-equipment-sort="${e(tableId)}" title="Toggle Base Max Benefit ordering">Base max benefit ↓</button></th><th>Source</th></tr></thead><tbody>
      ${sorted.map(item => `<tr data-benefit="${e(S.benefitAmount(item.baseMaxBenefit))}"><td>${entityButton(item.name)}</td><td>${craftingSource(item)}</td><td><strong>${e(item.value)}</strong></td><td>${e(item.baseMax)}</td><td>${e(item.baseMaxBenefit)}</td><td>${sourceForImplement(item)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function removeGenericMandatePanels(article) {
    if (!article?.classList.contains('skill-dossier-mode')) return;
    [...article.querySelectorAll('.comp-section')].forEach(section => {
      const heading = section.querySelector('h2')?.textContent?.trim();
      if (heading === 'Mandate coverage' || heading === 'Mandate-linked tools, goods & structures') section.remove();
    });
  }

  function bindDossierInteractions(article) {
    article?.querySelectorAll('[data-equipment-sort]').forEach(button => {
      button.addEventListener('click', () => {
        const table = article.querySelector(`[data-equipment-table="${button.dataset.equipmentSort}"]`);
        const tbody = table?.querySelector('tbody');
        if (!table || !tbody) return;
        const nextDir = table.dataset.sortDir === 'desc' ? 'asc' : 'desc';
        const rows = [...tbody.querySelectorAll('tr')];
        rows.sort((a,b) => {
          const av = Number(a.dataset.benefit || 0);
          const bv = Number(b.dataset.benefit || 0);
          if (av !== bv) return nextDir === 'desc' ? bv - av : av - bv;
          const an = a.cells?.[0]?.textContent || '';
          const bn = b.cells?.[0]?.textContent || '';
          return an.localeCompare(bn);
        });
        rows.forEach(row => tbody.appendChild(row));
        table.dataset.sortDir = nextDir;
        button.textContent = `Base max benefit ${nextDir === 'desc' ? '↓' : '↑'}`;
      });
    });
  }

  function finishDossier(article) {
    bindLinks(article);
    bindDossierInteractions(article);
    removeGenericMandatePanels(article);
    const defer = window.requestAnimationFrame || (callback => setTimeout(callback, 0));
    defer(() => removeGenericMandatePanels(article));
  }

  function topicResearchUses(profile) {
    if (!D?.topics?.length) return [];
    const aliases = [profile.name, ...(profile.aliases || []), ...(profile.researchAliases || [])].filter(Boolean);
    const aliasCanon = new Set(aliases.map(canon));
    const regexTokens = [...new Set(aliases.map(value => String(value).trim()).filter(Boolean))]
      .sort((a,b) => b.length - a.length)
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const levelRx = regexTokens.length ? new RegExp(`(?:^|\\b)(?:${regexTokens.join('|')})\\s*(\\d+)(?:\\b|$)`, 'i') : null;
    const rows = [];
    const seen = new Set();
    const add = (topic, level, kind, detail) => {
      const key = `${topic.key}|${level}|${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ topic, level, kind, detail });
    };

    for (const topic of D.topics) {
      if (canon(topic.skill) === canon(profile.name)) continue;
      for (const req of topic.recipe?.skills || []) {
        if (aliasCanon.has(canon(req.name))) add(topic, req.level || '—', 'Recipe skill', `${req.name} ${req.level}`);
      }
      for (const prereq of topic.prerequisites || []) {
        const text = prereq.label || prereq.name || prereq.skill || '';
        const match = levelRx?.exec(text);
        if (match) add(topic, Number(match[1]), 'Prerequisite', text);
      }
    }
    return rows.sort((a,b) => {
      const al = typeof a.level === 'number' ? a.level : 999;
      const bl = typeof b.level === 'number' ? b.level : 999;
      return al - bl || a.topic.name.localeCompare(b.topic.name);
    });
  }

  function researchBundle(profile) {
    const ownResearch = (D?.topicsForSkill?.(profile.name) || []).slice().sort((a,b) => a.page - b.page || a.name.localeCompare(b.name));
    const inbound = D?.affectingSkill?.(profile.name) || [];
    const ownNames = new Set(ownResearch.map(topic => canon(topic.name)));
    const crossUnique = inbound.filter(topic => !ownNames.has(canon(topic.name)));
    const shared = new Map();
    inbound.filter(topic => ownNames.has(canon(topic.name))).forEach(topic => {
      const key = canon(topic.name);
      const row = shared.get(key) || { name:topic.name, skills:new Set(), topics:[] };
      row.skills.add(topic.skill);
      row.topics.push(topic);
      shared.set(key, row);
    });
    const pages = ownResearch.map(topic => Number(topic.page || 0)).filter(Boolean);
    const range = pages.length ? `${Math.min(...pages)}–${Math.max(...pages)}` : '—';
    return { ownResearch, inbound, crossUnique, shared, range, dependencyUses:topicResearchUses(profile) };
  }

  function titleBlock(profile, skill, bundle) {
    return `<div class="skill-dossier-title">
      <div>
        <div class="comp-kicker">Group ${e(skill.skillGroup)} skill · ${e(skill.shortname || '')}</div>
        <h1>${e(skill.name)}</h1>
        <p>${e(profile.summary)}</p>
      </div>
      <div class="skill-dossier-sources">${mandateLink(profile.primarySection)}${bundle.ownResearch.length ? `<span class="skill-source-chip research">Research pp. ${e(bundle.range)}</span>` : ''}</div>
    </div>`;
  }

  function glanceGrid(profile, bundle, thirdLabel = 'Research', thirdValue = null, thirdDetail = null) {
    const researchValue = thirdValue || `${bundle.ownResearch.length} ${profile.name} topic${bundle.ownResearch.length === 1 ? '' : 's'}`;
    const researchDetail = thirdDetail || (bundle.crossUnique.length || bundle.shared.size ? `${bundle.crossUnique.length} additional + ${bundle.shared.size} shared cross-skill links` : 'Research List links are shown below');
    return `<section class="skill-glance-grid" aria-label="${e(profile.name)} at a glance">
      <div class="skill-glance"><span>Skill behaviour</span><strong>${e(profile.mechanicLabel)}</strong><small>${e(profile.levelDetail || 'Higher levels expand what the skill can do.')}</small></div>
      <div class="skill-glance"><span>Workers</span><strong>${e(profile.workerRule)}</strong><small>${e(profile.workerDetail || '')}</small></div>
      <div class="skill-glance"><span>${e(thirdLabel)}</span><strong>${e(researchValue)}</strong><small>${e(researchDetail)}</small></div>
    </section>`;
  }

  function researchSection(profile, bundle) {
    const { ownResearch, crossUnique, shared, dependencyUses } = bundle;
    if (!ownResearch.length && !crossUnique.length && !shared.size && !dependencyUses.length) return '';
    return `<section class="skill-dossier-section">
      <div class="skill-section-heading"><div><span>Research List</span><h2>${e(profile.name)} research</h2></div><span class="skill-section-note">Cards show the effect most relevant to this skill.</span></div>
      ${ownResearch.length ? `<div class="skill-research-grid">${ownResearch.map(topic => researchButton(topic, profile)).join('')}</div>` : '<p class="skill-table-note">No dedicated research topics are indexed for this skill.</p>'}
      ${shared.size ? `<div class="skill-cross-research"><h3>Shared / cross-skill research</h3><p>These topics are indexed under this skill and another skill.</p>${[...shared.values()].map(row => `<div class="skill-cross-row"><strong>${e(row.name)}</strong><span>${[...row.skills].map(skillButton).join('')}</span></div>`).join('')}</div>` : ''}
      ${crossUnique.length ? `<div class="skill-cross-research"><h3>Other research affecting ${e(profile.name)}</h3><div class="skill-research-grid compact-grid">${crossUnique.map(topic => researchButton(topic, profile, true)).join('')}</div></div>` : ''}
      ${dependencyUses.length ? `<div class="skill-cross-research"><h3>Research recipes / prerequisites using ${e(profile.name)}</h3><p>Picked up from explicit Research List recipe skills and prerequisites.</p><div class="skill-implement-table-wrap"><table class="skill-implement-table skill-research-use-table"><thead><tr><th>Level</th><th>Research topic</th><th>Use</th><th>Detail</th></tr></thead><tbody>${dependencyUses.map(row => `<tr><td><strong>${e(row.level)}</strong></td><td><button class="comp-text-link" data-research-v2="${e(row.topic.key)}">${e(row.topic.name)}</button><small class="skill-inline-source">${e(row.topic.skill)}</small></td><td>${e(row.kind)}</td><td>${e(row.detail)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    </section>`;
  }

  function footerSections(profile, bundle) {
    return `<section class="skill-dossier-section skill-related-section">
      <div class="skill-section-heading"><div><span>Connections</span><h2>Related skills</h2></div></div>
      <div class="comp-tags">${(profile.relatedSkills || []).map(skillButton).join('')}</div>
    </section>
    <section class="skill-dossier-section skill-sources-section">
      <div class="skill-section-heading"><div><span>References</span><h2>Sources</h2></div></div>
      <div class="skill-source-groups"><div><strong>Mandate</strong><div class="skill-source-row">${[profile.primarySection, ...(profile.additionalSections || [])].map(section => mandateLink(section)).join('')}</div></div>${bundle.ownResearch.length ? `<div><strong>Research List</strong><div class="skill-source-row"><span class="skill-source-chip research">${e(profile.name)} pp. ${e(bundle.range)}</span></div></div>` : ''}</div>
    </section>`;
  }

  function renderHunting(profile, skill) {
    const article = $('compArticle');
    const bundle = researchBundle(profile);
    article.classList.add('skill-dossier-mode');
    $('compBreadcrumbs').textContent = `Compendium › Skills › Group ${skill.skillGroup} › ${skill.name}`;
    article.innerHTML = `
      ${titleBlock(profile, skill, bundle)}
      ${glanceGrid(profile, bundle, 'Research')}

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Outputs</span><h2>Hunting output</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-output-table"><thead><tr><th>Output</th><th>Type</th><th>How it is produced</th><th>Source</th></tr></thead><tbody>
          ${(profile.outputs || []).map(row => `<tr><td>${entityButton(row.item, row.label)}</td><td>${e(row.type)}</td><td>${e(row.detail)}</td><td>${mandateLink(row.source, `Mandate § ${row.source}`)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Modifiers</span><h2>Other factors affecting Hunting</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-factor-table"><thead><tr><th>Factor</th><th>Effect</th><th>Known detail</th></tr></thead><tbody>
          ${(profile.factors || []).map(row => `<tr><td><strong>${e(row.factor)}</strong></td><td>${e(row.effect)}</td><td>${e(row.detail)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Equipment</span><h2>Implements & direct Hunting benefit</h2></div></div>
        <div class="skill-am-note"><strong>AM = Active Month.</strong> ${e(S.amDefinition.replace(/^AM means Active Month:\s*/i, ''))}</div>
        <div class="skill-callout"><strong>Primary implement:</strong> ${e(profile.implementRule)}</div>
        <h3 class="skill-equipment-subhead">Primary implement — choose one type</h3>
        ${equipmentTable(profile.implements || [], 'hunting-primary')}
        ${(profile.supportImplements || []).length ? `<h3 class="skill-equipment-subhead support">Additional support — may be used alongside a primary implement</h3>${equipmentTable(profile.supportImplements, 'hunting-support')}` : ''}
        <p class="skill-table-note">Tables are initially ordered by Base Max Benefit; click that heading to reverse the order. Trappers research raises the Trap/Snare and Improved Trap allowance to 10 and the Advanced Trap allowance to 2.</p>
      </section>

      ${researchSection(profile, bundle)}
      ${footerSections(profile, bundle)}`;
    finishDossier(article);
  }

  function levelUseTable(profile) {
    const rows = [...(profile.levelUses || [])].sort((a,b) => {
      if (a.level === 'Any') return -1;
      if (b.level === 'Any') return 1;
      return Number(a.level) - Number(b.level) || String(a.use).localeCompare(String(b.use));
    });
    return `<div class="skill-implement-table-wrap"><table class="skill-implement-table skill-level-use-table"><thead><tr><th>Level</th><th>Unlock / use</th><th>Type</th><th>What it does</th><th>Source</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${e(row.level)}</strong></td><td>${row.item ? entityButton(row.item, row.use) : e(row.use)}</td><td>${e(row.kind || '')}</td><td>${e(row.detail)}</td><td>${mandateLink(row.source, `Mandate § ${row.source}`)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderUnlockSkill(profile, skill) {
    const article = $('compArticle');
    const bundle = researchBundle(profile);
    article.classList.add('skill-dossier-mode');
    $('compBreadcrumbs').textContent = `Compendium › Skills › Group ${skill.skillGroup} › ${skill.name}`;
    article.innerHTML = `
      ${titleBlock(profile, skill, bundle)}
      ${glanceGrid(profile, bundle, 'Known uses', `${(profile.levelUses || []).length} mapped uses`, 'The table below includes direct recipes plus explicit prerequisites found elsewhere in the Mandate.')}
      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Progression</span><h2>What each level unlocks</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-callout"><strong>How to read this:</strong> Higher levels keep the earlier uses and add the new rows shown at that level. This table also pulls in explicit uses of the skill from other Mandate sections.</div>
        ${levelUseTable(profile)}
      </section>
      ${researchSection(profile, bundle)}
      ${footerSections(profile, bundle)}`;
    finishDossier(article);
  }

  function forestryModifierTable(profile) {
    return `<div class="skill-implement-table-wrap"><table class="skill-implement-table skill-modifier-table"><thead><tr><th>Tool / facility</th><th>Applies to</th><th>Effect</th><th>Made with</th><th>Source</th></tr></thead><tbody>${(profile.modifiers || []).map(item => `<tr><td>${entityButton(item.name)}</td><td>${e(item.appliesTo)}</td><td><strong>${e(item.value)}</strong><small class="skill-block-detail">${e(item.effect)}</small></td><td>${craftingSource(item)}</td><td>${sourceForImplement(item)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderForestry(profile, skill) {
    const article = $('compArticle');
    const bundle = researchBundle(profile);
    article.classList.add('skill-dossier-mode');
    $('compBreadcrumbs').textContent = `Compendium › Skills › Group ${skill.skillGroup} › ${skill.name}`;
    article.innerHTML = `
      ${titleBlock(profile, skill, bundle)}
      ${glanceGrid(profile, bundle, 'Base logging', '4 Logs / worker', 'Skill level raises the worker capacity; tools and research can raise per-worker output.')}
      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Capacity</span><h2>Forestry worker limit</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-capacity-banner"><strong>10 workers × Forestry level</strong><span>Unlimited at Forestry 10</span><small>The cap is shared across Forestry work. Forestry 5 therefore provides 50 total worker slots that can be split between logging, Bark stripping and Charcoal Making.</small></div>
      </section>
      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Outputs</span><h2>Forestry output</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-output-table"><thead><tr><th>Output</th><th>Base rate</th><th>Type</th><th>How it is produced</th><th>Source</th></tr></thead><tbody>${(profile.outputs || []).map(row => `<tr><td>${entityButton(row.item, row.label)}</td><td><strong>${e(row.rate)}</strong></td><td>${e(row.type)}</td><td>${e(row.detail)}</td><td>${mandateLink(row.source, `Mandate § ${row.source}`)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Rules</span><h2>Other Forestry factors</h2></div></div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table skill-factor-table"><thead><tr><th>Factor</th><th>Effect</th><th>Known detail</th></tr></thead><tbody>${(profile.factors || []).map(row => `<tr><td><strong>${e(row.factor)}</strong></td><td>${e(row.effect)}</td><td>${e(row.detail)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Productivity</span><h2>Tools, facilities & direct output modifiers</h2></div></div>
        ${forestryModifierTable(profile)}
      </section>
      ${researchSection(profile, bundle)}
      ${footerSections(profile, bundle)}`;
    finishDossier(article);
  }

  const previousShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const profile = S.profile(name);
    if (!profile) {
      const result = previousShowSkill(name, push);
      $('compArticle')?.classList.remove('skill-dossier-mode');
      return result;
    }
    previousShowSkill(name, push);
    const skill = skillByName(profile.name) || skillByName(name);
    if (!skill) return;
    if (profile.layout === 'hunting') renderHunting(profile, skill);
    else if (profile.layout === 'unlock') renderUnlockSkill(profile, skill);
    else if (profile.layout === 'forestry') renderForestry(profile, skill);
  };

  function injectItemBenefits(article, item, benefits) {
    if (!article || !benefits?.length || article.querySelector('.skill-item-benefit')) return;
    const title = article.querySelector('.comp-title-row');
    if (!title) return;
    const rows = benefits.map(benefit => {
      const source = benefit.source === 'Mandate'
        ? mandateLink(benefit.section, `Mandate § ${benefit.section}`)
        : sourceForImplement(benefit);
      return `<div class="skill-item-benefit-row">
        <div><span class="skill-benefit-keyword">${e(benefit.skill)}</span><strong>${e(benefit.value)}</strong><small>${e(benefit.detail)}</small></div>
        <div class="skill-item-benefit-actions"><button class="comp-link" data-skill="${e(benefit.skill)}">Open ${e(benefit.skill)}</button>${source}</div>
      </div>`;
    }).join('');
    title.insertAdjacentHTML('afterend', `<section class="skill-item-benefit"><div class="skill-item-benefit-title"><span>Skill benefits at a glance</span><strong>${e(item?.name || 'Item')}</strong></div><div class="skill-item-benefit-lines">${rows}</div></section>`);
    bindLinks(article);
  }

  const previousShowEntity = showEntity;
  showEntity = function(name, push = true) {
    const result = previousShowEntity(name, push);
    const article = $('compArticle');
    article?.classList.remove('skill-dossier-mode');
    const core = typeof entityByName === 'function' ? entityByName(name) : null;
    const benefits = S.itemBenefitsFor(core?.name || name);
    if (benefits.length) injectItemBenefits(article, core, benefits);
    return result;
  };

  const previousRenderView = renderView;
  renderView = function(view, { push = false } = {}) {
    if (view?.type === 'skill' && S.profile(view.key)) return showSkill(view.key, push);
    return previousRenderView(view, { push });
  };
})();

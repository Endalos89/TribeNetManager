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

  function researchButton(topic, compact = false) {
    const effect = topic.effects?.[0] || topic.description || topic.sourceGaps?.[0] || 'Open research entry';
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

  function sourceForImplement(item) {
    if (item.source === 'Mandate') return mandateLink(item.section, `Mandate § ${item.section}`);
    const match = (D?.topics || []).find(topic => canon(`${topic.skill} / ${topic.name}`) === canon(item.research));
    if (match) return `<button class="skill-source-chip research" data-research-v2="${e(match.key)}">Research p. ${e(match.page)}</button>`;
    return '<span class="skill-source-chip research">Research List</span>';
  }

  function extraMandateRefs(profile) {
    if (!M?.sections) return [];
    const core = new Set([profile.primarySection, ...(profile.additionalSections || [])]);
    const term = new RegExp(`(^|[^a-z])${profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    return M.sections.filter(section => !core.has(section.section) && term.test(M.plainText(section))).slice(0, 24);
  }

  function renderHunting(profile, skill) {
    const article = $('compArticle');
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
    const researchPages = ownResearch.map(topic => Number(topic.page || 0)).filter(Boolean);
    const researchRange = researchPages.length ? `${Math.min(...researchPages)}–${Math.max(...researchPages)}` : '—';
    const extraRefs = extraMandateRefs(profile);

    article.classList.add('skill-dossier-mode');
    $('compBreadcrumbs').textContent = `Compendium › Skills › Group ${skill.skillGroup} › ${skill.name}`;
    article.innerHTML = `
      <div class="skill-dossier-title">
        <div>
          <div class="comp-kicker">Group ${e(skill.skillGroup)} skill · ${e(skill.shortname || '')}</div>
          <h1>${e(skill.name)}</h1>
          <p>${e(profile.summary)}</p>
        </div>
        <div class="skill-dossier-sources">${mandateLink(profile.primarySection)}<span class="skill-source-chip research">Research pp. ${e(researchRange)}</span></div>
      </div>

      <section class="skill-glance-grid" aria-label="Hunting at a glance">
        <div class="skill-glance"><span>Skill behaviour</span><strong>${e(profile.mechanicLabel)}</strong><small>Higher level improves output.</small></div>
        <div class="skill-glance"><span>Workers</span><strong>${e(profile.workerRule)}</strong><small>No 10 × skill cap.</small></div>
        <div class="skill-glance"><span>Main output</span><strong>${e(profile.output)}</strong><small>Food / provisions for the Tribe.</small></div>
        <div class="skill-glance"><span>Research</span><strong>${ownResearch.length} topics</strong><small>${crossUnique.length || shared.size ? `${crossUnique.length} additional + ${shared.size} shared cross-skill links` : 'No cross-skill modifiers indexed'}</small></div>
      </section>

      <section class="skill-dossier-section skill-level-section">
        <div class="skill-section-heading"><div><span>Level mechanics</span><h2>What your Hunting level changes</h2></div>${mandateLink('23.5','Mandate § 23.5')}</div>
        <p class="skill-level-lead">${e(profile.levelRule)}</p>
        <div class="skill-level-grid">${profile.levelEffects.map(row => `<div class="skill-level-row"><strong>${e(row.level)}</strong><span>${e(row.effect)}</span></div>`).join('')}</div>
      </section>

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Operational rules</span><h2>Key Hunting rules</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-rule-grid">${profile.keyRules.map(rule => `<div class="skill-rule-card"><span>${e(rule.label)}</span><strong>${e(rule.value)}</strong><small>${e(rule.detail)}</small></div>`).join('')}</div>
      </section>

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Equipment</span><h2>Implements & direct Hunting benefit</h2></div><span class="skill-section-note">Benefit is shown here and again on the item page.</span></div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>Implement</th><th>Benefit</th><th>Rules / limits</th><th>Source</th></tr></thead><tbody>
          ${profile.implements.map(item => `<tr><td>${entityButton(item.name)}</td><td><strong>${e(item.value)}</strong></td><td>${e(item.detail)}</td><td>${sourceForImplement(item)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="skill-no-benefit"><strong>No Hunting-return benefit:</strong>${profile.noBenefit.map(item => `<span title="${e(item.note)}">${e(item.name)}</span>`).join('')}</div>
      </section>

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Research List</span><h2>Hunting research</h2></div><span class="skill-section-note">Open any card for the full research entry.</span></div>
        <div class="skill-research-grid">${ownResearch.map(topic => researchButton(topic)).join('')}</div>
        ${shared.size ? `<div class="skill-cross-research"><h3>Shared / cross-skill research</h3><p>These Hunting topics are also indexed under other skills in the Research List.</p>${[...shared.values()].map(row => `<div class="skill-cross-row"><strong>${e(row.name)}</strong><span>${[...row.skills].map(skillButton).join('')}</span></div>`).join('')}</div>` : ''}
        ${crossUnique.length ? `<div class="skill-cross-research"><h3>Other research affecting Hunting</h3><div class="skill-research-grid compact-grid">${crossUnique.map(topic => researchButton(topic,true)).join('')}</div></div>` : ''}
      </section>

      <section class="skill-dossier-section skill-related-section">
        <div class="skill-section-heading"><div><span>Connections</span><h2>Related skills</h2></div></div>
        <div class="comp-tags">${profile.relatedSkills.map(skillButton).join('')}</div>
      </section>

      <section class="skill-dossier-section skill-sources-section">
        <div class="skill-section-heading"><div><span>References</span><h2>Sources & other Mandate mentions</h2></div></div>
        <div class="skill-source-groups"><div><strong>Core rules</strong><div class="skill-source-row">${[profile.primarySection, ...(profile.additionalSections || [])].map(section => mandateLink(section)).join('')}</div></div>
        ${extraRefs.length ? `<div><strong>Other Mandate mentions</strong><div class="skill-source-row">${extraRefs.map(section => mandateLink(section.section, `§ ${section.section}`)).join('')}</div></div>` : ''}</div>
      </section>`;
    bindLinks(article);
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
    const skill = skillByName(name);
    if (!skill) return;
    if (canon(profile.name) === 'HUNTING') renderHunting(profile, skill);
  };

  function injectItemBenefit(article, item, benefit) {
    if (!article || !benefit || article.querySelector('.skill-item-benefit')) return;
    const title = article.querySelector('.comp-title-row');
    if (!title) return;
    const source = benefit.source === 'Mandate'
      ? mandateLink(benefit.section, `Mandate § ${benefit.section}`)
      : sourceForImplement(benefit);
    title.insertAdjacentHTML('afterend', `<section class="skill-item-benefit">
      <div><span>Skill benefit at a glance</span><strong>${e(benefit.skill)} · ${e(benefit.value)}</strong><small>${e(benefit.detail)}</small></div>
      <div class="skill-item-benefit-actions"><button class="comp-link" data-skill="${e(benefit.skill)}">Open ${e(benefit.skill)}</button>${source}</div>
    </section>`);
    bindLinks(article);
  }

  const previousShowEntity = showEntity;
  showEntity = function(name, push = true) {
    const result = previousShowEntity(name, push);
    const article = $('compArticle');
    article?.classList.remove('skill-dossier-mode');
    const core = typeof entityByName === 'function' ? entityByName(name) : null;
    const benefit = S.itemBenefit(core?.name || name);
    if (benefit) injectItemBenefit(article, core, benefit);
    return result;
  };

  const previousRenderView = renderView;
  renderView = function(view, { push = false } = {}) {
    if (view?.type === 'skill' && S.profile(view.key)) return showSkill(view.key, push);
    return previousRenderView(view, { push });
  };
})();

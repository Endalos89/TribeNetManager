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

  function researchEffectForSkill(topic, skillName) {
    const effects = topic.effects || [];
    if (!effects.length) return topic.description || topic.sourceGaps?.[0] || 'Open research entry';
    const needle = String(skillName || '').trim();
    if (needle) {
      const rx = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      const tagged = effects.find(effect => rx.test(String(effect)));
      if (tagged) return tagged;
    }
    return effects[0];
  }

  function researchButton(topic, skillName, compact = false) {
    const effect = researchEffectForSkill(topic, skillName);
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
        <div class="skill-glance"><span>Skill behaviour</span><strong>${e(profile.mechanicLabel)}</strong><small>Higher level improves Hunting returns.</small></div>
        <div class="skill-glance"><span>Workers</span><strong>${e(profile.workerRule)}</strong><small>Hunting is not limited to 10 workers per skill level.</small></div>
        <div class="skill-glance"><span>Research</span><strong>${ownResearch.length} Hunting topics</strong><small>${crossUnique.length || shared.size ? `${crossUnique.length} additional + ${shared.size} shared cross-skill links` : 'No cross-skill modifiers indexed'}</small></div>
      </section>

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
        <div class="skill-section-heading"><div><span>Equipment</span><h2>Implements & direct Hunting benefit</h2></div><span class="skill-section-note">AM = Activity Modifier.</span></div>
        <div class="skill-callout"><strong>How implement choice works:</strong> ${e(profile.implementRule)}</div>
        <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>Implement</th><th>Category</th><th>Bonus / item</th><th>Base max / Hunter</th><th>Base max benefit</th><th>Source</th></tr></thead><tbody>
          ${profile.implements.map(item => `<tr><td>${entityButton(item.name)}</td><td>${e(item.category)}</td><td><strong>${e(item.value)}</strong></td><td>${e(item.baseMax)}</td><td>${e(item.baseMaxBenefit)}</td><td>${sourceForImplement(item)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="skill-table-note">Different Hunters in the same group may use different implement types. For example, some Hunters can use Slings while other Hunters use Traps; an individual Hunter does not combine those two implement types. Trappers research raises the Trap/Snare and Improved Trap allowance to 10 and the Advanced Trap allowance to 2.</p>
      </section>

      ${(profile.orderRules || []).length ? `<section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Orders</span><h2>Operational restrictions</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-rule-grid">${profile.orderRules.map(rule => `<div class="skill-rule-card"><span>${e(rule.label)}</span><strong>${e(rule.value)}</strong><small>${e(rule.detail)}</small></div>`).join('')}</div>
      </section>` : ''}

      <section class="skill-dossier-section">
        <div class="skill-section-heading"><div><span>Research List</span><h2>Hunting research</h2></div><span class="skill-section-note">Each card shows the effect relevant to Hunting where the topic affects more than one skill.</span></div>
        <div class="skill-research-grid">${ownResearch.map(topic => researchButton(topic, profile.name)).join('')}</div>
        ${shared.size ? `<div class="skill-cross-research"><h3>Shared / cross-skill research</h3><p>These Hunting topics are also indexed under other skills in the Research List.</p>${[...shared.values()].map(row => `<div class="skill-cross-row"><strong>${e(row.name)}</strong><span>${[...row.skills].map(skillButton).join('')}</span></div>`).join('')}</div>` : ''}
        ${crossUnique.length ? `<div class="skill-cross-research"><h3>Other research affecting Hunting</h3><div class="skill-research-grid compact-grid">${crossUnique.map(topic => researchButton(topic, profile.name, true)).join('')}</div></div>` : ''}
      </section>

      <section class="skill-dossier-section skill-related-section">
        <div class="skill-section-heading"><div><span>Connections</span><h2>Related skills</h2></div></div>
        <div class="comp-tags">${profile.relatedSkills.map(skillButton).join('')}</div>
      </section>

      <section class="skill-dossier-section skill-sources-section">
        <div class="skill-section-heading"><div><span>References</span><h2>Sources</h2></div></div>
        <div class="skill-source-groups"><div><strong>Mandate</strong><div class="skill-source-row">${[profile.primarySection, ...(profile.additionalSections || [])].map(section => mandateLink(section)).join('')}</div></div><div><strong>Research List</strong><div class="skill-source-row"><span class="skill-source-chip research">Hunting pp. ${e(researchRange)}</span></div></div></div>
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

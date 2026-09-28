(() => {
  const X = window.TribeNetCompendiumExpansion;
  if (!X) return;

  const text = value => esc(String(value || '').trim()).replace(/\n/g,'<br>');
  const topicEffect = topic => String(topic?.effect || topic?.description || topic?.benefit || topic?.summary || '').trim();
  const topicSource = topic => `${X.research.source?.title || 'Research List'}${topic?.page ? ` · page ${topic.page}` : ''}`;

  function richResearchCard(topic, {showSkill=false, reason=''}={}) {
    const effect = reason || topicEffect(topic) || 'No effect text is stated in the Research List entry.';
    const meta = [topic.dl ? `DL ${topic.dl}` : null, topic.preReq ? `Pre-Req: ${topic.preReq}` : null].filter(Boolean).join(' · ');
    return `<button class="comp-research-card rich" data-research="${esc(topic.key)}">
      <span class="comp-research-name">${showSkill ? `${esc(topic.skill)} → ` : ''}${esc(topic.name)}</span>
      <span class="comp-research-dl">${esc(meta || 'DL —')}</span>
      <small>${text(effect)}</small>
    </button>`;
  }

  function explicitAffect(targetSkill, affected, topic) {
    const target = X.skillKey(targetSkill?.name || targetSkill);
    const reason = String(affected?.reason || topicEffect(topic));
    if (!reason) return false;
    if (target === 'RESEARCH' && /research topic/i.test(reason) && !/(research skill|research (?:level|chance|attempt|capacity|bonus))/i.test(reason)) return false;
    if (target === 'COMBAT' && /(combat boost|combat morale|naval combat|field combat)/i.test(reason) && !/(combat skill|effective combat|combat\s*[+\-]\s*\d|combat (?:level|output|chance))/i.test(reason)) return false;
    return true;
  }

  function externalResearchForSkill(skill) {
    const key = X.skillKey(skill.name || skill);
    const seen = new Set();
    const rows = [];
    for (const topic of X.research.topics || []) {
      if (X.skillKey(topic.skill) === key) continue;
      for (const affected of topic.affectedSkills || []) {
        if (X.skillKey(affected.skill) !== key || !explicitAffect(skill, affected, topic)) continue;
        const id = `${topic.key}:${key}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push({topic, reason:affected.reason || topicEffect(topic)});
      }
    }
    return rows.sort((a,b)=>`${a.topic.skill} ${a.topic.name}`.localeCompare(`${b.topic.skill} ${b.topic.name}`));
  }

  const priorShowSkill = showSkill;
  showSkill = function(name,push=true) {
    priorShowSkill(name,push);
    const skill = skillByName(name), article = $('compArticle');
    if (!skill || !article) return;

    const own = X.researchForSkill(skill);
    const ownSection = [...article.querySelectorAll('.comp-section')].find(section => section.querySelector('h2')?.textContent === 'Research topics');
    if (ownSection && own.length) {
      const grid = ownSection.querySelector('.comp-research-grid');
      if (grid) grid.innerHTML = own.map(topic=>richResearchCard(topic)).join('');
      const count = ownSection.querySelector('.comp-muted');
      if (count) count.textContent = `${own.length} topic${own.length===1?'':'s'} · full Research List details`;
    }

    const external = externalResearchForSkill(skill);
    if (external.length) {
      const refs = [...article.querySelectorAll('.comp-section')].find(section => section.querySelector('h2')?.textContent === 'Mandate references');
      const html = `<section class="comp-section compact-section comp-external-research">
        <div class="comp-inline-heading"><h2>Research in other skills that affects ${esc(skill.name)}</h2><span class="comp-muted">${external.length} linked effect${external.length===1?'':'s'}</span></div>
        <div class="comp-research-grid">${external.map(({topic,reason})=>richResearchCard(topic,{showSkill:true,reason})).join('')}</div>
      </section>`;
      if (refs) refs.insertAdjacentHTML('beforebegin',html); else article.insertAdjacentHTML('beforeend',html);
    }
    bindLinks(article);
  };

  function ruleRow(label,value,{html=false,wide=false}={}) {
    if (!value) return '';
    return `<div class="comp-rule-row ${wide?'wide':''}"><span>${esc(label)}</span><div>${html ? value : text(value)}</div></div>`;
  }

  function affectedSkillLinks(topic) {
    const rows = (topic.affectedSkills || []).filter(item=>explicitAffect(item.skill,item,topic));
    if (!rows.length) return '';
    return rows.map(item=>{
      const skill = X.skillFind(item.skill);
      return `<div class="comp-effect-link"><strong>${skill ? skillLink(skill.name,skill.name) : esc(item.skill)}</strong><span>${text(item.reason || topicEffect(topic))}</span></div>`;
    }).join('');
  }

  showResearch = function(key,push=true) {
    const topic = X.topic(key);
    if (!topic) return showHome(push);
    setView({type:'research',key:topic.key},{push});
    $('compBreadcrumbs').textContent=`Compendium › Research › ${topic.skill} › ${topic.name}`;
    const sourceSkill=X.skillFind(topic.skill), entity=entityByName(topic.name);
    const effect=topicEffect(topic);
    const effects=affectedSkillLinks(topic);
    $('compArticle').innerHTML=`
      <div class="comp-title-row"><div><div class="comp-kicker">Research · ${esc(topic.skill)}</div><h1>${esc(topic.name)}</h1><div class="comp-short">${topic.dl?`Difficulty Level ${esc(topic.dl)}`:'Difficulty Level not stated'}</div></div><span class="comp-badge">Research</span></div>
      <div class="comp-rule-card research-rule-card">
        ${ruleRow('Effect / what it does',effect,{wide:true})}
        ${ruleRow('Prerequisite',topic.preReq || 'n/a')}
        ${ruleRow('Recipe / cost',topic.recipe || 'n/a')}
        ${ruleRow('Leads to',topic.leadsTo || 'n/a')}
        ${ruleRow('Bonus',topic.bonus)}
        ${ruleRow('Requirements',topic.requirements)}
        ${ruleRow('Restrictions',topic.restrictions)}
        ${ruleRow('Notes',topic.notes,{wide:true})}
        ${topic.summary && canon(topic.summary)!==canon(effect) ? ruleRow('Research List summary',topic.summary,{wide:true}) : ''}
      </div>
      ${effects?`<section class="comp-section compact-section"><h2>Skills affected</h2><div class="comp-effect-list">${effects}</div></section>`:''}
      <div class="comp-tags">${sourceSkill?`<button class="comp-link" data-skill="${esc(sourceSkill.name)}">Source skill: ${esc(sourceSkill.name)}</button>`:''}${entity?`<button class="comp-link" data-entity="${esc(entity.key)}">Related item / structure: ${esc(entity.name)}</button>`:''}</div>
      <section class="comp-section compact-section"><h2>Source</h2><div class="comp-callout">${esc(topicSource(topic))}${X.research.source?.updated?` · updated ${esc(X.research.source.updated)}`:''}. ${esc(X.research.source?.note||'')}</div></section>`;
    bindLinks($('compArticle'));
  };

  function entityResearch(entity) {
    const exact=(entity.researchTopics||[]).filter(topic=>canon(topic.name)===canon(entity.name));
    return exact.length?exact:(entity.researchTopics||[]);
  }

  function producerRecipeHtml(entity) {
    const rows=entity.producers||[];
    if (!rows.length) return '';
    return rows.map(row=>`<div class="comp-compact-recipe"><strong>${skillLink(row.skill,row.skill)} ${fmtNum(row.skillLevel)}</strong><span>${fmtNum(row.people)||'—'} people · ${renderAlternatives(row)}</span></div>`).join('');
  }

  const priorShowEntity = showEntity;
  showEntity = function(name,push=true) {
    priorShowEntity(name,push);
    const entity=entityByName(name), article=$('compArticle');
    if (!entity || !article) return;
    const researchRows=entityResearch(entity);
    const researchTopic=researchRows[0] || null;
    const effect=researchTopic ? topicEffect(researchTopic) : ((entity.uses||[]).map(use=>use.text).filter(Boolean).join(' ') || entity.summary || '');
    const normalRecipes=producerRecipeHtml(entity);
    const researchRecipes=researchRows.filter(t=>t.recipe).map(t=>`<div class="comp-compact-recipe"><strong><button class="comp-text-link" data-research="${esc(t.key)}">${esc(t.name)}</button></strong><span>${text(t.recipe)}</span></div>`).join('');
    const requirements=researchRows.map(t=>t.requirements).filter(Boolean).join(' · ');
    const restrictions=researchRows.map(t=>t.restrictions).filter(Boolean).join(' · ');
    const notes=[...(entity.notes||[]),...researchRows.map(t=>t.notes).filter(Boolean)].join(' · ');
    const type=entity.kind==='facility'?'Building':entity.kind==='ship'?'Ship':'Item';
    const title=article.querySelector('.comp-title-row');
    if (title) title.insertAdjacentHTML('afterend',`<section class="comp-rule-card entity-rule-card">
      ${ruleRow('Type',type)}
      ${ruleRow('What it does',effect,{wide:true})}
      ${normalRecipes||researchRecipes ? ruleRow('Recipe / construction',[normalRecipes,researchRecipes].filter(Boolean).join(''),{html:true,wide:true}) : ruleRow('Recipe / construction','No fixed recipe is indexed in the current Mandate/Research data.',{wide:true})}
      ${ruleRow('Requirements',requirements || researchTopic?.preReq)}
      ${ruleRow('Restrictions',restrictions)}
      ${ruleRow('Notes',notes,{wide:true})}
      ${researchRows.length?ruleRow('Research',researchRows.map(t=>`<button class="comp-text-link" data-research="${esc(t.key)}">${esc(t.skill)} → ${esc(t.name)}</button>`).join(' · '),{html:true}):''}
    </section>`);
    bindLinks(article);
  };

  const priorSearch=runSearch;
  runSearch=function(query){
    priorSearch(query);
    if (compState.view.type!=='search') return;
    const q=canon(query); if(!q)return;
    const matches=(X.research.topics||[]).filter(t=>canon(`${t.name} ${t.skill} ${t.summary||''} ${t.description||''} ${t.effect||''} ${t.bonus||''} ${t.preReq||''} ${t.recipe||''} ${t.requirements||''} ${t.restrictions||''} ${t.notes||''}`).includes(q));
    const host=$('compArticle')?.querySelector('.comp-search-results');
    if(!host)return;
    host.querySelectorAll('[data-full-research-result]').forEach(node=>node.remove());
    host.insertAdjacentHTML('beforeend',matches.map(t=>`<div class="comp-result" data-full-research-result data-research="${esc(t.key)}"><strong>${esc(t.name)}</strong><span>Research · ${esc(t.skill)} · ${esc(topicEffect(t))}</span></div>`).join(''));
    bindLinks(host);
  };

  function refreshWhenReady(){
    const refresh=()=>{
      if(!compState.catalog)return setTimeout(refresh,25);
      const view=clone(compState.view);
      renderNav();
      renderView(view,{push:false});
    };
    Promise.resolve(window.TribeNetResearchFullReady || true).then(refresh);
  }
  refreshWhenReady();
})();

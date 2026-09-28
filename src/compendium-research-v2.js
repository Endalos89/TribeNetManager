(() => {
  const D = window.TribeNetResearchV2;
  if (!D) return;
  const q = id => document.getElementById(id);
  const c = value => D.canon(value);

  function detailedTopicForLegacy(key) {
    const X = window.TribeNetCompendiumExpansion;
    const legacy = X?.topic?.(key);
    if (!legacy) return null;
    return D.topics.find(t => c(t.skill) === c(legacy.skill) && c(t.name) === c(legacy.name)) || null;
  }

  function findDetailedByName(name, skill) {
    return D.topics.find(t => c(t.name) === c(name) && (!skill || c(t.skill) === c(skill))) || null;
  }

  function researchButton(topic, compact=false) {
    return `<button class="comp-research-v2-card ${compact?'compact':''}" data-research-v2="${esc(topic.key)}">
      <span><strong>${esc(topic.name)}</strong><small>${esc(topic.skill)} · DL ${esc(topic.dl)}</small></span>
      <em>${esc(topic.effects[0] || topic.description || topic.sourceGaps[0] || 'See full source entry')}</em>
    </button>`;
  }

  function linkRef(ref) {
    if (!ref) return '';
    if (ref.type === 'skill' && ref.skill) return `<button class="comp-text-link" data-skill="${esc(ref.skill)}">${esc(ref.label)}</button>`;
    if (ref.type === 'research') {
      const target = findDetailedByName(ref.topic || ref.label, ref.skill);
      return target ? `<button class="comp-text-link" data-research-v2="${esc(target.key)}">${esc(ref.label)}</button>` : esc(ref.label);
    }
    if (ref.type === 'building' && ref.entity) return `<button class="comp-text-link" data-entity="${esc(ref.entity)}">${esc(ref.label)}</button>`;
    return esc(ref.label || '—');
  }

  function entityButton(name) {
    return `<button class="comp-text-link" data-entity="${esc(name)}">${esc(name)}</button>`;
  }

  function renderRecipe(r) {
    if (!r) return '<div class="comp-muted">No recipe listed.</div>';
    const output = r.output ? `<div><span>Output</span><strong>${fmtNum(r.output.quantity)} × ${entityButton(r.output.item)}</strong></div>` : '';
    const labour = r.labour || (r.people != null ? `${fmtNum(r.people)} people` : 'Not specified');
    const skills = (r.skills||[]).length ? r.skills.map(s=>`<button class="comp-text-link" data-skill="${esc(s.name)}">${esc(s.name)} ${fmtNum(s.level)}</button>`).join(', ') : 'None listed';
    const inputs = (r.inputs||[]).length ? r.inputs.map(i=>`${fmtNum(i.quantity)} × ${entityButton(i.item)}${i.note?` <small>${esc(i.note)}</small>`:''}`).join(' · ') : 'None listed';
    const variants=(r.variants||[]).map(v=>`<div class="comp-recipe-variant">${renderRecipe(v)}</div>`).join('');
    return `<div class="comp-rule-recipe">${output}<div><span>Activity</span><strong>${esc(r.activity||'Not stated')}</strong></div><div><span>Labour</span><strong>${esc(labour)}</strong></div><div><span>Skills</span><strong>${skills}</strong></div><div class="wide"><span>Inputs</span><strong>${inputs}</strong></div>${r.raw?`<div class="wide source-raw"><span>Source wording</span><strong>${esc(r.raw)}</strong></div>`:''}</div>${variants?`<div class="comp-recipe-variants"><h4>Alternative recipe</h4>${variants}</div>`:''}`;
  }

  function bulletSection(title, rows, cls='') {
    if (!rows?.length) return '';
    return `<section class="comp-section compact-section ${cls}"><h2>${esc(title)}</h2><ul class="comp-rule-list">${rows.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
  }

  function refsSection(title, rows) {
    if (!rows?.length) return '';
    return `<section class="comp-section compact-section"><h2>${esc(title)}</h2><div class="comp-tags">${rows.map(linkRef).join('')}</div></section>`;
  }

  function showResearchV2(key,push=true) {
    const t = D.topicByKey(key);
    if (!t) return;
    setView({type:'research-v2',key:t.key},{push});
    q('compBreadcrumbs').textContent=`Compendium › Research › ${t.skill} › ${t.name}`;
    q('compArticle').innerHTML=`
      <div class="comp-title-row"><div><div class="comp-kicker">Research · ${esc(t.skill)}</div><h1>${esc(t.name)}</h1><div class="comp-short">Difficulty Level ${esc(t.dl)} · Research List page ${fmtNum(t.page)}</div></div><span class="comp-badge">Research</span></div>
      ${t.status!=='available'?`<div class="comp-callout warn"><strong>Status in source:</strong> ${esc(t.status)}</div>`:''}
      <section class="comp-section compact-section"><h2>Effect</h2>${t.effects.length?`<ul class="comp-rule-list primary">${t.effects.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<div class="comp-callout warn">${esc(t.sourceGaps[0]||'No effect text is provided by the source.')}</div>`}</section>
      ${refsSection('Prerequisites',t.prerequisites)}
      ${t.recipe?`<section class="comp-section compact-section"><h2>Recipe / production</h2>${renderRecipe(t.recipe)}</section>`:''}
      ${bulletSection('Requirements',t.requirements)}
      ${bulletSection('Restrictions',t.restrictions,'warn-section')}
      ${bulletSection('Notes',t.notes)}
      ${refsSection('Leads to',t.leadsTo)}
      ${t.affectsSkills.length?`<section class="comp-section compact-section"><h2>Skills affected</h2><div class="comp-tags">${t.affectsSkills.map(s=>`<button class="comp-link" data-skill="${esc(s)}">${esc(s)}</button>`).join('')}</div></section>`:''}
      ${t.relatedSkills.length?`<section class="comp-section compact-section"><h2>Related skills</h2><div class="comp-tags">${t.relatedSkills.map(s=>`<button class="comp-link" data-skill="${esc(s)}">${esc(s)}</button>`).join('')}</div></section>`:''}
      ${t.creates.length?`<section class="comp-section compact-section"><h2>Creates / unlocks</h2><div class="comp-tags">${t.creates.map(e=>e.kind==='skill'?`<button class="comp-link" data-skill="${esc(e.name)}">${esc(e.name)} · skill</button>`:`<button class="comp-link" data-entity="${esc(e.name)}">${esc(e.name)} · ${esc(e.kind)}</button>`).join('')}</div></section>`:''}
      ${bulletSection('Source gaps',t.sourceGaps,'source-gap')}
      ${bulletSection('Source wording / inconsistencies',t.sourceIssues,'source-issue')}
      <section class="comp-section compact-section"><h2>Source</h2><div class="comp-callout">${esc(t.source.title)} · updated ${esc(t.source.updated)} · page ${fmtNum(t.page)}. This article records the operational rules from the research entry rather than relying on its one-line Summary field.</div></section>`;
    bindLinks(q('compArticle'));
  }
  window.showResearchV2 = showResearchV2;

  const oldBind = bindLinks;
  bindLinks = function(root=document) {
    oldBind(root);
    root.querySelectorAll('[data-research-v2]').forEach(el=>el.onclick=()=>showResearchV2(el.dataset.researchV2));
  };

  const oldShowResearch = window.showResearch;
  if (oldShowResearch) window.showResearch = function(key,push=true) {
    const detailed = D.topicByKey(key) || detailedTopicForLegacy(key);
    if (detailed) return showResearchV2(detailed.key,push);
    return oldShowResearch(key,push);
  };

  const oldShowSkill = showSkill;
  showSkill = function(name,push=true) {
    oldShowSkill(name,push);
    const s = skillByName(name), article=q('compArticle');
    if (!s || !article) return;
    const own = D.topicsForSkill(s.name);
    if (own.length) {
      const oldResearch=[...article.querySelectorAll('.comp-section')].find(sec=>sec.querySelector('h2')?.textContent.trim()==='Research topics');
      const html=`<section class="comp-section compact-section detailed-research"><div class="comp-inline-heading"><h2>Research topics</h2><span class="comp-muted">${own.length} fully indexed</span></div><div class="comp-research-v2-grid">${own.map(t=>researchButton(t)).join('')}</div></section>`;
      if (oldResearch) oldResearch.outerHTML=html; else article.insertAdjacentHTML('beforeend',html);
    }
    const inbound=D.affectingSkill(s.name);
    if (inbound.length) {
      const refs=[...article.querySelectorAll('.comp-section')].find(sec=>sec.querySelector('h2')?.textContent.trim()==='Mandate references');
      const html=`<section class="comp-section compact-section cross-skill-research"><div class="comp-inline-heading"><h2>Research from other skills affecting ${esc(s.name)}</h2><span class="comp-muted">${inbound.length}</span></div><div class="comp-research-v2-grid">${inbound.map(t=>researchButton(t,true)).join('')}</div></section>`;
      if (refs) refs.insertAdjacentHTML('beforebegin',html); else article.insertAdjacentHTML('beforeend',html);
    }
    bindLinks(article);
  };

  function entityResearchPanel(e) {
    const topicRows=e.topics.map(D.topicByKey).filter(Boolean);
    const recipeRows=e.recipes||[];
    return `<section class="comp-standard-entity">
      <div class="comp-standard-head"><strong>${e.kind==='facility'?'Building specification':e.kind==='ship'?'Ship specification':'Item specification'}</strong><span>${e.researchOnly?'Research unlocked':'General construction/use'}</span></div>
      ${e.effects.length?`<div class="comp-standard-block"><h3>What it does</h3><ul class="comp-rule-list primary">${e.effects.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      ${recipeRows.length?`<div class="comp-standard-block"><h3>Recipe${recipeRows.length>1?'s':''}</h3>${recipeRows.map(renderRecipe).join('')}</div>`:''}
      ${e.requirements.length?`<div class="comp-standard-block"><h3>Requirements</h3><ul class="comp-rule-list">${e.requirements.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      ${e.restrictions.length?`<div class="comp-standard-block"><h3>Restrictions</h3><ul class="comp-rule-list">${e.restrictions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      ${e.notes.length?`<div class="comp-standard-block"><h3>Notes</h3><ul class="comp-rule-list">${e.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      <div class="comp-standard-block"><h3>Research source</h3><div class="comp-tags">${topicRows.map(t=>`<button class="comp-link" data-research-v2="${esc(t.key)}">${esc(t.skill)} · ${esc(t.name)}</button>`).join('')}</div></div>
    </section>`;
  }

  const oldShowEntity=showEntity;
  showEntity=function(name,push=true) {
    oldShowEntity(name,push);
    const article=q('compArticle'), core=entityByName(name);
    if(!article||!core)return;
    const detailed=D.entity(core.name);
    if(!detailed)return;
    const title=article.querySelector('.comp-title-row');
    const price=article.querySelector('.comp-price-summary');
    const anchor=price||title;
    if(anchor)anchor.insertAdjacentHTML('afterend',entityResearchPanel(detailed));
    const sparse=[...article.querySelectorAll('.comp-section')].find(sec=>sec.querySelector('h2')?.textContent.trim()==='Research');
    if(sparse){const topics=detailed.topics.map(D.topicByKey).filter(Boolean);sparse.innerHTML=`<div class="comp-inline-heading"><h2>Research</h2><span class="comp-muted">${topics.length} detailed topic${topics.length===1?'':'s'}</span></div><div class="comp-research-v2-grid">${topics.map(t=>researchButton(t,true)).join('')}</div>`;}
    bindLinks(article);
  };

  const oldRunSearch=runSearch;
  runSearch=function(query) {
    oldRunSearch(query);
    const term=c(query), article=q('compArticle');
    if(!term||!article||compState.view.type!=='search')return;
    const host=article.querySelector('.comp-search-results'); if(!host)return;
    const rows=D.topics.filter(t=>c(`${t.skill} ${t.name} ${t.effects.join(' ')} ${t.requirements.join(' ')} ${t.restrictions.join(' ')} ${t.relatedSkills.join(' ')}`).includes(term));
    if(rows.length)host.insertAdjacentHTML('beforeend',rows.map(t=>`<div class="comp-result" data-research-v2="${esc(t.key)}"><strong>${esc(t.name)}</strong><span>Detailed research · ${esc(t.skill)} · DL ${esc(t.dl)}</span></div>`).join(''));
    bindLinks(host);
  };

  const oldRenderView=renderView;
  renderView=function(view,{push=false}={}) {
    if(view?.type==='research-v2')return showResearchV2(view.key,push);
    return oldRenderView(view,{push});
  };
})();

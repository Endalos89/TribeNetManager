(() => {
  const X=window.TribeNetCompendiumExpansion; if(!X)return;
  const baseBind=bindLinks;
  bindLinks=function(root=document){baseBind(root);root.querySelectorAll('[data-category]').forEach(x=>x.onclick=()=>showCategory(x.dataset.category));root.querySelectorAll('[data-research]').forEach(x=>x.onclick=()=>showResearch(x.dataset.research));};
  const researchCard=t=>`<button class="comp-research-card" data-research="${esc(t.key)}"><span class="comp-research-name">${esc(t.name)}</span><span class="comp-research-dl">${t.dl?`DL ${esc(t.dl)}`:'DL —'}</span><small>${esc(t.benefit||'See research entry')}</small></button>`;
  window.TribeNetCompendiumResearchCard=researchCard;

  renderNav=function(){
    const host=$('compNav'); if(!host)return;
    const cats=[['skills','Skills'],['items','Items'],['buildings','Buildings'],['ships','Ships']].map(([k,l])=>`<button class="comp-nav-link ${compState.view.type==='category'&&compState.view.key===k?'active':''}" data-category="${k}">${l}</button>`).join('');
    const groups=['A','B','C'].map(g=>`<button class="comp-nav-link compact ${compState.view.type==='group'&&compState.view.key===g?'active':''}" data-group="${g}">Group ${g} <small>${skills().filter(s=>s.skillGroup===g).length}</small></button>`).join('');
    const combat=topics().map(t=>`<button class="comp-nav-link compact ${compState.view.type==='topic'&&compState.view.key===t.key?'active':''}" data-topic="${esc(t.key)}">${esc(t.title)}</button>`).join('');
    host.innerHTML=`<section class="comp-nav-section"><div class="comp-nav-title">Compendium</div><button class="comp-nav-link ${compState.view.type==='home'?'active':''}" data-view="home">Overview</button>${cats}</section><section class="comp-nav-section"><div class="comp-nav-title">Skill groups</div>${groups}</section><section class="comp-nav-section"><div class="comp-nav-title">Combat</div>${combat}</section>`;bindLinks(host);
  };

  showHome=function(push=true){
    setView({type:'home',key:null},{push});$('compBreadcrumbs').textContent='Compendium';
    const cards=[['skills','Skills',`${skills().length} skills across Groups A, B and C`],['items','Items',`${X.rows('items').length} goods, materials and implements`],['buildings','Buildings',`${X.rows('buildings').length} structures and facilities`],['ships','Ships',`${X.rows('ships').length} vessels`]];
    $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Mandate reference</div><h1>Compendium</h1><div class="comp-short">Linked rules, research and production reference</div></div></div><div class="comp-category-grid">${cards.map(([k,l,d])=>`<button class="comp-category-card" data-category="${k}"><strong>${l}</strong><span>${d}</span></button>`).join('')}</div><section class="comp-section compact-section"><h2>Combat</h2><div class="comp-topic-list">${topics().map(t=>`<button class="comp-topic-button" data-topic="${esc(t.key)}"><strong>${esc(t.title)}</strong><span>${esc(t.summary)}</span></button>`).join('')}</div></section>`;bindLinks($('compArticle'));
  };

  function entityCard(e){const fair=X.market?.lookup(e.name);const parts=[e.kind==='ship'?'Ship':e.kind==='facility'?'Building':e.validGoods?.table||e.kind||'Item'];if(X.researchOnly(e))parts.push('Research');if(fair?.marketBuyQuantity!=null)parts.push(`${fmtNum(fair.marketBuyQuantity)} demand`);return `<button class="comp-entity-card" data-entity="${esc(e.key)}"><strong>${esc(e.name)}</strong><span>${esc(parts.join(' · '))}</span></button>`;}

  function skillUnlockInfo(s){
    const D=window.TribeNetResearchV2;
    const detailed=D?.topics?.find(t=>(t.creates||[]).some(created=>created.kind==='skill'&&canon(created.name)===canon(s.name)));
    if(detailed)return{kind:'research',label:`${detailed.skill} → ${detailed.name}`,topic:detailed};
    if(s.researchUnlocked)return{kind:'research',label:s.unlockResearch||'Research required'};
    if(s.validSkillsOnly)return{kind:'indexed',label:'Valid Skills index only'};
    return{kind:'standard',label:'Standard'};
  }

  function skillTableRow(s){
    const availability=skillUnlockInfo(s);
    const availabilityText=availability.kind==='research'
      ? availability.topic?`<button class="comp-text-link" data-research-v2="${esc(availability.topic.key)}">Research-locked · ${esc(availability.label)}</button>`:`<span class="comp-skill-status research">Research-locked · ${esc(availability.label)}</span>`
      : availability.kind==='indexed'?`<span class="comp-skill-status indexed">${esc(availability.label)}</span>`:`<span class="comp-skill-status standard">Standard</span>`;
    return `<tr><td><button class="comp-text-link skill-name" data-skill="${esc(s.name)}">${esc(s.name)}</button></td><td>${esc(s.shortname||'—')}</td><td><button class="comp-group-pill" data-group="${esc(s.skillGroup||'?')}">Group ${esc(s.skillGroup||'?')}</button></td><td>${availabilityText}</td></tr>`;
  }

  window.showCategory=function(key,push=true){
    if(key==='skills'){
      setView({type:'category',key},{push});$('compBreadcrumbs').textContent='Compendium › Skills';
      const rows=skills().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      const groupSummary=['A','B','C'].map(g=>`<button class="comp-skill-group-summary" data-group="${g}"><strong>Group ${g}</strong><span>${rows.filter(s=>s.skillGroup===g).length} skills</span></button>`).join('');
      $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Skills</div><h1>Skills</h1><div class="comp-short">${rows.length} indexed skills · alphabetical across all groups</div></div></div><div class="comp-skill-group-summary-row">${groupSummary}</div><div class="comp-callout">All skills are listed alphabetically. The Group column keeps the A/B/C classification visible. <strong>Research-locked</strong> marks skills that must first be unlocked by research; <strong>Valid Skills index only</strong> marks entries present in the Orders workbook where normal availability is not established by the current Mandate/research data.</div><div class="comp-skill-table-wrap"><table class="comp-skill-table"><thead><tr><th>Skill</th><th>Short</th><th>Group</th><th>Availability</th></tr></thead><tbody>${rows.map(skillTableRow).join('')}</tbody></table></div>`;
      bindLinks($('compArticle'));return;
    }
    const title=key==='buildings'?'Buildings':key==='ships'?'Ships':'Items';let rows=X.rows(key);const hide=Boolean(compState.hideResearchItems);if(key==='items'&&hide)rows=rows.filter(e=>!X.researchOnly(e));
    setView({type:'category',key},{push});$('compBreadcrumbs').textContent=`Compendium › ${title}`;
    $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">${title}</div><h1>${title}</h1><div class="comp-short">${rows.length} entries</div></div>${key==='items'?`<label class="comp-toggle"><input id="hideResearchOnly" type="checkbox" ${hide?'checked':''}> Hide research-only items</label>`:''}</div><div class="comp-entity-grid">${rows.map(entityCard).join('')}</div>`;bindLinks($('compArticle'));const toggle=$('hideResearchOnly');if(toggle)toggle.onchange=()=>{compState.hideResearchItems=toggle.checked;showCategory('items',false);};
  };

  window.showResearch=function(key,push=true){const t=X.topic(key);if(!t)return showHome(push);setView({type:'research',key:t.key},{push});$('compBreadcrumbs').textContent=`Compendium › Research › ${t.skill} › ${t.name}`;const s=X.skillFind(t.skill),e=entityByName(t.name);$('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Research · ${esc(t.skill)}</div><h1>${esc(t.name)}</h1><div class="comp-short">${t.dl?`Difficulty level ${esc(t.dl)}`:'Difficulty level not listed'}</div></div><span class="comp-badge">Research</span></div><div class="comp-research-detail"><div><span>Benefit</span><strong>${esc(t.benefit||'Not summarised')}</strong></div><div><span>Prerequisite</span><strong>${esc(t.preReq||'n/a')}</strong></div><div><span>Recipe / cost</span><strong>${esc(t.recipe||'n/a')}</strong></div><div><span>Leads to</span><strong>${esc(t.leadsTo||'n/a')}</strong></div></div><div class="comp-tags">${s?`<button class="comp-link" data-skill="${esc(s.name)}">Skill: ${esc(s.name)}</button>`:''}${e?`<button class="comp-link" data-entity="${esc(e.key)}">Item / structure: ${esc(e.name)}</button>`:''}</div><section class="comp-section compact-section"><h2>Source</h2><div class="comp-callout">${esc(X.research.source?.title||'Research List')} · page ${fmtNum(t.page)}${X.research.source?.updated?` · updated ${esc(X.research.source.updated)}`:''}. ${esc(X.research.source?.note||'')}</div></section>`;bindLinks($('compArticle'));};

  const baseRender=renderView;renderView=function(view,{push=false}={}){if(view?.type==='category')return showCategory(view.key,push);if(view?.type==='research')return showResearch(view.key,push);return baseRender(view,{push});};
})();

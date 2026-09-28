(async () => {
  const M = window.TRIBENET_MANDATE;
  if (!M) return;
  const SOURCE = M.sourceDocument;
  const PLAN = [
    {id:'1',title:'Core game & rules framework',range:'§§1–12',pages:'12–53',complete:true},
    {id:'2',title:'Activities & villages',range:'§§13–14',pages:'54–89',complete:true},
    {id:'3',title:'Trade, scouting & combat',range:'§§15–19',pages:'90–133',complete:true},
    {id:'4',title:'Naval & advanced systems',range:'§§20–27',pages:'134–165',complete:false},
    {id:'5',title:'Remaining references & final audit',range:'§§28–35 + Appendix A',pages:'165–191',complete:false}
  ];
  const done = PLAN.filter(x => x.complete).length;

  const originalEnsureMandateSkills = ensureMandateSkills;
  ensureMandateSkills = catalog => {
    const result = originalEnsureMandateSkills(catalog);
    result.sourceDocument = SOURCE;
    return result;
  };
  await M.whenReady();

  const SKILL_ALIASES = {'DANCE':['dance','dancing'],'ARCHAEOLOGY':['archaeology','archeology'],'MAINTAIN BOATS':['maintain boats','boat maintenance']};
  const e = value => esc(value);
  const cleanSection = value => String(value || '').replace(/^§\s*/, '').replace(/\.$/, '');
  const rx = phrase => new RegExp(`(^|[^a-z0-9])${String(phrase).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')}([^a-z0-9]|$)`,'i');
  const sectionText = section => M.plainText(section);

  function sectionButton(id,label='Reference') {
    const s=M.getSection(id); if(!s) return '';
    return `<button class="mandate-ref-button" data-mandate-ref="${e(s.section)}">${e(label)}</button>`;
  }
  function articleButton(id,label=null) {
    const s=M.getSection(id); if(!s) return '';
    return `<button class="mandate-article-link" data-mandate-section="${e(s.section)}">${e(label || `§ ${s.section} · ${s.title}`)}</button>`;
  }
  function exactBlocks(s) {
    const out=(s.body||[]).map(b=>{
      if(b.type==='table') return `<div class="mandate-table-wrap"><table class="mandate-table"><tbody>${(b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      const style=String(b.style||'');
      const cls=style.includes('Bullet')?' mandate-bullet':style.includes('Number')?' mandate-numbered':'';
      return `<p class="mandate-exact-line${cls}">${e(b.text)}</p>`;
    }).join('');
    return out || '<p class="comp-muted">This heading contains no direct text before its first subsection.</p>';
  }
  function ensureModal() {
    if(document.getElementById('mandateReferenceModal')) return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="mandateReferenceModal" class="mandate-modal" aria-hidden="true">
        <div class="mandate-modal-backdrop" data-mandate-close></div>
        <section class="mandate-modal-card" role="dialog" aria-modal="true">
          <header class="mandate-modal-header"><div><div class="comp-kicker">Word-for-word Mandate reference</div><h2 id="mandateModalTitle"></h2><div id="mandateModalMeta" class="mandate-modal-meta"></div></div><button class="mandate-modal-close" data-mandate-close>×</button></header>
          <div id="mandateModalBody" class="mandate-modal-body"></div>
          <footer class="mandate-modal-footer"><button id="mandateModalOpenArticle" class="button">Open Compendium article</button><button class="button" data-mandate-close>Close</button></footer>
        </section>
      </div>`);
    document.querySelectorAll('[data-mandate-close]').forEach(n=>n.addEventListener('click',closeReference));
  }
  function openReference(id) {
    const s=M.getSection(id); if(!s) return;
    ensureModal();
    $('mandateModalTitle').textContent=`§ ${s.section} — ${s.title}`;
    $('mandateModalMeta').textContent=`${SOURCE} · printed page ${s.page || '—'}`;
    $('mandateModalBody').innerHTML=exactBlocks(s);
    $('mandateModalOpenArticle').onclick=()=>{closeReference();showMandateSection(s.section);};
    $('mandateReferenceModal').classList.add('open');
    $('mandateReferenceModal').setAttribute('aria-hidden','false');
  }
  function closeReference() {
    const m=$('mandateReferenceModal'); if(!m) return;
    m.classList.remove('open'); m.setAttribute('aria-hidden','true');
  }
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape') closeReference();});

  function bindMandate(root=document) {
    root.querySelectorAll('[data-mandate-ref]').forEach(n=>n.onclick=ev=>{ev.preventDefault();ev.stopPropagation();openReference(n.dataset.mandateRef);});
    root.querySelectorAll('[data-mandate-section]').forEach(n=>n.onclick=()=>showMandateSection(n.dataset.mandateSection));
    root.querySelectorAll('[data-mandate-batch]').forEach(n=>n.onclick=()=>showMandateBatch(n.dataset.mandateBatch));
    root.querySelectorAll('[data-view="mandate-home"]').forEach(n=>n.onclick=()=>showMandateHome());
  }

  function skillTerms(skill) {
    const key=canon(skill.name), set=new Set([String(skill.name||'').toLowerCase(),...(SKILL_ALIASES[key]||[])]);
    return [...set].filter(Boolean);
  }
  function mentions(section,terms) { const text=sectionText(section); return terms.some(term=>rx(term).test(text)); }
  function skillRefs(skill) {
    const core=new Set((skill.sections||[]).map(cleanSection).filter(x=>M.getSection(x))), other=[];
    const terms=skillTerms(skill);
    M.sections.forEach(s=>{
      if(terms.some(term=>rx(term).test(String(s.title||'')))) core.add(s.section);
      else if(mentions(s,terms)) other.push(s.section);
    });
    return {core:[...core],other:other.filter(x=>!core.has(x))};
  }
  function entityRefs(entity) {
    const core=new Set((entity.sections||[]).map(cleanSection).filter(x=>M.getSection(x))), other=[];
    const name=String(entity.name||'').toLowerCase(); if(name.length<3) return {core:[...core],other};
    M.sections.forEach(s=>{if(rx(name).test(sectionText(s))) other.push(s.section);});
    return {core:[...core],other:other.filter(x=>!core.has(x))};
  }
  function skillRelatedEntities(skill,refs) {
    const ids=[...new Set([...(refs.core||[]),...(refs.other||[])])].filter(id=>M.getSection(id));
    if(!ids.length) return [];
    const text=ids.map(id=>sectionText(M.getSection(id))).join('\n');
    const skillName=canon(skill.name);
    return entities().filter(entity=>{
      const name=String(entity.name||'').trim();
      if(name.length<4 || canon(name)===skillName) return false;
      return rx(name.toLowerCase()).test(text);
    }).slice(0,30);
  }
  const refList=(ids,max=30)=>[...new Set(ids)].filter(x=>M.getSection(x)).slice(0,max).map(id=>sectionButton(id,`§ ${id}`)).join('');

  function appendCoverage(article,title,refs) {
    if(!article || (!refs.core.length && !refs.other.length)) return;
    article.insertAdjacentHTML('beforeend',`<section class="comp-section mandate-cross-links"><h2>${e(title)}</h2>
      ${refs.core.length?`<div class="mandate-ref-group"><strong>Core rules</strong><div class="comp-tags">${refList(refs.core)}</div></div>`:''}
      ${refs.other.length?`<div class="mandate-ref-group"><strong>Other uses & mentions</strong><div class="comp-tags">${refList(refs.other)}</div></div>`:''}
      <p class="comp-muted">Only completed Mandate batches are included. More references will appear as later batches are migrated.</p></section>`);
    bindMandate(article);
  }
  function appendSkillEntities(article,skill,refs) {
    const related=skillRelatedEntities(skill,refs);
    if(!article || !related.length) return;
    article.insertAdjacentHTML('beforeend',`<section class="comp-section mandate-skill-entities"><h2>Mandate-linked tools, goods & structures</h2><p class="comp-muted">Items below are mentioned in completed Mandate rules connected to this skill.</p><div class="comp-tags">${related.map(x=>`<button class="comp-link" data-entity="${e(x.key)}">${e(x.name)}</button>`).join('')}</div></section>`);
    bindLinks(article);
  }
  const oldShowSkill=showSkill;
  showSkill=function(name,push=true){const r=oldShowSkill(name,push),s=skillByName(name);if(s){const refs=skillRefs(s);appendCoverage($('compArticle'),'Mandate coverage',refs);appendSkillEntities($('compArticle'),s,refs);}return r;};
  const oldShowEntity=showEntity;
  showEntity=function(name,push=true){const r=oldShowEntity(name,push),x=entityByName(name);if(x)appendCoverage($('compArticle'),'Mandate coverage',entityRefs(x));return r;};
  const oldShowTopic=showTopic;
  showTopic=function(key,push=true){const r=oldShowTopic(key,push),t=topicByKey(key);if(t){const ids=(t.sections||[t.section]).map(cleanSection);appendCoverage($('compArticle'),'Mandate coverage',{core:ids.filter(x=>M.getSection(x)),other:[]});}return r;};

  function showMandateHome(push=true) {
    setView({type:'mandate-home',key:null},{push});
    $('compBreadcrumbs').textContent='Compendium › Mandate migration';
    const pct=Math.round(done/PLAN.length*100);
    $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Canonical rulebook migration</div><h1>The Mandate</h1><div class="comp-short">${e(SOURCE)} · ${M.sections.length} sections currently indexed</div></div><span class="comp-badge">${done}/5</span></div>
      <p class="comp-lead">The Mandate is being moved into the Compendium in five auditable batches. Completed batches contain browsable rule articles, exact word-for-word reference pop-ups, search results and cross-links into relevant Compendium entries.</p>
      <div class="mandate-progress-panel"><div class="mandate-progress-heading"><strong>Migration progress</strong><span>${done} of ${PLAN.length} batches complete · ${pct}%</span></div><div class="mandate-progress-track"><span style="width:${pct}%"></span></div></div>
      <div class="mandate-batch-grid">${PLAN.map(b=>{const loaded=M.batches.find(x=>x.id===b.id);return `<button class="mandate-batch-card ${b.complete?'complete':'pending'}" data-mandate-batch="${b.id}"><span class="mandate-batch-status">${b.complete?'✓ Complete':'Pending'}</span><strong>Batch ${b.id} · ${e(b.title)}</strong><span>${e(b.range)} · pages ${e(b.pages)}${loaded?` · ${loaded.sectionCount} indexed sections`:''}</span></button>`;}).join('')}</div>
      <section class="comp-section"><h2>Completed Mandate outline</h2><p class="comp-muted">Only sections from completed batches appear below. Later sections remain hidden until their batch has been migrated and reviewed.</p><div class="mandate-outline">${M.topLevel().map(s=>`<div class="mandate-outline-row">${articleButton(s.section)}<span>${M.sections.filter(x=>x.topSection===s.section&&x.section!==s.section).length} subsections · p. ${s.page||'—'}</span>${sectionButton(s.section,'Exact reference')}</div>`).join('')}</div></section>`;
    bindMandate($('compArticle'));
  }
  function showMandateBatch(id,push=true) {
    const p=PLAN.find(x=>x.id===String(id)); if(!p) return showMandateHome(push);
    setView({type:'mandate-batch',key:p.id},{push}); $('compBreadcrumbs').textContent=`Compendium › Mandate › Batch ${p.id}`;
    const loaded=M.batches.find(x=>x.id===p.id);
    if(!p.complete||!loaded){$('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Mandate batch ${p.id}</div><h1>${e(p.title)}</h1><div class="comp-short">${e(p.range)} · pages ${e(p.pages)}</div></div><span class="comp-badge pending">Pending</span></div><div class="comp-callout">This batch has not been migrated yet. It remains visible so progress can be reviewed after each batch.</div>`;return;}
    const tops=M.topLevel().filter(s=>loaded.topSections.includes(s.section));
    $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Mandate batch ${p.id} · Complete</div><h1>${e(p.title)}</h1><div class="comp-short">${loaded.sectionCount} indexed sections · ${e(p.range)} · pages ${e(p.pages)}</div></div><span class="comp-badge">✓ Complete</span></div>
      <p class="comp-lead">Click any section to browse it, or click Reference for the word-for-word Mandate text.</p>
      ${tops.map(top=>{const children=M.sections.filter(s=>s.topSection===top.section&&s.section!==top.section);return `<section class="comp-section mandate-top-card"><div class="mandate-top-heading"><div>${articleButton(top.section)}<span>Printed page ${top.page||'—'} · ${children.length} subsections</span></div>${sectionButton(top.section,'Exact reference')}</div>${children.length?`<div class="mandate-child-grid">${children.map(c=>`<div class="mandate-child-row">${articleButton(c.section)}${sectionButton(c.section)}</div>`).join('')}</div>`:''}</section>`;}).join('')}`;
    bindMandate($('compArticle'));
  }
  function showMandateSection(id,push=true) {
    const s=M.getSection(id); if(!s) return showMandateHome(push);
    setView({type:'mandate-section',key:s.section},{push}); $('compBreadcrumbs').textContent=`Compendium › Mandate › § ${s.section} › ${s.title}`;
    const children=M.childrenOf(s.section);
    const linkedSkills=skills().filter(skill=>mentions(s,skillTerms(skill)));
    const linkedEntities=entities().filter(x=>String(x.name||'').length>=4&&rx(String(x.name).toLowerCase()).test(sectionText(s))).slice(0,40);
    $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Mandate § ${e(s.section)}</div><h1>${e(s.title)}</h1><div class="comp-short">${e(SOURCE)} · printed page ${s.page||'—'}</div></div>${sectionButton(s.section,'Word-for-word reference')}</div>
      <section class="comp-section"><h2>Rule text</h2><div class="mandate-inline-exact">${exactBlocks(s)}</div></section>
      ${children.length?`<section class="comp-section"><h2>Subsections</h2><div class="mandate-child-grid">${children.map(c=>`<div class="mandate-child-row">${articleButton(c.section)}${sectionButton(c.section)}</div>`).join('')}</div></section>`:''}
      ${(linkedSkills.length||linkedEntities.length)?`<section class="comp-section"><h2>Related Compendium entries</h2>${linkedSkills.length?`<div class="comp-tags">${linkedSkills.map(x=>`<button class="comp-link" data-skill="${e(x.name)}">${e(x.name)}</button>`).join('')}</div>`:''}${linkedEntities.length?`<div class="comp-tags">${linkedEntities.map(x=>`<button class="comp-link" data-entity="${e(x.key)}">${e(x.name)}</button>`).join('')}</div>`:''}</section>`:''}`;
    bindLinks($('compArticle')); bindMandate($('compArticle'));
  }

  const oldRenderNav=renderNav;
  renderNav=function(){oldRenderNav();const host=$('compNav');if(!host||host.querySelector('.mandate-nav-section'))return;const n=document.createElement('section');n.className='comp-nav-section mandate-nav-section';n.innerHTML=`<div class="comp-nav-title">Mandate migration</div><button class="comp-nav-link ${compState.view.type==='mandate-home'?'active':''}" data-view="mandate-home">Progress <small>${done}/5</small></button>${PLAN.map(p=>`<button class="comp-nav-link ${compState.view.type==='mandate-batch'&&compState.view.key===p.id?'active':''}" data-mandate-batch="${p.id}">${p.complete?'✓':'○'} Batch ${p.id} <small>${p.complete?(M.batches.find(x=>x.id===p.id)?.sectionCount||''):'pending'}</small></button>`).join('')}`;host.appendChild(n);bindMandate(n);};
  const oldRenderView=renderView;
  renderView=function(view,opt={}){if(view?.type==='mandate-home')return showMandateHome(opt.push||false);if(view?.type==='mandate-batch')return showMandateBatch(view.key,opt.push||false);if(view?.type==='mandate-section')return showMandateSection(view.key,opt.push||false);return oldRenderView(view,opt);};
  const oldRunSearch=runSearch;
  runSearch=function(q){const r=oldRunSearch(q),query=String(q||'').trim();if(!query)return r;const hits=M.search(query).slice(0,60),results=$('compArticle')?.querySelector('.comp-search-results');if(results&&hits.length){const block=document.createElement('div');block.className='mandate-search-group';block.innerHTML=`<h3>Mandate sections · completed batches</h3>${hits.map(s=>`<div class="comp-result mandate-search-result" data-mandate-section="${e(s.section)}"><strong>§ ${e(s.section)} · ${e(s.title)}</strong><span>Mandate · printed page ${s.page||'—'}</span>${sectionButton(s.section,'Exact reference')}</div>`).join('')}`;results.appendChild(block);bindMandate(block);}return r;};

  ensureModal();
  setTimeout(()=>{if(compState.catalog){compState.catalog.sourceDocument=SOURCE;if($('compSource'))$('compSource').textContent=`Primary source: ${SOURCE}`;renderNav();}},0);
})();

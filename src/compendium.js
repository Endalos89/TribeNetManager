const compState = { catalog:null, view:{ type:'home', key:null }, query:'' };
const $ = id => document.getElementById(id);

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function canon(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function fmtNum(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString():'';}

function skills(){return compState.catalog?.skills||[];}
function topics(){return compState.catalog?.topics||[];}
function skillByName(name){const key=canon(name);return skills().find(s=>canon(s.name)===key||canon(s.shortname)===key)||null;}
function topicByKey(key){return topics().find(t=>t.key===key)||null;}

function ensureMandateSkills(catalog){
  if(!catalog.skills.some(s=>canon(s.name)==='LEADERSHIP')){
    catalog.skills.push({
      id:null,name:'Leadership',shortname:'Ldr',skillGroup:'B',section:'12.2',sourceDocument:catalog.sourceDocument,
      aliases:['Leadership','Ldr'],summary:'Improves effectiveness in land combat; Captaincy replaces it for Fleets.',
      sections:['12.2','17','17.15','29.23'],limitations:[],topics:['land-combat','naval-combat'],workerLimited:false,recipes:[],relatedRequirements:[]
    });
  }
  catalog.skills.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return catalog;
}

function sourceText(sections){
  const refs=(sections||[]).filter(Boolean);
  return refs.length?`Mandate ${refs.join(' · ')}`:'Mandate';
}

function renderNav(){
  const host=$('compNav');
  const groups=['A','B','C'];
  let html=`<section class="comp-nav-section"><div class="comp-nav-title">Overview</div><button class="comp-nav-link ${compState.view.type==='home'?'active':''}" data-view="home">Skills index</button></section>`;
  for(const group of groups){
    const rows=skills().filter(s=>s.skillGroup===group);
    html+=`<section class="comp-nav-section"><div class="comp-nav-title">Group ${group}</div><button class="comp-nav-link ${compState.view.type==='group'&&compState.view.key===group?'active':''}" data-group="${group}">All Group ${group} skills <small>${rows.length}</small></button>${rows.map(s=>`<button class="comp-nav-link ${compState.view.type==='skill'&&canon(compState.view.key)===canon(s.name)?'active':''}" data-skill="${esc(s.name)}">${esc(s.name)} <small>${esc(s.shortname||'')}</small></button>`).join('')}</section>`;
  }
  html+=`<section class="comp-nav-section"><div class="comp-nav-title">Combat</div>${topics().map(t=>`<button class="comp-nav-link ${compState.view.type==='topic'&&compState.view.key===t.key?'active':''}" data-topic="${esc(t.key)}">${esc(t.title)}</button>`).join('')}</section>`;
  host.innerHTML=html;
  bindLinks(host);
}

function bindLinks(root=document){
  root.querySelectorAll('[data-view="home"]').forEach(x=>x.onclick=()=>showHome());
  root.querySelectorAll('[data-group]').forEach(x=>x.onclick=()=>showGroup(x.dataset.group));
  root.querySelectorAll('[data-skill]').forEach(x=>x.onclick=()=>showSkill(x.dataset.skill));
  root.querySelectorAll('[data-topic]').forEach(x=>x.onclick=()=>showTopic(x.dataset.topic));
}

function setView(view){
  compState.view=view;
  renderNav();
  if(window.tribenet?.reportCurrentView){
    window.tribenet.reportCurrentView({page:'compendium.html',screen:'compendium',compendium:view}).catch(()=>{});
  }
}

function groupDescription(group){
  return group==='A'?'Resource gathering and general crafting':group==='B'?'Administration, trade, military and nautical':'Cultural and miscellaneous';
}

function skillButton(s){
  const craftCount=(s.recipes||[]).length;
  return `<button class="comp-skill-button" data-skill="${esc(s.name)}"><strong>${esc(s.name)}</strong><span>${esc(s.shortname||'')} · ${craftCount?`${craftCount} craft/build entries`:sourceText(s.sections)}</span></button>`;
}

function showHome(){
  setView({type:'home',key:null});
  $('compBreadcrumbs').textContent='Compendium › Skills';
  const groups=['A','B','C'];
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Mandate reference</div><h1>Skills</h1><div class="comp-short">Every Mandate skill, grouped exactly as the rulebook defines them.</div></div><span class="comp-badge">${skills().length} skills</span></div>
    <p class="comp-lead">The Compendium uses the Mandate as its primary source. Open a skill to see what it does, its limits, linked crafts/builds, prerequisites and related combat or rules topics.</p>
    <div class="comp-grid">${groups.map(group=>{
      const rows=skills().filter(s=>s.skillGroup===group);
      return `<section class="comp-group-card"><h2>Group ${group}</h2><p>${groupDescription(group)} · ${rows.length} skills</p><div class="comp-skill-grid">${rows.map(skillButton).join('')}</div></section>`;
    }).join('')}</div>
    <section class="comp-section"><h2>Combat</h2><div class="comp-topic-list">${topics().map(t=>`<button class="comp-topic-button" data-topic="${esc(t.key)}"><strong>${esc(t.title)}</strong><span>${esc(t.summary)}</span></button>`).join('')}</div></section>
    <section class="comp-section"><h2>Source</h2><div class="comp-callout">Primary source: ${esc(compState.catalog.sourceDocument)}. Rule-section references are shown on each article so entries can be checked against the Mandate.</div></section>`;
  bindLinks($('compArticle'));
}

function showGroup(group){
  const rows=skills().filter(s=>s.skillGroup===group);
  setView({type:'group',key:group});
  $('compBreadcrumbs').textContent=`Compendium › Skills › Group ${group}`;
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Skills</div><h1>Group ${esc(group)}</h1><div class="comp-short">${esc(groupDescription(group))}</div></div><span class="comp-badge ${group.toLowerCase()}">${rows.length} skills</span></div>
    <p class="comp-lead">These are the skills listed in Group ${esc(group)} by Mandate section 12.2.</p>
    <div class="comp-skill-grid">${rows.map(skillButton).join('')}</div>`;
  bindLinks($('compArticle'));
}

function recipeInputs(r){return (r.inputs||[]).length?(r.inputs||[]).map(x=>`${fmtNum(x.quantity)} ${esc(x.item)}${x.optional?' (optional)':''}`).join(', '):'—';}
function recipeReqs(r){return (r.requirements||[]).map(x=>`${esc(x.skill)} ${fmtNum(x.level)}`).join(', ')||`${esc(r.primarySkill)} ${fmtNum(r.skillLevel)}`;}

function showSkill(name){
  const s=skillByName(name); if(!s)return showHome();
  setView({type:'skill',key:s.name});
  $('compBreadcrumbs').textContent=`Compendium › Skills › Group ${s.skillGroup} › ${s.name}`;
  const topicLinks=(s.topics||[]).map(k=>topicByKey(k)).filter(Boolean);
  const recipeRows=s.recipes||[];
  const related=s.relatedRequirements||[];
  const limitText=s.workerLimited?'10 people per skill level until level 10; unlimited at level 10.':'No general 10×skill worker cap is attached to this skill unless its specific rule says otherwise.';
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Group ${esc(s.skillGroup)} skill</div><h1>${esc(s.name)}</h1><div class="comp-short">Short name: ${esc(s.shortname||'—')}</div></div><span class="comp-badge ${String(s.skillGroup||'').toLowerCase()}">Group ${esc(s.skillGroup||'?')}</span></div>
    <p class="comp-lead">${esc(s.summary||'')}</p>
    <div class="comp-info-list"><div class="comp-info"><span>Skill group</span><strong>${esc(s.skillGroup||'—')}</strong></div><div class="comp-info"><span>Worker limit</span><strong>${esc(limitText)}</strong></div><div class="comp-info"><span>Primary source</span><strong>${esc(sourceText(s.sections))}</strong></div></div>
    ${(s.limitations||[]).length?`<section class="comp-section"><h2>Limitations & special rules</h2>${s.limitations.map(x=>`<div class="comp-callout warn">${esc(x)}</div>`).join('')}</section>`:''}
    ${topicLinks.length?`<section class="comp-section"><h2>Related rules</h2><div class="comp-tags">${topicLinks.map(t=>`<button class="comp-link" data-topic="${esc(t.key)}">${esc(t.title)}</button>`).join('')}</div></section>`:''}
    <section class="comp-section"><h2>What you can make / do</h2>${recipeRows.length?`<table class="comp-recipe-table"><thead><tr><th>Result / action</th><th>Skill</th><th>People</th><th>Inputs</th><th>Requirements / conditions</th><th>Mandate</th></tr></thead><tbody>${recipeRows.map(r=>{
      const extras=[...(r.facilities||[]),...(r.conditions||[])].map(esc).join('; ');
      return `<tr><td><strong>${esc(r.name)}</strong>${r.outputItem?`<br><span class="comp-muted">→ ${fmtNum(r.outputQuantity||1)} ${esc(r.outputItem)}</span>`:''}${r.notes?`<br><span class="comp-muted">${esc(r.notes)}</span>`:''}</td><td>${recipeReqs(r)}</td><td>${fmtNum(r.people)||'—'}</td><td>${recipeInputs(r)}</td><td>${extras||'—'}</td><td>${esc(r.section||'—')}</td></tr>`;
    }).join('')}</tbody></table>`:`<div class="comp-callout">No fixed production recipe is currently stored for this skill. The rules summary and source sections above remain the primary reference for what the skill does.</div>`}</section>
    ${related.length?`<section class="comp-section"><h2>Used as a prerequisite</h2><p>This skill is also required by:</p><div class="comp-tags">${related.map(r=>`<span class="comp-link">${esc(r.name)} · ${esc(r.primarySkill)}</span>`).join('')}</div></section>`:''}
    <section class="comp-section"><h2>Mandate references</h2><div class="comp-tags">${(s.sections||[]).map(sec=>`<span class="comp-link">§ ${esc(sec)}</span>`).join('')}</div></section>`;
  bindLinks($('compArticle'));
}

function topicSkillTags(list){return (list||[]).map(name=>{const s=skillByName(name);return `<button class="comp-link" data-skill="${esc(s?.name||name)}">${esc(s?.name||name)}</button>`;}).join('');}

function showTopic(key){
  const t=topicByKey(key); if(!t)return showHome();
  setView({type:'topic',key:t.key});
  $('compBreadcrumbs').textContent=`Compendium › Combat › ${t.title}`;
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Combat rules</div><h1>${esc(t.title)}</h1><div class="comp-short">Primary section: Mandate ${esc(t.section)}</div></div><span class="comp-badge">Combat</span></div>
    <p class="comp-lead">${esc(t.summary)}</p>
    <section class="comp-section"><h2>Core rules</h2><ul>${(t.rules||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul></section>
    <section class="comp-section"><h2>Core skills</h2><div class="comp-tags">${topicSkillTags(t.coreSkills)}</div></section>
    <section class="comp-section"><h2>Supporting skills</h2><div class="comp-tags">${topicSkillTags(t.supportSkills)}</div></section>
    <section class="comp-section"><h2>Mandate references</h2><div class="comp-tags">${(t.sections||[]).map(sec=>`<span class="comp-link">§ ${esc(sec)}</span>`).join('')}</div></section>`;
  bindLinks($('compArticle'));
}

function runSearch(query){
  compState.query=String(query||'').trim();
  if(!compState.query)return showHome();
  const q=canon(compState.query);
  const skillResults=skills().filter(s=>{
    const text=canon([s.name,s.shortname,s.summary,(s.sections||[]).join(' '),(s.recipes||[]).map(r=>`${r.name} ${r.outputItem||''} ${(r.inputs||[]).map(i=>i.item).join(' ')}`).join(' ')].join(' '));
    return text.includes(q);
  });
  const topicResults=topics().filter(t=>canon(`${t.title} ${t.summary} ${(t.rules||[]).join(' ')} ${(t.coreSkills||[]).join(' ')} ${(t.supportSkills||[]).join(' ')}`).includes(q));
  compState.view={type:'search',key:compState.query}; renderNav();
  $('compBreadcrumbs').textContent=`Compendium › Search › ${compState.query}`;
  const results=[...skillResults.map(s=>`<div class="comp-result" data-skill="${esc(s.name)}"><strong>${esc(s.name)}</strong><span>Group ${esc(s.skillGroup)} · ${esc(s.summary||'')}</span></div>`),...topicResults.map(t=>`<div class="comp-result" data-topic="${esc(t.key)}"><strong>${esc(t.title)}</strong><span>${esc(t.summary)}</span></div>`)].join('');
  $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Search</div><h1>${esc(compState.query)}</h1><div class="comp-short">${skillResults.length+topicResults.length} matching articles</div></div></div><section class="comp-section"><div class="comp-search-results">${results||'<div class="comp-callout">No matching skills, crafts or topics.</div>'}</div></section>`;
  bindLinks($('compArticle'));
}

async function restoreView(){
  try{
    const snapshot=await window.tribenet.consumeStartupView();
    if(snapshot?.page!=='compendium.html'||!snapshot.compendium)return false;
    const view=snapshot.compendium;
    if(view.type==='skill'&&view.key){showSkill(view.key);return true;}
    if(view.type==='group'&&view.key){showGroup(view.key);return true;}
    if(view.type==='topic'&&view.key){showTopic(view.key);return true;}
  }catch(_){ }
  return false;
}

async function init(){
  $('compVersion').textContent=`TribeNet Manager ${await window.tribenet.getVersion()} · Compendium`;
  compState.catalog=ensureMandateSkills(await window.tribenet.getCompendiumCatalog());
  $('compSource').textContent=`Primary source: ${compState.catalog.sourceDocument}`;
  $('compSearch').addEventListener('input',event=>runSearch(event.target.value));
  renderNav();
  if(!(await restoreView()))showHome();
}

init().catch(error=>{$('compArticle').innerHTML=`<div class="comp-callout warn">Could not load Compendium: ${esc(error.message||error)}</div>`;});

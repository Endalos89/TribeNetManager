const compState = { catalog:null, view:{ type:'home', key:null }, query:'', history:[] };
const $ = id => document.getElementById(id);

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function canon(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function fmtNum(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString():'';}
function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}

function skills(){return compState.catalog?.skills||[];}
function topics(){return compState.catalog?.topics||[];}
function entities(){return compState.catalog?.entities||[];}
function skillByName(name){const key=canon(name);return skills().find(s=>canon(s.name)===key||canon(s.shortname)===key)||null;}
function topicByKey(key){return topics().find(t=>t.key===key)||null;}
function entityByName(name){const key=canon(name);return entities().find(e=>canon(e.key)===key||canon(e.name)===key)||null;}

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

function sameView(a,b){return a?.type===b?.type&&String(a?.key??'')===String(b?.key??'');}
function updateBackButton(){
  const button=$('compBackButton');
  if(!button)return;
  button.disabled=compState.history.length===0;
  button.title=button.disabled?'No previous Compendium page':'Return to the previous Compendium page';
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
  root.querySelectorAll('[data-entity]').forEach(x=>x.onclick=()=>showEntity(x.dataset.entity));
}

function setView(view,{push=true}={}){
  if(push&&!sameView(compState.view,view))compState.history.push(clone(compState.view));
  compState.view=view;
  renderNav();
  updateBackButton();
  if(window.tribenet?.reportCurrentView){
    window.tribenet.reportCurrentView({page:'compendium.html',screen:'compendium',compendium:view}).catch(()=>{});
  }
}

function goBack(){
  const previous=compState.history.pop();
  if(!previous){updateBackButton();return;}
  renderView(previous,{push:false});
}

function groupDescription(group){
  return group==='A'?'Resource gathering and general crafting':group==='B'?'Administration, trade, military and nautical':'Cultural and miscellaneous';
}

function skillButton(s){
  const craftCount=(s.recipes||[]).length;
  return `<button class="comp-skill-button" data-skill="${esc(s.name)}"><strong>${esc(s.name)}</strong><span>${esc(s.shortname||'')} · ${craftCount?`${craftCount} craft/build entries`:sourceText(s.sections)}</span></button>`;
}

function entityLink(name,label=name){
  const entity=entityByName(name);
  return entity?`<button class="comp-text-link" data-entity="${esc(entity.key)}">${esc(label)}</button>`:esc(label);
}

function skillLink(name,label=name){
  const skill=skillByName(name);
  return skill?`<button class="comp-text-link" data-skill="${esc(skill.name)}">${esc(label)}</button>`:esc(label);
}

function showHome(push=true){
  setView({type:'home',key:null},{push});
  $('compBreadcrumbs').textContent='Compendium › Skills';
  const groups=['A','B','C'];
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Mandate reference</div><h1>Skills</h1><div class="comp-short">Every Mandate skill, grouped exactly as the rulebook defines them.</div></div><span class="comp-badge">${skills().length} skills</span></div>
    <p class="comp-lead">The Compendium uses the Mandate as its primary source. Skills, materials, crafted items and facilities link to one another so you can follow a production chain like a wiki.</p>
    <div class="comp-grid">${groups.map(group=>{
      const rows=skills().filter(s=>s.skillGroup===group);
      return `<section class="comp-group-card"><h2>Group ${group}</h2><p>${groupDescription(group)} · ${rows.length} skills</p><div class="comp-skill-grid">${rows.map(skillButton).join('')}</div></section>`;
    }).join('')}</div>
    <section class="comp-section"><h2>Combat</h2><div class="comp-topic-list">${topics().map(t=>`<button class="comp-topic-button" data-topic="${esc(t.key)}"><strong>${esc(t.title)}</strong><span>${esc(t.summary)}</span></button>`).join('')}</div></section>
    <section class="comp-section"><h2>Source</h2><div class="comp-callout">Primary source: ${esc(compState.catalog.sourceDocument)}. Rule-section references are shown on each article so entries can be checked against the Mandate.</div></section>`;
  bindLinks($('compArticle'));
}

function showGroup(group,push=true){
  const rows=skills().filter(s=>s.skillGroup===group);
  setView({type:'group',key:group},{push});
  $('compBreadcrumbs').textContent=`Compendium › Skills › Group ${group}`;
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">Skills</div><h1>Group ${esc(group)}</h1><div class="comp-short">${esc(groupDescription(group))}</div></div><span class="comp-badge ${group.toLowerCase()}">${rows.length} skills</span></div>
    <p class="comp-lead">These are the skills listed in Group ${esc(group)} by Mandate section 12.2.</p>
    <div class="comp-skill-grid">${rows.map(skillButton).join('')}</div>`;
  bindLinks($('compArticle'));
}

function renderInputList(inputs){
  if(!(inputs||[]).length)return '—';
  return inputs.map(input=>`${fmtNum(input.quantity)} ${entityLink(input.item,input.item)}${input.optional?' <span class="comp-muted">(optional)</span>':''}`).join(', ');
}

function renderAlternatives(recipe){
  const variants=recipe.alternatives||[];
  if(variants.length<=1)return renderInputList(variants[0]?.inputs||recipe.inputs||[]);
  return `<div class="comp-variants">${variants.map((variant,index)=>`<div class="comp-variant"><strong>${esc(variant.label&&variant.label!=='Standard'?variant.label:`Option ${index+1}`)}</strong><span>${renderInputList(variant.inputs||[])}</span>${variant.note?`<small>${esc(variant.note)}</small>`:''}</div>`).join('')}</div>`;
}

function renderRequirements(recipe){
  const requirements=(recipe.requirements||[]).map(req=>`${skillLink(req.skill,req.skill)} ${fmtNum(req.level)}`);
  const facilities=(recipe.facilities||[]).map(text=>{
    const matching=entities().filter(entity=>entity.kind==='facility'&&new RegExp(`\\b${entity.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/s$/,'')}s?\\b`,'i').test(String(text)));
    if(!matching.length)return esc(text);
    let rendered=esc(text);
    for(const entity of matching)rendered=rendered.replace(new RegExp(entity.name,'i'),entityLink(entity.key,entity.name));
    return rendered;
  });
  const conditions=(recipe.conditions||[]).map(esc);
  return [...requirements,...facilities,...conditions].join('<br>')||'—';
}

function renderRecipeRows(recipeRows){
  return `<table class="comp-recipe-table"><thead><tr><th>Result / action</th><th>Skill</th><th>People</th><th>Inputs / alternatives</th><th>Requirements / conditions</th><th>Mandate</th></tr></thead><tbody>${recipeRows.map(recipe=>`
    <tr>
      <td><strong>${esc(recipe.name)}</strong>${recipe.outputItem?`<br><span class="comp-muted">→ ${fmtNum(recipe.outputQuantity||1)} ${entityLink(recipe.outputItem,recipe.outputItem)}</span>`:''}${recipe.notes?`<br><span class="comp-muted">${esc(recipe.notes)}</span>`:''}</td>
      <td>${skillLink(recipe.primarySkill,recipe.primarySkill)} ${fmtNum(recipe.skillLevel)}</td>
      <td>${fmtNum(recipe.people)||'—'}</td>
      <td>${renderAlternatives(recipe)}</td>
      <td>${renderRequirements(recipe)}</td>
      <td>${esc(recipe.section||'—')}</td>
    </tr>`).join('')}</tbody></table>`;
}

function showSkill(name,push=true){
  const s=skillByName(name); if(!s)return showHome(push);
  setView({type:'skill',key:s.name},{push});
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
    <section class="comp-section"><h2>What you can make / do</h2>${recipeRows.length?renderRecipeRows(recipeRows):`<div class="comp-callout">No fixed production recipe is currently stored for this skill. The rules summary and source sections above remain the primary reference for what the skill does.</div>`}</section>
    ${related.length?`<section class="comp-section"><h2>Used as a prerequisite</h2><p>This skill is also required by:</p><div class="comp-tags">${related.map(r=>`<button class="comp-link" data-skill="${esc(r.primarySkill)}">${esc(r.name)} · ${esc(r.primarySkill)}</button>`).join('')}</div></section>`:''}
    <section class="comp-section"><h2>Mandate references</h2><div class="comp-tags">${(s.sections||[]).map(sec=>`<span class="comp-link">§ ${esc(sec)}</span>`).join('')}</div></section>`;
  bindLinks($('compArticle'));
}

function producerCard(row){
  return `<div class="comp-method-card"><div><strong>${esc(row.name)}</strong><span>${skillLink(row.skill,row.skill)} ${fmtNum(row.skillLevel)} · ${fmtNum(row.people)} people</span></div><div>${renderAlternatives(row)}</div>${row.notes?`<small>${esc(row.notes)}</small>`:''}<small>Mandate § ${esc(row.section||'—')}</small></div>`;
}

function showEntity(name,push=true){
  const entity=entityByName(name); if(!entity)return showHome(push);
  setView({type:'entity',key:entity.key},{push});
  $('compBreadcrumbs').textContent=`Compendium › ${entity.kind||'Item'} › ${entity.name}`;
  const producers=entity.producers||[];
  const sourceSkills=(entity.sourceSkills||[]).map(skill=>skillByName(skill)).filter(Boolean);
  const consumers=entity.consumers||[];
  const uses=entity.uses||[];
  const hasObtain=producers.length||sourceSkills.length;
  $('compArticle').innerHTML=`
    <div class="comp-title-row"><div><div class="comp-kicker">${esc(entity.kind||'Item')}</div><h1>${esc(entity.name)}</h1><div class="comp-short">Linked Mandate reference</div></div><span class="comp-badge">${esc(entity.kind||'Item')}</span></div>
    ${entity.summary?`<p class="comp-lead">${esc(entity.summary)}</p>`:''}
    <section class="comp-section"><h2>How to obtain it</h2>
      ${sourceSkills.length?`<div class="comp-callout">Obtained through ${sourceSkills.map(s=>skillLink(s.name,s.name)).join(', ')}. See the linked skill article for its activity rules.</div>`:''}
      ${producers.length?`<div class="comp-method-list">${producers.map(producerCard).join('')}</div>`:''}
      ${!hasObtain?`<div class="comp-callout">No fixed production method is currently indexed for this entry. Check the Mandate references below; this may be a traded, discovered, starting, special or externally acquired resource.</div>`:''}
    </section>
    ${(entity.notes||[]).length?`<section class="comp-section"><h2>Notes & special rules</h2>${entity.notes.map(note=>`<div class="comp-callout warn">${esc(note)}</div>`).join('')}</section>`:''}
    ${uses.length?`<section class="comp-section"><h2>Used in other skills</h2><div class="comp-use-list">${uses.map(use=>`<div class="comp-use"><strong>${skillLink(use.skill,use.skill)}</strong><span>${esc(use.text)}</span><small>Mandate § ${esc(use.section||'—')}</small></div>`).join('')}</div></section>`:''}
    ${consumers.length?`<section class="comp-section"><h2>Used to make / operate</h2><div class="comp-use-list">${consumers.map(row=>`<div class="comp-use"><strong>${esc(row.name)}</strong><span>${skillLink(row.skill,row.skill)} · used as ${esc(row.role||'input')}</span><small>Mandate § ${esc(row.section||'—')}</small></div>`).join('')}</div></section>`:''}
    <section class="comp-section"><h2>Mandate references</h2><div class="comp-tags">${(entity.sections||[]).map(sec=>`<span class="comp-link">§ ${esc(sec)}</span>`).join('')||'<span class="comp-muted">No section indexed.</span>'}</div></section>`;
  bindLinks($('compArticle'));
}

function topicSkillTags(list){return (list||[]).map(name=>{const s=skillByName(name);return `<button class="comp-link" data-skill="${esc(s?.name||name)}">${esc(s?.name||name)}</button>`;}).join('');}

function showTopic(key,push=true){
  const t=topicByKey(key); if(!t)return showHome(push);
  setView({type:'topic',key:t.key},{push});
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
  if(!compState.query){showHome(compState.view.type!=='home');return;}
  const q=canon(compState.query);
  const skillResults=skills().filter(s=>canon([s.name,s.shortname,s.summary,(s.sections||[]).join(' '),(s.recipes||[]).map(r=>`${r.name} ${r.outputItem||''} ${(r.inputs||[]).map(i=>i.item).join(' ')}`).join(' ')].join(' ')).includes(q));
  const topicResults=topics().filter(t=>canon(`${t.title} ${t.summary} ${(t.rules||[]).join(' ')} ${(t.coreSkills||[]).join(' ')} ${(t.supportSkills||[]).join(' ')}`).includes(q));
  const entityResults=entities().filter(entity=>canon(`${entity.name} ${entity.kind} ${entity.summary||''} ${(entity.notes||[]).join(' ')} ${(entity.sourceSkills||[]).join(' ')} ${(entity.uses||[]).map(use=>`${use.skill} ${use.text}`).join(' ')}`).includes(q));
  const shouldPush=compState.view.type!=='search';
  setView({type:'search',key:compState.query},{push:shouldPush});
  $('compBreadcrumbs').textContent=`Compendium › Search › ${compState.query}`;
  const results=[
    ...skillResults.map(s=>`<div class="comp-result" data-skill="${esc(s.name)}"><strong>${esc(s.name)}</strong><span>Skill · Group ${esc(s.skillGroup)} · ${esc(s.summary||'')}</span></div>`),
    ...entityResults.map(entity=>`<div class="comp-result" data-entity="${esc(entity.key)}"><strong>${esc(entity.name)}</strong><span>${esc(entity.kind||'Item')} · ${esc(entity.summary||'Linked production/resource entry')}</span></div>`),
    ...topicResults.map(t=>`<div class="comp-result" data-topic="${esc(t.key)}"><strong>${esc(t.title)}</strong><span>Rules topic · ${esc(t.summary)}</span></div>`)
  ].join('');
  const count=skillResults.length+topicResults.length+entityResults.length;
  $('compArticle').innerHTML=`<div class="comp-title-row"><div><div class="comp-kicker">Search</div><h1>${esc(compState.query)}</h1><div class="comp-short">${count} matching articles</div></div></div><section class="comp-section"><div class="comp-search-results">${results||'<div class="comp-callout">No matching skills, items, facilities, crafts or topics.</div>'}</div></section>`;
  bindLinks($('compArticle'));
}

function renderView(view,{push=false}={}){
  if(view.type==='skill')return showSkill(view.key,push);
  if(view.type==='group')return showGroup(view.key,push);
  if(view.type==='topic')return showTopic(view.key,push);
  if(view.type==='entity')return showEntity(view.key,push);
  if(view.type==='search'){ $('compSearch').value=view.key||''; return runSearch(view.key||''); }
  return showHome(push);
}

async function restoreView(){
  try{
    const snapshot=await window.tribenet.consumeStartupView();
    if(snapshot?.page!=='compendium.html'||!snapshot.compendium)return false;
    renderView(snapshot.compendium,{push:false});
    return true;
  }catch(_){ }
  return false;
}

async function init(){
  $('compVersion').textContent=`TribeNet Manager ${await window.tribenet.getVersion()} · Compendium`;
  compState.catalog=ensureMandateSkills(await window.tribenet.getCompendiumCatalog());
  $('compSource').textContent=`Primary source: ${compState.catalog.sourceDocument}`;
  $('compSearch').addEventListener('input',event=>runSearch(event.target.value));
  $('compBackButton').addEventListener('click',goBack);
  renderNav();
  updateBackButton();
  if(!(await restoreView()))showHome(false);
}

init().catch(error=>{$('compArticle').innerHTML=`<div class="comp-callout warn">Could not load Compendium: ${esc(error.message||error)}</div>`;});

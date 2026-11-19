/* Mapper Activities: three-menu workflow, Hunting pilot and Running Orders manager.
 * No forecasts are written to Results; the SQLite Mapper plan is authoritative.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const engine = window.TribeNetHuntingEngine;
const livestock = window.TribeNetLivestockEngine;
if(!engine||!livestock)return;
const ui={page:'skills',unit:'',skill:'Hunting',activityCode:'HUNTING',animal:'GOAT',knives:0,workersBySkill:{},knivesBySkill:{},goalItem:'SKINS',goalQuantity:0,mode:'once',bills:[],activities:[],
  editing:null,editingActivity:null,workers:0,selectedTools:[],list:[],transfers:[],status:'',preview:null,otherStatuses:[],
  goal:'months',months:3,yieldMode:'average',loadEnabled:false,loadPercent:90,goalHint:'',toolsCustomized:false,showSavedAll:false,
  hideSkill:false,hideInputs:false,managerUnit:'all',managerState:'all'};
const unitCode = unit => String(unit?.unitCode||unit?.unit||'').trim();
const num = v => v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const whole = v => Math.max(0,Math.floor(Number(v)||0));
const display = v => v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString():'—';
const sourceTurn = () => state?.planImport?.turnKey || (typeof savedMovementCurrentTurnKey==='function' ? savedMovementCurrentTurnKey() : null);
const allUnits = () => {
  const combined=new Map();
  const add=unit=>{const key=unitCode(unit).toLowerCase();if(key)combined.set(key,{...(combined.get(key)||{}),...unit});};
  for(const unit of state?.planImport?.plan?.units||[])add(unit);
  for(const unit of window.resultsTimeline?.turn?.units||[])add(unit);
  if(typeof savedMovementUnits==='function')for(const unit of savedMovementUnits())add(unit);
  return [...combined.values()];
};
const selectedCode = () => String(state?.selectedUnit||(typeof savedMovementPlansState==='object'?savedMovementPlansState?.selectedUnitCode:'')||'').trim();
const resultUnit = code => allUnits().find(u=>unitCode(u).toLowerCase()===String(code||'').toLowerCase());
const baseStats = code => (state?.planImport?.plan?.unitStats||[]).find(u=>String(u.unit||'').toLowerCase()===String(code||'').toLowerCase())||null;
const rootCode = code => String(code||'').slice(0,4);
function ownerCode(unit){
  const id=unitCode(unit);
  const row=(state?.planImport?.plan?.clan||[]).find(r=>String(r.unit||'').toLowerCase()===rootCode(id).toLowerCase());
  const gt=String(unit?.goodsTribe||row?.gt||'').trim();
  if(!/^\d{4}(?:[efgc]\d+)?$/i.test(gt))return id;
  return gt.toLowerCase()!==id.toLowerCase()?gt:id;
}
function dataStock(unit){
  const stock={};
  const put=(name,value)=>{const qty=num(value);if(name&&qty!==null)stock[String(name)]=(stock[String(name)]||0)+qty;};
  for(const [name,group] of Object.entries(unit?.resources||{})){
    if(group&&typeof group==='object')for(const [item,n] of Object.entries(group))put(item,n);
    else put(name,group);
  }
  if(!Object.keys(stock).length){
    for(const row of baseStats(unitCode(unit))?.inventory||[])put(row.item,row.quantity);
  }
  return stock;
}
function availableWorkers(unit){
  const p=unit?.people||{};
  let act=num(p.Actives??p.Active??unit?.active), war=num(p.Warriors??unit?.warrior);
  if(act===null||war===null){
    const stats=baseStats(unitCode(unit));
    act ??= num(stats?.active); war ??= num(stats?.warrior);
  }
  if(act===null&&war===null)return null;
  return whole(act)+whole(war);
}
function eaters(unit){
  const p=unit?.people||{},stats=baseStats(unitCode(unit));
  const a=num(p.Actives??stats?.active),w=num(p.Warriors??stats?.warrior),i=num(p.Inactives??stats?.inactive),s=num(p.Slaves??stats?.slave);
  if([a,w,i,s].every(x=>x===null))return whole(p.People??stats?.eaters);
  return whole(a)+whole(w)+whole(i)+whole(s);
}
function huntingLevel(unit){
  const code=unitCode(unit),tribe=resultUnit(rootCode(code));
  const data=Object.keys(unit?.skills||{}).length?unit.skills:tribe?.skills||{};
  if(!Object.keys(data).length)return null;
  return window.SelectedUnitPanelUtils?.levelForSkill?.('Hunting',data)??null;
}
function skillLevel(unit,name){
  const tribe=resultUnit(rootCode(unitCode(unit)));
  const data=Object.keys(unit?.skills||{}).length?unit.skills:tribe?.skills||{};
  if(!Object.keys(data).length)return '?';
  return window.SelectedUnitPanelUtils?.levelForSkill?.(name,data)??'?';
}
function hexAt(ref){
  if(!ref)return null;
  const cache=state?.hexCache;
  if(cache?.get(ref))return cache.get(ref);
  return (window.resultsTimeline?.turn?.hexes||[]).find(h=>h.coordinate===ref)||null;
}
function waterBorders(ref){
  const parser=window.MovementPlannerCore?.parseCoordinate;
  const parsed=parser?.(ref);
  let n=/river|lake|ocean|water/i.test(String(hexAt(ref)?.notes||''))?1:0;
  for(const adjacent of (parsed?window.MovementPlannerCore?.adjacentHexes?.(parsed):[])||[]){
    const hex=hexAt(adjacent.coordinate);
    if(hex && (['L','O'].includes(String(hex.terrain||'').toUpperCase())||/river|lake|ocean|water/i.test(String(hex.notes||''))))n++;
  }
  return n;
}
function contextFor(unit){
  const code=unitCode(unit),owner=ownerCode(unit),stock=dataStock(unit),stats=baseStats(code);
  const hex=String(unit.startHex||unit.currentHex||stats?.startHex||'').toUpperCase();
  const turn=String(sourceTurn()||''),match=turn.match(/-(\d{1,2})$/);
  const provs=Object.entries(stock).filter(([k])=>/^(provs|provisions)$/i.test(k)).reduce((v,[k,n])=>v+Number(n||0),0);
  const currentWeight=num(stats?.carriedWeight??unit.weight);
  const capacity=num(stats?.carryingCapacity??unit.walkingCapacity);
  const knownStock=Boolean(Object.keys(stock).length || stats?.inventory || unit?.resources);
  return {code,goodsTribe:owner!==code?owner:null,skill:huntingLevel(unit),
    skillLevels:Object.fromEntries(['GUTTING','SKINNING','BONING','HERDING'].map(name=>[name,skillLevel(unit,name)])),
    atSea:/^\d{4}f\d+$/i.test(code)&&['O','L'].includes(String(hexAt(hex)?.terrain||'').toUpperCase()),
    terrain:hexAt(hex)?.terrain||null,waterBorders:waterBorders(hex),month:match?Number(match[1]):null,
    workersAvailable:availableWorkers(unit),eaters:eaters(unit),stock,
    provs:knownStock?provs:null,currentWeight,capacity,provsWeight:10,
    // Mandate §8.3: report weight can exclude Provisions carried for end-turn eating. For a safe BM cap,
    // treat the entire reported load as the conservative non-Provisions upper bound until breakdown is verified.
    otherMaxWeight:currentWeight!==null&&knownStock?currentWeight:null};
}
const contextList = () => allUnits().map(contextFor);
function skillList(){
  // Only display implemented/testable skills. More will be added in their
  // respective per-skill rollout, not as inert icons.
  return ['Hunting','Herding','Processing'];
}
function compendiumLink(entry,key,label){
  return `<button type="button" class="activities-compendium-link" data-compendium-entry="${esc(entry)}" data-compendium-key="${esc(key)}"
    aria-label="Open ${esc(label)} in Compendium" title="Open ${esc(label)} in Compendium">ⓘ</button>`;
}
function openCompendium(entry,key){
  if(typeof window.tribenet?.openCompendium!=='function')
    throw Error('Compendium navigation is unavailable in this app version.');
  return window.tribenet.openCompendium(entry,key);
}

function ensure(){
  if($('activitiesDialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='activitiesDialog';dialog.className='activities-dialog';
  dialog.innerHTML=`<div class="activities-shell">
    <header class="activities-header"><div><small>TRIBENET MANAGER · ACTIVITIES</small><h2 id="activitiesTitle">Activities</h2><p id="activitiesSubtitle"></p></div>
    <div class="activities-header-actions"><button type="button" class="button" id="activitiesManage">Running Orders</button><button type="button" class="button" id="activitiesClose">Close ✕</button></div></header>
    <div class="activities-path" id="activitiesPath"></div>
    <div id="activitiesBody" class="activities-body"></div>
    <p id="activitiesStatus" class="activities-status" role="status"></p>
  </div>`;
  document.body.appendChild(dialog);
  $('activitiesClose').addEventListener('click',()=>dialog.close());
  $('activitiesManage').addEventListener('click',()=>{ui.page='manager';render();});
  $('activitiesBody').addEventListener('click',handleClick);
  $('activitiesBody').addEventListener('change',handleChange);
  $('activitiesBody').addEventListener('input',handleInput);
}
function currentUnit(){return resultUnit(ui.unit);}
function selectedBill(){return ui.editing==null?null:ui.bills.find(b=>b.id===ui.editing);}
function resetBillSettings(bill=null){
  ui.goal=bill?.mode||'months';ui.months=bill?.months??3;
  ui.yieldMode=bill?.yieldMode||'average';
  ui.loadEnabled=bill?.loadPercent!=null;ui.loadPercent=bill?.loadPercent??90;
  ui.goalHint='';
}
function goalAllocation(){
  if(ui.mode!=='running')return null;
  const unit=currentUnit();
  if(!unit)return {error:'Select a unit to calculate hunters'};
  const ctx=contextFor(unit),total=availableWorkers(unit);
  if(total===null||ctx.skill===null||!ctx.terrain||!ctx.month)
    return {error:'Automatic hunter count requires verified workers, skill, turn month and start terrain'};
  const pool=ownerCode(unit),source=resultUnit(pool)||unit,poolContext=contextFor(source);
  if(poolContext.provs==null)return {error:'Confirm the Goods Tribe Provisions inventory before calculating a goal'};
  const higher=new Set(ui.bills.filter(b=>ui.editing!=null&&ui.bills.findIndex(x=>x.id===b.id)<
    ui.bills.findIndex(x=>x.id===ui.editing)).map(b=>b.id));
  const relevant=ui.activities.filter(row=>{
    const u=resultUnit(row.unit);
    return u&&ownerCode(u).toLowerCase()===pool.toLowerCase()&&
      row.generatedBillId!==ui.editing&&(!row.generatedBillId||higher.has(row.generatedBillId));
  });
  let otherOutput=0;
  let dogsForOtherActivities=engine.stockCount(sourceStock(),'Hunting Dog');
  for(const row of relevant){
    if(row.activityCode!=='HUNTING')continue;
    const worker=resultUnit(row.unit),base=contextFor(worker);
    const assistingDogs=Math.min(whole(row.people),dogsForOtherActivities);
    dogsForOtherActivities-=assistingDogs;
    const am=whole(row.people)+(row.implements||[]).reduce((sum,t)=>
      sum+whole(t.quantity)*(engine.TOOLS.find(x=>x.name===t.name)?.bonus||0),0)+assistingDogs*2;
    const range=engine.forecast({workers:row.people,effectiveAM:am,skill:base.skill,
      terrain:base.terrain,month:base.month,waterBorders:base.waterBorders});
    if(!range)continue;
    const basis=ui.bills.find(b=>b.id===row.generatedBillId)?.yieldMode||'average';
    otherOutput+=engine.predicted(range,basis)||0;
  }
  const netBm=ui.transfers.filter(t=>t.timing==='BM'&&String(t.from).toLowerCase()!==String(t.to).toLowerCase()
    &&/^(PROVS|PROVISIONS)$/i.test(t.item)).reduce((sum,t)=>
      sum+(String(t.to).toLowerCase()===pool.toLowerCase()?whole(t.quantity):0)-
      (String(t.from).toLowerCase()===pool.toLowerCase()?whole(t.quantity):0),0);
  const eaters=contextList().filter(c=>{
    const u=resultUnit(c.code);return u&&ownerCode(u).toLowerCase()===pool.toLowerCase();
  }).reduce((sum,c)=>sum+whole(c.eaters),0);
  const demand=engine.provisionTarget(ui.months,eaters);
  const shortfall=Math.max(0,demand.beforeEating-poolContext.provs-netBm-otherOutput);
  const otherWorkers=ui.activities.filter(row=>String(row.unit).toLowerCase()===ctx.code.toLowerCase()
    &&row.generatedBillId!==ui.editing).reduce((sum,row)=>sum+whole(row.people),0);
  const available=Math.max(0,total-otherWorkers);
  if(ui.goal==='maximise')return {workers:available,reason:'Maximise uses workers remaining after saved activities'};
  const planned=engine.allocation({workersAvailable:available,goalProvs:shortfall,mode:ui.yieldMode,
    skill:ctx.skill,terrain:ctx.terrain,month:ctx.month,waterBorders:ctx.waterBorders,
    stock:sourceStock(),reservations:reservedTools()});
  if(planned.error)return {error:planned.error};
  return {workers:planned.workers,
    reason:`Goal: ${display(demand.afterEating)} Provisions after eating · ${display(shortfall)} expected needed before eating (after saved BM changes and higher-priority output)`+
    (planned.achievable?'':' · Goal exceeds available hunters')};
}
function autofillHunters(){
  const result=goalAllocation();
  if(result?.workers!=null){ui.workers=whole(result.workers);ui.selectedTools=[];}
  ui.goalHint=result?.reason||result?.error||'';
}
function updateAllocationPreview(){
  if(ui.page!=='allocate')return;
  const number=$('huntWorkers'),slider=$('huntWorkersSlider');
  if(number)number.value=String(ui.workers);
  if(slider)slider.value=String(ui.workers);
  const p=preview();
  const range=$('huntYieldRange'),details=$('huntYieldDetail'),tools=$('huntToolsList'),hint=$('huntGoalHint');
  if(range)range.textContent=p.range?`${display(p.range.min)} – ${display(p.range.max)} Provisions`:'Unknown terrain / calculator rate';
  if(details)details.textContent=p.range?`Fine weather: ${display(p.range.fine)} · Scenario average: ${display(p.range.average)}`:
    'Verify the unit’s start-of-turn terrain before saving a forecast.';
  if(tools)tools.innerHTML=p.tools.length?p.tools.map(t=>`<span>${esc(t.name)}</span><strong>× ${whole(t.quantity)}</strong>`).join(''):'No eligible tools allocated';
  const editor=$('huntToolsEditor');
  if(editor&&!document.activeElement?.hasAttribute?.('data-tool-item'))editor.innerHTML=toolsTable();
  if(hint)hint.textContent=ui.goalHint;
}
async function load(){
  ui.bills=await window.tribenet.listActivityBills();
  ui.activities=sourceTurn()?await window.tribenet.listPlannedActivities(sourceTurn()):[];
  ui.transfers=sourceTurn()?await window.tribenet.listPlannedTransfers(sourceTurn()):[];
}
function showDialog(){
  ensure();
  const dialog=$('activitiesDialog');
  if(!dialog.open)dialog.showModal();
}
async function open(unit=selectedCode()){
  showDialog();
  const resolved=resultUnit(unit);
  ui.unit=unitCode(resolved)||String(unit||'');
  ui.page='skills';ui.editing=null;ui.editingActivity=null;resetBillSettings();
  ui.workers=Math.min(availableWorkers(resolved)||0,10);
  ui.selectedTools=[];ui.toolsCustomized=false;ui.status='';
  if(!sourceTurn())ui.status='No planning turn selected. Import the Results baseline or select the planning turn first.';
  else if(!resolved)ui.status='Select a unit in the Mapper first, then use its Activities Turn Action.';
  $('activitiesBody').textContent='Loading unit activities…';
  try{await load();render();}
  catch(error){ui.status='Could not load Activities: '+String(error.message||error);render();}
}
async function openOverview(){
  showDialog();
  ui.page='overview';ui.status='';
  $('activitiesBody').textContent='Loading saved Activities overview…';
  try{await load();render();}
  catch(error){ui.status='Could not load Activities overview: '+String(error.message||error);render();}
}
function pathHeader(){
  const bits=[['skills','Skills'],['recipes',ui.skill],['allocate','Allocation']];
  if(ui.page==='manager')return '<span>Running Orders / Priorities</span>';
  if(ui.page==='overview')return '<span>Activities Overview · All Units</span>';
  return bits.map(([page,label],idx)=>`<button data-go="${page}" ${ui.page===page?'class="active"':''}>${idx+1}. ${esc(label)}</button>`).join('<span class="chevron">›</span>');
}
function render(){
  if(!$('activitiesDialog'))return;
  $('activitiesTitle').textContent=ui.page==='manager'?'Running Orders':ui.page==='overview'?'Activities Overview':'Activities';
  $('activitiesSubtitle').textContent=ui.page==='overview'
    ? `Turn ${sourceTurn()||'—'} · All units · Current saved plan`
    : `Unit ${ui.unit||'—'} · Turn ${sourceTurn()||'—'} · ${ui.page==='manager'?'Clan-wide priority queue':'Three-menu activity editor'}`;
  $('activitiesPath').innerHTML=pathHeader();
  $('activitiesManage').hidden=ui.page==='manager';
  const body=$('activitiesBody');
  if(ui.page==='overview')body.innerHTML=renderOverview();
  else if(ui.page==='skills')body.innerHTML=renderSkills();
  else if(ui.page==='recipes')body.innerHTML=renderRecipes();
  else if(ui.page==='allocate')body.innerHTML=renderAllocate();
  else body.innerHTML=renderManager();
  $('activitiesStatus').textContent=ui.status;
}
function renderOverview(){
  const rows=ui.activities||[];
  return `<div class="activities-toolbar"><strong>Saved activities · all units</strong>
    <button class="button accent" data-overview-running>Manage Running Orders</button></div>
    ${!sourceTurn()?'<p class="activities-warning">No planning turn selected. Import Results and select the current turn.</p>':''}
    ${!rows.length?'<p class="activities-note">No saved activities in this turn. Select a unit on the map and use its Activities Turn Action to create one.</p>':''}
    <div class="activities-overview-list">${rows.map(row=>`<div class="activities-overview-row">
      <strong>${esc(row.unit)}</strong><span>${esc(row.activityCode)} · ${whole(row.people)} workers</span>
      <small>${esc(row.target||'')}${row.generatedLocked?' · Locked override':''}</small>
      <button class="button" data-overview-unit="${esc(row.unit)}">Open unit</button>
    </div>`).join('')}</div>
    <p class="activities-note">This overview is turn-wide. Use the unit Turn Action for the three-menu editor; the Running Orders screen manages recurring Bills across units.</p>`;
}
function renderSkills(){
  if(!currentUnit())return '<p class="activities-warning">Select a unit on the Mapper to open its Activities Turn Action.</p>';
  if(!sourceTurn())return '<p class="activities-warning">No planning turn selected. Import Results or select a planning turn before allocating activities.</p>';
  const unit=currentUnit(),owner=resultUnit(ownerCode(unit))||unit;
  return `<div class="activities-toolbar"><strong>1. Select skill</strong><span>Each tile opens its activities</span></div>
    <div class="activities-filter-row"><label><input id="hideSkill" type="checkbox" ${ui.hideSkill?'checked':''}> Hide lacking skill</label><label><input id="hideInputs" type="checkbox" ${ui.hideInputs?'checked':''}> Hide lacking inputs</label></div>
    <div class="activities-grid">${skillList().filter(name=>
      !ui.hideSkill||name!=='Processing'||['Skinning','Gutting','Boning'].some(skill=>Number(skillLevel(unit,skill))>0))
      .filter(name=>!ui.hideInputs||name!=='Processing'||
        Object.keys(livestock.ANIMALS).some(animal=>livestock.stockCount(dataStock(owner),animal)>0))
      .map(name=>{
      const processing=name==='Processing',levels=processing?
        ['Skinning','Gutting','Boning'].map(skill=>skill[0]+esc(skillLevel(unit,skill))).join(' · '):esc(skillLevel(unit,name));
      const label=processing?'Skin/Gut/Bone':name;
      const missing=processing&&!['Skinning','Gutting','Boning'].some(skill=>Number(skillLevel(unit,skill))>0);
      return `<div class="activities-skill-wrap">
        <button class="activities-tile ${missing?'activities-tile-unavailable':''}" data-skill="${esc(name)}" title="Select ${esc(label)} · Skill levels ${levels}">
          <img class="activities-skill-icon" src="skill-icons/${processing?'skin-gut-bone':esc(name.toLowerCase())}.svg" alt="" />
          <span class="activities-name">${esc(label)}</span><span class="activities-level">${levels}</span>
        </button>${processing?`<div class="activities-related-skills">${['Skinning','Gutting','Boning'].map(skill=>compendiumLink('skill',skill,skill)).join('')}</div>`:compendiumLink('skill',name,name)}
      </div>`;
    }).join('')}</div>`;
}
function renderRecipes(){
  if(ui.skill==='Herding'){
    const unit=currentUnit(),stock=dataStock(unit),spent={};
    const herdOwner=unitCode(unit).toLowerCase();
    for(const row of ui.activities){
      const performer=resultUnit(row.unit);
      if(!performer||ownerCode(performer).toLowerCase()!==herdOwner)continue;
      const activity=livestock.activityKey(row.activityCode),animal=livestock.animalKey(row.target);
      if(!activity||!animal||!livestock.baseRate(activity,animal))continue;
      const knives=(row.implements||[]).filter(t=>String(t.name||'').toUpperCase()==='KNIFE')
        .reduce((n,t)=>n+whole(t.quantity),0);
      const available=Math.max(0,livestock.stockCount(stock,animal)-whole(spent[animal]));
      const savedStage=livestock.parseProcessingNote(row.notes);
      const result=savedStage
        ?livestock.processStages({activity,animal,workersBySkill:savedStage.workersBySkill,
          knivesBySkill:savedStage.knivesBySkill,animalsAvailable:Math.min(available,savedStage.animals)})
        :livestock.process({activity,animal,workers:row.people,knives,animalsAvailable:available});
      if(result)spent[animal]=(spent[animal]||0)+result.animals;
    }
    const herd=livestock.staffForHerd(stock,spent,{
      atSea:/^\d{4}f\d+$/i.test(ui.unit)&&['O','L'].includes(String(contextFor(unit).terrain||'').toUpperCase())
    });
    return `<div class="activities-toolbar"><strong>2. Herding — automatically allocated</strong><button class="button" data-go="skills">Back to skills</button></div>
      <p class="activities-note">Herding runs automatically for eligible units when a new turn is activated. It counts animals remaining after saved Gutting, Skinning and Boning orders, including combined processing.</p>
      <p class="activities-note">This unit: ${herd.workers} required herders · ${Object.entries(herd.animals).map(([animal,n])=>n+' '+animal).join(', ')||herd.reason||'No eligible animals'}.</p>
      <button class="button accent" id="applyAutoHerding">Recalculate this turn</button>
      <p class="activities-note">Only confirmed live-animal inventory is counted. Animals on ships at sea need no herders; unverified workers are flagged instead of invented.</p>`;
  }
  if(ui.skill==='Processing'){
    const codes=Object.keys(livestock.COMBINATIONS),stock=dataStock(resultUnit(ownerCode(currentUnit()))||currentUnit());
    return `<div class="activities-toolbar"><strong>2. Skin/Gut/Bone — processing choices</strong>
      <button class="button" data-go="skills">Back to skills</button></div>
      <div class="activities-filter-row">
        <label><input id="hideSkill" type="checkbox" ${ui.hideSkill?'checked':''}> Hide lacking skill</label>
        <label><input id="hideInputs" type="checkbox" ${ui.hideInputs?'checked':''}> Hide lacking inputs</label></div>
      <div class="activities-grid">${codes.filter(code=>{
        const parts=livestock.COMBINATIONS[code];
        const eligible=parts.every(skill=>Number(skillLevel(currentUnit(),skill))>=1);
        const stocked=Object.keys(livestock.ANIMALS).some(animal=>livestock.baseRate(code,animal)&&livestock.stockCount(stock,animal)>0);
        return (!ui.hideSkill||eligible)&&(!ui.hideInputs||stocked);
      }).map(code=>{
        const parts=livestock.COMBINATIONS[code];
        const eligible=parts.every(skill=>Number(skillLevel(currentUnit(),skill))>=1);
        const stocked=Object.keys(livestock.ANIMALS).some(animal=>livestock.baseRate(code,animal)&&livestock.stockCount(stock,animal)>0);
        const art=parts.length>1?'skin-gut-bone':parts[0].toLowerCase();
        return `<div class="activities-skill-wrap"><button class="activities-tile activity-recipe ${!eligible?'activities-tile-unavailable':!stocked?'activities-tile-missing-input':''}"
          data-recipe="${code}" title="${esc(livestock.EXPORT_CODES[code])} · ${!eligible?'Required skill missing':!stocked?'No applicable animals':'Available'}">
          <img class="activities-skill-icon" src="skill-icons/${esc(art)}.svg" alt="" />
          <span class="activities-name">${esc(livestock.EXPORT_CODES[code])}</span></button></div>`;
      }).join('')}</div>
      <p class="activities-note">Allocate each contributing skill separately. Combined processing slaughters animals once and credits all outputs.</p>`;
  }
  return `<div class="activities-toolbar"><strong>2. ${esc(ui.skill)} — available activities</strong>
    <button class="button" data-go="skills">Back to skills</button></div>
    <div class="activities-filter-row"><label><input id="hideSkill" type="checkbox" ${ui.hideSkill?'checked':''}> Hide lacking skill</label><label><input id="hideInputs" type="checkbox" ${ui.hideInputs?'checked':''}> Hide lacking inputs</label></div>
    <div class="activities-grid">
      <div class="activities-skill-wrap">
        <button class="activities-tile activity-recipe" data-recipe="HUNTING">
          <img class="activities-skill-icon" src="skill-icons/hunting.svg" alt="" />
          <span class="activities-name">Hunting</span><small>Produces Provisions · variable yield</small>
        </button>${compendiumLink('skill','Hunting','Hunting')}
      </div>
    </div>
    <section class="activities-outputs" aria-label="Hunting output">
      <strong>Produced item</strong>
      <div class="activities-output-item"><img src="item-icons/provisions.svg" alt="" />
        <span><strong>Provisions</strong><small>Workbook item: PROVS · available for end-of-turn consumption</small></span>
        ${compendiumLink('item','PROVS','Provisions')}
      </div>
    </section>`;
}

function sourceStock(){
  const unit=currentUnit();return dataStock(resultUnit(ownerCode(unit))||unit);
}
function reservedTools(){
  const owner=ownerCode(currentUnit()).toLowerCase(),reserved={};
  for(const row of ui.activities){
    if(row.id===ui.editingActivity)continue;
    const performer=resultUnit(row.unit);
    if(!performer||ownerCode(performer).toLowerCase()!==owner)continue;
    for(const t of row.implements||[]){
      const key=String(t.name||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
      if(key==='HUNTING DOG')continue;
      reserved[key]=(reserved[key]||0)+whole(t.quantity);
    }
    if(row.activityCode==='HUNTING'){
      const left=Math.max(0,engine.stockCount(sourceStock(),'Hunting Dog')-whole(reserved['HUNTING DOG']));
      reserved['HUNTING DOG']=(reserved['HUNTING DOG']||0)+Math.min(whole(row.people),left);
    }
  }
  return reserved;
}
function toolsAvailable(){
  const stock=sourceStock(),reserved=reservedTools();
  const names=engine.TOOLS.map(t=>t.name);
  return names.map(name=>{
    const total=engine.stockCount(stock,name),key=name.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
    const inUse=reserved[key]||0;
    return {name,total,reserved:inUse,available:Math.max(0,total-inUse)};
  }).filter(t=>t.total>0);
}
function toolsTable(){
  const selected=ui.toolsCustomized?ui.selectedTools:engine.optimizeTools(ui.workers,sourceStock(),reservedTools()).implements;
  const amounts=new Map(selected.map(t=>[t.name,whole(t.quantity)]));
  const rows=toolsAvailable();
  if(!rows.length)return '<p class="activities-note">No Hunting implements confirmed in the effective inventory pool.</p>';
  return `<div class="activities-tools-grid">
    <span>Implement</span><span>Owned / reserved</span><span>Selected</span>
    ${rows.map(t=>`<label>${esc(t.name)}</label><small>${t.total} / ${t.reserved}</small>
      <input data-tool-item="${esc(t.name)}" aria-label="${esc(t.name)} quantity"
        type="number" min="0" step="1" max="${t.available}" value="${amounts.get(t.name)||0}">`).join('')}
  </div>`;
}
function validateOneTurn(){
  const total=availableWorkers(currentUnit());
  const other=ui.activities.filter(row=>String(row.unit||'').toLowerCase()===ui.unit.toLowerCase()&&row.id!==ui.editingActivity)
    .reduce((n,row)=>n+whole(row.people),0);
  if(total===null)throw Error('Worker total unavailable; cannot validate this order.');
  if(ui.workers+other>total)throw Error(`Not enough workers: ${ui.workers} hunters plus ${other} existing activity workers exceeds ${total} available.`);
  const selected=preview().tools;
  const stock=toolsAvailable();
  let primarySlots=0;
  for(const tool of selected){
    const row=stock.find(t=>t.name===tool.name);
    if(!row||whole(tool.quantity)>row.available)throw Error(`${tool.name} is over-allocated across saved activities in the shared Goods Tribe stock.`);
    const eligible=engine.TOOLS.find(t=>t.name===tool.name);
    const cap=(eligible?.max||1)*whole(ui.workers);
    if(whole(tool.quantity)>cap)throw Error(`${tool.name} exceeds the ${cap}-item Hunting workforce limit.`);
    primarySlots+=Math.ceil(whole(tool.quantity)/(eligible?.max||1));
  }
  if(primarySlots>ui.workers)throw Error(`Hunting implements need ${primarySlots} primary equipment slots, but only ${ui.workers} hunters are allocated. Select one primary set per hunter.`);
}
function preview(){
  const unit=currentUnit();
  const context=contextFor(unit);
  const workers=whole(ui.workers);
  const tools=ui.toolsCustomized?ui.selectedTools:engine.optimizeTools(workers,sourceStock(),reservedTools()).implements;
  const huntingDogs=engine.supportDogs(workers,sourceStock(),reservedTools());
  const am=workers+tools.reduce((v,t)=>{const def=engine.TOOLS.find(x=>x.name===t.name);
    return v+whole(t.quantity)*(def?.bonus||0);},0)+huntingDogs*2;
  const range=context.skill===null?null:engine.forecast({workers,effectiveAM:am,skill:context.skill,terrain:context.terrain,month:context.month,waterBorders:context.waterBorders});
  return {workers,range,tools,context,huntingDogs};
}
function processingSkillCaps(unit,activity){
  const parts=livestock.COMBINATIONS[livestock.activityKey(activity)]||[];
  const tribe=rootCode(unitCode(unit)),caps={};
  for(const skill of parts){
    const level=Number(skillLevel(unit,skill));
    const used=ui.activities.filter(row=>rootCode(row.unit)===tribe&&row.id!==ui.editingActivity
      &&livestock.COMBINATIONS[livestock.activityKey(row.activityCode)]?.includes(skill))
      .reduce((sum,row)=>{
        const detail=livestock.parseProcessingNote(row.notes);
        return sum+(detail?whole(detail.workersBySkill[skill]):whole(row.people));
      },0);
    caps[skill]=Number.isFinite(level)?Math.max(0,livestock.capForLevel(level)-used):0;
  }
  return caps;
}
function processingFreeWorkers(unit){
  const n=availableWorkers(unit);
  if(n===null)return null;
  const assigned=ui.activities.filter(row=>String(row.unit).toLowerCase()===ui.unit.toLowerCase()
    &&row.id!==ui.editingActivity&&row.activityCode!=='HERDING')
    .reduce((n,row)=>n+whole(row.people),0);
  return Math.max(0,n-assigned);
}
function processingPreview(){
  const unit=currentUnit(),pool=ownerCode(unit),stock=sourceStock(),code=livestock.activityKey(ui.activityCode);
  const animal=livestock.animalKey(ui.animal);
  const used=ui.activities.filter(row=>row.id!==ui.editingActivity
    &&livestock.animalKey(row.target)===animal
    &&livestock.activityKey(row.activityCode)
    &&ownerCode(resultUnit(row.unit)||{unitCode:row.unit}).toLowerCase()===pool.toLowerCase())
    .reduce((n,row)=>{
      const detail=livestock.parseProcessingNote(row.notes);
      const count=detail?detail.animals:(livestock.process({activity:row.activityCode,animal,
        workers:row.people,knives:(row.implements||[]).filter(t=>String(t.name||'').toUpperCase()==='KNIFE')
          .reduce((a,t)=>a+whole(t.quantity),0)})?.animals||0);
      return n+count;
    },0);
  const reservedKnives=ui.activities.filter(row=>row.id!==ui.editingActivity
    &&ownerCode(resultUnit(row.unit)||{unitCode:row.unit}).toLowerCase()===pool.toLowerCase())
    .reduce((n,row)=>n+(row.implements||[]).filter(t=>String(t.name||'').toUpperCase()==='KNIFE')
      .reduce((a,t)=>a+whole(t.quantity),0),0);
  const animals=Math.max(0,livestock.stockCount(stock,animal)-used);
  const knifeAvailable=Math.max(0,livestock.stockCount(stock,'KNIFE')-reservedKnives);
  const caps=processingSkillCaps(unit,code),freeWorkers=processingFreeWorkers(unit);
  const running=ui.mode==='running';
  const goal=running&&ui.goal==='stock'
    ?Math.max(0,whole(ui.goalQuantity)-livestock.stockCount(stock,ui.goalItem))
    :Infinity;
  const result=running?livestock.allocateStages({activity:code,animal,
    workersAvailable:freeWorkers??0,skillCaps:caps,
    knivesAvailable:knifeAvailable,animalsAvailable:animals,need:goal,goalItem:ui.goalItem})
    :livestock.processStages({activity:code,animal,workersBySkill:ui.workersBySkill,
      knivesBySkill:ui.knivesBySkill,animalsAvailable:animals});
  return {stock,animals,knifeAvailable,caps,freeWorkers,result};
}
function renderProcessingAllocate(){
  const unit=currentUnit();
  if(!unit)return '<p class="activities-warning">Select a unit to allocate processing.</p>';
  const code=livestock.activityKey(ui.activityCode),parts=livestock.COMBINATIONS[code]||[];
  const possible=Object.keys(livestock.ANIMALS).filter(animal=>livestock.baseRate(code,animal)>0);
  if(!possible.includes(ui.animal))ui.animal=possible[0]||'GOAT';
  const outputChoices=Object.keys(livestock.produce(code,ui.animal,1)?.outputs||{}).filter(item=>item!=='PROVS');
  if(!outputChoices.includes(ui.goalItem))ui.goalItem=outputChoices[0]||'GUT';
  const p=processingPreview(),running=ui.mode==='running',max=availableWorkers(unit);
  const staff=p.result?.workersBySkill||{},knives=p.result?.knivesBySkill||{};
  const assigned=ui.activities.filter(row=>String(row.unit).toLowerCase()===ui.unit.toLowerCase());
  const fields=parts.map(skill=>`<div class="activities-processing-skill">
    <strong>${esc(skill)}</strong><span>Level ${esc(skillLevel(unit,skill))} · Remaining shared cap ${p.caps[skill]===Infinity?'Unlimited':display(p.caps[skill])}</span>
    ${running?`<strong>${whole(staff[skill])} workers · ${whole(knives[skill])} Knives</strong>`:
      `<label>Workers <input data-process-worker="${skill}" type="number" min="0" step="1"
        max="${Math.min(p.freeWorkers??0,p.caps[skill])}" value="${whole(ui.workersBySkill[skill])}"></label>
      <label>Knives <input data-process-knife="${skill}" type="number" min="0" step="1"
        value="${whole(ui.knivesBySkill[skill])}"></label>`}
  </div>`).join('');
  return `<div class="activities-editor-grid">
    <div class="activities-editor">
      <div class="activities-toolbar"><strong>3. Allocate ${esc(livestock.EXPORT_CODES[code]||code)}</strong>
        <button class="button" data-go="recipes">Back to Activities</button></div>
      <p class="activities-note">Unit ${esc(ui.unit)} · Goods Tribe ${esc(ownerCode(unit))} ·
        ${display(max)} workers available before saved activities ·
        ${display(p.freeWorkers)} remaining after other saved non-Herding assignments.</p>
      <div class="activities-fields">
        <label>Order type<select id="processOrderType">
          <option value="once" ${!running?'selected':''}>One Turn</option>
          <option value="running" ${running?'selected':''}>Running Order</option></select></label>
        <label>Animal<select id="processAnimal">${possible.map(animal=>`<option value="${animal}" ${ui.animal===animal?'selected':''}>${esc(animal)}</option>`).join('')}</select></label>
      </div>
      ${running?`<div class="activities-fields">
        <label>Goal<select id="processGoal">
          <option value="maximise" ${ui.goal==='maximise'?'selected':''}>Maximise</option>
          <option value="stock" ${ui.goal==='stock'?'selected':''}>Maintain Stock</option></select></label>
        ${ui.goal==='stock'?`<label>Output<select id="processGoalItem">
          ${outputChoices.map(item=>`<option value="${item}" ${ui.goalItem===item?'selected':''}>${esc(item)}</option>`).join('')}
          </select></label><label>Stock target<input id="processQuantity" type="number" min="0" step="1" value="${whole(ui.goalQuantity)}"></label>`:''}</div>
        <p class="activities-note">This Running Order automatically allocates each component's staff independently, honoring its own skill level and other reserved workers when applied in priority order.</p>`:
        `<div class="activities-actions">
          <button class="button" id="processMaximise">Maximise processing</button>
          <button class="button" id="processAutoKnives">Auto Allocate Tools</button></div>
        <p class="activities-note">Specify separate workers for each skill. One Knife can double one worker's throughput for that skill.</p>`}
      <div class="activities-processing-stages">${fields}</div>
      <section class="activities-yield"><small>${esc(ui.animal)} · START-OF-TURN INVENTORY</small>
        <strong>${display(p.animals)} available animals</strong>
        <span>${display(p.result?.animals||0)} processed once ·
          ${display(p.result?.workers||0)} total workers · ${display(p.result?.knives||0)} Knives</span>
        <strong>${Object.entries(p.result?.outputs||{}).map(([item,n])=>display(n)+' '+esc(item)).join(' · ')||'No processing output'}</strong></section>
      <p class="activities-note">A combined order counts against each contributing skill's workforce limit.
        Its workers are distinct people and its animals are consumed only once.</p>
      <p class="activities-warning">Workbook compatibility needs confirmation: a combined activity has only one PEOPLE column.
        The individual Skinning, Gutting and Boning worker counts are saved in the GM notes. Please review the exported workbook;
        the game's interpretation of an unequal split has not been verified.</p>
      <div class="activities-actions"><button class="button accent" id="processSave">${ui.editing?'Update Running Order':running?'Save Running Order':'Save One Turn Activity'}</button>
        <button class="button" data-go="recipes">Cancel</button></div>
    </div>
    <aside class="activities-saved">
      <h3>Saved Activities · ${assigned.length}</h3>
      <p class="activities-note">Assigned ${assigned.reduce((n,row)=>n+whole(row.people),0)} / ${display(max)} workers</p>
      ${assigned.map(row=>`<div class="activities-saved-row"><strong>${esc(row.activityCode)}</strong>
        <span>${display(row.people)} workers · ${esc(row.target||'')}</span>
        <small>${esc(row.notes||'')}${row.generatedBillId?' · Running-generated':row.activityCode==='HERDING'?' · Herding':' · One Turn'}</small>
        <div class="activities-bill-buttons">
          ${row.generatedBillId?`<button data-edit="${row.generatedBillId}">Edit Running Order</button><button data-skip="${row.generatedBillId}">Skip turn</button>`:
          livestock.activityKey(row.activityCode)?`<button data-edit-activity="${row.id}">Edit</button><button data-remove-activity="${row.id}">Remove</button>`:
          '<span>Managed elsewhere</span>'}
        </div></div>`).join('')||'<p>No saved activities for this turn.</p>'}
    </aside>
  </div>`;
}
async function saveProcessing(){
  if(!currentUnit())throw Error('No selected unit.');
  const code=livestock.activityKey(ui.activityCode),animal=livestock.animalKey(ui.animal),parts=livestock.COMBINATIONS[code]||[];
  if(!code||!livestock.baseRate(code,animal))throw Error('Choose a valid animal processing combination.');
  if(ui.mode==='running'){
    const saved=await window.tribenet.saveActivityBill({id:ui.editing,unit:ui.unit,
      skill:'PROCESSING',activityCode:code,animal,mode:ui.goal==='stock'?'stock':'maximise',
      goalItem:ui.goalItem,quantity:whole(ui.goalQuantity)});
    ui.editing=saved.id;
    ui.otherStatuses=await applyBills();
    ui.status='Processing Running Order saved. Current turn and Herding recalculated.';
    await refreshAll();return;
  }
  const p=processingPreview();
  if(p.freeWorkers===null)throw Error('Worker inventory has not been verified.');
  const workersBySkill=Object.fromEntries(parts.map(skill=>[skill,whole(ui.workersBySkill[skill])]));
  const knivesBySkill=Object.fromEntries(parts.map(skill=>[skill,whole(ui.knivesBySkill[skill])]));
  if(parts.some(skill=>workersBySkill[skill]<1))throw Error('Assign at least one worker to each selected processing skill.');
  if(parts.some(skill=>workersBySkill[skill]>p.caps[skill]))
    throw Error('Processing exceeds an individual skill cap shared across Tribe and Elements.');
  if(parts.some(skill=>knivesBySkill[skill]>workersBySkill[skill]))
    throw Error('Knives exceed the number of workers assigned to a processing skill.');
  const result=p.result;
  if(result.workers>p.freeWorkers)throw Error('Processing workers exceed people available after existing activities.');
  if(result.knives>p.knifeAvailable)throw Error('Knives are over-allocated within the shared Goods Tribe.');
  if(result.animals<=0)throw Error('No unallocated animals available for this processing activity.');
  const order={unit:ui.unit,activityCode:code,people:result.workers,
    target:animal,distinction:'NONE',notes:livestock.processingNote(result),
    implements:result.knives?[{name:'KNIFE',quantity:result.knives}]:[]};
  if(ui.editingActivity!==null)await window.tribenet.updatePlannedActivity(ui.editingActivity,order);
  else await window.tribenet.addPlannedActivity(sourceTurn(),order);
  ui.editingActivity=null;
  try{
    ui.otherStatuses=await applyBills();
    const issues=ui.otherStatuses.filter(x=>x.skill==='HERDING'&&String(x.status).startsWith('Needs review'));
    ui.status=issues.length
      ?'Processing saved. Herding needs review: '+issues.map(x=>x.unit+' — '+x.status).join('; ')
      :'Processing saved. Automatic Herding recalculated for surviving animals. Re-export Orders when ready.';
  }catch(error){
    ui.status='Processing saved, but automatic Herding recalculation needs review: '+(error.message||String(error));
  }
  await refreshAll();
}
function renderAllocate(){
  if(ui.skill!=='Hunting')return renderProcessingAllocate();
  const unit=currentUnit(),ctx=contextFor(unit),max=availableWorkers(unit)||0;
  const running=ui.mode==='running';
  const p=preview();
  const goods=Boolean(ctx.goodsTribe);
  const ratio=r=>Number.isFinite(Number(r))?Number(r):0;
  return `<div class="activities-editor-grid">
    <div class="activities-editor">
      <div class="activities-toolbar"><strong>3. Allocate Hunting</strong><button class="button" data-go="recipes">Back</button></div>
      <div class="activities-fields">
        <label>Order type<select id="huntOrderType"><option value="running" ${running?'selected':''}>Running Bill</option>
          <option value="once" ${!running?'selected':''}>One Turn</option></select></label>
        <label>Hunters assigned<input id="huntWorkers" type="number" min="0" max="${max}" value="${ui.workers}"></label>
        <input id="huntWorkersSlider" type="range" min="0" max="${max}" value="${ui.workers}" aria-label="Hunters assigned">
      </div>
      <p class="activities-note">${max} possible Actives/Warriors before saved commitments. Hunting allowed at level 0; actual allocation is validated against other orders.</p>
      <p class="activities-note">Start terrain: ${esc(ctx.terrain||'unknown')} · Hunting level: ${esc(ctx.skill??'?')} · Inventory owner: ${esc(ownerCode(unit))} · Turn: ${esc(sourceTurn())}</p>
      <p id="huntGoalHint" class="activities-goal-hint">${esc(ui.goalHint)}</p>
      ${running?`<div class="activities-fields">
        <label>Goal<select id="huntGoal"><option value="months" ${ui.goal!=='maximise'?'selected':''}>Maintain months after eating</option><option value="maximise" ${ui.goal==='maximise'?'selected':''}>Maximise</option></select></label>
        <label>Months after consumption<input id="huntMonths" type="number" min="0" max="120" step=".5" value="${ui.months}"></label>
        <label>Yield basis<select id="huntYield"><option value="optimistic" ${ui.yieldMode==='optimistic'?'selected':''}>Optimistic</option><option value="average" ${ui.yieldMode==='average'?'selected':''}>Average</option><option value="conservative" ${ui.yieldMode==='conservative'?'selected':''}>Conservative</option></select></label>
      </div><label class="activities-check"><input type="checkbox" id="huntLimitToggle" ${ui.loadEnabled?'checked':''} ${goods?'disabled':''}> Limit movement weight to a percentage of capacity</label>
      <label class="activities-weight-input">Max load (%) <input id="huntLoad" type="number" min="1" max="100" value="${ui.loadPercent}" ${goods?'disabled':''}></label>
      ${goods?'<p class="activities-warning">Weight limit disabled: this unit uses a Goods Tribe. The shared Goods Tribe stock cannot use automatic same-unit retention.</p>':''}`:''}
      <div class="activities-tools-title"><strong>IMPLEMENTS / TOOLS</strong>
      <button class="button" id="huntAutoTools">Auto Allocate Tools</button></div>
      <p class="activities-note">Running Bills automatically allocate available implements each turn, with shared Goods Tribe stock assigned by priority.</p>
      <div id="huntToolsEditor">${toolsTable()}</div>
      <div class="activities-tool-list" id="huntToolsList">${p.tools.length?p.tools.map(t=>`<span>${esc(t.name)}</span><strong>× ${whole(t.quantity)}</strong>`).join(''):'No eligible tools allocated'}</div>
      <section class="activities-outputs"><div class="activities-output-item"><img src="item-icons/provisions.svg" alt="" /><span><strong>Provisions</strong><small>Output destination: ${esc(ownerCode(unit))} · forecast only</small></span>${compendiumLink('item','PROVS','Provisions')}</div></section>
      <p class="activities-note">Hunting Dogs are counted as animal support where available, but are never exported in implement slots.</p>
      <p class="activities-note">Crossbow, Horse Bow, Longbow and Spear Steel can be ordered; their unknown yield bonuses are not included in forecasts.</p>
      <section class="activities-yield"><small>EXPECTED PROVISIONS (WEATHER RANGE)</small>
        <strong id="huntYieldRange">${p.range?`${display(p.range.min)} – ${display(p.range.max)} Provisions`:'Unknown terrain / calculator rate'}</strong>
        <span id="huntYieldDetail">${p.range?`Fine weather: ${display(p.range.fine)} · Scenario average: ${display(p.range.average)}`:'Verify the unit’s start-of-turn terrain before saving a forecast.'}</span>
      </section>
      <div class="activities-actions"><button class="button accent" id="huntSave">${ui.editing?'Update Running Bill':running?'Save Running Bill':'Save One Turn Activity'}</button>
       <button class="button" data-go="recipes">Cancel</button></div>
    </div>
    <aside class="activities-saved">
      <h3>Saved Activities · ${ui.activities.filter(row=>String(row.unit).toLowerCase()===ui.unit.toLowerCase()).length}</h3>
      <p class="activities-note">Assigned ${ui.activities.filter(r=>String(r.unit).toLowerCase()===ui.unit.toLowerCase()).reduce((n,r)=>n+whole(r.people),0)} / ${display(availableWorkers(unit))} available workers</p>
      <button class="button" data-saved-expand>${ui.showSavedAll?'Collapse Saved Activities':'View All / Expand'}</button>
      ${ui.activities.filter(row=>String(row.unit).toLowerCase()===ui.unit.toLowerCase()).map(row=>`<div class="activities-saved-row"><strong>${esc(row.activityCode)}</strong>
        <span>${whole(row.people)} workers · ${row.generatedBillId?'Running-generated':row.generatedLocked?'Manual override':'One Turn / manual'}</span>
        <small>Tools: ${row.implements?.length?row.implements.map(t=>esc(t.name)+' ×'+whole(t.quantity)).join(', '):'none'}</small>
        ${ui.showSavedAll?`<small>Turn ${esc(row.turnKey)} · target ${esc(row.target||'—')} · ${row.generatedLocked?'locked override':'draft'}</small>`:''}
        <div class="activities-bill-buttons">
          ${row.generatedBillId?
            `<button data-edit="${row.generatedBillId}">Edit Running Order</button><button data-skip="${row.generatedBillId}">Skip this turn</button>`:
            `${row.activityCode==='HUNTING'?`<button data-edit-activity="${row.id}">Edit</button>`:'<span>Legacy · read-only</span>'}
              <button data-remove-activity="${row.id}">Remove</button>`}</div>
      </div>`).join('')||'<p>No saved activities for this unit/turn.</p>'}
      <button class="button" id="huntViewOrders">Open Tribe Activities overview</button>
    </aside>
  </div>`;
}
function renderManager(){
  const selected=ui.bills.filter(b=>(ui.managerUnit==='all'||b.unit===ui.managerUnit)&&
    (ui.managerState==='all'||(ui.managerState==='paused'?b.paused:ui.managerState==='active'?!b.paused:
      (ui.otherStatuses.find(x=>x.id===b.id)?.status||'').toLowerCase().includes('review'))));
  const active=ui.bills.filter(b=>!b.paused).length,paused=ui.bills.filter(b=>b.paused).length;
  return `<div class="activities-toolbar"><strong>Running Orders — highest priority first</strong>
    <button class="button" data-go="skills">New activity</button><button class="button accent" id="huntApply">Recalculate this turn</button></div>
    <p class="activities-note">${ui.bills.length} total · ${active} active · ${paused} paused. Forecasts are not confirmed Results. Manual locked rows remain protected.</p>
    <div class="activities-filter-row"><label>Unit <select id="managerUnit">
      <option value="all">All units</option>
      ${[...new Set(ui.bills.map(b=>b.unit))].map(u=>`<option value="${esc(u)}" ${ui.managerUnit===u?'selected':''}>${esc(u)}</option>`).join('')}
    </select></label><label>State <select id="managerState">
      ${[['all','All states'],['active','Active'],['paused','Paused'],['review','Needs review']].map(([key,label])=>
        `<option value="${key}" ${ui.managerState===key?'selected':''}>${label}</option>`).join('')}
    </select></label></div>
    <div class="activities-bills">${selected.length?selected.map((b,i)=>{
      const preview=ui.otherStatuses.find(x=>x.id===b.id);
      return `<div class="activities-bill">
        <strong>#${ui.bills.findIndex(x=>x.id===b.id)+1} · ${esc(b.unit)} · ${esc(b.skill||'HUNTING')} ${b.skill==='HUNTING'?'':esc(livestock.EXPORT_CODES[b.activityCode]||b.activityCode||'')}</strong>
        <span>${b.mode==='maximise'?'Maximise':b.mode==='stock'?`Maintain ${display(b.quantity)} ${esc(b.goalItem)}`:`Keep ${b.months} months after eating`} ${b.skill==='HUNTING'?' · '+esc(b.yieldMode):' · '+esc(b.animal)}</span>
        <small>${b.loadPercent==null?'No weight limit':`Max ${b.loadPercent}% capacity`} · ${b.paused?'Paused':esc(preview?.status||'Active / awaiting recalculation')}</small>
        <div class="activities-bill-buttons">
         <button data-up="${b.id}" ${ui.bills.findIndex(x=>x.id===b.id)===0?'disabled':''} title="Increase priority">↑</button>
         <button data-down="${b.id}" ${ui.bills.findIndex(x=>x.id===b.id)===ui.bills.length-1?'disabled':''} title="Decrease priority">↓</button>
         <button data-edit="${b.id}">Edit</button>
         <button data-skip="${b.id}">Skip turn</button>
         <button data-reset="${b.id}">Reset turn</button>
         <button data-pause="${b.id}">${b.paused?'Resume':'Pause'}</button>
         <button data-remove="${b.id}">Delete</button>
        </div></div>`;
    }).join(''):'<p>No Running Orders match this filter, or none have been created.</p>'}</div>`;
}
async function refreshAll(){
  await load();render();
  if(state?.selectedUnit&&typeof window.renderSelectedUnitPanel==='function')window.renderSelectedUnitPanel(state.selectedUnit);
}
async function save(){
  if(ui.skill!=='Hunting')return saveProcessing();
  const unit=currentUnit();if(!unit)throw Error('No unit is selected.');
  const workers=whole(ui.workers);
  if(ui.mode==='once')validateOneTurn();
  if(ui.mode==='once'){
    if(!workers)throw Error('Select at least one hunter.');
    if(!preview().range)throw Error('Hunting terrain and turn month are unverified; cannot save an unvalidated forecast.');
    const order={unit:ui.unit,activityCode:'HUNTING',people:workers,
      target:'PROVS',distinction:'NONE',implements:preview().tools};
    if(ui.editingActivity!==null)await window.tribenet.updatePlannedActivity(ui.editingActivity,order);
    else await window.tribenet.addPlannedActivity(sourceTurn(),order);
    ui.editingActivity=null;
  }else{
    const goods=ownerCode(unit)!==unitCode(unit);
    const loadOn=ui.loadEnabled&&!goods;
    const bill=await window.tribenet.saveActivityBill({id:ui.editing,unit:ui.unit,
      mode:ui.goal,months:Number(ui.months),
      yieldMode:ui.yieldMode,loadPercent:loadOn?Number(ui.loadPercent):null});
    ui.editing=bill.id;
    // A saved Bill is not lost just because current-turn context is incomplete.
    try{ui.otherStatuses=await applyBills();}
    catch(error){
      ui.status='Running Bill saved, but its current-turn allocation needs review: '+(error.message||String(error));
      await refreshAll();
      return;
    }
  }
  ui.status='Saved in Mapper. Re-export Orders when ready; saved data is not cleared.';
  await refreshAll();
}
async function applyBills(){
  if(!sourceTurn())throw Error('No planning turn.');
  const contexts=contextList();
  // Enrich the baseline with currently planned BM changes and fail closed on
  // unknown non-Hunting production weights.
  const [rows,transfers]=await Promise.all([
    window.tribenet.listPlannedActivities(sourceTurn()),
    window.tribenet.listPlannedTransfers(sourceTurn())
  ]);
  const weightFor=name=>{
    if(/^(provs|provisions)$/i.test(String(name)))return 1;
    const item=(window.TribeNetOrdersReferenceRaw?.goods||[]).find(x=>String(x.name||x.rawName).toLowerCase()===String(name).toLowerCase());
    return num(item?.weight??item?.weightLb);
  };
  for(const ctx of contexts){
    let additional=0,unknown=false;
    for(const row of rows.filter(r=>r.unit?.toLowerCase()===ctx.code.toLowerCase())){
      if(row.activityCode!=='HUNTING'&&whole(row.people)>0)unknown=true;
    }
    for(const transfer of transfers.filter(r=>r.timing==='BM'&&r.from?.toLowerCase()!==r.to?.toLowerCase())){
      const qty=whole(transfer.quantity);
      const delta=String(transfer.to).toLowerCase()===ctx.code.toLowerCase()?qty:
        String(transfer.from).toLowerCase()===ctx.code.toLowerCase()?-qty:0;
      if(!delta)continue;
      const itemWeight=weightFor(transfer.item);
      if(itemWeight===null){unknown=true;continue;}
      if(!/^(provs|provisions)$/i.test(transfer.item))additional+=delta*itemWeight;
    }
    ctx.otherMaxWeight=unknown||ctx.otherMaxWeight===null?null:Math.max(0,ctx.otherMaxWeight+additional);
  }
  return window.tribenet.applyActivityBills(sourceTurn(),contexts);
}
async function handleClick(event){
  const b=event.target.closest('button');if(!b)return;
  try{
    if(b.dataset.overviewUnit){return open(b.dataset.overviewUnit);}
    if(b.hasAttribute('data-overview-running')){ui.page='manager';render();return;}
    if(b.dataset.compendiumEntry){await openCompendium(b.dataset.compendiumEntry,b.dataset.compendiumKey);return;}
    if(b.dataset.go){ui.page=b.dataset.go;render();return;}
    if(b.dataset.skill){ui.skill=b.dataset.skill;ui.page='recipes';render();return;}
    if(b.dataset.recipe){
      ui.activityCode=b.dataset.recipe;ui.page='allocate';ui.editing=null;ui.editingActivity=null;ui.mode='once';resetBillSettings();
      ui.workers=ui.skill==='Hunting'?Math.min(10,availableWorkers(currentUnit())||0):0;
      const parts=livestock.COMBINATIONS[livestock.activityKey(ui.activityCode)]||[];
      ui.workersBySkill=Object.fromEntries(parts.map(skill=>[skill,1]));
      ui.knivesBySkill=Object.fromEntries(parts.map(skill=>[skill,0]));
      ui.knives=0;ui.animal='GOAT';ui.goal='maximise';ui.goalItem=livestock.primaryOutput(ui.activityCode)||'GUT';
      ui.goalQuantity=0;ui.selectedTools=[];ui.toolsCustomized=false;render();return;
    }
    if(b.id==='applyAutoHerding'){ui.otherStatuses=await applyBills();ui.status='Automatic Herding orders recalculated.';await refreshAll();return;}
    if(b.id==='processMaximise'){
      const p=processingPreview();
      const result=livestock.allocateStages({activity:ui.activityCode,animal:ui.animal,
        workersAvailable:p.freeWorkers??0,skillCaps:p.caps,
        knivesAvailable:p.knifeAvailable,animalsAvailable:p.animals});
      if(!result||!result.animals)throw Error('No eligible workers or animals available for the selected combination.');
      ui.workersBySkill={...result.workersBySkill};ui.knivesBySkill={...result.knivesBySkill};
      ui.status='Maximise allocated '+result.workers+' workers across '+Object.keys(result.workersBySkill).length+
        ' skills for '+result.animals+' animals.';render();return;
    }
    if(b.id==='processAutoKnives'){
      const p=processingPreview(),parts=livestock.COMBINATIONS[livestock.activityKey(ui.activityCode)]||[];
      const chosen=Object.fromEntries(parts.map(skill=>[skill,0]));
      let remaining=p.knifeAvailable;
      while(remaining>0){
        const current=livestock.processStages({activity:ui.activityCode,animal:ui.animal,
          workersBySkill:ui.workersBySkill,knivesBySkill:chosen,animalsAvailable:p.animals});
        const before=current?.capacity||0;
        const options=parts.filter(skill=>whole(chosen[skill])<whole(ui.workersBySkill[skill]))
          .map(skill=>{
            const trial={...chosen,[skill]:chosen[skill]+1};
            const after=livestock.processStages({activity:ui.activityCode,animal:ui.animal,
              workersBySkill:ui.workersBySkill,knivesBySkill:trial,animalsAvailable:p.animals})?.capacity||0;
            return {skill,gain:after-before};
          }).sort((a,b)=>b.gain-a.gain);
        if(!options.length||options[0].gain<=0)break;
        chosen[options[0].skill]++;remaining--;
      }
      ui.knivesBySkill=chosen;ui.status='Optimal available Knives selected for current stage workers.';render();return;
    }
    if(b.id==='processSave'){await saveProcessing();return;}
    if(b.id==='huntAutoTools'){
      if(ui.toolsCustomized&&!window.confirm('Replace your unsaved tool selection with the available recommended implements?'))return;
      ui.selectedTools=engine.optimizeTools(ui.workers,sourceStock(),reservedTools()).implements;
      ui.toolsCustomized=true;ui.status='Tool suggestion prepared for your review. Nothing is saved until you select Save.';render();return;
    }
    if(b.id==='huntSave'){await save();return;}
    if(b.id==='huntApply'){ui.otherStatuses=await applyBills();ui.status='Generated Running Order and Herding allocations refreshed in the Mapper draft.';await refreshAll();return;}
    if(b.hasAttribute('data-saved-expand')){ui.showSavedAll=!ui.showSavedAll;render();return;}
    if(b.dataset.skip){
      if(!window.confirm('Skip this Running Order for the current turn? This removes only its generated draft and any linked retention Transfer. The persistent Bill remains.'))return;
      await window.tribenet.skipActivityBill(Number(b.dataset.skip),sourceTurn());
      ui.otherStatuses=await applyBills();ui.status='Bill skipped for this turn; it will resume on future turns.';await refreshAll();return;
    }
    if(b.dataset.reset){
      await window.tribenet.resetActivityBill(Number(b.dataset.reset),sourceTurn());
      ui.otherStatuses=await applyBills();ui.status='Current-turn Bill restored.';await refreshAll();return;
    }
    if(b.dataset.editActivity){const row=ui.activities.find(x=>x.id===Number(b.dataset.editActivity));
      if(!row)return;
      ui.editing=null;ui.editingActivity=row.id;ui.unit=row.unit;ui.page='allocate';ui.mode='once';
      ui.activityCode=livestock.activityKey(row.activityCode)||'HUNTING';
      ui.skill=ui.activityCode==='HUNTING'?'Hunting':'Processing';
      ui.animal=livestock.animalKey(row.target)||'GOAT';
      const savedStage=livestock.parseProcessingNote(row.notes);
      const parts=livestock.COMBINATIONS[ui.activityCode]||[];
      ui.workersBySkill=Object.fromEntries(parts.map(skill=>[skill,savedStage?whole(savedStage.workersBySkill[skill]):whole(row.people)]));
      ui.knivesBySkill=Object.fromEntries(parts.map(skill=>[skill,savedStage?whole(savedStage.knivesBySkill[skill]):0]));
      ui.knives=(row.implements||[]).filter(t=>String(t.name||'').toUpperCase()==='KNIFE').reduce((n,t)=>n+whole(t.quantity),0);
      ui.goalItem=livestock.primaryOutput(ui.activityCode)||'GUT';
      ui.workers=whole(row.people);ui.selectedTools=Array.isArray(row.implements)?row.implements:[];ui.toolsCustomized=true;render();return;}
    if(b.dataset.removeActivity){
      if(!window.confirm('Remove this saved activity for the turn? Running Bills may regenerate their own drafts when applied again.'))return;
      await window.tribenet.deletePlannedActivity(Number(b.dataset.removeActivity));
      try{
        ui.otherStatuses=await applyBills();
        const issues=ui.otherStatuses.filter(x=>x.skill==='HERDING'&&String(x.status).startsWith('Needs review'));
        ui.status=issues.length
          ?'Activity removed. Herding needs review: '+issues.map(x=>x.unit+' — '+x.status).join('; ')
          :'Activity removed. Automatic Herding recalculated for the remaining live animals.';
      }catch(error){
        ui.status='Activity removed, but automatic Herding recalculation needs review: '+(error.message||String(error));
      }
      await refreshAll();return;}
    if(b.id==='huntViewOrders'){const button=document.querySelector('#orderSheetMenu [data-order-sheet="activities"]');$('activitiesDialog').close();button?.click();return;}
    if(b.dataset.edit){const bill=ui.bills.find(x=>x.id===Number(b.dataset.edit));if(!bill)return;
      ui.unit=bill.unit;ui.editing=bill.id;ui.editingActivity=null;ui.mode='running';ui.page='allocate';ui.selectedTools=[];resetBillSettings(bill);
      ui.skill=bill.skill==='HUNTING'?'Hunting':'Processing';
      ui.activityCode=bill.activityCode||bill.skill;ui.animal=bill.animal||'GOAT';ui.goalItem=bill.goalItem||livestock.primaryOutput(ui.activityCode)||'GUT';ui.goalQuantity=whole(bill.quantity);
      ui.goal=bill.mode;ui.knives=0;if(ui.skill==='Hunting')autofillHunters();else ui.workers=1;render();return;}
    if(b.dataset.up||b.dataset.down){
      ui.bills=await window.tribenet.moveActivityBill(Number(b.dataset.up||b.dataset.down),b.dataset.up?-1:1);
      ui.otherStatuses=await applyBills();render();return;
    }
    if(b.dataset.pause){const bill=ui.bills.find(x=>x.id===Number(b.dataset.pause));
      await window.tribenet.pauseActivityBill(bill.id,!bill.paused);ui.otherStatuses=await applyBills();await refreshAll();return;}
    if(b.dataset.remove){if(!window.confirm('Delete this Running Order and its current-turn generated draft?'))return;
      await window.tribenet.removeActivityBill(Number(b.dataset.remove),sourceTurn());
      ui.otherStatuses=await applyBills();await refreshAll();return;}
  }catch(error){ui.status=error?.message||String(error);render();}
}
function handleChange(event){
  if(event.target.hasAttribute?.('data-process-worker')){
    const skill=event.target.dataset.processWorker;ui.workersBySkill[skill]=whole(event.target.value);
    render();return;
  }
  if(event.target.hasAttribute?.('data-process-knife')){
    const skill=event.target.dataset.processKnife;ui.knivesBySkill[skill]=whole(event.target.value);
    render();return;
  }
  if(event.target.id==='processOrderType'){ui.mode=event.target.value==='running'?'running':'once';render();return;}
  if(event.target.id==='processAnimal'){ui.animal=event.target.value;render();return;}
  if(event.target.id==='processGoal'){ui.goal=event.target.value;render();return;}
  if(event.target.id==='processGoalItem'){ui.goalItem=event.target.value;render();return;}
  if(event.target.id==='hideSkill'){ui.hideSkill=event.target.checked;render();return;}
  if(event.target.id==='hideInputs'){ui.hideInputs=event.target.checked;render();return;}
  if(event.target.id==='managerUnit'){ui.managerUnit=event.target.value;render();return;}
  if(event.target.id==='managerState'){ui.managerState=event.target.value;render();return;}
  if(event.target.id==='huntOrderType'){
    ui.mode=event.target.value==='once'?'once':'running';
    if(ui.mode==='running')autofillHunters();
    else ui.goalHint='';
    render();
    return;
  }
  if(event.target.id==='huntGoal'){
    ui.goal=event.target.value;autofillHunters();updateAllocationPreview();return;
  }
  if(event.target.id==='huntYield'){
    ui.yieldMode=event.target.value;autofillHunters();updateAllocationPreview();return;
  }
  if(event.target.id==='huntMonths'){
    ui.months=Number(event.target.value);
    autofillHunters();updateAllocationPreview();return;
  }
  if(event.target.id==='huntLimitToggle'){ui.loadEnabled=event.target.checked;return;}
  if(event.target.id==='huntLoad'){ui.loadPercent=Number(event.target.value);return;}
}
function handleInput(event){
  const id=event.target.id;
  if(id==='processQuantity'){ui.goalQuantity=whole(event.target.value);return;}
  if(id==='processWorkers'){ui.workers=whole(event.target.value);return;}
  if(id==='processKnives'){ui.knives=whole(event.target.value);return;}
  if(id==='huntMonths'){ui.months=Number(event.target.value);autofillHunters();updateAllocationPreview();return;}
  if(event.target.hasAttribute?.('data-tool-item')){
    const name=event.target.dataset.toolItem,quantity=whole(event.target.value);
    const values=new Map(preview().tools.map(x=>[x.name,whole(x.quantity)]));
    values.set(name,quantity);
    ui.selectedTools=[...values.entries()].filter(([,n])=>n>0).map(([name,quantity])=>({name,quantity}));
    ui.toolsCustomized=true;updateAllocationPreview();return;
  }
  if(id==='huntLoad'){ui.loadPercent=Number(event.target.value);return;}
  if(!['huntWorkers','huntWorkersSlider'].includes(id))return;
  ui.workers=whole(event.target.value);
  if(!ui.toolsCustomized)ui.selectedTools=[];
  // Do not recreate the range input or its ancestor while dragging:
  // replacing the DOM element resets pointer capture and causes stutter.
  updateAllocationPreview();
}
async function refreshWeight(code){
  const host=$('unitProjectedWeight');
  if(!host||!code)return;
  const unit=resultUnit(code),ctx=unit?contextFor(unit):null;
  if(!ctx)return;
  try{
    const [activities,transfers]=await Promise.all([
      window.tribenet.listPlannedActivities(sourceTurn()),
      window.tribenet.listPlannedTransfers(sourceTurn())
    ]);
    let minimum=ctx.currentWeight,maximum=ctx.currentWeight,unknown=minimum===null;
    let minProvisions=ctx.provs,maxProvisions=ctx.provs;
    let availableDogs=engine.stockCount(dataStock(unit),'Hunting Dog');
    if(ctx.provs===null)unknown=true;
    const wt=name=>{
      if(/^(provs|provisions)$/i.test(String(name)))return 10;
      const item=(window.TribeNetOrdersReferenceRaw?.goods||[]).find(x=>String(x.name||x.rawName).toLowerCase()===String(name).toLowerCase());
      return num(item?.weight??item?.weightLb);
    };
    for(const activity of activities){
      const performer=resultUnit(activity.unit);
      if(!performer)continue;
      const actualOwner=ownerCode(performer).toLowerCase();
      const affectsThisUnit=actualOwner===ctx.code.toLowerCase();
      if(!affectsThisUnit)continue;
      if(activity.activityCode==='HUNTING'){
        const workContext=contextFor(performer),tools=activity.implements||[];
        const dogs=Math.min(whole(activity.people),availableDogs);
        availableDogs-=dogs;
        const am=whole(activity.people)+tools.reduce((v,t)=>v+Number(t.quantity||0)*(engine.TOOLS.find(x=>x.name===t.name)?.bonus||0),0)+dogs*2;
        const range=workContext.skill===null?null:engine.forecast({workers:activity.people,
          effectiveAM:am,skill:workContext.skill,terrain:workContext.terrain,month:workContext.month,
          waterBorders:workContext.waterBorders});
        if(range){minimum+=range.min*10;maximum+=range.max*10;
          if(minProvisions!==null)minProvisions+=range.min;
          if(maxProvisions!==null)maxProvisions+=range.max;
        }else unknown=true;
      }else if(whole(activity.people)>0)unknown=true;
    }
    const retention=transfers.find(t=>t.timing==='BM'&&String(t.from).toLowerCase()===ctx.code.toLowerCase()
      &&String(t.to).toLowerCase()===ctx.code.toLowerCase()&&/^provs$/i.test(t.item));
    for(const tr of transfers.filter(t=>t.timing==='BM'&&String(t.from).toLowerCase()!==String(t.to).toLowerCase())){
      const delta=String(tr.from).toLowerCase()===ctx.code.toLowerCase()?-whole(tr.quantity):
        String(tr.to).toLowerCase()===ctx.code.toLowerCase()?whole(tr.quantity):0;
      if(!delta)continue;
      const w=wt(tr.item);
      if(w===null)unknown=true;else{minimum+=delta*w;maximum+=delta*w;
        if(/^(provs|provisions)$/i.test(tr.item)){
          if(minProvisions!==null)minProvisions+=delta;
          if(maxProvisions!==null)maxProvisions+=delta;
        }
      }
    }
    if(retention){
      const cap=whole(retention.quantity);
      if(minProvisions===null||maxProvisions===null)unknown=true;
      else{
        minimum-=Math.max(0,minProvisions-cap)*10;
        maximum-=Math.max(0,maxProvisions-cap)*10;
      }
    }
    const pct=v=>ctx.capacity>0?`${(100*v/ctx.capacity).toFixed(1)}%`:'unknown';
    host.innerHTML=`<strong>Current weight:</strong> ${display(ctx.currentWeight)} lb / ${display(ctx.capacity)} lb<br>
      <strong>Projected before movement:</strong> ${unknown?'Unknown (some activities/weights unverified)':`${display(minimum)}–${display(maximum)} lb (${pct(maximum)} max)`}
      ${!unknown&&ctx.capacity>0&&maximum>ctx.capacity?'<span class="activities-warning">Projected load exceeds capacity.</span>':''}
      <small>Includes ten-pound Provisions and Hunting yield credited to the effective Goods Tribe. Before eating; report weight may omit food eaten this turn, so weight caps use a conservative baseline and uncertain goods weights remain unverified.</small>`;
  }catch(error){host.textContent='Projected weight unavailable: '+(error.message||error);}
}
document.addEventListener('click',event=>{
  if(event.target.closest('#openActivitiesButton'))openOverview().catch(error=>{
    showDialog();ui.page='overview';ui.status=String(error.message||error);render();
  });
});
window.addEventListener('tribenet-import-complete',()=>{if($('activitiesDialog')?.open)load().then(render).catch(console.error);});
window.addEventListener('tribenet-planning-turn-activated',async event=>{
  const turn=String(event.detail?.turnKey||'');
  if(!turn||String(sourceTurn())!==turn)return;
  try{
    const bills=await window.tribenet.listActivityBills();
    const verified=String(state?.planImport?.plan?.turnKey||'')===turn
      || String(window.resultsTimeline?.turn?.turnKey||'')===turn;
    if(!verified){
      const notice=$('launcherOrdersStatus');
      if(notice)notice.textContent+=' Automatic Herding and Running Orders need a verified start-of-turn unit/stock baseline.';
      return;
    }
    ui.otherStatuses=await applyBills();
    if($('activitiesDialog')?.open)await refreshAll();
  }catch(error){
    const notice=$('launcherOrdersStatus');
    if(notice)notice.textContent+=' Herding and Running Order recalculation needs review: '+(error.message||error);
  }
});
window.TribeNetActivities={open,openOverview,applyCurrentTurn:applyBills,refreshWeight,contextFor};
})();

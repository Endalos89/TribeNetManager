/* Mapper Activities: three-menu workflow, Hunting pilot and Running Orders manager.
 * No forecasts are written to Results; the SQLite Mapper plan is authoritative.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const engine = window.TribeNetHuntingEngine;
if(!engine)return;
const ui={page:'skills',unit:'',skill:'Hunting',mode:'running',bills:[],activities:[],
  editing:null,editingActivity:null,workers:0,selectedTools:[],list:[],status:'',preview:null,otherStatuses:[],
  goal:'months',months:3,yieldMode:'average',loadEnabled:false,loadPercent:90,goalHint:''};
const unitCode = unit => String(unit?.unitCode||unit?.unit||'').trim();
const num = v => v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const whole = v => Math.max(0,Math.floor(Number(v)||0));
const display = v => Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString():'—';
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
  return window.SelectedUnitPanelUtils?.levelForSkill?.('Hunting',data)??0;
}
function skillLevel(unit,name){
  const tribe=resultUnit(rootCode(unitCode(unit)));
  const data=Object.keys(unit?.skills||{}).length?unit.skills:tribe?.skills||{};
  return window.SelectedUnitPanelUtils?.levelForSkill?.(name,data)??0;
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
    terrain:hexAt(hex)?.terrain||null,waterBorders:waterBorders(hex),month:match?Number(match[1]):null,
    workersAvailable:availableWorkers(unit),eaters:eaters(unit),stock,
    provs:knownStock?provs:null,currentWeight,capacity,provsWeight:1,
    otherMaxWeight:currentWeight!==null&&knownStock?Math.max(0,currentWeight-provs):null};
}
const contextList = () => allUnits().map(contextFor);
function skillList(){
  // Only display implemented/testable skills. More will be added in their
  // respective per-skill rollout, not as inert icons.
  return ['Hunting'];
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
  const ctx=contextFor(unit),available=availableWorkers(unit);
  if(available===null||!ctx.terrain||!ctx.month)
    return {error:'Automatic hunter count needs confirmed worker totals, turn month and start-of-turn terrain'};
  const pool=ownerCode(unit),source=resultUnit(pool)||unit;
  const poolContext=contextFor(source);
  if(poolContext.provs==null)return {error:'Automatic hunter count needs verified Provisions inventory'};
  const eaters=contextList().filter(c=>{
    const u=resultUnit(c.code);
    return u && ownerCode(u).toLowerCase()===pool.toLowerCase();
  }).reduce((sum,c)=>sum+whole(c.eaters),0);
  const demand=engine.provisionTarget(ui.months,eaters);
  const shortfall=Math.max(0,demand.beforeEating-poolContext.provs);
  if(ui.goal==='maximise')return {workers:available,reason:'Maximise uses all available hunters'};
  const planned=engine.allocation({
    workersAvailable:available,goalProvs:shortfall,mode:ui.yieldMode,
    skill:ctx.skill,terrain:ctx.terrain,month:ctx.month,waterBorders:ctx.waterBorders,
    stock:sourceStock()
  });
  if(planned.error)return {error:planned.error};
  return {workers:planned.workers,
    reason:`Target: ${display(demand.afterEating)} Provisions after eating; ${display(shortfall)} more needed before eating`+
    (planned.achievable?'':' · Goal exceeds the available hunters')};
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
  if(hint)hint.textContent=ui.goalHint;
}
async function load(){
  ui.bills=await window.tribenet.listActivityBills();
  ui.activities=sourceTurn()?await window.tribenet.listPlannedActivities(sourceTurn()):[];
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
  ui.selectedTools=[];ui.status='';
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
  if(!currentUnit())return '<p class="activities-warning">Select a unit on the Mapper to open its Activities Turn Action. You can use Activities Overview without a selected unit.</p>';
  if(!sourceTurn())return '<p class="activities-warning">No planning turn selected. Import Results or select a planning turn before allocating activities.</p>';
  const unit=currentUnit();
  return `<div class="activities-toolbar"><strong>1. Select skill</strong><span>Implemented skills only · Level badge = effective skill level</span></div>
    <div class="activities-grid">${skillList().map(name=>{
      const level=skillLevel(unit,name);
      return `<div class="activities-skill-wrap">
        <button class="activities-tile" data-skill="${esc(name)}" title="Select ${esc(name)} · Level ${level}">
          <img class="activities-skill-icon" src="skill-icons/hunting.svg" alt="" />
          <span class="activities-name">${esc(name)}</span><span class="activities-level">${level}</span>
        </button>${compendiumLink('skill',name,name)}
      </div>`;
    }).join('')}</div>`;
}
function renderRecipes(){
  return `<div class="activities-toolbar"><strong>2. ${esc(ui.skill)} — available activities</strong>
    <button class="button" data-go="skills">Back to skills</button></div>
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
function preview(){
  const unit=currentUnit();
  const context=contextFor(unit);
  const workers=whole(ui.workers);
  const tools=ui.selectedTools.length?ui.selectedTools:engine.optimizeTools(workers,sourceStock()).implements;
  const am=workers+tools.reduce((v,t)=>{const def=engine.TOOLS.find(x=>x.name===t.name);
    return v+t.quantity*(def?.bonus|| (t.name==='Hunting Dog'?2:0));},0);
  const range=engine.forecast({workers,effectiveAM:am,skill:context.skill,terrain:context.terrain,month:context.month,waterBorders:context.waterBorders});
  return {workers,range,tools,context};
}
function renderAllocate(){
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
      <div class="activities-tool-list" id="huntToolsList">${p.tools.length?p.tools.map(t=>`<span>${esc(t.name)}</span><strong>× ${whole(t.quantity)}</strong>`).join(''):'No eligible tools allocated'}</div>
      <section class="activities-yield"><small>EXPECTED PROVISIONS (WEATHER RANGE)</small>
        <strong id="huntYieldRange">${p.range?`${display(p.range.min)} – ${display(p.range.max)} Provisions`:'Unknown terrain / calculator rate'}</strong>
        <span id="huntYieldDetail">${p.range?`Fine weather: ${display(p.range.fine)} · Scenario average: ${display(p.range.average)}`:'Verify the unit’s start-of-turn terrain before saving a forecast.'}</span>
      </section>
      <div class="activities-actions"><button class="button accent" id="huntSave">${ui.editing?'Update Running Bill':running?'Save Running Bill':'Save One Turn Activity'}</button>
       <button class="button" data-go="skills">Cancel</button></div>
    </div>
    <aside class="activities-saved"><h3>Saved Activities</h3>
      ${ui.activities.filter(row=>String(row.unit).toLowerCase()===ui.unit.toLowerCase()).map(row=>`<div class="activities-saved-row"><strong>${esc(row.activityCode)}</strong>
        <span>${whole(row.people)} workers · ${esc(row.target||'')}${row.generatedLocked?' · Locked':''}</span>
        <small>Turn ${esc(row.turnKey)}</small><div class="activities-bill-buttons">
          ${row.activityCode==='HUNTING'?`<button data-edit-activity="${row.id}">Edit</button>`:''}
          <button data-remove-activity="${row.id}">Remove</button></div></div>`).join('')||'<p>No saved activities for this unit/turn.</p>'}
      <button class="button" id="huntViewOrders">Open Tribe Activities overview</button>
    </aside>
  </div>`;
}
function renderManager(){
  return `<div class="activities-toolbar"><strong>Running Orders — highest priority first</strong>
    <button class="button" data-go="skills">New activity</button><button class="button accent" id="huntApply">Apply to this turn</button></div>
    <p class="activities-note">Recalculation updates only generated draft rows. No workbook is exported or submitted; manual turn overrides remain protected.</p>
    <div class="activities-bills">${ui.bills.length?ui.bills.map((b,i)=>{
      const preview=ui.otherStatuses.find(x=>x.id===b.id);
      return `<div class="activities-bill">
        <strong>#${i+1} · ${esc(b.unit)} · Hunting</strong>
        <span>${b.mode==='maximise'?'Maximise':`Keep ${b.months} months after eating`} · ${esc(b.yieldMode)}</span>
        <small>${b.loadPercent==null?'No weight limit':`Max ${b.loadPercent}% capacity`} · ${b.paused?'Paused':esc(preview?.status||'Active / awaiting recalculation')}</small>
        <div class="activities-bill-buttons">
         <button data-up="${b.id}" ${i===0?'disabled':''} title="Increase priority">↑</button>
         <button data-down="${b.id}" ${i===ui.bills.length-1?'disabled':''} title="Decrease priority">↓</button>
         <button data-edit="${b.id}">Edit</button>
         <button data-pause="${b.id}">${b.paused?'Resume':'Pause'}</button>
         <button data-remove="${b.id}">Delete</button>
        </div></div>`;
    }).join(''):'<p>No Running Orders yet. Select a unit and Hunting to create one.</p>'}</div>`;
}
async function refreshAll(){
  await load();render();
  if(state?.selectedUnit&&typeof window.renderSelectedUnitPanel==='function')window.renderSelectedUnitPanel(state.selectedUnit);
}
async function save(){
  const unit=currentUnit();if(!unit)throw Error('No unit is selected.');
  const workers=whole(ui.workers);
  if(ui.mode==='once'&&workers>(availableWorkers(unit)||0))throw Error('Too many workers assigned.');
  if(ui.mode==='once'){
    if(!workers)throw Error('Select at least one hunter.');
    const order={unit:ui.unit,activityCode:'HUNTING',people:workers,
      target:'NONE',distinction:'NONE',implements:preview().tools};
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
    if(b.dataset.recipe){ui.page='allocate';ui.editing=null;ui.editingActivity=null;ui.mode='running';resetBillSettings();autofillHunters();ui.selectedTools=[];render();return;}
    if(b.id==='huntAutoTools'){
      ui.selectedTools=engine.optimizeTools(ui.workers,sourceStock()).implements;ui.status='Best eligible tools suggested for the selected workforce.';render();return;
    }
    if(b.id==='huntSave'){await save();return;}
    if(b.id==='huntApply'){ui.otherStatuses=await applyBills();ui.status='Generated Hunting allocations refreshed in the saved Mapper draft.';await refreshAll();return;}
    if(b.dataset.editActivity){const row=ui.activities.find(x=>x.id===Number(b.dataset.editActivity));
      if(!row||row.activityCode!=='HUNTING')return;
      ui.editing=null;ui.editingActivity=row.id;ui.unit=row.unit;ui.page='allocate';ui.mode='once';
      ui.workers=whole(row.people);ui.selectedTools=Array.isArray(row.implements)?row.implements:[];render();return;}
    if(b.dataset.removeActivity){
      if(!window.confirm('Remove this saved activity for the turn? Running Bills may regenerate their own drafts when applied again.'))return;
      await window.tribenet.deletePlannedActivity(Number(b.dataset.removeActivity));ui.status='Saved activity removed.';await refreshAll();return;}
    if(b.id==='huntViewOrders'){const button=document.querySelector('#orderSheetMenu [data-order-sheet="activities"]');$('activitiesDialog').close();button?.click();return;}
    if(b.dataset.edit){const bill=ui.bills.find(x=>x.id===Number(b.dataset.edit));ui.unit=bill.unit;ui.editing=bill.id;ui.editingActivity=null;ui.mode='running';ui.page='allocate';ui.selectedTools=[];resetBillSettings(bill);autofillHunters();render();return;}
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
  if(id==='huntMonths'){ui.months=Number(event.target.value);autofillHunters();updateAllocationPreview();return;}
  if(id==='huntLoad'){ui.loadPercent=Number(event.target.value);return;}
  if(!['huntWorkers','huntWorkersSlider'].includes(id))return;
  ui.workers=whole(event.target.value);ui.selectedTools=[];
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
    const wt=name=>{
      if(/^(provs|provisions)$/i.test(String(name)))return 1;
      const item=(window.TribeNetOrdersReferenceRaw?.goods||[]).find(x=>String(x.name||x.rawName).toLowerCase()===String(name).toLowerCase());
      return num(item?.weight??item?.weightLb);
    };
    for(const activity of activities.filter(x=>String(x.unit).toLowerCase()===ctx.code.toLowerCase())){
      if(activity.activityCode==='HUNTING'){
        const tools=activity.implements||[];
        const am=whole(activity.people)+tools.reduce((v,t)=>v+Number(t.quantity||0)*(engine.TOOLS.find(x=>x.name===t.name)?.bonus||(t.name==='Hunting Dog'?2:0)),0);
        const range=engine.forecast({workers:activity.people,effectiveAM:am,skill:ctx.skill,terrain:ctx.terrain,month:ctx.month,waterBorders:ctx.waterBorders});
        if(range){minimum+=range.min;maximum+=range.max;}else unknown=true;
      }else if(whole(activity.people)>0)unknown=true;
    }
    const retention=transfers.find(t=>t.timing==='BM'&&String(t.from).toLowerCase()===ctx.code.toLowerCase()
      &&String(t.to).toLowerCase()===ctx.code.toLowerCase()&&/^provs$/i.test(t.item));
    for(const tr of transfers.filter(t=>t.timing==='BM'&&String(t.from).toLowerCase()!==String(t.to).toLowerCase())){
      const delta=String(tr.from).toLowerCase()===ctx.code.toLowerCase()?-whole(tr.quantity):
        String(tr.to).toLowerCase()===ctx.code.toLowerCase()?whole(tr.quantity):0;
      if(!delta)continue;
      const w=wt(tr.item);
      if(w===null)unknown=true;else{minimum+=delta*w;maximum+=delta*w;}
    }
    if(retention){
      const currentProvs=ctx.provs??0;
      const cap=whole(retention.quantity);
      minimum-=Math.max(0,currentProvs+Math.max(0,minimum-ctx.currentWeight)-cap);
      maximum-=Math.max(0,currentProvs+Math.max(0,maximum-ctx.currentWeight)-cap);
    }
    const pct=v=>ctx.capacity>0?`${(100*v/ctx.capacity).toFixed(1)}%`:'unknown';
    host.innerHTML=`<strong>Current weight:</strong> ${display(ctx.currentWeight)} lb / ${display(ctx.capacity)} lb<br>
      <strong>Projected before movement:</strong> ${unknown?'Unknown (some activities/weights unverified)':`${display(minimum)}–${display(maximum)} lb (${pct(maximum)} max)`}
      ${!unknown&&ctx.capacity>0&&maximum>ctx.capacity?'<span class="activities-warning">Projected load exceeds capacity.</span>':''}
      <small>Includes Hunting yield and saved BM Transfers; food is eaten after movement.</small>`;
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
    if(!bills.some(b=>!b.paused))return;
    const verified=String(state?.planImport?.plan?.turnKey||'')===turn
      || String(window.resultsTimeline?.turn?.turnKey||'')===turn;
    if(!verified){
      const notice=$('launcherOrdersStatus');
      if(notice)notice.textContent+=' Running Hunting Bills need a verified start-of-turn unit/stock baseline before allocation.';
      return;
    }
    ui.otherStatuses=await applyBills();
    if($('activitiesDialog')?.open)await refreshAll();
  }catch(error){
    const notice=$('launcherOrdersStatus');
    if(notice)notice.textContent+=' Hunting Bill recalculation needs review: '+(error.message||error);
  }
});
window.TribeNetActivities={open,openOverview,applyCurrentTurn:applyBills,refreshWeight,contextFor};
})();

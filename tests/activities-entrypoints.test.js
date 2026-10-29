'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const screen=fs.readFileSync(path.join(root,'src/activities-screen.js'),'utf8');
const actions=fs.readFileSync(path.join(root,'src/turn-actions.js'),'utf8');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/activities-window-design.md'),'utf8');
const engine=require('../src/activities-hunting-engine');
const preload=fs.readFileSync(path.join(root,'src/preload.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/activities-screen.css'),'utf8');
const dossier=fs.readFileSync(path.join(root,'src/compendium-skill-overhaul.js'),'utf8');

assert.match(preload,/listPlannedActivities:\s*turnKey\s*=>\s*ipcRenderer\.invoke\('turn-manager:list-activities',\s*turnKey\)/,
  'The renderer must expose the planned Activities list IPC.');
assert.match(main,/ipcMain\.handle\('turn-manager:list-activities'/,
  'The main process must register the matching planned Activities IPC.');
assert.match(css,/user-select:text/,'Text inside Activities should be selectable and copyable.');
assert.match(dossier,/skill-icons\/hunting\.svg/,'The Compendium Hunting article must use the Activities icon.');
assert.match(screen,/data-compendium-entry/,'Skills need an exact Compendium link.');
assert.match(screen,/item-icons\/provisions\.svg/,'Hunting must display Provisions as a proper output item.');
assert.match(screen,/return \['Hunting'\]/,'Only the implemented Hunting skill should appear in Menu 1.');
const inputHandler=screen.split('function handleInput(event)')[1]?.split('async function refreshWeight')[0];
assert.ok(inputHandler&&!inputHandler.includes('render();'),
  'Slider input must update in place, never rebuild the editor on every pointer movement.');


assert.match(actions,/data-turn-action="activities"/,'Selected unit Turn Actions must contain Activities.');
assert.match(actions,/action === 'activities'[\s\S]*?TribeNetActivities\?\.open\?\.\(turnActionsUnit\(\)\?\.unitCode\)/,
  'The Turn Action must pass the initiating unit explicitly.');
assert.match(html,/id="openActivitiesButton"[^>]*>Activities Overview<\/button>/,
  'Map overview should be labelled separately from unit Activities.');
assert.match(html,/data-unit-action="activities"/,
  'The Orders tab should use the same Turn Action as the toolbar.');
assert.match(docs,/Selected unit → Turn Actions → Activities/,
  'The design must specify the selected-unit Turn Action entry.');
assert.match(docs,/turn-wide Activities Overview/,
  'The design must document overview access without selecting a unit.');

const units=[{unitCode:'0485',unitType:'Tribe',startHex:'PK1614',
  people:{Actives:20,Warriors:10,Inactives:0,Slaves:0},
  resources:{Goods:{Provs:50}},skills:{Hunting:2}}];
let selected=null,turn='906-05';
const nodes=new Map(),listeners={};
function element(id){
  if(!nodes.has(id))nodes.set(id,{
    id,hidden:false,textContent:'',innerHTML:'',open:false,
    addEventListener(){},
    showModal(){this.open=true;},
    close(){this.open=false;}
  });
  return nodes.get(id);
}
const document={
  getElementById:id=>id==='activitiesDialog'&&!nodes.has(id)?null:element(id),
  createElement:tag=>element(tag==='dialog'?'activitiesDialog':tag),
  body:{appendChild:node=>{nodes.set(node.id,node);}},
  addEventListener:(name,handler)=>{listeners[name]=handler;}
};
const api={
  listActivityBills:async()=>[],
  listPlannedActivities:async key=>key==='906-05'
    ?[{id:23,unit:'0485',activityCode:'HUNTING',people:8,target:'NONE',turnKey:key}]:[],
  listPlannedTransfers:async()=>[]
};
const window={tribenet:api,TribeNetHuntingEngine:engine,
  SelectedUnitPanelUtils:{levelForSkill:()=>2},
  addEventListener(){}};
const state={selectedUnit:selected,planImport:{turnKey:turn,plan:{units}},hexCache:new Map([['PK1614',{terrain:'PR',notes:''}]])};
const sandbox={
  document,window,state,
  savedMovementCurrentTurnKey:()=>turn,
  savedMovementUnits:()=>units,
  resultsTimeline:{turn:{turnKey:turn,units}},
  MovementPlannerCore:{},
  console
};
const instrumented=screen.replace(
  'window.TribeNetActivities={open,openOverview,applyCurrentTurn:applyBills,refreshWeight,contextFor};',
  'window.__ActivitiesTest={ui,goalAllocation,autofillHunters,handleInput,handleChange};window.TribeNetActivities={open,openOverview,applyCurrentTurn:applyBills,refreshWeight,contextFor};'
);
assert.notEqual(instrumented,screen,'The test must attach to the actual Hunting editor internals.');
vm.runInNewContext(instrumented,vm.createContext(sandbox),{filename:'activities-screen.js'});

(async()=>{
  assert.equal(typeof window.TribeNetActivities?.openOverview,'function',
    'Overview must expose a working entry point independent of unit selection.');
  assert.equal(typeof listeners.click,'function',
    'Map-corner Activities overview must have a click handler.');

  await window.TribeNetActivities.openOverview();
  assert.equal(element('activitiesDialog').open,true,'Overview should be visible without a selected unit.');
  assert.equal(element('activitiesTitle').textContent,'Activities Overview');
  assert.match(element('activitiesBody').innerHTML,/0485[\s\S]*HUNTING/,
    'Overview must show saved turn activities.');
  assert.match(element('activitiesBody').innerHTML,/data-overview-running/,
    'Overview must offer Running Orders management.');

  await window.TribeNetActivities.open('0485');
  assert.match(element('activitiesBody').innerHTML,/Select skill/,
    'Unit Turn Action must open Menu 1.');
  assert.match(element('activitiesBody').innerHTML,/Hunting/,
    'Hunting must be available to select.');
  assert.equal((element('activitiesBody').innerHTML.match(/data-skill="/g)||[]).length,1,
    'Only the Hunting skill is visible in Menu 1.');
  assert.match(element('activitiesBody').innerHTML,/data-compendium-key="Hunting"/,
    'The Hunting Compendium shortcut must appear on the skill tile.');
  assert.match(element('activitiesBody').innerHTML,/skill-icons\/hunting\.svg/,
    'Hunting must use its own icon instead of an emoji.');
  assert.match(element('activitiesBody').innerHTML,/id="hideSkill"/);
  assert.match(element('activitiesBody').innerHTML,/id="hideInputs"/);
  assert.equal(window.__ActivitiesTest.ui.mode,'once','New unit Activities must default to One Turn');
  const internals=window.__ActivitiesTest;
  internals.ui.page='allocate';internals.ui.unit='0485';internals.ui.mode='running';
  internals.ui.goal='months';internals.ui.months=0;internals.ui.yieldMode='average';
  internals.autofillHunters();
  assert.equal(internals.ui.workers,0,'No hunters needed when confirmed Provisions already exceed target.');
  internals.ui.months=3;internals.autofillHunters();
  assert.ok(internals.ui.workers>0,'A longer food goal should calculate hunters automatically.');
  internals.ui.goal='maximise';internals.autofillHunters();
  assert.equal(internals.ui.workers,22,'Maximise should use remaining workers after the saved 8-worker activity.');
  const input=element('huntWorkersSlider'),number=element('huntWorkers');
  const before=input;
  internals.handleInput({target:{id:'huntWorkersSlider',value:'7'}});
  assert.equal(input,before,'Slider DOM node must survive input updates.');
  assert.equal(number.value,'7','Numeric input and slider must remain synchronized.');
  assert.equal(internals.ui.workers,7);
  internals.ui.page='skills';

  assert.match(element('activitiesSubtitle').textContent,/Unit 0485/,
    'The initiating unit must be preserved.');

  await window.TribeNetActivities.open('9999');
  assert.equal(element('activitiesDialog').open,true);
  assert.match(element('activitiesBody').innerHTML,/Select a unit/,
    'Unresolvable units should display a warning rather than fail silently.');

  state.planImport.turnKey=null;turn=null;
  await window.TribeNetActivities.openOverview();
  assert.match(element('activitiesBody').innerHTML,/No planning turn selected/,
    'No planning turn should produce an actionable empty state, not an inert button.');

  console.log('Activities unit Turn Action and unit-independent overview entry points passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

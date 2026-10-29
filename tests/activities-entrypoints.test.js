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
const state={selectedUnit:selected,planImport:{turnKey:turn,plan:{units}}};
const sandbox={
  document,window,state,
  savedMovementCurrentTurnKey:()=>turn,
  savedMovementUnits:()=>units,
  resultsTimeline:{turn:{turnKey:turn,units}},
  MovementPlannerCore:{},
  console
};
vm.runInNewContext(screen,vm.createContext(sandbox),{filename:'activities-screen.js'});

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

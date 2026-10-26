const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// These tests exercise the actual browser functions (not a reimplementation)
// with only their DOM/map environment stubbed out.
const actions = fs.readFileSync('src/turn-actions.js', 'utf8');
const plans = fs.readFileSync('src/saved-movement-plans.js', 'utf8');
const unitsSource = fs.readFileSync('src/isometric-units.js', 'utf8');
function definition(source, signature, indentation = '') {
  const start = source.indexOf(indentation + signature + ' {');
  if (start < 0) throw new Error('Missing function: ' + signature);
  const end = source.indexOf('\n' + indentation + '}', start);
  if (end < 0) throw new Error('Unclosed function: ' + signature);
  return source.slice(start, end + indentation.length + 2);
}
function classList() {
  const set = new Set();
  return {
    contains: name => set.has(name),
    add: name => set.add(name),
    remove: name => set.delete(name),
    toggle: (name, on) => on ? set.add(name) : set.delete(name)
  };
}
const bar = { classList: classList(), innerHTML:'', querySelectorAll:()=>[] };
const scoutTools = { classList:classList(), innerHTML:'', querySelectorAll:()=>[] };
const controls = { turnActionBar:bar, turnActionScoutTools:scoutTools };
const ctx = vm.createContext({
  state:{mode:'detail',selectedUnit:'0485',selectedUnitHex:'AA0101',selectedRouteId:null},
  resultsTimeline:{turn:{isPlanningTurn:true}},
  savedMovementPlansState:{selectedUnitCode:'0485', routes:[], unitSplits:[],scoutCount:2,scoutHorses:2,scoutEquipment:'',scoutMission:'PATROL'},
  movementPlannerState:{origin:{coordinate:'AA0101'},route:{status:'ok',knownMp:4,badWeatherMp:5,directions:['N'],path:[{},{}]}},
  turnActionState:{active:'scout',unitCode:'0485',pendingOcean:null,editingRouteId:null,followOceanMode:false,shiftChainStarted:true,status:''},
  document:{getElementById:id=>controls[id]||null,activeElement:null},
  savedMovementSelectedUnit:()=>({unitCode:'0485',unitType:'Tribe',unitName:'Test',currentHex:'AA0101'}),
  savedMovementCurrentTurnKey:()=> '906-05',
  savedMovementCanMoveUnit:()=>true,
  savedMovementCanScoutUnit:()=>true,
  savedMovementIsStationaryUnit:()=>false,
  savedMovementUnitMove:()=>null,
  savedMovementRouteKey:route=>String(route.id),
  turnActionsRenderLegend:()=>{},
  turnActionsRenderScoutTools:()=>{scoutTools.classList.remove('hidden');},
  turnActionsBindTooltips:()=>{},
  MovementPlannerCore:{unitMovementProfile:()=>({allowance:18,mounted:false,people:10,horses:0})},
  TURN_ACTION_ICONS:{move:'M',scout:'C',split:'X',transfer:'T',followOcean:'F',cancel:'×',reset:'R',edit:'E',remove:'-',routes:'V'},
  console
});
for(const functionName of [
  'turnActionsUnit()', 'turnActionsPlanningAvailable()', 'turnActionsEscape(value)',
  'turnActionsActiveLabel()', 'turnActionsScoutAllowance()', 'turnActionsRouteSummary()',
  'turnActionsRender()', 'turnActionsSyncSelection(event)'
]) {
  vm.runInContext(definition(actions,'function '+functionName),ctx);
}
// A Shift-click on a blank hex may clear the selection in another handler.
vm.runInContext('state.selectedUnit=null;turnActionsSyncSelection({detail:null})',ctx);
assert.equal(ctx.state.selectedUnit,'0485');
assert.equal(ctx.turnActionState.active,'scout');
assert.equal(bar.classList.contains('hidden'),false,'Scouting bar must remain on screen');
assert.match(bar.innerHTML,/Save Scout/,'Explicit save control must remain available');
assert.match(bar.innerHTML,/data-turn-action="scout-confirm"[^>]*>/);
assert.equal(scoutTools.classList.contains('hidden'),false,'Floating controls must remain visible');
// The same applies to an occupied destination hex and a different unit code.
vm.runInContext("state.selectedUnit='1485';turnActionsSyncSelection({detail:{unitCode:'1485',hex:'AA0202'}})",ctx);
assert.equal(ctx.state.selectedUnit,'0485','Occupied destination must not switch the scout source');
assert.equal(ctx.savedMovementPlansState.selectedUnitCode,'0485');
assert.equal(bar.classList.contains('hidden'),false);
assert.equal(ctx.turnActionState.active,'scout');
assert.match(bar.innerHTML,/Save Scout/);
// The tooltip/summary must display scout allowance rather than the parent
// unit's ordinary 18 MP.
assert.match(vm.runInContext('turnActionsRouteSummary()',ctx),/\/15 MP/);
// A pre-route Save button is disabled but Cancel stays usable.
ctx.movementPlannerState.route={status:'ok',directions:[],path:[{}]};
vm.runInContext('turnActionsRender()',ctx);
assert.match(bar.innerHTML,/data-turn-action="scout-confirm"[^>]* disabled/);
assert.match(bar.innerHTML,/data-turn-action="scout-cancel"/);

// Classic renderer: occupied destinations must be passed to route planner,
// not handled as unit-selection cycling.
const unitClick = definition(unitsSource,'function clickHex(point)','  ');
const selectCalls=[];
const unitCtx=vm.createContext({
  movementPlannerState:{active:true},cycle:{index:1},
  selectHex:(col,row)=>{selectCalls.push([col,row]);},console
});
vm.runInContext(unitClick,unitCtx);
assert.equal(vm.runInContext('clickHex({globalCol:12,globalRow:34})',unitCtx),true);
assert.deepEqual(selectCalls,[[12,34]]);
assert.equal(unitCtx.cycle,null);

// A missing animal inventory is unknown, not an absolute zero. The previous
// implementation fabricated zero via unitMovementProfile and rejected every
// mounted scout from imported units without animal detail.
const scoutCheck=definition(plans,'async function savedMovementCheckScoutWorkers(unit, people, horses, editingId = null)');
const source={unitCode:'0485',warrior:10,workers:10};
const workerCtx=vm.createContext({
  savedMovementPlansState:{routes:[],unitSplits:[]},
  savedMovementUnits:()=>[source],
  savedMovementCurrentTurnKey:()=> '906-05',
  window:{tribenet:{getManagedTurn:async()=>({activities:[]})}},
  console
});
vm.runInContext(scoutCheck,workerCtx);
(async()=>{
  await vm.runInContext("savedMovementCheckScoutWorkers({unitCode:'0485'},2,2)",workerCtx);
  source.horseCount=1;
  await assert.rejects(
    vm.runInContext("savedMovementCheckScoutWorkers({unitCode:'0485'},2,2)",workerCtx),
    /only has 1 recorded horses/
  );
  console.log('scouting route Shift-click, save control, MP and resource regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

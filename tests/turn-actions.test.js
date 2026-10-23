const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const actions = fs.readFileSync('src/turn-actions.js', 'utf8');
const savedPlans = fs.readFileSync('src/saved-movement-plans.js', 'utf8');
const index = fs.readFileSync('src/index.html', 'utf8');
const mapperStyles = fs.readFileSync('src/movement-planner.css', 'utf8');
const movementPlanner = fs.readFileSync('src/movement-planner.js', 'utf8');
const renderer = fs.readFileSync('src/renderer.js', 'utf8');
const transferScreen = fs.readFileSync('src/transfer-screen.js', 'utf8');
const plannedSplitsMap = fs.readFileSync('src/planned-unit-splits-map.js', 'utf8');

assert.match(index, /id="turnActionBar"/, 'The mapper must expose the selected-unit action bar.');
assert.match(index, /id="turnActionScoutTools"/, 'Scouting must expose a floating route control toolbar.');
assert.match(index, /id="turnActionHoverCard"/, 'Move Unit must expose a hover cost readout.');
assert.match(index, /id="turnActionTooltip"/, 'Action controls must expose an immediate tooltip surface.');
assert.match(index, /id="scoutRoutesDialog"/, 'Scouting orders must have a dedicated edit dialog.');
assert.match(index, /id="turnActionRouteLegend"/, 'The map must expose a route certainty legend.');
assert.match(index, /id="unitSplitDialog"/, 'Split Off Unit must have a dedicated dialog.');
assert.match(index, /id="openTransferOverviewButton"/, 'Transfer overview must be reachable from the top-left mapper actions.');
assert.match(index, /id="openTransferOverviewButton" class="transfer-map-button"/, 'Transfers must be a map-corner overlay.');
assert.match(index, /id="openScoutOverviewButton" class="transfer-map-button"/, 'The map-corner actions must include a scout overview.');
assert.match(index, /id="scoutOverviewDialog"/, 'The scout overview must be available independently of the selected unit.');
assert.match(index, /id="scoutOverviewRows"/, 'The scout overview must show workbook-style scouting rows.');
assert.match(index, /id="openUnitCreationOverviewButton"/, 'Created units must have an overview entry beside Scout and Transfers.');
assert.match(index, /id="unitCreationOverviewDialog"/, 'The map must provide a created-unit overview.');
assert.match(index, /id="unitCreationOverviewRows"/, 'Created units must be listed with their source and creation phase.');
assert.match(index, /<h2>Transfers<\/h2>/, 'The overview dialog should be titled Transfers.');
assert.match(index, /id="transferFromLabel"/, 'The transfer source should be displayed as the initiating unit.');
assert.ok(!/id="transferFrom"/.test(index), 'The source unit must not be editable in the transfer dialog.');
assert.match(index, /From<\/span>[\s\S]*?Timing<\/span>[\s\S]*?To Tribe<\/span>/, 'The transfer form should order source, phase, then target.');
assert.match(index, /id="transferOverviewRows"/, 'Transfer overview must show workbook-style rows.');
assert.match(index, /id="transferCancelAll"/, 'Transfer overview must allow cancelling every transfer for the current turn.');
assert.match(index, /id="transferQuantitySlider"/, 'Transfer item editor must include a quantity slider.');
assert.match(index, /id="transferQuantity"/, 'Transfer item editor must allow direct quantity entry.');
assert.match(transferScreen, /TribeNetItemIconManifest/, 'Transfer roster items must use compendium icons where available.');
assert.match(index, /<dialog id="transferItemEditor" class="transfer-item-editor"/, 'Editing a transfer quantity must open a popup dialog.');
assert.match(index, /<dialog id="transferItemEditor"[^>]*>[\s\S]*?data-drag-handle="transfer-item-editor"/, 'The quantity popup must have a drag handle.');
assert.match(mapperStyles, /\.transfer-item-editor:not\(\[open\]\)\s*\{\s*display:none;/, 'The quantity popup must stay hidden until it is opened by an item selection.');
assert.match(transferScreen, /editor\.showModal\(\)/, 'The transfer quantity popup must overlay the transfer screen.');
assert.match(transferScreen, /turnActionsBindDialogDrag\(editor, 'transfer-item-editor'\)/, 'The transfer quantity popup must be draggable.');
assert.match(transferScreen, /const isProvisions = monthsKind === 'provisions';\s*if \(modePicker\) modePicker\.hidden = !isProvisions;/, 'The Months section must only be visible when transferring provisions.');
assert.match(transferScreen, /transferScreenCloseItemEditor/, 'The transfer quantity popup must close cleanly on cancel or apply.');
assert.match(transferScreen, /replacePlannedTransferGroup/, 'Transfer editor must save the complete selected pair and timing group.');
assert.match(transferScreen, /deleteAllPlannedTransfers/, 'Transfer overview must provide turn-wide cancellation.');
assert.match(savedPlans, /createdSplitId: created\.id/, 'A newly created unit must be linked to its initial transfer screen.');
assert.match(transferScreen, /createdSplitId\)\s*\{[\s\S]*deletePlannedUnitSplit\(session\.createdSplitId\)/, 'Cancelling the initial transfer screen must remove the new unit creation.');
assert.match(transferScreen, /addEventListener\('cancel',[\s\S]*transferScreenCancel\(\)/, 'Escape must use the same creation rollback as the cancel button.');
assert.match(transferScreen, /session\.createdSplitId = null/, 'Saving the initial transfer screen must keep the created unit.');
assert.match(index, /id="plannedUnitManagementList"/, 'The create-unit dialog must expose existing planned units for cleanup.');
assert.match(index, /id="plannedUnitManagementDialog"/, 'Existing planned units must be shown in a dedicated popup.');
assert.match(actions, /turnActionsOpenPlannedUnitManagement/, 'The create-unit dialog must open the planned-unit management popup.');
assert.match(actions, /data-remove-planned-unit/, 'Planned units must be removable even when they are not visible on the map.');
assert.match(transferScreen, /transferScreenEligibleTargets/, 'Transfer targets must be filtered to units at the phase-specific location.');
assert.match(actions, /unit\.plannedSplit \? `<button class="turn-action-utility danger" data-turn-action="cancel-unit-creation"/, 'Selecting a unit created this turn must expose a cancel-creation button.');
assert.match(actions, /deletePlannedUnitSplit\(split\.id\)/, 'Cancelling a created unit must delete its planned creation record.');
assert.match(actions, /Any transfers to or from this unit will also be removed/, 'Cancellation must warn that transfers linked to the created unit will be removed.');
assert.match(actions, /Move Unit/, 'Move Unit action is missing.');
assert.match(actions, /Split Off Unit/, 'Split Off Unit action is missing.');
assert.match(actions, /Send Out Scout/, 'Send Out Scout action is missing.');
assert.match(actions, /key === 'M'/, 'Move Unit hotkey is missing.');
assert.match(actions, /key === 'X'/, 'Split Off Unit hotkey is missing.');
assert.match(actions, /key === 'C'/, 'Send Out Scout hotkey is missing.');
assert.match(actions, /key === 'F'/, 'Follow Ocean hotkey is missing.');
assert.match(actions, /follow-ocean/, 'Follow Ocean must be an explicit scouting action.');
assert.match(actions, /turnActionsArmFollowOcean/, 'Follow Ocean must be directly armable from the action bar.');
assert.match(actions, /\['O', 'OCEAN'\]\.includes\(terrain\)/, 'Follow Ocean must recognise both ocean terrain encodings.');
assert.match(actions, /turnActionsApplyFollowOcean/, 'Follow Ocean must resolve from the selected ocean edge.');
assert.match(savedPlans, /conditionalPredictionPaths: route\.conditionalPredictionPaths \|\| \[\]/, 'Conditional Follow Ocean paths must be persisted with saved routes.');
assert.match(savedPlans, /if \(Array\.isArray\(route\?\.conditionalPredictionPaths\)/, 'Saved conditional paths must be drawn after reload.');
assert.match(actions, /action-icons\//, 'Action icons must use dedicated image assets.');
assert.match(actions, /move\.svg|split\.svg|scout\.svg|follow-ocean\.svg/, 'Actions must use purpose-specific icons.');
for (const icon of ['move.svg', 'split.svg', 'scout.svg', 'follow-ocean.svg', 'cancel.svg', 'reset.svg', 'edit.svg', 'remove-route.svg', 'routes.svg']) {
  assert.ok(fs.existsSync(`src/action-icons/${icon}`), `Missing dedicated action icon: ${icon}`);
}
assert.match(actions, /event\.key !== 'Shift'/, 'Shift release must be the chain input boundary.');
assert.match(actions, /turnActionsCommit\(\)/, 'Turn actions must commit after a completed click/chain.');
assert.match(actions, /data-turn-action="scout-confirm"[\s\S]*?data-turn-action="scout-cancel"|data-turn-action="scout-cancel"[\s\S]*?data-turn-action="scout-confirm"/, 'Scouting must expose explicit confirm and cancel controls.');
assert.match(actions, /data-turn-action="scout-fol"[\s\S]*?>FOL<\/button>[\s\S]*?data-turn-action="scout-for"[\s\S]*?>FOR<\/button>/, 'The floating scout controls must offer FOL and FOR commands.');
assert.match(actions, /function turnActionsAddScoutConditional\(order\)/, 'FOL/FOR buttons must insert conditional commands into the pending route.');
assert.match(actions, /if \(existingConditional === order\)/, 'Clicking an active FOL/FOR option again must remove that command from the draft.');
assert.match(actions, /function turnActionsOpenScoutOverview\(\)/, 'The scout overview must list scouting orders across all units.');
assert.match(actions, /function turnActionsScoutOverviewRoutes\(\)[\s\S]*state\.planImport\?\.plan\?\.scouts/, 'The scout overview must include scouting rows imported from the workbook, which are also drawn on the map.');
assert.match(actions, /source: 'workbook'/, 'Workbook scout rows must remain distinguishable from saved scout drafts.');
assert.match(renderer, /turnActionsRenderScoutOverviewButton\(\)/, 'The Scout count must refresh when an orders workbook is imported.');
assert.match(actions, /Movement1|length:9/, 'The scout overview must expose the workbook scouting command columns.');
assert.match(actions, /if \(turnActionState\.active && !event\?\.detail\?\.unitCode\)/, 'Clicking an empty destination hex must not cancel the active route overlay.');
assert.match(actions, /function turnActionsOpenUnitCreationOverview\(\)/, 'The map overview must list units created during the current turn.');
assert.match(actions, /data-created-unit-location/, 'Created-unit overview rows must expose the current phase-specific map location.');
assert.match(fs.readFileSync('src/planned-unit-splits-map.js', 'utf8'), /turnActionsRenderUnitCreationOverviewButton/, 'The created-unit count must refresh when planned creations load.');
assert.match(fs.readFileSync('src/unit-logistics.js', 'utf8'), /created this turn from/, 'Selecting a created unit must identify its parent and creation timing in the unit details.');
assert.match(actions, /turnActionState\.active === 'unit' && turnActionState\.shiftChainStarted/, 'Only movement routes may auto-commit when Shift is released.');
assert.match(actions, /pendingMapClick/, 'Shift release must wait for the map click to finish appending its route.');
assert.match(actions, /await turnActionState\.pendingMapClick/, 'Shift release must await the pending map click before committing.');
assert.match(actions, /turnActionsPreviewHover/, 'Move Unit must calculate a route preview while hovering.');
assert.match(actions, /Keep the cost card anchored to the centre of the hex/, 'Hover feedback must stay stable while tracing within a hex.');
assert.match(actions, /turnActionsHoverAppendPreview/, 'Shift hover must preview the chained route.');
assert.match(actions, /movementPlannerFindAppendedRoute/, 'Shift-click must append a full route to a distant destination.');
assert.match(movementPlanner, /movementPlannerAppendRouteTo/, 'Movement planner must support multi-hex Shift appends.');
assert.match(actions, /turnActionsRefreshHover/, 'Changing Shift state must refresh the hover preview.');
assert.match(actions, /turnActionsUnitMovement/, 'Move Unit must use the selected unit movement profile.');
assert.match(actions, /turnActionsMovementRisk/, 'Move Unit must classify safe, risky and over-range routes.');
assert.match(renderer, /const unreachable = Number\.isFinite\(weatherAllowance\) && normalCumulative > weatherAllowance/, 'Routes beyond best-weather movement range must be marked unreachable.');
assert.match(renderer, /unreachableColor \|\| '#f06464'/, 'Unreachable route segments must use a red route color.');
assert.match(renderer, /dashed: style\.dashed \|\| maybe \|\| unreachable/, 'Unreachable routes must use a dotted arrow style.');
assert.match(renderer, /const scoutColor = '#c58cff'/, 'Scouting routes must use a distinct color from movement routes.');
assert.match(actions, /Unit total:/, 'Move Unit must show the selected unit total movement.');
assert.match(actions, /Bad weather/, 'Move Unit must show the bad-weather movement warning.');
assert.match(actions, /turnActionsCancelRightClick/, 'Right-clicking during an active action must cancel it.');
assert.match(actions, /reset-scouting/, 'The action bar must provide a unit-scoped scouting reset.');
assert.match(actions, /open-scouts/, 'The action bar must open saved scout routes for the selected unit.');
assert.match(actions, /turnActionsOpenScoutRoutes/, 'Saved scout routes must support hover highlighting and edit/cancel actions.');
assert.match(actions, /if \(!dialog\.open\) dialog\.show\(\)/, 'Scouting routes must use a non-modal popup.');
assert.match(actions, /turnActionsBindDialogDrag/, 'Scouting routes popup must be draggable.');
assert.ok(!/turnActionsCloseScoutRoutes\(\);\s*await turnActionsEditSelectedScout/.test(actions), 'Editing a route must not close the route picker.');
assert.match(actions, /if \(dialog\.open\) turnActionsOpenScoutRoutes\(\)/, 'Cancelling a route must refresh the open route picker.');
assert.match(actions, /savedMovementResetMovementForUnit/, 'Movement reset must be scoped to the selected unit.');
assert.match(actions, /savedMovementResetScoutingForUnit/, 'Scouting reset must be scoped to the selected unit.');
assert.match(actions, /edit-scout/, 'A selected scout route must offer editing.');
assert.match(actions, /cancel-scout/, 'A selected scout route must offer cancellation.');
assert.match(actions, /title="Move Unit · M"/, 'Action buttons must expose their name and hotkey on hover.');
assert.match(actions, /title="Send Out Scout · C"/, 'Scout action must expose its name and hotkey on hover.');
assert.match(actions, /turnActionsBindTooltips/, 'Action controls must bind immediate custom tooltips.');
assert.match(renderer, /certainColor/, 'Route arrows must distinguish certain terrain from uncertain terrain.');
assert.match(renderer, /maybeColor/, 'Route arrows must expose a second colour for uncertain terrain.');
assert.match(renderer, /badWeatherAllowance/, 'Route arrows must account for movement lost to bad weather.');
assert.match(actions, /R\$\{savedMovementVisibleRouteNumber\(route\)\}/, 'Scouting routes must show route numbers.');
assert.match(actions, /editingRouteId/, 'Scout editing must update the existing route rather than insert a duplicate.');
assert.match(actions, /selectedScout \? turnActionsEditSelectedScout\(\) : turnActionsStart\('scout'\)/, 'C should edit a selected scout route and otherwise start scouting.');
assert.match(fs.readFileSync('src/saved-movement-plans.js', 'utf8'), /savedMovementHandleRouteLabelClick/, 'Scout labels must be clickable.');
assert.match(actions, /event\.button === 2/, 'Right-click handling must identify the secondary mouse button.');
assert.match(actions, /addEventListener\('mouseup', turnActionsCancelRightClick, true\)/, 'Right-click cancellation must run before map mouseup selection.');
assert.match(actions, /addEventListener\('contextmenu', turnActionsCancelRightClick, true\)/, 'Cancelled right-clicks must not open the browser context menu.');
assert.match(actions, /pendingOcean/, 'Scout coastal traces must retain the selected ocean tile.');
assert.match(actions, /Now select the land or unexplored hex to set the direction/, 'Follow Ocean must use a second land selection to determine direction.');
assert.match(actions, /turnActionState\.pendingOcean = ocean/, 'Follow Ocean must keep the ocean selection pending.');
assert.match(actions, /orderForFeature/, 'Scout coastal traces must infer FOL/FOR.');
assert.match(savedPlans, /garrison.*fleet.*courier|fleet.*courier.*garrison/i, 'Garrisons, fleets and couriers must be handled as stationary units.');
assert.match(index, /id="movementPlannerCreatePhase"/, 'The mapper split dialog must let users choose the creation phase.');
assert.ok(!index.includes('movementPlannerCreateCode'), 'The mapper should assign unit codes automatically instead of asking users to choose one.');
assert.ok(!fs.readFileSync('src/planned-unit-splits-turn.js', 'utf8').includes('plannedUnitSplitCode'), 'Turn Manager should assign unit codes automatically instead of asking users to choose one.');
assert.match(savedPlans, /unit\.plannedSplit && unit\.creationPhase === 'after'/, 'After-movement splits must remain stationary.');
assert.match(fs.readFileSync('src/planned-unit-splits-map.js', 'utf8'), /savedMovementUnitMoveDestination\(split\.parentUnit\)/, 'After-movement splits must follow the source unit endpoint on the map.');
assert.match(fs.readFileSync('src/isometric-units.js', 'utf8'), /savedMovementPlansState\?\.unitSplits/, 'Planned split units must be registered and selectable on the 3D map even when no imported unit row exists.');
assert.match(savedPlans, /savedMovementIsStationaryUnit/, 'Stationary unit types must share one movement rule.');
assert.match(savedPlans, /removeAllScoutRoutesForUnit/, 'Changing a unit destination must clear its scouting routes.');
assert.match(savedPlans, /clearedScoutRoutes/, 'Movement commits must report cleared scouting routes.');
assert.match(savedPlans, /scoutCount\s*:\s*2/, 'Scouting must default to two people.');
assert.match(savedPlans, /scoutHorses\s*:\s*2/, 'Scouting must default to two horses.');
assert.ok(!actions.includes('Smart Scout') && !actions.includes('smartScout'), 'Smart Scout must be removed completely.');
assert.ok(!mapperStyles.includes('movement-planner-smart'), 'Smart Scout styling must be removed completely.');
assert.ok(!index.includes('movementPlannerCard') && !index.includes('plannerOverlayCard'), 'The old planning panel must not be present.');

const transferUnits = [
  { unitCode:'0485', unitType:'Tribe', currentHex:'AA0101' },
  { unitCode:'1485', unitType:'Tribe', currentHex:'AA0101' },
  { unitCode:'2485', unitType:'Tribe', currentHex:'CC0303' },
  { unitCode:'3485', unitType:'Tribe', currentHex:'BB0202' },
  { unitCode:'0485e1', unitType:'Element', plannedSplit:true, creationPhase:'after', parentUnit:'0485', currentHex:'AA0101', startHex:'AA0101' },
  { unitCode:'0485e2', unitType:'Element', plannedSplit:true, creationPhase:'before', parentUnit:'0485', currentHex:'AA0101', startHex:'AA0101' }
];
const transferDestinations = { '0485':'BB0202', '1485':'AA0101', '2485':'BB0202', '3485':'DD0404' };
const transferContext = vm.createContext({
  document: { getElementById: () => null },
  window: {},
  savedMovementUnits: () => transferUnits,
  savedMovementUnitMoveDestination: code => transferDestinations[code] || null,
  plannedSplitMapHex: unit => transferDestinations[unit.parentUnit] || unit.startHex
});
vm.runInContext(transferScreen, transferContext);
assert.deepEqual(
  Array.from(vm.runInContext(`transferScreenEligibleTargets('0485', 'BM').map(unit => unit.unitCode)`, transferContext)),
  ['1485', '0485e2'],
  'Before Movement targets should share the source unit start hex and exclude units created after movement.'
);
assert.deepEqual(
  Array.from(vm.runInContext(`transferScreenEligibleTargets('0485', 'AM').map(unit => unit.unitCode)`, transferContext)),
  ['2485', '0485e1'],
  'After Movement targets should share the source movement endpoint and include units created there.'
);
const afterSplit = { id:7,unitCode:'0485e3',unitType:'Element',parentUnit:'0485',unitName:'After move party',startHex:'AA0101',creationPhase:'after' };
const phaseTransferContext = vm.createContext({
  document: { getElementById: () => null },
  window: { tribenet:{ listPlannedUnitSplits: async () => [afterSplit] } },
  state: { mode:'detail',planningVisible:true,planImport:{plan:{}} },
  resultsTimeline: { turn:{isPlanningTurn:true} },
  savedMovementPlansState: { unitSplits:[],routes:[],selectedUnitCode:'' },
  savedMovementCurrentTurnKey: () => '906-05',
  savedMovementUnits: () => [
    {unitCode:'0485',unitType:'Tribe',currentHex:'AA0101',startHex:'AA0101'},
    {unitCode:'0485e3',unitType:'Element',currentHex:'AA0101',startHex:'AA0101',parentUnit:'0485',plannedSplit:true}
  ],
  savedMovementUnitMoveDestination: code => code === '0485' ? 'BB0202' : null,
  savedMovementCompareUnits: (a,b) => String(a.unitCode).localeCompare(String(b.unitCode)),
  savedMovementRefresh: async () => [],
  savedMovementPopulateUnits: () => {},
  parseCoordinate: value => /^[A-Z]{2}\d{4}$/.test(value || '') ? {coordinate:value} : null,
  draw: () => {},
  drawUnitLabel: () => {},
  console
});
vm.runInContext(plannedSplitsMap, phaseTransferContext);
vm.runInContext(`savedMovementPlansState.unitSplits=[${JSON.stringify(afterSplit)}]`, phaseTransferContext);
vm.runInContext(transferScreen, phaseTransferContext);
const afterSplitUnit = vm.runInContext(`savedMovementUnits().find(unit=>unit.unitCode==='0485e3')`, phaseTransferContext);
assert.equal(afterSplitUnit.creationPhase, 'after', 'The normalized created unit must retain its creation phase when already present in the base unit list.');
assert.equal(afterSplitUnit.currentHex, 'BB0202', 'An after-movement created unit must be placed at its parent movement endpoint in the unit list.');
assert.deepEqual(
  Array.from(vm.runInContext(`transferScreenEligibleTargets('0485', 'AM').map(unit=>unit.unitCode)`, phaseTransferContext)),
  ['0485e3'],
  'An after-movement created unit must be available as an AM transfer target at its parent movement endpoint.'
);
assert.match(transferScreen, /const transferScreenPeopleItems = \['WARRIORS', 'ACTIVES', 'INACTIVES'\]/, 'Warriors, actives and inactives must always have separate roster entries.');
assert.match(transferScreen, /!transferScreenPeopleItems\.includes\(item\) && balance\.amount <= 0/, 'Zero quantity goods should be omitted from the transfer roster.');
assert.match(transferScreen, /transferScreenRenderLogistics\(transferScreenSession\.from, 'transferLogisticsLeft'\)/, 'The transfer screen must refresh logistics meters after each staged change.');
const logisticsContext = vm.createContext({
  document: { getElementById: () => null },
  window: { TribeNetOrdersReferenceRaw: { goods:[{name:'Provs',rawName:'PROVS',weight:10}] } },
  savedMovementUnits: () => [],
  state: { planImport:{ plan:{ unitStats:[
    {unit:'0485',warrior:0,active:300,inactive:0,eaters:300,totalPeople:300,locals:0,horseCount:0,cattleCount:0,elephantCount:0,camelCount:0,wagonCount:0,backpacks:0,saddlebags:0,carriedWeight:6000,carryingCapacity:9000,inventory:[{item:'PROVS',quantity:600,weightEach:10}]},
    {unit:'1485',warrior:0,active:0,inactive:0,eaters:0,totalPeople:0,locals:0,horseCount:0,cattleCount:0,elephantCount:0,camelCount:0,wagonCount:0,backpacks:0,saddlebags:0,carriedWeight:0,carryingCapacity:0,inventory:[]}
  ] } } }
});
vm.runInContext(transferScreen, logisticsContext);
vm.runInContext(`transferScreenSession={from:'0485',to:'1485',draftRows:[{from:'0485',to:'1485',item:'ACTIVES',quantity:30},{from:'0485',to:'1485',item:'PROVS',quantity:100}]}`, logisticsContext);
const logistics = vm.runInContext(`transferScreenLiveLogistics('0485')`, logisticsContext);
assert.equal(logistics.capacity, 8100, 'Carrying capacity must recalculate for people staged out of the source unit.');
assert.equal(logistics.weight, 5000, 'Carried weight must recalculate for goods staged out of the source unit.');
assert.equal(logistics.months, 500 / 270, 'Sustenance must recalculate from remaining provisions and eaters.');
vm.runInContext(`savedMovementUnits=()=>[{unitCode:'3485',unitType:'Tribe',plannedSplit:true}]`, logisticsContext);
vm.runInContext(`transferScreenSession={from:'0485',to:'3485',draftRows:[{from:'0485',to:'3485',item:'ACTIVES',quantity:12},{from:'0485',to:'3485',item:'PROVS',quantity:2400},{from:'0485',to:'3485',item:'HORSES',quantity:3},{from:'0485',to:'3485',item:'GOATS',quantity:4}]}; transferScreenItemDraft={from:'0485',to:'3485',item:'PROVS'}`, logisticsContext);
const newUnitLogistics = vm.runInContext(`transferScreenLiveLogistics('3485')`, logisticsContext);
assert.equal(newUnitLogistics.capacity, 1260, 'A newly created unit must show carrying capacity based on staged people and pack animals.');
assert.equal(newUnitLogistics.eaters, 12, 'A newly created unit must calculate its provision consumption from staged population.');
assert.equal(newUnitLogistics.months, 200, 'A newly created unit must show months of provisions from staged transfers.');
assert.equal(newUnitLogistics.waterPerMonth, 200, 'A newly created unit must calculate staged water consumption.');
assert.equal(newUnitLogistics.fodderPerMonth, 28, 'A newly created unit must calculate staged fodder consumption.');
const provisionMode = vm.runInContext(`transferScreenProvisionContext()`, logisticsContext);
assert.equal(provisionMode.monthlyConsumption, 12, 'The provisions months option must use the receiving unit consumption.');
assert.equal(provisionMode.currentMonths, 200, 'The provisions months option must reflect already staged provisions.');
vm.runInContext(`transferScreenItemDraft={from:'0485',to:'3485',item:'WATER'}`, logisticsContext);
const waterMode = vm.runInContext(`transferScreenProvisionContext()`, logisticsContext);
assert.equal(waterMode.monthlyConsumption, 200, 'The water months option must use the receiving unit water consumption.');
assert.equal(waterMode.kind, 'water');
vm.runInContext(`transferScreenItemDraft={from:'0485',to:'3485',item:'FODDER'}`, logisticsContext);
const fodderMode = vm.runInContext(`transferScreenProvisionContext()`, logisticsContext);
assert.equal(fodderMode.monthlyConsumption, 28, 'The fodder months option must use the receiving unit fodder consumption.');
assert.equal(fodderMode.kind, 'fodder');
vm.runInContext(`transferScreenItemDraft={from:'0485',to:'3485',item:'GOLD'}`, logisticsContext);
assert.equal(vm.runInContext(`transferScreenProvisionContext()`, logisticsContext), null, 'Months must not be available for ordinary goods.');
assert.match(transferScreen, /transferScreenSetProvisionMode\('months'\)/, 'Provisions must support transfer amounts expressed as months.');
assert.match(transferScreen, /Math\.ceil\(inputValue \* provisionContext\.monthlyConsumption - provisionContext\.destinationBefore\)/, 'A selected number of months must calculate the provision quantity from the receiver consumption.');

console.log('Turn action UI regression tests passed');

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('src/results-map.js', 'utf8');
const values = new Map();
const element = () => ({
  addEventListener() {},
  classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {},
  innerHTML: '',
  value: '',
  textContent: '',
  disabled: false
});
for (const id of [
  'turnSelect', 'terrainSelect', 'notesInput', 'saveHexButton', 'fogHexButton',
  'noSelection', 'selectionEditor', 'selectedCoordinate', 'selectedState',
  'saveStatus', 'hexHistoryList', 'historyTurnContext', 'mapResultSlider',
  'mapResultPrev', 'mapResultNext', 'mapResultPlay', 'mapResultPlayTurn',
  'mapResultTurnLabel', 'mapResultStatus', 'mapImportResultsButton',
  'planningToggle', 'planStatus'
]) values.set(id, element());

const targetRows = [{ coordinate: 'AA0101', terrain: 'GH', discoveredTurn: '1-02' }];
const planning = { turnKey: '1-03', isPlanningTurn: true, baselineTurnKey: '1-02', units: [] };
const actual = {
  turnKey: '1-02', turnSort: 2, sourceFile: 'results.docx',
  units: [{ unitCode: 'T1', unitType: 'Tribe', currentHex: 'AA0101' }], events: []
};
let drawCalls = 0;
let startedWithStaging = null;

const context = {
  console, Map, Set, Number, String, Object, JSON, Date, Math, Promise,
  window: null,
  addEventListener() {},
  document: { getElementById: id => values.get(id) || null, createElement: () => element() },
  $: id => values.get(id) || element(),
  localStorage: { setItem() {}, getItem() { return null; } },
  setTimeout, clearTimeout,
  state: { mode: 'detail', hexCache: new Map(), summaries: new Map(), loadedArea: null, selected: null, planImport: null, routeCache: null, planningVisible: true },
  requestVisibleData() {},
  refreshSummaries: async () => {},
  draw: () => { drawCalls += 1; },
  selectHex: async () => {},
  loadHexHistory: async () => {},
  refreshPlannerHistory: async () => {},
  buildPlanRoutes: () => ({ movements: [], scouts: [] }),
  updatePlanUI() {},
  escapeHtml: value => String(value),
  visibleBounds: () => ({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 }),
  areaRequestTimer: null,
  parseCoordinate: value => ({ coordinate: String(value), globalCol: 0, globalRow: 0 }),
  coordinateFor: (col, row) => `AA${String(col + 1).padStart(2, '0')}${String(row + 1).padStart(2, '0')}`,
  baseCenter: () => ({ x: 0, y: 0 }),
  screenFromBase: point => point,
  drawUnitLabel() {},
  ctx: { save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, fillText() {} },
  buildWorldGrid() {},
  showMapper() {},
  showDetail() {},
  centerOnHex() {},
  stopResultsPlayback() {},
  stopMapResultPlayback() {},
  lifecycleDecoratePlanningUI() {},
  setHistoricalEditingState() {},
  startResultsPlayback: async () => {
    startedWithStaging = context.resultsTimeline.transitionStaging;
    context.draw();
    await context.advanceToNextStartState('1-02');
    return true;
  },
  tribenet: {
    async importResultsReport() { return { turn: actual }; },
    async listResultTurns() { return [actual, planning]; },
    async getResultTurn(turnKey) { return String(turnKey) === '1-02' ? actual : planning; },
    async getPlannerImports() { return []; },
    async getResultSubmapSummaries() { return []; },
    async getResultHexesInArea() { return targetRows; }
  }
};
context.window = context;
vm.runInNewContext(`${source}\n;globalThis.__test={playImportedResultsTransition,applyResultTurn,importMapResultsReport};`, context, { filename: 'results-map.js' });

(async () => {
  await new Promise(resolve => setTimeout(resolve, 140));
  await context.__test.importMapResultsReport();
  assert.strictEqual(startedWithStaging, false, 'Playback should start only after staging draws are released');
  assert.ok(drawCalls > 0, 'Playback handoff should leave a drawable map state');
  assert.strictEqual(context.resultsTimeline.transitionStaging, false, 'Staging guard must always be released');
  assert.strictEqual(context.resultsTimeline.turn.turnKey, '1-03');
  assert.strictEqual(context.resultsTimeline.turn.isStartState, true);
  assert.strictEqual(context.resultsTimeline.turn.knowledgeTurnKey, '1-02');
  console.log('Results upload staging and playback handoff regression tests passed');
})();

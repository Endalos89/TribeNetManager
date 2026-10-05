const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('src/results-map.js', 'utf8');
const values = new Map();
const element = () => ({
  addEventListener() {},
  classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {},
  insertAdjacentElement() {},
  innerHTML: '',
  value: '',
  textContent: '',
  disabled: false,
  checked: false
});
for (const id of [
  'turnSelect', 'terrainSelect', 'notesInput', 'saveHexButton', 'fogHexButton',
  'noSelection', 'selectionEditor', 'selectedCoordinate', 'selectedState',
  'saveStatus', 'hexHistoryList', 'historyTurnContext', 'mapResultSlider',
  'mapResultPrev', 'mapResultNext', 'mapResultPlay', 'mapResultPlayTurn',
  'mapResultTurnLabel', 'mapResultStatus', 'mapImportResultsButton',
  'planningToggle', 'planStatus', 'unitEditor'
]) values.set(id, element());

const startHex = { coordinate: 'PK1614', terrain: 'PR', knowledgeLevel: 'visited', discoveredTurn: '906-02', globalCol: 0, globalRow: 0 };
const discoveries02 = [
  startHex,
  { coordinate: 'PK1613', terrain: 'GH', knowledgeLevel: 'scouted', discoveredTurn: '906-02', globalCol: 0, globalRow: 1 },
  { coordinate: 'PK1612', terrain: 'CH', knowledgeLevel: 'scouted', discoveredTurn: '906-02', globalCol: 0, globalRow: 2 }
];
const discoveries03 = [...discoveries02,
  { coordinate: 'PK1714', terrain: 'GH', knowledgeLevel: 'scouted', discoveredTurn: '906-03', globalCol: 1, globalRow: 0 }
];
const detail02 = {
  turnKey: '906-02', turnSort: 906002, sourceFile: '0485_906_02_Results.docx', metadata: { nextTurn: 'now' },
  units: [{ unitCode: '0485', unitType: 'Tribe', currentHex: 'PK1614', events: [] }], events: []
};
const detail03 = {
  turnKey: '906-03', turnSort: 906003, sourceFile: '0485_906_03_Results.docx', metadata: { nextTurn: '906-04' },
  units: [
    { unitCode: '0485', unitType: 'Tribe', previousHex: 'PK1614', currentHex: 'PK1714', events: [] },
    { unitCode: '0485e1', unitType: 'Element', previousHex: 'PK1614', currentHex: 'PK1612', events: [] }
  ], events: []
};
const summaries = [
  { turnKey: '906-02', turnSort: 906002, sourceFile: detail02.sourceFile, metadata: detail02.metadata },
  { turnKey: '906-03', turnSort: 906003, sourceFile: detail03.sourceFile, metadata: detail03.metadata }
];

const context = {
  console, Map, Set, Number, String, Object, JSON, Date, Math, Promise,
  window: null,
  addEventListener() {},
  document: { getElementById: id => values.get(id) || null, createElement: () => element() },
  $: id => values.get(id) || element(),
  localStorage: { setItem() {}, getItem() { return null; } },
  setTimeout, clearTimeout,
  state: { mode: 'detail', hexCache: new Map(), summaries: new Map(), loadedArea: null, selected: null, planImport: null, routeCache: null, planningVisible: false },
  requestVisibleData() {},
  refreshSummaries: async () => {},
  draw() {},
  selectHex: async () => {},
  loadHexHistory: async () => {},
  refreshPlannerHistory: async () => {},
  buildPlanRoutes: () => ({ movements: [], scouts: [] }),
  updatePlanUI() {},
  escapeHtml: value => String(value),
  visibleBounds: () => ({ minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 }),
  areaRequestTimer: null,
  parseCoordinate: value => ({ coordinate: String(value), globalCol: String(value) === 'PK1714' ? 1 : 0, globalRow: 0 }),
  coordinateFor: (col, row) => col === 1 ? 'PK1714' : `PK161${4 - row}`,
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
  tribenet: {
    async listResultTurns() { return summaries; },
    async getResultTurn(turnKey) { return String(turnKey) === '906-02' ? detail02 : String(turnKey) === '906-03' ? detail03 : null; },
    async getPlannerImports() { return []; },
    async getResultSubmapSummaries() { return []; },
    async getResultHexesInArea(_bounds, turnKey) { return String(turnKey) === '906-02' ? discoveries02 : discoveries03; },
    async getResultHexHistory() { return []; }
  }
};
context.window = context;
vm.runInNewContext(`${source}\n;globalThis.__test={applyResultTurn,advanceToNextStartState};`, context, { filename: 'results-map.js' });

(async () => {
  await new Promise(resolve => setTimeout(resolve, 160));

  await context.__test.applyResultTurn('906-02');
  assert.strictEqual(context.resultsTimeline.turn.turnKey, '906-02');
  assert.strictEqual(context.resultsTimeline.turn.isStartState, true);
  assert.strictEqual(context.resultsTimeline.turn.eventTurnKey, '906-02');
  assert.strictEqual(context.resultsTimeline.turn.knowledgeTurnKey, null);
  assert.strictEqual(context.resultsTimeline.turn.units[0].currentHex, 'PK1614');
  assert.strictEqual(context.resultsTimeline.turn.startHexKnowledge.length, 1);
  assert.strictEqual(context.resultsTimeline.turn.startHexKnowledge[0].coordinate, 'PK1614');

  await context.__test.advanceToNextStartState('906-02');
  assert.strictEqual(context.resultsTimeline.turn.turnKey, '906-03');
  assert.strictEqual(context.resultsTimeline.turn.eventTurnKey, '906-03');
  assert.strictEqual(context.resultsTimeline.turn.knowledgeTurnKey, '906-02');
  assert.strictEqual(context.resultsTimeline.turn.units[0].currentHex, 'PK1614');
  assert.strictEqual(context.resultsTimeline.turn.units.find(unit => unit.unitCode === '0485e1').currentHex, 'PK1614');

  console.log('Results start-state and multi-turn handoff regression tests passed');
})();

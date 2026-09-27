const assert = require('assert');
const { SNAPSHOT_VERSION, normalizeView } = require('../src/update-view-state');

(function restoresLauncherByDefault() {
  assert.deepEqual(normalizeView(null), { snapshotVersion: SNAPSHOT_VERSION, page: 'index.html', screen: 'launcher' });
  assert.deepEqual(normalizeView({ page: 'unexpected.html' }), { snapshotVersion: SNAPSHOT_VERSION, page: 'index.html', screen: 'launcher' });
})();

(function preservesMapperSessionState() {
  const route = {
    status: 'ok',
    origin: 'AA0101',
    actualTarget: 'AA0301',
    directions: ['SE', 'NE'],
    path: [{ coordinate: 'AA0101' }, { coordinate: 'AA0201' }, { coordinate: 'AA0301' }],
    knownMp: 6,
    unknownEntryCount: 0
  };
  const input = {
    page: 'index.html',
    screen: 'mapper',
    mode: 'detail',
    resultTurnKey: '048-12',
    planImportId: 9,
    map: { cameraX: 81.5, cameraY: 47.25, scale: 41, planningVisible: true, scoutingVisible: false },
    selection: { kind: 'hex', coordinate: 'AA0301' },
    movementPlanner: {
      active: true,
      origin: { coordinate: 'AA0101', globalCol: 0, globalRow: 0 },
      route,
      selectedUnitCode: '0485E1',
      routeType: 'scout',
      scoutOriginMode: 'current'
    },
    draftFields: { notesInput: 'Unsaved report note' },
    scrolls: { hexHistoryList: { top: 125, left: 0 } },
    focusId: 'notesInput'
  };
  const normalized = normalizeView(input);
  assert.equal(normalized.snapshotVersion, SNAPSHOT_VERSION);
  assert.equal(normalized.page, 'index.html');
  assert.equal(normalized.screen, 'mapper');
  assert.equal(normalized.mode, 'detail');
  assert.equal(normalized.resultTurnKey, '048-12');
  assert.equal(normalized.map.cameraX, 81.5);
  assert.deepEqual(normalized.movementPlanner.route.directions, ['SE', 'NE']);
  assert.equal(normalized.draftFields.notesInput, 'Unsaved report note');
  assert.equal(normalized.focusId, 'notesInput');
})();

(function preservesManagerDrafts() {
  const turn = normalizeView({
    page: 'turn-manager.html',
    turnKey: '048-12',
    unitCode: '0485E1',
    turnManager: { activityCode: 'FORESTRY' },
    draftFields: { activityPeople: '20', activityNotes: 'Use bone axes', turnContext: 'Unsaved context' },
    scrolls: { unitList: { top: 80, left: 0 } }
  });
  assert.equal(turn.screen, 'turn-manager');
  assert.equal(turn.turnKey, '048-12');
  assert.equal(turn.unitCode, '0485E1');
  assert.equal(turn.turnManager.activityCode, 'FORESTRY');
  assert.equal(turn.draftFields.activityNotes, 'Use bone axes');

  const tribe = normalizeView({
    page: 'tribe-manager.html',
    turnKey: '048-12',
    unitCode: '0485',
    scrolls: { unitList: { top: 40, left: 0 } }
  });
  assert.equal(tribe.screen, 'tribe-manager');
  assert.equal(tribe.turnKey, '048-12');
  assert.equal(tribe.unitCode, '0485');
})();

(function capsOversizedSnapshots() {
  const oversized = { page: 'index.html', screen: 'mapper', huge: 'x'.repeat(600 * 1024) };
  assert.deepEqual(normalizeView(oversized), { snapshotVersion: SNAPSHOT_VERSION, page: 'index.html', screen: 'launcher' });
})();

console.log('update-view-state tests passed');

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TribeNetDatabase } = require('../src/database');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-turn-plan-test-'));
const db = new TribeNetDatabase(tempRoot);

function plan(turnKey, sourceFile, marker, importedAt) {
  return {
    turnKey,
    sourceFile,
    importedAt,
    marker,
    movements: [],
    scouts: [],
    unitStats: [],
    transfers: [],
    unitCreations: []
  };
}

try {
  const turn2First = db.saveTurnPlan(plan('906-02', '906-02-a.xlsx', 'turn2-first', '2026-09-01T10:00:00.000Z'));
  const turn3 = db.saveTurnPlan(plan('906-03', '906-03.xlsx', 'turn3', '2026-09-02T10:00:00.000Z'));
  const turn2Latest = db.saveTurnPlan(plan('906-02', '906-02-b.xlsx', 'turn2-latest', '2026-09-03T10:00:00.000Z'));

  // Global active plan is the most recently imported plan, but historical overlays must ignore it.
  assert.strictEqual(db.getTurnPlan().id, turn2Latest.id);

  const turn2Imports = db.getTurnImports('906-02');
  assert.deepStrictEqual(turn2Imports.map(row => row.id), [turn2Latest.id, turn2First.id]);
  assert(turn2Imports.every(row => row.turnKey === '906-02'));

  const turn3Imports = db.getTurnImports('906-03');
  assert.deepStrictEqual(turn3Imports.map(row => row.id), [turn3.id]);

  const selectedTurn2 = db.getTurnPlanForTurn('906-02');
  assert.strictEqual(selectedTurn2.id, turn2Latest.id);
  assert.strictEqual(selectedTurn2.plan.marker, 'turn2-latest');

  const selectedTurn3 = db.getTurnPlanForTurn('906-03');
  assert.strictEqual(selectedTurn3.id, turn3.id);
  assert.strictEqual(selectedTurn3.plan.marker, 'turn3');

  // A new/latest results turn with no imported plan must be empty rather than inheriting another turn.
  assert.strictEqual(db.getTurnPlanForTurn('906-04'), null);
  assert.deepStrictEqual(db.getTurnImports('906-04'), []);

  console.log('Turn-scoped planner regression tests passed.');
} finally {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

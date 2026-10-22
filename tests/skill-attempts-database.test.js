const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TurnManagerDatabase } = require('../src/turn-manager-database');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-skill-attempts-'));
let db;
try {
  db = new TurnManagerDatabase(userData);
  const selected = db.saveSkillAttempts('906-06', '0485', [
    { order:1, skill:'Engineering', group:'C', baselineLevel:9 }
  ]);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].skill, 'Engineering');
  db.setSkillStreak('0485', 'Engineering', 10, '906-05');
  assert.deepStrictEqual(db.reconcileSkillAttemptResults('906-06', {
    '0485': [{ skill:'Engineering', level:9 }]
  }), { reconciled:true, updated:1 });
  assert.strictEqual(db.getSkillStreaks('0485')[0].failureCount, 11);
  assert.deepStrictEqual(db.reconcileSkillAttemptResults('906-06', {
    '0485': [{ skill:'Engineering', level:9 }]
  }), { reconciled:false, updated:0 });
} finally {
  db?.close();
  fs.rmSync(userData, { recursive:true, force:true });
}

console.log('Skill attempt database tests passed.');

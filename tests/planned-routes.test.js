const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PlannedRoutesDatabase } = require('../src/planned-routes-database');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-planned-routes-'));
const db = new PlannedRoutesDatabase(tempRoot);

function route(overrides = {}) {
  return {
    turnKey: '27',
    tribeCode: '0485',
    unitCode: '0485',
    routeType: 'unit',
    originHex: 'AA0101',
    destinationHex: 'AA0102',
    directions: ['S'],
    path: [
      { coordinate: 'AA0101', globalCol: 0, globalRow: 0, terrain: 'PR' },
      { coordinate: 'AA0102', globalCol: 0, globalRow: 1, terrain: 'PR' }
    ],
    knownMp: 3,
    unknownEntryCount: 0,
    ...overrides
  };
}

try {
  const firstMove = db.save(route());
  assert.equal(firstMove.routeType, 'unit');
  const replacedMove = db.save(route({ destinationHex: 'AA0103', directions: ['S', 'S'], knownMp: 6 }));
  assert.equal(firstMove.id, replacedMove.id, 'unit move should replace the existing move for that unit/turn');
  assert.equal(db.list('27').filter(item => item.routeType === 'unit').length, 1);

  for (let i = 0; i < 8; i++) {
    const unitCode = i % 2 ? '0485E1' : '0485';
    const saved = db.save(route({
      unitCode,
      routeType: 'scout',
      destinationHex: `AA${String(i + 2).padStart(2, '0')}02`
    }));
    assert.equal(saved.scoutNumber, i + 1, 'scouts should be numbered across the whole Tribe group');
  }

  const scouts = db.list('27').filter(item => item.routeType === 'scout');
  assert.equal(scouts.length, 8);
  assert.deepEqual(scouts.map(item => item.scoutNumber), [1,2,3,4,5,6,7,8]);
  assert.throws(
    () => db.save(route({ unitCode: '0485E2', routeType: 'scout' })),
    /maximum 8 scout moves/i,
    'Tribe plus linked Elements must share the eight-scout cap'
  );

  const otherTribe = db.save(route({ tribeCode: '1485', unitCode: '1485', routeType: 'scout' }));
  assert.equal(otherTribe.scoutNumber, 1, 'another Tribe gets its own eight-scout allowance');

  db.remove(scouts[2].id);
  const reused = db.save(route({ unitCode: '0485E2', routeType: 'scout' }));
  assert.equal(reused.scoutNumber, 3, 'removing a scout should free that scout slot');

  console.log('planned-routes tests passed');
} finally {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

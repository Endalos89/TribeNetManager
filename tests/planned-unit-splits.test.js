const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TurnManagerDatabase } = require('../src/turn-manager-database');
const { PlannedRoutesDatabase } = require('../src/planned-routes-database');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-unit-splits-'));
const turns = new TurnManagerDatabase(temp);
const routes = new PlannedRoutesDatabase(temp);

try {
  turns.saveWorkbook({
    role: 'start',
    turnKey: '048-12',
    sourceFile: '048_12_start.xlsx',
    importedAt: '2026-09-27T00:00:00.000Z',
    units: [
      { unit: '0485', type: 'Tribe', unitName: 'Main', startHex: 'PK1711', warrior: 100, active: 200 },
      { unit: '0485e9', type: 'Element', unitName: 'Existing', startHex: 'PK1711' }
    ]
  });

  const element = turns.addUnitSplit('048-12', {
    parentUnit: '0485',
    unitCode: '0485e1',
    unitType: 'Element',
    unitName: 'Forestry Party'
  });
  assert.equal(element.parentUnit, '0485');
  assert.equal(element.unitCode, '0485e1');
  assert.equal(element.unitType, 'Element');
  assert.equal(element.startHex, 'PK1711', 'split should use parent beginning-of-turn hex');

  const tribe = turns.addUnitSplit('048-12', {
    parentUnit: '0485',
    unitCode: '1485',
    unitType: 'Tribe'
  });
  assert.equal(tribe.startHex, 'PK1711');
  assert.equal(turns.getTurn('048-12').unitSplits.length, 2);

  assert.throws(() => turns.addUnitSplit('048-12', {
    parentUnit: '0485', unitCode: '9999e1', unitType: 'Element'
  }), /must use a code such as 0485e1/i);

  assert.throws(() => turns.addUnitSplit('048-12', {
    parentUnit: '0485e9', unitCode: '2485', unitType: 'Tribe'
  }), /parent must be an existing Tribe/i);

  routes.save({
    turnKey: '048-12',
    tribeCode: '0485',
    unitCode: '0485e1',
    routeType: 'unit',
    originHex: 'PK1711',
    destinationHex: 'PK1712',
    directions: ['S'],
    path: [
      { coordinate: 'PK1711', globalCol: 0, globalRow: 0 },
      { coordinate: 'PK1712', globalCol: 0, globalRow: 1 }
    ],
    knownMp: 6,
    unknownEntryCount: 0
  });
  assert.equal(routes.list('048-12').filter(row => row.unitCode === '0485e1').length, 1);
  assert.equal(routes.removeForUnit('048-12', '0485e1'), 1);
  assert.equal(routes.list('048-12').filter(row => row.unitCode === '0485e1').length, 0);

  const removed = turns.deleteUnitSplit(element.id);
  assert.equal(removed.unitCode, '0485e1');
  assert.equal(turns.listUnitSplits('048-12').length, 1);

  console.log('planned unit split tests passed');
} finally {
  routes.close();
  turns.close();
  fs.rmSync(temp, { recursive: true, force: true });
}

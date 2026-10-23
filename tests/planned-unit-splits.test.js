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
    unitType: 'Element',
    unitName: 'Forestry Party'
  });
  assert.equal(element.parentUnit, '0485');
  assert.equal(element.unitCode, '0485e1');
  assert.equal(element.unitType, 'Element');
  assert.equal(element.unitCode, '0485e1', 'Element code should be assigned automatically');
  assert.equal(element.startHex, 'PK1711', 'split should use parent beginning-of-turn hex');
  const transfer = turns.addTransfer('048-12', { from:'0485', to:'0485e1', item:'WARRIORS', quantity:20, timing:'BM' });
  assert.equal(transfer.from, '0485');
  assert.equal(transfer.timing, 'BM');
  assert.equal(turns.listTransfers('048-12').length, 1);
  assert.equal(turns.deleteTransfer(transfer.id).item, 'WARRIORS');
  assert.throws(() => turns.addTransfer('048-12', { from:'0485', to:'0485', item:'WAGON', quantity:1 }), /different units/);
  turns.addTransfer('048-12', { from:'0485', to:'0485e1', item:'LOG', quantity:80, timing:'BM' });
  turns.addTransfer('048-12', { from:'0485e1', to:'0485', item:'WAGON', quantity:2, timing:'BM' });
  turns.addTransfer('048-12', { from:'0485', to:'0485e1', item:'PROVS', quantity:12, timing:'AM' });
  turns.addTransfer('048-12', { from:'0485', to:'1485', item:'ACTIVES', quantity:5, timing:'BM' });
  const replacedTransfers = turns.replaceTransferGroup('048-12', '0485', '0485e1', 'BM', [
    { from:'0485', to:'0485e1', item:'LOG', quantity:100, timing:'BM' },
    { from:'0485e1', to:'0485', item:'WAGON', quantity:1, timing:'BM' }
  ]);
  assert.equal(replacedTransfers.length, 2, 'Saving a transfer session should replace both directions for the selected pair and phase.');
  const transferRows = rows => rows.map(row => [row.from, row.to, row.item, row.quantity, row.timing]).sort((a, b) => a.join('|').localeCompare(b.join('|')));
  assert.deepEqual(transferRows(turns.listTransfers('048-12')), transferRows([
    ['0485', '0485e1', 'LOG', 100, 'BM'],
    ['0485e1', '0485', 'WAGON', 1, 'BM'],
    ['0485', '0485e1', 'PROVS', 12, 'AM'],
    ['0485', '1485', 'ACTIVES', 5, 'BM']
  ].map(([from, to, item, quantity, timing]) => ({ from, to, item, quantity, timing }))), 'Transfers in another phase or between another pair must remain intact.');
  turns.replaceTransferGroup('048-12', '0485', '0485e1', 'BM', []);
  assert.equal(turns.listTransfers('048-12').length, 2, 'Saving an empty group should clear only that pair and phase.');
  assert.equal(turns.deleteAllTransfers('048-12').length, 2, 'The turn-wide cancel action should remove every remaining transfer.');
  assert.equal(turns.listTransfers('048-12').length, 0);
  assert.equal(element.creationPhase, 'before', 'before movement is the default creation phase');

  const afterElement = turns.addUnitSplit('048-12', {
    parentUnit: '0485', unitType: 'Element', creationPhase: 'after'
  });
  assert.equal(afterElement.unitCode, '0485e2', 'The next free Element code should be assigned');
  assert.equal(afterElement.creationPhase, 'after', 'after movement timing should persist');
  turns.addTransfer('048-12', { from:'0485', to:afterElement.unitCode, item:'PROVS', quantity:12, timing:'AM' });
  turns.addTransfer('048-12', { from:afterElement.unitCode, to:'0485', item:'WAGON', quantity:1, timing:'BM' });
  turns.addTransfer('048-12', { from:'0485', to:'1485', item:'ACTIVES', quantity:3, timing:'BM' });
  turns.deleteUnitSplit(afterElement.id);
  assert.equal(turns.listTransfers('048-12').some(row => row.from === afterElement.unitCode || row.to === afterElement.unitCode), false, 'Cancelling a created unit must remove transfers to and from that unit.');
  assert.equal(turns.listTransfers('048-12').length, 1, 'Cancelling a created unit must preserve transfers between other units.');
  turns.deleteAllTransfers('048-12');

  const tribe = turns.addUnitSplit('048-12', {
    parentUnit: '0485',
    unitType: 'Tribe'
  });
  assert.equal(tribe.unitCode, '1485', 'The next free numeric Tribe code should be assigned');
  assert.equal(tribe.startHex, 'PK1711');
  assert.equal(turns.getTurn('048-12').unitSplits.length, 2);

  turns.saveWorkbook({ role:'start', turnKey:'050-12', sourceFile:'050_start.xlsx', importedAt:'2026-09-27T00:00:00.000Z', units:[{unit:'0485',type:'Tribe',startHex:'PK1711'}] });
  for (const code of ['1485','2485','3485']) {
    turns.addUnitSplit('050-12', { parentUnit:'0485', unitCode:code, unitType:'Tribe' });
  }
  const nextTribe = turns.addUnitSplit('050-12', { parentUnit:'0485', unitType:'Tribe' });
  assert.equal(nextTribe.unitCode, '4485', 'Automatic Tribe codes must skip codes already planned for the turn.');

  assert.throws(() => turns.addUnitSplit('048-12', {
    parentUnit: '0485', unitCode: '9999e1', unitType: 'Element'
  }), /must use a code such as 0485e1/i);

  assert.throws(() => turns.addUnitSplit('048-12', {
    parentUnit: '0485e9', unitCode: '2485', unitType: 'Tribe'
  }), /parent must be an existing Tribe/i);

  turns.saveWorkbook({
    role: 'start',
    turnKey: '049-12',
    sourceFile: '049_12_start.xlsx',
    importedAt: '2026-09-27T00:00:00.000Z',
    skillsByTribe: {
      '0490': [
        { skill: 'Administration', level: 2 },
        { skill: 'Diplomacy', level: 2 },
        { skill: 'Courier', level: 1 },
        { skill: 'Woodworking', level: 3 }
      ]
    },
    units: [{ unit: '0490', type: 'Tribe', startHex: 'PK1711' }]
  });
  const generatedElement = turns.addUnitSplit('049-12', { parentUnit: '0490', unitType: 'Element', skills: [] });
  assert.equal(generatedElement.unitCode, '0490e1');
  assert.throws(() => turns.addUnitSplit('049-12', { parentUnit: '0490', unitCode: '0490f1', unitType: 'Fleet' }), /Administration 2 allows 1/i);
  assert.equal(turns.addUnitSplit('049-12', { parentUnit: '0490', unitCode: '1490', unitType: 'Tribe', skills: [{ skill: 'Woodworking' }] }).skills[0].level, 3);
  assert.throws(() => turns.addUnitSplit('049-12', { parentUnit: '0490', unitCode: '2490', unitType: 'Tribe' }), /Diplomacy 2 allows 2/i);
  const generatedCourier = turns.addUnitSplit('049-12', { parentUnit: '0490', unitType: 'Courier' });
  assert.equal(generatedCourier.unitCode, '0490c1');
  assert.equal(generatedCourier.unitType, 'Courier');
  assert.throws(() => turns.addUnitSplit('049-12', { parentUnit: '0490', unitCode: '0490c2', unitType: 'Courier' }), /Courier 1 allows 1/i);
  const generatedGarrison = turns.addUnitSplit('049-12', { parentUnit: '0490', unitType: 'Garrison' });
  assert.equal(generatedGarrison.unitCode, '0490g1');

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

  // Older builds could save the same planning turn without a zero-padded
  // month. Deleting the visible split must remove that alias too, otherwise
  // the deleted unit remains in exports and blocks recreating its code.
  const now = new Date().toISOString();
  turns.db.prepare(`
    INSERT INTO planned_unit_splits(turn_key, parent_unit, unit_code, unit_type, unit_name, start_hex, creation_phase, skills_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('048-012', '0485', '0485e1', 'Element', 'Legacy alias', 'PK1711', 'before', '[]', now, now);
  assert.equal(turns.listUnitSplits('048-12').filter(row => row.unitCode === '0485e1').length, 2);

  const removed = turns.deleteUnitSplit(element.id);
  assert.equal(removed.unitCode, '0485e1');
  assert.equal(turns.listUnitSplits('048-12').filter(row => row.unitCode === '0485e1').length, 0);

  const recreated = turns.addUnitSplit('048-12', {
    parentUnit: '0485', unitCode: '0485e1', unitType: 'Element', unitName: 'Recreated'
  });
  assert.equal(recreated.unitCode, '0485e1');
  turns.deleteUnitSplit(recreated.id);

  const removedAll = turns.deleteAllUnitSplits('048-12');
  assert.equal(removedAll.length, 1);
  assert.equal(removedAll[0].unitCode, '1485');
  assert.equal(turns.listUnitSplits('048-12').length, 0);

  console.log('planned unit split tests passed');
} finally {
  routes.close();
  turns.close();
  fs.rmSync(temp, { recursive: true, force: true });
}

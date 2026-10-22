const assert = require('assert');
const { buildOrdersExportData } = require('../src/orders-export-data');

const data = buildOrdersExportData({
  baselineUnits: [
    { unit: '0485', type: 'Tribe', unitName: 'Vanguard' },
    { unit: '0485e1', type: 'Element', unitName: 'Element One' }
  ],
  routeGroups: [
    [
      { routeType: 'unit', unitCode: '0485', directions: ['N', 'SE'] },
      { routeType: 'scout', unitCode: '0485', scoutNumber: 1, noOfScouts: 2, noOfHorses: 2, mission: 'PATROL', directions: ['FOL'] },
      { routeType: 'unit', unitCode: '0485e1', directions: ['Still'] }
    ],
    [
      { routeType: 'unit', unitCode: '0485', directions: ['S'] },
      { routeType: 'scout', unitCode: '0485', scoutNumber: 1, noOfScouts: 1, directions: ['N'] }
    ]
  ],
  splitGroups: [
    [{ unitCode: '1485', unitType: 'Tribe', unitName: 'New Tribe', parentUnit: '0485', startHex: 'AA0101', skills: [{ skill: 'Woodworking', level: 3 }] }],
    [{ unitCode: '1485', unitType: 'Tribe', unitName: 'Stale Legacy', parentUnit: '0485', startHex: 'AA0101' }]
  ],
  skillAttempts: [
    { tribe:'1485', order:2, topic:'Engineering', group:'C', baselineLevel:3 },
    { tribe:'0485', order:1, topic:'Diplomacy', group:'B', baselineLevel:2 }
  ]
});

assert.deepEqual(data.movements.map(row => [row.unitCode, row.directions]), [
  ['0485', ['N', 'SE']],
  ['0485e1', ['Still']],
  ['1485', ['Still']]
]);
assert.deepEqual(data.scouts.map(row => [row.unitCode, row.scoutNumber, row.directions]), [['0485', 1, ['FOL']]]);
assert.ok(data.validUnits.some(row => row.unitCode === '1485' && row.unitName === 'New Tribe'));
assert.deepEqual(data.gmActions.map(row => row.text), [
  'Create Tribe 1485 from 0485 after movement',
  'Skill Woodworking 3 should be moved from Tribe 0485 to Tribe 1485'
]);
assert.deepEqual(data.skillAttempts.map(row => [row.tribe, row.order, row.topic]), [
  ['0485', 1, 'Diplomacy'],
  ['1485', 2, 'Engineering']
]);

console.log('orders export data tests passed');

'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseResultText, parseCoordinate, stepCoordinate } = require('../src/result-report-parser');
const { ResultsDatabase } = require('../src/results-database');
const G = require('../src/isometric-core');
const movement = require('../src/movement-planner-core');

// Reports describe passes on shared hexsides, never as standalone terrain.
const report = parseResultText([
  'Element 0485e1, , Current Hex = PK 1508, (Previous Hex = PK 1710)',
  'Current Turn 906-07 (#79), Autumn, FINE',
  'Scout 7:Scout SW-CH, Lcm S,Pass S\\NW-CH\\',
  '0485e1 Status: LOW CONIFER MOUNTAINS, 0485e1',
  'Humans',
  'People\t38'
].join('\n'), '906-07.docx');
const sourceHex = stepCoordinate('PK1508', 'SW');
const mountainHex = stepCoordinate(sourceHex, 'S');
const from = report.hexKnowledge.find(hex => hex.coordinate === sourceHex);
const to = report.hexKnowledge.find(hex => hex.coordinate === mountainHex);
assert(from && to, 'Both sides of the discovered pass should be recorded');
assert(from.passes.includes('S'), 'Pass should be on the source south hexside');
assert(to.passes.includes('N'), 'The neighbouring mountain mirrors the pass');
assert.equal(to.terrain, 'LCM', 'Mountain terrain code must be unchanged');

const lowWithPass = [
  { coordinate: sourceHex, terrain: 'CH', passes: ['S'] },
  { coordinate: mountainHex, terrain: 'LCM', passes: ['N'] }
];
const lowNoPass = lowWithPass.map(row => ({ ...row, passes: [] }));
const lowRoute = movement.findFastestRoute(lowWithPass, sourceHex, mountainHex);
assert.equal(lowRoute.status, 'ok');
assert.equal(lowRoute.totalMp, 7, 'Low Mountain Pass costs 7 MP');
assert.equal(lowRoute.path[1].viaPass, true);
assert.equal(movement.findFastestRoute(lowNoPass, sourceHex, mountainHex).totalMp, 10);
const highWithPass = lowWithPass.map(row => row.coordinate === mountainHex ? { ...row, terrain: 'HSM' } : row);
assert.equal(movement.findFastestRoute(highWithPass, sourceHex, mountainHex).totalMp, 8,
  'High Mountain Pass costs 8 MP');
assert.equal(movement.findFastestRoute(highWithPass.map(row => ({ ...row, passes: [] })),
  sourceHex, mountainHex).status, 'target-impassable');
const southHex = stepCoordinate(mountainHex, 'S');
assert.equal(movement.findFastestRoute([
  { coordinate: southHex, terrain: 'PR', passes: [] },
  { coordinate: mountainHex, terrain: 'HSM', passes: ['N'] }
], southHex, mountainHex).status, 'no-route',
'Pass N must not open the southern edge');

// The heightfield must create a real, lowered saddle without flattening
// mountain terrain elsewhere.
const srcPoint = parseCoordinate(sourceHex), mountainPoint = parseCoordinate(mountainHex);
const centre = point => ({
  x: 1 + point.globalCol * 1.5,
  y: Math.sqrt(3) / 2 + Math.sqrt(3) * (point.globalRow + (point.globalCol % 2 ? .5 : 0))
});
const A = centre(mountainPoint), B = centre(srcPoint);
const length = Math.hypot(B.x - A.x, B.y - A.y);
const dx = (B.x - A.x) / length, dy = (B.y - A.y) / length;
const mountains = new Map([
  [srcPoint.globalCol + ':' + srcPoint.globalRow, { terrain: 'CH', passes: ['S'] }],
  [mountainPoint.globalCol + ':' + mountainPoint.globalRow, { terrain: 'LCM', passes: ['N'] }]
]);
const palette = terrain => ({ CH: '#6b8c56', LCM: '#5b8061' }[terrain] || '#999999');
const lookup = (c, r) => mountains.get(c + ':' + r) || null;
const compareHeight = point => {
  const withPass = G.surface(point.x, point.y, lookup, palette);
  const withoutPass = G.surface(point.x, point.y, (c, r) => {
    const row = lookup(c, r);
    return row ? { ...row, passes: [] } : null;
  }, palette);
  assert(!withPass.fog && !withoutPass.fog);
  return { withPass: withPass.z, withoutPass: withoutPass.z };
};
const onPass = compareHeight({ x: A.x + dx * .43, y: A.y + dy * .43 });
assert(onPass.withPass < onPass.withoutPass - .10,
  'Pass must be a visibly lower, physical terrain opening');
const away = compareHeight({ x: A.x + dx * .08 - dy * .42, y: A.y + dy * .08 + dx * .42 });
assert(Math.abs(away.withPass - away.withoutPass) < .00001,
  'Natural mountain relief outside the passage must be preserved');

// A later report visiting the same hex must not erase the pass.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-passes-'));
const db = new ResultsDatabase(dir);
try {
  db.saveReport(report);
  db.saveReport({
    turnKey: '906-08', turnSort: 906008, sourceFile: '906-08.docx',
    metadata: {}, units: [], events: [],
    hexKnowledge: [
      { coordinate: sourceHex, terrain: 'CH', knowledgeLevel: 'visited' },
      { coordinate: mountainHex, terrain: 'LCM', knowledgeLevel: 'visited' }
    ]
  });
  const grid = db.getHexesInArea({ minCol: 0, maxCol: 479, minRow: 0, maxRow: 545 }, '906-08');
  assert(grid.find(row => row.coordinate === sourceHex).passes.includes('S'));
  assert(grid.find(row => row.coordinate === mountainHex).passes.includes('N'));
  assert(db.getHexHistory(mountainHex).some(row => row.passes.includes('N')));
} finally {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Mountain pass parser, hexside, movement, geometry and persistence tests passed.');

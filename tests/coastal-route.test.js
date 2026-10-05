const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Execute the production route functions with a deliberately small map cache.
// This reproduces the reported layout: unit PK1711, known ocean PK1811, and
// the first potential unexplored coastal hex PK1810.
const source = fs.readFileSync('src/renderer.js', 'utf8');
const routeSource = source.slice(source.indexOf('function stepHex'), source.indexOf('function drawArrowSegment'));
const context = {
  Math, Map, Set, String, Number, Object, JSON, console,
  state: { hexCache: new Map() },
  TOTAL_COLS: 480, TOTAL_ROWS: 420, HEX_COLS: 30, HEX_ROWS: 21,
  parseCoordinate(input) {
    const match = String(input).match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
    if (!match) return null;
    const mapRow = match[1].charCodeAt(0) - 65;
    const mapCol = match[2].charCodeAt(0) - 65;
    const globalCol = mapCol * 30 + Number(match[3]) - 1;
    const globalRow = mapRow * 21 + Number(match[4]) - 1;
    return { coordinate: String(input), globalCol, globalRow };
  },
  coordinateFor(globalCol, globalRow) {
    const letter = index => String.fromCharCode(65 + index);
    return `${letter(Math.floor(globalRow / 21))}${letter(Math.floor(globalCol / 30))}${String(globalCol % 30 + 1).padStart(2, '0')}${String(globalRow % 21 + 1).padStart(2, '0')}`;
  }
};
context.globalThis = context;
vm.runInNewContext(`${routeSource}\n;globalThis.__test={routeFor};`, context, { filename: 'renderer-route-test.js' });

context.state.hexCache.set('PK1811', { coordinate: 'PK1811', terrain: 'O' });
const right = context.__test.routeFor('PK1711', ['FOR'], { label: 'T1' });
assert.strictEqual(right.points.at(-1).coordinate, 'PK1810');
assert.strictEqual(JSON.stringify(right.unresolved), '["FOR"]');

const left = context.__test.routeFor('PK1711', ['FOL'], { label: 'T1' });
assert.ok(left.points.at(-1).coordinate, 'FOL should still produce a deterministic coastal endpoint');
assert.strictEqual(JSON.stringify(left.unresolved), '["FOL"]');
console.log('Coastal FOR/FOL endpoint regression tests passed');

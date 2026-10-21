const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sustenance = require('../src/unit-sustenance');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src', 'selected-unit-panel.js'), 'utf8');

assert.deepStrictEqual(sustenance.dryTerrainRates({ ordinaryPeople:100, slaves:2, goats:3, dogs:4, cattle:5, horses:6, elephants:1 }), {
  waterPerTurn: 1295,
  fodderPerTurn: 88
});
assert.strictEqual(sustenance.reserveMonths(264, 88), 9);
assert.strictEqual(sustenance.reserveMonths(0, 20), 0);
assert.strictEqual(sustenance.reserveMonths(50, 0), null);

for (const key of ['overview','skills','sustenance','inventory','orders']) {
  assert.match(html, new RegExp(`data-unit-tab="${key}"`), `Missing ${key} tab`);
  assert.match(html, new RegExp(`data-unit-pane="${key}"`), `Missing ${key} panel`);
}
assert.match(html, /aria-label="Selected unit details"/);
assert.match(panel, /dry-terrain rates|dryTerrainRates/i);
assert.match(panel, /getUnitSupplyRequirements/);
assert.doesNotMatch(html, /openTribeManagerButton|results-timeline-link/);

console.log('Selected-unit panel and dry-terrain reserve tests passed.');

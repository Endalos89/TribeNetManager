const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sustenance = require('../src/unit-sustenance');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src', 'selected-unit-panel.js'), 'utf8');
const compendium = fs.readFileSync(path.join(root, 'src', 'compendium.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');

assert.deepStrictEqual(sustenance.dryTerrainRates({ ordinaryPeople:100, slaves:2, goats:3, dogs:4, cattle:5, horses:6, elephants:1 }), {
  waterPerTurn: 1295,
  fodderPerTurn: 88
});
assert.strictEqual(sustenance.reserveMonths(264, 88), 3);
assert.strictEqual(sustenance.reserveMonths(88, 88), 1);
assert.strictEqual(sustenance.reserveMonths(0, 20), 0);
assert.strictEqual(sustenance.reserveMonths(50, 0), null);
assert.strictEqual(sustenance.foodReserveStatus(0.99), 'critical');
assert.strictEqual(sustenance.foodReserveStatus(1), 'warning');
assert.strictEqual(sustenance.foodReserveStatus(2.99), 'warning');
assert.strictEqual(sustenance.foodReserveStatus(3), 'warning');
assert.strictEqual(sustenance.foodReserveStatus(3.99), 'warning');
assert.strictEqual(sustenance.foodReserveStatus(4), 'healthy');

for (const key of ['overview','skills','sustenance','inventory','orders']) {
  assert.match(html, new RegExp(`data-unit-tab="${key}"`), `Missing ${key} tab`);
  assert.match(html, new RegExp(`data-unit-pane="${key}"`), `Missing ${key} panel`);
}
assert.match(html, /aria-label="Selected unit details"/);
assert.match(panel, /dry-terrain rates|dryTerrainRates/i);
assert.match(panel, /getUnitSupplyRequirements/);
assert.match(panel, /provisionTurns\)\} months/);
assert.match(panel, /foodReserveStatus\(provisionTurns\)/);
assert.match(html, /id="unitFoodReserveCard"[\s\S]*?id="unitProvisionTurnCount"/);
assert.match(html, /data-unit-pane="inventory"[\s\S]*?Carrying capacity &amp; load/);
assert.match(panel, /data-compendium-entry/);
assert.match(compendium, /restoreRequestedEntry/);
assert.match(panel, /openCompendium\(entry, key\)/);
assert.match(preload, /openCompendium: \(entry, key\) => ipcRenderer\.invoke\('app:open-compendium', entry, key\)/);
assert.match(main, /function openCompendiumWindow\(entry, key\)/);
assert.match(main, /parent: mainWindow/);
assert.match(main, /compendiumWindow\.loadFile\(path\.join\(__dirname, 'compendium\.html'\), \{ query \}\)/);
assert.doesNotMatch(html, /openTribeManagerButton|results-timeline-link/);

const panelRoot = { TribeNetOrdersReferenceRaw: { skills: [{ name:'Forestry', shortname:'For' }] } };
const panelModule = { exports: {} };
vm.runInNewContext(panel, {
  window: panelRoot,
  URLSearchParams,
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
  module: panelModule
});
assert.strictEqual(panelModule.exports.resultEaters({ people: { Warriors:100, Actives:50, Slaves:10 } }), 160);
assert.strictEqual(panelModule.exports.resultEaters({ people: { People:200, Warriors:100, Slaves:10 } }), 210);
assert.strictEqual(panelModule.exports.skillNameLookup()('For'), 'Forestry');
assert.strictEqual(panelModule.exports.compendiumHref('skill', 'Forestry'), 'compendium.html?entry=skill&key=Forestry');
assert.strictEqual(panelModule.exports.compendiumHref('item', 'Oak Wood'), 'compendium.html?entry=item&key=Oak+Wood');

console.log('Selected-unit panel and dry-terrain reserve tests passed.');

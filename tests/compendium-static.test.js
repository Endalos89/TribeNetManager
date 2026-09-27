const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'compendium.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'compendium.js'), 'utf8');
const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
const launcher = fs.readFileSync(path.join(__dirname, '..', 'src', 'compendium-launcher.js'), 'utf8');

assert.match(html, /id="compSearch"/);
assert.match(html, /id="compNav"/);
assert.match(html, /id="compArticle"/);
assert.match(html, /id="compBackButton"/);
assert.match(js, /Group \$\{group\}/);
assert.match(js, /showSkill/);
assert.match(js, /showEntity/);
assert.match(js, /goBack/);
assert.match(js, /data-entity/);
assert.match(js, /showTopic/);
assert.match(js, /land-combat/);
assert.match(js, /naval-combat/);
assert.match(preload, /getCompendiumCatalog/);
assert.match(preload, /compendium-launcher\.js/);
assert.match(launcher, /compendium\.html/);

console.log('Compendium static wiring tests passed.');

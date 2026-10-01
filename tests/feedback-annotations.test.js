const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const preload = src('preload.js');
const feedback = src('feedback.js');
const bridge = src('feedback-storage-bridge.js');
const drag = src('feedback-drag.js');
const css = src('feedback.css');

assert.match(preload, /feedbackCss\.href\s*=\s*['"]feedback\.css['"]/, 'feedback CSS should load on every app page');
assert.match(preload, /scripts\.push\(['"]feedback-storage-bridge\.js['"]\)/, 'feedback bootstrap should load on every app page');
assert.doesNotMatch(preload, /require\(['"]fs['"]\)/, 'sandboxed preload must not require fs');
assert.doesNotMatch(preload, /require\(['"]path['"]\)/, 'sandboxed preload must not require path');
assert.match(preload, /compendium-launcher\.js/, 'Compendium launcher hook must remain available');
assert.match(preload, /fair-launcher\.js/, 'Fair launcher hook must remain available');

assert.match(bridge, /inject\(['"]feedback\.js['"]\)/, 'renderer bootstrap should start the feedback UI');
assert.match(bridge, /inject\(['"]feedback-drag\.js['"]\)/, 'renderer bootstrap should add draggable feedback behavior');
assert.doesNotMatch(bridge, /Storage\.prototype/, 'feedback bootstrap must not monkey-patch browser storage');

assert.match(feedback, /localStorage\.getItem\(STORAGE_KEY\)/, 'feedback should load from renderer storage');
assert.match(feedback, /localStorage\.setItem\(STORAGE_KEY/, 'feedback should persist in renderer storage');
assert.match(feedback, /event\.ctrlKey/, 'Ctrl+click should activate feedback capture');
assert.match(feedback, /stopImmediatePropagation/, 'feedback capture should suppress the normal click action');
assert.match(feedback, /xRatio/, 'feedback should store relative click position');
assert.match(feedback, /canvas:/, 'feedback should capture canvas metadata');
assert.match(feedback, /Export JSON/, 'feedback panel should offer JSON export');
assert.match(feedback, /tribenet-feedback-/, 'feedback export should use a recognizable filename');
assert.match(feedback, /status:\s*['"]open['"]/, 'new comments should start open');
assert.match(feedback, /Resolve/, 'comments should be resolvable');
assert.match(drag, /feedback-dialog__head/, 'comment dialog header should be draggable');
assert.match(drag, /feedback-panel__head/, 'feedback panel header should be draggable');
assert.match(drag, /window\.innerWidth/, 'dragging should constrain the window horizontally');
assert.match(drag, /window\.innerHeight/, 'dragging should constrain the window vertically');
assert.match(drag, /event\.target\.closest\('button, input, select, textarea, a, label'\)/, 'interactive header controls should not start a drag');
assert.match(css, /\.feedback-marker/, 'comment markers should be styled');
assert.match(css, /\.feedback-launcher/, 'feedback panel launcher should be styled');

console.log('feedback annotation regression tests passed');

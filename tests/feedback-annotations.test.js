const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const preload = src('preload.js');
const feedback = src('feedback.js');
const round3 = src('feedback-round3.js');
const bridge = src('feedback-storage-bridge.js');
const drag = src('feedback-drag.js');
const css = src('feedback.css');

assert.match(preload, /feedbackCss\.href\s*=\s*['"]feedback\.css['"]/, 'feedback CSS should load on every app page');
assert.match(preload, /scripts\.push\(['"]feedback-storage-bridge\.js['"]\)/, 'feedback bootstrap should load on every app page');
assert.doesNotMatch(preload, /require\(['"]fs['"]\)/, 'sandboxed preload must not require fs');
assert.doesNotMatch(preload, /require\(['"]path['"]\)/, 'sandboxed preload must not require path');
assert.match(preload, /compendium-launcher\.js/, 'Compendium launcher hook must remain available');
assert.match(preload, /fair-launcher\.js/, 'Fair launcher hook must remain available');

assert.match(bridge, /inject\(['"]feedback-round3\.js['"]\)/, 'feedback workflow restoration should load before the core UI');
assert.match(bridge, /TribeNetFeedbackRound3Ready/, 'bootstrap should wait for actioned-status restoration');
assert.match(bridge, /inject\(['"]feedback\.js['"]\)/, 'renderer bootstrap should start the feedback UI');
assert.match(bridge, /inject\(['"]feedback-drag\.js['"]\)/, 'renderer bootstrap should add draggable feedback behavior');
assert.match(bridge, /inject\(['"]feedback-review-fixes\.js['"]\)/, 'renderer bootstrap should load reviewed UI fixes');
assert.match(bridge, /inject\(['"]feedback-followup-fixes\.js['"]\)/, 'renderer bootstrap should load follow-up fixes');
assert.doesNotMatch(bridge, /Storage\.prototype/, 'feedback bootstrap must not monkey-patch browser storage');

assert.doesNotThrow(() => new Function(feedback), 'feedback core should parse');
assert.doesNotThrow(() => new Function(round3), 'third-round feedback workflow should parse');
assert.match(feedback, /localStorage\.getItem\(STORAGE_KEY\)/, 'feedback should load from renderer storage');
assert.match(feedback, /localStorage\.setItem\(STORAGE_KEY/, 'feedback should persist in renderer storage');
assert.match(feedback, /event\.ctrlKey/, 'Ctrl+click should activate feedback capture');
assert.match(feedback, /stopImmediatePropagation/, 'feedback capture should suppress the normal click action');
assert.match(feedback, /xRatio/, 'feedback should store relative click position');
assert.match(feedback, /Number\.isFinite\(rawX\)/, 'marker position should preserve valid zero ratios');
assert.match(feedback, /canvas:/, 'feedback should capture canvas metadata');
assert.match(feedback, /Export JSON/, 'feedback panel should offer JSON export');
assert.match(feedback, /tribenet-feedback-/, 'feedback export should use a recognizable filename');
assert.match(feedback, /status:\s*['"]open['"]/, 'new comments should start open');
assert.match(feedback, />Fail</, 'feedback review should provide a Fail action');
assert.match(feedback, />Pass</, 'feedback review should provide a Pass action');
assert.match(feedback, /Add follow-up/, 'Fail should allow an additional follow-up comment');
assert.match(feedback, /Hide resolved/, 'feedback panel should allow resolved feedback to be hidden');
assert.match(feedback, /Show resolved/, 'feedback panel should allow resolved feedback to be shown');
assert.match(feedback, /aResolved - bResolved/, 'resolved feedback should sort below open feedback');

assert.match(round3, /status = 'actioned'/, 'export should put open feedback into an actioned state');
assert.match(round3, /actionedVersion/, 'actioned feedback should remember the version it was exported from');
assert.match(round3, /restoreActionedAfterUpdate/, 'actioned feedback should return for review after an app update');
assert.match(round3, /feedback-card--actioned/, 'actioned feedback should be greyed and visually distinct');
assert.match(round3, /awaiting update/i, 'actioned feedback should explain that it is waiting for the next update');
assert.match(round3, /Feedback about Feedback/, 'feedback panel should support feedback on its own functionality');
assert.match(round3, /openFairgroundButton/, 'deep jump should route Fairground launcher feedback into Fairground');
assert.match(round3, /inferFairgroundFeature/, 'deep jump should infer the relevant Fairground screen');
assert.match(round3, /openFairgroundFeature/, 'deep jump should reopen Fairground feature drawers');
assert.match(round3, /cultural-activity-section.*#735536/s, 'cultural activities should use the warm Fairground card palette');
assert.match(round3, /Georgia,'Times New Roman'/, 'cultural activity headings should use the Fairground display typography');

assert.doesNotThrow(() => new Function(drag), 'draggable feedback script should parse');
assert.match(drag, /feedback-dialog__head/, 'comment dialog header should be draggable');
assert.match(drag, /feedback-panel__head/, 'feedback panel header should be draggable');
assert.match(drag, /window\.innerWidth/, 'dragging should constrain the window horizontally');
assert.match(drag, /window\.innerHeight/, 'dragging should constrain the window vertically');
assert.match(drag, /event\.target\.closest\('button, input, select, textarea, a, label'\)/, 'interactive header controls should not start a drag');
assert.match(css, /\.feedback-marker/, 'comment markers should be styled');
assert.match(css, /\.feedback-launcher/, 'feedback panel launcher should be styled');
assert.match(css, /feedback-card--resolved/, 'resolved cards should have a distinct greyed treatment');

require('./feedback-review-fixes.test.js');
console.log('feedback annotation regression tests passed');

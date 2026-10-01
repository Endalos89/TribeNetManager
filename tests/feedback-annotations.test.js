const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const preload = src('preload.js');
const feedback = src('feedback.js');
const bridge = src('feedback-storage-bridge.js');
const css = src('feedback.css');

assert.match(preload, /feedbackCss\.href\s*=\s*['"]feedback\.css['"]/, 'feedback CSS should load on every app page');
assert.match(preload, /scripts\.push\(['"]feedback-storage-bridge\.js['"]\)/, 'feedback storage bridge should load on every app page');
assert.match(preload, /loadFeedbackComments/, 'preload should expose shared feedback loading');
assert.match(preload, /saveFeedbackComments/, 'preload should expose shared feedback saving');
assert.match(preload, /feedback-comments\.json/, 'feedback should persist to the shared user-data folder');

assert.match(bridge, /tribenet\.loadFeedbackComments/, 'bridge should hydrate shared comments');
assert.match(bridge, /tribenet\.saveFeedbackComments/, 'bridge should persist feedback changes');
assert.match(bridge, /script\.src\s*=\s*['"]feedback\.js['"]/, 'bridge should start the feedback UI after hydration');

assert.match(feedback, /event\.ctrlKey/, 'Ctrl+click should activate feedback capture');
assert.match(feedback, /stopImmediatePropagation/, 'feedback capture should suppress the normal click action');
assert.match(feedback, /xRatio/, 'feedback should store relative click position');
assert.match(feedback, /canvas:/, 'feedback should capture canvas metadata');
assert.match(feedback, /Export JSON/, 'feedback panel should offer JSON export');
assert.match(feedback, /tribenet-feedback-/, 'feedback export should use a recognizable filename');
assert.match(feedback, /status:\s*['"]open['"]/, 'new comments should start open');
assert.match(feedback, /Resolve/, 'comments should be resolvable');
assert.match(css, /\.feedback-marker/, 'comment markers should be styled');
assert.match(css, /\.feedback-launcher/, 'feedback panel launcher should be styled');

console.log('feedback annotation regression tests passed');

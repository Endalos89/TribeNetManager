const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const actions = fs.readFileSync('src/turn-actions.js','utf8');
const html = fs.readFileSync('src/index.html','utf8');
const style = fs.readFileSync('src/movement-planner.css','utf8');
const launcher = fs.readFileSync('src/launcher-imports.js','utf8');
const main = fs.readFileSync('src/main.js','utf8');
assert.match(html,/id="scoutOverviewRows"/);
assert.match(html,/<th>Movement9<\/th><th>Actions<\/th>/);
assert.match(actions,/data-scout-overview-edit/);
assert.match(actions,/data-scout-overview-cancel/);
assert.match(actions,/removePlannedRoute\(route\.id\)/);
assert.match(actions,/turnActionsStart\('scout', \{ route \}\)/);
assert.match(actions,/dialog\.parentElement !== document\.body/);
assert.match(actions,/document\.body\.appendChild\(dialog\)/);
assert.match(style,/#scoutRoutesDialog\[open\]\s*\{[^}]*z-index:\s*1200/s);
assert.match(style,/#scoutOverviewDialog \[data-drag-handle/);
assert.match(launcher,/refreshOrdersStatus\(\{ preserveMessage: true \}\)/);
assert.match(launcher,/Orders export failed:/);
assert.match(main,/usedAlternativePath/);

// Execute the real drag function with a mock viewport/element to guard against
// the original first-movement jump caused by CSS margin:auto.
const beginning = actions.indexOf("function turnActionsBindDialogDrag(dialog, handleName = 'scout-routes')");
const ending = actions.indexOf("\nfunction turnActionsOpenScoutRoutes()", beginning);
assert.ok(beginning >= 0 && ending > beginning);
const fn = actions.slice(beginning, ending);
const listeners = {};
const handle = {
  dataset:{},
  addEventListener:(type,cb)=>{ listeners[type]=cb; },
  setPointerCapture:()=>{},
  releasePointerCapture:()=>{}
};
const dialog = {
  style:{},offsetWidth:490,offsetHeight:270,
  querySelector:()=>handle,
  getBoundingClientRect:()=>({left:330,top:160,width:490,height:270})
};
const ctx = vm.createContext({window:{innerWidth:1280,innerHeight:800},console});
vm.runInContext(fn,ctx);
ctx.turnActionsBindDialogDrag(dialog,'scout-routes');
assert.equal(handle.dataset.dragBound,'1');
listeners.pointerdown({button:0,target:{closest:()=>null},clientX:400,clientY:190,pointerId:2,preventDefault:()=>{}});
assert.equal(dialog.style.left,'330px');
assert.equal(dialog.style.top,'160px');
assert.equal(dialog.style.margin,'0','Drag must remove auto margin before setting left/top');
listeners.pointermove({clientX:420,clientY:200});
assert.equal(dialog.style.left,'350px');
assert.equal(dialog.style.top,'170px');
listeners.pointerup({pointerId:2});
listeners.pointermove({clientX:600,clientY:500});
assert.equal(dialog.style.left,'350px','Moving without a drag must not reposition the dialog');
console.log('scout overview edit/cancel, dialog stacking/drag, export status regression tests passed');

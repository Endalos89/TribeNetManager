const assert=require('node:assert/strict');
const V=require('../src/terrain-visibility');
const fake={
  knownIds:new Set(Array.from({length:24*24},(_,i)=>
    Math.floor(i/24)+':'+(i%24))),
  actualVisible:new Set(['12:12']),
  width:1400,height:900,cameraX:72,cameraY:80,
  chunkSize:4,totalCols:200,totalRows:200,
  unproject:(x,y)=>({x,y})
};
V.set(42);
assert.equal(V.get(),42);
assert.equal(V.set(-100),V.MIN);
assert.equal(V.set(999),V.MAX);
V.set(42);
const near=[60,80,130,170,200].map(actualZoom=>V.visibleChunks({
  ...fake,actualZoom}));
for(const view of near)assert.deepEqual(view,near[0],
  'zooming IN must preserve exactly the same static GPU visibility envelope');
assert.ok(near[0].size>1);
const far=V.visibleChunks({...fake,actualZoom:25});
assert.ok(far.size>=near[0].size,'zooming farther OUT must cover at least the static area');
for(const id of near[0])assert.ok(far.has(id),
  'farther-out camera visibility must not introduce gaps');
const moved=V.visibleChunks({...fake,cameraX:100,actualZoom:170});
assert.notDeepEqual(moved,near[0],
  'the fixed visibility region must still follow the actual camera centre');
const persisted=V.set(58);
assert.equal(persisted,58);
const allowed=V.visibleChunks({...fake,actualZoom:100,knownIds:new Set(['12:12'])});
assert.deepEqual(allowed,new Set(['12:12']),
  'no undiscovered geometry may be created just to fill the static envelope');
console.log('Static terrain visibility zoom: close-zoom invariance, farther-zoom expansion, camera tracking and clamping passed.');

const assert=require('node:assert/strict');
const {knownGeometryChunks}=require('../src/terrain-world-workset');
const parse=ref=>{
  const [globalCol,globalRow]=ref.split(':').map(Number);
  return {globalCol,globalRow};
};
const knowledge=new Map([
  ['10:12','D'],['11:12','CH'],['50:50','UNKNOWN']
]);
const config={chunkSize:2,totalCols:480,totalRows:546,halo:2};
const first=knownGeometryChunks(knowledge,parse,config);
assert.ok(first.has('5:6'),'known core is included');
assert.ok(first.has('4:5'),'shared border/corner halo is included');
assert.ok(!first.has('25:25'),'unrevealed terrain must not be generated');
for(const scale of [9,26,52,180]){
  const replay=knownGeometryChunks(knowledge,parse,config);
  assert.deepEqual([...replay].sort(),[...first].sort(),
    'camera zoom does not change generated geometry workset');
}
knowledge.set('50:50','O');
const second=knownGeometryChunks(knowledge,parse,config);
assert.ok(second.has('25:25'),'only genuine discovery expands the workset');
assert.ok([...first].every(id=>second.has(id)),
  'new terrain knowledge preserves all previous world geometry');
assert.ok(second.size>first.size);
console.log('Discovery-driven geometry workset is camera-invariant and includes shared edge/corner halo.');

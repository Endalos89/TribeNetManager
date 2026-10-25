'use strict';
const assert=require('node:assert/strict');
const G=require('../src/isometric-core');
const {affectedSharedHexes,affectedGeometryChunks}=require('../src/terrain-world-workset');
const {planWorldGeometry}=require('../src/terrain-preparation-plan');

for(const changed of [{col:150,row:220},{col:151,row:220},{col:0,row:0},{col:779,row:545}]){
  const neighbours=affectedSharedHexes([changed],{totalCols:780,totalRows:546});
  const ids=new Set(neighbours.map(p=>p.col+':'+p.row));
  for(let col=Math.max(0,changed.col-3);col<=Math.min(779,changed.col+3);col++)
    for(let row=Math.max(0,changed.row-3);row<=Math.min(545,changed.row+3);row++){
      const changes=(kind,index)=>G.regionOwners(col,row,kind,index)
        .some(p=>p.col===changed.col&&p.row===changed.row);
      const shares=Array.from({length:6},(_,i)=>i).some(i=>
        changes('edge',i)||changes('corner',i));
      if(shares&&(col!==changed.col||row!==changed.row))
        assert.ok(ids.has(col+':'+row),
          'all edge and corner owners affected by new knowledge must be included');
    }
  for(const p of neighbours){
    assert.ok(p.col>=0&&p.col<780&&p.row>=0&&p.row<546);
    assert.ok(Array.from({length:6},(_,i)=>i).some(i=>
      G.regionOwners(p.col,p.row,'edge',i).some(owner=>
        owner.col===changed.col&&owner.row===changed.row)),
      'never rebuild a hex beyond the six actual adjacent neighbours');
  }
}
for(const size of [2,4]){
  const changed=[{col:151,row:220}],result=affectedGeometryChunks(changed,{
    chunkSize:size,totalCols:780,totalRows:546
  });
  assert.ok(result.direct.size===1);
  assert.ok(![...result.direct].some(id=>result.shared.has(id)));
  assert.ok(result.shared.size<=6);
}
const known=new Set();
for(let x=0;x<40;x++)for(let y=0;y<40;y++)known.add(x+':'+y);
const visible=new Set(['17:17','18:18','19:19']);
const cache=new Map(),lod=8;
const resident=(id,steps)=>cache.get(id+':'+steps);
let plan=planWorldGeometry({knownIds:known,visibleIds:visible,resident,lod,
  maxChunks:4096,anchor:{cx:18,cy:18}});
assert.equal(plan.ids.length,1600);
assert.deepEqual(new Set(plan.ids.slice(0,3)),visible);
assert.equal(plan.jobs.length,1600);
for(const id of plan.ids)cache.set(id+':8',{id});
plan=planWorldGeometry({knownIds:known,visibleIds:new Set(['5:5']),resident,lod,
  maxChunks:4096,anchor:{cx:5,cy:5}});
assert.equal(plan.jobs.length,0);
assert.equal(plan.complete,true);
cache.get('5:5:8').dirtyShared=true;
plan=planWorldGeometry({knownIds:known,visibleIds:visible,resident,lod,
  maxChunks:4096,anchor:{cx:18,cy:18}});
assert.deepEqual(plan.jobs,[{id:'5:5',lod:8,sharedOnly:true}]);
cache.get('5:5:8').dirtyCore=true;
plan=planWorldGeometry({knownIds:known,visibleIds:visible,resident,lod,
  maxChunks:4096,anchor:{cx:18,cy:18}});
assert.deepEqual(plan.jobs,[{id:'5:5',lod:8,sharedOnly:false}],
  'dirty core must schedule a full replacement while original remains resident');
cache.get('5:5:8').dirtyCore=false;
cache.get('5:5:8').dirtyShared=false;
plan=planWorldGeometry({knownIds:known,visibleIds:visible,resident,lod,
  maxChunks:4096,anchor:{cx:18,cy:18}});
assert.equal(plan.jobs.length,0,'clean replacement is not rebuilt again');
const compact=planWorldGeometry({knownIds:known,visibleIds:visible,resident:()=>null,
  maxChunks:150,anchor:{cx:18,cy:18}});
assert.equal(compact.ids.length,150);
assert.equal(compact.capacityExhausted,true);
assert.deepEqual(new Set(compact.ids.slice(0,3)),visible);
console.log('EXACT_TOPOLOGY_AND_WORLD_PLANNER_PASS',JSON.stringify({
  fullWorldChunks:known.size,adjacentHexes:6,consolidatedChunkSize:4,
  preparedWorldJobCount:plan.jobs.length}));

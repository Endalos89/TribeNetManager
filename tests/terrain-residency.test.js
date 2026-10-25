const assert=require('node:assert/strict');
const {TerrainResidencyPolicy,DEFAULT_MAX_BYTES,DEFAULT_MAX_CHUNKS,measureTerrainRecord}=
  require('../src/terrain-residency');

function record(id,{known=true,bytes=4096,lastUsed=0}={}){
  return {
    key:id+':8',id,known,lastUsed,
    group:{children:[]},
    ground:{geometry:{attributes:{position:{array:{byteLength:bytes}}}}}
  };
}
assert.ok(DEFAULT_MAX_BYTES>=128*1024*1024);
assert.ok(DEFAULT_MAX_CHUNKS>520,'a modest discovered map must not be evicted after 520 chunks');
const cache=new Map();
const policy=new TerrainResidencyPolicy({maxBytes:4*1024*1024,maxChunks:2000});
for(let i=0;i<800;i++){
  const item=record('c'+i,{known:i%5!==0,bytes:1024});
  cache.set(item.key,item);policy.register(item);
}
assert.equal(cache.size,800);
assert.equal(policy.overBudget(cache.size),false,
  'changing camera visibility while under budget cannot cause eviction');
const before=policy.bytes;
for(const scale of [50,140,70,180,30]){
  const visible=new Set(Array.from({length:Math.ceil(240/scale)},(_,i)=>'c'+i));
  assert.equal(policy.overBudget(cache.size),false);
  assert.equal(policy.bytes,before);
  assert.ok(visible.size>0);
}
const inPressure=new TerrainResidencyPolicy({maxBytes:13000,maxChunks:2000});
const examples=[
  record('visible',{bytes:4096,lastUsed:100}),
  record('fog',{known:false,bytes:4096,lastUsed:20}),
  record('known',{known:true,bytes:4096,lastUsed:10})
];
const pCache=new Map();
for(const item of examples){pCache.set(item.key,item);inPressure.register(item);}
const candidates=inPressure.candidates(pCache,new Set(['visible']),new Set(['visible']));
assert.deepEqual(candidates.map(item=>item.id),['fog','known']);
assert.equal(inPressure.overBudget(pCache.size),true);
inPressure.release(candidates[0]);
assert.equal(inPressure.overBudget(pCache.size-1),false);
assert.equal(measureTerrainRecord(record('measurement',{bytes:4096})),6144);
console.log('World geometry residency policy: camera-invariant retention, measured budget, and fog-first eviction passed.');

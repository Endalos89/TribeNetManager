'use strict';

// World-geometry residency policy. Camera/zoom never mutate or evict meshes:
// eviction is only permitted when an actual measured memory budget is exceeded.
// This module has no WebGL or mapper dependencies and is independently tested.
const DEFAULT_MAX_BYTES=256*1024*1024;
const DEFAULT_MAX_CHUNKS=4096;

function bytesForGeometry(geometry) {
  if(!geometry)return 0;
  let bytes=0;
  for(const attribute of Object.values(geometry.attributes||{}))
    bytes+=Number(attribute?.array?.byteLength||0);
  bytes+=Number(geometry.index?.array?.byteLength||0);
  return bytes;
}
function measureTerrainRecord(record) {
  if(!record)return 0;
  let bytes=2048; // GPU object/buffer accounting allowance
  for(const part of [record.ground,record.shared,record.waves])
    bytes+=bytesForGeometry(part?.geometry);
  for(const child of record.group?.children||[])if(child.isInstancedMesh){
    bytes+=Number(child.instanceMatrix?.array?.byteLength||0);
    bytes+=Number(child.instanceColor?.array?.byteLength||0);
  }
  return bytes;
}

class TerrainResidencyPolicy {
  constructor({maxBytes=DEFAULT_MAX_BYTES,maxChunks=DEFAULT_MAX_CHUNKS}={}) {
    this.maxBytes=maxBytes;
    this.maxChunks=maxChunks;
    this.bytes=0;
  }
  register(record) {
    record.residentBytes=measureTerrainRecord(record);
    this.bytes+=record.residentBytes;
    return record.residentBytes;
  }
  update(record) {
    const previous=Number(record?.residentBytes||0);
    const current=measureTerrainRecord(record);
    record.residentBytes=current;
    this.bytes=Math.max(0,this.bytes+current-previous);
    return current;
  }
  release(record) {
    this.bytes=Math.max(0,this.bytes-Number(record?.residentBytes||0));
    if(record)record.residentBytes=0;
  }
  overBudget(count){return count>this.maxChunks||this.bytes>this.maxBytes;}
  // Never evict a visible mesh just to prewarm unseen fog. If even visible
  // meshes exhaust the budget, retain them until the camera leaves.
  candidates(cache,visibleIds,activeIds) {
    return [...cache.values()].filter(record=>!visibleIds.has(record.id))
      .sort((a,b)=>{
        const tier=r=>(activeIds.has(r.id)?2:0)+(r.known?1:0);
        return tier(a)-tier(b) || Number(a.lastUsed||0)-Number(b.lastUsed||0);
      });
  }
}
module.exports={TerrainResidencyPolicy,DEFAULT_MAX_BYTES,DEFAULT_MAX_CHUNKS,measureTerrainRecord};

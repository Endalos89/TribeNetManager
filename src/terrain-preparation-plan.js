'use strict';

// Terrain preparation is a world-data lifecycle, not a render-frame concern.
// This pure planner takes a discovered-world snapshot and resident mesh status,
// and returns an ordered, bounded workset. It never inspects the camera, DOM,
// GPU objects, or mutable renderer state itself.
function planWorldGeometry({
  knownIds, visibleIds=new Set(), resident=()=>null,
  lod=8, maxChunks=4096, anchor={cx:0,cy:0},
  prepareBackground=true
}){
  const known=new Set(knownIds),visible=new Set(visibleIds);
  const distance=id=>{
    const [cx,cy]=id.split(':').map(Number);
    return (cx-anchor.cx)**2+(cy-anchor.cy)**2;
  };
  const foreground=[...visible].filter(id=>known.has(id))
    .sort((a,b)=>distance(a)-distance(b));
  const background=prepareBackground?[...known].filter(id=>!visible.has(id))
    .sort((a,b)=>distance(a)-distance(b)):[];
  const ids=[...foreground,...background].slice(0,Math.max(maxChunks,foreground.length));
  const jobs=[];
  for(const id of ids){
    const mesh=resident(id,lod);
    // A changed core remains drawn until its replacement uploads.
    // Such a chunk still needs a FULL build, not a shared-border-only job.
    if(mesh&&!mesh.dirtyShared&&!mesh.dirtyCore)continue;
    jobs.push({id,lod,sharedOnly:Boolean(mesh?.dirtyShared&&!mesh?.dirtyCore)});
  }
  return {
    ids, jobs, active:new Set(ids),
    foreground:foreground.length,
    background:background.length,
    complete:prepareBackground&&jobs.length===0&&known.size<=maxChunks,
    capacityExhausted:known.size>maxChunks
  };
}
module.exports={planWorldGeometry};

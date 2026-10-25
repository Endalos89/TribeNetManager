/* Camera-independent terrain visibility envelope.
 * Only GPU visibility is affected. World knowledge, geometry fingerprints,
 * saved meshes and the actual camera/overlay zoom are unchanged.
 */
(function(root){
  'use strict';
  const KEY='tribenet:terrain-visibility-zoom-v1';
  const DEFAULT=42,MIN=20,MAX=200;
  const clamp=value=>Math.max(MIN,Math.min(MAX,Number.isFinite(Number(value))?
    Number(value):DEFAULT));
  let value=DEFAULT;
  try{
    const stored=root.localStorage?.getItem(KEY);
    if(stored!==null&&stored!==undefined)value=clamp(stored);
  }catch(_){}
  function set(next){
    value=clamp(next);
    try{root.localStorage?.setItem(KEY,String(value));}catch(_){}
    return value;
  }
  const get=()=>value;
  function visibleChunks({knownIds,actualVisible,actualZoom,width,height,
    cameraX,cameraY,chunkSize,totalCols,totalRows,unproject}){
    const result=new Set(actualVisible||[]);
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0 ||
      typeof unproject!=='function')return result;
    const visibilityZoom=Math.min(Math.max(1,Number(actualZoom)||1),value);
    // Same isometric unprojection as the map, evaluated at a VIRTUAL
    // fixed zoom and the real camera centre. Actual camera zoom is not changed.
    // Padding protects the corners, relief and mesh/tree overhang.
    const pad=Math.max(250,visibilityZoom*1.7);
    const points=[
      [-pad,-pad],[width+pad,-pad],[-pad,height+pad],[width+pad,height+pad]
    ].map(([x,y])=>{
      const p=unproject((x-width/2)/visibilityZoom,
        (y-height/2)/visibilityZoom);
      return {x:p.x/1.5+cameraX,y:p.y/1.5+cameraY};
    });
    const SQRT3=Math.sqrt(3);
    const minCol=Math.max(0,Math.floor((Math.min(...points.map(p=>p.x))-1)/1.5)-3);
    const maxCol=Math.min(totalCols-1,Math.ceil((Math.max(...points.map(p=>p.x))-1)/1.5)+3);
    const minRow=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))/SQRT3)-4);
    const maxRow=Math.min(totalRows-1,Math.ceil(Math.max(...points.map(p=>p.y))/SQRT3)+4);
    if(minCol>maxCol||minRow>maxRow)return result;
    for(const id of knownIds||[]){
      const [cx,cy]=id.split(':').map(Number);
      const col=cx*chunkSize,row=cy*chunkSize;
      if(col<=maxCol&&col+chunkSize-1>=minCol&&
        row<=maxRow&&row+chunkSize-1>=minRow)result.add(id);
    }
    return result;
  }
  const api={get,set,visibleChunks,DEFAULT,MIN,MAX};
  root.TerrainVisibility=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

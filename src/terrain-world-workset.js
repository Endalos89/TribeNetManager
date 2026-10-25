'use strict';

// Terrain knowledge -> immutable geometry workset. This module never reads
// camera coordinates, zoom, viewport bounds, DOM, or live unit positions.
// An edge/corner halo is included so revealed adjacent terrain gets a mesh.
function knownGeometryChunks(terrain,parseCoordinate,{
  chunkSize=2,totalCols,totalRows,halo=2
}={}){
  const result=new Set();
  for(const [coordinate,type] of terrain){
    if(!type||type==='UNKNOWN')continue;
    const cell=parseCoordinate(coordinate);
    if(!Number.isFinite(cell?.globalCol)||!Number.isFinite(cell?.globalRow))continue;
    for(let dc=-halo;dc<=halo;dc++)for(let dr=-halo;dr<=halo;dr++){
      const col=cell.globalCol+dc,row=cell.globalRow+dr;
      if(col<0||row<0||col>=totalCols||row>=totalRows)continue;
      result.add(Math.floor(col/chunkSize)+':'+Math.floor(row/chunkSize));
    }
  }
  return result;
}
// Exact topology of the odd-column offset grid used by IsoGeometry.regionOwners.
// Only hexes sharing an edge or corner with a changed core can have a different
// transition mesh; a square 5x5 invalidation overestimates this by >3x.
function affectedSharedHexes(changed,{
  totalCols,totalRows
}={}){
  const adjacent=new Set();
  for(const {col,row} of changed){
    if(!Number.isFinite(col)||!Number.isFinite(row))continue;
    const odd=col%2?1:0;
    const neighbours=[
      [col+1,row+odd],[col,row+1],[col-1,row+odd],
      [col-1,row+odd-1],[col,row-1],[col+1,row+odd-1]
    ];
    for(const [c,r] of neighbours){
      if(c<0||r<0||c>=totalCols||r>=totalRows)continue;
      adjacent.add(c+':'+r);
    }
  }
  return [...adjacent].map(id=>{
    const [col,row]=id.split(':').map(Number);
    return {col,row};
  });
}

function affectedGeometryChunks(changed,{chunkSize=2,totalCols,totalRows}={}){
  const direct=new Set(changed.map(p=>
    Math.floor(p.col/chunkSize)+':'+Math.floor(p.row/chunkSize)));
  const shared=new Set();
  for(const p of affectedSharedHexes(changed,{totalCols,totalRows})){
    const id=Math.floor(p.col/chunkSize)+':'+Math.floor(p.row/chunkSize);
    if(!direct.has(id))shared.add(id);
  }
  return {direct,shared};
}
module.exports={knownGeometryChunks,affectedSharedHexes,affectedGeometryChunks};

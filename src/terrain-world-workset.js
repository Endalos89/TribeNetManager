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
module.exports={knownGeometryChunks};

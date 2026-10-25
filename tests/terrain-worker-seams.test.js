'use strict';
// Test the real worker-owned tessellation independently of the Three.js
// renderer, including mixed PR/GH/CH coasts. Every known surface polygon
// must produce valid, non-degenerate float32 triangles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const G=require('../src/isometric-core');
const settings=require('../src/terrain-settings');
const source=fs.readFileSync(path.join(__dirname,'../src/terrain-geometry-worker.js'),'utf8');
const output=[];
const context={Math,Map,Set,Float32Array,Number,String,Object,Array,
  performance:{now:()=>0},self:{
    postMessage:(value)=>output.push(value),
    IsoGeometry:G,TerrainSettings:settings
  },importScripts(){}};
vm.runInNewContext(source,context,{filename:'terrain-geometry-worker.js'});
const rows=[];
for(let col=304;col<=336;col++)for(let row=310;row<=345;row++){
  const terrain=col<=313?'GH':col<=321?'PR':row<329?'CH':row<335?'LAM':'O';
  rows.push({coordinate:col+':'+row,globalCol:col,globalRow:row,terrain});
}
function build(id){
  context.self.onmessage({data:{type:'build',revision:10,id,lod:8,requestId:1}});
  const event=output.at(-1);
  assert.equal(event.type,'built',event.error||'worker build failed');
  const mesh=event.mesh;
  for(const points of [mesh.positions,mesh.sharedPositions]){
    assert.equal(points.length%9,0);
    for(let i=0;i<points.length;i+=9){
      const x0=points[i],y0=points[i+2],x1=points[i+3],y1=points[i+5],
        x2=points[i+6],y2=points[i+8];
      const area=Math.abs((x1-x0)*(y2-y0)-(y1-y0)*(x2-x0));
      assert.ok(Number.isFinite(area)&&area>0,
        'worker uploaded zero-area triangle at '+id+' index '+i+' area='+area);
    }
  }
  return mesh;
}
const snapshot=settings.get();
try{
  settings.reset();
  context.self.onmessage({data:{type:'knowledge',revision:10,rows,
    palette:{PR:'#97b66a',GH:'#809653',CH:'#678848',LAM:'#898b76',O:'#397a96'},
    settings:settings.get()}});
  assert.equal(output.at(-1).type,'ready');
  const inland=build('78:81'),coastal=build('82:83');
  assert.ok(inland.coreFaces>0&&inland.sharedFaces>0);
  assert.ok(coastal.coreFaces>0&&coastal.sharedFaces>0);
  assert.ok(coastal.positions.length>0&&coastal.sharedPositions.length>0);
  console.log('TERRAIN_WORKER_SEAM_AND_SLIVER_PASS',
    JSON.stringify({inland:inland.faces,coastal:coastal.faces}));
}finally{settings.set(snapshot);}

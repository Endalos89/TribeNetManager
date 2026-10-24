// Execute the actual renderer against a recording canvas, without Electron or
// optional browser packages. Validate geometry, picking and cache invalidation.
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const G=require('../src/isometric-core');
function fixture(reverse=false){
 const fills=[];
 function context(){let points=[];return new Proxy({
  beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},
  fill(){fills.push({color:this.fillStyle,points});}
 },{get:(target,key)=>key in target?target[key]:(()=>{})});}
 const canvas={getBoundingClientRect:()=>({width:700,height:500}),getContext:()=>context()};
 const ref=(c,r)=>`${c}:${r}`,center=(c,r)=>({x:1+c*1.5,y:Math.sqrt(3)/2+Math.sqrt(3)*(r+(c%2?.5:0))});
 let rows=[];for(let c=0;c<3;c++)for(let r=0;r<3;r++)rows.push([ref(c,r),{terrain:'PR'}]);
 if(reverse)rows.reverse();
 const state={hexCache:new Map(rows),cameraX:2.5,cameraY:3,scale:70,mode:'detail'};
 const env={IsoGeometry:G,state,canvas,ctx:context(),TOTAL_COLS:3,TOTAL_ROWS:3,SQRT3:Math.sqrt(3),coordinateFor:ref,baseCenter:center,
  stepHex:({globalCol:c,globalRow:r},d)=>{const o=c%2,[x,y]=[[c+1,r+(o?1:0)],[c,r+1],[c-1,r+(o?1:0)],[c-1,r+(o?0:-1)],[c,r-1],[c+1,r+(o?0:-1)]][G.directions.indexOf(d)];return {coordinate:ref(x,y)};},
  terrainStyle:{PR:['#83b653'],GH:['#83b653'],HSM:['#a7b4ba'],O:['#337f98']},window:{devicePixelRatio:1},
  document:{createElement:()=>({getContext:()=>context()})},IsoUnits:{prepare:()=>'',occupies:()=>false,beginFrame(){}},updateCenterReadout(){}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/isometric-mapper'),'utf8').replace('IsoMapper.setup();','globalThis.renderer=IsoMapper;'),env);
 return {env,state,fills,center,renderer:env.renderer};
}
const first=fixture(),second=fixture(true);
first.renderer.draw();second.renderer.draw();
assert.equal(G.groundSubdivisions,16,'close-up terrain uses finer facets');
assert.equal(first.fills.length,9*G.regionMesh(16).length,'all ground triangles are clipped to exact reveal sections');
assert.deepEqual(first.fills,second.fills,'installation/discovery order cannot change rendered geometry');
assert.ok(first.fills.every(f=>f.points.every(p=>p.every(Number.isFinite))));
const p=first.renderer.project(first.center(1,1));
assert.equal(first.renderer.pick(p.x,p.y).globalCol,1);
assert.equal(first.renderer.pick(p.x,p.y).globalRow,1);
const before=first.fills.length;first.renderer.draw();
assert.equal(first.renderer.sceneBuilds,1);assert.equal(first.fills.length,before,'reuse cached landscape');
first.state.hexCache.set('1:1',{terrain:'HSM'});first.renderer.draw();
assert.equal(first.renderer.sceneBuilds,2);
const high=first.renderer.surface(first.center(1,1).x,first.center(1,1).y).z;
assert.ok(high>.9,'terrain edits invalidate cell and surface caches');
first.state.hexCache.set('1:1',{terrain:'O'});first.renderer.draw();
assert.equal(first.renderer.surface(first.center(1,1).x,first.center(1,1).y).z,.10,'water rendering uses chosen Terrain Dev elevation');
first.state.scale=20;first.renderer.draw();
assert.equal(first.renderer.sceneBuilds,4,'zoom rebuilds the mesh at its current detail level');
console.log('Ground renderer: 4x face count, repeatable meshes, picking, cached draws, edits and zoom passed');

// Decoration changes preserve both the terrain geometry and its raster layer.
const cached=fixture();cached.renderer.draw();
const groundBuilds=cached.renderer.groundBuilds;
cached.state.hexCache.set('1:1',{terrain:'PR',notes:'A harmless note'});cached.renderer.draw();
assert.equal(cached.renderer.sceneBuilds,1,'plain notes do not invalidate scenery');
cached.state.hexCache.set('1:1',{terrain:'PR',notes:'[Rivers: N]'});cached.renderer.draw();
assert.equal(cached.renderer.groundBuilds,groundBuilds,'river edits reuse ground raster');
cached.env.IsoUnits.prepare=()=> '1:1';cached.renderer.draw();
assert.equal(cached.renderer.groundBuilds,groundBuilds,'unit clearings reuse ground raster');
cached.state.cameraX+=.1;cached.renderer.draw();
assert.equal(cached.renderer.groundBuilds,groundBuilds,'short pan reuses overscan');
cached.state.hexCache.set('1:1',{terrain:'GH'});cached.renderer.draw();
assert.equal(cached.renderer.groundBuilds,groundBuilds+1,'terrain changes invalidate ground raster');
console.log('Ground raster cache survives notes, river edits, unit clearings and small pans');

const panning=fixture();panning.renderer.draw();
const painted=panning.fills.length;
panning.state.cameraX+=2;panning.renderer.draw();
assert.equal(panning.renderer.sceneBuilds,2,'large pan rebuilds composition');
assert.equal(panning.fills.length,painted,'large pan reuses world hex rasters without repainting faces');
const screen=panning.renderer.project(panning.center(1,1),0),world=panning.renderer.inverse(screen.x,screen.y);
assert.ok(Math.abs(world.x-panning.center(1,1).x)<1e-9);
assert.ok(Math.abs(world.y-panning.center(1,1).y)<1e-9);

const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),G=require((root+'/src')+'/isometric-core'),T=require(root+'/src/terrain-settings');
T.set({coastWaterShare:Number(process.env.TERRAIN_TEST_WATER_SHARE||.35)});
const ctx={self:{IsoGeometry:G,TerrainSettings:T,postMessage(){}},performance,importScripts(){}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync((root+'/src')+'/terrain-geometry-worker.js','utf8'),ctx);
const rows=[];for(let c=312;c<=322;c++)for(let r=323;r<=333;r++)rows.push({globalCol:c,globalRow:r,coordinate:c+':'+r,terrain:c>318?'O':c===318?'LAM':c===317?'GH':r<327?'CH':'PR'});
ctx.self.onmessage({data:{type:'knowledge',revision:1,rows,palette:{O:'#397a96',LAM:'#898b76',GH:'#809653',CH:'#678848',PR:'#97b66a'},settings:T.get()}});
const meshes=['78:81','79:81','80:81','78:82','79:82','80:82'].map(id=>vm.runInContext(`build('${id}')`,ctx));
const triangles=[],edges=[];const counts=new Map();
for(const mesh of meshes)for(const type of ['','shared']){
 const p=mesh[type?type+'Positions':'positions'],colors=mesh[type?type+'Colors':'colors'];
 for(let i=0;i<p.length;i+=9){
  const v=[0,3,6].map(j=>[p[i+j],p[i+j+2],p[i+j+1]]);triangles.push({v,color:Array.from(colors.slice(i,i+3))});
  for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];const key=[a.join(','),b.join(',')].sort().join('|');counts.set(key,(counts.get(key)||0)+1);edges.push({a,b,key});}
 }
}
if(process.env.TERRAIN_RENDER_MESH)fs.writeFileSync(process.env.TERRAIN_RENDER_MESH,JSON.stringify(triangles));
const open=edges.filter(e=>counts.get(e.key)===1),bins=new Map();
for(const e of open){for(let x=Math.floor(Math.min(e.a[0],e.b[0])/.2);x<=Math.floor(Math.max(e.a[0],e.b[0])/.2);x++)for(let y=Math.floor(Math.min(e.a[1],e.b[1])/.2);y<=Math.floor(Math.max(e.a[1],e.b[1])/.2);y++){const key=x+':'+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(e);}}
let gaps=0,worst=0,checked=0;const examples=[];
for(const e of open){
 const a=e.a,b=e.b,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.001)continue;
 const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;const reg=G.regionAt(x/1.5,y/1.5);if(reg.col<314||reg.col>320||reg.row<325||reg.row>330)continue;
 const candidates=bins.get(Math.floor(x/.2)+':'+Math.floor(y/.2))||[];
 let best=Infinity;
 for(const f of candidates){if(e===f)continue;const ux=f.b[0]-f.a[0],uy=f.b[1]-f.a[1],d=ux*ux+uy*uy;if(d<1e-12)continue;const t=((x-f.a[0])*ux+(y-f.a[1])*uy)/d;
 if(t< -1e-5||t>1+1e-5||Math.abs((x-f.a[0])*uy-(y-f.a[1])*ux)/Math.sqrt(d)>.00015)continue;
 best=Math.min(best,Math.abs((a[2]+b[2])/2-(f.a[2]+t*(f.b[2]-f.a[2]))));}
 checked++;if(best>.0003){gaps++;worst=Math.max(worst,best);if(examples.length<8)examples.push({a,b,best,reg});}
}
assert.ok(checked>1000,'fixture must exercise refined/coarse joins');
assert.equal(gaps,0,'unmatched mesh edges: '+JSON.stringify({worst,examples}));
console.log('TERRAIN_MESH_CONTINUITY_PASS',JSON.stringify({triangles:triangles.length,checked,gaps}));

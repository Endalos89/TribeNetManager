/* Worker-owned deterministic world geometry. No DOM, camera, THREE renderer or
 * live unit state is read here. This preserves the core/edge/corner ownership
 * rules from isometric-mapper.js and sends transferable vertex arrays.
 */
'use strict';
importScripts('./terrain-settings.js','./isometric-core.js');
const G=self.IsoGeometry;
const FOG='#253640';
const SIZE=4;
const STEPS=8;
const water=t=>t==='O'||t==='L';
const known=data=>Boolean(data?.terrain&&data.terrain!=='UNKNOWN');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const treeKind=t=>['D','DH','CH','JG','JH','LCM','LJM'].includes(t);
const center=(c,r)=>({x:1+c*1.5,y:Math.sqrt(3)/2+Math.sqrt(3)*(r+(c%2?.5:0))});
const offset=(c,p,r=1,z=0)=>({x:c.x+p.x*r,y:c.y+p.y*r,z});
const linear=c=>{c=c/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
const rgb=hex=>[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)));
let cells=new Map(),palette={},revision=0;
const tiles=new Map(),groundCache=new Map(),coreCache=new Map(),surfaces=new Map();
function cell(c,r){return cells.get(c+':'+r)||null;}
function colour(t){return palette[t]||FOG;}
function sample(x,y){
  x=Math.round(x*1e6)/1e6;y=Math.round(y*1e6)/1e6;
  const key=x+':'+y;
  if(!surfaces.has(key)){
    if(surfaces.size>120000)surfaces.clear();
    surfaces.set(key,G.surface(x,y,cell,colour));
  }
  return surfaces.get(key);
}
function tile(c,r){
  const id=c+':'+r;
  if(tiles.has(id))return tiles.get(id);
  const n=Array.from({length:6},(_,i)=>{
    const p=G.regionOwners(c,r,'edge',i)[1];
    return cell(p.col,p.row);
  });
  const t={col:c,row:r,ref:cell(c,r)?.coordinate||id,
    data:cell(c,r),c:center(c,r),n,
    known:known(cell(c,r)),water:water(cell(c,r)?.terrain)};
  tiles.set(id,t);
  return t;
}
function shoreFaces(points) {
  if(points.every(p=>p.water)||points.every(p=>!p.water))return [points];
  const land=[],sea=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    (a.water?sea:land).push(a);
    if(Boolean(a.water)===Boolean(b.water))continue;
    let dry=a.water?b:a,wet=a.water?a:b;
    for(let j=0;j<18;j++){
      const mid=sample((dry.x+wet.x)/2,(dry.y+wet.y)/2);
      if(mid.water)wet=mid;else dry=mid;
    }
    const coast={...dry,z:wet.z,water:false};
    land.push(coast);sea.push({...coast,water:true,color:wet.color});
  }
  return [land,sea].filter(p=>p.length>=3);
}
function refineShoreline(triangle,depth,out){
  if(depth<=0){out.push(triangle);return;}
  const mid=(a,b)=>sample((a.x+b.x)/2,(a.y+b.y)/2);
  const [a,b,c]=triangle,ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
  refineShoreline([a,ab,ca],depth-1,out);
  refineShoreline([ab,b,bc],depth-1,out);
  refineShoreline([ca,bc,c],depth-1,out);
  refineShoreline([ab,bc,ca],depth-1,out);
}
function groundFaces(t,sharedOnly=false){
  const coastal=t.known&&t.n.some(n=>known(n)&&(water(n.terrain)!==t.water));
  const detail=Number(self.TerrainSettings.value('shoreDetail')??20);
  const microDepth=coastal?clamp(Math.ceil(Math.log2(detail/STEPS)),0,3):0;
  const key=t.ref+':'+STEPS+':'+microDepth;
  if(!sharedOnly&&groundCache.has(key))return groundCache.get(key);
  const faces=[];
  if(!t.known||(t.water&&t.n.every(n=>known(n)&&water(n.terrain)))){
    const p=sample(t.c.x,t.c.y);
    faces.push({points:G.corners.map(q=>offset(t.c,q,1,t.known?p.z:.14)),
      color:t.known?p.color:FOG,region:'shared'});
    if(!sharedOnly)groundCache.set(key,faces);
    return faces;
  }
  let region='shared';
  const emit=part=>{
    const [a,b,c]=part,ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,
      vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
    // Clipping a subdivided triangle to the shared square/corner can leave
    // float32-sized slivers. Their unstable face normals produce dark needle
    // lines; the triangles cover no meaningful screen area at any zoom.
    if(Math.abs(ux*vy-uy*vx)<1e-8)return;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const len=Math.hypot(nx,ny,nz)||1;
    const light=clamp(.94+(-nx*.35-ny*.28)/len,.78,1.13);
    const mixed=G.mix(part.map(p=>p.color)),wet=part.every(p=>p.water);
    const steepness=Math.hypot(nx,ny)/(Math.abs(nz)+1e-8);
    const cliff=wet?0:clamp((steepness-.48)/.68,0,1);
    const rockWeight=wet?0:part.reduce((n,p)=>n+(p.rock||0),0)/part.length;
    const exposure=self.TerrainSettings.value('cliffExposure')??.85;
    const stone=[120,120,108];
    const shade=wet?mixed:'#'+[1,3,5].map((i,k)=>{
      const base=parseInt(mixed.slice(i,i+2),16)*light;
      const amount=Math.min(.96,cliff*exposure*(.72+.28*rockWeight));
      return clamp(Math.round(base*(1-amount)+stone[k]*amount),0,255).toString(16).padStart(2,'0');
    }).join('');
    faces.push({points:part,color:shade,region});
  };
  const coreKey=t.ref+':'+String(t.data?.terrain||'?');
  const savedCore=coreCache.get(coreKey);
  const stableCore=[];
  for(const face of G.regionMesh(STEPS)){
    if(face.kind==='core'&&savedCore)continue;
    region=face.kind==='core'?'core':'shared';
    if(sharedOnly&&region==='core')continue;
    const visible=G.regionOwners(t.col,t.row,face.kind,face.index)
      .every(owner=>known(cell(owner.col,owner.row)));
    const polygonCentre={
      x:t.c.x+face.points.reduce((sum,p)=>sum+p.x,0)/face.points.length,
      y:t.c.y+face.points.reduce((sum,p)=>sum+p.y,0)/face.points.length
    };
    const points=face.points.map(p=>{
      const x=t.c.x+p.x,y=t.c.y+p.y,original=sample(x,y);
      if(!visible||!original.fog)return original;
      // Precision at the exact edge/corner of a known polygon can make
      // regionAt select the neighbouring fog owner. Sample infinitesimally
      // INSIDE the face while keeping the exact shared vertex coordinates.
      // Only known-owner faces use this correction; real fog remains hidden.
      for(const epsilon of [1e-5,1e-4,.001]){
        const inner=sample(x+(polygonCentre.x-x)*epsilon,
          y+(polygonCentre.y-y)*epsilon);
        if(!inner.fog)return {...inner,x,y};
      }
      return original;
    });
    if(!visible){faces.push({points,color:FOG,region:'shared'});continue;}
    if(!microDepth||face.kind==='core'){
      for(const part of shoreFaces(points))emit(part);
      continue;
    }
    for(let k=1;k<points.length-1;k++){
      const triangles=[];
      refineShoreline([points[0],points[k],points[k+1]],microDepth,triangles);
      for(const tri of triangles)for(const part of shoreFaces(tri))emit(part);
    }
  }
  if(!sharedOnly){
    if(savedCore)faces.push(...savedCore);
    else if(t.known){
      for(const part of faces)if(part.region==='core')stableCore.push(part);
      coreCache.set(coreKey,stableCore);
    }
    groundCache.set(key,faces);
  }
  return faces;
}
function build(id,sharedOnly=false){
  const [cx,cy]=id.split(':').map(Number);
  const positions=[],colors=[],sharedPositions=[],sharedColors=[],wavePoints=[];
  let coreFaces=0,sharedFaces=0;
  const current=[];
  for(let c=cx*SIZE;c<(cx+1)*SIZE;c++)for(let r=cy*SIZE;r<(cy+1)*SIZE;r++){
    if(c<0||r<0||c>=780||r>=546)continue;
    current.push(tile(c,r));
  }
  const append=(a,points,c)=>{
    for(const p of points)a.push(p.x*1.5,p.z||0,p.y*1.5);
    for(let k=0;k<points.length;k++)c.push(...rgb(points[0]?.color||FOG));
  };
  for(const t of current){
    for(const face of groundFaces(t,sharedOnly)){
      if(face.points.length<3)continue;
      const immutable=face.region==='core';
      const pc=immutable?positions:sharedPositions;
      const cc=immutable?colors:sharedColors;
      const marine=face.points.every(p=>p.water)||
        (t.water&&t.n.every(n=>n&&(water(n.terrain))));
      const fc=rgb(face.color);
      const vert=p=>{
        pc.push(p.x*1.5,p.z||0,p.y*1.5);
        const colour=marine?sample(p.x,p.y):null;
        if(colour?.water&&!colour.fog)cc.push(...rgb(colour.color));
        else cc.push(...fc);
      };
      for(let k=1;k<face.points.length-1;k++){
        const a=face.points[0],b=face.points[k],c=face.points[k+1];
        // Use the EXACT float32 positions that the GPU will receive.
        // At distant world coordinates distinct JS vertices can quantise to
        // one line, leaving dark zero-area needle triangles.
        const ax=Math.fround(a.x*1.5),ay=Math.fround(a.y*1.5);
        const bx=Math.fround(b.x*1.5),by=Math.fround(b.y*1.5);
        const cx=Math.fround(c.x*1.5),cy=Math.fround(c.y*1.5);
        if(Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))<1e-8)
          continue;
        vert(a);vert(b);vert(c);
        if(immutable)coreFaces++;else sharedFaces++;
      }
    }
  }
  const sites=[];
  if(!sharedOnly){
    const density=clamp(self.TerrainSettings.value('treeDensity')??2.5,.5,5);
    const size=clamp(self.TerrainSettings.value('treeSize')??.55,.2,1.5);
    for(const t of current){
      if(!t.known||!treeKind(t.data?.terrain))continue;
      const rnd=G.sceneryRandom(t.ref+':gpu-forest');
      const amount=Math.round(9*density*(t.data.terrain==='JG'?1.2:1));
      for(let i=0;i<amount;i++){
        const angle=rnd()*Math.PI*2,rad=.84*Math.sqrt(rnd());
        const x=t.c.x+Math.cos(angle)*rad,y=t.c.y+Math.sin(angle)*rad;
        const p=sample(x,y);
        if(!p||p.fog||p.water||p.rock>.64)continue;
        sites.push({x,y,z:p.z,size:size*(.75+rnd()*.55),
          conifer:t.data.terrain==='CH'||t.data.terrain==='LCM'});
      }
    }
  }
  const strength=clamp(self.TerrainSettings.value('waveStrength')??.55,0,1);
  if(strength>0)for(const t of current){
    if(!t.known)continue;
    const rnd=G.sceneryRandom(t.ref+':static-wave-ripples');
    const attempts=Math.round((t.water?16:10)*strength);
    for(let i=0;i<attempts;i++){
      const angle=rnd()*Math.PI*2,radius=.95*Math.sqrt(rnd());
      const x=t.c.x+Math.cos(angle)*radius,y=t.c.y+Math.sin(angle)*radius;
      const p=sample(x,y);
      if(!p?.water||p.fog)continue;
      const near=[[.14,0],[-.14,0],[0,.14],[0,-.14]]
        .map(([dx,dy])=>sample(x+dx,y+dy)).some(n=>!n.water&&!n.fog);
      if(!near&&rnd()>.26)continue;
      const span=near?.12+rnd()*.14:.05+rnd()*.07;
      const direction=rnd()*Math.PI*2,ax=Math.cos(direction)*span/2,ay=Math.sin(direction)*span/2;
      const left=sample(x-ax,y-ay),right=sample(x+ax,y+ay);
      if(!left?.water||!right?.water)continue;
      const height=p.z+.007;
      wavePoints.push((x-ax)*1.5,height,(y-ay)*1.5,(x+ax)*1.5,height,(y+ay)*1.5);
    }
  }
  return {
    format:2,known:current.some(t=>t.known),
    faces:coreFaces+sharedFaces,coreFaces,sharedFaces,
    trees:sites.length,treeSites:sites,
    positions:Float32Array.from(positions),colors:Float32Array.from(colors),
    sharedPositions:Float32Array.from(sharedPositions),
    sharedColors:Float32Array.from(sharedColors),
    waves:Float32Array.from(wavePoints)
  };
}
self.onmessage=event=>{
  const m=event.data;
  try{
    if(m.type==='knowledge'){
      cells=new Map(m.rows.map(row=>[row.globalCol+':'+row.globalRow,row]));
      palette=m.palette;revision=m.revision;
      self.TerrainSettings.set(m.settings||{});
      tiles.clear();groundCache.clear();coreCache.clear();surfaces.clear();
      self.postMessage({type:'ready',revision});
    }else if(m.type==='build'){
      if(m.revision!==revision){
        self.postMessage({type:'stale',id:m.id,revision:m.revision,requestId:m.requestId});
        return;
      }
      const start=performance.now();
      const result=build(m.id,Boolean(m.sharedOnly));
      const elapsed=performance.now()-start;
      self.postMessage({type:'built',id:m.id,revision,requestId:m.requestId,sharedOnly:m.sharedOnly,
        elapsed,mesh:result},
        [result.positions.buffer,result.colors.buffer,
          result.sharedPositions.buffer,result.sharedColors.buffer,result.waves.buffer]);
    }
  }catch(e){
    self.postMessage({type:'error',id:m.id,revision:m.revision,requestId:m.requestId,
      error:e?.stack||e?.message||String(e)});
  }
};

/* Shared geometry: flat-top, odd-column hexes; screen north is map north. */
(function(root) {
  const directions = ['SE', 'S', 'SW', 'NW', 'N', 'NE'];
  const corners = Array.from({length:6}, (_,i) => ({x:Math.cos(i*Math.PI/3), y:Math.sin(i*Math.PI/3)}));
  function seed(reference) {
    let n = 2166136261;
    for (const c of reference.toUpperCase()) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  }
  function random(reference) {
    let n = seed(reference);
    return () => { n += 0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  // Published visual seed/version: never use installation IDs, clocks or discovery order.
  const tuning=root.TerrainSettings || (typeof require==='function' ? require('./terrain-settings') : null);
  const WORLD_SEED=1790425012;
  const setting=(name,fallback)=>tuning?.value(name) ?? fallback;
  const scenerySeed=WORLD_SEED;
  function sceneryRandom(reference) { return random(`${scenerySeed}:scenery:${reference}`); }
  function sceneryDetails(reference) {
    const rand=sceneryRandom(reference);
    return Array.from({length:9},()=>({x:(rand()-.5)*.96,y:(rand()-.5)*.96,size:.7+rand()*.6,variant:rand()}));
  }
  function project(x,y,z=0) { return {x, y:y*.62-z*.78}; }
  function unproject(x,y,z=0) { return {x, y:(y+z*.78)/.62}; }
  function rivers(data) {
    const text = String(data?.notes || '').match(/\[Rivers:\s*([^\]]*)\]/i)?.[1] || '';
    return new Set(text.toUpperCase().split(/[\s,]+/).filter(d=>directions.includes(d)));
  }
  function riverNotes(notes, values) {
    const clean=String(notes||'').replace(/\s*\[Rivers:[^\]]*\]/gi,'').trim();
    const valid=directions.filter(d=>values.includes(d));
    return clean + (valid.length ? `${clean?'\n':''}[Rivers: ${valid.join(', ')}]` : '');
  }
  function mix(colors) {
    const channels=[1,3,5].map(p=>Math.round(colors.reduce((sum,c)=>sum+parseInt(c.slice(p,p+2),16),0)/colors.length));
    return '#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('');
  }

  const isHill=t=>['BH','CH','DH','GH','GHP','JH','PGH','RH','SH'].includes(t);
  const isForest=t=>['D','DH','CH','JG','JH','LCM','LJM'].includes(t);
  const isLowMountain=t=>['LAM','LCM','LJM','LSM','LVM'].includes(t);
  const isHighMountain=t=>t==='HSM'||t==='ALPS';
  // Layered terrain v2: independent of scenery, reports and installation state.
  const reliefSeed=WORLD_SEED;
  const reliefHash=seed(reliefSeed);
  const groundSubdivisions=16; // Runtime high-detail value may be adjusted locally in Terrain Dev.
  const subdivisions=()=>Math.max(8,Math.min(32,Math.round(setting('meshQuality',16))));
  function noise(x,y,salt=0) {
    const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
    const value=(a,b)=>{
      let h=Math.imul(a,374761393)^Math.imul(b,668265263)^reliefHash^salt;
      h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
    };
    const a=value(ix,iy)*(1-u)+value(ix+1,iy)*u;
    const b=value(ix,iy+1)*(1-u)+value(ix+1,iy+1)*u;
    return a*(1-v)+b*v;
  }
  function relief(x,y) {
    // Rounded hill volumes and narrower warped mountain ridges. The field is
    // world-aligned, so adjoining hexes share shoulders rather than tile bumps.
    const broad=noise(x*.72,y*.72);
    const warp=noise(x*.36+31,y*.36-17,73)-.5;
    const ridge=1-Math.abs(2*noise(x*1.18+warp,y*1.18-warp,137)-1);
    const detail=noise(x*3.2,y*3.2,271);
    return {broad,ridge,detail};
  }
  function layeredHeight(height,layer) {
    const n=height/layer,whole=Math.floor(n),fraction=n-whole;
    // Solid strata with broad tops and bevelled transitions instead of cubes.
    const bevel=smooth((fraction-.26)/.48);
    return layer*(whole+bevel*.86+fraction*.14);
  }
  function treeSite(terrain,p,sample) {
    if(!isForest(terrain)||p.fog||p.water||p.z>1.2||p.rock>.55)return false;
    const delta=.09;
    const neighbours=[[delta,0],[-delta,0],[0,delta],[0,-delta]].map(([x,y])=>sample(p.x+x,p.y+y));
    if(neighbours.some(q=>q.water))return false;
    const slope=Math.hypot(neighbours[0].z-neighbours[1].z,neighbours[2].z-neighbours[3].z)/(2*delta);
    return slope<.85;
  }
  const water=t=>t==='O'||t==='L';
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  // Exact rhombitrihexagonal tiling: one inner hex, whole shared squares and triangles.
  const coreRadius=Math.sqrt(3)/(1+Math.sqrt(3)),apothem=Math.sqrt(3)/2;
  const normals=Array.from({length:6},(_,i)=>({x:Math.cos((i+.5)*Math.PI/3),y:Math.sin((i+.5)*Math.PI/3)}));
  const center=(col,row)=>({x:1+col*1.5,y:apothem+Math.sqrt(3)*(row+(col%2?.5:0))});
  function neighbour(col,row,index) {
    const odd=col%2?1:0;
    const [c,r]=[[col+1,row+odd],[col,row+1],[col-1,row+odd],[col-1,row+odd-1],[col,row-1],[col+1,row+odd-1]][index];
    return {col:c,row:r};
  }
  function regionOwners(col,row,kind,index=0) {
    const own={col,row};
    if(kind==='core')return [own];
    if(kind==='edge')return [own,neighbour(col,row,index)];
    return [own,neighbour(col,row,(index+5)%6),neighbour(col,row,index)];
  }
  const ownerKey=o=>o.col+':'+o.row;
  const canon=owners=>owners.slice().sort((a,b)=>a.col-b.col||a.row-b.row);
  function fraction(key) {
    const h=seed(WORLD_SEED+':'+key);
    return (h>>>0)/4294967295;
  }
  function pairFraction(owners) {
    const sorted=canon(owners);
    return .25+.5*fraction('square:'+sorted.map(ownerKey).join('|'));
  }
  // Both square and triangle use the SAME split at their shared edge midpoint.
  // A and B cores are always pure: at the middle, B's seeded influence is 25–75%.
  function pairSplit(t,beta) {
    t=Math.max(0,Math.min(1,t));
    return t<=.5 ? 2*t*beta : beta+2*(t-.5)*(1-beta);
  }
  function barycentric(p,a,b,c) {
    const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(den)<1e-12)return null;
    const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
    const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
    return [u,v,1-u-v];
  }
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function cornerInfluences(position,owners,junction) {
    const sorted=canon(owners);
    const vertices=sorted.map(o=>{const c=center(o.col,o.row);return {x:c.x+(junction.x-c.x)*coreRadius,y:c.y+(junction.y-c.y)*coreRadius};});
    const boundary=[],basis=[];
    for(let i=0;i<3;i++){
      const j=(i+1)%3,weights=Array(3).fill(0);weights[i]=1;
      boundary.push(vertices[i]);basis.push(weights);
      const pair=[sorted[i],sorted[j]],beta=pairFraction(pair);
      const split=canon(pair)[0]===sorted[i]?beta:1-beta;
      const mix=Array(3).fill(0);mix[i]=1-split;mix[j]=split;
      boundary.push(midpoint(vertices[i],vertices[j]));basis.push(mix);
    }
    const centre={x:vertices.reduce((a,p)=>a+p.x,0)/3,y:vertices.reduce((a,p)=>a+p.y,0)/3};
    const salts=sorted.map(o=>.000001+fraction('triangle:'+sorted.map(ownerKey).join('|')+':'+ownerKey(o)));
    const sum=salts.reduce((a,b)=>a+b,0),centreWeights=salts.map(v=>.25+.25*v/sum);
    for(let k=0;k<boundary.length;k++){
      const n=(k+1)%boundary.length,b=barycentric(position,centre,boundary[k],boundary[n]);
      if(b && b.every(v=>v>=-1e-7))return sorted.map((o,i)=>({...o,weight:Math.max(0,b[0]*centreWeights[i]+b[1]*basis[k][i]+b[2]*basis[n][i])}));
    }
    // Precision fallback is still deterministic at extreme shared vertices.
    const b=barycentric(position,...vertices)||[1,0,0];
    return sorted.map((o,i)=>({...o,weight:Math.max(0,b[i])}));
  }
  function sharedSquare(from,to) {
    const A=center(from.col,from.row),B=center(to.col,to.row);
    const vx=B.x-A.x,vy=B.y-A.y,length=Math.hypot(vx,vy);
    if(Math.abs(length-Math.sqrt(3))>1e-5)return null;
    const nx=vx/length,ny=vy/length,tx=-ny,ty=nx;
    const width=coreRadius,half=width/2,mid=midpoint(A,B);
    const corners=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([along,side])=>({
      x:mid.x+nx*along*half+tx*side*half,
      y:mid.y+ny*along*half+ty*side*half
    }));
    return {center:mid,corners,tangent:{x:tx,y:ty},normal:{x:nx,y:ny},halfSize:half,owners:canon([from,to])};
  }
  function sharedTriangle(col,row,index) {
    const source=center(col,row),junction={x:source.x+corners[index].x,y:source.y+corners[index].y};
    const owners=canon(regionOwners(col,row,'corner',index));
    const vertices=owners.map(o=>{
      const c=center(o.col,o.row);
      return {x:c.x+(junction.x-c.x)*coreRadius,y:c.y+(junction.y-c.y)*coreRadius};
    });
    return {owners,corners:vertices,center:{x:vertices.reduce((a,p)=>a+p.x,0)/3,y:vertices.reduce((a,p)=>a+p.y,0)/3}};
  }
  function regionAt(x,y) {
    const guess=Math.round((x-1)/1.5);let col=guess,row=0,best=Infinity;
    for(let c=guess-1;c<=guess+1;c++){
      const r=Math.round(y/Math.sqrt(3)-.5-(c%2?.5:0)),p=center(c,r),d=(p.x-x)**2+(p.y-y)**2;
      if(d<best){best=d;col=c;row=r;}
    }
    const origin=center(col,row),dx=x-origin.x,dy=y-origin.y;
    let kind='core',index=0,owners=[{col,row,weight:1}];
    if(normals.some(n=>dx*n.x+dy*n.y>apothem*coreRadius+3e-6)){
      index=normals.findIndex(n=>dx*n.x+dy*n.y>=apothem*coreRadius-3e-6&&Math.abs(-dx*n.y+dy*n.x)<=coreRadius/2+3e-6);
      if(index>=0){
        kind='edge';
        const local=regionOwners(col,row,kind,index),sorted=canon(local);
        const n=normals[index],t=Math.max(0,Math.min(1,(dx*n.x+dy*n.y-apothem*coreRadius)/(2*apothem*(1-coreRadius))));
        const canonicalT=ownerKey(local[0])===ownerKey(sorted[0])?t:1-t;
        const fractionB=pairSplit(canonicalT,pairFraction(sorted));
        owners=sorted.map((o,i)=>({...o,weight:i===0?1-fractionB:fractionB}));
      }else{
        kind='corner';index=0;
        for(let i=1;i<6;i++)if(dx*corners[i].x+dy*corners[i].y>dx*corners[index].x+dy*corners[index].y)index=i;
        const junction={x:origin.x+corners[index].x,y:origin.y+corners[index].y};
        owners=cornerInfluences({x,y},regionOwners(col,row,kind,index),junction);
      }
    }
    return {kind,index,col,row,owners};
  }
  const meshCache=new Map();
  function regionMesh(steps) {
    if(meshCache.has(steps))return meshCache.get(steps);
    const inner=corners.map(p=>({x:p.x*coreRadius,y:p.y*coreRadius}));
    const projected=(i,end)=>{const p=inner[(i+end)%6],n=normals[i];return {x:p.x+n.x*apothem*(1-coreRadius),y:p.y+n.y*apothem*(1-coreRadius)};};
    const regions=[{kind:'core',index:0,points:inner}];
    for(let i=0;i<6;i++){
      regions.push({kind:'edge',index:i,points:[inner[i],projected(i,0),projected(i,1),inner[(i+1)%6]]});
      regions.push({kind:'corner',index:i,points:[inner[i],projected((i+5)%6,1),corners[i],projected(i,0)]});
    }
    const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    function clip(poly,boundary){
      for(let i=0;i<boundary.length&&poly.length;i++){
        const a=boundary[i],b=boundary[(i+1)%boundary.length],out=[];
        for(let j=0;j<poly.length;j++){
          const p=poly[j],q=poly[(j+1)%poly.length],dp=cross(a,b,p),dq=cross(a,b,q);
          if(dp>=-1e-10)out.push(p);
          if((dp>=-1e-10)!==(dq>=-1e-10)){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
        }
        poly=out;
      }
      return poly.filter((p,i)=>i===0||Math.hypot(p.x-poly[i-1].x,p.y-poly[i-1].y)>1e-8);
    }
    const faces=[];
    function add(triangle){for(const region of regions){
      const points=clip(triangle,region.points);
      const area=Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-p.y*q.x;},0))/2;
      if(area>1e-10)faces.push({kind:region.kind,index:region.index,points});
    }}
    for(let i=0;i<6;i++){
      const a=corners[i],b=corners[(i+1)%6],v=(u,w)=>({x:(a.x*u+b.x*w)/steps,y:(a.y*u+b.y*w)/steps});
      for(let u=0;u<steps;u++)for(let w=0;w<steps-u;w++){
        add([v(u,w),v(u+1,w),v(u,w+1)]);
        if(u+w<steps-1)add([v(u+1,w),v(u+1,w+1),v(u,w+1)]);
      }
    }
    meshCache.set(steps,faces);return faces;
  }
  // A continuous world-space surface. Shared vertices are independent of tile ownership.
  function surface(x,y,lookup,palette) {
    const region=regionAt(x,y),rgb=[0,0,0];
    const owners=region.owners.map(o=>({...o,data:lookup(o.col,o.row)}));
    if(owners.some(o=>!o.data?.terrain||o.data.terrain==='UNKNOWN'))return {x,y,z:.14,color:'#253640',water:false,rock:0,fog:true};
    let total=0,hills=0,low=0,high=0,snow=0,coastLand=0,coastWater=0;
    for(const owner of owners){
      const terrain=owner.data.terrain,w=owner.weight;
      if(water(terrain)){coastWater+=w;continue;}
      coastLand+=w;total+=w;hills+=isHill(terrain)?w:0;low+=isLowMountain(terrain)?w:0;high+=isHighMountain(terrain)?w:0;snow+=['LSM','HSM','ALPS'].includes(terrain)?w:0;
      const color=palette(terrain);[1,3,5].forEach((p,i)=>rgb[i]+=parseInt(color.slice(p,p+2),16)*w);
    }
    // About 60% of the land-side connector is water; seeded detail breaks
    // straight shorelines without changing either inner hex.
    const coastRoughness=setting('coastRoughness',.16);
    const shoreline=coastRoughness*((noise(x*2.3,y*2.3,419)-.5)*.625+(noise(x*8.1,y*8.1,557)-.5)*.375);
    const coastTotal=coastLand+coastWater;
    const landFraction=coastTotal?coastLand/coastTotal:1;
    // Calibrate from the physical A–B square, approximately 60% water along a coast.
    const threshold=setting('coastWaterShare',.6)+shoreline;
    const coastField=landFraction-threshold;
    if(coastField<=0)return {x,y,z:0,color:'#337f98',water:true,rock:0};
    const weights=total?{hill:hills/total,low:low/total,high:high/total,snow:snow/total}:{hill:0,low:0,high:0,snow:0};
    const {broad,ridge,detail}=relief(x,y);
    // Distinct silhouette families, even with identical ground colours.
    const hillHeight=.18+setting('hillAmplitude',.53)*broad+setting('ruggedness',.15)*(detail-.5);
    const ridgeTerm=Math.pow(ridge,setting('ridgeSharpness',2.8));
    const lowHeight=.60+.16*broad+.42*ridgeTerm+setting('ruggedness',.15)*(detail-.5);
    const highHeight=1.27+.23*broad+setting('mountainHeight',.83)*ridgeTerm+setting('ruggedness',.15)*2*(detail-.5);
    const raw=.14+(2/3)*(weights.hill*hillHeight+weights.low*lowHeight+weights.high*highHeight);
    // Hills ease into level water with a flat beach tangent. Mountains retain
    // a steep rocky coastal face. The core boundary still joins unchanged.
    const inland=Math.max(0,Math.min(1,coastField/(1-threshold)));
    const mountain=weights.low+weights.high;
    const slope=smooth(inland);
    const cliff=1-Math.pow(1-inland,3);
    const coastalRaw=raw*(slope*(1-mountain)+cliff*mountain);
    const layer=(.10+weights.hill*.025+weights.low*.035+weights.high*.065)*(1/3);
    // Suppress terracing at hill beaches, retaining strata farther inland.
    const terraces=mountain+(1-mountain)*smooth(inland);
    const z=coastalRaw*(1-terraces)+layeredHeight(coastalRaw,layer)*terraces;
    let land=total?rgb.map(n=>n/total):[37,54,64];
    // Strata exposure belongs to the ground, never separate boulder props.
    // Broken patches expose some hill stone; mountain shoulders expose more.
    const band=coastalRaw/layer-Math.floor(coastalRaw/layer);
    const riser=smooth((band-.22)/.14)*(1-smooth((band-.64)/.14));
    const patch=smooth((detail-.38)/.28);
    const rock=Math.min(.92,weights.hill*patch*riser*setting('rockExposure',.72)+
      weights.low*(.12+.68*patch)*(.4+.6*riser)+
      weights.high*(.38+.48*patch)*(.65+.35*riser));
    const stone=[132,136,119];
    land=land.map((v,i)=>v*(1-rock)+stone[i]*rock);
    const snowCover=weights.snow*smooth((z-(.14+(2/3)*((weights.high>weights.low?1.64:.86)-.14)))/(.38*2/3));
    land=land.map((v,i)=>v*(1-snowCover)+[224,233,230][i]*snowCover);
    // Low ground becomes beach then grass/stone, independent of hex edges.
    const shore=smooth(inland/.75),bank=[185,178,138].map((v,i)=>v*(1-mountain)+stone[i]*mountain);
    const color='#'+land.map((v,i)=>Math.round(bank[i]*(1-shore)+v*shore).toString(16).padStart(2,'0')).join('');
    return {x,y,z,color,water:false,rock};
  }
  // Keep scenery bases inside the revealed polygon. Raised crowns may extend
  // naturally across a fog bank, but no hidden-side trees are generated.
  function sceneryVisible(x,y,neighbours) {
    return neighbours.every((known,i)=>known || x*Math.cos((i+.5)*Math.PI/3)+y*Math.sin((i+.5)*Math.PI/3)<Math.sqrt(3)/2*coreRadius-.04);
  }
  const api={WORLD_SEED,coreRadius,regionAt,regionOwners,regionMesh,groundSubdivisions,subdivisions,sharedSquare,sharedTriangle,pairFraction,cornerInfluences,reliefSeed,treeSite,isLowMountain,isHighMountain,scenerySeed,sceneryRandom,sceneryDetails,sceneryVisible,surface,isHill,isForest,directions,corners,seed,random,project,unproject,rivers,riverNotes,mix};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.IsoGeometry=api;
})(typeof window!=='undefined'?window:globalThis);

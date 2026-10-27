/* Shared geometry: flat-top, odd-column hexes; screen north is map north. */
(function(root) {
  const directions = ['SE', 'S', 'SW', 'NW', 'N', 'NE'];
  const corners = Array.from({length:6}, (_,i) => ({x:Math.cos(i*Math.PI/3), y:Math.sin(i*Math.PI/3)}));
  function seed(reference) {
    let n = 2166136261;
    // World seed is numeric and intentionally fixed; hash it as a stable decimal
    // string. Previous versions called .toUpperCase() on this number and
    // aborted script evaluation, leaving the entire 3D Mapper black.
    for (const c of String(reference).toUpperCase()) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
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
  // Fixed world-space mesh fidelity prevents zoom-dependent coastline shape
  // changes. The shoreline contour has separate local refinement in Mapper.
  const groundSubdivisions=8;
  const subdivisions=()=>8;
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
    // The old two straight segments met at the seeded midpoint with
    // different slopes (2*beta versus 2*(1-beta)), making a hard ridge
    // across every shared square. Cubic Hermite interpolation keeps exactly
    // the SAME seeded midpoint and pure core endpoints, but is C1 across
    // the midpoint and flat-tangent where it joins each immutable core.
    t=Math.max(0,Math.min(1,t));
    const hermite=(a,b,m0,m1,u)=>{
      const u2=u*u,u3=u2*u;
      return (2*u3-3*u2+1)*a+(u3-2*u2+u)*m0+
        (-2*u3+3*u2)*b+(u3-u2)*m1;
    };
    return t<=.5
      ? hermite(0,beta,0,.5,t*2)
      : hermite(beta,1,.5,0,(t-.5)*2);
  }
  function barycentric(p,a,b,c) {
    const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(den)<1e-12)return null;
    const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
    const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
    return [u,v,1-u-v];
  }
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  // Rare, deterministic landing coves on coastal HILL or MOUNTAIN edges.
  // Compact lanes stop before the square sides, so no pair-selection switch
  // or decoration can leak across a corner or into an immutable core.
  // the inner cores and game movement rules are never changed.
  function coastalLanding(region,owners,x,y){
    if(region.kind!=='edge')return null;
    const wet=owners.filter(o=>water(o.data?.terrain));
    const steep=owners.filter(o=>isHill(o.data?.terrain)||
      isLowMountain(o.data?.terrain)||isHighMountain(o.data?.terrain));
    if(!wet.length||!steep.length)return null;
    // A triangle may own three hexes. Use the most strongly represented
    // water/hill pair; each pair keeps the same seed on adjacent triangles.
    const pairs=[];
    for(const a of wet)for(const b of steep){
      const sorted=canon([a,b]),key=sorted.map(ownerKey).join('|');
      pairs.push({a,b,key,score:a.weight+b.weight});
    }
    pairs.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
    const pair=pairs[0],chance=fraction('landing:'+pair.key);
    if(chance>=.115)return null;
    const A=center(pair.a.col,pair.a.row),B=center(pair.b.col,pair.b.row);
    const dx=B.x-A.x,dy=B.y-A.y,distance=Math.hypot(dx,dy);
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    // Subtle offsets, but the same location and heading from either owner.
    const shift=(fraction('landing-lane:'+pair.key)-.5)*.10;
    const lateral=((x-mx)*(-dy)+(y-my)*dx)/distance-shift;
    const width=.17+.035*fraction('landing-width:'+pair.key);
    const beach=smooth((width-Math.abs(lateral))/.09);
    const pathChance=fraction('landing-path:'+pair.key)<.38;
    const routeWidth=.055+.018*fraction('landing-route-width:'+pair.key);
    const path=pathChance?smooth((routeWidth+.045-Math.abs(lateral))/.045):0;
    const position=.5+((x-mx)*dx+(y-my)*dy)/(distance*coreRadius);
    const canonical=canon([pair.a,pair.b]);
    return {beach,path,pathChance,routeWidth,lateral,routeSide:fraction('landing-route-side:'+pair.key)<.5?-1:1,position,waterFirst:ownerKey(pair.a)===ownerKey(canonical[0]),beta:pairFraction(canonical),rocky:fraction('landing-material:'+pair.key)<.48,key:pair.key};
  }
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
      if(b && b.every(v=>v>=-1e-7)){
        // Evaluate the SAME curved pair boundary as the adjoining square.
        // Interpolating only its endpoints/midpoint made the old corner fan
        // disagree with Hermite edges everywhere between those three points.
        const radial=Math.max(0,b[1]+b[2]);
        const pairIndex=Math.floor(k/2),i=pairIndex,j=(i+1)%3;
        const u=radial>1e-12?Math.max(0,Math.min(1,b[2]/radial)):0;
        const t=(k%2+u)/2,pair=[sorted[i],sorted[j]];
        const canonicalFirst=canon(pair)[0]===sorted[i];
        const split=canonicalFirst?pairSplit(t,pairFraction(pair)):
          1-pairSplit(1-t,pairFraction(pair));
        return sorted.map((o,n)=>({...o,weight:Math.max(0,
          (1-radial)*centreWeights[n]+radial*(n===i?1-split:n===j?split:0))}));
      }
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
  // Refined coastal vertices on core and tile boundaries must lie on
  // the EXISTING coarse mesh edge, not resample its curved height function.
  // Otherwise a T-junction opens a vertical crack despite identical XY.
  let coreSegments;
  function conformMeshBoundary(x,y,sample){
    const guess=Math.round((x-1)/1.5);let c,best=Infinity;
    for(let col=guess-1;col<=guess+1;col++){
      const row=Math.round(y/Math.sqrt(3)-.5-(col%2?.5:0)),candidate=center(col,row);
      const distance=(x-candidate.x)**2+(y-candidate.y)**2;
      if(distance<best){best=distance;c=candidate;}
    }
    const p={x:x-c.x,y:y-c.y};
    const near=normals.some(n=>[coreRadius,1].some(radius=>Math.abs(p.x*n.x+p.y*n.y-apothem*radius)<2e-6));
    if(!near)return sample(x,y);
    if(!coreSegments){
      coreSegments=[];
      for(const face of regionMesh(groundSubdivisions)){
        for(let i=0;i<face.points.length;i++){
          const a=face.points[i],b=face.points[(i+1)%face.points.length];
          if(normals.some(n=>[coreRadius,1].some(radius=>Math.abs(a.x*n.x+a.y*n.y-apothem*radius)<1e-8&&
            Math.abs(b.x*n.x+b.y*n.y-apothem*radius)<1e-8)))coreSegments.push([a,b]);
        }
      }
    }
    for(const [a,b] of coreSegments){
      const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
      if(d2<1e-16)continue;
      const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/d2;
      if(t< -1e-5||t>1+1e-5||Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))>2e-6*Math.sqrt(d2))continue;
      const A=sample(c.x+a.x,c.y+a.y),B=sample(c.x+b.x,c.y+b.y),u=Math.max(0,Math.min(1,t));
      if(A.fog||B.fog)return sample(x,y);
      const actual=sample(x,y);
      if(Boolean(A.water)!==Boolean(B.water)){
        let lo=0,hi=1;
        for(let i=0;i<20;i++){
          const m=(lo+hi)/2,q=sample(c.x+a.x+dx*m,c.y+a.y+dy*m);
          if(Boolean(q.water)===Boolean(A.water))lo=m;else hi=m;
        }
        const coast=(lo+hi)/2,level=A.water?A.z:B.z;
        if(actual.water)return actual;
        const z=A.water?level+(B.z-level)*Math.max(0,(u-coast)/(1-coast)):
          A.z+(level-A.z)*Math.min(1,u/coast);
        return {...actual,z};
      }
      return {...actual,z:A.z*(1-u)+B.z*u};
    }
    return sample(x,y);
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
    // Water should occupy the configured fraction of the *land-side half*
    // of a mixed shared square, regardless of seeded 25–75 influence.
    // Water weight goes 0 -> seeded midpoint weight in that half. The
    // threshold must be calibrated to this pair, not to a fixed 0.6 field.
    const waterOwners=owners.filter(o=>water(o.data.terrain));
    const configuredWaterShare=setting('coastWaterShare',.6);
    const landing=coastWater>0?coastalLanding(region,owners,x,y):null;
    // A cove removes cliff material inland. It never adds a platform into
    // the water: ordinary coast and landing use the identical shoreline.
    const waterShare=configuredWaterShare;
    // A coastal threshold is a pair property. Extend those exact boundary
    // values into a corner with positive pair weights; never switch to a
    // different constant just because regionAt crossed square -> triangle.
    let thresholdSum=0,thresholdWeight=0;
    for(const wet of waterOwners)for(const dry of owners.filter(o=>!water(o.data.terrain))){
      const pair=canon([wet,dry]),beta=pairFraction(pair);
      const waterFirst=ownerKey(wet)===ownerKey(pair[0]);
      const t=waterFirst?.5+.5*waterShare:.5-.5*waterShare;
      const value=waterFirst?pairSplit(t,beta):1-pairSplit(t,beta);
      const w=wet.weight*dry.weight;
      thresholdSum+=w*value;thresholdWeight+=w;
    }
    const baseThreshold=thresholdWeight>1e-14?thresholdSum/thresholdWeight:waterShare;
    // At high water share, an unrestricted roughness offset can exceed 1:
    // water then reaches the immutable dry core and opens a vertical crack.
    // Bound noise by the available weight range, preserving a dry core join.
    const noiseLimit=Math.max(1e-9,(shoreline>=0?1-baseThreshold:baseThreshold)*.5);
    const threshold=baseThreshold+noiseLimit*Math.tanh(shoreline/noiseLimit);
    const coastField=landFraction-threshold;
    // Ocean and lake surfaces share one adjustable physical level. Colour varies
    // gently with world-space noise and is lighter in the coastal shallows;
    // this never changes the categorical water/land ownership.
    const waterLevel=setting('waterHeight',.10);
    if(coastField<=0){
      const shallows=coastLand>0 ? smooth(coastLand*2.0) : 0;
      const ripple=(noise(x*.73,y*.73,831)-.5)*11+(noise(x*2.1,y*2.1,419)-.5)*5;
      const depthColor=[38,105,137],shoreColor=[65,147,158];
      const channels=depthColor.map((c,i)=>Math.max(0,Math.min(255,Math.round(c*(1-shallows)+shoreColor[i]*shallows+ripple))));
      return {x,y,z:waterLevel,color:'#'+channels.map(c=>c.toString(16).padStart(2,'0')).join(''),water:true,rock:0};
    }
    const weights=total?{hill:hills/total,low:low/total,high:high/total,snow:snow/total}:{hill:0,low:0,high:0,snow:0};
    const {broad,ridge,detail}=relief(x,y);
    // Distinct silhouette families, even with identical ground colours.
    // Height controls scale the *whole* feature including its baseline.
    // Previously "minimum" mountain height still left a 1.27-unit peak.
    const hillScale=setting('hillAmplitude',.53)/.53;
    const mountainScale=setting('mountainHeight',.83)/.83;
    const hillHeight=hillScale*(.18+.53*broad+setting('ruggedness',.15)*(detail-.5));
    const ridgeTerm=Math.pow(ridge,setting('ridgeSharpness',2.8));
    const lowHeight=mountainScale*(.60+.16*broad+.42*ridgeTerm+setting('ruggedness',.15)*(detail-.5));
    const highHeight=mountainScale*(1.27+.23*broad+.83*ridgeTerm+setting('ruggedness',.15)*2*(detail-.5));
    // Plains have slight broad undulations and patchy colours, not mountain-like
    // terracing. Adjacent hills blend through the established shared weights.
    const plainFraction=Math.max(0,1-weights.hill-weights.low-weights.high);
    const plainVariation=setting('plainsRelief',.055)*((broad-.5)*.75+(detail-.5)*.25);
    // Biome proportions are unchanged, but elevation needs its own nonlinear
    // transition. A mostly-PR square should be broad, flat foothills rather
    // than a diagonal wall from the first hint of GH / mountains.
    const flatness=setting('foothillFlatness',.20);
    const foothill=w=>smooth((w-flatness*.35)/(1-flatness*.35));
    const mountFoot=w=>smooth((w-flatness*.65)/(1-flatness*.65));
    const base=Math.max(.14,setting('waterHeight',.10)+.025);
    const raw=base+plainFraction*plainVariation+
      (2/3)*(foothill(weights.hill)*hillHeight+
        mountFoot(weights.low)*lowHeight+mountFoot(weights.high)*highHeight);
    // Hills ease into level water with a flat beach tangent. Mountains retain
    // a steep rocky coastal face. The core boundary still joins unchanged.
    const inland=Math.max(0,Math.min(1,coastField/(1-threshold)));
    const mountain=weights.low+weights.high;
    // World-space, broad variation is shared by square/corner samples.
    // The warp is monotone and fixes both endpoints, preserving every core.
    const coastShape=noise(x*.72+19,y*.72-31,1237);
    const shaped=inland+(coastShape-.5)*1.1*inland*(1-inland);
    const slope=smooth(shaped);
    // A zero shoreline tangent keeps steep cliff feet stable when nearby
    // dry and clipped water vertices round to the same Float32 XY position.
    const cliff=(1-Math.pow(1-shaped,3))*smooth(shaped/.05);
    // Ownership weights have flat Hermite tangents: their normalised value
    // is NOT distance from shore. Resolve the noisy shoreline in geometric
    // coordinates so the shelf keeps a measurable width on the actual mesh.
    let landingInland=inland;
    if(landing?.beach>0){
      let lo=0,hi=1;
      for(let i=0;i<18;i++){
        const u=(lo+hi)/2;
        const land=landing.waterFirst?pairSplit(u,landing.beta):1-pairSplit(1-u,landing.beta);
        if(land<threshold)lo=u;else hi=u;
      }
      const coast=(lo+hi)/2;
      landingInland=Math.max(0,Math.min(1,(landing.position-coast)/(1-coast)));
    }
    // The recessed shelf occupies the landward dry strip. Its rounded lane
    // support blends the back wall into both headlands without moving shore.
    // A diagonal route crosses a side shoulder as it climbs; compact support
    // keeps its excavation and colour away from square/corner boundaries.
    const routeCentre=landing?landing.routeSide*(.025+.105*smooth((landingInland-.36)/.53)):0;
    const routeMask=landing?.pathChance?
      smooth((landing.routeWidth+.025-Math.abs(landing.lateral-routeCentre))/.025)*landing.beach:0;
    const shelf=p=>p<.58?.025*smooth(p/.58):.025+.975*smooth((p-.58)/.42);
    const route=p=>p<.32?.025*smooth(p/.32):.025+.975*smooth((p-.32)/.68);
    const faceMix=mountain+(1-mountain)*smooth((coastShape-.35)/.4)*.65;
    const ordinary=slope*(1-faceMix)+cliff*faceMix;
    const coveSlope=shelf(landingInland)*(1-routeMask)+route(landingInland)*routeMask;
    const coastalSlope=ordinary*(1-(landing?.beach||0))+coveSlope*(landing?.beach||0);
    const coastalRaw=waterLevel+(raw-waterLevel)*coastalSlope;
    const layer=(.10+weights.hill*.025+weights.low*.035+weights.high*.065)/3;
    // Keep the original immutable core surface. Shared terrain interpolates
    // unquantised relief: quantising a varying height/layer creates rings.
    // Only the small residual needed to meet each core survives near it.
    const pureHeights=[base+plainVariation,base+(2/3)*hillHeight,
      base+(2/3)*lowHeight,base+(2/3)*highHeight];
    const pureLayers=[.10/3,.125/3,.135/3,.165/3];
    let residual=0;
    for(const o of owners){
      if(water(o.data.terrain))continue;
      const i=isHighMountain(o.data.terrain)?3:isLowMountain(o.data.terrain)?2:isHill(o.data.terrain)?1:0;
      residual+=Math.pow(o.weight,8)*(layeredHeight(pureHeights[i],pureLayers[i])-pureHeights[i]);
    }
    const z=region.kind==='core'?layeredHeight(raw,layer):
      coastalRaw+residual*Math.pow(coastalSlope,8);
    let land=total?rgb.map(n=>n/total):[37,54,64];
    // Add world-coherent grassy patches without sculpting artificial hills.
    const colourNoise=(noise(x*1.38+83,y*1.38-27,177)-.5)*.7+
      (noise(x*4.25,y*4.25,519)-.5)*.3;
    const variation=plainFraction*setting('plainsTexture',.22)*colourNoise;
    land=land.map((v,i)=>Math.max(0,Math.min(255,v*(1+variation*(i===1?1.15:.78)))));
    // Strata exposure belongs to the ground, never separate boulder props.
    // Broken patches expose some hill stone; mountain shoulders expose more.
    const band=coastalRaw/layer-Math.floor(coastalRaw/layer);
    const riser=region.kind==='core'?smooth((band-.22)/.14)*(1-smooth((band-.64)/.14)):.45;
    const patch=smooth((detail-.38)/.28);
    let rock=Math.min(.92,weights.hill*patch*riser*setting('rockExposure',.72)+
      weights.low*(.12+.68*patch)*(.4+.6*riser)+
      weights.high*(.38+.48*patch)*(.65+.35*riser));
    // Keep grassy coastal shoulders; actual steep faces receive stone from
    // their triangle normals in both renderer paths. Core materials stay fixed.
    if(region.kind!=='core'&&coastWater>0)rock*=.35+.65*mountain;
    const stone=[132,136,119];
    land=land.map((v,i)=>v*(1-rock)+stone[i]*rock);
    const snowCover=weights.snow*smooth((z-(.14+(2/3)*((weights.high>weights.low?1.64:.86)-.14)))/(.38*2/3));
    land=land.map((v,i)=>v*(1-snowCover)+[224,233,230][i]*snowCover);
    // Low ground becomes beach then grass/stone, independent of hex edges.
    const shore=smooth(inland/.75),bank=[185,178,138].map((v,i)=>v*(1-mountain)+stone[i]*mountain);
    land=land.map((v,i)=>bank[i]*(1-shore)+v*shore);
    if(landing){
      // Short shingle/sand coves rather than continuous coastal bands.
      const cove=landing.beach*(1-smooth((landingInland-.52)/.22));
      const material=landing.rocky?[155,148,124]:[203,181,137];
      land=land.map((v,i)=>v*(1-cove*.82)+material[i]*cove*.82);
      if(routeMask){
        const track=routeMask*smooth((landingInland-.32)/.15)*
          (1-smooth((landingInland-.78)/.22));
        const dust=landing.rocky?[142,137,119]:[159,145,109];
        land=land.map((v,i)=>v*(1-track*.58)+dust[i]*track*.58);
      }
    }
    // Elevation, rather than ownership weight, anchors the wet strip to
    // the actual waterline on both cliff faces and landing shelves.
    const wetBand=region.kind!=='core'&&coastWater>0?
      1-smooth(Math.max(0,z-waterLevel)/.009):0;
    const color='#'+land.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
    return {x,y,z,color,water:false,rock,wetness:wetBand,coastalPath:routeMask,landing:landing?landing.beach*(1-smooth((landingInland-.58)/.20)):0};
  }
  // Keep scenery bases inside the revealed polygon. Raised crowns may extend
  // naturally across a fog bank, but no hidden-side trees are generated.
  function sceneryVisible(x,y,neighbours) {
    return neighbours.every((known,i)=>known || x*Math.cos((i+.5)*Math.PI/3)+y*Math.sin((i+.5)*Math.PI/3)<Math.sqrt(3)/2*coreRadius-.04);
  }
  const api={conformMeshBoundary,WORLD_SEED,coreRadius,regionAt,regionOwners,regionMesh,groundSubdivisions,subdivisions,sharedSquare,sharedTriangle,pairFraction,pairSplit,cornerInfluences,reliefSeed,treeSite,isLowMountain,isHighMountain,scenerySeed,sceneryRandom,sceneryDetails,sceneryVisible,surface,coastalLanding,isHill,isForest,directions,corners,seed,random,project,unproject,rivers,riverNotes,mix};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.IsoGeometry=api;
})(typeof window!=='undefined'?window:globalThis);

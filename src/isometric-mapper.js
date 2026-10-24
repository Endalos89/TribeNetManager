/* Software-rendered 3D meshes through an orthographic isometric camera.
   Kept alongside the existing renderer so all map tools share one state. */
const IsoMapper = (() => {
  const G=IsoGeometry, WATER='#337f98', FOG='#253640';
  let enabled=false, labels=true, grid=false;
  let preloadJob=0, preloadCount=0;
  const terrainRasterCache=new Map();
  let terrainRasterBytes=0;
  const detailCache=new Map(), cellCache=new Map(), surfaceCache=new Map(), groundCache=new Map(), resourceIconCache=new Map();
  let interactive=false, settleTimer=null, hitScale=1, sceneBuilds=0, groundBuilds=0;
  let unitSignature='', decorationSignature='', groundLayer=null, frameRect=null, hitFaces=[], hitOffset={x:0,y:0}, renderCtx=ctx, landscape=null;
  // Track individual terrain changes rather than hashing every known cell and
  // invalidating the whole world whenever one newly discovered hex arrives.
  const terrainSnapshot=new Map(),notesSnapshot=new Map();
  function mapData(ref) {
    const target=state.hexCache.get(ref);
    return typeof resultsPlaybackMapData==='function' ? resultsPlaybackMapData(ref,target) : target;
  }
  function surfaceData(col,row) {
    if(col<0||row<0||col>=TOTAL_COLS||row>=TOTAL_ROWS)return null;
    const key=col*TOTAL_ROWS+row;
    if(!cellCache.has(key))cellCache.set(key,mapData(coordinateFor(col,row)));
    return cellCache.get(key);
  }
  function sample(x,y) {
    // Quantisation gives the two owners of a shared edge exactly the same vertex.
    x=Math.round(x*1e6)/1e6;y=Math.round(y*1e6)/1e6;
    const key=`${x}:${y}`;
    if(!surfaceCache.has(key)){
      if(surfaceCache.size>140000)surfaceCache.clear();
      surfaceCache.set(key,G.surface(x,y,surfaceData,color));
    }
    return surfaceCache.get(key);
  }
  function prepareSurface() {
    const next=new Map(),nextNotes=new Map(),changed=new Set();
    let decorationsChanged=false;
    // String comparisons avoid repeated river parsing on *every* animation
    // frame. Terrain chunks are invalidated by terrain values only; notes
    // affect the overlay but don't require regenerating the GPU world.
    for(const [ref,data] of state.hexCache){
      const terrain=mapData(ref)?.terrain||'UNKNOWN';
      next.set(ref,terrain);
      if(terrainSnapshot.get(ref)!==terrain)changed.add(ref);
      const notes=String(data?.notes||'');
      const prior=notesSnapshot.get(ref);
      const rivers=prior && prior.notes===notes
        ? prior.rivers
        : [...G.rivers(data)].sort().join(',');
      nextNotes.set(ref,{notes,rivers});
      if((prior?.rivers||'')!==rivers)decorationsChanged=true;
    }
    for(const ref of terrainSnapshot.keys())if(!next.has(ref))changed.add(ref);
    for(const [ref,prior] of notesSnapshot)if(!nextNotes.has(ref) && prior.rivers)decorationsChanged=true;
    const hadMesh=Boolean(window.TribeNetGPU?.chunkCache?.size);
    terrainSnapshot.clear();notesSnapshot.clear();
    for(const [ref,terrain] of next)terrainSnapshot.set(ref,terrain);
    for(const [ref,notes] of nextNotes)notesSnapshot.set(ref,notes);
    if(decorationsChanged){landscape=null;}
    if(changed.size===0)return;

    // Clear analytic samples (which may blend up to three owners), but retain
    // all unaffected GPU chunks and other already-generated terrain faces.
    cellCache.clear();
    surfaceCache.clear();
    landscape=null;groundLayer=null;
    const affected=new Set();
    for(const ref of changed){
      const p=typeof parseCoordinate==='function'
        ? parseCoordinate(ref)
        : (()=>{const [col,row]=ref.split(':').map(Number);return Number.isFinite(col)&&Number.isFinite(row)?{globalCol:col,globalRow:row}:null;})();
      if(!p)continue;
      for(let dc=-2;dc<=2;dc++)for(let dr=-2;dr<=2;dr++){
        const col=p.globalCol+dc,row=p.globalRow+dr;
        if(col>=0&&row>=0&&col<TOTAL_COLS&&row<TOTAL_ROWS)
          affected.add(coordinateFor(col,row));
      }
    }
    for(const key of groundCache.keys())
      if(affected.has(key.replace(/:\d+:\d+$/, '')))groundCache.delete(key);
    if(hadMesh)window.TribeNetGPU?.invalidateHexes?.([...affected].map(ref=>{
      const p=typeof parseCoordinate==='function'
        ? parseCoordinate(ref)
        : (()=>{const [col,row]=ref.split(':').map(Number);return Number.isFinite(col)&&Number.isFinite(row)?{globalCol:col,globalRow:row}:null;})();
      return p?{col:p.globalCol,row:p.globalRow}:null;
    }).filter(Boolean));
    // During initial startup the GPU has no generated terrain yet.
  }
  const isWater=t=>t==='O'||t==='L';
  const known=d=>d && d.terrain && d.terrain!=='UNKNOWN';
  const color=t=>terrainStyle[t]?.[0] || FOG;
  function withProjection(fn) {const previous=frameRect;frameRect=canvas.getBoundingClientRect();try{return fn();}finally{frameRect=previous;}}
  function project(p,z=null) {
    const r=frameRect||canvas.getBoundingClientRect(), q=G.project((p.x-state.cameraX)*1.5,(p.y-state.cameraY)*1.5,z??sample(p.x,p.y).z);
    return {x:r.width/2+q.x*state.scale,y:r.height/2+q.y*state.scale};
  }
  function inverse(x,y) {
    const r=canvas.getBoundingClientRect(),q=G.unproject((x-r.width/2)/state.scale,(y-r.height/2)/state.scale);
    return {x:q.x/1.5+state.cameraX,y:q.y/1.5+state.cameraY};
  }
  function bounds() {
    const r=canvas.getBoundingClientRect(),pad=Math.max(250,state.scale*1.7);
    const ps=[inverse(-pad,-pad),inverse(r.width+pad,-pad),inverse(-pad,r.height+pad),inverse(r.width+pad,r.height+pad)];
    return {minCol:Math.max(0,Math.floor((Math.min(...ps.map(p=>p.x))-1)/1.5)-2),maxCol:Math.min(TOTAL_COLS-1,Math.ceil(Math.max(...ps.map(p=>p.x))/1.5)+2),minRow:Math.max(0,Math.floor(Math.min(...ps.map(p=>p.y))/SQRT3)-2),maxRow:Math.min(TOTAL_ROWS-1,Math.ceil(Math.max(...ps.map(p=>p.y))/SQRT3)+2)};
  }
  function polygon(points,fill,stroke) {
    renderCtx.beginPath(); points.forEach((p,i)=>i?renderCtx.lineTo(p.x,p.y):renderCtx.moveTo(p.x,p.y));renderCtx.closePath();
    if(fill){renderCtx.fillStyle=fill;renderCtx.fill();} if(stroke){renderCtx.strokeStyle=stroke;renderCtx.lineWidth=1.2;renderCtx.stroke();}
  }
  function mesh(points,fill) {polygon(points.map(p=>project(p,p.z||0)),fill,fill);}
  function line(points,color,width) {
    renderCtx.beginPath(); points.forEach((p,i)=>{const q=project(p,p.z||0);i?renderCtx.lineTo(q.x,q.y):renderCtx.moveTo(q.x,q.y);});
    renderCtx.strokeStyle=color;renderCtx.lineWidth=width;renderCtx.lineJoin='round';renderCtx.lineCap='round';renderCtx.stroke();
  }
  function offset(c,p,r=1,z=0){return {x:c.x+p.x*r,y:c.y+p.y*r,z};}
  function details(ref) {
    if(detailCache.has(ref))return detailCache.get(ref);
    const items=G.sceneryDetails(ref);
    if(detailCache.size>6000) detailCache.clear();detailCache.set(ref,items);return items;
  }
  function iconKey(name) { return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function resourceIcon(name) {
    const filename=window.TribeNetItemIconManifest?.[iconKey(name)];
    if(!filename || typeof Image==='undefined')return null;
    let image=resourceIconCache.get(filename);
    if(!image){image=new Image();image.src=`item-icons/${filename}`;image.decoding='async';image.onload=()=>{if(typeof scheduleMapDraw==='function')scheduleMapDraw();else if(typeof draw==='function')draw();};resourceIconCache.set(filename,image);}
    return image.complete&&image.naturalWidth>0?image:null;
  }
  function drawResourceIcons(t) {
    if(!t.known || !t.data?.resources?.length)return;
    const icons=t.data.resources.map(name=>({name,image:resourceIcon(name)})).filter(row=>row.image);
    if(!icons.length)return;
    const size=Math.max(15,Math.min(29,state.scale*.42));
    const spacing=size*.78, center=project({x:t.c.x,y:t.c.y-.42,z:sample(t.c.x,t.c.y).z+.28});
    icons.forEach((row,index)=>{
      const x=center.x+(index-(icons.length-1)/2)*spacing;
      renderCtx.save();
      renderCtx.fillStyle='rgba(8,17,23,.88)';renderCtx.strokeStyle='#e4bd62';renderCtx.lineWidth=Math.max(1,state.scale*.025);
      renderCtx.beginPath();renderCtx.arc(x,center.y,size*.48,0,Math.PI*2);renderCtx.fill();renderCtx.stroke();
      renderCtx.imageSmoothingEnabled=false;renderCtx.drawImage(row.image,x-size*.42,center.y-size*.42,size*.84,size*.84);
      if(labels&&state.scale>=60){renderCtx.font='700 9px Segoe UI';renderCtx.textAlign='center';renderCtx.textBaseline='top';renderCtx.fillStyle='#f0f2dc';renderCtx.strokeStyle='#17262b';renderCtx.lineWidth=3;renderCtx.strokeText(row.name,x,center.y+size*.55);renderCtx.fillText(row.name,x,center.y+size*.55);}
      renderCtx.restore();
    });
  }
  function adjacent(col,row) {return G.directions.map(d=>{const n=stepHex({globalCol:col,globalRow:row},d);return n?mapData(n.coordinate):null;});}
  function tile(col,row) {
    const ref=coordinateFor(col,row),data=mapData(ref),c=baseCenter(col,row),n=adjacent(col,row);
    return {ref,data,c,n,col,row,known:known(data),water:isWater(data?.terrain),p:project(c)};
  }
  // Cut mixed faces at the actual shoreline so narrow beaches do not turn
  // an entire coarse mesh triangle into land (or leave water sloping uphill).
  function shoreFaces(points) {
    if(points.every(p=>p.water) || points.every(p=>!p.water))return [points];
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
  // Keep one terrain topology at every zoom. Only shoreline-crossing
  // triangles receive additional *local* sampling, controlled separately by
  // Shore Detail, to resolve an irregular coast at three-owner corners.
  function refineShoreline(triangle,depth,out) {
    if(depth<=0){out.push(triangle);return;}
    const mid=(a,b)=>sample((a.x+b.x)/2,(a.y+b.y)/2);
    const [a,b,c]=triangle,ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    // Uniform refinement is essential for watertight neighbouring triangles.
    // Early-exiting a triangle with uniform water classification created
    // unmatched midpoint vertices (T-junctions) and black coastal cracks
    // between adjacent triangles along sloped shore walls.
    refineShoreline([a,ab,ca],depth-1,out);
    refineShoreline([ab,b,bc],depth-1,out);
    refineShoreline([ca,bc,c],depth-1,out);
    refineShoreline([ab,bc,ca],depth-1,out);
  }
  function groundFaces(t,_requestedSteps=null) {
    const steps=8;
    const coastal=t.known && t.n.some(n=>known(n) && (isWater(n.terrain)!==t.water));
    const detail=Number(window.TerrainSettings?.value('shoreDetail')??20);
    const microDepth=coastal?Math.max(0,Math.min(3,Math.ceil(Math.log2(detail/steps)))):0;
    const key=`${t.ref}:${steps}:${microDepth}`;
    if(groundCache.has(key))return groundCache.get(key);
    const faces=[];
    if(!t.known || (t.water&&t.n.every(n=>known(n)&&isWater(n.terrain)))){
      const point=sample(t.c.x,t.c.y);
      faces.push({points:G.corners.map(p=>offset(t.c,p,1,t.known?point.z:.14)),color:t.known?point.color:FOG});
      groundCache.set(key,faces);return faces;
    }
    const emitPart=part=>{
      const [a,b,c]=part,ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
      const light=Math.max(.78,Math.min(1.13,.94+(-nx*.35-ny*.28)/len));
      const mixed=G.mix(part.map(p=>p.color)),wet=part.every(p=>p.water);
      const steepness=Math.hypot(nx,ny)/(Math.abs(nz)+1e-8);
      const cliff=wet?0:Math.max(0,Math.min(1,(steepness-.48)/.68));
      const rockWeight=wet?0:part.reduce((n,p)=>n+(p.rock||0),0)/part.length;
      const exposure=window.TerrainSettings?.value('cliffExposure')??.85,stone=[120,120,108];
      const shade=wet?mixed:'#'+[1,3,5].map((i,k)=>{
        const base=parseInt(mixed.slice(i,i+2),16)*light;
        const amount=Math.min(.96,cliff*exposure*(.72+.28*rockWeight));
        return Math.max(0,Math.min(255,Math.round(base*(1-amount)+stone[k]*amount))).toString(16).padStart(2,'0');
      }).join('');
      faces.push({points:part,color:shade});
    };
    for(const face of G.regionMesh(steps)){
      const visible=G.regionOwners(t.col,t.row,face.kind,face.index).every(o=>known(surfaceData(o.col,o.row)));
      const points=face.points.map(p=>sample(t.c.x+p.x,t.c.y+p.y));
      if(!visible){faces.push({points,color:FOG});continue;}
      if(!microDepth){
        for(const part of shoreFaces(points))emitPart(part);
        continue;
      }
      // Splitting only near the land/water contour preserves the eight-step
      // inland terrain mesh while providing curved coastlines without costly
      // whole-hex high-LOD rebuilds.
      for(let k=1;k<points.length-1;k++){
        const triangles=[];
        refineShoreline([points[0],points[k],points[k+1]],microDepth,triangles);
        for(const triangle of triangles)for(const part of shoreFaces(triangle))emitPart(part);
      }
    }
    groundCache.set(key,faces);return faces;
  }

  function pick(x,y) {
    // The GPU raycaster reads the actual elevated world-space mesh.
    if(window.TribeNetGPU?.initialized && window.TribeNetGPU.visible){
      const hit=window.TribeNetGPU.pick(x,y);
      if(hit){const owner=G.regionAt(hit.x,hit.y);return {globalCol:owner.col,globalRow:owner.row};}
    }
    x=(x-hitOffset.x)/hitScale;y=(y-hitOffset.y)/hitScale;
    // Hit-test the elevated surface, rather than the flat plane underneath hills.
    for(let i=hitFaces.length-1;i>=0;i--){
      const f=hitFaces[i];let inside=false;
      for(let a=0,b=f.points.length-1;a<f.points.length;b=a++){
        const p=f.points[a],q=f.points[b];
        if((p.y>y)!==(q.y>y) && x<(q.x-p.x)*(y-p.y)/(q.y-p.y)+p.x)inside=!inside;
      }
      if(inside)return {globalCol:f.col,globalRow:f.row};
    }
    return null;
  }
  // Bevelled, irregular tiers suggest carved/voxel forms without exposed cubes.
  // All dimensions are world units; zoom changes detail, never the composition.
  function tier(p,size,levels,shade,variant=0) {
    const rings=levels.map(([radius,height])=>G.corners.map((v,i)=>{
      const r=radius*size*(1+.09*Math.sin(i*2.1+variant*6));
      return {...offset(p,v,r,(p.z??.14)+height*size),x:p.x+v.x*r+height*size*.08};
    }));
    const dark=G.mix([shade,'#293d38']),light=G.mix([shade,shade,'#d4d6a6']);
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<6;i++){
      const j=(i+1)%6;
      mesh([rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]],i<2?dark:i<4?shade:light);
    }
    mesh(rings[rings.length-1],light);
  }
  function tree(p,size,conifer,shade,variant=0) {
    const base=p.z??.14;
    line([{...p,z:base},{...p,z:base+.38*size}],'#68553e',Math.max(1.3,state.scale*.033*size));
    if(conifer){
      tier(p,size,[[.10,.17],[.23,.22],[.19,.30],[.075,.48]],shade,variant);
      tier(p,size,[[.16,.38],[.13,.45],[.025,.70]],shade,variant);
    } else {
      tier(p,size,[[.12,.25],[.26,.34],[.25,.48],[.16,.62],[.07,.65]],shade,variant);
      if(state.scale>=48)tier({...p,x:p.x-.11*size,y:p.y+.06*size},size,[[.11,.27],[.18,.36],[.14,.49],[.06,.53]],shade,variant+.3);
    }
  }
  function sceneryVisible(t,x,y) {
    return !sample(x,y).fog && !IsoUnits.occupies(t.ref,x-t.c.x,y-t.c.y) && G.sceneryVisible(x-t.c.x,y-t.c.y,t.n.map(known));
  }
  function scenery(t,jobs) {
    if(!t.known)return;
    const terrain=t.data.terrain,items=details(t.ref),{c}=t;
    const plant=(x,y,size,variant=0)=>{
      if(!sceneryVisible(t,x,y))return;
      const p=sample(x,y);if(!G.treeSite(terrain,p,sample))return;
      jobs.push({y:p.y,draw:()=>tree(p,size,terrain==='CH'||terrain==='LCM',(terrain.startsWith('J')||terrain==='LJM')?'#487c59':'#63834e',variant)});
    };
    if(t.water){
      if(state.scale>20)for(const a of items.slice(0,3)){
        const x=c.x+a.x,y=c.y+a.y;
        if(sample(x,y).water&&sample(x+.16,y).water)line([{x,y,z:.015},{x:x+.16,y,z:.015}],'#76b0be66',1);
      }
      return;
    }
    if(state.scale<22)return;
    if(G.isForest(terrain)) {
      for(const a of items.slice(0,terrain==='JG'?8:6))plant(c.x+a.x,c.y+a.y,a.size*.85,a.variant);
      // Populate the corridor right up to a matching neighbour. The opposite
      // bank fills its half, giving continuous canopy without duplicate trees.
      for(let i=0;i<6;i++)if(t.n[i]?.terrain===terrain){
        const a=G.corners[i],b=G.corners[(i+1)%6],rand=G.sceneryRandom(`${t.ref}:forest:${i}`);
        for(let k=0;k<3;k++){
          const u=.18+k*.29+(rand()-.5)*.10,r=.86+rand()*.12;
          plant(c.x+(a.x*(1-u)+b.x*u)*r,c.y+(a.y*(1-u)+b.y*u)*r,.65+rand()*.3);
        }
      }
    } else if(!G.isHill(terrain) && !/ALPS|HSM|L.M/.test(terrain)){
      for(const a of items.slice(0,5)){
        const p=sample(c.x+a.x,c.y+a.y);if(!sceneryVisible(t,p.x,p.y))continue;
        if(terrain==='SW')line([p,{...p,x:p.x+.22}],WATER,state.scale*.07);
        else if(terrain==='BR')jobs.push({y:p.y,draw:()=>tier(p,.35,[[.20,0],[.25,.12],[.13,.25]],'#7d9551',a.variant)});
        else line([p,{...p,x:p.x+.05,z:p.z+.06},{...p,x:p.x+.11}],terrain==='DE'?'#b69958':'#6d8b4a',1);
      }
    }
  }
  function edges(t) {
    if(!t.known)return;
    const local=G.rivers(t.data);
    for(let i=0;i<6;i++) {
      const a=G.corners[i],b=G.corners[(i+1)%6],neighbour=t.n[i];
      const edgePoint=(u,r=1)=>sample(t.c.x+(a.x*(1-u)+b.x*u)*r,t.c.y+(a.y*(1-u)+b.y*u)*r);
      if(known(neighbour) && (local.has(G.directions[i]) || G.rivers(neighbour).has(G.directions[(i+3)%6]))) {
        if(t.water||isWater(neighbour.terrain))continue;
        const points=Array.from({length:17},(_,k)=>edgePoint(k/16));
        let segment=[];
        const flush=()=>{if(segment.length>1){line(segment,'#7e9983',Math.max(3,state.scale*.12));line(segment,WATER,Math.max(2,state.scale*.075));line(segment,'#8bc5cc',Math.max(.7,state.scale*.016));}segment=[];};
        for(const p of points){if(p.fog)flush();else segment.push(p);}flush();
      }
    }
  }
  function invalidateTerrain(){
    preloadJob++;
    cellCache.clear();surfaceCache.clear();groundCache.clear();
    terrainRasterCache.clear();terrainRasterBytes=0;
    groundLayer=null;landscape=null;
    window.TribeNetGPU?.invalidate();
    scheduleKnownTerrainPreload();
  }
  // Startup/warm-view preloading is deliberately incremental. Build coarse
  // terrain for ALL discovered cells, but prioritize UI responsiveness.
  function scheduleKnownTerrainPreload(){
    const job=++preloadJob;
    if(window.TribeNetGPU && !window.TribeNetGPU.failed)return;
    if(typeof setTimeout!=='function' || !state.hexCache)return;
    const knownRefs=[...state.hexCache].filter(([ref,data])=>known(data)).map(([ref])=>ref);
    preloadCount=0;
    let index=0;
    // Use idle frames rather than a continuously rescheduled zero-delay
    // timer: the Mapper button and pan/zoom must always take priority.
    function scheduleNext(){
      if(job!==preloadJob || index>=knownRefs.length)return;
      if(typeof window!=='undefined' && typeof window.requestIdleCallback==='function')
        window.requestIdleCallback(batch,{timeout:250});
      else setTimeout(()=>batch(null),45);
    }
    function batch(idleDeadline){
      if(job!==preloadJob)return;
      const started=typeof performance!=='undefined'?performance.now():Date.now();
      let processed=0;
      while(index<knownRefs.length && processed<2 &&
        (typeof performance!=='undefined'?performance.now():Date.now())-started<6 &&
        (!idleDeadline || idleDeadline.timeRemaining()>3 || idleDeadline.didTimeout)){
        const parsed=typeof parseCoordinate==='function'?parseCoordinate(knownRefs[index]):null;
        if(parsed && Number.isFinite(parsed.globalCol) && Number.isFinite(parsed.globalRow)){
          const t=tile(parsed.globalCol,parsed.globalRow);
          groundFaces(t,4);preloadCount++;
        }
        index++;processed++;
      }
      scheduleNext();
    }
    scheduleNext();
  }
  function drawPhysicalRegions(tiles){
    if(!window.TerrainDevMode?.showRegions)return;
    for(const t of tiles){
      if(!t.known)continue;
      const outline=(points,stroke)=>{
        const projected=points.map(p=>project({x:p.x,y:p.y},sample(p.x,p.y).z+.015));
        polygon(projected,null,stroke);
      };
      outline(G.corners.map(c=>({x:t.c.x+c.x*G.coreRadius,y:t.c.y+c.y*G.coreRadius})),'#a9e4cf');
      for(let i=0;i<6;i++){
        const owners=G.regionOwners(t.col,t.row,'edge',i);
        const sorted=owners.slice().sort((a,b)=>a.col-b.col||a.row-b.row);
        if(sorted[0].col!==t.col||sorted[0].row!==t.row ||
           !owners.every(o=>known(surfaceData(o.col,o.row))))continue;
        const sq=G.sharedSquare(owners[0],owners[1]);
        if(sq)outline(sq.corners,'#56bee0');
      }
      for(let i=0;i<6;i++){
        const owners=G.regionOwners(t.col,t.row,'corner',i);
        const sorted=owners.slice().sort((a,b)=>a.col-b.col||a.row-b.row);
        if(sorted[0].col!==t.col||sorted[0].row!==t.row ||
           !owners.every(o=>known(surfaceData(o.col,o.row))))continue;
        const triangle=G.sharedTriangle(t.col,t.row,i);
        outline(triangle.corners,'#f6b76b');
      }
    }
  }
  function interact() {
    if(!enabled)return;
    interactive=true;clearTimeout(settleTimer);
    settleTimer=setTimeout(()=>{
      if(state.dragging){interact();return;}
      interactive=false;
      if(enabled && state.mode==='detail')draw();
    },150);
  }
  // The WebGL backend owns physical terrain, water, trees and miniatures.
  // Canvas 2D remains an interaction/labels/routes layer and is never painted
  // opaque in this path. Existing Orders and scouting drawing stay unchanged.
  function drawWebGLScene(){
    const gpu=window.TribeNetGPU;
    if(!gpu || gpu.failed)return false;
    const units=IsoUnits.prepare();
    if(units!==unitSignature)unitSignature=units;
    prepareSurface();
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return true;
    frameRect=rect;renderCtx=ctx;
    const b=bounds(),tiles=[],pad=Math.max(80,state.scale*1.4);
    for(let col=b.minCol;col<=b.maxCol;col++)for(let row=b.minRow;row<=b.maxRow;row++){
      const t=tile(col,row);
      if(t.p.x< -pad||t.p.x>rect.width+pad||t.p.y< -pad||t.p.y>rect.height+pad)continue;
      tiles.push(t);
    }
    const started=gpu.beginFrame(tiles,groundFaces,sample,state,()=>draw(),tile);
    if(!started){gpu.setVisible(false);frameRect=null;return false;}
    ctx.clearRect(0,0,rect.width,rect.height);
    hitFaces=[];hitScale=1;hitOffset={x:0,y:0};
    IsoUnits.beginFrame();
    const playbackState=typeof resultsPlayback!=='undefined'?resultsPlayback:null;
    for(const t of tiles){
      const selected=state.selected?.coordinate===t.ref && !state.selectedUnit;
      if(grid||selected){
        const outline=G.corners.map(p=>{const q=offset(t.c,p,.98);return project(q,sample(q.x,q.y).z);});
        if(grid)polygon(outline,null,'#324a4899');
        if(selected)polygon(outline,null,'#ffe093');
      }
      if(t.known)edges(t); // Rivers: overlay, no replacement game mechanics.
      if(labels && state.scale>=43){
        const p=project({...t.c,y:t.c.y+.5});
        renderCtx.font=String(Math.min(14,Math.max(10,state.scale*.09)))+'px Segoe UI';
        renderCtx.textAlign='center';renderCtx.lineWidth=3;
        renderCtx.strokeStyle='#20302bea';renderCtx.strokeText(t.ref,p.x,p.y);
        renderCtx.fillStyle='#f0f2dc';renderCtx.fillText(t.ref,p.x,p.y);
      }
      drawResourceIcons(t);
      const partial=playbackState?.active && (playbackState.revealedQuestions?.has(t.ref)||playbackState.partialPreviews?.has(t.ref));
      if(!t.known&&state.scale>=35&&!partial){
        renderCtx.fillStyle='#71838b';renderCtx.textAlign='center';renderCtx.font='12px Segoe UI';
        renderCtx.fillText('?',t.p.x,t.p.y);
      }
    }
    drawPhysicalRegions(tiles);
    if(state.planningVisible && state.planImport?.plan)drawPlanOverlay();
    if(typeof drawResultsPlaybackOverlay==='function')drawResultsPlaybackOverlay();
    updateCenterReadout();
    gpu.endFrame();
    frameRect=null;
    return true;
  }
  function drawScene() {
    if(enabled && window.TribeNetGPU && !window.TribeNetGPU.failed){
      try{if(drawWebGLScene())return;}
      catch(error){
        console.error('GPU mapper failed; restoring software terrain:',error);
        window.TribeNetGPU.failed=true;window.TribeNetGPU.setVisible(false);
      }
    }
    const units=IsoUnits.prepare();if(units!==unitSignature){unitSignature=units;landscape=null;}
    const playbackState=typeof resultsPlayback!=='undefined' ? resultsPlayback : null;
    // Playback reveals can change terrain while the pointer is moving. Do not
    // defer the cache check until the drag settles or the newly revealed tile
    // would remain fogged in the 3D buffer for the rest of that event.
    if(!interactive || !landscape || playbackState?.active)prepareSurface();const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    frameRect=rect;renderCtx=ctx;
    const b=bounds(),tiles=[],pad=Math.max(250,state.scale*1.7);
    for(let col=b.minCol;col<=b.maxCol;col++)for(let row=b.minRow;row<=b.maxRow;row++){
      const t=tile(col,row);if(t.p.x < -pad || t.p.x>rect.width+pad || t.p.y < -pad || t.p.y>rect.height+pad)continue;tiles.push(t);
    }
    const shift=landscape?G.project((landscape.cameraX-state.cameraX)*1.5,(landscape.cameraY-state.cameraY)*1.5):{x:0,y:0};
    let dx=shift.x*state.scale,dy=shift.y*state.scale;
    const needsBuild=!landscape || landscape.scale!==state.scale || landscape.width!==rect.width || landscape.height!==rect.height || landscape.dpr!==dpr || Math.abs(dx)>160 || Math.abs(dy)>160;
    if(needsBuild && (!interactive || !landscape)){
      sceneBuilds++;
      const buffer=document.createElement('canvas'),padding=210;
      buffer.width=Math.ceil((rect.width+padding*2)*dpr);buffer.height=Math.ceil((rect.height+padding*2)*dpr);
      renderCtx=buffer.getContext('2d');renderCtx.setTransform(dpr,0,0,dpr,0,0);
      frameRect={width:rect.width+padding*2,height:rect.height+padding*2};
      const groundKey=[state.cameraX,state.cameraY,state.scale,rect.width,rect.height,dpr].join(':');
      if(!groundLayer || groundLayer.key!==groundKey){
        groundBuilds++;
        const ground=document.createElement('canvas');ground.width=buffer.width;ground.height=buffer.height;
        renderCtx=ground.getContext('2d');renderCtx.setTransform(dpr,0,0,dpr,0,0);
        renderCtx.fillStyle=FOG;renderCtx.fillRect(0,0,frameRect.width,frameRect.height);hitFaces=[];
        // Cache each world hex independently of the camera. A pan only
        // composites existing rasters; newly visible hexes pay the mesh cost.
        const ordered=[...tiles].sort((a,b)=>a.c.y-b.c.y||a.c.x-b.c.x);
        for(const t of ordered){
          const key=`${t.ref}:${state.scale}:${dpr}`;
          let raster=terrainRasterCache.get(key);
          if(!raster){
            const faces=groundFaces(t).slice().sort((a,b)=>a.points.reduce((s,p)=>s+p.y,0)/a.points.length-b.points.reduce((s,p)=>s+p.y,0)/b.points.length).map(f=>({...f,points:f.points.map(p=>{
              const q=G.project((p.x-t.c.x)*1.5,(p.y-t.c.y)*1.5,p.z);
              return {x:q.x*state.scale,y:q.y*state.scale};
            })}));
            const all=faces.flatMap(f=>f.points),left=Math.floor(Math.min(...all.map(p=>p.x)))-2,top=Math.floor(Math.min(...all.map(p=>p.y)))-2;
            const width=Math.ceil(Math.max(...all.map(p=>p.x)))-left+2,height=Math.ceil(Math.max(...all.map(p=>p.y)))-top+2;
            const image=document.createElement('canvas');image.width=Math.ceil(width*dpr);image.height=Math.ceil(height*dpr);
            const previous=renderCtx;renderCtx=image.getContext('2d');renderCtx.setTransform(dpr,0,0,dpr,0,0);
            for(const f of faces)polygon(f.points.map(p=>({x:p.x-left,y:p.y-top})),f.color,f.color);
            renderCtx=previous;raster={image,left,top,width,height,faces};
            raster.bytes=image.width*image.height*4;terrainRasterBytes+=raster.bytes;
            terrainRasterCache.set(key,raster);
            // Bounded LRU, including scale variants.
            while(terrainRasterCache.size>1 && (terrainRasterCache.size>384||terrainRasterBytes>96*1024*1024)){
              const oldest=terrainRasterCache.keys().next().value;terrainRasterBytes-=terrainRasterCache.get(oldest).bytes;terrainRasterCache.delete(oldest);
            }
          }else{terrainRasterCache.delete(key);terrainRasterCache.set(key,raster);}
          const origin=project(t.c,0);
          renderCtx.drawImage(raster.image,origin.x+raster.left,origin.y+raster.top,raster.width,raster.height);
          for(const f of raster.faces)hitFaces.push({points:f.points.map(p=>({x:p.x+origin.x,y:p.y+origin.y})),col:t.col,row:t.row});
        }
        groundLayer={key:groundKey,canvas:ground,hits:hitFaces};
      }
      hitFaces=groundLayer.hits;renderCtx=buffer.getContext('2d');
      renderCtx.drawImage(groundLayer.canvas,0,0,frameRect.width,frameRect.height);
      const jobs=[];
      // Fog is ground cover. Visible trees and mountains are drawn above it.
      for(const t of tiles){edges(t);scenery(t,jobs);}
      jobs.sort((a,b)=>a.y-b.y);for(const job of jobs)job.draw();
      landscape={canvas:buffer,cameraX:state.cameraX,cameraY:state.cameraY,scale:state.scale,width:rect.width,height:rect.height,dpr,padding};
      dx=0;dy=0;
    }
    frameRect=rect;renderCtx=ctx;hitScale=state.scale/landscape.scale;
    hitOffset={x:rect.width/2+dx-(landscape.width/2+landscape.padding)*hitScale,y:rect.height/2+dy-(landscape.height/2+landscape.padding)*hitScale};
    renderCtx.fillStyle=FOG;renderCtx.fillRect(0,0,rect.width,rect.height);
    renderCtx.drawImage(landscape.canvas,hitOffset.x,hitOffset.y,landscape.canvas.width/landscape.dpr*hitScale,landscape.canvas.height/landscape.dpr*hitScale);
    IsoUnits.beginFrame();
    for(const t of tiles){
      const selectedHex=state.selected?.coordinate===t.ref && !state.selectedUnit;
      if(grid || selectedHex){
        const outline=G.corners.map(p=>{const q=offset(t.c,p,.98);return project(q,sample(q.x,q.y).z);});
        if(grid)polygon(outline,null,'#324a4855');
        if(selectedHex)polygon(outline,null,'#ffe093');
      }
      if(labels && state.scale>=43){const p=project({...t.c,y:t.c.y+.5});renderCtx.font=`${Math.min(14,Math.max(10,state.scale*.09))}px Segoe UI`;renderCtx.textAlign='center';renderCtx.lineWidth=3;renderCtx.strokeStyle='#20302bea';renderCtx.strokeText(t.ref,p.x,p.y);renderCtx.fillStyle='#f0f2dc';renderCtx.fillText(t.ref,p.x,p.y);}
      drawResourceIcons(t);
      const partialQuestion=playbackState?.active && (playbackState.revealedQuestions?.has(t.ref) || playbackState.partialPreviews?.has(t.ref));
      if(!t.known && state.scale>=35 && !partialQuestion){renderCtx.fillStyle='#71838b';renderCtx.textAlign='center';renderCtx.font='12px Segoe UI';renderCtx.fillText('?',t.p.x,t.p.y);}
    }
    drawPhysicalRegions(tiles);
    if(state.planningVisible && state.planImport?.plan)drawPlanOverlay();
    if(typeof drawResultsPlaybackOverlay==='function')drawResultsPlaybackOverlay();
    updateCenterReadout();frameRect=null;
  }
  function setEnabled(value, options = {}) {
    enabled=value;window.TribeNetGPU?.setVisible(value && window.TribeNetGPU.initialized && !window.TribeNetGPU.failed);IsoUnits.resetSelection();interactive=false;clearTimeout(settleTimer);if(!value)state.scale=Math.min(68,state.scale);document.body.classList.toggle('isometric-mode',value);
    $('isoViewControls').classList.toggle('hidden',!value);
    $('openMapperButton').querySelector('h2').textContent='Mapper';
    if(value && state.scale<43)state.scale=52;
    if(value)scheduleKnownTerrainPreload();
    const toggle=$('mapperViewToggle');if(toggle)toggle.checked=Boolean(value);
    // Rendering mode changes never navigate to the mapper themselves. The
    // launcher has exactly one owner for navigation (renderer.showMapper).
    if (state.mode==='detail' && !$('mapperView').classList.contains('hidden')) {
      resizeCanvas();
      requestVisibleData();
      draw();
    }
  }
  function setup() {
    $('isoLabels').addEventListener('change',e=>{labels=e.target.checked;draw();});
    $('isoGrid').addEventListener('change',e=>{grid=e.target.checked;draw();});
    const field=document.createElement('fieldset');field.id='riverEdgeEditor';field.className='river-edge-editor';
    const legend=document.createElement('legend');legend.textContent='River edges';field.appendChild(legend);
    for(const d of ['N','NE','SE','S','SW','NW']){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=d;input.addEventListener('change',()=>{$('notesInput').value=G.riverNotes($('notesInput').value,Array.from(field.querySelectorAll('input:checked')).map(e=>e.value));});label.append(input,document.createTextNode(d));field.appendChild(label);}
    const help=document.createElement('small');help.textContent='Directions use map north. Save Hex to keep changes. A river set on either bank is shown on their shared edge.';field.appendChild(help);$('notesInput').after(field);
    const sync=()=>{const values=G.rivers({notes:$('notesInput').value});field.querySelectorAll('input').forEach(input=>{input.checked=values.has(input.value);input.disabled=$('notesInput').disabled;});};
    const previousSelect=selectHex;selectHex=async function(...args){const result=await previousSelect(...args);sync();return result;};
    $('notesInput').addEventListener('input',sync);
    new MutationObserver(sync).observe($('notesInput'),{attributes:true,attributeFilter:['disabled']});
    new MutationObserver(sync).observe($('selectedState'),{childList:true});
  }
  return {get enabled(){return enabled;},get interacting(){return interactive||Boolean(state.dragging);},get renderer(){return window.TribeNetGPU?.initialized&&window.TribeNetGPU?.visible?'WebGL':'Canvas2D';},get gpuStats(){return window.TribeNetGPU?.getStats();},get preloadCount(){return preloadCount;},queueGpuModel:m=>window.TribeNetGPU?.addModel(m),preloadKnown:()=>{prepareSurface();scheduleKnownTerrainPreload();},invalidateTerrain,surface:sample,withProjection,project,inverse,bounds,pick,interact,get sceneBuilds(){return sceneBuilds;},get groundBuilds(){return groundBuilds;},draw:drawScene,setEnabled,setup};
})();
IsoMapper.setup();

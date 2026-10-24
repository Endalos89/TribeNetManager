/* GPU terrain renderer for TribeNet's existing deterministic world-space map.
 * Terrain, water, forests and unit miniatures are WebGL. The regular map
 * canvas remains a transparent interaction/label/planning overlay.
 * This file is bundled locally with Three.js; no CDN or remote assets.
 */
import * as THREE from 'three';

// Smaller chunks cap synchronous CPU work when zoomed in; GPU instancing
// still batches trees and units across each chunk.
const CHUNK_SIZE=2;
// Keep enough GPU chunks for the current submap and nearby regions; geometry
// is still bounded by LRU. Nine whole submaps of GPU meshes would be excessive.
const MAX_CHUNKS=520;
// Two 2x2-chunk rings cover the same neighbourhood as one former 4x4 ring.
const PREFETCH_RING=2;
// Generate only a modest offscreen margin. The 3x3 SUBMAP DATA window is
// separate and must never imply eagerly building all of its GPU geometry.
const MAX_OFFSCREEN_PREFETCH=96;
const FIXED_TERRAIN_STEPS=8;
const UNIT_MODEL_SCALE=.5;
// Only change this identifier when geometry generation rules change, not
// when the app release number increments. Known terrain/settings have separate keys.
const MESH_GENERATOR_REVISION='terrain-fixed8-shore-20261024-r1';
const baseTreeTrunk=new THREE.CylinderGeometry(.012,.017,.20,5);
const baseTreeCrown=new THREE.ConeGeometry(.095,.24,6);
const unitBox=new THREE.BoxGeometry(.12,.12,.085);
const unitHead=new THREE.IcosahedronGeometry(.045,0);
const personLeg=new THREE.BoxGeometry(.026,.085,.028);
const horseLeg=new THREE.BoxGeometry(.028,.105,.035);
const cartWheel=new THREE.CylinderGeometry(.050,.050,.03,8);
const horseBox=new THREE.BoxGeometry(.21,.105,.09);
const cartBox=new THREE.BoxGeometry(.25,.095,.17);
const WATER=0x337f98;
const position=p=>[p.x*1.5,p.z||0,p.y*1.5];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const chunkId=t=>Math.floor(t.col/CHUNK_SIZE)+':'+Math.floor(t.row/CHUNK_SIZE);
const treeKind=t=>['D','DH','CH','JG','JH','LCM','LJM'].includes(t);
const seededRandom=(key)=>window.IsoGeometry.sceneryRandom(key);
const terrainSetting=(key,otherwise)=>window.TerrainSettings?.value(key)??otherwise;

class GPUMap {
  constructor(){
    this.renderer=null;this.canvas=null;this.scene=null;this.camera=null;
    this.chunkGroup=null;this.modelGroup=null;this.chunkCache=new Map();
    this.units=[];this.visible=false;this.failed=false;this.initialized=false;
    this.generation=0;this.pendingChunks=[];this.idleBuildPending=false;this.activeChunkIds=new Set();this.visibleChunkIds=new Set();
    this.knowledgeSubmapWindow=new Set();this.lastCentreSubmap=null;
    this.groundFaces=null;this.sampleTerrain=null;this.tileAt=null;this.lastLod=FIXED_TERRAIN_STEPS;
    this.diskMissKeys=new Set();this.diskReadBusy=false;this.cachedWrites=new Set();
    this.diskStats={diskHits:0,diskMisses:0,diskWrites:0,diskErrors:0};
    this.groundHeightCache=new Map();this.meshRevision=0;
    this.downRay=new THREE.Raycaster();this.downDirection=new THREE.Vector3(0,-1,0);
    this.requestDraw=null;this.pendingFrame=false;this.stats={chunks:0,faces:0,trees:0,builds:0,gpuCalls:0,renderMs:0,evictions:0,prefetchTarget:0};
    this.meshMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,depthWrite:true});
    this.waveMaterial=new THREE.LineBasicMaterial({color:0xc8e9d9,transparent:true,opacity:.58,depthWrite:false});
    this.treeMaterials={
      trunk:new THREE.MeshLambertMaterial({color:0x70523a,side:THREE.DoubleSide}),
      broad:new THREE.MeshLambertMaterial({color:0x668851,side:THREE.DoubleSide}),
      conifer:new THREE.MeshLambertMaterial({color:0x477b58,side:THREE.DoubleSide}),
      body:new THREE.MeshLambertMaterial({color:0xffffff}),
      head:new THREE.MeshLambertMaterial({color:0xffffff}),
      leg:new THREE.MeshLambertMaterial({color:0xffffff}),
      horseLeg:new THREE.MeshLambertMaterial({color:0xffffff}),
      wheel:new THREE.MeshLambertMaterial({color:0xffffff}),
      horse:new THREE.MeshLambertMaterial({color:0xffffff}),
      cart:new THREE.MeshLambertMaterial({color:0xffffff})
    };
    this.unitMeshes=new Map();
    this.matrix=new THREE.Matrix4();
    this.object=new THREE.Object3D();
    this.color=new THREE.Color();
  }
  init(){
    if(this.initialized)return true;
    if(this.failed)return false;
    try{
      const wrap=document.getElementById('canvasWrap');
      if(!wrap)throw Error('Mapper canvas parent is not available');
      this.renderer=new THREE.WebGLRenderer({
        alpha:false,antialias:false,powerPreference:'high-performance',
        preserveDrawingBuffer:true
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      this.renderer.setClearColor(0x253640,1);
      this.renderer.sortObjects=false;
      this.canvas=this.renderer.domElement;
      this.canvas.id='terrainWebGL';
      this.canvas.className='terrain-webgl';
      this.canvas.setAttribute('aria-hidden','true');
      wrap.insertBefore(this.canvas,wrap.firstChild);
      this.scene=new THREE.Scene();
      this.scene.background=new THREE.Color(0x253640);
      this.chunkGroup=new THREE.Group();this.modelGroup=new THREE.Group();
      this.scene.add(this.chunkGroup);this.scene.add(this.modelGroup);
      this.scene.add(new THREE.HemisphereLight(0xe3f3eb,0x6f7967,2.0));
      const directional=new THREE.DirectionalLight(0xffefd0,1.15);
      directional.position.set(-9,16,-13);this.scene.add(directional);
      this.camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,12000);
      this.camera.up.set(0,1,0);
      this.initialized=true;
      this.setVisible(this.visible);
      this.canvas.addEventListener('webglcontextlost',event=>{
        event.preventDefault();this.failed=true;this.initialized=false;
        console.error('Mapper GPU context lost; switching to software terrain');
        this.setVisible(false);
        if(typeof window.draw==='function')window.draw();
      },false);
      return true;
    }catch(error){
      this.failed=true;console.error('Three.js terrain renderer unavailable; using Canvas fallback:',error);
      this.canvas?.remove();this.canvas=null;this.renderer=null;
      return false;
    }
  }
  setVisible(visible){
    const returning=!this.visible && Boolean(visible);
    this.visible=Boolean(visible);
    if(this.canvas)this.canvas.style.display=this.visible?'block':'none';
    document.body.classList.toggle('terrain-webgl-active',this.visible && this.initialized);
    // Resume an interrupted preload when returning from Launcher/classic mode.
    if(returning && this.pendingChunks.length)this.scheduleIdleChunk();
  }
  invalidate(){
    for(const record of this.chunkCache.values())this.disposeChunk(record);
    this.chunkCache.clear();
    this.stats.chunks=0;this.stats.faces=0;this.stats.trees=0;
    this.generation++;this.pendingChunks=[];this.queueSignature=null;
    // The persistent cache is content-addressed; changing a preset changes
    // keys rather than deleting historical meshes from disk.
    this.diskMissKeys.clear();
    this.groundHeightCache.clear();
  }
  disposeChunk(record){
    this.chunkGroup?.remove(record.group);
    this.stats.evictions++;
    record.ground.geometry.dispose();
    record.waves?.geometry.dispose();
    // Free per-instance GPU buffers on LRU eviction; tree geometries and
    // materials are shared and intentionally retained.
    for(const child of record.group.children)if(child.isInstancedMesh)child.dispose();
  }
  dispose(){
    this.invalidate();
    for(const mesh of this.unitMeshes.values()){
      this.modelGroup.remove(mesh);
      mesh.dispose();
    }
    this.unitMeshes.clear();
    this.renderer?.dispose();this.renderer?.forceContextLoss();
    this.canvas?.remove();this.renderer=null;this.initialized=false;
  }
  lod(_scale){
    // Terrain resolution is independent of camera zoom. Camera changes never
    // generate a second mesh variant for a previously loaded world chunk.
    return FIXED_TERRAIN_STEPS;
  }
  size(width,height,scale,cameraX,cameraY){
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
    // WebGLRenderer.setSize reallocates the drawing buffer. Never do that
    // on camera pans or unit animations when CSS dimensions are unchanged.
    if(this.viewportW!==w || this.viewportH!==h){
      this.renderer.setSize(w,h,false);
      this.viewportW=w;this.viewportH=h;
    }
    this.camera.left=-w/(2*scale);
    this.camera.right=w/(2*scale);
    this.camera.top=h/(2*scale);
    this.camera.bottom=-h/(2*scale);
    this.camera.updateProjectionMatrix();
    const D=1200,x=cameraX*1.5,z=cameraY*1.5;
    // Must match IsoGeometry.project: screenY=.62*y - .78*elevation.
    this.camera.position.set(x,.62*D,z+.78*D);
    this.camera.lookAt(x,0,z);
    this.camera.updateMatrixWorld();
  }
  newChunk(tiles,groundFaces,sample,steps){
    const group=new THREE.Group();
    const coords=[],colors=[];
    const add=(p,c)=>{
      coords.push(p.x*1.5,p.z||0,p.y*1.5);
      colors.push(c.r,c.g,c.b);
    };
    let facesCount=0;
    for(const t of tiles){
      const faces=groundFaces(t,steps);
      for(const f of faces){
        if(f.points.length<3)continue;
        const c=this.color.set(f.color).clone();
        const marine=f.points.every(p=>p.water) ||
          (t.water && t.n.every(n=>n && (n.terrain==='O'||n.terrain==='L')));
        const vertex=(p)=>{
          if(marine) {
            const sampled=sample(p.x,p.y);
            add(p,sampled.water && !sampled.fog?this.color.set(sampled.color):c);
          } else add(p,c);
        };
        for(let k=1;k<f.points.length-1;k++){
          vertex(f.points[0]);vertex(f.points[k]);vertex(f.points[k+1]);
          facesCount++;
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();
    const ground=new THREE.Mesh(geometry,this.meshMaterial);
    ground.frustumCulled=false;
    group.add(ground);
    let count=0;
    const sites=[];
    const density=clamp(terrainSetting('treeDensity',2.5),.5,5);
    const scale=clamp(terrainSetting('treeSize',.55),.2,1.5);
    for(const t of tiles){
      if(!t.known||!treeKind(t.data?.terrain))continue;
      const rnd=seededRandom(t.ref+':gpu-forest');
      // World-aligned jittered candidates, no re-randomisation from camera.
      const amount=Math.round(9*density*(t.data.terrain==='JG'?1.2:1));
      for(let i=0;i<amount;i++){
        const angle=rnd()*Math.PI*2,rad=.84*Math.sqrt(rnd());
        const x=t.c.x+Math.cos(angle)*rad,y=t.c.y+Math.sin(angle)*rad;
        const p=sample(x,y);
        if(!p || p.fog || p.water || p.rock>.64)continue;
        // Trees are part of permanent world geometry, never dependent on
        // where movable units happen to stand in the current turn.
        const h=scale*(.75+rnd()*.55);
        sites.push({x,y,z:p.z,size:h,conifer:t.data.terrain==='CH'||t.data.terrain==='LCM'});
      }
    }
    count=sites.length;
    // Seeded, short pale wave crests are most frequent near a coastline.
    // One LineSegments draw per chunk, no continuous simulation/redraw.
    const strength=clamp(terrainSetting('waveStrength',.55),0,1);
    const wavePoints=[];
    if(strength>0)for(const t of tiles){
      if(!t.known)continue;
      const random=seededRandom(t.ref+':static-wave-ripples');
      const attempts=Math.round((t.water?16:10)*strength);
      for(let i=0;i<attempts;i++){
        const angle=random()*Math.PI*2,radius=.95*Math.sqrt(random());
        const x=t.c.x+Math.cos(angle)*radius,y=t.c.y+Math.sin(angle)*radius;
        const p=sample(x,y);
        if(!p?.water || p.fog)continue;
        const neighbour=[[.14,0],[-.14,0],[0,.14],[0,-.14]]
          .map(([dx,dy])=>sample(x+dx,y+dy));
        const nearCoast=neighbour.some(n=>!n.water&&!n.fog);
        if(!nearCoast && random()>.26)continue;
        const span=nearCoast ? .12+random()*.14 : .05+random()*.07;
        const direction=random()*Math.PI*2,ax=Math.cos(direction)*span/2,ay=Math.sin(direction)*span/2;
        const left=sample(x-ax,y-ay),right=sample(x+ax,y+ay);
        if(!left?.water||!right?.water)continue;
        const height=p.z+.007;
        wavePoints.push((x-ax)*1.5,height,(y-ay)*1.5,(x+ax)*1.5,height,(y+ay)*1.5);
      }
    }
    let waves=null;
    if(wavePoints.length){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(wavePoints,3));
      waves=new THREE.LineSegments(geometry,this.waveMaterial);
      waves.frustumCulled=false;waves.renderOrder=2;group.add(waves);
    }
    const addTreeInstances=(type,geometry,material,filtered,height,radius)=>{
      const n=filtered.length;
      if(!n)return;
      const inst=new THREE.InstancedMesh(geometry,material,n);
      inst.frustumCulled=false;
      for(let i=0;i<n;i++){
        const tree=filtered[i];
        this.object.position.set(tree.x*1.5,tree.z+height*tree.size,tree.y*1.5);
        this.object.rotation.set(0,0,0);
        this.object.scale.set(tree.size*radius,tree.size,tree.size*radius);
        this.object.updateMatrix();
        inst.setMatrixAt(i,this.object.matrix);
      }
      inst.instanceMatrix.needsUpdate=true;
      group.add(inst);
    };
    addTreeInstances('trunk',baseTreeTrunk,this.treeMaterials.trunk,sites,.10,1);
    addTreeInstances('broad',baseTreeCrown,this.treeMaterials.broad,sites.filter(s=>!s.conifer),.32,1.45);
    addTreeInstances('conifer',baseTreeCrown,this.treeMaterials.conifer,sites.filter(s=>s.conifer),.32,1.15);
    return {group,ground,waves,faces:facesCount,trees:count};
  }
  requestLater(){
    if(this.pendingFrame)return;
    this.pendingFrame=true;
    requestAnimationFrame(()=>{
      this.pendingFrame=false;
      if(this.visible && typeof IsoMapper!=='undefined' && IsoMapper.enabled && typeof draw==='function')draw();
    });
  }
  chunkKey(id,lod){return id+':'+lod;}
  // Retain a previous mesh at another zoom level until its replacement is
  // uploaded: a change in zoom must never hide an entire terrain chunk.
  bestResident(id,lod){
    const exact=this.chunkCache.get(this.chunkKey(id,lod));
    if(exact)return exact;
    let best=null,bestDistance=Infinity;
    for(const item of this.chunkCache.values()){
      if(item.id!==id)continue;
      const distance=Math.abs(Math.log2(item.lod/lod));
      if(distance<bestDistance){best=item;bestDistance=distance;}
    }
    return best;
  }
  // For historical playback this fingerprint uses the currently-visible
  // (turn-filtered) terrain state, not the union of all future discoveries.
  // The two-hex halo covers the owners of edge squares and corner triangles.
  persistentKey(id,lod){
    if(!this.tileAt)return null;
    const [cx,cy]=id.split(':').map(Number),terrain=[];
    for(let col=cx*CHUNK_SIZE-2;col<(cx+1)*CHUNK_SIZE+2;col++){
      for(let row=cy*CHUNK_SIZE-2;row<(cy+1)*CHUNK_SIZE+2;row++){
        if(col<0||row<0||col>=TOTAL_COLS||row>=TOTAL_ROWS)continue;
        const cell=this.tileAt(col,row);
        terrain.push([col,row,cell.known ? cell.data?.terrain||'?' : '?']);
      }
    }
    const settings=window.TerrainSettings?.get?.()||{};
    const stableSettings=Object.keys(settings).sort().map(k=>[k,settings[k]]);
    return JSON.stringify([MESH_GENERATOR_REVISION,
      window.TerrainSettings?.WORLD_SEED||1790425012,id,lod,stableSettings,terrain]);
  }
  serializeChunk(record){
    const geometry=record.ground.geometry;
    const instances=[];
    for(const child of record.group.children){
      if(!child.isInstancedMesh)continue;
      const type=child.material===this.treeMaterials.trunk?'trunk':
        child.material===this.treeMaterials.broad?'broad':
        child.material===this.treeMaterials.conifer?'conifer':null;
      if(type)instances.push({
        type,matrices:Array.from(child.instanceMatrix.array.slice(0,child.count*16))
      });
    }
    return {format:1,faces:record.faces,trees:record.trees,
      positions:Array.from(geometry.getAttribute('position').array),
      colors:Array.from(geometry.getAttribute('color').array),
      waves:record.waves?Array.from(record.waves.geometry.getAttribute('position').array):null,
      instances};
  }
  restoreChunk(id,lod,data){
    if(!data||data.format!==1||!Array.isArray(data.positions)||
      !Array.isArray(data.colors)||data.positions.length!==data.colors.length||
      data.positions.length<9||data.positions.length%3)throw Error('Invalid cached ground vertices');
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
    geometry.computeBoundingSphere();
    const group=new THREE.Group(),ground=new THREE.Mesh(geometry,this.meshMaterial);
    ground.frustumCulled=false;group.add(ground);
    let waves=null;
    if(data.waves?.length){
      const waveGeometry=new THREE.BufferGeometry();
      waveGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.waves,3));
      waves=new THREE.LineSegments(waveGeometry,this.waveMaterial);
      waves.frustumCulled=false;waves.renderOrder=2;group.add(waves);
    }
    const shared={
      trunk:[baseTreeTrunk,this.treeMaterials.trunk],
      broad:[baseTreeCrown,this.treeMaterials.broad],
      conifer:[baseTreeCrown,this.treeMaterials.conifer]
    };
    for(const item of data.instances||[]){
      const descriptor=shared[item.type];
      if(!descriptor||!Array.isArray(item.matrices)||item.matrices.length%16!==0)
        throw Error('Invalid cached forest instances');
      const count=item.matrices.length/16;
      if(!count)continue;
      const inst=new THREE.InstancedMesh(descriptor[0],descriptor[1],count);
      inst.instanceMatrix.array.set(item.matrices);
      inst.instanceMatrix.needsUpdate=true;
      inst.frustumCulled=false;group.add(inst);
    }
    const record={id,lod,key:this.chunkKey(id,lod),group,ground,waves,
      faces:data.faces,trees:data.trees,serial:++this.meshRevision};
    this.chunkCache.set(record.key,record);this.chunkGroup.add(group);
    return record;
  }
  saveToDisk(record){
    const api=window.tribenet?.saveTerrainMesh;
    if(typeof api!=='function')return;
    const key=this.persistentKey(record.id,record.lod);
    if(!key||this.cachedWrites.has(key))return;
    this.cachedWrites.add(key);
    // File compression and writing happen in Electron's main process.
    const job=()=>{
      let payload;
      try{payload=this.serializeChunk(record);}
      catch(error){this.diskStats.diskErrors++;this.cachedWrites.delete(key);return;}
      Promise.resolve().then(()=>api(key,payload)).then(()=>{
        this.diskStats.diskWrites++;
      }).catch(error=>{
        this.diskStats.diskErrors++;
        console.warn('Terrain cache write unavailable:',error);
      }).finally(()=>this.cachedWrites.delete(key));
    };
    if(typeof requestIdleCallback==='function')
      requestIdleCallback(job,{timeout:500});
    else setTimeout(job,40);
  }
  terrainChunk(id,lod){
    const [cx,cy]=id.split(':').map(Number),cells=[];
    for(let col=cx*CHUNK_SIZE;col<(cx+1)*CHUNK_SIZE;col++)
      for(let row=cy*CHUNK_SIZE;row<(cy+1)*CHUNK_SIZE;row++)
        if(col>=0&&row>=0&&col<TOTAL_COLS&&row<TOTAL_ROWS)cells.push(this.tileAt(col,row));
    const result=this.newChunk(cells,this.groundFaces,this.sampleTerrain,lod);
    const record={...result,key:this.chunkKey(id,lod),id,lod};
    this.chunkCache.set(record.key,record);this.chunkGroup.add(record.group);
    record.serial=++this.meshRevision;
    this.stats.builds++;
    this.saveToDisk(record);
    return record;
  }
  // Submap knowledge is cached separately by renderer.js. Prewarm GPU
  // geometry nearest the camera and inside the current/adjacent 3x3 submaps
  // without allocating the entire nine-submap world upfront.
  retentionWindow(){
    const col=Math.max(0,Math.min(TOTAL_COLS-1,Math.round((this.cameraCenterX-1)/1.5)));
    const row=Math.max(0,Math.min(TOTAL_ROWS-1,
      Math.round(this.cameraCenterY/Math.sqrt(3)-.5-(col%2?.5:0))));
    const homeC=Math.floor(col/HEX_COLS),homeR=Math.floor(row/HEX_ROWS);
    const windowKeys=new Set();
    for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){
      const c=homeC+dc,r=homeR+dr;
      if(c>=0&&r>=0&&c*HEX_COLS<TOTAL_COLS&&r*HEX_ROWS<TOTAL_ROWS)
        windowKeys.add(c+':'+r);
    }
    this.knowledgeSubmapWindow=windowKeys;
    const anchor=homeC+':'+homeR;
    if(anchor!==this.lastCentreSubmap){
      this.lastCentreSubmap=anchor;
      this.dropDistantSubmaps();
    }
  }
  submapOfChunk(id){
    const [cx,cy]=id.split(':').map(Number);
    return Math.floor(cx*CHUNK_SIZE/HEX_COLS)+':'+Math.floor(cy*CHUNK_SIZE/HEX_ROWS);
  }
  chunkTouchesRetention(id){
    // A 2x2 chunk can straddle a 21-row submap boundary. Keep it when
    // EITHER adjacent submap is retained, rather than evicting visible land.
    const [cx,cy]=id.split(':').map(Number);
    for(let c=cx*CHUNK_SIZE;c<(cx+1)*CHUNK_SIZE;c++)
      for(let r=cy*CHUNK_SIZE;r<(cy+1)*CHUNK_SIZE;r++)
        if(this.knowledgeSubmapWindow.has(Math.floor(c/HEX_COLS)+':'+Math.floor(r/HEX_ROWS)))
          return true;
    return false;
  }
  dropDistantSubmaps(){
    // Crossing a 30x21 submap boundary can happen during wheel-zoom because
    // cursor-anchored zoom changes cameraX/Y. That is NOT a reason to destroy
    // previously uploaded GPU geometry. Keep all resident meshes while under
    // MAX_CHUNKS; evictUnused() handles actual memory pressure using LRU.
    // Only abandon speculative tasks for remote regions, never visible work.
    this.pendingChunks=this.pendingChunks.filter(t=>
      this.chunkTouchesRetention(t.id)||this.visibleChunkIds.has(t.id));
    this.queueSignature=null;
  }
  invalidateHexes(hexes){
    if(!hexes?.length)return;
    const ids=new Set(hexes.map(p=>Math.floor(p.col/CHUNK_SIZE)+':'+Math.floor(p.row/CHUNK_SIZE)));
    for(const [key,record] of this.chunkCache)if(ids.has(record.id)){
      this.disposeChunk(record);this.chunkCache.delete(key);
    }
    this.pendingChunks=this.pendingChunks.filter(t=>!ids.has(t.id));
    // Re-schedule only the changed chunks next time; all other buffers survive.
    this.queueSignature=null;
  }
  queueBuilds(visible,lod){
    const ring=new Set();
    for(const id of visible){
      const [cx,cy]=id.split(':').map(Number);
      for(let x=-PREFETCH_RING;x<=PREFETCH_RING;x++)for(let y=-PREFETCH_RING;y<=PREFETCH_RING;y++){
        const a=cx+x,b=cy+y;
        if(a>=0&&b>=0&&a*CHUNK_SIZE<TOTAL_COLS&&b*CHUNK_SIZE<TOTAL_ROWS)
          ring.add(a+':'+b);
      }
    }
    const distance=id=>{
      const [cx,cy]=id.split(':').map(Number);
      const worldX=1+1.5*(cx*CHUNK_SIZE+(CHUNK_SIZE-1)/2);
      const worldY=Math.sqrt(3)*(cy*CHUNK_SIZE+(CHUNK_SIZE-1)/2);
      return (worldX-this.cameraCenterX)**2+(worldY-this.cameraCenterY)**2;
    };
    // The visible viewport is the only mandatory geometry. Prefetch at most
    // 96 additional 2x2 chunks in its immediate two-chunk ring, not the whole
    // 3x3 submap DATA cache (~1,400 meshes). Otherwise the 520-entry GPU LRU
    // evicts meshes while background work is still filling distant submaps.
    const priority=[...visible].sort((a,b)=>distance(a)-distance(b));
    const prefetch=[...ring].filter(id=>!visible.has(id))
      .sort((a,b)=>distance(a)-distance(b));
    const offscreenLimit=Math.max(0,Math.min(MAX_OFFSCREEN_PREFETCH,
      MAX_CHUNKS-priority.length));
    const ordered=[...priority,...prefetch.slice(0,offscreenLimit)];
    // Not all ring chunks are necessarily retained when zoomed far out.
    this.activeChunkIds=new Set(ordered);
    this.stats.prefetchTarget=Math.min(prefetch.length,offscreenLimit);
    // Preserve unfinished work when zoom/camera changes; change its priority,
    // never throw it all away and restart it from the beginning.
    const existing=new Set(this.pendingChunks.map(t=>t.id));
    for(const id of ordered){
      if(!this.chunkTouchesRetention(id))continue;
      const key=this.chunkKey(id,FIXED_TERRAIN_STEPS);
      if(!this.chunkCache.has(key) && !existing.has(id)){
        this.pendingChunks.push({id,lod:FIXED_TERRAIN_STEPS});
        existing.add(id);
      }
    }
    const rank=new Map(),unique=[];
    for(const id of ordered)if(!rank.has(id))rank.set(id,rank.size);
    for(const job of this.pendingChunks)
      if(rank.has(job.id) && !this.chunkCache.has(this.chunkKey(job.id,job.lod)))unique.push(job);
    unique.sort((a,b)=>rank.get(a.id)-rank.get(b.id));
    this.pendingChunks=unique.slice(0,Math.max(MAX_CHUNKS,priority.length));
    this.scheduleIdleChunk();
  }
  scheduleIdleChunk(){
    // During wheel/drag gestures, rendering already-resident geometry takes
    // priority. No disk read, mesh construction or disposal should contend
    // with the user's camera interaction. The settled redraw resumes work.
    if(typeof IsoMapper!=='undefined'&&IsoMapper.interacting)return;
    if(this.idleBuildPending || this.diskReadBusy || !this.pendingChunks.length || !this.visible)return;
    const revision=this.generation;
    this.idleBuildPending=true;
    const task=(deadline)=>{
      this.idleBuildPending=false;
      if(revision!==this.generation){
        this.scheduleIdleChunk();return;
      }
      if(!this.visible||!this.pendingChunks.length)return;
      if(typeof IsoMapper!=='undefined'&&IsoMapper.interacting)return;
      if(deadline && deadline.timeRemaining()<3 && !deadline.didTimeout){
        this.scheduleIdleChunk();return;
      }
      const next=this.pendingChunks.shift();
      if(!next || this.chunkCache.has(this.chunkKey(next.id,next.lod))){
        this.scheduleIdleChunk();return;
      }
      // Try durable geometry before recalculating triangles or scenery.
      // A disk miss is remembered so the NEXT idle slice generates it instead
      // of repeatedly asking the filesystem. Reads are asynchronous.
      const key=this.persistentKey(next.id,next.lod);
      const reader=window.tribenet?.loadTerrainMesh;
      if(key && typeof reader==='function' && !this.diskMissKeys.has(key)){
        this.diskReadBusy=true;
        Promise.resolve().then(()=>reader(key)).then(data=>{
          if(data && this.persistentKey(next.id,next.lod)===key &&
            this.chunkTouchesRetention(next.id) &&
            !this.chunkCache.has(this.chunkKey(next.id,next.lod))){
            this.restoreChunk(next.id,next.lod,data);
            this.diskStats.diskHits++;this.evictUnused();this.requestLater();
          }else if(!data){
            this.diskStats.diskMisses++;this.diskMissKeys.add(key);
            this.pendingChunks.unshift(next);
          }
        }).catch(error=>{
          this.diskStats.diskErrors++;this.diskMissKeys.add(key);
          this.pendingChunks.unshift(next);
          console.warn('Terrain cache restore failed; rebuilding:',error);
        }).finally(()=>{
          this.diskReadBusy=false;this.scheduleIdleChunk();
        });
        return;
      }
      try{
        // If terrain knowledge changed during an async read, never upload the
        // stale generated mesh. queueBuilds will schedule the new fingerprint.
        this.terrainChunk(next.id,next.lod);
        this.evictUnused();this.requestLater();
      }catch(error){
        this.failed=true;console.error('GPU terrain chunk generation failed:',error);
        this.setVisible(false);this.requestLater();return;
      }
      this.scheduleIdleChunk();
    };
    // Idle work is lower priority than drag/wheel handlers and animation. A
    // timeout lets the first visit finish on otherwise continuously busy CPUs.
    if(typeof requestIdleCallback==='function')requestIdleCallback(task,{timeout:140});
    else setTimeout(()=>task({timeRemaining:()=>12,didTimeout:true}),32);
  }
  evictUnused(){
    if(this.chunkCache.size<=MAX_CHUNKS)return;
    // Preserve every visible chunk and as much of the prefetched ring as will
    // fit. Evict distant and old LODs before any on-screen geometry.
    const keep=new Set();
    for(const id of this.visibleChunkIds){
      const selected=this.bestResident(id,this.lastLod);
      if(selected)keep.add(selected.key);
    }
    for(const [key,record] of this.chunkCache){
      if(this.chunkCache.size<=MAX_CHUNKS)break;
      if(keep.has(key)||this.activeChunkIds.has(record.id))continue;
      this.disposeChunk(record);this.chunkCache.delete(key);
    }
    for(const [key,record] of this.chunkCache){
      if(this.chunkCache.size<=MAX_CHUNKS)break;
      if(keep.has(key))continue;
      this.disposeChunk(record);this.chunkCache.delete(key);
    }
  }
  beginFrame(tiles,groundFaces,sample,state,onDraw,tileAt){
    if(!this.init())return false;
    this.setVisible(true);
    this.requestDraw=onDraw;
    this.units.length=0;
    this.size(document.getElementById('mapCanvas').clientWidth,
      document.getElementById('mapCanvas').clientHeight,
      state.scale,state.cameraX,state.cameraY);
    const lod=this.lod(state.scale);
    this.lastLod=lod;
    this.cameraCenterX=state.cameraX;this.cameraCenterY=state.cameraY;
    this.retentionWindow();
    this.groundFaces=groundFaces;this.sampleTerrain=sample;this.tileAt=tileAt;
    const visible=new Set(tiles.map(chunkId));
    this.visibleChunkIds=visible;
    // During interaction, never create offscreen jobs simply because zoom
    // changed the visible set. A settled frame will prioritise missing meshes
    // and then prefetch, without interfering with wheel events.
    const interacting=typeof IsoMapper!=='undefined'&&IsoMapper.interacting;
    const signature=lod+'|'+[...visible].sort().join('|');
    if(interacting){
      this.queueSignature=null;
    }else if(signature!==this.queueSignature){
      this.queueSignature=signature;
      this.queueBuilds(visible,lod);
    }
    // Update which cached meshes are displayed, allowing lower-detail
    // resident chunks to cover the gap until the new target LOD exists.
    for(const record of this.chunkCache.values())record.group.visible=false;
    let faces=0,trees=0,chunks=0;
    for(const id of visible){
      const record=this.bestResident(id,lod);
      if(!record)continue;
      record.group.visible=true;
      this.chunkCache.delete(record.key);this.chunkCache.set(record.key,record);
      faces+=record.faces;trees+=record.trees;chunks++;
    }
    this.stats.chunks=chunks;this.stats.faces=faces;this.stats.trees=trees;
    return true;
  }
  pick(x,y){
    if(!this.initialized||!this.visible)return null;
    const canvas=document.getElementById('mapCanvas');
    const rect=canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return null;
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(2*x/rect.width-1,1-2*y/rect.height),this.camera);
    const objects=[...this.chunkCache.values()].filter(chunk=>chunk.group.visible).map(chunk=>chunk.ground);
    const intersection=raycaster.intersectObjects(objects,false)[0];
    if(intersection)return {x:intersection.point.x/1.5,y:intersection.point.z/1.5};
    // While streaming, a newly visible tile can have no GPU mesh yet.
    // Project the ray against the analytic surface as a temporary fallback,
    // instead of making original hex selection non-responsive until upload.
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.14);
    let world=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!world)return null;
    for(let i=0;i<2;i++){
      const z=this.sampleTerrain?.(world.x/1.5,world.z/1.5)?.z;
      if(!Number.isFinite(z))break;
      plane.constant=-z;
      const next=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
      if(!next)break;
      world=next;
    }
    return {x:world.x/1.5,y:world.z/1.5};
  }
  // Grounding is solved for the whole miniature footprint, not just one
  // centre-point raycast. On steep hills the surrounding triangle used to
  // swallow the front half of the figure even when its centre was above land.
  renderedGroundHeight(m){
    const originHeight=Number.isFinite(m.z)?m.z:0;
    const region=window.IsoGeometry.regionAt(m.x,m.y);
    const cx=Math.floor(region.col/CHUNK_SIZE),cy=Math.floor(region.row/CHUNK_SIZE);
    const neighbours=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const record=this.bestResident((cx+dx)+':'+(cy+dy),FIXED_TERRAIN_STEPS);
      if(record?.group.visible)neighbours.push(record);
    }
    const radius=m.kind==='carts'?.145:m.kind==='horses'||m.mounted?.115:.085;
    const key=neighbours.map(r=>r.key+'#'+r.serial).sort().join('|')+
      ':'+m.x.toFixed(5)+':'+m.y.toFixed(5)+':'+radius;
    const cached=this.groundHeightCache.get(key);
    if(cached!==undefined)return cached;
    const positions=[[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius],
      [-radius*.7,-radius*.7],[radius*.7,-radius*.7],
      [-radius*.7,radius*.7],[radius*.7,radius*.7]];
    let highest=originHeight;
    const surfaces=neighbours.map(r=>r.ground);
    for(const [dx,dy] of positions){
      const x=m.x+dx,y=m.y+dy;
      const analytic=this.sampleTerrain?.(x,y)?.z;
      if(Number.isFinite(analytic))highest=Math.max(highest,analytic);
      if(!surfaces.length)continue;
      this.downRay.set(new THREE.Vector3(x*1.5,30,y*1.5),this.downDirection);
      this.downRay.near=0;this.downRay.far=60;
      const hit=this.downRay.intersectObjects(surfaces,false)[0];
      if(hit)highest=Math.max(highest,hit.point.y);
    }
    if(this.groundHeightCache.size>2500)this.groundHeightCache.clear();
    this.groundHeightCache.set(key,highest);
    return highest;
  }
  addModel(m){if(m && Number.isFinite(m.x)&&Number.isFinite(m.y))this.units.push(m);}
  updateUnits(){
    const kinds={body:[],head:[],leg:[],horse:[],horseLeg:[],cart:[],wheel:[]};
    const personColor=m=>m.kind==='warriors'?0xb7614e:m.kind==='actives'?0x4c9f95:0xd4b86c;
    const scale=UNIT_MODEL_SCALE;
    const scaled=(x,y,z)=>[x*scale,y*scale,z*scale];
    const add=(kind,x,y,z,size,color,heading=0)=>kinds[kind].push({
      p:[x,y,z],scale:size,color,heading
    });
    for(const m of this.units){
      const x=m.x*1.5,z=m.y*1.5;
      const ground=this.renderedGroundHeight(m);
      // A small clearance is intentional: mesh faces can be tilted across
      // the entire footprint. Models are grounded by their FEET, not torsos.
      const sole=ground+.018;
      const mounted=Boolean(m.mounted),heading=m.heading||0;
      if(m.kind==='carts'){
        add('cart',x,sole+.08*scale,z,scaled(1,1,1),0xa77945,heading);
        for(const sx of [-.085,.085])for(const sz of [-.095,.095])
          add('wheel',x+sx*scale,sole+.052*scale,z+sz*scale,
            scaled(1,1,1),0x493f31,heading);
        continue;
      }
      if(m.kind==='horses'||mounted){
        add('horse',x,sole+.10*scale,z,scaled(1,1,1),0xa87a4c,heading);
        for(const sx of [-.068,.068])for(const sz of [-.048,.048])
          add('horseLeg',x+sx*scale,sole+.051*scale,z+sz*scale,
            scaled(1,1,1),0x71543e,heading);
        if(m.kind==='horses')continue;
      }
      const rise=mounted?.16:0;
      for(const side of [-.027,.027])
        add('leg',x+side*scale,sole+(rise+.043)*scale,z,
          scaled(1,1,1),0x34434a,heading);
      add('body',x,sole+(rise+.10)*scale,z,
        scaled(.70,1,.75),personColor(m),heading);
      add('head',x,sole+(rise+.175)*scale,z,
        scaled(.7,.7,.7),0xe2bd92,heading);
    }
    const geometries={body:unitBox,head:unitHead,leg:personLeg,horse:horseBox,
      horseLeg:horseLeg,cart:cartBox,wheel:cartWheel};
    for(const [kind,entries] of Object.entries(kinds)){
      let mesh=this.unitMeshes.get(kind);
      if(mesh && mesh.instanceMatrix.count<entries.length){
        this.modelGroup.remove(mesh);mesh.dispose();mesh=null;
      }
      if(!mesh){
        mesh=new THREE.InstancedMesh(geometries[kind],this.treeMaterials[kind],Math.max(32,Math.ceil(entries.length*1.5)));
        mesh.frustumCulled=false;
        this.modelGroup.add(mesh);
        this.unitMeshes.set(kind,mesh);
      }
      mesh.count=entries.length;
      entries.forEach((item,i)=>{
        this.object.position.set(...item.p);
        this.object.rotation.set(0,-item.heading,kind==='wheel'?Math.PI/2:0);
        this.object.scale.set(...item.scale);
        this.object.updateMatrix();
        mesh.setMatrixAt(i,this.object.matrix);
        this.color.setHex(item.color);mesh.setColorAt(i,this.color);
      });
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }
  endFrame(){
    if(!this.initialized||!this.visible)return;
    this.updateUnits();
    const started=performance.now();
    this.renderer.render(this.scene,this.camera);
    this.stats.renderMs=performance.now()-started;
    this.stats.gpuCalls=this.renderer.info.render.calls;
  }
  getStats(){return {...this.stats,...this.diskStats,terrainSubdivisions:FIXED_TERRAIN_STEPS,unitModelScale:UNIT_MODEL_SCALE,cachedChunks:this.chunkCache.size,queuedChunks:this.pendingChunks.length};}
}
window.TribeNetGPU=new GPUMap();

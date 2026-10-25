/* GPU terrain renderer for TribeNet's existing deterministic world-space map.
 * Terrain, water, forests and unit miniatures are WebGL. The regular map
 * canvas remains a transparent interaction/label/planning overlay.
 * This file is bundled locally with Three.js; no CDN or remote assets.
 */
import * as THREE from 'three';
import { TerrainResidencyPolicy, DEFAULT_MAX_CHUNKS } from './terrain-residency.js';
import { TerrainManualRecorder } from './terrain-manual-recorder.js';
import { knownGeometryChunks } from './terrain-world-workset.js';
import { planWorldGeometry } from './terrain-preparation-plan.js';
import geometryWorkerSource from 'virtual:tribenet-geometry-worker';

// Smaller chunks cap synchronous CPU work when zoomed in; GPU instancing
// still batches trees and units across each chunk.
const CHUNK_SIZE=4;
// Keep enough GPU chunks for the current submap and nearby regions; geometry
// is still bounded by LRU. Nine whole submaps of GPU meshes would be excessive.
const MAX_CHUNKS=DEFAULT_MAX_CHUNKS; // capacity backstop; measured bytes are the primary limit
// One constant world-space (13x13) geometry neighbourhood is warmed around
// the camera centre, regardless of zoom scale or viewport dimensions.
// Chunks remain resident until memory pressure requires LRU eviction.
const FOCUS_RADIUS_CHUNKS=3;
const FOCUS_HYSTERESIS_CHUNKS=1;
const FIXED_TERRAIN_STEPS=8;
const UNIT_MODEL_SCALE=.5;
// Only change this identifier when geometry generation rules change, not
// when the app release number increments. Known terrain/settings have separate keys.
const MESH_GENERATOR_REVISION='terrain-fixed8-seam-coves-hermite-20261025-r6';
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
    this.residency=new TerrainResidencyPolicy();this.shownRecords=new Set();
    this.knownChunkIds=new Set();this.worldGeometryComplete=false;
    this.worldChunksPinned=false;
    this.terrainCodeSnapshot=new Map();
    this.snapshotInitialized=false;
    this.meshFingerprints=new Map();
    this.worldRows=[];this.worldPalette={};this.worldKnowledgeRevision=0;
    this.meshWorker=null;this.meshWorkerReady=false;this.meshWorkerBusy=false;
    this.meshWorkerJob=null;this.meshWorkerFailed=false;
    this.completedUploads=[];this.uploadScheduled=false;
    this.workerRequestSerial=0;
    this.renderSerial=0;this.groundRevision=0;this.lastUnitSignature=null;this.frameStartedAt=0;
    this.completeFrameTimes=[];
    this.units=[];this.visible=false;this.failed=false;this.initialized=false;this.failureReason='';
    this.generation=0;this.pendingChunks=[];this.idleBuildPending=false;this.activeChunkIds=new Set();this.visibleChunkIds=new Set();
    this.knowledgeSubmapWindow=new Set();this.lastCentreSubmap=null;
    this.focusChunk=null;this.focusChunkIds=new Set();
    this.groundFaces=null;this.sampleTerrain=null;this.tileAt=null;this.lastLod=FIXED_TERRAIN_STEPS;
    this.diskMissKeys=new Set();this.diskReadBusy=false;this.cachedWrites=new Set();
    this.persistedMeshKeys=new Set();this.hydrationPreviouslyComplete=false;
    this.diskStats={diskHits:0,diskMisses:0,diskWrites:0,diskErrors:0};
    this.groundHeightCache=new Map();this.meshRevision=0;
    this.downRay=new THREE.Raycaster();this.downDirection=new THREE.Vector3(0,-1,0);
    this.requestDraw=null;this.pendingFrame=false;this.stats={chunks:0,faces:0,trees:0,builds:0,sharedUpdates:0,hiddenChunkEvents:0,shownChunkEvents:0,gpuCalls:0,renderMs:0,evictions:0,terrainInvalidations:0,fullResets:0,focusTarget:0,focusRadiusChunks:FOCUS_RADIUS_CHUNKS,prefetchTarget:0,knowledgePending:0,terrainMs:0,restorationMs:0,invalidatedChunks:0,groundCalculations:0,unitBufferRebuilds:0,cameraOnlyFrames:0,frameMs:0,maxFrameMs:0,workerBuilds:0,workerFailures:0,workerTimeMs:0,workerUploadMs:0,workerStaleResponses:0};
    this.debugDisableTerrainCulling=false;this.debugFreezeBackground=false;
    this.deferredTerrainChanges=new Map();this.deferredSharedChanges=new Map();
    this.terrainRecorder=new TerrainManualRecorder();this.lastRecordedFrame=0;
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
  terrainDiagnosticSnapshot(){
    const groups=[...this.chunkCache.values()];
    return {
      camera:typeof state!=='undefined'?{
        x:Number(state.cameraX.toFixed(4)),y:Number(state.cameraY.toFixed(4)),
        zoom:Number(state.scale.toFixed(2)),dragging:Boolean(state.dragging)}:null,
      interacting:typeof IsoMapper!=='undefined'&&IsoMapper.interacting,
      resident:groups.length,knownTargets:this.knownChunkIds.size,
      enabledGroups:groups.filter(r=>r.group.visible).length,
      disabledGroups:groups.filter(r=>!r.group.visible).length,
      residentMiB:Number((this.residency.bytes/1048576).toFixed(2)),
      memoryLimitMiB:Number((this.residency.maxBytes/1048576).toFixed(0)),
      queued:this.pendingChunks.length,completedUploads:this.completedUploads.length,
      workerBusy:this.meshWorkerBusy,diskBusy:this.diskReadBusy,
      worldComplete:this.worldGeometryComplete,hydrated:window.TribeNetKnowledge?.complete?.(),
      cullingDisabled:this.debugDisableTerrainCulling,
      backgroundFrozen:this.debugFreezeBackground,
      drawnCalls:this.stats.gpuCalls,drawnTriangles:this.renderer?.info?.render?.triangles||0,
      builds:this.stats.builds,diskHits:this.diskStats.diskHits,
      evictions:this.stats.evictions,invalidations:this.stats.terrainInvalidations,
      resets:this.stats.fullResets,hidden:this.stats.hiddenChunkEvents,
      shown:this.stats.shownChunkEvents,sharedUpdates:this.stats.sharedUpdates
    };
  }
  recordTerrainEvent(type,details){this.terrainRecorder.event(type,details);}
  applyTerrainDiagnosticCulling(record){
    for(const child of record.group.children)
      if(child.isMesh||child.isLine||child.isLineSegments)
        child.frustumCulled=!this.debugDisableTerrainCulling;
  }
  setTerrainDiagnosticOptions({disableFrustumCulling,freezeBackground}={}){
    if(typeof freezeBackground==='boolean'&&freezeBackground &&
       !this.debugFreezeBackground&&this.residency.overBudget(this.chunkCache.size))
      throw Error('Cannot freeze: resident terrain already exceeds its memory budget');
    if(typeof disableFrustumCulling==='boolean' &&
       disableFrustumCulling!==this.debugDisableTerrainCulling){
      this.debugDisableTerrainCulling=disableFrustumCulling;
      for(const record of this.chunkCache.values())this.applyTerrainDiagnosticCulling(record);
      this.recordTerrainEvent('terrain-culling-changed',{disabled:disableFrustumCulling});
    }
    if(typeof freezeBackground==='boolean' &&
       freezeBackground!==this.debugFreezeBackground){
      this.debugFreezeBackground=freezeBackground;
      this.recordTerrainEvent('background-freeze-changed',{frozen:freezeBackground});
      if(!freezeBackground){
        const direct=[...this.deferredTerrainChanges.values()];
        const shared=[...this.deferredSharedChanges.values()];
        this.deferredTerrainChanges.clear();this.deferredSharedChanges.clear();
        if(direct.length)this.invalidateHexes(direct,shared);
        this.scheduleCompletedUpload();this.scheduleIdleChunk();this.evictUnused();
      }
    }
    return {disableFrustumCulling:this.debugDisableTerrainCulling,
      freezeBackground:this.debugFreezeBackground};
  }
  startTerrainRecording(metadata={}){
    this.terrainRecorder.start(()=>this.terrainDiagnosticSnapshot(),{
      ...metadata,initialOptions:{
        disableFrustumCulling:this.debugDisableTerrainCulling,
        freezeBackground:this.debugFreezeBackground}});
  }
  stopTerrainRecording(){return this.terrainRecorder.stop({idleMs:2000});}
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
      const activeCanvas=this.canvas;
      this.canvas.addEventListener('webglcontextlost',event=>{
        event.preventDefault();
        // A deliberate renderer disposal can emit contextlost asynchronously.
        // Never let a disposed, old canvas disable a fresh WebGL renderer.
        if(this.canvas!==activeCanvas)return;
        this.failureReason='WebGL context lost';this.failed=true;this.initialized=false;
        console.error('Mapper GPU context lost; switching to software terrain');
        this.setVisible(false);
        if(typeof window.draw==='function')window.draw();
      },false);
      return true;
    }catch(error){
      this.failed=true;this.failureReason='WebGL initialization: '+(error?.message||String(error));console.error('Three.js terrain renderer unavailable; using Canvas fallback:',error);
      this.canvas?.remove();this.canvas=null;this.renderer=null;
      return false;
    }
  }
  retry(){
    // Recreate only the graphics backend; historical terrain and all saved
    // game state remain untouched. The old canvas' contextlost event is
    // ignored by the canvas identity guard in init().
    this.dispose();
    this.failed=false;this.failureReason='';this.visible=false;
    if(typeof IsoMapper!=='undefined'&&IsoMapper.enabled&&
      typeof state!=='undefined'&&state.mode==='detail'){
      this.init();
      if(typeof draw==='function')draw();
    }
    return !this.failed;
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
    for(const record of this.chunkCache.values())this.disposeChunk(record,'reset');
    this.chunkCache.clear();this.shownRecords.clear();this.lastUnitSignature=null;
    this.worldGeometryComplete=false;
    this.groundRevision++;this.groundHeightCache.clear();
    this.stats.chunks=0;this.stats.faces=0;this.stats.trees=0;
    this.generation++;this.pendingChunks=[];this.queueSignature=null;
    // Existing worker output is ignored after any terrain preset reset.
    this.worldKnowledgeRevision++;
    this.meshWorkerBusy=false;this.meshWorkerJob=null;
    this.completedUploads=[];this.uploadScheduled=false;
    if(this.meshWorker && this.worldRows.length)this.sendWorkerKnowledge();
    // The persistent cache is content-addressed; changing a preset changes
    // keys rather than deleting historical meshes from disk.
    this.diskMissKeys.clear();this.meshFingerprints.clear();
    this.groundHeightCache.clear();
  }
  disposeChunk(record,reason='lru'){
    this.recordTerrainEvent('chunk-disposed',{id:record.id,reason});
    this.worldGeometryComplete=false;
    this.shownRecords.delete(record.key);
    this.residency.release(record);
    this.chunkGroup?.remove(record.group);
    if(reason==='lru')this.stats.evictions++;
    else if(reason==='terrain')this.stats.terrainInvalidations++;
    else if(reason==='reset')this.stats.fullResets++;
    record.ground.geometry.dispose();
    record.shared?.geometry.dispose();
    record.waves?.geometry.dispose();
    // Free per-instance GPU buffers on LRU eviction; tree geometries and
    // materials are shared and intentionally retained.
    for(const child of record.group.children)if(child.isInstancedMesh)child.dispose();
  }
  // Build/attach first; only then remove the old GPU mesh.
  replaceChunk(id,lod,mesh){
    const key=this.chunkKey(id,lod),previous=this.chunkCache.get(key);
    const replacement=this.restoreChunk(id,lod,mesh);
    if(previous){
      replacement.group.visible=previous.group.visible;
      replacement.lastUsed=previous.lastUsed;
      this.disposeChunk(previous,'terrain');
      if(replacement.group.visible)this.shownRecords.add(key);
      this.recordTerrainEvent('chunk-replaced',{id,lod});
    }
    return replacement;
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
  newChunk(tiles,groundFaces,sample,steps,sharedOnly=false){
    const group=new THREE.Group();
    const coords=[],colors=[],sharedCoords=[],sharedColors=[];
    let coreFaces=0,sharedFaces=0;
    let targetCoords=coords,targetColors=colors;
    const add=(p,c)=>{
      targetCoords.push(p.x*1.5,p.z||0,p.y*1.5);
      targetColors.push(c.r,c.g,c.b);
    };
    let facesCount=0;
    for(const t of tiles){
      const faces=groundFaces(t,steps);
      for(const f of faces){
        if(f.points.length<3 || (sharedOnly && f.region==='core'))continue;
        const immutable=f.region==='core';
        targetCoords=immutable?coords:sharedCoords;
        targetColors=immutable?colors:sharedColors;
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
          const a=f.points[0],b=f.points[k],d=f.points[k+1];
          const ax=Math.fround(a.x*1.5),ay=Math.fround(a.y*1.5);
          const bx=Math.fround(b.x*1.5),by=Math.fround(b.y*1.5);
          const dx=Math.fround(d.x*1.5),dy=Math.fround(d.y*1.5);
          if(Math.abs((bx-ax)*(dy-ay)-(by-ay)*(dx-ax))<1e-8)continue;
          vertex(a);vertex(b);vertex(d);
          facesCount++;
          if(immutable)coreFaces++;else sharedFaces++;
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();
    const ground=new THREE.Mesh(geometry,this.meshMaterial);
    ground.frustumCulled=true;
    group.add(ground);
    const borderGeometry=new THREE.BufferGeometry();
    borderGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sharedCoords,3));
    borderGeometry.setAttribute('color',new THREE.Float32BufferAttribute(sharedColors,3));
    borderGeometry.computeBoundingSphere();
    const shared=new THREE.Mesh(borderGeometry,this.meshMaterial);
    shared.frustumCulled=true;
    group.add(shared);
    let count=0;
    const sites=[];
    const density=clamp(terrainSetting('treeDensity',2.5),.5,5);
    const scale=clamp(terrainSetting('treeSize',.55),.2,1.5);
    for(const t of tiles){
      if(sharedOnly||!t.known||!treeKind(t.data?.terrain))continue;
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
      geometry.computeBoundingSphere();
      waves.frustumCulled=true;waves.renderOrder=2;group.add(waves);
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
      inst.computeBoundingSphere();inst.frustumCulled=true;
      group.add(inst);
    };
    addTreeInstances('trunk',baseTreeTrunk,this.treeMaterials.trunk,sites,.10,1);
    addTreeInstances('broad',baseTreeCrown,this.treeMaterials.broad,sites.filter(s=>!s.conifer),.32,1.45);
    addTreeInstances('conifer',baseTreeCrown,this.treeMaterials.conifer,sites.filter(s=>s.conifer),.32,1.15);
    return {group,ground,shared,waves,faces:facesCount,coreFaces,sharedFaces,trees:count};
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
    const cacheKey=id+':'+lod;
    const cached=this.meshFingerprints.get(cacheKey);
    if(cached)return cached;
    const [cx,cy]=id.split(':').map(Number),terrain=[];
    for(let col=cx*CHUNK_SIZE-2;col<(cx+1)*CHUNK_SIZE+2;col++){
      for(let row=cy*CHUNK_SIZE-2;row<(cy+1)*CHUNK_SIZE+2;row++){
        if(col<0||row<0||col>=TOTAL_COLS||row>=TOTAL_ROWS)continue;
        const code=this.snapshotInitialized
          ?this.terrainCodeSnapshot.get(col+':'+row)
          :(this.tileAt(col,row)?.data?.terrain||'?');
        terrain.push([col,row,code&&code!=='UNKNOWN'?code:'?']);
      }
    }
    const settings=window.TerrainSettings?.get?.()||{};
    const stableSettings=Object.keys(settings).sort().map(k=>[k,settings[k]]);
    const fingerprint=JSON.stringify([MESH_GENERATOR_REVISION,
      window.TerrainSettings?.WORLD_SEED||1790425012,id,lod,stableSettings,terrain]);
    if(this.snapshotInitialized)this.meshFingerprints.set(cacheKey,fingerprint);
    return fingerprint;
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
        type,matrices:child.instanceMatrix.array.slice(0,child.count*16)
      });
    }
    return {format:2,known:Boolean(record.known),faces:record.faces,trees:record.trees,
      coreFaces:record.coreFaces,sharedFaces:record.sharedFaces,
      positions:geometry.getAttribute('position').array,
      colors:geometry.getAttribute('color').array,
      sharedPositions:record.shared.geometry.getAttribute('position').array,
      sharedColors:record.shared.geometry.getAttribute('color').array,
      waves:record.waves?record.waves.geometry.getAttribute('position').array:null,
      instances};
  }
  restoreChunk(id,lod,data){
    const numericArray=value=>Array.isArray(value)||value instanceof Float32Array;
    if(!data||data.format!==2||!numericArray(data.positions)||
      !numericArray(data.colors)||!numericArray(data.sharedPositions)||
      !numericArray(data.sharedColors)||
      data.positions.length!==data.colors.length||
      data.sharedPositions.length!==data.sharedColors.length||
      data.positions.length+data.sharedPositions.length<9 ||
      data.positions.length%3 || data.sharedPositions.length%3)
      throw Error('Invalid cached terrain components');
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
    geometry.computeBoundingSphere();
    const group=new THREE.Group(),ground=new THREE.Mesh(geometry,this.meshMaterial);
    ground.frustumCulled=true;group.add(ground);
    const sharedGeometry=new THREE.BufferGeometry();
    sharedGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.sharedPositions,3));
    sharedGeometry.setAttribute('color',new THREE.Float32BufferAttribute(data.sharedColors,3));
    sharedGeometry.computeBoundingSphere();
    const shared=new THREE.Mesh(sharedGeometry,this.meshMaterial);
    shared.frustumCulled=true;group.add(shared);
    let waves=null;
    if(data.waves?.length){
      const waveGeometry=new THREE.BufferGeometry();
      waveGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.waves,3));
      waves=new THREE.LineSegments(waveGeometry,this.waveMaterial);
      waveGeometry.computeBoundingSphere();
      waves.frustumCulled=true;waves.renderOrder=2;group.add(waves);
    }
    if(data.treeSites?.length){
      const sites=data.treeSites;
      const add=(geometry,material,filtered,height,radius)=>{
        if(!filtered.length)return;
        const mesh=new THREE.InstancedMesh(geometry,material,filtered.length);
        mesh.frustumCulled=false;
        filtered.forEach((tree,i)=>{
          this.object.position.set(tree.x*1.5,tree.z+height*tree.size,tree.y*1.5);
          this.object.rotation.set(0,0,0);
          this.object.scale.set(tree.size*radius,tree.size,tree.size*radius);
          this.object.updateMatrix();
          mesh.setMatrixAt(i,this.object.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
        mesh.computeBoundingSphere();mesh.frustumCulled=true;
        group.add(mesh);
      };
      add(baseTreeTrunk,this.treeMaterials.trunk,sites,.10,1);
      add(baseTreeCrown,this.treeMaterials.broad,sites.filter(t=>!t.conifer),.32,1.45);
      add(baseTreeCrown,this.treeMaterials.conifer,sites.filter(t=>t.conifer),.32,1.15);
    }
    const forestTypes={
      trunk:[baseTreeTrunk,this.treeMaterials.trunk],
      broad:[baseTreeCrown,this.treeMaterials.broad],
      conifer:[baseTreeCrown,this.treeMaterials.conifer]
    };
    for(const item of data.instances||[]){
      const descriptor=forestTypes[item.type];
      if(!descriptor||!(Array.isArray(item.matrices)||item.matrices instanceof Float32Array)||item.matrices.length%16!==0)
        throw Error('Invalid cached forest instances');
      const count=item.matrices.length/16;
      if(!count)continue;
      const inst=new THREE.InstancedMesh(descriptor[0],descriptor[1],count);
      inst.instanceMatrix.array.set(item.matrices);
      inst.instanceMatrix.needsUpdate=true;
      inst.computeBoundingSphere();inst.frustumCulled=true;group.add(inst);
    }
    const record={id,lod,key:this.chunkKey(id,lod),group,ground,shared,waves,
      faces:data.faces,coreFaces:data.coreFaces,sharedFaces:data.sharedFaces,
      trees:data.trees,known:data.known!==false,serial:++this.meshRevision};
    record.group.visible=false;
    this.applyTerrainDiagnosticCulling(record);
    this.residency.register(record);
    this.chunkCache.set(record.key,record);this.chunkGroup.add(group);
    return record;
  }
  saveToDisk(record){
    // The emergency display fallback is provisional. It may contain fog
    // where database knowledge has not yet arrived, so never persist it.
    if(window.TribeNetKnowledge && !window.TribeNetKnowledge.complete())return;
    const api=window.tribenet?.saveTerrainMesh;
    if(typeof api!=='function')return;
    const key=this.persistentKey(record.id,record.lod);
    if(!key||this.cachedWrites.has(key)||this.persistedMeshKeys.has(key))return;
    this.cachedWrites.add(key);
    // File compression and writing happen in Electron's main process.
    const job=()=>{
      let payload;
      try{
        if(!this.chunkCache.has(record.key)||record.dirtyShared||record.dirtyCore||
           window.TribeNetKnowledge?.complete?.()===false){
          this.cachedWrites.delete(key);return;
        }
        payload=this.serializeChunk(record);
      }
      catch(error){this.diskStats.diskErrors++;this.cachedWrites.delete(key);return;}
      Promise.resolve().then(()=>api(key,payload)).then(()=>{
        this.diskStats.diskWrites++;this.persistedMeshKeys.add(key);
      }).catch(error=>{
        this.diskStats.diskErrors++;
        console.warn('Terrain cache write unavailable:',error);
      }).finally(()=>this.cachedWrites.delete(key));
    };
    if(typeof requestIdleCallback==='function')
      requestIdleCallback(job,{timeout:500});
    else setTimeout(job,40);
  }
  persistHydratedMeshes(){
    if(window.TribeNetKnowledge?.complete?.()===false)return;
    for(const record of this.chunkCache.values())
      if(record.known&&!record.dirtyShared&&!record.dirtyCore)this.saveToDisk(record);
  }
  terrainChunk(id,lod){
    const [cx,cy]=id.split(':').map(Number),cells=[];
    for(let col=cx*CHUNK_SIZE;col<(cx+1)*CHUNK_SIZE;col++)
      for(let row=cy*CHUNK_SIZE;row<(cy+1)*CHUNK_SIZE;row++)
        if(col>=0&&row>=0&&col<TOTAL_COLS&&row<TOTAL_ROWS)cells.push(this.tileAt(col,row));
    const result=this.newChunk(cells,this.groundFaces,this.sampleTerrain,lod);
    const record={...result,key:this.chunkKey(id,lod),id,lod,known:cells.some(cell=>cell.known)};
    const previous=this.chunkCache.get(record.key);
    record.group.visible=previous?.group.visible||false;
    record.lastUsed=previous?.lastUsed;
    this.applyTerrainDiagnosticCulling(record);
    this.residency.register(record);
    this.chunkCache.set(record.key,record);this.chunkGroup.add(record.group);
    if(previous){
      this.disposeChunk(previous,'terrain');
      if(record.group.visible)this.shownRecords.add(record.key);
      this.recordTerrainEvent('chunk-replaced',{id,lod,source:'synchronous'});
    }
    record.serial=++this.meshRevision;
    this.recordTerrainEvent('chunk-generated',{id,lod});
    this.stats.builds++;
    this.saveToDisk(record);
    return record;
  }
  refreshSharedChunk(id,lod){
    const record=this.bestResident(id,lod);
    if(!record||!record.dirtyShared)return false;
    const [cx,cy]=id.split(':').map(Number),cells=[];
    for(let col=cx*CHUNK_SIZE;col<(cx+1)*CHUNK_SIZE;col++)
      for(let row=cy*CHUNK_SIZE;row<(cy+1)*CHUNK_SIZE;row++)
        if(col>=0&&row>=0&&col<TOTAL_COLS&&row<TOTAL_ROWS)
          cells.push(this.tileAt(col,row));
    const begun=performance.now();
    const partial=this.newChunk(cells,this.groundFaces,this.sampleTerrain,lod,true);
    // Preserve the exact existing immutable core GPU buffer and forest
    // instances. Only the fog/edge/corner mesh is replaced and re-persisted.
    record.group.remove(record.shared);
    record.shared.geometry.dispose();
    record.shared=partial.shared;
    partial.group.remove(partial.shared);
    record.group.add(partial.shared);
    if(record.waves){
      record.group.remove(record.waves);record.waves.geometry.dispose();
    }
    record.waves=partial.waves;
    if(partial.waves){partial.group.remove(partial.waves);record.group.add(partial.waves);}
    partial.ground.geometry.dispose();
    record.sharedFaces=partial.sharedFaces;
    record.faces=record.coreFaces+record.sharedFaces;
    record.serial=++this.meshRevision;
    this.applyTerrainDiagnosticCulling(record);
    this.residency.update(record);
    record.dirtyShared=false;
    this.stats.sharedUpdates++;
    this.stats.terrainMs+=performance.now()-begun;
    this.saveToDisk(record);
    return true;
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
    // Data-window and camera changes do not change what terrain exists.
    // The geometry work queue is keyed to terrain knowledge and hydration,
    // not to the current submap or zoom.
  }
  invalidateHexes(changedHexes,affectedHexes=changedHexes){
    if(!changedHexes?.length)return;
    if(this.debugFreezeBackground){
      for(const p of changedHexes)this.deferredTerrainChanges.set(p.col+':'+p.row,p);
      for(const p of affectedHexes)this.deferredSharedChanges.set(p.col+':'+p.row,p);
      this.recordTerrainEvent('invalidation-deferred',{changed:changedHexes.length,
        affected:affectedHexes.length});
      return;
    }
    this.recordTerrainEvent('terrain-knowledge-invalidated',{changed:changedHexes.length,
      affected:affectedHexes.length});
    this.worldGeometryComplete=false;
    this.groundRevision++;
    this.groundHeightCache.clear();
    this.lastUnitSignature=null;
    const chunkId=p=>Math.floor(p.col/CHUNK_SIZE)+':'+Math.floor(p.row/CHUNK_SIZE);
    const direct=new Set(changedHexes.map(chunkId));
    const touched=new Set((affectedHexes||[]).map(chunkId));
    for(const [key,record] of this.chunkCache){
      if(direct.has(record.id)){
        if(!this.knownChunkIds.has(record.id)){
          this.disposeChunk(record,'terrain');this.chunkCache.delete(key);
        }else{
          record.dirtyCore=true;
          record.dirtyShared=true;
          this.recordTerrainEvent('chunk-rebuild-queued',{id:record.id});
        }
      }else if(touched.has(record.id)){
        // Neighbour discovery only affects the shared border/corner surface.
        // Never dispose the immutable inner-core GPU buffer.
        record.dirtyShared=true;
      }
    }
    this.pendingChunks=this.pendingChunks.filter(t=>!direct.has(t.id));
    this.stats.invalidatedChunks+=direct.size;
    this.queueSignature=null;
  }
  updateFocusArea(){
    // IsoGeometry.regionAt resolves the hex beneath the CAMERA CENTRE; no
    // viewport scale is consulted, and mouse-anchored zoom only updates this
    // when it actually moves far enough into a different world area.
    const region=window.IsoGeometry.regionAt(this.cameraCenterX,this.cameraCenterY);
    const cx=Math.max(0,Math.floor(region.col/CHUNK_SIZE));
    const cy=Math.max(0,Math.floor(region.row/CHUNK_SIZE));
    if(!this.focusChunk ||
      Math.abs(cx-this.focusChunk.cx)>FOCUS_HYSTERESIS_CHUNKS ||
      Math.abs(cy-this.focusChunk.cy)>FOCUS_HYSTERESIS_CHUNKS){
      this.focusChunk={cx,cy};
    }
    const ids=new Set();
    for(let dx=-FOCUS_RADIUS_CHUNKS;dx<=FOCUS_RADIUS_CHUNKS;dx++){
      for(let dy=-FOCUS_RADIUS_CHUNKS;dy<=FOCUS_RADIUS_CHUNKS;dy++){
        const x=this.focusChunk.cx+dx,y=this.focusChunk.cy+dy;
        if(x>=0&&y>=0&&x*CHUNK_SIZE<TOTAL_COLS&&y*CHUNK_SIZE<TOTAL_ROWS)
          ids.add(x+':'+y);
      }
    }
    this.focusChunkIds=ids;
    this.stats.focusTarget=ids.size;
    return ids;
  }
  setWorldKnowledge(terrain,parseCoordinate){
    this.worldGeometryComplete=false;
    this.terrainCodeSnapshot.clear();
    this.meshFingerprints.clear();
    for(const [coordinate,type] of terrain){
      if(!type||type==='UNKNOWN')continue;
      const p=parseCoordinate(coordinate);
      if(Number.isFinite(p?.globalCol)&&Number.isFinite(p?.globalRow))
        this.terrainCodeSnapshot.set(p.globalCol+':'+p.globalRow,type);
    }
    this.snapshotInitialized=true;
    this.worldRows=[...terrain].filter(([,type])=>type&&type!=='UNKNOWN')
      .map(([coordinate,type])=>{
        const p=parseCoordinate(coordinate);
        return {coordinate,globalCol:p.globalCol,globalRow:p.globalRow,terrain:type};
      }).filter(row=>Number.isFinite(row.globalCol)&&Number.isFinite(row.globalRow));
    this.worldPalette=typeof terrainStyle!=='undefined'
      ?Object.fromEntries(Object.entries(terrainStyle).map(([key,value])=>[key,value[0]])):{};
    this.worldKnowledgeRevision++;
    this.sendWorkerKnowledge();
    // Called on terrain-knowledge revision, not by camera movement.
    // The workset describes the discovered world, independent of view scale.
    const next=knownGeometryChunks(terrain,parseCoordinate,{
      chunkSize:CHUNK_SIZE,totalCols:TOTAL_COLS,totalRows:TOTAL_ROWS
    });
    if(next.size===this.knownChunkIds.size &&
      [...next].every(id=>this.knownChunkIds.has(id)))return;
    this.knownChunkIds=next;
    this.queueSignature=null;
  }
  ensureMeshWorker(){
    if(this.meshWorker||this.meshWorkerFailed||typeof Worker==='undefined')return Boolean(this.meshWorker);
    try{
      const url=URL.createObjectURL(new Blob([geometryWorkerSource],
        {type:'application/javascript'}));
      const worker=new Worker(url);
      this.meshWorkerUrl=url;
      this.meshWorker=worker;this.meshWorkerReady=false;
      worker.onmessage=event=>this.handleWorkerMessage(event.data);
      worker.onerror=error=>{
        console.warn('World geometry worker unavailable; using synchronous recovery:',error.message);
        this.stats.workerFailures++;
        this.meshWorkerFailed=true;this.meshWorkerBusy=false;this.meshWorkerReady=false;
        if(this.meshWorkerJob)this.pendingChunks.unshift(this.meshWorkerJob);
        this.meshWorkerJob=null;
        worker.terminate();this.meshWorker=null;
      if(this.meshWorkerUrl){URL.revokeObjectURL(this.meshWorkerUrl);this.meshWorkerUrl=null;}
        this.scheduleIdleChunk();
      };
      this.sendWorkerKnowledge();
      return true;
    }catch(error){
      this.meshWorkerFailed=true;this.stats.workerFailures++;
      console.warn('Cannot start world geometry worker:',error);
      return false;
    }
  }
  sendWorkerKnowledge(){
    if(!this.meshWorker)return;
    this.meshWorkerReady=false;
    this.meshWorker.postMessage({type:'knowledge',revision:this.worldKnowledgeRevision,
      rows:this.worldRows,palette:this.worldPalette,settings:window.TerrainSettings?.get?.()||{}});
  }
  applySharedWorkerResult(job,mesh){
    const record=this.chunkCache.get(this.chunkKey(job.id,job.lod));
    if(!record?.dirtyShared)return;
    record.group.remove(record.shared);
    record.shared.geometry.dispose();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(mesh.sharedPositions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(mesh.sharedColors,3));
    g.computeBoundingSphere();
    record.shared=new THREE.Mesh(g,this.meshMaterial);
    record.shared.frustumCulled=true;
    record.group.add(record.shared);
    if(record.waves){
      record.group.remove(record.waves);
      record.waves.geometry.dispose();
      record.waves=null;
    }
    if(mesh.waves?.length){
      const wavesGeometry=new THREE.BufferGeometry();
      wavesGeometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.waves,3));
      record.waves=new THREE.LineSegments(wavesGeometry,this.waveMaterial);
      wavesGeometry.computeBoundingSphere();
      record.waves.frustumCulled=true;record.waves.renderOrder=2;
      record.group.add(record.waves);
    }
    record.sharedFaces=mesh.sharedFaces;
    record.faces=record.coreFaces+record.sharedFaces;
    record.serial=++this.meshRevision;record.dirtyShared=false;
    this.applyTerrainDiagnosticCulling(record);
    this.residency.update(record);
    this.stats.sharedUpdates++;
    this.saveToDisk(record);
  }
  handleWorkerMessage(message){
    if(message.type==='ready'){
      if(message.revision!==this.worldKnowledgeRevision)return;
      this.meshWorkerReady=true;
      this.scheduleIdleChunk();
      return;
    }
    const job=this.meshWorkerJob;
    // Reset, historical turn switches and new terrain knowledge can invalidate
    // a worker task while its message is still in flight. A response belongs
    // exclusively to its originating job; never consume a newer job's slot.
    if(!job || message.requestId!==job.requestId){
      this.stats.workerStaleResponses++;
      return;
    }
    this.meshWorkerBusy=false;this.meshWorkerJob=null;
    if(message.type==='stale'||message.revision!==this.worldKnowledgeRevision){
      this.queueSignature=null;this.requestLater();this.scheduleIdleChunk();return;
    }
    if(message.type==='error'){
      this.stats.workerFailures++;
      this.meshWorkerFailed=true;this.meshWorkerReady=false;
      this.meshWorker?.terminate();this.meshWorker=null;
      if(this.meshWorkerUrl){URL.revokeObjectURL(this.meshWorkerUrl);this.meshWorkerUrl=null;}
      if(job)this.pendingChunks.unshift(job);
      console.warn('World geometry worker failed; falling back:',message.error);
      this.scheduleIdleChunk();return;
    }
    if(message.type==='built'&&job){
      // Worker messages arrive asynchronously, including during wheel/drag.
      // Do not upload large BufferGeometry objects inside this message event.
      this.completedUploads.push({job,message,generation:this.generation});
      this.scheduleCompletedUpload();
      return;
    }
    this.scheduleIdleChunk();
  }
  scheduleCompletedUpload(){
    if(this.debugFreezeBackground)return;
    if(this.uploadScheduled||!this.completedUploads.length)return;
    this.uploadScheduled=true;
    const generation=this.generation;
    const task=deadline=>{
      this.uploadScheduled=false;
      if(this.debugFreezeBackground)return;
      if(generation!==this.generation)return;
      // A database query can begin AFTER the worker started preparing a
      // chunk. Never upload completed geometry while the historical/live
      // knowledge barrier is pending, even if an old build finishes now.
      if((typeof IsoMapper!=='undefined'&&IsoMapper.interacting)||
         (window.TribeNetKnowledge&&!window.TribeNetKnowledge.ready())){
        setTimeout(()=>this.scheduleCompletedUpload(),75);
        return;
      }
      if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<4){
        this.scheduleCompletedUpload();
        return;
      }
      const entry=this.completedUploads.shift();
      if(!entry)return;
      if(entry.generation===this.generation&&
         entry.message.revision===this.worldKnowledgeRevision){
        const {job,message}=entry,started=performance.now();
        if(job.sharedOnly)this.applySharedWorkerResult(job,message.mesh);
        else{
          const existing=this.chunkCache.get(this.chunkKey(job.id,job.lod));
          if(!existing||existing.dirtyCore){
            const record=this.replaceChunk(job.id,job.lod,message.mesh);
            this.stats.builds++;
            this.saveToDisk(record);
          }
        }
        this.stats.workerBuilds++;
        this.stats.workerTimeMs+=Number(message.elapsed||0);
        this.stats.workerUploadMs+=performance.now()-started;
        this.evictUnused();
        this.requestLater();
      }else this.stats.workerStaleResponses++;
      this.refreshWorldGeometryComplete();
      this.scheduleCompletedUpload();
      this.scheduleIdleChunk();
    };
    if(typeof requestIdleCallback==='function')
      requestIdleCallback(task,{timeout:180});
    else setTimeout(()=>task({timeRemaining:()=>12,didTimeout:true}),25);
  }
  refreshWorldGeometryComplete(){
    const lod=this.lastLod||FIXED_TERRAIN_STEPS;
    this.worldGeometryComplete=this.pendingChunks.length===0 &&
      !this.meshWorkerBusy&&!this.diskReadBusy&&this.completedUploads.length===0 &&
      [...this.knownChunkIds].every(id=>{
        const resident=this.chunkCache.get(this.chunkKey(id,lod));
        return Boolean(resident&&!resident.dirtyShared&&!resident.dirtyCore);
      });
    return this.worldGeometryComplete;
  }
  queueBuilds(visible,lod){
    // The geometry residency workset is always discovered-world based, even
    // while the current submap/database read is still hydrating. Waiting for
    // hydration controls WHEN jobs are allowed to run, not WHICH chunks are
    // prepared. Previously "temporary fallback" queued only camera-visible
    // chunks, causing new terrain to pop in after every close-zoom pan.
    const plan=planWorldGeometry({
      knownIds:this.knownChunkIds,visibleIds:visible,lod,
      maxChunks:MAX_CHUNKS,
      anchor:this.focusChunk||{cx:0,cy:0},
      prepareBackground:true,
      resident:(id,steps)=>this.chunkCache.get(this.chunkKey(id,steps))
    });
    this.activeChunkIds=plan.active;
    this.stats.prefetchTarget=plan.background;
    this.pendingChunks=plan.jobs;
    this.refreshWorldGeometryComplete();
    this.scheduleIdleChunk();
  }
  scheduleIdleChunk(){
    if(this.debugFreezeBackground)return;
    // During wheel/drag gestures, rendering already-resident geometry takes
    // priority. No disk read, mesh construction or disposal should contend
    // with the user's camera interaction. The settled redraw resumes work.
    if(typeof IsoMapper!=='undefined'&&IsoMapper.interacting)return;
    // The background worker owns CPU-intensive terrain construction.
    // GPU objects are uploaded on the UI thread only after worker completion.
    if(this.ensureMeshWorker() && !this.meshWorkerReady)return;
    if(window.TribeNetKnowledge && !window.TribeNetKnowledge.ready()){
      this.stats.knowledgePending=window.TribeNetKnowledge.pending();
      window.TribeNetKnowledge.ensure?.();
      return;
    }
    this.stats.knowledgePending=0;
    if(this.idleBuildPending || this.diskReadBusy || this.meshWorkerBusy || this.completedUploads.length || !this.pendingChunks.length || !this.visible)return;
    const revision=this.generation;
    this.idleBuildPending=true;
    const task=(deadline)=>{
      this.idleBuildPending=false;
      if(this.debugFreezeBackground)return;
      if(revision!==this.generation){
        this.scheduleIdleChunk();return;
      }
      if(!this.visible||!this.pendingChunks.length)return;
      if(typeof IsoMapper!=='undefined'&&IsoMapper.interacting)return;
      if(window.TribeNetKnowledge&&!window.TribeNetKnowledge.ready())return;
      if(deadline && deadline.timeRemaining()<3 && !deadline.didTimeout){
        this.scheduleIdleChunk();return;
      }
      const next=this.pendingChunks.shift();
      if(!next){
        this.scheduleIdleChunk();return;
      }
      if(next.sharedOnly && !this.meshWorkerReady){
        try{
          this.refreshSharedChunk(next.id,next.lod);
          this.requestLater();
        }catch(error){
          this.failed=true;this.failureReason='Border geometry: '+(error?.message||String(error));
          console.error('GPU border mesh update failed:',error);
          this.setVisible(false);
        }
        this.scheduleIdleChunk();return;
      }
      if(!next.sharedOnly){
        const existing=this.chunkCache.get(this.chunkKey(next.id,next.lod));
        if(existing&&!existing.dirtyCore){
          this.scheduleIdleChunk();return;
        }
      }
      // Try durable geometry before recalculating triangles or scenery.
      // A disk miss is remembered so the NEXT idle slice generates it instead
      // of repeatedly asking the filesystem. Reads are asynchronous.
      const key=this.persistentKey(next.id,next.lod);
      const reader=window.tribenet?.loadTerrainMesh;
      // A shared-only transition owns the existing immutable core buffer.
      // Restoring a full disk mesh here would overwrite the core, or worse,
      // discard the pending border update when a valid cache entry exists.
      if(!next.sharedOnly &&
         !this.chunkCache.get(this.chunkKey(next.id,next.lod))?.dirtyCore &&
         key && typeof reader==='function' && !this.diskMissKeys.has(key)){
        this.diskReadBusy=true;
        const restoredAt=performance.now();
        Promise.resolve().then(()=>reader(key)).then(data=>{
          if(this.debugFreezeBackground){
            this.pendingChunks.unshift(next);
            this.recordTerrainEvent('disk-restore-deferred',{id:next.id});
            return;
          }
          if(window.TribeNetKnowledge && !window.TribeNetKnowledge.ready()){
            // Keep the request rather than uploading a mesh against a stale
            // world snapshot while neighbouring submaps are still arriving.
            this.pendingChunks.unshift(next);
            return;
          }
          if(data && this.persistentKey(next.id,next.lod)===key &&
            this.activeChunkIds.has(next.id) &&
            !this.chunkCache.has(this.chunkKey(next.id,next.lod))){
            this.restoreChunk(next.id,next.lod,data);
            this.diskStats.diskHits++;this.stats.restorationMs+=performance.now()-restoredAt;
            this.evictUnused();this.requestLater();
          }else if(!data){
            this.diskStats.diskMisses++;this.diskMissKeys.add(key);
            this.pendingChunks.unshift(next);
          }
        }).catch(error=>{
          this.diskStats.diskErrors++;this.diskMissKeys.add(key);
          this.pendingChunks.unshift(next);
          console.warn('Terrain cache restore failed; rebuilding:',error);
        }).finally(()=>{
          this.diskReadBusy=false;
          this.refreshWorldGeometryComplete();
          this.scheduleIdleChunk();
        });
        return;
      }
      if(this.meshWorker && this.meshWorkerReady){
        if(this.meshWorkerBusy){this.pendingChunks.unshift(next);return;}
        this.meshWorkerBusy=true;
        next.requestId=++this.workerRequestSerial;
        this.meshWorkerJob=next;
        this.meshWorker.postMessage({type:'build',requestId:next.requestId,
          id:next.id,lod:next.lod,
          sharedOnly:next.sharedOnly,revision:this.worldKnowledgeRevision});
        return;
      }
      try{
        // If terrain knowledge changed during an async read, never upload the
        // stale generated mesh. queueBuilds will schedule the new fingerprint.
        const started=performance.now();
        this.terrainChunk(next.id,next.lod);
        this.stats.terrainMs+=performance.now()-started;
        this.evictUnused();this.requestLater();
      }catch(error){
        this.failed=true;this.failureReason='Terrain geometry: '+(error?.message||String(error));
        console.error('GPU terrain chunk generation failed:',error);
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
    if(this.debugFreezeBackground)return;
    // Camera scale and camera centre do not determine residency. Known world
    // geometry remains resident until an actual measured memory limit is hit.
    // All eviction happens at allocation time, never during a camera frame.
    if(!this.residency.overBudget(this.chunkCache.size))return;
    for(const record of this.residency.candidates(
      this.chunkCache,this.visibleChunkIds,this.activeChunkIds)){
      if(!this.residency.overBudget(this.chunkCache.size))break;
      this.disposeChunk(record,'lru');
      this.chunkCache.delete(record.key);
    }
  }
  beginFrame(tiles,groundFaces,sample,state,onDraw,tileAt){
    if(!this.init())return false;
    this.frameStartedAt=performance.now();
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
    const knowledgeComplete=window.TribeNetKnowledge?.complete?.()!==false;
    if(knowledgeComplete&&!this.hydrationPreviouslyComplete)
      this.persistHydratedMeshes();
    this.hydrationPreviouslyComplete=knowledgeComplete;
    const visible=window.TerrainVisibility?.visibleChunks({
      knownIds:this.knownChunkIds,
      actualVisible:new Set(tiles.map(chunkId)),
      actualZoom:state.scale,
      width:this.viewportW,
      height:this.viewportH,
      cameraX:state.cameraX,cameraY:state.cameraY,
      chunkSize:CHUNK_SIZE,totalCols:TOTAL_COLS,totalRows:TOTAL_ROWS,
      unproject:window.IsoGeometry.unproject
    })||new Set(tiles.map(chunkId));
    // Only the fixed-zoom envelope is protected against memory eviction.
    // Rendering existing resident meshes is separate from residency priority.
    // This ensures distant meshes can still be reclaimed under real pressure.
    const protectedVisible=new Set(visible);
    // Keep every resident discovered mesh enabled, regardless of camera zoom,
    // camera centre or the delayed post-drag redraw. THREE performs actual
    // frustum culling for the camera; do not use the workset envelope as a
    // second visibility switch. That switch caused terrain to disappear on
    // the 150ms settle redraw even though geometry was still resident.
    // Actual memory pressure remains governed by the residency policy.
    for(const record of this.chunkCache.values())
      if(record.known)visible.add(record.id);
    this.worldChunksPinned=true;
    this.visibleChunkIds=protectedVisible;
    // Camera movement never changes the world-wide preparation targets.
    // The static Visibility Zoom Lock affects what is drawn/pinned, while
    // every discovered chunk is prepared once independent of zoom.
    if(!this.worldGeometryComplete){
      // Only preparation needs a focus neighbourhood, sorted viewport list
      // or streaming signature. Once known geometry is complete, frame time
      // belongs to camera projection and already-resident mesh visibility.
      const interacting=typeof IsoMapper!=='undefined'&&IsoMapper.interacting;
      if(!interacting){
        // The work queue is constructed once per knowledge/hydration revision.
        // Moving the camera does not reorder or recreate background jobs;
        // it changes only which already-prepared objects are visible.
        const signature=this.worldKnowledgeRevision+':'+lod;
        // World preparation depends on terrain revision and mesh fidelity,
        // not camera zoom, viewport area or provisional hydration status.
        if(signature!==this.queueSignature){
          this.updateFocusArea();
          this.queueSignature=signature;
          this.queueBuilds(visible,lod);
        }else if(this.pendingChunks.length){
          this.scheduleIdleChunk();
        }
      }
    }
    // Rendering only toggles scene visibility. No cache rebuilds, disk reads,
    // cache-order mutations or memory disposal are allowed in this path.
    const nextShown=new Set();
    let faces=0,trees=0,chunks=0;
    for(const id of visible){
      const record=this.chunkCache.get(this.chunkKey(id,lod));
      if(!record)continue;
      if(!record.group.visible){record.group.visible=true;this.stats.shownChunkEvents++;}
      record.lastUsed=++this.renderSerial;
      nextShown.add(record.key);
      faces+=record.faces;trees+=record.trees;chunks++;
    }
    for(const key of this.shownRecords)if(!nextShown.has(key)){
      const record=this.chunkCache.get(key);
      if(record?.group.visible){record.group.visible=false;this.stats.hiddenChunkEvents++;}
    }
    this.shownRecords=nextShown;
    this.stats.chunks=chunks;this.stats.faces=faces;this.stats.trees=trees;
    if(this.terrainRecorder.active&&performance.now()-this.lastRecordedFrame>150){
      this.lastRecordedFrame=performance.now();this.recordTerrainEvent('camera-frame');
    }
    return true;
  }
  pick(x,y){
    if(!this.initialized||!this.visible)return null;
    const canvas=document.getElementById('mapCanvas');
    const rect=canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return null;
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(2*x/rect.width-1,1-2*y/rect.height),this.camera);
    const objects=[...this.chunkCache.values()].filter(chunk=>chunk.group.visible)
      .flatMap(chunk=>chunk.shared?[chunk.ground,chunk.shared]:[chunk.ground]);
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
    // A stationary unit is grounded once per actual terrain revision, not on
    // every camera frame. The generated world mesh is invariant under zoom.
    const radius=m.kind==='carts'?.145:m.kind==='horses'||m.mounted?.115:.085;
    const key=this.groundRevision+':'+m.x.toFixed(5)+':'+m.y.toFixed(5)+':'+radius;
    const cached=this.groundHeightCache.get(key);
    if(cached!==undefined)return cached;
    this.stats.groundCalculations++;
    const originHeight=Number.isFinite(m.z)?m.z:0;
    // Terrain mesh vertices are derived from the deterministic analytical
    // surface. Sampling the miniature footprint is sufficient to place units,
    // and costs O(9) rather than nine raycasts through thousands of triangles.
    // Mesh raycasting here used to cause >1 second pauses when 4x4 geometry
    // batches were visible at close zoom.
    const positions=[[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius],
      [-radius*.7,-radius*.7],[radius*.7,-radius*.7],
      [-radius*.7,radius*.7],[radius*.7,radius*.7]];
    let highest=originHeight;
    for(const [dx,dy] of positions){
      const analytic=this.sampleTerrain?.(m.x+dx,m.y+dy)?.z;
      if(Number.isFinite(analytic))highest=Math.max(highest,analytic);
    }
    // The rendered ground consists of flat triangles interpolating nearby
    // height samples; leave a small clearance against local interpolation.
    highest+=.025;
    if(this.groundHeightCache.size>2500)this.groundHeightCache.clear();
    this.groundHeightCache.set(key,highest);
    return highest;
  }
  addModel(m){if(m && Number.isFinite(m.x)&&Number.isFinite(m.y))this.units.push(m);}
  updateUnits(){
    const signature=this.groundRevision+'|'+this.units.map(m=>
      [m.kind,m.x,m.y,m.z,m.mounted,m.heading].join(':')).join('|');
    if(signature===this.lastUnitSignature){
      this.stats.cameraOnlyFrames++;
      return;
    }
    this.lastUnitSignature=signature;
    this.stats.unitBufferRebuilds++;
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
    this.stats.frameMs=performance.now()-this.frameStartedAt;
    this.stats.maxFrameMs=Math.max(this.stats.maxFrameMs,this.stats.frameMs);
  }
  noteCompleteFrame(elapsed){
    this.stats.fullFrameMs=elapsed;
    this.stats.fullFramePeak=Math.max(this.stats.fullFramePeak||0,elapsed);
    this.completeFrameTimes.push(elapsed);
    if(this.completeFrameTimes.length>240)this.completeFrameTimes.shift();
  }
  getStats(){
    const sorted=[...this.completeFrameTimes].sort((a,b)=>a-b);
    const percentile=p=>sorted.length?sorted[Math.ceil(sorted.length*p)-1]:0;
    const readyKnown=[...this.knownChunkIds].filter(id=>{
      const resident=this.chunkCache.get(this.chunkKey(id,this.lastLod));
      return Boolean(resident&&!resident.dirtyShared&&!resident.dirtyCore);
    }).length;
    const neededVisible=[...this.visibleChunkIds].filter(id=>this.knownChunkIds.has(id));
    const missingVisible=neededVisible.filter(id=>
      !this.chunkCache.has(this.chunkKey(id,this.lastLod))).length;
    return {...this.stats,...this.diskStats,fullFrameP95:percentile(.95),
      fullFrameP99:percentile(.99),
      readyKnownChunks:readyKnown,
      missingKnownChunks:this.knownChunkIds.size-readyKnown,
      lockedVisibleChunks:neededVisible.length,missingVisibleChunks:missingVisible,
      terrainSubdivisions:FIXED_TERRAIN_STEPS,
    unitModelScale:UNIT_MODEL_SCALE,cachedChunks:this.chunkCache.size,
    residentBytes:this.residency.bytes,limitBytes:this.residency.maxBytes,
    knownChunkTargets:this.knownChunkIds.size,chunkSize:CHUNK_SIZE,
    visibilityZoom:window.TerrainVisibility?.get?.()??0,
    worldChunksPinned:this.worldChunksPinned,
    terrainCullingDisabled:this.debugDisableTerrainCulling,
    terrainBackgroundFrozen:this.debugFreezeBackground,
    terrainRecording:this.terrainRecorder.active,
    worldGeometryComplete:this.worldGeometryComplete,
    queuedChunks:this.pendingChunks.length};}
}
window.TribeNetGPU=new GPUMap();

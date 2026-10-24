/* GPU terrain renderer for TribeNet's existing deterministic world-space map.
 * Terrain, water, forests and unit miniatures are WebGL. The regular map
 * canvas remains a transparent interaction/label/planning overlay.
 * This file is bundled locally with Three.js; no CDN or remote assets.
 */
import * as THREE from 'three';

const CHUNK_SIZE=4;
const MAX_CHUNKS=160;
const PREFETCH_RING=1;
const INITIAL_LOD=4;
const baseTreeTrunk=new THREE.CylinderGeometry(.012,.017,.20,5);
const baseTreeCrown=new THREE.ConeGeometry(.095,.24,6);
const unitBox=new THREE.BoxGeometry(.12,.12,.085);
const unitHead=new THREE.IcosahedronGeometry(.045,0);
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
    this.groundFaces=null;this.sampleTerrain=null;this.tileAt=null;this.lastLod=4;
    this.requestDraw=null;this.pendingFrame=false;this.stats={chunks:0,faces:0,trees:0,builds:0,gpuCalls:0,renderMs:0};
    this.meshMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,depthWrite:true});
    this.waveMaterial=new THREE.LineBasicMaterial({color:0xc8e9d9,transparent:true,opacity:.58,depthWrite:false});
    this.treeMaterials={
      trunk:new THREE.MeshLambertMaterial({color:0x70523a,side:THREE.DoubleSide}),
      broad:new THREE.MeshLambertMaterial({color:0x668851,side:THREE.DoubleSide}),
      conifer:new THREE.MeshLambertMaterial({color:0x477b58,side:THREE.DoubleSide}),
      body:new THREE.MeshLambertMaterial({color:0xffffff}),
      head:new THREE.MeshLambertMaterial({color:0xffffff}),
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
  }
  disposeChunk(record){
    this.chunkGroup?.remove(record.group);
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
  lod(scale){
    const requested=terrainSetting('meshQuality',16);
    return scale<25?2:scale<44?4:scale<75?8:scale<115?12:Math.min(32,requested);
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
        if(typeof IsoUnits!=='undefined' && IsoUnits.occupies(t.ref,x-t.c.x,y-t.c.y))continue;
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
  terrainChunk(id,lod){
    const [cx,cy]=id.split(':').map(Number),cells=[];
    for(let col=cx*CHUNK_SIZE;col<(cx+1)*CHUNK_SIZE;col++)
      for(let row=cy*CHUNK_SIZE;row<(cy+1)*CHUNK_SIZE;row++)
        if(col>=0&&row>=0&&col<TOTAL_COLS&&row<TOTAL_ROWS)cells.push(this.tileAt(col,row));
    const result=this.newChunk(cells,this.groundFaces,this.sampleTerrain,lod);
    const record={...result,key:this.chunkKey(id,lod),id,lod};
    this.chunkCache.set(record.key,record);this.chunkGroup.add(record.group);
    this.stats.builds++;
    return record;
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
    this.activeChunkIds=ring;
    const tasks=[],reserved=new Set();
    const add=(id,detail)=>{
      const key=this.chunkKey(id,detail);
      if(!this.chunkCache.has(key)&&!reserved.has(key)){
        tasks.push({id,lod:detail});reserved.add(key);
      }
    };
    // First fill holes at the cheapest usable resolution, then sharpen visible
    // chunks, and only then warm the adjacent ring.
    for(const id of visible)if(!this.bestResident(id,lod))add(id,Math.min(INITIAL_LOD,lod));
    for(const id of visible)add(id,lod);
    for(const id of ring)if(!visible.has(id) && !this.bestResident(id,lod))add(id,Math.min(INITIAL_LOD,lod));
    for(const id of ring)if(!visible.has(id))add(id,lod);
    // Warm the immediate zoom-out class for visible tiles so crossing a zoom
    // boundary doesn't require constructing every chunk in a single gesture.
    const previousLod=lod<=4?2:lod<=8?4:8;
    for(const id of visible)add(id,previousLod);
    this.pendingChunks=tasks;
    this.scheduleIdleChunk();
  }
  scheduleIdleChunk(){
    if(this.idleBuildPending || !this.pendingChunks.length || !this.visible)return;
    const revision=this.generation;
    this.idleBuildPending=true;
    const task=(deadline)=>{
      this.idleBuildPending=false;
      if(revision!==this.generation){
        this.scheduleIdleChunk();return;
      }
      if(!this.visible||!this.pendingChunks.length)return;
      if(deadline && deadline.timeRemaining()<3 && !deadline.didTimeout){
        this.scheduleIdleChunk();return;
      }
      const next=this.pendingChunks.shift();
      if(!next || this.chunkCache.has(this.chunkKey(next.id,next.lod))){
        this.scheduleIdleChunk();return;
      }
      try{
        this.terrainChunk(next.id,next.lod);
        this.evictUnused();
        this.requestLater();
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
    this.groundFaces=groundFaces;this.sampleTerrain=sample;this.tileAt=tileAt;
    const visible=new Set(tiles.map(chunkId));
    this.visibleChunkIds=visible;
    // Only rebuild a queue when the requested chunk set or LOD actually
    // changes, not on every small camera delta or unit animation.
    const signature=lod+'|'+[...visible].sort().join('|');
    if(signature!==this.queueSignature){
      this.queueSignature=signature;
      this.generation++;
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
    if(!intersection)return null;
    return {x:intersection.point.x/1.5,y:intersection.point.z/1.5};
  }
  addModel(m){if(m && Number.isFinite(m.x)&&Number.isFinite(m.y))this.units.push(m);}
  updateUnits(){
    const kinds={body:[],head:[],horse:[],cart:[]};
    const personColor=m=>m.kind==='warriors'?0xb7614e:m.kind==='actives'?0x4c9f95:0xd4b86c;
    for(const m of this.units){
      const p=position(m),mounted=m.mounted;
      if(m.kind==='horses'||mounted)kinds.horse.push({p:[p[0],p[1]+.095,p[2]],scale:[1,1,1],color:0xa87a4c,heading:m.heading||0});
      if(m.kind==='carts'){kinds.cart.push({p:[p[0],p[1]+.08,p[2]],scale:[1,1,1],color:0xa77945,heading:m.heading||0});continue;}
      if(m.kind==='horses')continue;
      kinds.body.push({p:[p[0],p[1]+(mounted?.24:.125),p[2]],scale:[.70,1,.75],color:personColor(m),heading:m.heading||0});
      kinds.head.push({p:[p[0],p[1]+(mounted?.32:.23),p[2]],scale:[.7,.7,.7],color:0xe2bd92,heading:m.heading||0});
    }
    const geometries={body:unitBox,head:unitHead,horse:horseBox,cart:cartBox};
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
        this.object.rotation.set(0,-item.heading,0);
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
  getStats(){return {...this.stats,cachedChunks:this.chunkCache.size,queuedChunks:this.pendingChunks.length};}
}
window.TribeNetGPU=new GPUMap();

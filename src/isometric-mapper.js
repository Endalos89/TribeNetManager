/* Software-rendered 3D meshes through an orthographic isometric camera.
   Kept alongside the existing renderer so all map tools share one state. */
const IsoMapper = (() => {
  const G=IsoGeometry, WATER='#337f98', FOG='#253640';
  let enabled=false, labels=true, grid=false;
  const detailCache=new Map(), surfaceCache=new Map(), groundCache=new Map();
  let interactive=false, settleTimer=null, hitScale=1, sceneBuilds=0;
  let unitSignature='', terrainSignature='', frameRect=null, hitFaces=[], hitOffset={x:0,y:0}, renderCtx=ctx, landscape=null;
  function sample(x,y) {
    // Quantisation gives the two owners of a shared edge exactly the same vertex.
    x=Math.round(x*1e6)/1e6;y=Math.round(y*1e6)/1e6;
    const key=`${x}:${y}`;
    if(!surfaceCache.has(key))surfaceCache.set(key,G.surface(x,y,(col,row)=>col<0||row<0||col>=TOTAL_COLS||row>=TOTAL_ROWS?null:state.hexCache.get(coordinateFor(col,row)),color));
    return surfaceCache.get(key);
  }
  function prepareSurface() {
    const signature=Array.from(state.hexCache,([ref,data])=>`${ref}:${data.terrain}:${data.notes||''}`).join('|');
    if(signature!==terrainSignature){terrainSignature=signature;surfaceCache.clear();groundCache.clear();landscape=null;}
  }
  const isWater=t=>t==='O'||t==='L';
  const known=d=>d && d.terrain && d.terrain!=='UNKNOWN';
  const color=t=>terrainStyle[t]?.[0] || FOG;
  function withProjection(fn) {const previous=frameRect;frameRect=canvas.getBoundingClientRect();try{return fn();}finally{frameRect=previous;}}
  function project(p,z=null) {
    const r=frameRect||canvas.getBoundingClientRect(), q=G.project(p.x-state.cameraX,p.y-state.cameraY,z??sample(p.x,p.y).z);
    return {x:r.width/2+q.x*state.scale,y:r.height/2+q.y*state.scale};
  }
  function inverse(x,y) {
    const r=canvas.getBoundingClientRect(),q=G.unproject((x-r.width/2)/state.scale,(y-r.height/2)/state.scale);
    return {x:q.x+state.cameraX,y:q.y+state.cameraY};
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
    const rand=G.random(ref),items=Array.from({length:9},()=>({x:(rand()-.5)*.96,y:(rand()-.5)*.96,size:.7+rand()*.6,variant:rand()}));
    if(detailCache.size>6000) detailCache.clear();detailCache.set(ref,items);return items;
  }
  function adjacent(col,row) {return G.directions.map(d=>{const n=stepHex({globalCol:col,globalRow:row},d);return n?state.hexCache.get(n.coordinate):null;});}
  function tile(col,row) {
    const ref=coordinateFor(col,row),data=state.hexCache.get(ref),c=baseCenter(col,row),n=adjacent(col,row);
    return {ref,data,c,n,col,row,known:known(data),water:isWater(data?.terrain),p:project(c)};
  }
  function groundFaces(t) {
    const steps=state.scale<28?2:state.scale<90?4:6,key=`${t.ref}:${steps}`;
    if(groundCache.has(key))return groundCache.get(key);
    const faces=[];
    if(!t.known){faces.push({points:G.corners.map(p=>({...offset(t.c,p),z:sample(t.c.x+p.x,t.c.y+p.y).z})),color:FOG});}
    else if(t.water){faces.push({points:G.corners.map(p=>offset(t.c,p,1,0)),color:WATER});}
    else {
      const vertex=(a,b,u,v)=>sample(t.c.x+(a.x*u+b.x*v)/steps,t.c.y+(a.y*u+b.y*v)/steps);
      const add=points=>{
        const [a,b,c]=points,ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
        const light=Math.max(.78,Math.min(1.13,(.94+(-nx*.35-ny*.28)/len)));
        const mixed=G.mix(points.map(p=>p.color));
        const shade=points.every(p=>p.water)?WATER:'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(mixed.slice(i,i+2),16)*light)).toString(16).padStart(2,'0')).join('');
        faces.push({points,color:t.known?shade:FOG});
      };
      for(let i=0;i<6;i++){
        const a=G.corners[i],b=G.corners[(i+1)%6];
        for(let u=0;u<steps;u++)for(let v=0;v<steps-u;v++){
          add([vertex(a,b,u,v),vertex(a,b,u+1,v),vertex(a,b,u,v+1)]);
          if(u+v<steps-1)add([vertex(a,b,u+1,v),vertex(a,b,u+1,v+1),vertex(a,b,u,v+1)]);
        }
      }
    }
    groundCache.set(key,faces);return faces;
  }
  function pick(x,y) {
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
  function tree(p,size,conifer,shade) {
    const base=p.z??.14;
    line([{...p,z:base},{...p,z:base+.4*size}],'#665238',Math.max(1.3,state.scale*.037));
    if(!conifer){
      const ring=G.corners.map(v=>offset(p,v,.24*size,base+.4*size)),top={...p,z:base+.75*size},bottom={...p,z:base+.14*size};
      for(let i=0;i<6;i++){mesh([ring[i],ring[(i+1)%6],top],i<3?shade:G.mix([shade,'#244a32']));mesh([ring[i],ring[(i+1)%6],bottom],G.mix([shade,'#244a32']));}
      return;
    }
    const count=2;
    for(let k=0;k<count;k++){
      const z=base+.19+k*.22*size,r=(conifer?.19:.24)*size*(1-k*.25),peak={...p,z:z+(conifer?.47:.38)*size};
      const ring=G.corners.map(v=>offset(p,v,r,z));
      for(let i=0;i<6;i++)mesh([ring[i],ring[(i+1)%6],peak],i<3?shade:G.mix([shade,'#163b30']));
    }
  }
  function mountain(p,size,snow,volcanic) {
    const base=p.z??.14,ring=G.corners.map(v=>offset(p,v,.38*size,base+.02)),peak={...p,z:base+.02+.95*size};
    for(let i=0;i<6;i++) {
      const a=ring[i],b=ring[(i+1)%6];mesh([a,b,peak],i<3?'#8f9581':'#666f61');
      if(snow){const lerp=v=>({x:peak.x+(v.x-peak.x)*.32,y:peak.y+(v.y-peak.y)*.32,z:peak.z+(v.z-peak.z)*.32});mesh([lerp(a),lerp(b),peak],i<3?'#eff5e9':'#cfdfdc');}
    }
    if(volcanic)line([{...p,x:p.x-.06,z:peak.z-.09},peak,{...p,x:p.x+.08,z:peak.z-.11}],'#cb704d',2);
  }
  function sceneryVisible(t,x,y) {
    return !IsoUnits.occupies(t.ref,x-t.c.x,y-t.c.y) && G.sceneryVisible(x-t.c.x,y-t.c.y,t.n.map(known));
  }
  function scenery(t,jobs) {
    if(!t.known)return;
    const terrain=t.data.terrain,items=details(t.ref),{c}=t;
    const plant=(x,y,size)=>{
      if(!sceneryVisible(t,x,y))return;
      const p=sample(x,y);if(p.water)return;
      jobs.push({y:p.y,draw:()=>tree(p,size,terrain==='CH'||terrain==='LCM',terrain.startsWith('J')?'#3c8851':'#688e40')});
    };
    if(t.water){
      if(state.scale>20)for(const a of items.slice(0,3))line([{x:c.x+a.x,y:c.y+a.y,z:.015},{x:c.x+a.x+.16,y:c.y+a.y,z:.015}],'#76b0be66',1);
      return;
    }
    if(state.scale<22)return;
    if(/ALPS|HSM|L.M/.test(terrain))for(const a of items.slice(0,2)){
      const p=sample(c.x+a.x*.7,c.y+a.y*.7);if(!sceneryVisible(t,p.x,p.y))continue;
      jobs.push({y:p.y,draw:()=>mountain(p,a.size*(terrain==='ALPS'?1.1:.8),/ALPS|HSM|LSM/.test(terrain),terrain==='LVM')});
    }
    if(G.isForest(terrain)) {
      for(const a of items.slice(0,terrain==='JG'?8:6))plant(c.x+a.x,c.y+a.y,a.size*.85);
      // Populate the corridor right up to a matching neighbour. The opposite
      // bank fills its half, giving continuous canopy without duplicate trees.
      for(let i=0;i<6;i++)if(t.n[i]?.terrain===terrain){
        const a=G.corners[i],b=G.corners[(i+1)%6],rand=G.random(`${t.ref}:forest:${i}`);
        for(let k=0;k<3;k++){
          const u=.18+k*.29+(rand()-.5)*.10,r=.86+rand()*.12;
          plant(c.x+(a.x*(1-u)+b.x*u)*r,c.y+(a.y*(1-u)+b.y*u)*r,.65+rand()*.3);
        }
      }
    } else if(!G.isHill(terrain) && !/ALPS|HSM|L.M/.test(terrain)){
      for(const a of items.slice(0,5)){
        const p=sample(c.x+a.x,c.y+a.y);if(!sceneryVisible(t,p.x,p.y))continue;
        if(terrain==='SW')line([p,{...p,x:p.x+.22}],WATER,state.scale*.07);
        else if(terrain==='BR')jobs.push({y:p.y,draw:()=>tree(p,.35,false,'#7d9551')});
        else line([p,{...p,x:p.x+.05,z:p.z+.06},{...p,x:p.x+.11}],terrain==='DE'?'#b69958':'#6d8b4a',1);
      }
    }
  }
  function edges(t,fogOnly=false) {
    if(!t.known)return;
    const local=G.rivers(t.data);
    for(let i=0;i<6;i++) {
      const a=G.corners[i],b=G.corners[(i+1)%6],neighbour=t.n[i];
      const edgePoint=(u,r=1)=>sample(t.c.x+(a.x*(1-u)+b.x*u)*r,t.c.y+(a.y*(1-u)+b.y*u)*r);
      if(!known(neighbour) && fogOnly){
        // Follow the same sampled surface as the ground so the fog has no gaps.
        for(let k=0;k<6;k++)mesh([edgePoint(k/6,.67),edgePoint((k+1)/6,.67),edgePoint((k+1)/6,1),edgePoint(k/6,1)],FOG);
      } else if(!fogOnly && known(neighbour) && (local.has(G.directions[i]) || G.rivers(neighbour).has(G.directions[(i+3)%6]))) {
        if(t.water)continue;
        const points=Array.from({length:9},(_,k)=>edgePoint(k/8));
        line(points,'#7e9983',Math.max(3,state.scale*.12));line(points,WATER,Math.max(2,state.scale*.075));line(points,'#8bc5cc',Math.max(.7,state.scale*.016));
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
  function drawScene() {
    const units=IsoUnits.prepare();if(units!==unitSignature){unitSignature=units;landscape=null;}
    if(!interactive || !landscape)prepareSurface();const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    frameRect=rect;renderCtx=ctx;
    const b=bounds(),tiles=[],pad=Math.max(250,state.scale*1.7);
    for(let col=b.minCol;col<=b.maxCol;col++)for(let row=b.minRow;row<=b.maxRow;row++){
      const t=tile(col,row);if(t.p.x < -pad || t.p.x>rect.width+pad || t.p.y < -pad || t.p.y>rect.height+pad)continue;tiles.push(t);
    }
    const shift=landscape?G.project(landscape.cameraX-state.cameraX,landscape.cameraY-state.cameraY):{x:0,y:0};
    let dx=shift.x*state.scale,dy=shift.y*state.scale;
    const needsBuild=!landscape || landscape.scale!==state.scale || landscape.width!==rect.width || landscape.height!==rect.height || landscape.dpr!==dpr || Math.abs(dx)>160 || Math.abs(dy)>160;
    if(needsBuild && (!interactive || !landscape)){
      sceneBuilds++;
      const buffer=document.createElement('canvas'),padding=210;
      buffer.width=Math.ceil((rect.width+padding*2)*dpr);buffer.height=Math.ceil((rect.height+padding*2)*dpr);
      renderCtx=buffer.getContext('2d');renderCtx.setTransform(dpr,0,0,dpr,0,0);
      frameRect={width:rect.width+padding*2,height:rect.height+padding*2};
      renderCtx.fillStyle=FOG;renderCtx.fillRect(0,0,frameRect.width,frameRect.height);hitFaces=[];
      const faces=[];
      for(const t of tiles)for(const f of groundFaces(t))faces.push({...f,col:t.col,row:t.row,depth:f.points.reduce((s,p)=>s+p.y,0)/f.points.length});
      faces.sort((a,b)=>a.depth-b.depth);
      for(const f of faces){const points=f.points.map(p=>project(p,p.z));polygon(points,f.color,f.color);hitFaces.push({points,col:f.col,row:f.row});}
      const jobs=[];
      // Fog is ground cover. Visible trees and mountains are drawn above it.
      for(const t of tiles){edges(t);edges(t,true);scenery(t,jobs);}
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
      if(grid || state.selected?.coordinate===t.ref){
        const outline=G.corners.map(p=>{const q=offset(t.c,p,.98);return project(q,sample(q.x,q.y).z);});
        if(grid)polygon(outline,null,'#324a4855');
        if(state.selected?.coordinate===t.ref)polygon(outline,null,'#ffe093');
      }
      if(labels && state.scale>=43){const p=project({...t.c,y:t.c.y+.5});renderCtx.font=`${Math.min(14,Math.max(10,state.scale*.09))}px Segoe UI`;renderCtx.textAlign='center';renderCtx.lineWidth=3;renderCtx.strokeStyle='#20302bea';renderCtx.strokeText(t.ref,p.x,p.y);renderCtx.fillStyle='#f0f2dc';renderCtx.fillText(t.ref,p.x,p.y);}
      if(!t.known && state.scale>=35){renderCtx.fillStyle='#71838b';renderCtx.textAlign='center';renderCtx.font='12px Segoe UI';renderCtx.fillText('?',t.p.x,t.p.y);}
    }
    if(state.planningVisible && state.planImport?.plan)drawPlanOverlay();
    IsoUnits.drawSelectionHighlight();
    if(typeof drawResultsPlaybackOverlay==='function')drawResultsPlaybackOverlay();
    updateCenterReadout();frameRect=null;
  }
  function setEnabled(value, options = {}) {
    enabled=value;IsoUnits.resetSelection();interactive=false;clearTimeout(settleTimer);if(!value)state.scale=Math.min(68,state.scale);document.body.classList.toggle('isometric-mode',value);
    $('isoViewControls').classList.toggle('hidden',!value);
    $('openMapperButton').querySelector('h2').textContent='Mapper';
    if(value && state.scale<43)state.scale=52;
    const toggle=$('mapperViewToggle');if(toggle)toggle.checked=Boolean(value);
    showMapper({overview:options.overview !== false});
  }
  function setup() {
    $('openMapperButton').addEventListener('click',()=>setEnabled(Boolean($('mapperViewToggle')?.checked)));
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
  return {get enabled(){return enabled;},surface:sample,withProjection,project,inverse,bounds,pick,interact,get sceneBuilds(){return sceneBuilds;},draw:drawScene,setEnabled,setup};
})();
IsoMapper.setup();

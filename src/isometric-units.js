/* Deterministic groups of low-poly miniatures, anchored to the terrain surface. */
(function(root) {
  const G=root.IsoGeometry || (typeof require==='function' ? require('./isometric-core') : null);
  const tuning=root.TerrainSettings || (typeof require==='function' ? require('./terrain-settings') : null);
  const number=v=>{const n=Number(String(v??0).replace(/,/g,''));return Number.isFinite(n)?Math.max(0,n):0;};
  function composition(unit) {
    if(!unit)return null;
    const report=Boolean(unit.people || unit.resources), people=unit.people || unit.resources?.Humans || {};
    const inventory=new Map();
    const add=(name,value)=>inventory.set(String(name).toLowerCase(),number(value));
    if(report)for(const section of Object.values(unit.resources || {}))for(const [key,value] of Object.entries(section || {}))add(key,value);
    else for(const item of unit.inventory || [])add(item.item,item.quantity);
    const sum=(...keys)=>keys.reduce((n,k)=>n+(inventory.get(k)||0),0);
    const warriors=number(report?people.Warriors:unit.warrior),actives=number(report?people.Actives:unit.active),inactives=number(report?people.Inactives:unit.inactive);
    const horses=report?sum('horse','horses'):number(unit.horseCount ?? sum('horse','horses'));
    const carts=sum('cart','carts'),wagons=report?sum('wagon','wagons'):number(unit.wagonCount ?? sum('wagon','wagons'));
    // Include other people when deciding whether the entire group can ride.
    const subtotal=warriors+actives+inactives+number(report?people.Slaves:unit.slave)+number(report?people.Locals:unit.locals);
    const total=Math.max(subtotal,number(report?people.People:unit.totalPeople));
    return {warriors,actives,inactives,horses,carts:carts+wagons,mounted:total>0 && horses>=total && carts+wagons===0};
  }
  const kinds=['warriors','actives','inactives','horses','carts'];
  function modelCount(value) {
    const n=Math.floor(number(value));return n<1?0:Math.floor(Math.log10(n))+1;
  }
  function formation(counts,seed) {
    if(!counts)return [];
    const models=[];
    for(const kind of kinds)for(let i=0;i<modelCount(counts[kind]);i++)models.push({kind,mounted:counts.mounted && ['warriors','actives','inactives'].includes(kind)});
    // A single miniature sits exactly at its parent unit anchor.
    if(models.length===1)return [{...models[0],x:0,y:0}];
    // Otherwise stable golden-angle spacing keeps each unit's miniatures distinct.
    let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const phase=(hash>>>0)/4294967296*Math.PI*2;
    return models.map((m,i)=>{const a=phase+i*2.399963229728653,r=.46*Math.sqrt((i+.5)/models.length);return {...m,x:Math.cos(a)*r,y:Math.sin(a)*r};});
  }
  const drawn=new Set();let hits=[],clearings=new Set(),occupants=new Map();
  // The model formation belongs to the world, not the camera. Only project
  // its cached coordinates into screen space when zooming or panning.
  const worldModels=new Map();
  let worldModelsRevision='';
  const unitModelStats={recalculations:0,reused:0};
  function cachedWorldModels(key,create){
    if(worldModels.has(key)){
      unitModelStats.reused++;
      return worldModels.get(key);
    }
    const result=create();
    worldModels.set(key,result);
    unitModelStats.recalculations++;
    if(worldModels.size>1200){
      const first=worldModels.keys().next().value;
      worldModels.delete(first);
    }
    return result;
  }
  function record(code,snapshot) {
    if(snapshot)return snapshot;
    return (state.planImport?.plan?.unitStats || []).find(u=>String(u.unit)===String(code)) ||
      (savedMovementPlansState?.unitSplits || []).find(u=>String(u.unitCode)===String(code)) ||
      (resultsTimeline.turn?.units || []).find(u=>String(u.unitCode)===String(code)) || null;
  }
  function prepare() {
    const context=JSON.stringify([resultsTimeline.turn?.turnKey,state.planImport?.id,state.planImport?.turnKey]);
    if(selectionContext!==null && context!==selectionContext){cycle=null;state.selectedUnitHex=null;if(state.selectedUnit){state.selectedUnit=null;$('unitEditor').classList.add('hidden');if(!state.selected)$('noSelection').classList.remove('hidden');}}
    selectionContext=context;
    const refs=new Set();occupants=new Map();
    const add=(ref,code)=>{if(!ref)return;refs.add(ref);if(!occupants.has(ref))occupants.set(ref,new Set());occupants.get(ref).add(String(code));};
    const plannedOrigins=new Map();
    const historicalResults=typeof resultsTimeline!=='undefined' && resultsTimeline.turn && !resultsTimeline.turn.isPlanningTurn;
    if(state.planningVisible && state.planImport?.plan && !historicalResults){
      if(!state.routeCache)state.routeCache=buildPlanRoutes(state.planImport.plan);
      // Planned movement is represented by an arrow, while the unit model
      // remains at its origin until the turn is resolved.  Registering the
      // destination here made the same unit appear at both ends of the route.
      for(const m of state.routeCache.movements||[]){const ps=m.route?.points||[];if(ps.length){plannedOrigins.set(String(m.unit),ps[0].coordinate);add(ps[0].coordinate,m.unit);}}
    }
    for(const u of resultsTimeline.turn?.units||[])if(!plannedOrigins.has(String(u.unitCode))){
      const position=typeof resultsPlaybackUnitPosition==='function'?resultsPlaybackUnitPosition(String(u.unitCode),u.currentHex):null;
      add(position?.coordinate||u.currentHex,u.unitCode);
    }
    if(state.planningVisible && !historicalResults && typeof plannedSplitMapHex==='function') {
      for(const split of savedMovementPlansState?.unitSplits || []) add(plannedSplitMapHex(split),split.unitCode);
    }
    clearings=refs;return [...refs].sort().join('|');
  }
  // Only suppress scenery directly under a miniature.  The old .70 radius
  // cleared nearly the whole hex whenever a unit entered it, making trees and
  // terrain details disappear during movement/playback.
  function occupies(ref,x,y){return clearings.has(ref) && Math.hypot(x,y)<.18;}
  // Deterministic die-like patterns. One unit occupies the centre;
  // six use two columns x three rows, and overflow packs into balanced rows.
  const dicePatterns={
    1:[[0,0]],
    2:[[-.55,-.55],[.55,.55]],
    3:[[-.55,-.55],[0,0],[.55,.55]],
    4:[[-.55,-.55],[.55,-.55],[-.55,.55],[.55,.55]],
    5:[[-.55,-.55],[.55,-.55],[0,0],[-.55,.55],[.55,.55]],
    6:[[-.55,-.68],[.55,-.68],[-.55,0],[.55,0],[-.55,.68],[.55,.68]]
  };
  function diceSlots(count) {
    const n=Math.max(0,Math.floor(count||0));
    if(n<=6)return (dicePatterns[n]||[]).map(p=>({x:p[0],y:p[1]}));
    const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols),slots=[];
    for(let i=0;i<n;i++){
      const row=Math.floor(i/cols),inRow=Math.min(cols,n-row*cols),col=i%cols;
      slots.push({x:inRow===1?0:(col/(inRow-1)-.5)*1.15,y:rows===1?0:(row/(rows-1)-.5)*1.3});
    }
    return slots;
  }
  const ordered=values=>values.slice().sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const routePoints=route=>route?.route?.points||[];
  function moveForUnit(code,coordinate) {
    return (state.routeCache?.movements||[]).find(row=>{
      const ps=routePoints(row);
      return String(row.unit)===String(code) && ps.length>1 && ps[0].coordinate===coordinate
        && Number.isFinite(ps[0].globalCol) && Number.isFinite(ps[0].globalRow)
        && Number.isFinite(ps[1].globalCol) && Number.isFinite(ps[1].globalRow);
    })||null;
  }
  function layout(point,code,type,offset=0,extra='',snapshot=null) {
    const counts=composition(record(code,snapshot));
    const isInterpolated=Number.isFinite(point.x)&&Number.isFinite(point.y);
    const origin=isInterpolated?{x:point.x,y:point.y}:baseCenter(point.globalCol,point.globalRow);
    const move=!isInterpolated?moveForUnit(code,point.coordinate):null;
    const steps=routePoints(move),first=steps[0],next=steps[1];
    const square=first&&next?G?.sharedSquare?.(
      {col:first.globalCol,row:first.globalRow},{col:next.globalCol,row:next.globalRow}):null;
    // Transport or special orders can move more than one hex; they stay at
    // origin until playback supplies a real interpolated world position.
    const travelling=Boolean(square);
    const movementCodes=ordered((state.routeCache?.movements||[]).filter(row=>{
      const pair=routePoints(row),s=pair[0],e=pair[1];
      return s&&e&&first&&next&&
        ((s.globalCol===first.globalCol&&s.globalRow===first.globalRow&&e.globalCol===next.globalCol&&e.globalRow===next.globalRow) ||
         (e.globalCol===first.globalCol&&e.globalRow===first.globalRow&&s.globalCol===next.globalCol&&s.globalRow===next.globalRow));
    }).map(row=>String(row.unit)));
    const group=ordered([...(occupants.get(point.coordinate)||[])]);
    const stationary=group.filter(id=>!moveForUnit(id,point.coordinate));
    const slotCodes=travelling?movementCodes:(stationary.length?stationary:group);
    const slot=Math.max(0,slotCodes.indexOf(String(code)));
    const slots=diceSlots(Math.max(1,slotCodes.length));
    const target=slots[Math.min(slot,slots.length-1)];
    const scale=(tuning?.value('unitSpread')??.38)*(G?.coreRadius??.634);
    const position=travelling?square.center:origin;
    const shift=travelling?
      {x:(target.x*square.tangent.x+target.y*square.normal.x)*scale,
       y:(target.x*square.tangent.y+target.y*square.normal.y)*scale}:
      {x:target.x*scale,y:target.y*scale};
    const spread=slotCodes.length>1 ? 0.32 : 0.52;
    const heading=first&&next?
      Math.atan2(baseCenter(next.globalCol,next.globalRow).y-baseCenter(first.globalCol,first.globalRow).y,
                  baseCenter(next.globalCol,next.globalRow).x-baseCenter(first.globalCol,first.globalRow).x):null;
    const revision=[
      state.hexCache?.terrainRevision??0,
      root.resultsPlayback?.renderRevision??0,
      resultsTimeline.turn?.turnKey||'',
      tuning?.value('unitSpread')??.38
    ].join('|');
    if(worldModelsRevision!==revision){
      worldModels.clear();worldModelsRevision=revision;
    }
    const cacheKey=JSON.stringify([
      code,point.coordinate||null,position.x,position.y,
      shift.x,shift.y,spread,heading,slot,slotCodes,
      counts?.warriors,counts?.actives,counts?.inactives,
      counts?.horses,counts?.carts,counts?.mounted
    ]);
    const models=cachedWorldModels(cacheKey,()=>formation(
      counts,String(point.coordinate||'')+':'+code
    ).map(m=>{
      const x=position.x+shift.x+m.x*spread,y=position.y+shift.y+m.y*spread;
      return {...m,x,y,z:IsoMapper.surface(x,y).z,heading};
    }).sort((a,b)=>a.y-b.y));
    const labelPrefix=type==='Element'?'E':type==='Tribe'?'T':type==='Fleet'?'F':'U';
    const text=labelPrefix+' '+code+(extra?' '+extra:'');
    const anchor=IsoMapper.project({x:position.x+shift.x,y:position.y+shift.y+.56});
    // Keep labels readable without shifting the underlying physical unit anchors.
    anchor.y+=15+(slotCodes.length>1?slot*11:0);
    ctx.save();ctx.font='700 11px Segoe UI';const labelWidth=ctx.measureText(text).width+12;ctx.restore();
    const points=models.map(m=>IsoMapper.project(m,m.z)),extent=Math.max(4,state.scale*.16),height=state.scale*.43;
    const x=Math.min(anchor.x-labelWidth/2,...points.map(p=>p.x-extent));
    const y=Math.min(anchor.y-12,...points.map(p=>p.y-height));
    const right=Math.max(anchor.x+labelWidth/2,...points.map(p=>p.x+extent));
    const bottom=Math.max(anchor.y+5,...points.map(p=>p.y+4));
    return {x,y,w:right-x,h:bottom-y,anchor,text,counts,models,slot,slotCount:slotCodes.length,position,physicalRegion:travelling?'square':'hex'};
  }
  function face(vertices,color) {
    ctx.beginPath();vertices.forEach((v,i)=>{const p=IsoMapper.project(v,v.z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  function box(m,x,y,z,w,d,h,color) {
    const angle=Number.isFinite(m.heading)?m.heading:0,co=Math.cos(angle),si=Math.sin(angle);
    const p=(a,b,c)=>({x:m.x+x+a*co-b*si,y:m.y+y+a*si+b*co,z:m.z+z+c});
    const dark=IsoGeometry.mix([color,'#343e3b']),light=IsoGeometry.mix([color,color,'#e9dfbf']);
    face([p(-w/2,d/2,0),p(w/2,d/2,0),p(w/2,d/2,h),p(-w/2,d/2,h)],dark);
    face([p(w/2,-d/2,0),p(w/2,d/2,0),p(w/2,d/2,h),p(w/2,-d/2,h)],color);
    face([p(-w/2,-d/2,h),p(w/2,-d/2,h),p(w/2,d/2,h),p(-w/2,d/2,h)],light);
  }
  function horse(m) {
    for(const x of [-.078,.065])for(const y of [-.037,.037])box(m,x,y,0,.026,.026,.10,'#65503b');
    box(m,0,0,.085,.20,.085,.08,'#a87a4c');
    box(m,.078,0,.14,.04,.07,.10,'#b99160');box(m,.106,0,.21,.075,.064,.045,'#b99160');
    box(m,.092,0,.25,.015,.042,.027,'#63503b');box(m,-.11,0,.07,.025,.025,.085,'#544334');
  }
  function person(m) {
    const z=m.mounted?.15:0,color=m.kind==='warriors'?'#b7614e':m.kind==='actives'?'#4c9f95':'#d4b86c';
    if(m.mounted)horse(m);
    const size=m.kind==='inactives'?.88:1;
    m={...m,z:m.z+z};
    box(m,-.026,0,0,.023,.045,.085*size,'#3a464a');box(m,.026,0,0,.023,.045,.085*size,'#3a464a');
    box(m,0,0,.08*size,.083,.062,.105*size,color);box(m,0,0,.185*size,.053,.05,.055,'#e2bd92');
    box(m,-.055,0,.09*size,.021,.035,.075,color);box(m,.055,0,.09*size,.021,.035,.075,color);
    if(m.kind==='warriors'){
      box(m,0,0,.229*size,.066,.06,.022,'#b9c9ca');box(m,.085,0,.015,.009,.009,.29,'#d7ba7f');
      box(m,-.066,.026,.075,.058,.017,.085,'#cf9d4d');
    }else if(m.kind==='actives'){
      box(m,.077,0,.005,.009,.009,.20,'#bd9f67');box(m,.09,0,.19,.056,.017,.025,'#bdcaca');
    }else{box(m,0,0,.225*size,.078,.072,.013,'#ad8854');}
  }
  function cart(m) {
    // Face diagonally up-map. Wheels are vertical discs on their axles,
    // not screen-aligned circles painted over the wagon bed.
    const angle=Number.isFinite(m.heading)?m.heading:Math.PI/3,co=Math.cos(angle),si=Math.sin(angle);
    const p=(x,y,z)=>({x:m.x+x*co-y*si,y:m.y+x*si+y*co,z:m.z+z});
    const wheel=(x,y)=>{
      const ring=Array.from({length:20},(_,i)=>{const a=i*Math.PI/10;return p(x+Math.cos(a)*.055,y,.058+Math.sin(a)*.055);});
      face(ring,'#493f31');ctx.strokeStyle='#c6a367';ctx.lineWidth=Math.max(.7,state.scale*.009);ctx.stroke();
      const hub=IsoMapper.project(p(x,y,.058),m.z+.058);ctx.fillStyle='#d8b984';ctx.beginPath();ctx.arc(hub.x,hub.y,Math.max(.7,state.scale*.008),0,Math.PI*2);ctx.fill();
    };
    const bed=(x,y,z,w,d,h,color)=>{
      const faces=[[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y-d/2,z+h],[x-w/2,y-d/2,z+h]],
        [[x-w/2,y+d/2,z],[x+w/2,y+d/2,z],[x+w/2,y+d/2,z+h],[x-w/2,y+d/2,z+h]],
        [[x-w/2,y-d/2,z],[x-w/2,y+d/2,z],[x-w/2,y+d/2,z+h],[x-w/2,y-d/2,z+h]],
        [[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x+w/2,y+d/2,z+h],[x+w/2,y-d/2,z+h]]];
      faces.map(f=>f.map(v=>p(...v))).sort((a,b)=>a.reduce((n,v)=>n+v.y,0)-b.reduce((n,v)=>n+v.y,0)).forEach(f=>face(f,color));
      face([p(x-w/2,y-d/2,z+h),p(x+w/2,y-d/2,z+h),p(x+w/2,y+d/2,z+h),p(x-w/2,y+d/2,z+h)],IsoGeometry.mix([color,'#dfc98d']));
    };
    for(const x of [-.075,.075])wheel(x,-.086);
    bed(0,0,.09,.24,.14,.035,'#9b7449');
    bed(0,-.065,.125,.24,.018,.09,'#a77b45');bed(0,.065,.125,.24,.018,.09,'#a77b45');
    bed(-.111,0,.125,.018,.14,.09,'#bd955d');bed(.111,0,.125,.018,.14,.09,'#bd955d');
    bed(.20,0,.09,.16,.014,.014,'#cbae74');
    for(const x of [-.075,.075])wheel(x,.086);
  }
  function drawScout(point,code,modelCountValue,seed,options={}) {
    if(!point || typeof IsoMapper==='undefined' || !IsoMapper.enabled || typeof ctx==='undefined')return false;
    const count=Math.max(1,Math.min(5,Math.floor(Number(modelCountValue)||1)));
    const quantity=Math.pow(10,count-1);
    const models=formation({warriors:0,actives:quantity,inactives:0,horses:0,carts:0,mounted:true},seed||code)
      .map(m=>({...m,x:point.x+m.x,y:point.y+m.y,z:IsoMapper.surface(point.x+m.x,point.y+m.y).z,heading:options.heading}))
      .sort((a,b)=>a.y-b.y);
    if(!models.length)return false;
    if(root.TribeNetGPU?.initialized && root.TribeNetGPU.visible){
      for(const model of models)root.TribeNetGPU.addModel(model);
      return true;
    }
    const scale=typeof state!=='undefined'&&Number.isFinite(state.scale)?state.scale:50;
    for(const m of models){
      const p=IsoMapper.project(m,m.z);ctx.beginPath();ctx.ellipse(p.x,p.y,scale*.14,scale*.026,0,0,Math.PI*2);ctx.fillStyle='#142b2944';ctx.fill();
      if(m.kind==='horses')horse(m);else if(m.kind==='carts')cart(m);else person(m);
    }
    return true;
  }
  function tooltip(b) {
    if(!b.counts)return `${b.text} — composition unavailable`;
    return `${b.text} — ${kinds.map(k=>`${b.counts[k].toLocaleString()} ${k}`).join(', ')}${b.counts.mounted?' · Mounted':''}. Models: 1–9 = 1, 10–99 = 2, 100–999 = 3, etc.`;
  }
  function draw(point,code,type,offset,extra,snapshot) {
    if(!point)return;const key=`${point.globalCol}:${point.globalRow}:${code}`;
    if(drawn.has(key))return;drawn.add(key);
    const b=layout(point,code,type,offset,extra,snapshot),r=canvas.getBoundingClientRect();
    if(b.x+b.w<0 || b.x>r.width || b.y+b.h<0 || b.y>r.height)return;
    hits.push(b);
    if(root.TribeNetGPU?.initialized && root.TribeNetGPU.visible){
      b.models.forEach(model=>root.TribeNetGPU.addModel(model));
      ctx.save();
      if(String(state.selectedUnit)===String(code)){
        const p=IsoMapper.project(b.position,IsoMapper.surface(b.position.x,b.position.y).z);
        ctx.beginPath();ctx.ellipse(p.x,p.y,state.scale*.43,state.scale*.17,0,0,Math.PI*2);
        ctx.strokeStyle='#58d4ef';ctx.lineWidth=2;ctx.stroke();
      }
      ctx.font='700 11px Segoe UI';ctx.textAlign='center';ctx.textBaseline='alphabetic';
      ctx.strokeStyle='#172c29';ctx.lineWidth=3;ctx.strokeText(b.text,b.anchor.x,b.anchor.y);
      ctx.fillStyle=String(state.selectedUnit)===String(code)?'#ffffff':'#ffe4a4';
      ctx.fillText(b.text,b.anchor.x,b.anchor.y);
      ctx.restore();return;
    }
    IsoMapper.withProjection(()=>{ctx.save();
    const selected=String(state.selectedUnit)===String(code);
    const origin=Number.isFinite(point.x)&&Number.isFinite(point.y)?point:baseCenter(point.globalCol,point.globalRow);
    const center=IsoMapper.project({x:origin.x+(b.models[0]?.x-origin.x||0),y:origin.y+(b.models[0]?.y-origin.y||0)},b.models[0]?.z||0);
    if(selected){ctx.beginPath();ctx.ellipse(center.x,center.y,state.scale*.52,state.scale*.22,0,0,Math.PI*2);ctx.fillStyle='rgba(72,212,239,.22)';ctx.fill();ctx.strokeStyle='#58d4ef';ctx.lineWidth=Math.max(2.5,state.scale*.075);ctx.stroke();}
    for(const m of b.models){
      const p=IsoMapper.project(m,m.z);ctx.beginPath();ctx.ellipse(p.x,p.y,state.scale*(m.kind==='horses'||m.kind==='carts'||m.mounted?.14:.06),state.scale*.026,0,0,Math.PI*2);ctx.fillStyle='#142b2944';ctx.fill();
      if(selected){ctx.strokeStyle='#ffe18a';ctx.lineWidth=Math.max(1.5,state.scale*.035);ctx.stroke();}
      if(m.kind==='horses')horse(m);else if(m.kind==='carts')cart(m);else person(m);
    }
    ctx.font='700 11px Segoe UI';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.strokeStyle='#172c29';ctx.lineWidth=3;ctx.strokeText(b.text,b.anchor.x,b.anchor.y);ctx.fillStyle=String(state.selectedUnit)===String(code)?'#ffffff':'#ffe4a4';ctx.fillText(b.text,b.anchor.x,b.anchor.y);ctx.restore();});
  }
    let cycle=null,selectionContext=null;
  function unitsAt(ref) {
    const found=new Map();
    for(const u of resultsTimeline.turn?.units||[]) {
      const code=String(u.unitCode);
      const position=typeof resultsPlaybackUnitPosition==='function'
        ? resultsPlaybackUnitPosition(code,u.currentHex)
        : {coordinate:u.currentHex};
      if(position?.coordinate===ref)found.set(code,{code,snapshot:u});
    }
    const historicalResults=typeof resultsTimeline!=='undefined' && resultsTimeline.turn && !resultsTimeline.turn.isPlanningTurn;
    if(state.planningVisible && state.planImport?.plan && !historicalResults)for(const m of state.routeCache?.movements||[]){
      const ps=m.route?.points||[];
      if(ps[0]?.coordinate===ref || ps[ps.length-1]?.coordinate===ref){const code=String(m.unit);if(!found.has(code))found.set(code,{code,snapshot:null});}
    }
    if(state.planningVisible && !historicalResults && typeof plannedSplitMapHex==='function') {
      for(const split of savedMovementPlansState?.unitSplits || []) {
        if(plannedSplitMapHex(split)===ref && !found.has(String(split.unitCode))) found.set(String(split.unitCode),{code:String(split.unitCode),snapshot:split});
      }
    }
    return [...found.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
  }
  function nextSelection(previous,key,codes) {
    const signature=JSON.stringify([key,codes]);
    const index=previous?.signature===signature?(previous.index+1)%(codes.length+1):0;
    return {signature,index,code:codes[index]??null};
  }
  function clickHex(point) {
    const ref=coordinateFor(point.globalCol,point.globalRow),units=unitsAt(ref);
    const key=JSON.stringify([resultsTimeline.turn?.turnKey,state.planImport?.id,state.planImport?.turnKey,ref]);
    cycle=nextSelection(cycle,key,units.map(u=>u.code));
    if(cycle.code!==null){const entry=units.find(u=>u.code===cycle.code);state.selectedUnitHex=ref;state.selectedUnit=entry.code;if(typeof root.draw==='function')root.draw();window.dispatchEvent(new CustomEvent('tribenet:unit-selected',{detail:{unitCode:entry.code,hex:ref}}));requestAnimationFrame(()=>showUnitLogistics(entry.code,entry.snapshot));}
    else{state.selectedUnit=null;state.selectedUnitHex=null;$('unitEditor').classList.add('hidden');window.dispatchEvent(new CustomEvent('tribenet:unit-selected',{detail:null}));selectHex(point.globalCol,point.globalRow);}
    return units.length > 0;
  }
  function drawSelectionHighlight() {
    if(!state.selectedUnit || !state.selectedUnitHex || !IsoMapper.enabled)return;
    const point=parseCoordinate(state.selectedUnitHex);if(!point)return;
    IsoMapper.withProjection(()=>{
      const base=baseCenter(point.globalCol,point.globalRow);
      const p=IsoMapper.project(base);
      ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y,state.scale*.62,state.scale*.27,0,0,Math.PI*2);
      ctx.fillStyle='rgba(72,212,239,.12)';ctx.fill();ctx.strokeStyle='#58d4ef';ctx.lineWidth=Math.max(3,state.scale*.085);ctx.stroke();
      ctx.strokeStyle='#ffe18a';ctx.lineWidth=Math.max(1.5,state.scale*.04);ctx.stroke();ctx.restore();
    });
  }
  const api={diceSlots,resetSelection:()=>{cycle=null;},nextSelection,unitsAt,composition,modelCount,formation,layout,draw,drawScout,prepare,occupies,beginFrame:()=>{drawn.clear();hits=[];},clickHex,drawSelectionHighlight,get worldModelStats(){return {...unitModelStats,resident:worldModels.size};}};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else {
    root.IsoUnits=api;
    window.addEventListener('mouseup',e=>{
      if(state.mode!=='detail' || !state.dragging || e.button!==0)return;
      if(typeof savedMovementHandleRouteLabelClick==='function' && savedMovementHandleRouteLabelClick(e.clientX,e.clientY)){
        state.dragging=false;canvas.classList.remove('dragging');e.preventDefault();e.stopImmediatePropagation();return;
      }
      if(movementPlannerState.active){cycle=null;return;}
      if(Math.hypot(e.clientX-state.dragStart.x,e.clientY-state.dragStart.y)>=5)return;
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      if(x<0 || y<0 || x>r.width || y>r.height)return;
      const base=baseFromScreen(x,y),point=(IsoMapper.enabled ? IsoMapper.pick(x,y) : null)||nearestHex(base.x,base.y);
      if(!point)return;
      state.dragging=false;canvas.classList.remove('dragging');e.preventDefault();e.stopImmediatePropagation();clickHex(point);
    },true);
    canvas.addEventListener('mousemove',e=>{
      if(!IsoMapper.enabled || state.dragging)return;
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      const hit=[...hits].reverse().find(b=>x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
      canvas.title=hit?tooltip(hit):'';
    });
    canvas.addEventListener('mouseleave',()=>{canvas.title='';});
  }
})(typeof window!=='undefined'?window:globalThis);

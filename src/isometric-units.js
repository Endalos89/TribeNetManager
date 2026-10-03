/* Deterministic groups of low-poly miniatures, anchored to the terrain surface. */
(function(root) {
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
    // A fixed seed and golden-angle spacing keep the gathering stable and irregular.
    let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const phase=(hash>>>0)/4294967296*Math.PI*2;
    return models.map((m,i)=>{const a=phase+i*2.399963229728653,r=.46*Math.sqrt((i+.5)/models.length);return {...m,x:Math.cos(a)*r,y:Math.sin(a)*r};});
  }
  const drawn=new Set();let hits=[],clearings=new Set(),occupants=new Map();
  function record(code,snapshot) {
    if(snapshot)return snapshot;
    return (state.planImport?.plan?.unitStats || []).find(u=>String(u.unit)===String(code)) ||
      (resultsTimeline.turn?.units || []).find(u=>String(u.unitCode)===String(code)) || null;
  }
  function prepare() {
    const context=JSON.stringify([resultsTimeline.turn?.turnKey,state.planImport?.id,state.planImport?.turnKey]);
    if(selectionContext!==null && context!==selectionContext){cycle=null;state.selectedUnitHex=null;if(state.selectedUnit){state.selectedUnit=null;$('unitEditor').classList.add('hidden');if(!state.selected)$('noSelection').classList.remove('hidden');}}
    selectionContext=context;
    const refs=new Set();occupants=new Map();
    const add=(ref,code)=>{if(!ref)return;refs.add(ref);if(!occupants.has(ref))occupants.set(ref,new Set());occupants.get(ref).add(String(code));};
    for(const u of resultsTimeline.turn?.units||[])add(u.currentHex,u.unitCode);
    if(state.planningVisible && state.planImport?.plan){
      if(!state.routeCache)state.routeCache=buildPlanRoutes(state.planImport.plan);
      for(const m of state.routeCache.movements||[]){const ps=m.route?.points||[];if(ps.length){add(ps[0].coordinate,m.unit);add(ps[ps.length-1].coordinate,m.unit);}}
    }
    clearings=refs;return [...refs].sort().join('|');
  }
  function occupies(ref,x,y){return clearings.has(ref) && Math.hypot(x,y)<.70;}
  function layout(point,code,type,offset=0,extra='',snapshot=null) {
    const counts=composition(record(code,snapshot)),center=baseCenter(point.globalCol,point.globalRow);
    const group=[...(occupants.get(point.coordinate)||[])].sort(),slot=Math.max(0,group.indexOf(String(code))),multiple=group.length>1;
    const spread=multiple?.46:1,angle=slot*Math.PI*2/Math.max(1,group.length);
    const shift=multiple?{x:Math.cos(angle)*.33,y:Math.sin(angle)*.33}:{x:0,y:0};
    const movementRoute=state.routeCache?.movements?.find(row=>String(row.unit)===String(code))?.route;
    const scoutRoute=state.scoutingVisible ? state.routeCache?.scouts?.find(row=>String(row.unit)===String(code))?.route : null;
    const route=movementRoute?.points?.length>1 ? movementRoute : scoutRoute;
    const first=route?.points?.[0], next=route?.points?.[1];
    const heading=first?.coordinate===point.coordinate && next ? Math.atan2(baseCenter(next.globalCol,next.globalRow).y-baseCenter(first.globalCol,first.globalRow).y,baseCenter(next.globalCol,next.globalRow).x-baseCenter(first.globalCol,first.globalRow).x) : null;
    const travellingFromStart=first?.coordinate===point.coordinate && next;
    const travelOffset=travellingFromStart ? {x:(baseCenter(next.globalCol,next.globalRow).x-center.x)*.5,y:(baseCenter(next.globalCol,next.globalRow).y-center.y)*.5} : {x:0,y:0};
    const models=formation(counts,`${point.coordinate||''}:${code}`).map(m=>{
      const x=center.x+shift.x+travelOffset.x+m.x*spread,y=center.y+shift.y+travelOffset.y+m.y*spread;
      return {...m,x,y,z:IsoMapper.surface(x,y).z,heading};
    }).sort((a,b)=>a.y-b.y);
    const text=`${type==='Element'?'E':type==='Tribe'?'T':type==='Fleet'?'F':'U'} ${code}${extra?` ${extra}`:''}`;
    const anchor=IsoMapper.project({x:center.x+shift.x+travelOffset.x,y:center.y+shift.y+travelOffset.y+.56});
    anchor.y+=15+(multiple?slot*13:0);
    ctx.save();ctx.font='700 11px Segoe UI';const labelWidth=ctx.measureText(text).width+12;ctx.restore();
    const points=models.map(m=>IsoMapper.project(m,m.z)),extent=Math.max(4,state.scale*.16),height=state.scale*.43;
    const x=Math.min(anchor.x-labelWidth/2,...points.map(p=>p.x-extent));
    const y=Math.min(anchor.y-12,...points.map(p=>p.y-height));
    const right=Math.max(anchor.x+labelWidth/2,...points.map(p=>p.x+extent));
    const bottom=Math.max(anchor.y+5,...points.map(p=>p.y+4));
    return {x,y,w:right-x,h:bottom-y,anchor,text,counts,models};
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
  function tooltip(b) {
    if(!b.counts)return `${b.text} — composition unavailable`;
    return `${b.text} — ${kinds.map(k=>`${b.counts[k].toLocaleString()} ${k}`).join(', ')}${b.counts.mounted?' · Mounted':''}. Models: 1–9 = 1, 10–99 = 2, 100–999 = 3, etc.`;
  }
  function draw(point,code,type,offset,extra,snapshot) {
    if(!point)return;const key=`${point.globalCol}:${point.globalRow}:${code}`;
    if(drawn.has(key))return;drawn.add(key);
    const b=layout(point,code,type,offset,extra,snapshot),r=canvas.getBoundingClientRect();
    if(b.x+b.w<0 || b.x>r.width || b.y+b.h<0 || b.y>r.height)return;
    hits.push(b);IsoMapper.withProjection(()=>{ctx.save();
    const selected=String(state.selectedUnit)===String(code);
    const center=IsoMapper.project({x:baseCenter(point.globalCol,point.globalRow).x+(b.models[0]?.x-baseCenter(point.globalCol,point.globalRow).x||0),y:baseCenter(point.globalCol,point.globalRow).y+(b.models[0]?.y-baseCenter(point.globalCol,point.globalRow).y||0)},b.models[0]?.z||0);
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
    for(const u of resultsTimeline.turn?.units||[])if(u.currentHex===ref)found.set(String(u.unitCode),{code:String(u.unitCode),snapshot:u});
    if(state.planningVisible && state.planImport?.plan)for(const m of state.routeCache?.movements||[]){
      const ps=m.route?.points||[];
      if(ps[0]?.coordinate===ref || ps[ps.length-1]?.coordinate===ref){const code=String(m.unit);if(!found.has(code))found.set(code,{code,snapshot:null});}
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
    if(cycle.code!==null){const entry=units.find(u=>u.code===cycle.code);state.selectedUnitHex=ref;state.selectedUnit=entry.code;draw();requestAnimationFrame(()=>showUnitLogistics(entry.code,entry.snapshot));}
    else{state.selectedUnit=null;state.selectedUnitHex=null;$('unitEditor').classList.add('hidden');selectHex(point.globalCol,point.globalRow);}
  }
  function drawSelectionHighlight() {
    if(!state.selectedUnit || !state.selectedUnitHex || !IsoMapper.enabled)return;
    const point=parseCoordinate(state.selectedUnitHex);if(!point)return;
    IsoMapper.withProjection(()=>{
      const movementRoute=state.routeCache?.movements?.find(row=>String(row.unit)===String(state.selectedUnit))?.route;
      const scoutRoute=state.scoutingVisible ? state.routeCache?.scouts?.find(row=>String(row.unit)===String(state.selectedUnit))?.route : null;
      const route=movementRoute?.points?.length>1 ? movementRoute : scoutRoute;
      const first=route?.points?.[0],next=route?.points?.[1];
      const base=baseCenter(point.globalCol,point.globalRow);
      const c=first?.coordinate===point.coordinate&&next ? {x:(base.x+baseCenter(next.globalCol,next.globalRow).x)*.5,y:(base.y+baseCenter(next.globalCol,next.globalRow).y)*.5} : base;
      const p=IsoMapper.project(c);
      ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y,state.scale*.62,state.scale*.27,0,0,Math.PI*2);
      ctx.fillStyle='rgba(72,212,239,.12)';ctx.fill();ctx.strokeStyle='#58d4ef';ctx.lineWidth=Math.max(3,state.scale*.085);ctx.stroke();
      ctx.strokeStyle='#ffe18a';ctx.lineWidth=Math.max(1.5,state.scale*.04);ctx.stroke();ctx.restore();
    });
  }
  const api={resetSelection:()=>{cycle=null;},nextSelection,unitsAt,composition,modelCount,formation,layout,draw,prepare,occupies,beginFrame:()=>{drawn.clear();hits=[];},clickHex,drawSelectionHighlight};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else {
    root.IsoUnits=api;
    window.addEventListener('mouseup',e=>{
      if(state.mode!=='detail' || !state.dragging || e.button!==0)return;
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

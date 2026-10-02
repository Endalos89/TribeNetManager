/* Software-rendered 3D meshes through an orthographic isometric camera.
   Kept alongside the existing renderer so all map tools share one state. */
const IsoMapper = (() => {
  const G=IsoGeometry, WATER='#337f98', FOG='#253640';
  let enabled=false, labels=true, grid=false;
  const detailCache=new Map();
  const isWater=t=>t==='O'||t==='L';
  const known=d=>d && d.terrain && d.terrain!=='UNKNOWN';
  const color=t=>terrainStyle[t]?.[0] || FOG;
  function project(p,z=0) {
    const r=canvas.getBoundingClientRect(), q=G.project(p.x-state.cameraX,p.y-state.cameraY,z);
    return {x:r.width/2+q.x*state.scale,y:r.height/2+q.y*state.scale};
  }
  function inverse(x,y) {
    const r=canvas.getBoundingClientRect(),q=G.unproject((x-r.width/2)/state.scale,(y-r.height/2)/state.scale);
    return {x:q.x+state.cameraX,y:q.y+state.cameraY};
  }
  function bounds() {
    const r=canvas.getBoundingClientRect();
    const ps=[inverse(-120,-120),inverse(r.width+120,-120),inverse(-120,r.height+120),inverse(r.width+120,r.height+120)];
    return {minCol:Math.max(0,Math.floor((Math.min(...ps.map(p=>p.x))-1)/1.5)-2),maxCol:Math.min(TOTAL_COLS-1,Math.ceil(Math.max(...ps.map(p=>p.x))/1.5)+2),minRow:Math.max(0,Math.floor(Math.min(...ps.map(p=>p.y))/SQRT3)-2),maxRow:Math.min(TOTAL_ROWS-1,Math.ceil(Math.max(...ps.map(p=>p.y))/SQRT3)+2)};
  }
  function polygon(points,fill,stroke) {
    ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();}
  }
  function mesh(points,fill) {polygon(points.map(p=>project(p,p.z||0)),fill,fill);}
  function line(points,color,width) {
    ctx.beginPath(); points.forEach((p,i)=>{const q=project(p,p.z||0);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
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
  function ground(t) {
    const {c,n,data}=t,water=t.water,base=water?0:.14;
    if(!t.known){mesh(G.corners.map(p=>offset(c,p,1,0)),FOG);return;}
    const h=/ALPS|HSM|L.M/.test(data.terrain)?.34:/H|PP|PPR/.test(data.terrain)?.24:base;
    const inner=G.corners.map((p,i)=>offset(c,p,.64,h));
    // A corner belongs to this hex and the two neighbours sharing its edges.
    const outer=G.corners.map((p,i)=> {
      const neighbours=[n[i],n[(i+5)%6]];
      const wet=water || neighbours.some(d=>known(d)&&isWater(d.terrain));
      return {...offset(c,p,1,wet?0:base),wet,shade:wet?WATER:G.mix([color(data.terrain),...neighbours.filter(known).map(d=>color(d.terrain))])};
    });
    const center={...c,z:h};
    for(let i=0;i<6;i++) {
      const j=(i+1)%6;
      mesh([center,inner[i],inner[j]],water?WATER:G.mix([color(data.terrain),i<3?'#b8c49a':color(data.terrain)]));
      const coast=!water && known(n[i]) && isWater(n[i].terrain);
      if(coast) {
        // All water lies inside the land hex; the neighbouring ocean stays full.
        const a={...offset(c,G.corners[i],.79,.035)},b={...offset(c,G.corners[j],.79,.035)};
        mesh([inner[i],inner[j],b,a],'#c4bb8b');
        mesh([a,b,outer[j],outer[i]],WATER);
        line([a,b],'#9ebcae',1.3);
      } else {
        mesh([inner[i],inner[j],outer[j]],water?WATER:G.mix([color(data.terrain),outer[j].shade]));
        mesh([inner[i],outer[j],outer[i]],water?WATER:G.mix([outer[i].shade,outer[j].shade]));
      }
    }
    if(grid)polygon(G.corners.map(p=>project(offset(c,p),base)),null,'#324a4855');
  }
  function tree(p,size,conifer,shade) {
    line([{...p,z:.18},{...p,z:.55*size}],'#665238',Math.max(1.3,state.scale*.037));
    if(!conifer){
      const ring=G.corners.map(v=>offset(p,v,.24*size,.55*size)),top={...p,z:.9*size},bottom={...p,z:.29*size};
      for(let i=0;i<6;i++){mesh([ring[i],ring[(i+1)%6],top],i<3?shade:G.mix([shade,'#244a32']));mesh([ring[i],ring[(i+1)%6],bottom],G.mix([shade,'#244a32']));}
      return;
    }
    const count=2;
    for(let k=0;k<count;k++){
      const z=.33+k*.22*size,r=(conifer?.19:.24)*size*(1-k*.25),peak={...p,z:z+(conifer?.47:.38)*size};
      const ring=G.corners.map(v=>offset(p,v,r,z));
      for(let i=0;i<6;i++)mesh([ring[i],ring[(i+1)%6],peak],i<3?shade:G.mix([shade,'#163b30']));
    }
  }
  function mountain(p,size,snow,volcanic) {
    const ring=G.corners.map(v=>offset(p,v,.38*size,.19)),peak={...p,z:.19+.95*size};
    for(let i=0;i<6;i++) {
      const a=ring[i],b=ring[(i+1)%6];mesh([a,b,peak],i<3?'#8f9581':'#666f61');
      if(snow){const lerp=v=>({x:peak.x+(v.x-peak.x)*.32,y:peak.y+(v.y-peak.y)*.32,z:peak.z+(v.z-peak.z)*.32});mesh([lerp(a),lerp(b),peak],i<3?'#eff5e9':'#cfdfdc');}
    }
    if(volcanic)line([{...p,x:p.x-.06,z:peak.z-.09},peak,{...p,x:p.x+.08,z:peak.z-.11}],'#cb704d',2);
  }
  function features(t) {
    if(!t.known)return;
    const terrain=t.data.terrain,items=details(t.ref),{c}=t;
    if(t.water) {
      if(state.scale>20) for(const a of items.slice(0,3))line([{x:c.x+a.x,y:c.y+a.y,z:.015},{x:c.x+a.x+.16,y:c.y+a.y,z:.015}],'#76b0be66',1);
      return;
    }
    if(state.scale<17)return;
    if(/ALPS|HSM|L.M/.test(terrain)) {
      for(const a of items.slice(0,2).sort((a,b)=>a.x+a.y-b.x-b.y))mountain({x:c.x+a.x*.7,y:c.y+a.y*.7},a.size*(terrain==='ALPS'?1.1:.8),/ALPS|HSM|LSM/.test(terrain),terrain==='LVM');
    } else if(/^(D|DH|CH|JG|JH|LCM|LJM)$/.test(terrain)) {
      for(const a of items.slice(0,terrain==='JG'?8:6).sort((a,b)=>a.x+a.y-b.x-b.y))tree({x:c.x+a.x,y:c.y+a.y},a.size,terrain==='CH',terrain.startsWith('J')?'#3c8851':'#688e40');
    } else if(/H|PP|PPR/.test(terrain)) {
      mountain({...c,x:c.x-.1,y:c.y+.05},.48,terrain==='SH',false);
    } else {
      for(const a of items.slice(0,5)){
        const p={x:c.x+a.x,y:c.y+a.y,z:.18};
        if(terrain==='SW')line([p,{...p,x:p.x+.22}],WATER,state.scale*.09);
        else if(terrain==='BR')tree(p,.35,false,'#7d9551');
        else line([p,{...p,x:p.x+.05,z:.24},{...p,x:p.x+.11,z:.18}],terrain==='DE'?'#b69958':'#6d8b4a',1);
      }
    }
  }
  function edges(t) {
    if(!t.known)return;
    const local=G.rivers(t.data);
    for(let i=0;i<6;i++) {
      const a=G.corners[i],b=G.corners[(i+1)%6],neighbour=t.n[i];
      if(!known(neighbour)){
        // Opaque skirt covers the whole uncertain border, including both corners.
        const h=t.water?0:/ALPS|HSM|L.M/.test(t.data.terrain)?.34:/H|PP|PPR/.test(t.data.terrain)?.24:.14;
        const vertexHeight=k=>t.water || [t.n[k],t.n[(k+5)%6]].some(d=>known(d)&&isWater(d.terrain))?0:.14;
        mesh([offset(t.c,a,.64,h+.005),offset(t.c,b,.64,h+.005),offset(t.c,b,1.005,vertexHeight((i+1)%6)+.005),offset(t.c,a,1.005,vertexHeight(i)+.005)],FOG);
      } else if(local.has(G.directions[i]) || G.rivers(neighbour).has(G.directions[(i+3)%6])) {
        if(t.water)continue;
        const points=[offset(t.c,a,1,.16),offset(t.c,b,1,.16)];
        line(points,'#7e9983',Math.max(3,state.scale*.15));line(points,WATER,Math.max(2,state.scale*.095));line(points,'#8bc5cc',Math.max(.7,state.scale*.023));
      }
    }
  }
  function drawScene() {
    const rect=canvas.getBoundingClientRect();ctx.clearRect(0,0,rect.width,rect.height);ctx.fillStyle='#162730';ctx.fillRect(0,0,rect.width,rect.height);
    const b=bounds(),tiles=[];
    for(let col=b.minCol;col<=b.maxCol;col++)for(let row=b.minRow;row<=b.maxRow;row++){
      const t=tile(col,row);if(t.p.x < -150 || t.p.x>rect.width+150 || t.p.y < -150 || t.p.y>rect.height+150)continue;tiles.push(t);
    }
    tiles.sort((a,b)=>a.p.y-b.p.y);
    for(const t of tiles)ground(t);
    for(const t of tiles){features(t);edges(t);}
    for(const t of tiles){
      if(state.selected?.coordinate===t.ref)polygon(G.corners.map(p=>project(offset(t.c,p,.91),.19)),null,'#ffe093');
      if(labels && state.scale>=43){const p=project({...t.c,y:t.c.y+.5},.16);ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#20302bea';ctx.strokeText(t.ref,p.x,p.y);ctx.fillStyle='#f0f2dc';ctx.fillText(t.ref,p.x,p.y);}
      if(!t.known && state.scale>=35){ctx.fillStyle='#71838b';ctx.textAlign='center';ctx.font='12px Segoe UI';ctx.fillText('?',t.p.x,t.p.y);}
    }
    if(state.planningVisible && state.planImport?.plan)drawPlanOverlay();
    updateCenterReadout();
  }
  function setEnabled(value) {
    enabled=value;document.body.classList.toggle('isometric-mode',value);
    $('isoViewControls').classList.toggle('hidden',!value);
    $('openMapperButton').querySelector('h2').textContent='Mapper';
    if(value && state.scale<43)state.scale=52;
    showMapper();
  }
  function setup() {
    $('openIsometricMapperButton').addEventListener('click',()=>setEnabled(true));
    $('openMapperButton').addEventListener('click',()=>setEnabled(false));
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
  return {get enabled(){return enabled;},project,inverse,bounds,draw:drawScene,setEnabled,setup};
})();
IsoMapper.setup();

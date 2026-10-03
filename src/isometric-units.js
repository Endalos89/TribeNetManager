/* Small, cached canvas illustrations for the 3D mapper's unit labels. */
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
  const sprites=new Map(), drawn=new Set();
  function record(code,snapshot) {
    if(snapshot)return snapshot;
    return (state.planImport?.plan?.unitStats || []).find(u=>String(u.unit)===String(code)) ||
      (resultsTimeline.turn?.units || []).find(u=>String(u.unitCode)===String(code)) || null;
  }
  function layout(point,code,type,offset=0,extra='',snapshot=null) {
    const counts=composition(record(code,snapshot)),p=screenFromBase(baseCenter(point.globalCol,point.globalRow));
    const entries=counts?['warriors','actives','inactives','horses','carts'].filter(k=>counts[k]>0).map(k=>[k,counts[k]]):[];
    const text=`${type==='Element'?'E':type==='Tribe'?'T':type==='Fleet'?'F':'U'} ${code}${extra?` ${extra}`:''}`;
    ctx.save();ctx.font='700 11px Segoe UI';const labelWidth=ctx.measureText(text).width+16;ctx.restore();
    const detailed=state.scale>=35 && entries.length>0;
    const cells=entries.map(([kind,count])=>({kind,count,width:Math.max(32,String(count).length*7+8)}));
    const w=Math.max(labelWidth,detailed?cells.reduce((n,c)=>n+c.width,0)+10:0),h=detailed?66:21;
    return {x:p.x-w/2,y:p.y-12-h-offset*(state.scale>=35?71:26),w,h,text,counts,cells,detailed};
  }
  function path(c,points,fill,stroke) {
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
  }
  function horse(c,x,y) {
    c.save();c.translate(x,y);
    path(c,[[-10,-6],[3,-6],[7,-15],[11,-14],[14,-9],[10,-7],[8,-8],[6,1],[-8,1]],'#b28458','#483d31');
    path(c,[[-9,0],[-6,0],[-6,8],[-8,8]],'#765438');path(c,[[3,0],[6,0],[8,8],[5,8]],'#765438');
    path(c,[[-9,-5],[-14,-2],[-13,3],[-10,-1]],'#493d33');
    path(c,[[5,-11],[7,-15],[9,-14],[6,-6]],'#493d33');
    c.fillStyle='#172528';c.fillRect(10,-12,1.5,1.5);c.restore();
  }
  function person(c,x,y,kind,mounted) {
    c.save();c.translate(x,y);
    if(mounted){horse(c,0,2);c.translate(0,-9);}else if(kind==='inactives'){c.scale(.87,.87);}
    const tunic=kind==='warriors'?'#c1745b':kind==='actives'?'#65b1a4':'#d4bc78';
    c.strokeStyle='#333d40';c.lineWidth=2.5;c.lineCap='round';c.beginPath();
    c.moveTo(-2,0);c.lineTo(mounted?-4:-3,7);c.moveTo(2,0);c.lineTo(mounted?4:3,7);c.stroke();
    path(c,[[-4,-12],[3,-12],[5,0],[-5,0]],tunic,'#263b3b');
    path(c,[[0,-11],[3,-11],[5,0],[1,0]],kind==='warriors'?'#954e40':kind==='actives'?'#3c827e':'#a68b55');
    c.fillStyle='#e5c399';c.beginPath();c.arc(0,-16,3.4,0,Math.PI*2);c.fill();
    if(kind==='warriors'){
      path(c,[[-4,-17],[-2,-21],[2,-21],[4,-17]],'#a9bac0','#334951');
      c.strokeStyle='#d9c998';c.lineWidth=1.3;c.beginPath();c.moveTo(7,2);c.lineTo(7,-23);c.stroke();
      path(c,[[7,-27],[5,-22],[9,-22]],'#dae3df');
      c.fillStyle='#dcad58';c.strokeStyle='#604d38';c.beginPath();c.ellipse(-5,-5,4,5,0,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='#8d7145';c.beginPath();c.arc(-5,-5,1.4,0,Math.PI*2);c.fill();
    }else if(kind==='actives'){
      c.strokeStyle='#dbc48d';c.lineWidth=1.5;c.beginPath();c.moveTo(6,3);c.lineTo(6,-15);c.stroke();
      path(c,[[4,-16],[11,-16],[11,-13],[4,-14]],'#a9bac0');
    }else{path(c,[[-4,-18],[-3,-21],[1,-22],[4,-18]],'#a98e62');}
    c.restore();
  }
  function cart(c,x,y) {
    c.save();c.translate(x,y);
    c.strokeStyle='#c9ae7b';c.lineWidth=2;c.beginPath();c.moveTo(-12,0);c.lineTo(-18,-5);c.stroke();
    path(c,[[-12,-11],[8,-11],[12,-4],[-8,-4]],'#c9a065','#5f4a31');
    path(c,[[-8,-4],[12,-4],[12,3],[-8,3]],'#977143','#5f4a31');
    path(c,[[-12,-11],[-8,-4],[-8,3],[-12,-4]],'#705234','#5f4a31');
    for(const wx of [-6,10]){c.fillStyle='#273b41';c.strokeStyle='#d7b67d';c.lineWidth=2;c.beginPath();c.arc(wx,4,4,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(wx-3,4);c.lineTo(wx+3,4);c.moveTo(wx,1);c.lineTo(wx,7);c.stroke();}
    c.restore();
  }
  function illustration(box) {
    const dpr=Math.min(2,window.devicePixelRatio||1),key=JSON.stringify([box.cells,box.counts.mounted,box.w,dpr]);
    if(sprites.has(key))return sprites.get(key);
    const image=document.createElement('canvas');image.width=Math.ceil(box.w*dpr);image.height=45*dpr;
    const c=image.getContext('2d');c.scale(dpr,dpr);let x=(box.w-box.cells.reduce((n,v)=>n+v.width,0))/2;
    for(const cell of box.cells){const center=x+cell.width/2;
      if(cell.kind==='horses')horse(c,center,23);
      else if(cell.kind==='carts')cart(c,center,23);
      else if(box.counts.mounted){c.save();c.translate(center,27);c.scale(.72,.72);person(c,0,0,cell.kind,true);c.restore();}
      else person(c,center,27,cell.kind,false);
      c.fillStyle='#f3e9d3';c.font='10px Segoe UI';c.textAlign='center';c.fillText(String(cell.count),center,43);x+=cell.width;
    }
    if(sprites.size>=256)sprites.delete(sprites.keys().next().value);sprites.set(key,image);return image;
  }
  function draw(point,code,type,offset,extra,snapshot) {
    if(!point)return;
    const key=`${point.globalCol}:${point.globalRow}:${code}`;
    if(drawn.has(key))return;drawn.add(key);
    const b=layout(point,code,type,offset,extra,snapshot),r=canvas.getBoundingClientRect();
    if(b.x+b.w<0 || b.x>r.width || b.y+b.h<0 || b.y>r.height)return;
    ctx.save();roundedRect(ctx,b.x,b.y,b.w,b.h,6);ctx.fillStyle='rgba(16,30,35,.94)';ctx.fill();
    ctx.strokeStyle='#c6ab71';ctx.lineWidth=1;ctx.stroke();
    ctx.font='700 11px Segoe UI';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#f4e5c4';ctx.fillText(b.text,b.x+b.w/2,b.y+14);
    if(b.detailed){const image=illustration(b);ctx.drawImage(image,b.x,b.y+18,b.w,45);}
    ctx.restore();
  }
  const api={composition,layout,draw,beginFrame:()=>drawn.clear()};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.IsoUnits=api;
})(typeof window!=='undefined'?window:globalThis);

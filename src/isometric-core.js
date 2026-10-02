/* Shared geometry: flat-top, odd-column hexes; screen north is map north. */
(function(root) {
  const directions = ['SE', 'S', 'SW', 'NW', 'N', 'NE'];
  const corners = Array.from({length:6}, (_,i) => ({x:Math.cos(i*Math.PI/3), y:Math.sin(i*Math.PI/3)}));
  function seed(reference) {
    let n = 2166136261;
    for (const c of reference.toUpperCase()) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  }
  function random(reference) {
    let n = seed(reference);
    return () => { n += 0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
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
  const water=t=>t==='O'||t==='L';
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  // A continuous world-space surface. Shared vertices are independent of tile ownership.
  function surface(x,y,lookup,palette) {
    const col=Math.round((x-1)/1.5), rgb=[0,0,0];
    let total=0,hills=0,mountains=0,wetDistance=Infinity;
    for(let c=col-2;c<=col+2;c++) {
      const row=Math.round(y/Math.sqrt(3)-.5-(c%2?.5:0));
      for(let r=row-2;r<=row+2;r++) {
        const data=lookup(c,r),terrain=data?.terrain;
        if(!terrain||terrain==='UNKNOWN')continue;
        const dx=x-(1+c*1.5),dy=y-(Math.sqrt(3)/2+Math.sqrt(3)*(r+(c%2?.5:0))),d2=dx*dx+dy*dy;
        if(d2>6.25)continue;
        if(water(terrain)){
          let distance=-Infinity;
          for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3;distance=Math.max(distance,dx*Math.cos(a)+dy*Math.sin(a)-Math.sqrt(3)/2);}
          wetDistance=Math.min(wetDistance,distance);continue;
        }
        const w=Math.pow(1-d2/6.25,3),color=palette(terrain);
        total+=w;hills+=isHill(terrain)?w:0;mountains+=/ALPS|HSM|L.M/.test(terrain)?w:0;
        [1,3,5].forEach((p,i)=>rgb[i]+=parseInt(color.slice(p,p+2),16)*w);
      }
    }
    if(wetDistance<=.13)return {x,y,z:0,color:'#337f98',water:true};
    const shore=smooth((wetDistance-.13)/.24);
    const roll=.53+.23*Math.sin(x*1.8+y*.65)+.18*Math.cos(y*1.5-x*.5);
    const z=(.14+(total?hills/total*.85*roll+mountains/total*.2:0))*shore;
    const land=total?rgb.map(n=>n/total):[37,54,64];
    const bank=[196,187,139];
    const color='#'+land.map((v,i)=>Math.round(bank[i]*(1-shore)+v*shore).toString(16).padStart(2,'0')).join('');
    return {x,y,z,color,water:false};
  }
  const api={surface,isHill,isForest,directions,corners,seed,random,project,unproject,rivers,riverNotes,mix};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.IsoGeometry=api;
})(typeof window!=='undefined'?window:globalThis);

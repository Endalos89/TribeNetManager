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
  function project(x,y,z=0) { return {x:(x-y)*Math.SQRT1_2, y:(x+y)/Math.sqrt(6)-z*Math.sqrt(2/3)}; }
  function unproject(x,y,z=0) { const a=x/Math.SQRT1_2,b=(y+z*Math.sqrt(2/3))*Math.sqrt(6); return {x:(a+b)/2,y:(b-a)/2}; }
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
  const api={directions,corners,seed,random,project,unproject,rivers,riverNotes,mix};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.IsoGeometry=api;
})(typeof window!=='undefined'?window:globalThis);

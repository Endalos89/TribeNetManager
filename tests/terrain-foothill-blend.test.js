'use strict';
// PR-to-GH/CH foothill regression: zero sculpted relief must not develop an
// artificial stepped ridge solely because shared-region strata thickness
// changes between a plain and a hill. Pure inner cores stay unchanged.
const assert=require('node:assert/strict');
const settings=require('../src/terrain-settings');
const G=require('../src/isometric-core');
const centre=(col,row)=>({
  x:1+col*1.5,
  y:Math.sqrt(3)/2+Math.sqrt(3)*(row+(col%2?.5:0))
});
const palette=()=> '#87bd6a';
const snapshot=settings.get();
const origin={col:318,row:330}; // PK1916
const base=.525;
function steppedHeight(height,layer){
  const n=height/layer,whole=Math.floor(n),fraction=n-whole;
  const p=Math.max(0,Math.min(1,(fraction-.26)/.48));
  const bevel=p*p*(3-2*p);
  return layer*(whole+bevel*.86+fraction*.14);
}
try{
  settings.set({hillAmplitude:0,mountainHeight:0,ruggedness:0,
    plainsRelief:0,waterHeight:.5});
  const source=centre(origin.col,origin.row);
  for(const hill of ['GH','CH']){
    for(let dir=0;dir<6;dir++){
      const neighbour=G.regionOwners(origin.col,origin.row,'edge',dir)[1];
      const dest=centre(neighbour.col,neighbour.row);
      const terrain=new Map([
        [origin.col+':'+origin.row,'PR'],
        [neighbour.col+':'+neighbour.row,hill]
      ]);
      const lookup=(col,row)=>({terrain:terrain.get(col+':'+row)||'PR'});
      const at=(p)=>G.surface(p.x,p.y,lookup,palette);
      const midpoint={x:(source.x+dest.x)/2,y:(source.y+dest.y)/2};
      const region=G.regionAt(midpoint.x,midpoint.y);
      assert.equal(region.kind,'edge','fixture midpoint should be shared terrain');
      const weight=region.owners.find(o=>o.col===neighbour.col&&o.row===neighbour.row)?.weight;
      assert.ok(weight>.24&&weight<.76,'seeded weight remains within 25%-75%');
      const middle=at(midpoint);
      assert.ok(!middle.fog&&!middle.water);
      assert.ok(Math.abs(middle.z-base)<1e-6,
        `no layered-height shelf at PR-to-${hill} midpoint, direction ${dir}, weight ${weight}, height ${middle.z}`);
      const corePlain=at(source),coreHill=at(dest);
      assert.ok(Math.abs(corePlain.z-steppedHeight(base,.10/3))<1e-6,
        'original PR inner core elevation must not change');
      assert.ok(Math.abs(coreHill.z-steppedHeight(base,(.10+.025)/3))<1e-6,
        'original GH/CH inner core elevation must not change');
    }
  }
  console.log('FOOTHILL_BLEND_NO_ARTIFICIAL_TERRACE_PASS');
}finally{
  settings.set(snapshot);
}

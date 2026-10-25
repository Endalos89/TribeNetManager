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
// Seeded border ownership is continuous in height AND tangent at t=0.5,
 // with flat tangents at the two immutable core joins.
for(const beta of [.25,.31,.5,.69,.75]){
  const f=t=>G.pairSplit(t,beta),e=1e-5;
  assert.equal(f(0),0);assert.equal(f(.5),beta);assert.equal(f(1),1);
  for(let i=1;i<=100;i++)
    assert.ok(f(i/100)>=f((i-1)/100)-1e-12,'hill blend must be monotonic');
  const left=(f(.5)-f(.5-e))/e,right=(f(.5+e)-f(.5))/e;
  assert.ok(Math.abs(left-right)<.001,'no seam at ownership midpoint');
  assert.ok(f(e)/e<.001,'flat slope against first core');
  assert.ok((1-f(1-e))/e<.001,'flat slope against second core');
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
      const corePlain=at(source),coreHill=at(dest);
      // The transition must interpolate pure PR/GH elevations without a
      // step or overshoot from changing strata layer thickness.
      const smooth=n=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
      const foothillFlatness=settings.value('foothillFlatness');
      const mixture=smooth((weight-foothillFlatness*.35)/(1-foothillFlatness*.35));
      const expected=corePlain.z*(1-mixture)+coreHill.z*mixture;
      assert.ok(Math.abs(middle.z-expected)<1e-6,
        `foothill centre must blend resolved elevations, direction ${dir}, actual ${middle.z} expected ${expected}`);
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

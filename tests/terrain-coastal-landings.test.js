'use strict';
// Rare, stable, decorative landing coves and access tracks are computed only
// inside shared hill/mountain <-> ocean/lake connectors.
const assert=require('node:assert/strict');
const G=require('../src/isometric-core');
const T=require('../src/terrain-settings');
const base=T.get();
const pos=(c,r)=>({x:1+c*1.5,y:Math.sqrt(3)*(r+.5+(c%2?.5:0))});
const colour=name=>({'GH':'#74944e','CH':'#698c4c','LAM':'#898c76',
  'HSM':'#999e91','O':'#397a96','L':'#397a96'}[name]||'#88a35a');
let landings=0,paths=0,covesWithSand=0;
try{
  T.reset();
  for(const [hill,water] of [['GH','O'],['CH','L'],['LAM','O'],['HSM','L']]){
    let matched=0,trackMatched=0;
    for(let c=10;c<160;c++){
      const r=100;
      const n=G.regionOwners(c,r,'edge',0)[1];
      const a=pos(c,r),b=pos(n.col,n.row);
      const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const lookup=(col,row)=>({terrain:col===c&&row===r?water:hill});
      const region=G.regionAt(midpoint.x,midpoint.y);
      assert.equal(region.kind,'edge','coastal feature must use shared square');
      const owners=region.owners.map(o=>({...o,data:lookup(o.col,o.row)}));
      const detail=G.coastalLanding(region,owners,midpoint.x,midpoint.y);
      assert.deepEqual(detail,G.coastalLanding(region,owners,midpoint.x,midpoint.y),
        'same pair must always produce the same landing');
      if(detail){
        matched++;
        assert.ok(detail.beach>0&&detail.beach<=1);
        if(detail.path>0){trackMatched++;assert.ok(detail.path<=1);}
        if(!detail.rocky)covesWithSand++;
      }
      // Neither the wet core nor the hill core can receive a decorative path.
      for(const point of [a,b]){
        const core=G.regionAt(point.x,point.y);
        const coreOwners=core.owners.map(o=>({...o,data:lookup(o.col,o.row)}));
        assert.equal(G.coastalLanding(core,coreOwners,point.x,point.y),null);
      }
      // The actual sampled coastal landscape must remain deterministic.
      const nearLand={x:a.x*.35+b.x*.65,y:a.y*.35+b.y*.65};
      const sample=G.surface(nearLand.x,nearLand.y,lookup,colour);
      assert.deepEqual(sample,G.surface(nearLand.x,nearLand.y,lookup,colour));
      assert.ok(Number.isFinite(sample.z));
    }
    assert.ok(matched>=5&&matched<35,
      'landing spots must be occasional, not continuous: '+hill+'/'+water+' count='+matched);
    assert.ok(trackMatched>=1&&trackMatched<matched,
      'rare access paths should accompany only some coves');
    landings+=matched;paths+=trackMatched;
  }
  assert.ok(covesWithSand>0,'sandy coves should occur alongside rocky coves');
  // Measure the actual landing shelf, not merely the random feature flag.
  // Disable shoreline noise to compare the same inland coordinate across
  // the lane and its unmodified rugged flank.
  T.set({coastRoughness:0});
  let shelves=0;const seaLevel=T.value('waterHeight');
  for(let c=10;c<100;c++){
    const r=100,n=G.regionOwners(c,r,'edge',0)[1];
    const square=G.sharedSquare({col:c,row:r},n);
    const lookup=(col,row)=>({terrain:col===c&&row===r?'O':'LAM'});
    const normal=square.normal,tangent=square.tangent;
    for(let k=1;k<160;k++){
      const along=square.halfSize*k/160;
      const x=square.center.x+normal.x*along,y=square.center.y+normal.y*along;
      const region=G.regionAt(x,y),owners=region.owners.map(o=>({...o,data:lookup(o.col,o.row)}));
      const feature=G.coastalLanding(region,owners,x,y);
      if(!feature||feature.beach<.99||feature.path>.01)continue;
      const p=G.surface(x,y,lookup,colour);
      const flank=G.surface(x+tangent.x*.28,y+tangent.y*.28,lookup,colour);
      if(!p.water&&!flank.water&&p.z>seaLevel+.00001&&p.z<seaLevel+.03&&flank.z>seaLevel+.10){shelves++;break;}
    }
  }
  assert.ok(shelves>=3,'selected coves must have an above-water low shelf beside rugged slopes: '+shelves);
  let minimumShelf=Infinity;
  for(const share of [.35,.7,.8])for(const terrain of ['GH','CH','LAM','HSM'])for(const water of ['O','L']){
    T.set({coastWaterShare:share,coastRoughness:0});
    for(const col of [28,18]){ // seeded sandy shelf and rocky ascent
      const row=100,n=G.regionOwners(col,row,'edge',4)[1];
      const square=G.sharedSquare({col,row},n);
      const lookup=(c,r)=>({terrain:c===col&&r===row?water:terrain});
      const point=(u,lateral=0)=>({
        x:square.center.x+square.normal.x*(u-.5)*G.coreRadius+square.tangent.x*lateral,
        y:square.center.y+square.normal.y*(u-.5)*G.coreRadius+square.tangent.y*lateral
      });
      const at=u=>{const p=point(u);return G.surface(p.x,p.y,lookup,colour);};
      const height=at(1).z-seaLevel,step=G.coreRadius/1000;
      let width=0;
      for(let k=500;k<1000;k++){
        const p=at(k/1000);
        if(!p.water&&p.z>seaLevel+.000001&&p.z<seaLevel+height*.08&&p.landing>.95)width+=step;
      }
      minimumShelf=Math.min(minimumShelf,width);
      assert.ok(width>.05,`${terrain}/${water} share=${share} col=${col}: beach too narrow (${width})`);
      const flank=point(.5+.5*share-.01,.28);
      assert.ok(G.surface(flank.x,flank.y,lookup,colour).water,'ordinary shoreline must retain configured water share');
      if(share>=.7)assert.ok(!at(.5+.5*share-.03).water,'rare beach must extend locally into water');
    }
  }
  console.log('PHYSICAL_BEACH_WIDTH_PASS',JSON.stringify({minimumShelf}));
  console.log('SEEDED_HILL_MOUNTAIN_COASTAL_LANDINGS_PASS',
    JSON.stringify({landings,paths,sandy:covesWithSand}));
}finally{T.set(base);}

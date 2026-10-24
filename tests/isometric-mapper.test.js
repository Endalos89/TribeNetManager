const assert=require('node:assert/strict');
const G=require('../src/isometric-core');
// Inverse projection must preserve cursor targets across all quadrants and heights.
for(const p of [[0,0,0],[18,-25,0],[-310,700,.4]]){
 const q=G.project(...p),r=G.unproject(q.x,q.y,p[2]);
 assert.ok(Math.abs(r.x-p[0])<1e-9);assert.ok(Math.abs(r.y-p[1])<1e-9);
}
const a=G.random('PK1613'),b=G.random('pk1613'),c=G.random('PK1614');
const sequence=Array.from({length:20},a);
assert.deepEqual(sequence,Array.from({length:20},b));assert.notDeepEqual(sequence,Array.from({length:20},c));
assert.equal(G.riverNotes('Note\n[Rivers: N, SE]', ['SW','NW']), 'Note\n[Rivers: SW, NW]');
assert.equal(G.riverNotes('Note\n[Rivers: N]',[]),'Note');
assert.deepEqual([...G.rivers({notes:'A river mentioned in prose is not an edge.'})],[]);
assert.deepEqual([...G.rivers({notes:'[Rivers: N, NE, invalid]'})],['N','NE']);
// Verify physical shared endpoints for even/odd columns, including submap seams.
function center(c,r){return {x:1+c*1.5,y:Math.sqrt(3)/2+Math.sqrt(3)*(r+(c%2?.5:0))};}
function neighbour(c,r,i){const odd=c%2;return [[c+1,r+(odd?1:0)],[c,r+1],[c-1,r+(odd?1:0)],[c-1,r+(odd?0:-1)],[c,r-1],[c+1,r+(odd?0:-1)]][i];}
for(const col of [28,29,30,31])for(let i=0;i<6;i++){
 const p=center(col,20),n=center(...neighbour(col,20,i)),j=(i+3)%6;
 const u=G.corners[i],v=G.corners[(j+1)%6];
 assert.ok(Math.hypot(p.x+u.x-n.x-v.x,p.y+u.y-n.y-v.y)<1e-9);
}
console.log('Isometric geometry, deterministic scenery, river notes and seam tests passed');
// North remains vertically up, while projection still preserves relief.
assert.equal(G.project(0,-1).x,0);assert.ok(G.project(0,-1).y<0);
assert.ok(G.project(1,0).x>0);assert.equal(G.project(1,0).y,0);
const palette=()=> '#83b653';
const hill=()=>({terrain:'GH'}),flat=()=>({terrain:'PR'});
const p=center(30,20),n=center(30,21),mid={x:(p.x+n.x)/2,y:(p.y+n.y)/2};
const left=G.surface(mid.x,mid.y-1e-5,hill,palette),right=G.surface(mid.x,mid.y+1e-5,hill,palette);
assert.ok(Math.abs(left.z-right.z)<1e-4,'hill surface remains continuous through shared edge');
assert.ok(left.z>.25,'connected hills retain elevation through shared borders');
assert.equal(left.color,right.color,'matching ground has no per-tile colour border');
assert.equal(G.surface(mid.x,mid.y,flat,palette).color,palette(),'dry land should have no blue border tint');
const wet=(c,r)=>c===30&&r===20?{terrain:'O'}:{terrain:'PR'};
assert.equal(G.surface(p.x,p.y,wet,palette).water,true);
// Visual coasts may cross hex edges; centres retain authoritative terrain.
assert.equal(G.surface(p.x,p.y,wet,palette).z,0,'reported ocean centre remains at sea level');
assert.equal(G.surface(n.x,n.y,wet,palette).water,false,'coastal band does not consume whole land hex');
console.log('North-up projection, continuous hills and dry/coastal boundary checks passed');
// Fog only excludes scenery whose BASE is concealed, never clipping its crown.
assert.equal(G.sceneryVisible(0,0,[false,false,false,false,false,false]),true);
assert.equal(G.sceneryVisible(0,-.7,[true,true,true,true,false,true]),false);
assert.equal(G.sceneryVisible(0,-.7,[true,true,true,true,true,true]),true);
const {composition}=require('../src/isometric-units');
const report={people:{Warriors:10,Actives:20,Inactives:5,People:35},resources:{Animals:{Horse:35},Goods:{Wagon:0}}};
assert.deepEqual(composition(report),{warriors:10,actives:20,inactives:5,horses:35,carts:0,mounted:true});
assert.equal(composition({...report,resources:{Animals:{Horse:34}}}).mounted,false);
assert.equal(composition({...report,resources:{Animals:{Horse:35},Goods:{Cart:1}}}).mounted,false);
assert.equal(composition({...report,resources:{Animals:{Horse:35},Goods:{Wagon:1}}}).mounted,false);
assert.equal(composition({...report,people:{...report.people,Slaves:1}}).mounted,false);
assert.equal(composition({...report,people:{...report.people,People:40}}).mounted,false);
assert.equal(composition({warrior:10,active:20,inactive:5,totalPeople:35,horseCount:35,wagonCount:0}).mounted,true);
assert.equal(composition({warrior:10,active:20,inactive:5,totalPeople:35,horseCount:35,wagonCount:0,inventory:[{item:'CART',quantity:1}]}).mounted,false);
assert.equal(composition({people:{},resources:{Animals:{Horses:10}}}).mounted,false);
assert.equal(composition(null),null);
console.log('Fog scenery and reported/planned unit composition checks passed');

const U=require('../src/isometric-units');
for(const [n,count] of [[0,0],[1,1],[9,1],[10,2],[99,2],[100,3],[999,3],[1000,4],[9999,4],[10000,5]])assert.equal(U.modelCount(n),count);
const crowd=U.formation({warriors:150,actives:450,inactives:80,horses:0,carts:0,mounted:false},'PK1613:0485');
assert.equal(crowd.length,8);assert.equal(crowd.filter(m=>m.kind==='warriors').length,3);assert.equal(crowd.filter(m=>m.kind==='actives').length,3);assert.equal(crowd.filter(m=>m.kind==='inactives').length,2);
assert.deepEqual(crowd,U.formation({warriors:150,actives:450,inactives:80,horses:0,carts:0,mounted:false},'PK1613:0485'));
assert.ok(crowd.every(m=>Math.hypot(m.x,m.y)<.47));
assert.equal(U.formation(null,'unknown').length,0);
const mountedGroup=U.formation({warriors:10,actives:10,inactives:1,horses:21,carts:0,mounted:true},'mounted');
assert.ok(mountedGroup.filter(m=>m.kind!=='horses').every(m=>m.mounted));
assert.equal(typeof U.drawScout,'function');
console.log('Logarithmic miniature counts, seeded formation and mounted model checks passed');

let selection=null;
const codes=['0485','0485e1'];
for(const expected of ['0485','0485e1',null,'0485']){selection=U.nextSelection(selection,'turn:hex',codes);assert.equal(selection.code,expected);}
assert.equal(U.nextSelection(selection,'turn:otherHex',codes).code,'0485');
assert.equal(U.nextSelection(selection,'newTurn:hex',codes).code,'0485');
assert.equal(U.nextSelection(selection,'turn:hex',['0485e1']).code,'0485e1');
assert.equal(U.nextSelection(null,'empty',[]).code,null);
console.log('Unit-first click cycling, terrain stop and context reset checks passed');

// Planned units stay at their origin; the route arrow carries the movement
// information and the destination must not receive a duplicate model.
global.resultsTimeline={};
global.state={
  planningVisible:true,
  planImport:{id:1,turnKey:'906-04',plan:{}},
  routeCache:{movements:[{unit:'0485',route:{points:[{coordinate:'PK1711'},{coordinate:'PK1810'}]}}]}
};
U.prepare();
assert.equal(U.occupies('PK1711',0,0),true);
assert.equal(U.occupies('PK1711',.3,0),false);
assert.equal(U.occupies('PK1810',0,0),false);
console.log('Planned unit models remain on origin hex checks passed');

// Historical result rendering uses the resolved unit position only; the
// synced plan must not add a second model back at its movement origin.
global.resultsTimeline={turn:{turnKey:'906-04',isPlanningTurn:false,units:[{unitCode:'0485',unitType:'Tribe',currentHex:'PK1810'}]}};
global.state.planImport={id:2,turnKey:'906-04',plan:{}};
global.state.routeCache={movements:[{unit:'0485',route:{points:[{coordinate:'PK1711'},{coordinate:'PK1810'}]}}]};
U.prepare();
assert.equal(U.occupies('PK1711',0,0),false);
assert.equal(U.occupies('PK1810',0,0),true);
console.log('Historical results use one resolved unit position checks passed');

// A moving model is centred on the shared edge (the midpoint between the
// current and next hex); a model without a route stays at the hex centre.
global.baseCenter=(col,row)=>({x:1+col*1.5,y:Math.sqrt(3)/2+Math.sqrt(3)*(row+(col%2?.5:0))});
global.IsoMapper={surface:()=>({z:0}),project:p=>p,enabled:false};
global.canvas={getBoundingClientRect:()=>({width:1000,height:1000})};
global.ctx={save(){},restore(){},measureText(){return {width:10};}};
global.state={scale:50,scoutingVisible:true,planningVisible:true,planImport:{plan:{unitStats:[{unit:'0485',warrior:1,active:0,inactive:0}]}},routeCache:{movements:[{unit:'0485',route:{points:[{coordinate:'AA0101',globalCol:0,globalRow:0},{coordinate:'AA0201',globalCol:1,globalRow:0}]}}]}};
const moving=U.layout({coordinate:'AA0101',globalCol:0,globalRow:0},'0485','Tribe');
global.state.routeCache={movements:[]};
const still=U.layout({coordinate:'AA0101',globalCol:0,globalRow:0},'0485','Tribe');
assert.equal(moving.models[0].x-still.models[0].x,.75);
assert.equal(still.position.x,1,'a single unit stays centred on the inner hex');
assert.equal(moving.position.x,1.75,'moving unit is positioned in the physical shared square');
assert.equal(moving.physicalRegion,'square');
// A scouting route does not move the parent unit to the edge; it remains
// centred while the scout activity is shown by its own route overlay.
global.state.routeCache={movements:[],scouts:[{unit:'0485',route:{points:[{coordinate:'AA0101',globalCol:0,globalRow:0},{coordinate:'AA0201',globalCol:1,globalRow:0}]}}]};
const scoutingOnly=U.layout({coordinate:'AA0101',globalCol:0,globalRow:0},'0485','Tribe');
assert.equal(scoutingOnly.models[0].x,still.models[0].x);
assert.equal(scoutingOnly.models[0].y,still.models[0].y);
assert.deepEqual(U.diceSlots(1),[{x:0,y:0}]);
assert.equal(U.diceSlots(6).length,6);
assert.equal(new Set(U.diceSlots(6).map(p=>p.x)).size,2,'six units use two balanced columns');
assert.equal(new Set(U.diceSlots(6).map(p=>p.y)).size,3,'six units use three balanced rows');
console.log('Moving edge midpoint, scouting-centre and stationary centre checks passed');

// Separate installations and discovery orders produce identical scenery.
const vm=require('node:vm'),fs=require('node:fs');
function installation(){const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/isometric-core'),'utf8'),context);return context.module.exports;}
const first=installation(),second=installation();
first.sceneryDetails('AA0101');second.sceneryDetails('ZZ3021');
assert.equal(JSON.stringify(first.sceneryDetails('PK1613')),JSON.stringify(second.sceneryDetails('pk1613')));
assert.notDeepEqual(G.sceneryDetails('PK1613'),G.sceneryDetails('PK1614'));
assert.equal(JSON.stringify(G.sceneryDetails('PK1613')),JSON.stringify(first.sceneryDetails('PK1613')),'fixed seed reproduces scenery between installs');
assert.equal(G.scenerySeed,1790425012,'numeric world seed is pinned to repository creation date');
console.log('Versioned scenery seed is stable across installations and discovery order');

// Mountains are ground relief, with traversable low ranges below high ranges.
for(const terrain of ['LAM','LCM','LJM','LSM','LVM'])assert.equal(G.isLowMountain(terrain),true);
for(const terrain of ['ALPS','HSM'])assert.equal(G.isHighMountain(terrain),true);
for(let x=44;x<49;x+=.27)for(let y=34;y<39;y+=.31){
 const low=G.surface(x,y,()=>({terrain:'LCM'}),palette);
 const high=G.surface(x,y,()=>({terrain:'HSM'}),palette);
 assert.ok(low.z>.4&&low.z<1.1,'low ranges have connected, rugged moderate relief');
 assert.ok(high.z>low.z+.3,'impassable ranges are clearly higher');
 assert.ok(high.z<2.1,'height remains bounded');
 assert.equal(JSON.stringify(first.surface(x,y,()=>({terrain:'LCM'}),palette)),JSON.stringify(second.surface(x,y,()=>({terrain:'LCM'}),palette)));
}
const mixedRanges=(c,r)=>({terrain:c<30?'LCM':r<21?'HSM':'GH'});
for(const col of [29,30])for(let i=0;i<6;i++){
 const c=center(col,20),n=center(...neighbour(col,20,i)),x=(c.x+n.x)/2,y=(c.y+n.y)/2;
 const a=G.surface(x-1e-6,y,mixedRanges,palette),b=G.surface(x+1e-6,y,mixedRanges,palette);
 assert.ok(Math.abs(a.z-b.z)<1e-4,'mixed ranges join continuously at hex/submap seams');
}
const site={x:0,y:0,z:.8,water:false};
const gentle=(x,y)=>({x,y,z:.8+x*.2,water:false});
assert.equal(G.treeSite('LCM',site,gentle),true);
assert.equal(G.treeSite('LJM',site,gentle),true);
for(const t of ['LAM','LSM','LVM','HSM','ALPS','PR','UNKNOWN'])assert.equal(G.treeSite(t,site,gentle),false);
assert.equal(G.treeSite('LCM',site,(x,y)=>({x,y,z:.8+x*1.2,water:false})),false,'avoid steep slopes');
assert.equal(G.treeSite('LCM',{...site,z:1.3},gentle),false,'avoid exposed heights');
assert.equal(G.treeSite('D',site,()=>({...site,water:true})),false,'avoid shoreline overhang');
assert.equal(G.treeSite('D',{...site,water:true},gentle),false);
assert.equal(G.surface(p.x,p.y,wet,palette).z,0,'water remains level beside relief');
console.log('Connected low/high mountain relief, shared seed, seams and slope-aware wooded placement passed');

// Layered terrain replaces hill props; exposed stone occurs in both families.
let hillStone=0,mountainStone=0,hillRange=[9,0],mountainRange=[9,0];
for(let x=20;x<25;x+=.17)for(let y=30;y<35;y+=.19){
 const h=G.surface(x,y,()=>({terrain:'GH'}),palette),m=G.surface(x,y,()=>({terrain:'LCM'}),palette);
 hillStone=Math.max(hillStone,h.rock);mountainStone=Math.max(mountainStone,m.rock);
 hillRange=[Math.min(hillRange[0],h.z),Math.max(hillRange[1],h.z)];
 mountainRange=[Math.min(mountainRange[0],m.z),Math.max(mountainRange[1],m.z)];
}
assert.ok(hillStone>.4&&mountainStone>.5,'stone is present in the ground itself');
assert.ok(hillRange[1]-hillRange[0]>.2,'hills have visible rises and valleys');
assert.ok(mountainRange[1]>hillRange[1]+.16,'mountain silhouettes are taller');
assert.equal(G.treeSite('LCM',{...site,rock:.8},gentle),false,'trees avoid exposed stone');
// Every reported hex centre keeps its land/water identity despite irregular coasts.
const coastline=(c,r)=>({terrain:c<30?'GH':'O'});
for(let c=27;c<33;c++)for(let r=18;r<25;r++){
 const p=center(c,r),s=G.surface(p.x,p.y,coastline,palette);
 assert.equal(s.water,c>=30);
}
// Sample a long coast; shoreline offsets vary and the ground meets level water
// continuously rather than dropping from a hill through a narrow painted rim.
const crossings=[];
for(let y=33;y<40;y+=.31){
 let last=null;
 for(let x=43;x<47;x+=.01){
  const p=G.surface(x,y,coastline,palette);
  if(last){assert.ok(Math.abs(p.z-G.surface(x-1e-6,y,coastline,palette).z)<.001,'coast must not have discontinuous height jumps');
   if(p.water!==last.water)crossings.push(x);}
  last=p;
 }
}
assert.ok(crossings.length>10);
assert.ok(Math.max(...crossings)-Math.min(...crossings)>.2,'coast has varied headlands and inlets');
require('./isometric-ground.test');

// Central hexes, two-owner edge connectors and three-owner corner connectors.
const core=center(30,20),edgeNeighbour=neighbour(30,20,0),next=center(...edgeNeighbour);
const edgePoint={x:(core.x+next.x)/2,y:(core.y+next.y)/2};
const vertex={x:core.x+G.corners[0].x,y:core.y+G.corners[0].y};
const coreRegion=G.regionAt(core.x,core.y),edgeRegion=G.regionAt(edgePoint.x,edgePoint.y),cornerRegion=G.regionAt(vertex.x,vertex.y);
assert.equal(coreRegion.kind,'core');assert.equal(coreRegion.owners.length,1);
assert.equal(edgeRegion.kind,'edge');assert.equal(edgeRegion.owners.length,2);
assert.equal(cornerRegion.kind,'corner');assert.equal(cornerRegion.owners.length,3);
const discoveries=new Map([['30:20',{terrain:'GH'}]]),lookup=(c,r)=>discoveries.get(`${c}:${r}`);
const coreBefore=G.surface(core.x,core.y,lookup,palette);
assert.ok(!coreBefore.fog);
assert.equal(G.surface(edgePoint.x,edgePoint.y,lookup,palette).fog,true);
assert.equal(G.surface(vertex.x,vertex.y,lookup,palette).fog,true);
discoveries.set(`${edgeNeighbour[0]}:${edgeNeighbour[1]}`,{terrain:'O'});
assert.ok(!G.surface(edgePoint.x,edgePoint.y,lookup,palette).fog,'edge unlocks with two owners');
assert.equal(G.surface(vertex.x,vertex.y,lookup,palette).fog,true,'corner still needs third owner');
for(const owner of cornerRegion.owners)if(!lookup(owner.col,owner.row))discoveries.set(`${owner.col}:${owner.row}`,{terrain:'HSM'});
assert.ok(!G.surface(vertex.x,vertex.y,lookup,palette).fog,'corner unlocks with all three owners');
assert.deepEqual(G.surface(core.x,core.y,lookup,palette),coreBefore,'core generation cannot change when neighbours are discovered');
// The entire core retains its own terrain, including near its six edges.
for(let x=-.6;x<=.6;x+=.08)for(let y=-.6;y<=.6;y+=.08){
 const p={x:core.x+x,y:core.y+y};if(G.regionAt(p.x,p.y).kind!=='core')continue;
 const land=G.surface(p.x,p.y,(c,r)=>({terrain:c===30&&r===20?'GH':'O'}),palette);
 const sea=G.surface(p.x,p.y,(c,r)=>({terrain:c===30&&r===20?'O':'HSM'}),palette);
 assert.equal(land.water,false);assert.equal(sea.water,true);
}
for(const steps of [2,4,8]){
 const area=G.regionMesh(steps).reduce((sum,f)=>sum+Math.abs(f.points.reduce((a,p,i)=>{const q=f.points[(i+1)%f.points.length];return a+p.x*q.y-p.y*q.x;},0))/2,0);
 assert.ok(Math.abs(area-3*Math.sqrt(3)/2)<1e-9,'segmented mesh covers each hex exactly once');
}
console.log('Core/edge/corner discovery, immutable core terrain and gap-free segmented meshes passed');

// Every ocean/lake-facing edge retains a broad water apron INSIDE the land hex.
for(const terrain of ['PR','GH','LCM','HSM'])for(const water of ['O','L'])for(const col of [29,30])for(let dir=0;dir<6;dir++){
 const row=20,c=center(col,row),other=neighbour(col,row,dir),n=center(...other);
 const lookup=(x,y)=>({terrain:x===other[0]&&y===other[1]?water:terrain});
 const at=t=>G.surface(c.x+(n.x-c.x)*t,c.y+(n.y-c.y)*t,lookup,palette);
 assert.equal(at(G.coreRadius/2).water,false,'central land is preserved');
 let wet=0;
 for(let i=0;i<100;i++)if(at(G.coreRadius/2+(1-G.coreRadius)/2*(i+.5)/100).water)wet++;
 assert.ok(wet>=45&&wet<=75,`coastal land-side edge water share ${wet}%`);
 assert.equal(at(.5).z,0,'shared hex border is navigable level water');
}
// Corners shared with water also contain water, but wait for ALL three owners.
for(const water of ['O','L']){
 const c=center(30,20),v={x:c.x+G.corners[0].x,y:c.y+G.corners[0].y};
 const owners=G.regionAt(v.x,v.y).owners,sea=owners.find(o=>o.col!==30||o.row!==20);
 const lookup=(x,y)=>({terrain:x===sea.col&&y===sea.row?water:'GH'});
 assert.equal(G.surface(v.x,v.y,lookup,palette).water,true);
 const hidden=owners.find(o=>o!==sea);
 assert.equal(G.surface(v.x,v.y,(x,y)=>x===hidden.col&&y===hidden.row?null:lookup(x,y),palette).fog,true);
}
console.log('Ocean/lake coastal land edges reserve about 60% water across all orientations');
// Inner relief remains unchanged beside water; mountains retain their height.
{
 const c=center(30,20),n=center(30,21);
 for(const terrain of ['GH','HSM']){
  const lookup=(col,row)=>({terrain:col===30&&row===21?'L':terrain});
  const s=G.surface(c.x+(n.x-c.x)*G.coreRadius/2,c.y+(n.y-c.y)*G.coreRadius/2,lookup,palette);
  if(terrain==='GH')assert.ok(s.z>.25,'hill core retains its own relief at the coast');
  else assert.ok(s.z>.9,'high mountain keeps a steep coastal face');
 }
}

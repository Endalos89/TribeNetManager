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
assert.ok(left.z>.25,'adjoining hills must not drop to the flat plane at their shared edge');
assert.equal(left.color,right.color,'matching ground has no per-tile colour border');
assert.equal(G.surface(mid.x,mid.y,flat,palette).color,palette(),'dry land should have no blue border tint');
const wet=(c,r)=>c===30&&r===20?{terrain:'O'}:{terrain:'PR'};
assert.equal(G.surface(p.x,p.y,wet,palette).water,true);
assert.equal(G.surface(mid.x,mid.y,wet,palette).water,true,'water covers full ocean including edge');
assert.equal(G.surface(mid.x,mid.y+.1,wet,palette).water,true,'coastal water extends into land');
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
assert.equal(still.models[0].x,1.313764635128913);
console.log('Moving edge midpoint and stationary centre checks passed');

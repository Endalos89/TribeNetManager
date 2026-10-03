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

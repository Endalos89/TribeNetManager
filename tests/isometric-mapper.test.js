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

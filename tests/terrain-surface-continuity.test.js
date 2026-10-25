'use strict';
const assert=require('node:assert/strict');
const G=require('../src/isometric-core');
const T=require('../src/terrain-settings');
const palette=()=> '#86aa65';
const state=T.get();T.reset();
let maxJump=0;
try{
  // Sample either side of every square/corner interface, not just the
  // midpoint where the previous (incompatible) interpolants happened to agree.
  for(const terrains of [['PR','GH','CH'],['GH','LAM','PR'],['LAM','O','GH'],['O','L','HSM']]){
    for(let dir=0;dir<6;dir++){
      const tri=G.sharedTriangle(316,327,dir);
      const lookup=(c,r)=>({terrain:terrains[tri.owners.findIndex(o=>o.col===c&&o.row===r)]||'PR'});
      for(let side=0;side<3;side++)for(let k=2;k<39;k++){
        const a=tri.corners[side],b=tri.corners[(side+1)%3],t=k/40;
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        const dx=tri.center.x-x,dy=tri.center.y-y,n=Math.hypot(dx,dy);
        const inside=G.surface(x+dx/n*1e-5,y+dy/n*1e-5,lookup,palette);
        const outside=G.surface(x-dx/n*1e-5,y-dy/n*1e-5,lookup,palette);
        const jump=Math.abs(inside.z-outside.z);maxJump=Math.max(maxJump,jump);
        assert.ok(jump<.001,`${terrains} dir ${dir} side ${side} t ${t}: discontinuity ${jump}`);
      }
    }
  }
  // A flat relief fixture isolates interpolation-induced terraces: no height
  // reversals, steep tiny risers or shelves inside the shared connector.
  T.set({ruggedness:0,plainsRelief:0,hillAmplitude:0,mountainHeight:0,waterHeight:.5});
  for(let dir=0;dir<6;dir++){
    const owners=G.regionOwners(316,327,'edge',dir),sq=G.sharedSquare(...owners);
    const lookup=(c,r)=>({terrain:c===316&&r===327?'PR':'GH'});
    const heights=[];
    for(let k=0;k<=200;k++){
      const along=(k/200*2-1)*sq.halfSize;
      heights.push(G.surface(sq.center.x+sq.normal.x*along,sq.center.y+sq.normal.y*along,lookup,palette).z);
    }
    assert.ok(Math.max(...heights)-Math.min(...heights)<.01,'flat relief must not acquire contour ridges');
  }
  console.log('TERRAIN_SURFACE_CONTINUITY_PASS',JSON.stringify({maxJump}));
}finally{T.set(state);}

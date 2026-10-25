const assert=require('node:assert/strict');
const T=require('../src/terrain-diagnostic');
assert.deepEqual(T.PLAN.map(p=>p.key),
  ['zoomed-out-pan','zoom-cycles','zoomed-in-pan']);
assert.deepEqual(T.PLAN.map(p=>p.frames),[90,144,90]);
const origin={x:240,y:335,scale:85};
for(const phase of T.PLAN){
  const end=T.move(phase,phase.frames-1,origin,42,170,1.5);
  assert.ok(Math.abs(end.x-origin.x)<1e-9);
  assert.ok(Math.abs(end.y-origin.y)<1e-9);
}
const zoomPhase=T.PLAN[1];
for(let cycle=0;cycle<3;cycle++){
  assert.ok(T.move(zoomPhase,cycle*48+23,origin,42,170,1).scale>169,
    'each cycle must reach full close zoom');
  assert.ok(Math.abs(T.move(zoomPhase,cycle*48+47,origin,42,170,1).scale-42)<1e-9,
    'each cycle must return to far zoom');
}
const stat=T.stats([10,20,30,50,110,280]);
assert.equal(stat.count,6);
assert.equal(stat.max,280);
assert.equal(stat.over33,3);
assert.equal(stat.over100,2);
assert.equal(stat.over250,1);
assert.deepEqual(T.delta({builds:10,evictions:4,diskWrites:0},
  {builds:12,evictions:4,diskWrites:3}),
  {builds:2,diskWrites:3,evictions:0});
(async()=>{
  let clock=100,frame=0,renders=0;
  const phaseChanges=[];
  const stages=[];
  const report=await T.run({
    start:origin,zoomOut:42,zoomIn:170,extent:1.5,
    nextFrame:async()=>{clock+=frame%13===0?44:16.7;frame++;return clock;},
    now:()=>clock,
    render:point=>{renders++;assert.ok(point.scale>=42&&point.scale<=170);clock+=3;},
    snapshot:()=>({builds:18,cachedChunks:19,knownChunkTargets:19,
      queuedChunks:0,residentBytes:18*1048576,worldGeometryComplete:true,
      evictions:0,workerFailures:0,unitBufferRebuilds:80,
      diskWrites:19,diskHits:1,diskMisses:2}),
    onProgress:p=>stages.push(p.phase),
    meta:{version:'test',turn:'906-06',knowledge:'906-05',
      date:'2026-10-25T11:00:00Z',width:1400,height:900,dpr:1,
      scale:85,known:84,total:84,targets:19,prepared:true,
      hydrated:true,fallback:false}
  });
  assert.equal(report.status,'completed');
  assert.equal(renders,324);
  assert.equal(report.phases.length,3);
  assert.deepEqual(report.phases.map(p=>p.frames),[90,144,90]);
  for(const phase of report.phases){
    assert.equal(phase.draw.count,phase.frames);
    assert.equal(phase.draw.p99,3);
    assert.equal(phase.changes.builds,0);
    assert.equal(phase.changes.evictions,0);
    assert.ok(phase.interval.max>40);
    assert.ok(phase.slowest.length===5);
  }
  assert.ok(stages.includes(T.PLAN[0].label));
  assert.ok(stages.includes(T.PLAN[2].label));
  const text=T.format(report);
  for(const token of ['Turn: 906-06','Knowledge: 906-05',
    'Pan around while zoomed out','Zoom in and out three times',
    'Pan around while zoomed in','Draw CPU','Frame interval',
    'resident','world prepared','generated=18']){
    // Readiness appears in the report header as "World prepared".
    if(token==='world prepared')assert.match(text,/World prepared: yes/);
    else assert.ok(text.includes(token),'Report missing '+token);
  }
  let cancelled=false,seen=0;
  const partial=await T.run({start:origin,
    nextFrame:async()=>{seen++;return seen*16;},render:()=>{},
    snapshot:()=>({builds:0,cachedChunks:0}),
    cancelled:()=>cancelled,
    onProgress:()=>{cancelled=true;},
    now:()=>seen*16,
    meta:{width:800,height:600,date:'today',known:0,total:0}
  });
  assert.equal(partial.status,'cancelled');
  assert.equal(partial.phases.length,1);
  assert.ok(partial.phases[0].frames<90);
  console.log('Terrain Dev diagnostic plan, three zoom cycles, statistics, copyable report and cancellation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

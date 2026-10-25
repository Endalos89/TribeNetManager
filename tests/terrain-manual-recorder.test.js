const assert=require('node:assert/strict');
const {TerrainManualRecorder}=require('../src/terrain-manual-recorder');
(async()=>{
  let time=5000,interval=null,settle=null,reads=0;
  const recorder=new TerrainManualRecorder({
    now:()=>time,clock:()=>new Date(1000).toISOString(),
    every:fn=>{interval=fn;return 99;},
    clearEvery:id=>{assert.equal(id,99);interval=null;},
    later:(fn,ms)=>{assert.equal(ms,2000);settle=fn;}
  });
  recorder.start(()=>({reads:++reads}),{mode:'test'});
  assert.equal(recorder.active,true);
  assert.equal(recorder.events[0].type,'recording-started');
  assert.throws(()=>recorder.start(()=>({})),/already running/);
  time+=150;interval();recorder.event('chunk-disposed',{id:'3:7',reason:'lru'});
  const count=recorder.events.length;
  const result=recorder.stop();
  assert.equal(recorder.stopping,true);
  assert.equal(recorder.events.length,count+1);
  assert.equal(recorder.events.at(-1).type,'idle-observation-start');
  // Stop must NOT finish immediately. The final idle period is sampled
  // without asking the app to call draw(), process input or move the camera.
  time+=500;interval();assert.equal(recorder.active,true);
  time+=1500;settle();
  const report=await result;
  assert.equal(recorder.active,false);
  assert.equal(interval,null);
  assert.equal(report.elapsedMs,2150);
  assert.equal(report.started,'1970-01-01T00:00:01.000Z');
  assert.equal(report.postStopIdleMs,2000);
  assert.equal(report.settings.mode,'test');
  assert.ok(report.events.some(e=>e.type==='chunk-disposed'&&e.id==='3:7'));
  assert.ok(report.events.some(e=>e.type==='passive-sample'&&e.ms===650));
  assert.equal(report.events.at(-1).type,'idle-observation-complete');
  assert.equal(reads,report.events.length,'only snapshot reads, no forced drawing');
  assert.throws(()=>recorder.stop(),/No running recording/);
  console.log('Passive recorder start/stop, event snapshots and post-pan idle observation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

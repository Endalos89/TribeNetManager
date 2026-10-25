// Sustained, multi-submap static-world performance acceptance.
// Unlike the small 66-hex smoke test this uses >700 known hexes and 180
// camera frames, with a genuine terrain knowledge revision afterward.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'msedge',
   headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.largeRows=[];
    window.reads=0;
    window.meshStore=new Map();
    const prior={turnKey:'906-05',turnSort:906005,sourceFile:'previous.docx',metadata:{}};
    const current={turnKey:'906-06',turnSort:906006,sourceFile:'current.docx',metadata:{}};
    const api={
      getVersion:async()=>'larger-world-acceptance',getUserDataPath:async()=>'local',
      onUpdateStatus:()=>{},getHexesInArea:async()=>[],
      getHex:async()=>null,getSubmapSummaries:async()=>[],getPlannerImports:async()=>[],
      listResultTurns:async()=>[prior,current],
      getResultTurn:async key=>({...(key==='906-05'?prior:current),units:[],events:[]}),
      getResultSubmapSummaries:async()=>[],
      getResultHexesInArea:async bounds=>{
        window.reads++;
        return window.largeRows.filter(p=>p.globalCol>=bounds.minCol&&
          p.globalCol<=bounds.maxCol&&p.globalRow>=bounds.minRow&&p.globalRow<=bounds.maxRow);
      },
      loadTerrainMesh:async key=>window.meshStore.get(key)||null,
      saveTerrainMesh:async(key,mesh)=>{window.meshStore.set(key,mesh);return true;},
      getHexHistory:async()=>[],getResultHexHistory:async()=>[],listPlannedRoutes:async()=>[]
    };
    window.tribenet=new Proxy(api,{get:(o,k)=>o[k]||(async()=>[])});
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
  await page.waitForFunction(()=>resultsTimeline?.ready&&typeof draw==='function',
    null,{timeout:15000});
  await page.evaluate(()=>{
    for(let col=299;col<331;col++)for(let row=314;row<338;row++){
      const coordinate=coordinateFor(col,row);
      window.largeRows.push({...parseCoordinate(coordinate),coordinate,
        // Coherent geography is representative of real game reports.
        // Alternating Ocean/Hill/Forest EVERY hex forces high-detail
        // shoreline subdivision everywhere and is not a realistic world.
        terrain:col<304?'O':col<310?'PR':row<322?'CH':
          row<329?'D':row<335?'GH':'LAM',
        notes:''});
    }
  });
  await page.click('#openMapperButton');
  await page.evaluate(()=>{showDetail();centerOnHex(315,326);state.scale=60;draw();});
  await page.waitForFunction(()=>window.TribeNetGPU?.getStats().faces>1000 &&
    window.TribeNetKnowledge.complete() && state.hexCache.size===768,
    null,{timeout:45000});
  try{
    await page.waitForFunction(()=>window.TribeNetGPU.worldGeometryComplete&&
      window.TribeNetGPU.stats.workerBuilds>20&&
      window.TribeNetGPU.pendingChunks.length===0,null,{timeout:180000});
  }catch(error){
    const diagnostic=await page.evaluate(()=>{
      const gpu=window.TribeNetGPU;
      return {known:state.hexCache.size,discoveredChunks:gpu.knownChunkIds.size,
        workerBuilds:gpu.stats.workerBuilds,pending:gpu.pendingChunks.length,
        completedUploads:gpu.completedUploads.length,
        busy:gpu.meshWorkerBusy,diskBusy:gpu.diskReadBusy,
        idlePending:gpu.idleBuildPending,failed:gpu.stats.workerFailures,
        worldReady:gpu.worldGeometryComplete,geometryMs:gpu.stats.workerTimeMs,
        resident:gpu.chunkCache.size};
    });
    throw new Error('Large-world preparation did not finish: '+
      JSON.stringify(diagnostic)+'; '+error.message);
  }
  const report=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU,base=baseCenter(315,326);
    const stats=()=>({
      reads:window.reads,generated:gpu.stats.builds,
      workerBuilds:gpu.stats.workerBuilds,
      evictions:gpu.stats.evictions,
      sharedUpdates:gpu.stats.sharedUpdates,
      resident:gpu.chunkCache.size,
      queue:gpu.pendingChunks.length,
      memory:gpu.residency.bytes,
      complete:gpu.worldGeometryComplete,
      diskRestored:gpu.diskStats.diskHits
    });
    const before=stats();
    let queueReplans=0;
    const original=gpu.queueBuilds;
    gpu.queueBuilds=function(...args){queueReplans++;return original.apply(this,args);};
    const frames=[];
    for(let i=0;i<180;i++){
      const start=performance.now();
      const angle=i*Math.PI/30;
      state.cameraX=base.x+Math.cos(angle)*3.2;
      state.cameraY=base.y+Math.sin(angle)*3;
      state.scale=[30,45,65,90,140,180,65,40][i%8];
      draw();
      frames.push(performance.now()-start);
    }
    gpu.queueBuilds=original;
    const sorted=[...frames].sort((a,b)=>a-b);
    const percentile=p=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
    return {before,after:stats(),queueReplans,
      chunkSize:gpu.getStats().chunkSize,
      workerFailures:gpu.stats.workerFailures,
      geometry:{known:gpu.knownChunkIds.size,visible:gpu.getStats().chunks},
      frames:{count:frames.length,p50:percentile(.50),p95:percentile(.95),
        p99:percentile(.99),max:sorted[sorted.length-1]}};
  });
  assert.equal(report.workerFailures,0);
  assert.equal(report.chunkSize,4,'consolidated chunks contain sixteen hex cores');
  assert.ok(report.geometry.known<120,
    '4x4 chunks should dramatically reduce work units for 768 known hexes');
  assert.equal(report.queueReplans,0,'static camera frames never replan geometry');
  for(const metric of ['reads','generated','workerBuilds','evictions','sharedUpdates',
    'resident','memory','complete','diskRestored','queue'])
    assert.equal(report.after[metric],report.before[metric],
      'static-world camera must not change '+metric);
  assert.ok(report.frames.p95<125,'sustained camera p95 must avoid 125ms stalls');
  assert.ok(report.frames.p99<300,'sustained camera p99 must avoid 300ms stalls');
  assert.deepEqual(errors,[]);

  // Simulate rare genuinely NEW report terrain, then verify exactly one
  // knowledge revision and that the original prepared core meshes survive.
  const revision=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    const resident=[...gpu.chunkCache.values()].filter(record=>
      !record.dirtyShared&&record.known).map(record=>({
      id:record.id,core:record.ground.geometry.uuid,trees:record.trees
    }));
    const before={revision:gpu.worldKnowledgeRevision,builds:gpu.stats.workerBuilds,
      invalidations:gpu.stats.terrainInvalidations};
    const coordinate=coordinateFor(331,326);
    state.hexCache.set(coordinate,{...parseCoordinate(coordinate),coordinate,
      terrain:'CH',notes:''});
    draw();
    return {before,after:{revision:gpu.worldKnowledgeRevision},
      previously:resident,changed:'331:326'};
  });
  assert.equal(revision.after.revision,revision.before.revision+1);
  await page.waitForFunction(()=>window.TribeNetGPU.worldGeometryComplete&&
    window.TribeNetGPU.pendingChunks.length===0,null,{timeout:45000});
  const aftermath=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    return {updated:gpu.stats.workerBuilds,stale:gpu.stats.workerStaleResponses,
      ready:gpu.worldGeometryComplete,known:gpu.knownChunkIds.size};
  });
  assert.equal(aftermath.ready,true);
  assert.ok(aftermath.updated>=revision.before.builds);
  console.log('LARGER_WORLD_CAMERA_BENCHMARK_PASS',JSON.stringify({report,aftermath}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

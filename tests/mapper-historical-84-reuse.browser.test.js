// Regression from live Turn 906-06: 84 known hexes, provisional historical
// hydration, missing resident chunks and repeated close-zoom pan stalls.
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
  page.on('pageerror',e=>errors.push('PAGE '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
  await page.addInitScript(()=>{
    const previous={turnKey:'906-05',turnSort:906005,sourceFile:'results-05.docx',metadata:{}};
    const current={turnKey:'906-06',turnSort:906006,sourceFile:'results-06.docx',metadata:{}};
    const rows=[];
    for(let c=305;c<319;c++)for(let r=324;r<330;r++){
      const column=String.fromCharCode(65+Math.floor(c/30));
      const row=String.fromCharCode(65+Math.floor(r/21));
      const coordinate=column+row+String(c%30+1).padStart(2,'0')+
        String(r%21+1).padStart(2,'0');
      rows.push({coordinate,globalCol:c,globalRow:r,
        terrain:c<307?'O':c<310?'PR':r<327?'CH':'D',notes:''});
    }
    window.historicalRowsRead=0;
    window.savedTerrain=new Map();
    const api={
      getVersion:async()=>'eighty-four-terrain-reuse',getUserDataPath:async()=>'local',
      onUpdateStatus:()=>{},getHexesInArea:async()=>[],
      getHex:async()=>null,getSubmapSummaries:async()=>[],getPlannerImports:async()=>[],
      listResultTurns:async()=>[previous,current],
      getResultTurn:async key=>({...(key==='906-05'?previous:current),units:[],events:[]}),
      getResultSubmapSummaries:async()=>[],
      getResultHexesInArea:async bounds=>{
        window.historicalRowsRead++;
        return rows.filter(row=>row.globalCol>=bounds.minCol&&
          row.globalCol<=bounds.maxCol&&row.globalRow>=bounds.minRow&&
          row.globalRow<=bounds.maxRow);
      },
      getHexHistory:async()=>[],getResultHexHistory:async()=>[],
      listPlannedRoutes:async()=>[],
      loadTerrainMesh:async key=>window.savedTerrain.get(key)||null,
      saveTerrainMesh:async (key,mesh)=>{
        window.savedTerrain.set(key,mesh);return true;
      }
    };
    window.tribenet=new Proxy(api,{get:(o,key)=>o[key]||(async()=>[])});
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
  await page.waitForFunction(()=>resultsTimeline?.ready&&typeof draw==='function',
    null,{timeout:15000});
  await page.click('#openMapperButton');
  await page.evaluate(()=>{showDetail();centerOnHex(311,327);state.scale=130;draw();});
  await page.waitForFunction(()=>
    window.TribeNetKnowledge.complete() &&
    !window.TribeNetKnowledge.fallback()&&
    state.hexCache.size===84&&
    resultsTimeline.lastTerrainLoad?.status==='loaded',
    null,{timeout:25000});
  await page.waitForFunction(()=>{
    const gpu=window.TribeNetGPU;
    return gpu.worldGeometryComplete&&gpu.chunkCache.size===gpu.knownChunkIds.size&&
      gpu.pendingChunks.length===0&&gpu.diskStats.diskWrites>0;
  },null,{timeout:95000});
  // Simulate a late LIVE terrain request while a historical turn is selected.
  // It must not overwrite the historical snapshot or shrink its world bounds.
  const staleLive=await page.evaluate(async()=>{
    const original=window.tribenet.getHexesInArea;
    const before=state.hexCache.size;
    const previousRevision=state.hexCache.terrainRevision;
    const foreign=coordinateFor(510,510);
    window.tribenet.getHexesInArea=async()=>[
      {...parseCoordinate(foreign),coordinate:foreign,terrain:'GH',notes:'stale live read'}
    ];
    try{
      invalidateLoadedSubmaps();
      originalRequestVisibleData();
      await new Promise(resolve=>setTimeout(resolve,150));
      return {before,after:state.hexCache.size,
        revisionChanged:state.hexCache.terrainRevision!==previousRevision,
        foreignPresent:state.hexCache.has(foreign),
        hydrated:window.TribeNetKnowledge.complete(),
        worldLoaded:resultsTimeline.lastTerrainLoad?.status==='loaded',
        historyReads:window.historicalRowsRead};
    }finally{window.tribenet.getHexesInArea=original;}
  });
  assert.equal(staleLive.after,staleLive.before);
  assert.equal(staleLive.revisionChanged,false);
  assert.equal(staleLive.foreignPresent,false);
  assert.ok(staleLive.hydrated&&staleLive.worldLoaded);
  assert.equal(staleLive.historyReads,1,'stale live response cannot trigger extra history loads');
  const baseline=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    const before={
      known:state.hexCache.size,
      targets:gpu.knownChunkIds.size,
      resident:gpu.chunkCache.size,
      builds:gpu.stats.builds,
      invalidations:gpu.stats.terrainInvalidations,
      evictions:gpu.stats.evictions,
      saved:gpu.diskStats.diskWrites,
      readCount:window.historicalRowsRead,
      complete:gpu.worldGeometryComplete,
      fallback:window.TribeNetKnowledge.fallback()
    };
    // A close-zoom view repeatedly enters and leaves different chunk groups.
    // The geometry objects must remain identical, not just numerically equal.
    const meshes=new Map([...gpu.chunkCache].map(([key,v])=>[key,v.group]));
    const times=[];
    for(let i=0;i<90;i++){
      const t=performance.now();
      centerOnHex(i%2?311:318,i%3?327:329);
      state.scale=[175,180,110,45,25][i%5];
      draw();
      times.push(performance.now()-t);
    }
    const after={
      targets:gpu.knownChunkIds.size,resident:gpu.chunkCache.size,
      builds:gpu.stats.builds,invalidations:gpu.stats.terrainInvalidations,
      evictions:gpu.stats.evictions,readCount:window.historicalRowsRead,
      complete:gpu.worldGeometryComplete,
      sameMeshes:[...meshes].every(([key,group])=>gpu.chunkCache.get(key)?.group===group)
    };
    const sorted=times.sort((a,b)=>a-b);
    return {before,after,p95:sorted[Math.ceil(times.length*.95)-1],
      p99:sorted[Math.ceil(times.length*.99)-1]};
  });
  assert.equal(baseline.before.known,84);
  assert.equal(baseline.before.fallback,false,'historical hydration must leave fallback');
  assert.equal(baseline.before.readCount,1,'only one historical world query');
  assert.equal(baseline.before.resident,baseline.before.targets);
  assert.equal(baseline.after.sameMeshes,true,'close zoom must retain same GPU mesh objects');
  for(const key of ['resident','builds','invalidations','evictions','readCount','targets'])
    assert.equal(baseline.after[key],baseline.before[key],'close camera should not alter '+key);
  assert.equal(baseline.after.complete,true);
  assert.ok(baseline.p99<250,'static camera zoom/pan must avoid half-second stalls');
  const postStop=await page.evaluate(async()=>{
    const gpu=window.TribeNetGPU;
    const previousLock=window.TerrainVisibility.get();
    window.TerrainVisibility.set(170);
    const before={resident:gpu.chunkCache.size,hidden:gpu.stats.hiddenChunkEvents,
      workerBuilds:gpu.stats.workerBuilds,evictions:gpu.stats.evictions};
    const names=new Map([...gpu.chunkCache].map(([key,row])=>[key,row.group]));
    try{
      state.scale=190;
      for(let i=0;i<22;i++){
        state.cameraX+=.022;
        state.cameraY+=.009;
        IsoMapper.interact();
        draw();
      }
      await new Promise(resolve=>setTimeout(resolve,420));
      draw();
      return {before,after:{
        resident:gpu.chunkCache.size,hidden:gpu.stats.hiddenChunkEvents,
        workerBuilds:gpu.stats.workerBuilds,evictions:gpu.stats.evictions,
        worldPinned:gpu.worldChunksPinned,
        allShown:[...gpu.chunkCache.values()].every(record=>record.group.visible),
        exactMeshes:[...names].every(([key,group])=>gpu.chunkCache.get(key)?.group===group)
      }};
    }finally{window.TerrainVisibility.set(previousLock);}
  });
  assert.equal(postStop.after.worldPinned,true,'84 known hexes should pin all revealed scene meshes');
  assert.equal(postStop.after.allShown,true,
    'a tiny close-zoom pan and its settle redraw cannot hide known GPU terrain groups');
  assert.equal(postStop.after.exactMeshes,true,
    'no terrain mesh identity may change when interaction finishes');
  for(const key of ['resident','hidden','workerBuilds','evictions'])
    assert.equal(postStop.after[key],postStop.before[key],
      'post-drag settle cannot trigger '+key+' change');
  // Regression: after an authoritative change to an already known hex,
  // the visible core stays mounted while its replacement is prepared.
  // In the old implementation invalidateHexes immediately disposed this
  // mesh, creating a conspicuous hole on the post-pan redraw.
  const staged=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU,ref=coordinateFor(311,327);
    const oldHex=state.hexCache.get(ref);
    const id=Math.floor(311/gpu.getStats().chunkSize)+':'+Math.floor(327/gpu.getStats().chunkSize);
    const prior=gpu.bestResident(id,8);
    if(!prior||!prior.group.visible)throw Error('Known centre mesh is not visible');
    const before={group:prior.group.uuid,geometry:prior.ground.geometry.uuid,
      residents:gpu.chunkCache.size,bytes:gpu.residency.bytes};
    state.hexCache.set(ref,{...oldHex,terrain:oldHex.terrain==='D'?'CH':'D'});
    draw();
    const intermediate=gpu.bestResident(id,8);
    return {id,before,oldStillVisible:intermediate?.group.visible,
      sameGroup:intermediate?.group.uuid===before.group,
      sameGeometry:intermediate?.ground.geometry.uuid===before.geometry,
      dirtyCore:intermediate?.dirtyCore,
      residents:gpu.chunkCache.size,bytes:gpu.residency.bytes};
  });
  assert.ok(staged.oldStillVisible&&staged.sameGroup&&staged.sameGeometry,
    'old core must remain drawn while a changed terrain chunk awaits rebuilding');
  assert.ok(staged.dirtyCore,'a changed known core must be queued for replacement');
  assert.equal(staged.residents,staged.before.residents);
  await page.waitForFunction(id=>{
    const gpu=window.TribeNetGPU,r=gpu.bestResident(id,8);
    return r&&!r.dirtyCore&&gpu.worldGeometryComplete;
  },staged.id,{timeout:90000});
  const swapped=await page.evaluate(id=>{
    const gpu=window.TribeNetGPU,r=gpu.bestResident(id,8);
    return {group:r.group.uuid,visible:r.group.visible,
      present:gpu.chunkGroup.children.includes(r.group),
      resident:gpu.chunkCache.size,bytes:gpu.residency.bytes,
      limit:gpu.residency.maxBytes,dirty:r.dirtyCore};
  },staged.id);
  assert.ok(swapped.visible&&swapped.present,
    'replacement must remain visible and attached to Three.js scene');
  assert.notEqual(swapped.group,staged.before.group,
    'old and newly generated terrain meshes must have different identities');
  assert.equal(swapped.resident,staged.before.residents,
    'atomic replacement does not leak an extra resident chunk');
  assert.ok(swapped.bytes<=swapped.limit,
    'replacement must release the old GPU buffer within the memory budget');
  const grounding=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU,point=baseCenter(311,327);
    const previousRay=gpu.downRay.intersectObjects;
    gpu.downRay.intersectObjects=()=>{throw Error('Unit grounding must not raycast terrain triangles');};
    try{
      const prior=gpu.stats.groundCalculations;
      const first=gpu.renderedGroundHeight({kind:'warriors',x:point.x,y:point.y,z:-1});
      const again=gpu.renderedGroundHeight({kind:'warriors',x:point.x,y:point.y,z:-1});
      return {first,again,calculations:gpu.stats.groundCalculations-prior};
    }finally{gpu.downRay.intersectObjects=previousRay;}
  });
  assert.ok(Number.isFinite(grounding.first));
  assert.equal(grounding.first,grounding.again);
  assert.ok(grounding.calculations<=1);
  // The original zoom lock only changed visibility. Simulate the exact
  // reported case: a historical map with records already in memory, but
  // hydration stuck in temporary fallback while zoomed all the way in.
  // Every known chunk must be queued *before* the camera moves, not lazily
  // discovered when a close-zoom pan reaches an unprepared neighbour.
  const provisional=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU,knowledge=window.TribeNetKnowledge;
    const originalComplete=knowledge.complete,originalReady=knowledge.ready;
    const previousLock=window.TerrainVisibility.get();
    try{
      window.TerrainVisibility.set(195);
      knowledge.complete=()=>false;
      knowledge.ready=()=>true;
      gpu.invalidate();
      state.scale=200;
      centerOnHex(311,327);
      draw();
      const target=[...gpu.knownChunkIds].sort();
      const planned=()=>{
        const plannedIds=new Set([
          ...gpu.chunkCache.values()].map(record=>record.id));
        for(const job of gpu.pendingChunks)plannedIds.add(job.id);
        if(gpu.meshWorkerJob)plannedIds.add(gpu.meshWorkerJob.id);
        for(const item of gpu.completedUploads)plannedIds.add(item.job.id);
        return [...plannedIds].sort();
      };
      const before={
        target,planned:planned(),visible:[...gpu.visibleChunkIds].sort(),
        signature:gpu.queueSignature,revision:gpu.worldKnowledgeRevision,
        resident:gpu.chunkCache.size
      };
      // A tiny pan and two zoom changes must not replan the workset.
      const originalQueue=gpu.queueBuilds;
      let replans=0;
      gpu.queueBuilds=function(...args){
        replans++;return originalQueue.apply(this,args);
      };
      try{
        state.cameraY+=.03;draw();
        state.scale=180;draw();
        state.scale=200;draw();
      }finally{gpu.queueBuilds=originalQueue;}
      return {...before,
        afterPlanned:planned(),afterRevision:gpu.worldKnowledgeRevision,
        afterSignature:gpu.queueSignature,replans};
    }finally{
      knowledge.complete=originalComplete;
      knowledge.ready=originalReady;
      window.TerrainVisibility.set(previousLock);
    }
  });
  assert.ok(provisional.target.length>=10);
  assert.deepEqual(provisional.planned,provisional.target,
    'every known mesh must be planned even in provisional hydration at close zoom');
  assert.deepEqual(provisional.afterPlanned,provisional.target,
    'tiny pan must not discard world geometry preparation targets');
  assert.equal(provisional.replans,0,
    'camera movement cannot trigger chunk loading or queue reconstruction');
  assert.equal(provisional.afterRevision,provisional.revision);
  assert.equal(provisional.afterSignature,provisional.signature);
  assert.deepEqual(errors,[]);
  console.log('HISTORICAL_84_HEX_CAMERA_REUSE_PASS',JSON.stringify({baseline,grounding}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

// Regression for a small revealed-world map: camera movement cannot create
// fog meshes, query history again, or rebuild terrain already fully prepared.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'msedge',
   headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push('PAGE: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE: '+m.text());});
  await page.addInitScript(()=>{
    window.mockRows=[];
    window.historyReads=0;
    window.cachedMeshes=new Map();
    const previous={turnKey:'906-05',turnSort:906005,sourceFile:'0485_906_05_Results.docx',metadata:{}};
    const selected={turnKey:'906-06',turnSort:906006,sourceFile:'0485_906_06_Results.docx',metadata:{}};
    const api={
      getVersion:async()=>'sparse-revealed-terrain',getUserDataPath:async()=>'local',onUpdateStatus:()=>{},
      getHexesInArea:async()=>[],getHex:async()=>null,getSubmapSummaries:async()=>[],
      getPlannerImports:async()=>[],listResultTurns:async()=>[previous,selected],
      getResultTurn:async key=>({...(key==='906-05'?previous:selected),units:[],events:[]}),
      getResultSubmapSummaries:async()=>[],
      getResultHexesInArea:async bounds=>{
        window.historyReads++;
        return window.mockRows.filter(row=>row.globalCol>=bounds.minCol &&
          row.globalCol<=bounds.maxCol && row.globalRow>=bounds.minRow &&
          row.globalRow<=bounds.maxRow);
      },
      loadTerrainMesh:async key=>window.cachedMeshes.get(key)||null,
      saveTerrainMesh:async (key,data)=>{window.cachedMeshes.set(key,data);return true;},
      getHexHistory:async()=>[],getResultHexHistory:async()=>[],listPlannedRoutes:async()=>[]
    };
    window.tribenet=new Proxy(api,{get:(o,k)=>o[k]||(async()=>[])});
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
  await page.waitForFunction(()=>resultsTimeline?.ready && Boolean(document.getElementById('openMapperButton')),
    null,{timeout:15000});
  await page.evaluate(()=>{
    for(let col=310;col<=320;col++)for(let row=324;row<=329;row++){
      const coordinate=coordinateFor(col,row);
      window.mockRows.push({...parseCoordinate(coordinate),coordinate,notes:'',
        terrain:['D','CH','PR','GH','O','LAM'][(col+row)%6]});
    }
  });
  await page.click('#openMapperButton');
  await page.evaluate(()=>{
    showDetail();centerOnHex(315,327);state.scale=52;draw();
  });
  await page.waitForFunction(()=>window.TribeNetKnowledge.complete() &&
    state.hexCache.size===66 && window.TribeNetGPU.getStats().faces>1000,
    null,{timeout:30000});
  await page.waitForFunction(()=>{
    const gpu=window.TribeNetGPU;
    return gpu.knownChunkIds.size>0 && !gpu.diskReadBusy &&
      !gpu.idleBuildPending && gpu.pendingChunks.length===0 &&
      [...gpu.knownChunkIds].every(id=>gpu.chunkCache.has(gpu.chunkKey(id,8)));
  },null,{timeout:120000});
  await page.waitForFunction(()=>window.cachedMeshes.size>0,null,{timeout:15000});
  const report=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    const snapshot=()=>({
      reads:window.historyReads,
      builds:gpu.stats.builds,
      evictions:gpu.stats.evictions,
      invalidations:gpu.stats.terrainInvalidations,
      sharedUpdates:gpu.stats.sharedUpdates,
      cached:gpu.chunkCache.size,
      knownTargets:gpu.knownChunkIds.size,
      fogInActive:[...gpu.activeChunkIds].filter(id=>!gpu.knownChunkIds.has(id)).length,
      saves:window.cachedMeshes.size,
      worldReady:gpu.worldGeometryComplete,
      unitRecalculations:IsoUnits.worldModelStats.recalculations
    });
    const before=snapshot();
    for(const col of [315,345,315,285,315]){
      centerOnHex(col,327);
      for(const zoom of [35,130,180,52]){
        state.scale=zoom;draw();requestVisibleData();
      }
    }
    return {before,after:snapshot()};
  });
  const stationary=await page.evaluate(()=>{
    const p=parseCoordinate(coordinateFor(315,327));
    const sample={people:{Warriors:50,Actives:0,Inactives:0}};
    const first=IsoUnits.layout(p,'0485','Tribe',0,'',sample);
    const before=IsoUnits.worldModelStats;
    let same=true;
    for(const scale of [45,90,180,35,52]){
      state.scale=scale;state.cameraX+=.03;state.cameraY-=.01;
      const next=IsoUnits.layout(p,'0485','Tribe',0,'',sample);
      if(next.models!==first.models)same=false;
    }
    const after=IsoUnits.worldModelStats;
    state.scale=52;centerOnHex(315,327);
    return {same,before,after,hasModels:first.models.length>0};
  });
  assert.ok(stationary.hasModels);
  assert.ok(stationary.same,'zoom and pan must use identical stationary unit world models');
  assert.equal(stationary.after.recalculations,stationary.before.recalculations,
    'camera movement cannot calculate stationary unit ground heights again');
  assert.ok(stationary.after.reused>stationary.before.reused,
    'stationary model world positions should be reused');
  const fidelity=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    const record=[...gpu.chunkCache.values()].find(x=>x.known&&x.faces>1000);
    if(!record)return {missing:true};
    const [cx,cy]=record.id.split(':').map(Number),cells=[];
    for(let c=cx*2;c<cx*2+2;c++)for(let r=cy*2;r<cy*2+2;r++)
      cells.push(gpu.tileAt(c,r));
    const original=gpu.newChunk(cells,gpu.groundFaces,gpu.sampleTerrain,8);
    const check=(a,b)=>{
      const x=a.array,y=b.array;
      if(x.length!==y.length)return {sameLength:false,left:x.length,right:y.length};
      let maxDelta=0;
      for(let i=0;i<x.length;i++)
        maxDelta=Math.max(maxDelta,Math.abs(x[i]-y[i]));
      return {sameLength:true,maxDelta,count:x.length};
    };
    const comparison={
      facesOriginal:original.faces,facesWorker:record.faces,
      treesOriginal:original.trees,treesWorker:record.trees,
      corePos:check(original.ground.geometry.getAttribute('position'),
        record.ground.geometry.getAttribute('position')),
      coreColor:check(original.ground.geometry.getAttribute('color'),
        record.ground.geometry.getAttribute('color')),
      sharedPos:check(original.shared.geometry.getAttribute('position'),
        record.shared.geometry.getAttribute('position')),
      sharedColor:check(original.shared.geometry.getAttribute('color'),
        record.shared.geometry.getAttribute('color'))
    };
    original.ground.geometry.dispose();original.shared.geometry.dispose();
    original.waves?.geometry.dispose();
    original.group.children.filter(x=>x.isInstancedMesh).forEach(x=>x.dispose());
    return comparison;
  });
  assert.ok(!fidelity.missing,'worker-generated known terrain must be available');
  assert.equal(fidelity.facesOriginal,fidelity.facesWorker,'worker must preserve original terrain triangle count');
  assert.equal(fidelity.treesOriginal,fidelity.treesWorker,'worker must preserve original forest density');
  for(const part of ['corePos','coreColor','sharedPos','sharedColor']){
    assert.equal(fidelity[part].sameLength,true,part+' must preserve existing mesh vertex layout');
    assert.ok(fidelity[part].maxDelta<.0001,part+' must visually match the established generator');
  }
  assert.equal(report.before.worldReady,true,
    'when discovered terrain is fully prepared, disable the terrain job scheduler');
  assert.equal(report.after.worldReady,true,
    'zoom/pan must not re-enter the static world terrain scheduling path');
  assert.equal(report.before.reads,1,'only one historical-world query for selected turn');
  const offThread=await page.evaluate(()=>({
    workerBuilds:window.TribeNetGPU.stats.workerBuilds,
    failures:window.TribeNetGPU.stats.workerFailures,
    workerActive:window.TribeNetGPU.meshWorkerReady
  }));
  assert.equal(offThread.failures,0,'terrain worker must not fall back to synchronous generation');
  assert.equal(offThread.workerActive,true,'terrain worker must remain active');
  assert.ok(offThread.workerBuilds>0,'discovered terrain generated off the UI thread');
  assert.equal(report.before.fogInActive,0,'never generate hidden, fog-only chunks');
  assert.equal(report.after.fogInActive,0);
  assert.ok(report.before.cached<=report.before.knownTargets,
    'no unknown fog meshes resident');
  for(const property of ['reads','builds','evictions','invalidations','sharedUpdates','cached','knownTargets','saves'])
    assert.equal(report.after[property],report.before[property],
      'camera-only zoom/pan must not change '+property);
  assert.deepEqual(errors,[]);
  console.log('SPARSE_WORLD_REUSE_PASS',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

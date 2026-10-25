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
    const selected={turnKey:'906-06',turnSort:906006,sourceFile:'0485_906_06_Results.docx',metadata:{}};
    const api={
      getVersion:async()=>'sparse-revealed-terrain',getUserDataPath:async()=>'local',onUpdateStatus:()=>{},
      getHexesInArea:async()=>[],getHex:async()=>null,getSubmapSummaries:async()=>[],
      getPlannerImports:async()=>[],listResultTurns:async()=>[selected],
      getResultTurn:async()=>({...selected,units:[],events:[]}),
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
      saves:window.cachedMeshes.size
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
  assert.equal(report.before.reads,1,'only one historical-world query for selected turn');
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

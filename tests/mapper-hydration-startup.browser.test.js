// Reproduce a completely stalled Electron submap IPC at first mapper launch.
// Regression: the renderer must never remain black with "awaiting submaps 9".
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({
    channel:process.env.CHROME_CHANNEL||'msedge',headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']
  });
  try{
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push('PAGE: '+e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE: '+m.text());});
    await page.addInitScript(()=>{
      window.delayedReads=[];
      window.savedMeshes=new Map();
      const available=new Map();
      const original={
        getVersion:async()=>'hydration-regression',
        getUserDataPath:async()=>'local',
        onUpdateStatus:()=>{},
        getHexesInArea:bounds=>new Promise(resolve=>window.delayedReads.push({bounds,resolve})),
        loadTerrainMesh:async key=>window.savedMeshes.get(key)||null,
        saveTerrainMesh:async(key,mesh)=>{window.savedMeshes.set(key,mesh);return true;},
        getHex:async id=>available.get(id)||null,
        getSubmapSummaries:async()=>[],
        getPlannerImports:async()=>[],
        listResultTurns:async()=>[],
        getHexHistory:async()=>[],
        getResultHexHistory:async()=>[],
        listPlannedRoutes:async()=>[]
      };
      window.tribenet=new Proxy(original,{get:(target,key)=>target[key]||(async()=>[])});
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
    await page.waitForFunction(()=>
      document.querySelector('#openMapperButton')&&typeof showDetail==='function',
      null,{timeout:15000});
    await page.click('#openMapperButton');
    await page.evaluate(()=>{
      showDetail();
      centerOnHex(315,327);
      state.scale=52;
      // Even a few known already cached rows must not cause the mapper to
      // remain blank simply because its neighbours' IPC read is stalled.
      for(let c=314;c<=316;c++)for(let r=326;r<=328;r++){
        const coordinate=coordinateFor(c,r);
        state.hexCache.set(coordinate,{...parseCoordinate(coordinate),
          coordinate,terrain:'PR',notes:''});
      }
      draw();
    });
    await page.waitForFunction(()=>
      window.TribeNetGPU?.initialized&&window.TribeNetKnowledge?.pending()>0&&
      window.delayedReads.length>0,null,{timeout:15000});

    await page.waitForFunction(()=>
      window.TribeNetGPU?.getStats().chunks>0&&
      window.TribeNetGPU?.getStats().knowledgePending===0&&
      window.TribeNetKnowledge?.fallback(),
      null,{timeout:25000});
    const provisional=await page.evaluate(()=>({
      visible:window.TribeNetGPU.getStats().chunks,
      generated:window.TribeNetGPU.getStats().builds,
      pending:window.TribeNetKnowledge.pending(),
      complete:window.TribeNetKnowledge.complete(),
      diskWrites:window.savedMeshes.size
    }));
    assert.ok(provisional.visible>0,'a hung query must not leave the mapper black');
    assert.ok(provisional.pending>0&&!provisional.complete,
      'the fallback must not misreport database knowledge as hydrated');
    assert.equal(provisional.diskWrites,0,
      'provisional meshes must never be saved as permanently known terrain');

    await page.evaluate(()=>{
      const rows=[];
      for(let c=314;c<=316;c++)for(let r=326;r<=328;r++){
        const coordinate=coordinateFor(c,r);
        rows.push({...parseCoordinate(coordinate),coordinate,terrain:'PR',notes:''});
      }
      for(const req of window.delayedReads.splice(0))req.resolve(rows);
    });
    await page.waitForFunction(()=>window.TribeNetKnowledge.complete(),null,{timeout:15000});
    await page.evaluate(()=>{
      // Starting from a clean GPU is equivalent to reopening the same map:
      // fully hydrated meshes can now be generated and persisted.
      window.TribeNetGPU.invalidate();
      draw();
    });
    await page.waitForFunction(()=>window.savedMeshes.size>0,null,{timeout:30000});
    assert.deepEqual(errors,[],'no JavaScript or WebGL errors during fallback/recovery');
    console.log('HYDRATION_STARTUP_PASS',JSON.stringify({
      provisional,recovered:true,knownMeshes:await page.evaluate(()=>window.savedMeshes.size)
    }));
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
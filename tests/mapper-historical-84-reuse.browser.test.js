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
  assert.deepEqual(errors,[]);
  console.log('HISTORICAL_84_HEX_CAMERA_REUSE_PASS',JSON.stringify({baseline,grounding}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

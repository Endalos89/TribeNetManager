// A real document reload destroys all GPU/JS memory while retaining a durable
// IPC-backed mesh store. Previously a same-page invalidate test did not prove
// geometry survives application restart.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'msedge',
   headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const persisted=new Map(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.exposeFunction('meshLoadAcrossRestart',key=>persisted.get(key)||null);
  await page.exposeFunction('meshSaveAcrossRestart',(key,mesh)=>{
    persisted.set(key,mesh);return true;
  });
  await page.addInitScript(()=>{
    const earlier={turnKey:'906-05',turnSort:906005,sourceFile:'90605_Results.docx',metadata:{}};
    const current={turnKey:'906-06',turnSort:906006,sourceFile:'90606_Results.docx',metadata:{}};
    const known=[];
    for(let col=310;col<=320;col++)for(let row=324;row<=329;row++){
      const name=String.fromCharCode(65+Math.floor(row/21))+
        String.fromCharCode(65+Math.floor(col/30))+
        String(col%30+1).padStart(2,'0')+String(row%21+1).padStart(2,'0');
      known.push({coordinate:name,globalCol:col,globalRow:row,
        terrain:['D','CH','PR','GH','O','LAM'][(col+row)%6],notes:''});
    }
    const copy=mesh=>({
      ...mesh,
      positions:Array.from(mesh.positions),
      colors:Array.from(mesh.colors),
      sharedPositions:Array.from(mesh.sharedPositions),
      sharedColors:Array.from(mesh.sharedColors),
      waves:mesh.waves?Array.from(mesh.waves):null,
      instances:(mesh.instances||[]).map(x=>({...x,matrices:Array.from(x.matrices)}))
    });
    const api={
      getVersion:async()=>'restart-reuse-browser',getUserDataPath:async()=>'local',
      onUpdateStatus:()=>{},getHexesInArea:async()=>[],
      getHex:async()=>null,getSubmapSummaries:async()=>[],getPlannerImports:async()=>[],
      listResultTurns:async()=>[earlier,current],
      getResultTurn:async key=>({...(key==='906-05'?earlier:current),units:[],events:[]}),
      getResultSubmapSummaries:async()=>[],
      getResultHexesInArea:async bounds=>known.filter(x=>x.globalCol>=bounds.minCol&&
        x.globalCol<=bounds.maxCol&&x.globalRow>=bounds.minRow&&x.globalRow<=bounds.maxRow),
      getHexHistory:async()=>[],getResultHexHistory:async()=>[],
      listPlannedRoutes:async()=>[],
      loadTerrainMesh:key=>window.meshLoadAcrossRestart(key),
      saveTerrainMesh:(key,mesh)=>window.meshSaveAcrossRestart(key,copy(mesh))
    };
    window.tribenet=new Proxy(api,{get:(target,key)=>target[key]||(async()=>[])});
  });
  const url=pathToFileURL(path.join(__dirname,'../src/index.html')).href;
  await page.goto(url);
  await page.waitForFunction(()=>resultsTimeline?.ready&&typeof draw==='function',null,{timeout:15000});
  await page.click('#openMapperButton');
  await page.evaluate(()=>{showDetail();centerOnHex(315,327);state.scale=52;draw();});
  await page.waitForFunction(()=>window.TribeNetKnowledge?.complete()&&
    window.TribeNetGPU?.stats.workerBuilds>=3&&window.TribeNetGPU.diskStats.diskWrites>=3,
    null,{timeout:60000});
  const first=await page.evaluate(()=>({
    builds:window.TribeNetGPU.stats.workerBuilds,
    saved:window.TribeNetGPU.diskStats.diskWrites,
    fail:window.TribeNetGPU.stats.workerFailures
  }));
  assert.equal(first.fail,0);
  assert.ok(persisted.size>=3);
  // Destroy and recreate the entire renderer (not just the chunk cache).
  await page.reload();
  await page.waitForFunction(()=>resultsTimeline?.ready&&typeof draw==='function',null,{timeout:15000});
  await page.click('#openMapperButton');
  await page.evaluate(()=>{showDetail();centerOnHex(315,327);state.scale=52;draw();});
  await page.waitForFunction(()=>window.TribeNetGPU?.diskStats.diskHits>=1 &&
    window.TribeNetGPU?.getStats().chunks>=1,null,{timeout:45000});
  const restarted=await page.evaluate(()=>({
    hits:window.TribeNetGPU.diskStats.diskHits,
    generated:window.TribeNetGPU.stats.workerBuilds,
    workerFailures:window.TribeNetGPU.stats.workerFailures,
    faces:window.TribeNetGPU.getStats().faces
  }));
  assert.ok(restarted.hits>=1,'restart must restore terrain from permanent mesh store');
  assert.ok(restarted.faces>100,'restored terrain must remain renderable');
  assert.equal(restarted.workerFailures,0);
  assert.deepEqual(errors,[]);
  console.log('APP_RESTART_MESH_CACHE_PASS',JSON.stringify({first,restarted,persisted:persisted.size}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

// Reproduce opening a genuine 906-05 start state after upgrading from a
// renderer that referenced the removed areaRequestTimer global.
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
   page.on('pageerror',error=>errors.push(error.message));
   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
   await page.addInitScript(()=>{
     window.savedMeshes=new Map();
     window.fixtureHistoricalRows=[];
     window.historicalQueryCount=0;
     const units=[{unitCode:'0485',unitType:'Tribe',currentHex:'PK1613',
       previousHex:'PK1613',events:[]}];
     const summaries=['906-04','906-05'].map((turnKey,i)=>({
       turnKey,turnSort:906004+i,sourceFile:'0485_'+turnKey+'_Results.docx',
       metadata:{}
     }));
     const original={
       getVersion:async()=>'legacy-timer-regression',
       getUserDataPath:async()=>'local',onUpdateStatus:()=>{},
       getHexesInArea:async()=>[],
       getHex:async()=>null,getSubmapSummaries:async()=>[],
       getPlannerImports:async()=>[],
       listResultTurns:async()=>summaries,
       getResultTurn:async turnKey=>({
         ...summaries.find(s=>s.turnKey===turnKey),units,events:[]
       }),
       getResultSubmapSummaries:async()=>[],
       getResultHexesInArea:async (bounds,turnKey)=>{
         window.historicalQueryCount++;
         return window.fixtureHistoricalRows.filter(row=>
           row.globalCol>=bounds.minCol&&row.globalCol<=bounds.maxCol&&
           row.globalRow>=bounds.minRow&&row.globalRow<=bounds.maxRow);
       },
       loadTerrainMesh:async key=>window.savedMeshes.get(key)||null,
       saveTerrainMesh:async(key,mesh)=>{window.savedMeshes.set(key,mesh);return true;},
       getHexHistory:async()=>[],getResultHexHistory:async()=>[],
       listPlannedRoutes:async()=>[]
     };
     window.tribenet=new Proxy(original,{get:(target,key)=>target[key]||(async()=>[])});
   });
   await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
   await page.waitForFunction(()=>typeof applyResultTurn==='function' &&
     resultsTimeline.ready && resultsTimeline.turn?.turnKey==='906-05',
     null,{timeout:15000});
   const opened=await page.evaluate(()=>{
     assertLegacyTimer(); // Helper below deliberately calls old loader syntax.
     function assertLegacyTimer(){
       clearTimeout(areaRequestTimer);
       if(typeof areaRequestTimer==='undefined')throw Error('Legacy timer binding missing');
     }
     for(let col=306;col<=324;col++)for(let row=318;row<=336;row++){
       const coordinate=coordinateFor(col,row);
       window.fixtureHistoricalRows.push({
         ...parseCoordinate(coordinate),coordinate,notes:'',
         terrain:['CH','D','GH','PR','O'][(col+row)%5]
       });
     }
     showMapper({overview:false});
     showDetail();
     centerOnHex(315,327);
     state.scale=52;
     draw();
     return {turn:resultsTimeline.turn.turnKey,
       historical:resultsTimeline.turn.knowledgeTurnKey,
       rendererSource:window.TribeNetRuntime?.terrainLoaderRevision,
       historySource:window.TribeNetRuntime?.historicalLoaderRevision};
   });
   assert.equal(opened.turn,'906-05');
   assert.equal(opened.historical,'906-04');
   assert.match(opened.rendererSource,/legacy-timer-compat/);
   assert.match(opened.historySource,/turn-scoped-hydration/);
   await page.waitForFunction(()=>
     state.hexCache.size>=300 &&
     window.TribeNetKnowledge?.complete() &&
     IsoMapper.renderer==='WebGL' &&
     window.TribeNetGPU.getStats().trees>0 &&
     window.TribeNetGPU.getStats().faces>6000,
     null,{timeout:45000});
   const ready=await page.evaluate(()=>({
     known:state.hexCache.size,
     reads:window.historicalQueryCount,
     stats:window.TribeNetGPU.getStats(),
     failure:window.TribeNetGPU.failureReason,
     lastTerrainLoad:resultsTimeline.lastTerrainLoad
   }));
   assert.equal(errors.length,0,errors.join('\n'));
   assert.equal(ready.failure,'');
   assert.ok(ready.reads>0);
   assert.equal(ready.lastTerrainLoad.status,'loaded');
   assert.ok(ready.lastTerrainLoad.count>=300);
   console.log('HISTORICAL_STARTUP_LEGACY_TIMER_PASS',JSON.stringify({opened,ready}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

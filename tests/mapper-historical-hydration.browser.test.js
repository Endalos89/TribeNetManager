// A selected historical Results turn must hydrate its own terrain data.
// Live-world preload returning [] must not unlock historical fog meshes.
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
      window.savedMeshes=new Map();
      window.delayedHistoricalReads=[];
      window.tribenet=new Proxy({
        getVersion:async()=>'historical-regression',
        getUserDataPath:async()=>'local',
        onUpdateStatus:()=>{},
        getHexesInArea:async()=>[],
        getHex:async()=>null,
        getSubmapSummaries:async()=>[],
        getPlannerImports:async()=>[],
        listResultTurns:async()=>[],
        getResultHexesInArea:(bounds,turnKey)=>new Promise(resolve=>{
          window.delayedHistoricalReads.push({bounds,turnKey,resolve});
        }),
        getResultSubmapSummaries:async()=>[],
        loadTerrainMesh:async key=>window.savedMeshes.get(key)||null,
        saveTerrainMesh:async(key,payload)=>{window.savedMeshes.set(key,payload);return true;},
        getHexHistory:async()=>[],
        getResultHexHistory:async()=>[],
        listPlannedRoutes:async()=>[]
      },{get:(t,key)=>t[key]||(async()=>[])});
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
    await page.waitForFunction(()=>
      typeof showDetail==='function'&&typeof IsoMapper!=='undefined'&& resultsTimeline.ready&&
      Boolean(document.querySelector('#openMapperButton')),null,{timeout:15000});
    await page.click('#openMapperButton');
    await page.evaluate(()=>{
      // This reproduces the historical start-state active in the user screenshot.
      resultsTimeline.turn={
        turnKey:'906-05',knowledgeTurnKey:'906-04',baselineTurnKey:'906-04',
        isStartState:true,isPlanningTurn:true,units:[],startHexKnowledge:[]
      };
      state.hexCache.clear();
      state.loadedArea=null;
      showDetail();
      centerOnHex(315,327);
      state.scale=52;
      draw();
    });
    await page.waitForFunction(()=>
      window.delayedHistoricalReads?.length>0 && window.TribeNetKnowledge?.pending()>0
      && IsoMapper.renderer==='WebGL',null,{timeout:15000});
    const requested=await page.evaluate(()=>({turnKey:window.delayedHistoricalReads[0].turnKey,bounds:window.delayedHistoricalReads[0].bounds}));
    assert.equal(requested.turnKey,'906-04','read correct historical baseline');
    assert.ok(requested.bounds.minCol<=315&&requested.bounds.maxCol>=315,
      'historical query includes camera centre');
    await page.waitForTimeout(2750);
    const before=await page.evaluate(()=>({
      pending:window.TribeNetKnowledge.pending(),
      fallback:window.TribeNetKnowledge.fallback(),
      writes:window.savedMeshes.size,
      stats:window.TribeNetGPU.getStats()
    }));
    assert.ok(before.pending>0&&before.fallback,
      'stalled history may render provisional fog but must remain pending');
    assert.equal(before.writes,0,'never permanently save fog while history is loading');
    await page.evaluate(()=>{
      const rows=[];
      for(let col=307;col<=323;col++)for(let row=319;row<=335;row++){
        const coordinate=coordinateFor(col,row);
        const terrain=['D','CH','PR','GH'][(col+row)%4];
        rows.push({...parseCoordinate(coordinate),coordinate,terrain,notes:''});
      }
      for(const req of window.delayedHistoricalReads.splice(0))req.resolve(rows);
    });
    await page.waitForFunction(()=>
      window.TribeNetKnowledge.complete()&&
      window.TribeNetGPU?.getStats().trees>0&&
      window.TribeNetGPU?.getStats().faces>5000&&
      window.savedMeshes.size>0,null,{timeout:45000});
    const after=await page.evaluate(()=>({
      pending:window.TribeNetKnowledge.pending(),
      terrainCells:state.hexCache.size,
      stats:window.TribeNetGPU.getStats(),
      writes:window.savedMeshes.size
    }));
    assert.equal(after.pending,0);
    assert.ok(after.terrainCells>=250,'historical data restored into mapper');
    assert.ok(after.stats.trees>0&&after.stats.faces>5000,
      'historical terrain must contain detailed geometry rather than flat fog');
    assert.deepEqual(errors,[],'no JavaScript error loading historical terrain');
    console.log('HISTORICAL_HYDRATION_PASS',JSON.stringify({before,after}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

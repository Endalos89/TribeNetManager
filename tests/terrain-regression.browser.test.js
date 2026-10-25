// Render real Chromium canvas pixels and catch runtime exceptions that node fake-canvas tests miss.
// Run in CI: npm install --no-save playwright && node tests/mapper-visible-terrain.browser.test.js
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL || 'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  try{
   for(const fixture of [{name:'hill-mountain-coast',col:317,row:327},{name:'landing-cove',col:42,row:100}]){
    const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push('PAGE: '+e.stack));
    page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE: '+m.text());});
    await page.addInitScript(()=>{
      window.fixtureRows=new Map();
      window.savedMeshes=new Map();
      window.areaQueryCount=0;
      const original={
        getVersion:async()=>'browser-smoke',
        getUserDataPath:async()=>'local',
        onUpdateStatus:()=>{},
        getHexesInArea:async()=>{window.areaQueryCount++;return Array.from(window.fixtureRows.values());},
        loadTerrainMesh:async key=>window.savedMeshes.get(key)||null,
        saveTerrainMesh:async (key,mesh)=>{window.savedMeshes.set(key,mesh);return true;},
        getHex:async(id)=>window.fixtureRows.get(id)||null,
        getSubmapSummaries:async()=>[],
        getPlannerImports:async()=>[],
        listResultTurns:async()=>[],
        getHexHistory:async()=>[],
        getResultHexHistory:async()=>[],
        listPlannedRoutes:async()=>[]
      };
      window.tribenet=new Proxy(original,{get:(t,p)=>t[p] || (async()=>[])});
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
    await page.waitForFunction(()=>document.querySelector('#openMapperButton') && typeof IsoMapper!=='undefined' && typeof showDetail==='function',null,{timeout:15000});
    await page.evaluate(({col,row,name})=>{
      for(let c=col-5;c<=col+5;c++)for(let r=row-5;r<=row+5;r++){
        const coordinate=coordinateFor(c,r);
        const terrain=name==='landing-cove'?(c===col&&r===row?'O':'LAM'):
          c>318?'O':c===318?'LAM':c===317?'GH':r<327?'CH':'PR';
        const data={...parseCoordinate(coordinate),coordinate,terrain,notes:''};
        window.fixtureRows.set(coordinate,data);state.hexCache.set(coordinate,data);
      }
    },fixture);
    await page.click('#openMapperButton');
    await page.evaluate(({col,row})=>{showDetail();centerOnHex(col,row);state.scale=140;draw();},fixture);
    await page.waitForFunction(()=>IsoMapper.renderer==='WebGL'&&IsoMapper.gpuStats?.chunks>=1,null,{timeout:30000});
    await page.waitForFunction(()=>!IsoMapper.gpuStats?.queued,null,{timeout:60000});
    await page.waitForTimeout(1000);
    assert.deepEqual(errors,[],'real renderer must have no runtime errors');
    require('node:fs').mkdirSync('terrain-validation',{recursive:true});
    await page.locator('#terrainWebGL').screenshot({path:'terrain-validation/'+fixture.name+'.png'});
    console.log('TERRAIN_RENDER_FIXTURE',fixture.name,await page.evaluate(()=>IsoMapper.gpuStats));
    await page.close();
   }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

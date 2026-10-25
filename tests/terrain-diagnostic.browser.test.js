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
    window.diagRows=[];
    window.diagReadCount=0;
    window.diagSaved=new Map();
    const previous={turnKey:'906-05',turnSort:906005,sourceFile:'90605.docx',metadata:{}};
    const selected={turnKey:'906-06',turnSort:906006,sourceFile:'90606.docx',metadata:{}};
    const api={
      getVersion:async()=>'0.1.diag',getUserDataPath:async()=>'local',onUpdateStatus:()=>{},
      getHexesInArea:async()=>[],getHex:async()=>null,getSubmapSummaries:async()=>[],
      getPlannerImports:async()=>[],listResultTurns:async()=>[previous,selected],
      getResultTurn:async key=>({...(key==='906-05'?previous:selected),units:[],events:[]}),
      getResultSubmapSummaries:async()=>[],
      getResultHexesInArea:async bounds=>{
        window.diagReadCount++;
        return window.diagRows.filter(row=>row.globalCol>=bounds.minCol&&
          row.globalCol<=bounds.maxCol&&row.globalRow>=bounds.minRow&&
          row.globalRow<=bounds.maxRow);
      },
      loadTerrainMesh:async key=>window.diagSaved.get(key)||null,
      saveTerrainMesh:async(key,data)=>{window.diagSaved.set(key,data);return true;},
      getHexHistory:async()=>[],getResultHexHistory:async()=>[],
      listPlannedRoutes:async()=>[]
    };
    window.tribenet=new Proxy(api,{get:(o,k)=>o[k]||(async()=>[])});
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
  await page.waitForFunction(()=>resultsTimeline?.ready&&Boolean(document.getElementById('openMapperButton')),
    null,{timeout:15000});
  await page.evaluate(()=>{
    for(let c=310;c<=320;c++)for(let r=324;r<=329;r++){
      const coordinate=coordinateFor(c,r);
      window.diagRows.push({...parseCoordinate(coordinate),coordinate,notes:'',
        terrain:c<314?'PR':r<328?'D':'CH'});
    }
  });
  await page.click('#openMapperButton');
  await page.evaluate(()=>{showDetail();centerOnHex(315,327);state.scale=75;draw();});
  await page.waitForFunction(()=>{
    const gpu=window.TribeNetGPU;
    return window.TribeNetKnowledge.complete()&&gpu.worldGeometryComplete&&
      gpu.knownChunkIds.size>0&&gpu.chunkCache.size===gpu.knownChunkIds.size;
  },null,{timeout:90000});
  const original=await page.evaluate(()=>({
    cameraX:state.cameraX,cameraY:state.cameraY,scale:state.scale,
    reads:window.diagReadCount,builds:window.TribeNetGPU.stats.builds,
    known:state.hexCache.size
  }));
  await page.click('#terrainDevToggle');
  const firstScreen=await page.evaluate(()=>{
    const panel=document.getElementById('terrainDevPanel');
    const lock=document.querySelector('.terrain-dev-visibility-box');
    const firstSlider=document.querySelector('.terrain-dev-sliders');
    const rect=lock.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    return {exists:Boolean(lock&&document.getElementById('terrainVisibilityZoom')),
      label:lock?.querySelector('strong')?.textContent||'',
      panelScrollTop:panel.scrollTop,lockTop:rect.top,
      lockBottom:rect.bottom,panelTop:panelRect.top,
      panelBottom:panelRect.bottom,firstSliderTop:firstSlider.getBoundingClientRect().top};
  });
  assert.ok(firstScreen.exists,'Terrain Visibility Zoom Lock must be present in the published UI');
  assert.equal(firstScreen.panelScrollTop,0,'visibility lock should show without scrolling');
  assert.equal(firstScreen.label,'Terrain Visibility Zoom Lock');
  assert.ok(firstScreen.lockTop>=firstScreen.panelTop);
  assert.ok(firstScreen.lockBottom<firstScreen.panelBottom,
    'the entire Terrain Visibility Zoom Lock must fit in the initial panel viewport');
  assert.ok(firstScreen.lockBottom<firstScreen.firstSliderTop,
    'visibility lock must appear before the long list of terrain sliders');
  await page.fill('#terrainVisibilityZoomNumber','42');
  await page.locator('#terrainVisibilityZoomNumber').dispatchEvent('change');
  const visibility=await page.evaluate(()=>{
    const gpu=window.TribeNetGPU;
    const before={builds:gpu.stats.builds,resident:gpu.chunkCache.size,
      resets:gpu.stats.fullResets};
    const coverage=[];
    for(const zoom of [70,95,130,170,190]){
      state.scale=zoom;draw();
      coverage.push([...gpu.visibleChunkIds]
        .filter(id=>gpu.knownChunkIds.has(id)).sort());
    }
    state.scale=25;draw();
    const wide=new Set(gpu.visibleChunkIds);
    state.scale=75;draw();
    return {setting:window.TerrainVisibility.get(),
      coverage,wide:[...wide],before,after:{
        builds:gpu.stats.builds,resident:gpu.chunkCache.size,
        resets:gpu.stats.fullResets}};
  });
  assert.equal(visibility.setting,42);
  for(const target of visibility.coverage)
    assert.deepEqual(target,visibility.coverage[0],
      'zooming in must never hide previously visible known terrain chunks');
  for(const id of visibility.coverage[0])
    assert.ok(visibility.wide.includes(id),
      'zooming out farther than virtual zoom must still display all known chunks');
  assert.deepEqual(visibility.after,visibility.before,
    'changing visibility zoom or camera cannot regenerate or dispose terrain');
  await page.click('#terrainRunDiagnostic');
  await page.waitForFunction(()=>{
    const output=document.getElementById('terrainDiagnosticReport');
    return output&&!output.hidden&&output.value.includes('Result: completed');
  },null,{timeout:45000});
  const result=await page.evaluate(()=>({
    text:document.getElementById('terrainDiagnosticReport').value,
    buttonDisabled:document.getElementById('terrainRunDiagnostic').disabled,
    copyHidden:document.getElementById('terrainCopyDiagnostic').hidden,
    stopHidden:document.getElementById('terrainStopDiagnostic').hidden,
    cameraX:state.cameraX,cameraY:state.cameraY,scale:state.scale,
    reads:window.diagReadCount,
    builds:window.TribeNetGPU.stats.builds,
    known:state.hexCache.size
  }));
  assert.equal(result.buttonDisabled,false);
  assert.equal(result.stopHidden,true);
  assert.equal(result.copyHidden,false);
  assert.equal(result.cameraX,original.cameraX);
  assert.equal(result.cameraY,original.cameraY);
  assert.equal(result.scale,original.scale);
  assert.equal(result.reads,original.reads,'diagnostic must not repeat historical queries');
  assert.equal(result.known,original.known,'diagnostic does not modify world knowledge');
  assert.equal(result.builds,original.builds,'fully prepared world remains unchanged');
  for(const snippet of [
    'TribeNet Terrain Dev — Camera Performance Diagnostic',
    'Version: 0.1.diag','Turn: 906-06','Knowledge: 906-05',
    'Result: completed','Fixed GPU visibility zoom 42',
    'Pan around while zoomed out (90 frames)',
    'Zoom in and out three times (144 frames)',
    'Pan around while zoomed in (90 frames)',
    'Draw CPU:', 'Frame interval:', 'Counters Δ:', 'Final: generated='
  ])assert.ok(result.text.includes(snippet),'report missing '+snippet);
  assert.deepEqual(errors,[]);
  console.log('TERRAIN_DEV_RUN_DIAGNOSTIC_BROWSER_PASS',JSON.stringify({
    restored:result.scale,readCount:result.reads,builds:result.builds,
    reportCharacters:result.text.length,sections:3
  }));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

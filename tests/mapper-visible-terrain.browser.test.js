// Render real Chromium canvas pixels and catch runtime exceptions that node fake-canvas tests miss.
// Run in CI: npm install --no-save playwright && node tests/mapper-visible-terrain.browser.test.js
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL || 'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push('PAGE: '+e.stack));
    page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE: '+m.text());});
    await page.addInitScript(()=>{
      window.fixtureRows=new Map();
      const original={
        getVersion:async()=>'browser-smoke',
        getUserDataPath:async()=>'local',
        onUpdateStatus:()=>{},
        getHexesInArea:async()=>Array.from(window.fixtureRows.values()),
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
    // Populate 13x13 genuine-looking discovered terrain records inside a submap.
    const init=await page.evaluate(()=>{
      for(let col=309;col<=321;col++)for(let row=321;row<=333;row++){
        const coordinate=coordinateFor(col,row),terrain=['PR','GH','D','CH','LAM','O'][(col+row)%6];
        const data={...parseCoordinate(coordinate),coordinate,terrain,notes:''};
        window.fixtureRows.set(coordinate,data);
        state.hexCache.set(coordinate,data);
      }
      return {terrainCells:state.hexCache.size};
    });
    await page.click('#openMapperButton');
    await page.evaluate(()=>{
      showDetail();
      centerOnHex(315,327);
      state.scale=52;
      draw();
    });
    await page.waitForFunction(()=>
      typeof IsoMapper!=='undefined' && IsoMapper.renderer==='WebGL' &&
      IsoMapper.gpuStats?.chunks>=1,null,{timeout:30000});
    await page.waitForTimeout(600);
    const actual=await page.evaluate(()=>{
      const overlay=document.querySelector('#mapCanvas'),elem=document.querySelector('#terrainWebGL');
      assertMarker=Boolean(elem && elem.style.display!=='none');
      if(!elem)throw Error('Three.js renderer did not mount a WebGL canvas');
      const w=elem.width,h=elem.height;
      const copy=document.createElement('canvas');copy.width=w;copy.height=h;
      const context=copy.getContext('2d');context.drawImage(elem,0,0);
      const data=context.getImageData(0,0,w,h).data;
      let nonBlack=0,brightGreen=0,blue=0,distinct=new Set();
      for(let y=0;y<h;y+=6)for(let x=0;x<w;x+=6){
        const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
        if(r+g+b>95)nonBlack++;
        if(g>r*1.15 && g>b*.7 && g>70)brightGreen++;
        if(b>r*1.2 && b>g*.7 && b>70)blue++;
        distinct.add([r>>4,g>>4,b>>4].join(','));
      }
      return {overlayBackground:getComputedStyle(overlay).backgroundColor,mode:state.mode,enabled:IsoMapper.enabled,renderer:IsoMapper.renderer,
        gpu:IsoMapper.gpuStats,terrainCache:state.hexCache.size,
        canvas:{w,h},nonBlack,brightGreen,blue,distinct:distinct.size,preloaded:IsoMapper.preloadCount};
    });
    console.log('BROWSER_SMOKE_REPORT',JSON.stringify({actual,errors,init}));
    assert.equal(actual.mode,'detail','entered submap');
    assert.equal(actual.enabled,true,'3D mapper enabled');
    assert.ok(actual.canvas.w>400 && actual.canvas.h>200,'canvas visible');
    assert.equal(actual.renderer,'WebGL','Three.js must be the active renderer');
    assert.ok(actual.overlayBackground==='transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\)/.test(actual.overlayBackground),'transparent Canvas overlay must not hide WebGL terrain');
    assert.ok(actual.gpu?.chunks>=1,'GPU chunks built');
    assert.ok(actual.gpu?.faces>=50,'GPU terrain triangles uploaded');
    assert.ok(actual.gpu?.gpuCalls>=1,'actual WebGL draw calls executed');
    assert.ok(actual.distinct>12,'rendered terrain has nonuniform colours, not one black/fog rectangle');
    assert.ok(actual.brightGreen+actual.blue>120,'actual terrain visible (not all black)');
    assert.equal(errors.length,0,'no browser JS or rendering errors');
    const selection=await page.evaluate(()=>{
      const c=baseCenter(315,327),screen=IsoMapper.project(c,IsoMapper.surface(c.x,c.y).z);
      return {screen,picked:IsoMapper.pick(screen.x,screen.y)};
    });
    assert.equal(selection.picked?.globalCol,315,'WebGL raycasting selects original game hex column');
    assert.equal(selection.picked?.globalRow,327,'WebGL raycasting selects original game hex row');
    const reuse=await page.evaluate(()=>{
      const previous=IsoMapper.gpuStats.builds;
      state.cameraX+=.05;state.cameraY+=.02;draw();
      return {previous,after:IsoMapper.gpuStats.builds};
    });
    assert.ok(reuse.after<=reuse.previous+2,'small camera pans reuse uploaded GPU terrain');
    // A pure camera zoom must reuse the SAME eight-step mesh. No 2/4/12/32
    // terrain variants may be generated at any scale.
    const zoomContinuity=await page.evaluate(()=>{
      const gpu=window.TribeNetGPU;
      const previous=[...gpu.chunkCache].map(([key,v])=>({key,lod:v.lod}));
      const before=IsoMapper.gpuStats.chunks;
      state.scale=81;draw();
      const after=IsoMapper.gpuStats.chunks;
      state.scale=52;draw();
      return {before,after,steps:IsoMapper.gpuStats.terrainSubdivisions,
        oldLods:previous.map(x=>x.lod),
        newLods:[...gpu.chunkCache.values()].map(x=>x.lod)};
    });
    assert.ok(zoomContinuity.before>=1&&zoomContinuity.after>=1,'zoom never blanks resident terrain');
    assert.equal(zoomContinuity.steps,8);
    assert.ok([...zoomContinuity.oldLods,...zoomContinuity.newLods].every(x=>x===8),
      'camera changes must never produce alternate terrain LOD meshes');
    await page.waitForFunction(()=>{
      const gpu=window.TribeNetGPU;
      const id=Math.floor(315/2)+':'+Math.floor(327/2);
      return Boolean(gpu.bestResident(id,gpu.lastLod)?.group.visible);
    },null,{timeout:30000});
    const groundTest=await page.evaluate(()=>{
      const p=baseCenter(315,327);
      const height=window.TribeNetGPU.renderedGroundHeight({x:p.x,y:p.y,z:-.1});
      const field=IsoMapper.surface(p.x,p.y).z;
      return {height,field,cache:window.TribeNetGPU.groundHeightCache.size};
    });
    assert.ok(groundTest.height>=groundTest.field-.02,'GPU unit grounding never drops below computed landscape');
    assert.ok(groundTest.cache>=1,'rendered triangle height is cached for repeated unit draws');
    const unitTest=await page.evaluate(()=>{
      const gpu=window.TribeNetGPU,p=baseCenter(315,327);
      const model={x:p.x,y:p.y,z:-1,kind:'warriors',mounted:false,heading:0};
      const ground=gpu.renderedGroundHeight(model);
      gpu.units=[model];
      gpu.updateUnits();
      const instance=gpu.unitMeshes.get('body'),matrix=instance.instanceMatrix.array;
      const y=matrix[13],scale=matrix[5];
      const bottom=y-instance.geometry.parameters.height*scale/2;
      return {ground,scale,bottom,reportedScale:gpu.getStats().unitModelScale};
    });
    assert.equal(unitTest.reportedScale,.5,'all unit models use half scale');
    assert.ok(Math.abs(unitTest.scale-.5)<1e-6,'GPU body mesh is half height');
    assert.ok(unitTest.bottom>=unitTest.ground,
      'model feet remain above visible terrain despite low analytic height');
    const numericTuning=await page.evaluate(()=>{
      document.getElementById('terrainDevToggle').click();
      const field=document.getElementById('terrain-number-waterHeight');
      if(!field)throw Error('Terrain Dev numeric water height is missing');
      field.value='0.125';
      field.dispatchEvent(new Event('change',{bubbles:true}));
      return {value:TerrainSettings.value('waterHeight'),
        range:Number(document.getElementById('terrain-dev-waterHeight').value),
        exported:JSON.parse(TerrainSettings.exportPreset()).settings.waterHeight};
    });
    assert.equal(numericTuning.value,.125);
    assert.equal(numericTuning.range,.125);
    assert.equal(numericTuning.exported,.125);
    const limits=await page.evaluate(()=>({
      hill:TerrainSettings.definitions.hillAmplitude.min,
      mountain:TerrainSettings.definitions.mountainHeight.min,
      sea:TerrainSettings.definitions.waterHeight.max,
      coast:TerrainSettings.definitions.shoreDetail.default
    }));
    assert.equal(limits.hill,0);
    assert.equal(limits.mountain,0);
    assert.ok(limits.sea>=.45);
    assert.equal(limits.coast,20);
    const preset=await page.evaluate(()=>TerrainSettings.defaults());
    assert.equal(preset.waterHeight,.5);
    assert.equal(preset.coastWaterShare,.35);
    assert.equal(preset.hillAmplitude,.2);
    assert.equal(preset.treeDensity,4.75);
    console.log('Mapper real-WebGL terrain smoke passed');
  } finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

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
      return {mode:state.mode,enabled:IsoMapper.enabled,renderer:IsoMapper.renderer,
        gpu:IsoMapper.gpuStats,terrainCache:state.hexCache.size,
        canvas:{w,h},nonBlack,brightGreen,blue,distinct:distinct.size,preloaded:IsoMapper.preloadCount};
    });
    console.log('BROWSER_SMOKE_REPORT',JSON.stringify({actual,errors,init}));
    assert.equal(actual.mode,'detail','entered submap');
    assert.equal(actual.enabled,true,'3D mapper enabled');
    assert.ok(actual.canvas.w>400 && actual.canvas.h>200,'canvas visible');
    assert.equal(actual.renderer,'WebGL','Three.js must be the active renderer');
    assert.ok(actual.gpu?.chunks>=1,'GPU chunks built');
    assert.ok(actual.gpu?.faces>=50,'GPU terrain triangles uploaded');
    assert.ok(actual.gpu?.gpuCalls>=1,'actual WebGL draw calls executed');
    assert.ok(actual.distinct>12,'rendered terrain has nonuniform colours, not one black/fog rectangle');
    assert.ok(actual.brightGreen+actual.blue>120,'actual terrain visible (not all black)');
    assert.equal(errors.length,0,'no browser JS or rendering errors');
    const reuse=await page.evaluate(()=>{
      const previous=IsoMapper.gpuStats.builds;
      state.cameraX+=.05;state.cameraY+=.02;draw();
      return {previous,after:IsoMapper.gpuStats.builds};
    });
    assert.ok(reuse.after<=reuse.previous+2,'small camera pans reuse uploaded GPU terrain');
    console.log('Mapper real-WebGL terrain smoke passed');
  } finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

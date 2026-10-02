// Optional browser check: npm install --no-save playwright, then node tests/isometric-browser.test.js
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
 window.fixtureRows=new Map();window.tribenet=new Proxy({
 getVersion:async()=>'Browser fixture',getUserDataPath:async()=>'Fixture data',onUpdateStatus:()=>{},
 getHexesInArea:async()=>[...window.fixtureRows.values()],getHex:async(c)=>window.fixtureRows.get(c)||null,
 saveHex:async(h)=>{window.fixtureRows.set(h.coordinate,h);return h;},clearHex:async(c)=>{window.fixtureRows.delete(c);return true;},
 getSubmapSummaries:async()=>[],getPlannerImports:async()=>[],listResultTurns:async()=>[],getHexHistory:async()=>[],listPlannedRoutes:async()=>[]
 },{get:(target,key)=>target[key]|| (async()=>null)});
 });
 await page.goto(pathToFileURL(path.join(__dirname,'../src/index.html')).href);
 await page.waitForTimeout(400);await page.click('#openIsometricMapperButton');
 await page.evaluate(()=>{showDetail();centerOnHex(315,327);const ts=['O','O','PR','D','CH','ALPS','DE','SW','GH','JG','L'];for(let c=306;c<326;c++)for(let r=319;r<337;r++){if(c>322 || r>334)continue;const ref=coordinateFor(c,r),data={...parseCoordinate(ref),terrain:ts[Math.floor((c-306)/2)%ts.length],notes:r===327?'[Rivers: N, NE]':''};window.fixtureRows.set(ref,data);state.hexCache.set(ref,data);}state.scale=62;draw();});
 await page.waitForTimeout(180);
 await page.fill('#coordinateInput','PK1613');await page.click('#goCoordinateButton');
 await page.waitForTimeout(180);assert.equal(await page.textContent('#selectedCoordinate'),'PK1613');
 assert.equal(await page.locator('#riverEdgeEditor input[value=N]').isChecked(),true);
 await page.locator('#riverEdgeEditor input[value=SW]').check();await page.click('#saveHexButton');
 assert.match(await page.textContent('#saveStatus'),/Saved/);
 assert.match(await page.evaluate(()=>window.fixtureRows.get('PK1613').notes),/SW/);
 // Cursor-centred zoom is invariant; a click still selects the projected hex.
 const click=await page.evaluate(()=>{const p=screenFromBase(baseCenter(316,328)),r=canvas.getBoundingClientRect();const before=baseFromScreen(p.x,p.y);setZoom(45,p.x,p.y);clearTimeout(areaRequestTimer);const after=baseFromScreen(p.x,p.y);return {x:r.left+p.x,y:r.top+p.y,error:Math.hypot(before.x-after.x,before.y-after.y),ref:coordinateFor(316,328)};});
 assert.ok(click.error<1e-8);await page.mouse.click(click.x,click.y);await page.waitForTimeout(80);assert.equal(await page.textContent('#selectedCoordinate'),click.ref);
 // The projected terrain point keeps its elevation offset while dragging.
 const drag=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,camera:{x:state.cameraX,y:state.cameraY},anchor:screenFromBase({x:state.cameraX,y:state.cameraY})};});
 await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.x+90,drag.y+40);await page.mouse.up();
 const pan=await page.evaluate(c=>{const p=screenFromBase(c),r=canvas.getBoundingClientRect();return {x:p.x,y:p.y};},drag.camera);
 assert.ok(Math.abs(pan.x-drag.anchor.x-90)<.01&&Math.abs(pan.y-drag.anchor.y-40)<.01);
 await page.evaluate(()=>{centerOnHex(315,327);state.scale=62;draw();});await page.waitForTimeout(100);

 const zoom=await page.evaluate(()=>{setZoom(180);return state.scale;});assert.equal(zoom,180);
 const north=await page.evaluate(()=>{const a=IsoGeometry.project(0,0),b=IsoGeometry.project(0,-1);return {x:b.x-a.x,y:b.y-a.y};});assert.equal(north.x,0);assert.ok(north.y<0);
 await page.click('#backButton');await page.click('#openMapperButton');
 assert.equal(await page.evaluate(()=>IsoMapper.enabled),false);
 await page.evaluate(()=>{showDetail();centerOnHex(315,327);});await page.waitForTimeout(100);
 await page.fill('#coordinateInput','PK1613');await page.click('#goCoordinateButton');
 assert.equal(await page.textContent('#selectedCoordinate'),'PK1613');
 assert.equal(await page.locator('#riverEdgeEditor input[value=SW]').isChecked(),true);
 await page.evaluate(()=>{resultsTimeline.turn={turnKey:'906-04'};setHistoricalEditingState(true);});
 await page.waitForTimeout(30);assert.equal(await page.locator('#riverEdgeEditor input[value=N]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: launcher, 3D rendering, selection, river editing/save, cursor zoom, drag pan, classic mapper, shared notes and historical read-only controls; no browser errors.');await browser.close();
})();

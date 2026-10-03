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
 getSubmapSummaries:async()=>[],getPlannerImports:async()=>[],listResultTurns:async()=>[],getHexHistory:async()=>[],getResultHexHistory:async()=>[],listPlannedRoutes:async()=>[]
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
 // Show both report-based foot groups and planner-based mounted groups.
 await page.evaluate(()=>{
   state.scale=110;centerOnHex(315,327);clearTimeout(areaRequestTimer);
   for(const r of [325,326]){const ref=coordinateFor(315,r);window.fixtureRows.delete(ref);state.hexCache.delete(ref);}
   state.planImport={turnKey:'906-04',plan:{movements:[],scouts:[],unitStats:[{unit:'0485e1',warrior:12,active:30,inactive:8,totalPeople:50,horseCount:50,wagonCount:0}]}};
   resultsTimeline.turn={turnKey:'906-04',units:[
     {unitCode:'0485',unitType:'Tribe',currentHex:coordinateFor(315,327),people:{Warriors:50,Actives:120,Inactives:80,People:250},resources:{Animals:{Horse:75},Goods:{Wagon:16}}},
     {unitCode:'0485e1',unitType:'Element',currentHex:coordinateFor(316,328),people:{Warriors:12,Actives:30,Inactives:8,People:50},resources:{Animals:{Horse:50}}}
   ]};
   state.routeCache={movements:[],scouts:[],movementWarnings:[],scoutWarnings:[]};draw();
 });
 await page.waitForTimeout(200);
 const markers=await page.evaluate(()=>{
   const u=resultsTimeline.turn.units[0],point=parseCoordinate(u.currentHex),box=IsoUnits.layout(point,u.unitCode,u.unitType,0,'',u);
   const mounted=IsoUnits.layout(parseCoordinate(coordinateFor(316,328)),'0485e1','Element');
   return {box,mounted};
 });
 assert.equal(markers.box.models.length,11);assert.ok(markers.box.models.every(m=>Number.isFinite(m.z))); assert.equal(markers.box.counts.mounted,false);assert.equal(markers.mounted.counts.mounted,true);assert.equal(markers.mounted.models.length,7);
 const hover=await page.evaluate(()=>{const b=IsoUnits.layout(parseCoordinate(coordinateFor(315,327)),'0485','Tribe',0,'',resultsTimeline.turn.units[0]),r=canvas.getBoundingClientRect();return {x:r.left+b.x+b.w/2,y:r.top+b.y+b.h/2};});
 await page.mouse.move(hover.x,hover.y);assert.match(await page.getAttribute('#mapCanvas','title'),/50 warriors, 120 actives, 80 inactives/);
 if(process.env.ISO_SCREENSHOT)await page.screenshot({path:process.env.ISO_SCREENSHOT});
 const interaction=await page.evaluate(()=>{
   const builds=IsoMapper.sceneBuilds;
   for(let i=0;i<6;i++){IsoMapper.interact();state.scale*=1.03;state.cameraX+=.05;draw();}
   const t=resultsTimeline.turn.units[0],point=parseCoordinate(t.currentHex),p=screenFromBase(baseCenter(point.globalCol,point.globalRow));
   return {builds,current:IsoMapper.sceneBuilds,pick:IsoMapper.pick(p.x,p.y),point};
 });
 assert.equal(interaction.current,interaction.builds,'reuse the terrain during a navigation gesture');
 assert.equal(interaction.pick.globalCol,interaction.point.globalCol);assert.equal(interaction.pick.globalRow,interaction.point.globalRow);
 await page.waitForTimeout(220);assert.ok(await page.evaluate(n=>IsoMapper.sceneBuilds>n,interaction.builds),'render a sharp landscape after navigation settles');
 // Planner hitboxes include the entire illustration, and still open logistics.
 const hit=await page.evaluate(()=>{
   const point=parseCoordinate(coordinateFor(316,328));
   state.routeCache.movements=[{unit:'0485e1',type:'Element',route:{points:[point],unresolved:[]}}];draw();
   const b=plannerLabelHitboxes()[0];return {unit:plannerUnitLabelAt(b.x+b.w/2,b.y+b.h-4)?.unit};
 });assert.equal(hit.unit,'0485e1');
 // Real clicks: two reported units without orders overlay, then the land.
 await page.evaluate(()=>{state.planningVisible=false;state.planImport=null;state.routeCache=null;resultsTimeline.turn.units[1].currentHex=resultsTimeline.turn.units[0].currentHex;draw();});
 const unitClick=async()=>{const p=await page.evaluate(()=>{const h=parseCoordinate(resultsTimeline.turn.units[0].currentHex),p=screenFromBase(baseCenter(h.globalCol,h.globalRow)),r=canvas.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y};});await page.mouse.click(p.x,p.y);await page.waitForTimeout(40);};
 await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),'0485');assert.match(await page.textContent('#unitTurnContext'),/reported state/);assert.equal(await page.locator('#unitEditor').isVisible(),true);
 await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),'0485e1');assert.equal(await page.textContent('#unitPeople'),'50');
 await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),null);assert.equal(await page.evaluate(()=>state.selected.coordinate),await page.evaluate(()=>resultsTimeline.turn.units[0].currentHex));assert.equal(await page.locator('#selectionEditor').isVisible(),true);
 await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),'0485');
 // A selected unit is cleared when the report turn changes.
 await page.evaluate(()=>{resultsTimeline.turn={...resultsTimeline.turn,turnKey:'906-05'};draw();});assert.equal(await page.evaluate(()=>state.selectedUnit),null);
 await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),'0485');
 // Planning mode bypasses the unit cycle and retains land selection.
 await page.evaluate(()=>{movementPlannerState.active=true;movementPlannerState.origin=null;});await unitClick();assert.equal(await page.evaluate(()=>state.selectedUnit),null);
 await page.evaluate(()=>{movementPlannerState.active=false;resultsTimeline.turn=null;state.planImport=null;state.routeCache=null;state.planningVisible=true;draw();});
 const north=await page.evaluate(()=>{const a=IsoGeometry.project(0,0),b=IsoGeometry.project(0,-1);return {x:b.x-a.x,y:b.y-a.y};});assert.equal(north.x,0);assert.ok(north.y<0);
 await page.click('#backButton');await page.click('#openMapperButton');
 assert.equal(await page.evaluate(()=>IsoMapper.enabled),false);
 await page.evaluate(()=>{showDetail();centerOnHex(315,327);});await page.waitForTimeout(100);
 await page.fill('#coordinateInput','PK1613');await page.click('#goCoordinateButton');
 assert.equal(await page.textContent('#selectedCoordinate'),'PK1613');
 assert.equal(await page.locator('#riverEdgeEditor input[value=SW]').isChecked(),true);
 await page.evaluate(()=>{resultsTimeline.turn={turnKey:'906-04'};setHistoricalEditingState(true);});
 await page.waitForTimeout(30);assert.equal(await page.locator('#riverEdgeEditor input[value=N]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: launcher, 3D rendering, selection, river editing/save, cursor zoom, drag pan, classic mapper, shared notes, historical controls, unit figures, marker hitboxes and navigation cache; no browser errors.');await browser.close();
})();

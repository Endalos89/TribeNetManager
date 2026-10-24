// Regression: launcher navigation must not rely on 3D rendering, and the
// optional isometric view must never register a competing Mapper click handler.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const iso=fs.readFileSync(path.join(__dirname,'../src/isometric-mapper.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');

assert.match(renderer,/\$\('openMapperButton'\)\.addEventListener\('click', showMapper\)/);
assert.doesNotMatch(iso,/\$\('openMapperButton'\)\.addEventListener\('click'/,'only renderer owns the Mapper launch event');
const setEnabled=iso.slice(iso.indexOf('function setEnabled('),iso.indexOf('function setup()'));
assert.ok(setEnabled.length>0);
assert.doesNotMatch(setEnabled,/\bshowMapper\s*\(/,'render mode toggling must not navigate recursively');
assert.match(html,/id="openMapperButton"/);

const start=renderer.indexOf('function showMapper(options = {}) {');
const end=renderer.indexOf('\nfunction showOverview()',start);
assert.ok(start>=0 && end>start);

function fixture({throw3d=false,enabled=false,toggle=true,detail=false}={}){
 const elements=new Map();
 function elem(id) {
  if (!elements.has(id))elements.set(id,{
   checked:id==='mapperViewToggle'?toggle:false,textContent:'',
   hidden:id==='launcherView'?false:true,
   classList: {
    classes:new Set(id==='mapperView' ? ['hidden']:[]),
    add(n){this.classes.add(n);},
    remove(n){this.classes.delete(n);},
    contains(n){return this.classes.has(n);}
   }
  });
  return elements.get(id);
 }
 let calls=0,opened=0,resized=0;
 const vmContext={
  $:elem,
  document:{body:{classList:{remove(){}}}},
  console:{error(){}},
  IsoMapper:{enabled,setEnabled(){calls++;if(throw3d)throw Error('terrain initialisation failed');this.enabled=true;}},
  state:{mode:detail?'detail':'overview'},
  showOverview(){opened++;},
  resizeCanvas(){resized++;},
  requestVisibleData(){},
  draw(){}
 };
 vm.runInNewContext(renderer.slice(start,end)+'\nthis.launch=showMapper;',vmContext);
 return {launch:vmContext.launch,elements,calls:()=>calls,opened:()=>opened,resized:()=>resized,mode:vmContext.IsoMapper};
}
// Normal launcher click: the entire view opens and 3D turns on exactly once.
let x=fixture();
x.launch({type:'click'});
assert.equal(x.opened(),1);
assert.equal(x.calls(),1);
assert.equal(x.mode.enabled,true);
assert.equal(x.elements.get('launcherView').classList.contains('hidden'),true);
assert.equal(x.elements.get('mapperView').classList.contains('hidden'),false);

// If 3D raises a rendering error the user still gets the classic mapper.
x=fixture({throw3d:true});
x.launch({type:'click'});
assert.equal(x.opened(),1);
assert.equal(x.calls(),1);
assert.equal(x.elements.get('mapperView').classList.contains('hidden'),false);
assert.equal(x.elements.get('mapperViewToggle').checked,false);
assert.match(x.elements.get('planStatus').textContent,/classic mapper/i);

// Existing classical-map preferences must remain respected.
x=fixture({toggle:false});
x.launch({});
assert.equal(x.calls(),0);
assert.equal(x.opened(),1);

// Existing details can be returned to without two draw/navigation passes.
x=fixture({enabled:true,detail:true});
x.launch({overview:false});
assert.equal(x.calls(),0);
assert.equal(x.resized(),1);
assert.equal(x.opened(),0);
console.log('Mapper launcher opens once, respects classic selection and survives 3D initialisation failures.');

/* Optional local-only terrain tuning panel. No world-rule changes or automatic upload. */
(function(root){
 'use strict';
 const tuning=root.TerrainSettings;
 if(!tuning || !root.document)return;
 let showRegions=false;
 const $=id=>document.getElementById(id);
 const drawNow=()=>{
   if(typeof IsoMapper!=='undefined' && IsoMapper.invalidateTerrain)IsoMapper.invalidateTerrain();
   if(typeof root.draw==='function' && typeof IsoMapper!=='undefined' && IsoMapper.enabled)root.draw();
 };
 function setup(){
  const controls=$('isoViewControls'),wrap=$('canvasWrap');
  if(!controls || !wrap || $('terrainDevToggle'))return;
  const toggle=document.createElement('button');
  toggle.type='button';toggle.id='terrainDevToggle';toggle.className='button';toggle.textContent='Terrain Dev';
  toggle.title='Adjust local terrain constants, preview changes and export a preset.';
  controls.appendChild(toggle);
  const panel=document.createElement('section');panel.id='terrainDevPanel';panel.className='terrain-dev-panel hidden';
  panel.setAttribute('aria-label','Terrain development tuning');
  const head=document.createElement('div');head.className='terrain-dev-head';
  head.innerHTML='<strong>Terrain development mode</strong><small>Local preview only · permanent seed 1790425012</small>';
  panel.appendChild(head);
  const sliders=document.createElement('div');sliders.className='terrain-dev-sliders';
  const fields=new Map();
  for(const [name,definition] of Object.entries(tuning.definitions)){
    const row=document.createElement('label');row.className='terrain-dev-row';
    const text=document.createElement('span');text.textContent=definition.label;
    const range=document.createElement('input');range.type='range';range.id='terrain-dev-'+name;
    range.min=definition.min;range.max=definition.max;range.step=definition.step;
    const number=document.createElement('input');number.type='number';number.className='terrain-dev-number';
    number.min=definition.min;number.max=definition.max;number.step=definition.step;
    number.id='terrain-number-'+name;number.setAttribute('aria-label',definition.label+' numeric value');
    const decimals=definition.step>=1?0:definition.step<.01?3:definition.step<.1?2:1;
    let timer=null;
    const update=()=>{const value=tuning.value(name);range.value=value;number.value=Number(value).toFixed(decimals);};
    const commit=value=>{
      if(!Number.isFinite(value)){update();return;}
      const applied=tuning.set({[name]:value});
      range.value=applied[name];number.value=Number(applied[name]).toFixed(decimals);
      drawNow();
    };
    range.addEventListener('input',()=>{
      number.value=Number(range.value).toFixed(decimals);
      if(timer!==null)clearTimeout(timer);
      timer=setTimeout(()=>{timer=null;commit(Number(range.value));},160);
    });
    range.addEventListener('change',()=>{
      if(timer!==null){clearTimeout(timer);timer=null;}
      commit(Number(range.value));
    });
    number.addEventListener('change',()=>{
      if(timer!==null){clearTimeout(timer);timer=null;}
      if(number.value.trim()===''){update();return;}
      commit(Number(number.value));
    });
    number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();number.blur();}});
    update();
    row.append(text,range,number);sliders.appendChild(row);fields.set(name,{range,number,update});
  }
  panel.appendChild(sliders);
  const regionLabel=document.createElement('label');regionLabel.className='terrain-dev-regions';
  const regionInput=document.createElement('input');regionInput.type='checkbox';
  regionInput.addEventListener('change',()=>{showRegions=regionInput.checked;drawNow();});
  regionLabel.append(regionInput,document.createTextNode(' Show core / square / triangle boundaries'));panel.appendChild(regionLabel);
  const actions=document.createElement('div');actions.className='terrain-dev-actions';
  const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='button accent';exportButton.textContent='Export settings';
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.className='button';resetButton.textContent='Reset defaults';
  const importButton=document.createElement('button');importButton.type='button';importButton.className='button';importButton.textContent='Import preset';
  const feedback=document.createElement('div');feedback.className='terrain-dev-feedback';feedback.setAttribute('role','status');
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.className='hidden';
  exportButton.addEventListener('click',()=>{
    const content=tuning.exportPreset(),blob=new Blob([content],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='TribeNet-Terrain-Settings.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    feedback.textContent='Preset saved. Send me this JSON when you are happy with the terrain.';
  });
  resetButton.addEventListener('click',()=>{tuning.reset();for(const [name,f] of fields){f.range.value=tuning.value(name);f.update();}drawNow();feedback.textContent='Defaults restored.';});
  importButton.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    try{tuning.importPreset(await selected.text());for(const [name,f] of fields){f.range.value=tuning.value(name);f.update();}drawNow();feedback.textContent='Preset loaded for local preview.';}
    catch(error){feedback.textContent=error.message||'Could not read preset.';}finally{file.value='';}
  });
  actions.append(exportButton,importButton,resetButton);
  const performance=document.createElement('div');
  performance.className='terrain-dev-feedback';
  performance.setAttribute('aria-live','off');
  performance.textContent='WebGL statistics are available when the 3D Mapper is visible.';
  panel.append(actions,file,feedback,performance);wrap.appendChild(panel);
  // No background timers while Terrain Dev is closed.
  let statsTimer=null;
  function updateStats(){
    const info=root.TribeNetGPU?.getStats();
    performance.textContent=info&&root.TribeNetGPU?.visible
      ? 'GPU: '+info.chunks+' chunks · '+info.faces.toLocaleString()+
        ' triangles · '+info.trees+' trees · '+info.gpuCalls+
        ' draw calls · '+info.renderMs.toFixed(1)+' ms GPU submission' +
        ' · Disk restored '+info.diskHits+' · generated '+info.builds+
        ' · saved '+info.diskWrites+' · misses '+info.diskMisses+
        ' · resident '+info.cachedChunks+' · queued '+info.queuedChunks+
        ' · nearby prefetch '+info.prefetchTarget+' · evicted '+info.evictions
      : 'WebGL is inactive (software fallback or classic view).';
  }
  toggle.addEventListener('click',()=>{
    const open=panel.classList.toggle('hidden')===false;
    toggle.classList.toggle('active',open);toggle.setAttribute('aria-expanded',String(open));
    if(statsTimer!==null){clearInterval(statsTimer);statsTimer=null;}
    if(open){updateStats();statsTimer=setInterval(updateStats,750);}
  });
  toggle.setAttribute('aria-expanded','false');
 }
 const api={setup,get showRegions(){return showRegions;}};
 root.TerrainDevMode=api;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})(typeof window!=='undefined'?window:globalThis);

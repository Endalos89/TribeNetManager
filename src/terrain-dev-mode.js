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
  const retryButton=document.createElement('button');retryButton.type='button';retryButton.className='button';retryButton.textContent='Retry WebGL';
  retryButton.title='Discard GPU meshes and try to recreate the graphics context. Does not delete map data.';
  retryButton.addEventListener('click',()=>{
    const gpu=root.TribeNetGPU;
    if(!gpu?.retry){feedback.textContent='No WebGL renderer is available to retry.';return;}
    try{gpu.retry();feedback.textContent=gpu.failed?'WebGL retry failed: '+gpu.failureReason:'WebGL restart requested.';}
    catch(error){feedback.textContent='WebGL retry failed: '+(error?.message||String(error));}
    updateStats();
  });
  const copyButton=document.createElement('button');copyButton.type='button';copyButton.className='button';copyButton.textContent='Copy diagnostics';
  copyButton.addEventListener('click',async()=>{
    try{
      await navigator.clipboard.writeText(performance.textContent);
      feedback.textContent='Diagnostics copied.';
    }catch(error){feedback.textContent='Clipboard unavailable; please select and copy the diagnostics text.';}
  });
  actions.append(exportButton,importButton,resetButton,retryButton,copyButton);
  const performance=document.createElement('div');
  performance.className='terrain-dev-feedback';
  performance.setAttribute('aria-live','off');
  performance.textContent='WebGL statistics are available when the 3D Mapper is visible.';
  panel.append(actions,file,feedback,performance);wrap.appendChild(panel);
  // No background timers while Terrain Dev is closed.
  let statsTimer=null;
  function updateStats(){
    const gpu=root.TribeNetGPU;
    const info=gpu?.getStats();
    // IsoMapper is declared with top-level const in isometric-mapper.js;
    // it is NOT window.IsoMapper. That old lookup falsely reported classic
    // view whenever software fallback drew a 3D map.
    const mode=typeof IsoMapper!=='undefined' && IsoMapper.enabled;
    const detail=typeof state!=='undefined'&&state.mode==='detail';
    const selected=$('mapperViewToggle')?.checked;
    const active=gpu?.visible&&gpu?.initialized&&!gpu.failed;
    const history=typeof resultsTimeline!=='undefined'?resultsTimeline:null;
    const hexes=typeof state!=='undefined'?state.hexCache:null;
    const known=hexes?[...hexes.values()].filter(row=>row?.terrain&&row.terrain!=='UNKNOWN').length:0;
    const load=history?.lastTerrainLoad;
    const details=' · Toggle '+(selected?'on':'off')+
      ' · mapper '+(mode?'3D':'classic')+
      ' · GPU '+(!gpu?'missing':gpu.failed?'failed':active?'active':gpu.initialized?'hidden':'not initialized')+
      ' · terrain known '+known+'/'+(hexes?.size||0)+
      (history?.turn?' · result '+history.turn.turnKey+
        ' (knowledge '+(history.turn.knowledgeTurnKey||'initial')+')':'')+
      (load?' · history query '+(load.status||'?')+' '+(load.count??0)+' rows':'')+
      ' · failed reason '+(gpu?.failureReason||'none')+
      ' · renderer source '+(root.TribeNetRuntime?.terrainLoaderRevision||'unmarked')+
      ' · history source '+(root.TribeNetRuntime?.historicalLoaderRevision||'unmarked')+
      (gpu?.failureStack?' · failure stack '+gpu.failureStack.replace(/\\s+/g,' ').slice(0,1800):'')+
      (load?.error?' · historical data error '+load.error:'');
    retryButton.disabled=!gpu;
    if(active&&info){
      performance.textContent='GPU: '+info.chunks+' chunks · '+info.faces.toLocaleString()+
        ' triangles · '+info.trees+' trees · '+info.gpuCalls+
        ' draw calls · '+info.renderMs.toFixed(1)+' ms GPU submission' +
        ' · Disk restored '+info.diskHits+' · generated '+info.builds+
        ' · saved '+info.diskWrites+' · misses '+info.diskMisses+
        ' · resident '+info.cachedChunks+' · queued '+info.queuedChunks+
        ' · centre area '+info.focusTarget+' ('+(2*info.focusRadiusChunks+1)+'×'+(2*info.focusRadiusChunks+1)+')' +
        ' · offscreen queued '+info.prefetchTarget+
        ' · memory evicted '+info.evictions+
        ' · cores rebuilt '+info.terrainInvalidations+
        ' · shared edges updated '+info.sharedUpdates+
        ' · awaiting submaps '+info.knowledgePending+
        (root.TribeNetKnowledge?.fallback?.()?' (temporary fallback)':'')+
        ' · data errors '+(root.TribeNetKnowledge?.errors?.()||0)+
        ' · geometry '+Math.round(info.terrainMs)+'ms'+
        ' · disk '+Math.round(info.restorationMs)+'ms'+
        ' · cache resets '+info.fullResets+
        ' · resident memory '+(info.residentBytes/1048576).toFixed(1)+'/'+(info.limitBytes/1048576).toFixed(0)+' MiB'+
        ' · full CPU frame '+info.frameMs.toFixed(1)+'ms (peak '+info.maxFrameMs.toFixed(1)+'ms)'+
        ' · unit buffers rebuilt '+info.unitBufferRebuilds+
        ' · unit ground calculations '+info.groundCalculations+
        ' · camera-only frames '+info.cameraOnlyFrames+details;
    }else{
      const reason=!detail?'World Overview or launcher':
        !selected&&!mode?'Classic 2D view selected':
        !gpu?'WebGL renderer module missing':
        gpu.failed?'WebGL failed — '+(gpu.failureReason||'unknown rendering error'):
        mode?'Software-rendered 3D (GPU not visible)':
        '3D toggle is on but mapper mode is classic';
      performance.textContent=reason+details;
    }
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

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
  // Virtual zoom controls *GPU chunk visibility*, never the player's view
  // or terrain generation. It is intentionally not part of geometry presets.
  const visibilityRow=document.createElement('label');
  visibilityRow.className='terrain-dev-row terrain-dev-visibility';
  const visibilityName=document.createElement('span');
  visibilityName.textContent='Visibility Zoom Lock';
  const visibilityRange=document.createElement('input');
  visibilityRange.type='range';visibilityRange.id='terrainVisibilityZoom';
  visibilityRange.min=root.TerrainVisibility?.MIN||20;
  visibilityRange.max=root.TerrainVisibility?.MAX||200;
  visibilityRange.step=1;
  const visibilityNumber=document.createElement('input');
  visibilityNumber.type='number';visibilityNumber.id='terrainVisibilityZoomNumber';
  visibilityNumber.className='terrain-dev-number';
  visibilityNumber.min=visibilityRange.min;visibilityNumber.max=visibilityRange.max;
  visibilityNumber.step=1;
  const visibilityHelp=document.createElement('small');
  visibilityHelp.className='terrain-dev-visibility-help';
  visibilityHelp.textContent='Controls the fixed terrain viewing area while you zoom in. Lower values retain a wider visible area without changing your camera zoom or rebuilding terrain. Default: 42.';
  function syncVisibility(){
    const value=root.TerrainVisibility?.get?.()??42;
    visibilityRange.value=String(value);
    visibilityNumber.value=String(value);
  }
  function applyVisibility(value){
    root.TerrainVisibility?.set?.(value);
    syncVisibility();
    // Changing visibility never invalidates meshes or saves game data.
    if(typeof root.draw==='function')root.draw();
  }
  visibilityRange.addEventListener('input',()=>applyVisibility(visibilityRange.value));
  visibilityNumber.addEventListener('change',()=>applyVisibility(visibilityNumber.value));
  syncVisibility();
  visibilityRow.append(visibilityName,visibilityRange,visibilityNumber);
  const visibilityBox=document.createElement('div');
  visibilityBox.className='terrain-dev-visibility-box';
  const visibilityTitle=document.createElement('strong');
  visibilityTitle.textContent='Terrain Visibility Zoom Lock';
  visibilityBox.append(visibilityTitle,visibilityRow,visibilityHelp);
  panel.appendChild(visibilityBox);
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
  const diagnosticButton=document.createElement('button');
  diagnosticButton.type='button';diagnosticButton.id='terrainRunDiagnostic';
  diagnosticButton.className='button accent';diagnosticButton.textContent='Run Diagnostic';
  diagnosticButton.title='Run automated zoomed-out pan, 3 zoom cycles and zoomed-in pan, then create a local report.';
  const stopButton=document.createElement('button');
  stopButton.type='button';stopButton.id='terrainStopDiagnostic';
  stopButton.className='button';stopButton.textContent='Stop Diagnostic';
  stopButton.hidden=true;
  const copyReportButton=document.createElement('button');
  copyReportButton.type='button';copyReportButton.id='terrainCopyDiagnostic';
  copyReportButton.className='button';copyReportButton.textContent='Copy Report';
  copyReportButton.hidden=true;
  const reportOutput=document.createElement('textarea');
  reportOutput.id='terrainDiagnosticReport';reportOutput.className='terrain-dev-report';
  reportOutput.setAttribute('aria-label','Camera performance diagnostic report');
  reportOutput.readOnly=true;reportOutput.hidden=true;
  const reportHelp=document.createElement('small');
  reportHelp.id='terrainDiagnosticHelp';reportHelp.className='terrain-dev-report-help';
  reportHelp.textContent='The diagnostic moves the camera locally, records performance and restores your view. No information is sent automatically.';
  actions.append(exportButton,importButton,resetButton,retryButton,copyButton,
    diagnosticButton,stopButton,copyReportButton);
  const performance=document.createElement('div');
  performance.className='terrain-dev-feedback';
  performance.setAttribute('aria-live','off');
  performance.textContent='WebGL statistics are available when the 3D Mapper is visible.';
  panel.append(actions,file,feedback,reportHelp,reportOutput,performance);
  wrap.appendChild(panel);
  // No background timers while Terrain Dev is closed.
  let statsTimer=null,diagnosticRunning=false,cancelDiagnostic=false;
  let diagnosticReport='';
  const setDiagnosticControls=running=>{
    diagnosticRunning=running;
    diagnosticButton.disabled=running;
    stopButton.hidden=!running;
    copyReportButton.hidden=running||!diagnosticReport;
  };
  async function copyReport(){
    if(!diagnosticReport)return;
    try{
      await navigator.clipboard.writeText(diagnosticReport);
      feedback.textContent='Performance report copied. Paste it into ChatGPT.';
    }catch(error){
      reportOutput.focus();reportOutput.select();
      feedback.textContent='Clipboard unavailable. The report is selected; press Ctrl+C to copy it.';
    }
  }
  copyReportButton.addEventListener('click',copyReport);
  stopButton.addEventListener('click',()=>{
    cancelDiagnostic=true;
    feedback.textContent='Stopping after the current frame and restoring your original view…';
  });
  diagnosticButton.addEventListener('click',async()=>{
    if(diagnosticRunning)return;
    const gpu=root.TribeNetGPU;
    if(!root.TerrainDiagnostic || typeof state==='undefined' ||
      state.mode!=='detail'||typeof IsoMapper==='undefined'||
      !IsoMapper.enabled || !gpu?.initialized || !gpu.visible || gpu.failed){
      feedback.textContent='Open the active 3D detail map before running the diagnostic.';
      return;
    }
    const start={x:state.cameraX,y:state.cameraY,scale:state.scale};
    const rect=$('mapCanvas')?.getBoundingClientRect()||{width:0,height:0};
    cancelDiagnostic=false;diagnosticReport='';
    reportOutput.value='';reportOutput.hidden=true;
    setDiagnosticControls(true);
    if(statsTimer!==null){clearInterval(statsTimer);statsTimer=null;}
    feedback.textContent='Starting automated camera diagnostic. Do not move the map until it finishes.';
    try{
      const info=gpu.getStats();
      const history=typeof resultsTimeline!=='undefined'?resultsTimeline:null;
      const rows=[...state.hexCache.values()];
      let version='unknown';
      try{version=await root.tribenet?.getVersion?.()||'unknown';}catch(_){}
      const snapshot=()=>{
        const values=gpu.getStats();
        const models=typeof IsoUnits!=='undefined'?IsoUnits.worldModelStats:null;
        return {...values,worldModelCalculations:models?.recalculations||0,
          worldModelReuse:models?.reused||0};
      };
      const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
      const extent=1.5;
      const report=await root.TerrainDiagnostic.run({
        start,zoomOut:42,zoomIn:170,extent,
        now:()=>root.performance.now(),
        nextFrame:()=>new Promise(resolve=>root.requestAnimationFrame(resolve)),
        cancelled:()=>cancelDiagnostic,
        snapshot,
        render:point=>{
          state.cameraX=clamp(point.x,3,1+(TOTAL_COLS-2)*1.5);
          state.cameraY=clamp(point.y,3,Math.sqrt(3)*(TOTAL_ROWS-2));
          state.scale=point.scale;
          if(typeof root.requestVisibleData==='function')root.requestVisibleData();
          root.draw();
        },
        onProgress:value=>{
          feedback.textContent='Running diagnostic: '+value.phase+
            ' — '+value.frame+'/'+value.total+' frames ('+
            (value.completed+1)+'/3 stages)';
        },
        meta:{
          version,turn:history?.turn?.turnKey||'none',
          knowledge:history?.turn?.knowledgeTurnKey||'initial',
          date:new Date().toISOString(),
          width:Math.round(rect.width),height:Math.round(rect.height),
          dpr:root.devicePixelRatio||1,scale:start.scale,
          known:rows.filter(row=>row?.terrain&&row.terrain!=='UNKNOWN').length,
          total:rows.length,targets:info.knownChunkTargets,
          prepared:info.worldGeometryComplete,
          visibilityZoom:root.TerrainVisibility?.get?.()??42,
          hydrated:root.TribeNetKnowledge?.complete?.()??false,
          fallback:root.TribeNetKnowledge?.fallback?.()??false
        }
      });
      diagnosticReport=root.TerrainDiagnostic.format(report);
      reportOutput.value=diagnosticReport;
      reportOutput.hidden=false;
      feedback.textContent=report.status==='completed'
        ?'Diagnostic complete. Click Copy Report and paste it into ChatGPT.'
        :report.status==='cancelled'
          ?'Diagnostic stopped. The partial report is available to copy.'
          :'Diagnostic encountered an error. Copy the report for investigation.';
    }catch(error){
      feedback.textContent='Diagnostic could not run: '+(error?.message||String(error));
    }finally{
      // This is a read-only camera test: always restore the user's original
      // position and zoom, including when cancelled or an exception occurs.
      state.cameraX=start.x;state.cameraY=start.y;state.scale=start.scale;
      try{root.draw();}catch(error){console.warn('Could not restore camera frame:',error);}
      setDiagnosticControls(false);
      updateStats();
      if(!panel.classList.contains('hidden')&&statsTimer===null)
        statsTimer=setInterval(updateStats,750);
    }
  });
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
        ' · world prepared '+(info.worldGeometryComplete?'yes':'no')+
        ' · visibility zoom '+(info.visibilityZoom??'unknown')+
        ' · discovered meshes '+(info.knownChunkTargets||0)+
        ' · background preparation '+info.prefetchTarget+
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
        ' · pre-GPU-inclusive frame '+(info.fullFrameMs||0).toFixed(1)+'ms (peak '+(info.fullFramePeak||0).toFixed(1)+'ms, p95 '+(info.fullFrameP95||0).toFixed(1)+'ms, p99 '+(info.fullFrameP99||0).toFixed(1)+'ms)'+
        ' · worker geometry '+(info.workerTimeMs||0).toFixed(0)+'ms / '+(info.workerBuilds||0)+' meshes'+
        ' · worker uploads '+(info.workerUploadMs||0).toFixed(0)+'ms'+
        ' · worker failures '+(info.workerFailures||0)+
        ' · GPU phase '+info.frameMs.toFixed(1)+'ms (peak '+info.maxFrameMs.toFixed(1)+'ms)'+
        ' · unit buffers rebuilt '+info.unitBufferRebuilds+
        ' · static world model calculations '+(root.IsoUnits?.worldModelStats?.recalculations||0)+
        ' · static model reuse '+(root.IsoUnits?.worldModelStats?.reused||0)+
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

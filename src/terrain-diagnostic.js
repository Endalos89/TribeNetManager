/* Reproducible, local-only camera diagnostic. No map data is modified. */
(function(root){
  'use strict';
  const PLAN=Object.freeze([
    {key:'zoomed-out-pan',label:'Pan around while zoomed out',frames:90},
    {key:'zoom-cycles',label:'Zoom in and out three times',frames:144},
    {key:'zoomed-in-pan',label:'Pan around while zoomed in',frames:90}
  ]);
  function percentile(sorted,q){
    return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]:0;
  }
  function stats(values){
    const numbers=values.filter(Number.isFinite).sort((a,b)=>a-b);
    const sum=numbers.reduce((n,v)=>n+v,0);
    return {count:numbers.length,mean:numbers.length?sum/numbers.length:0,
      p50:percentile(numbers,.5),p95:percentile(numbers,.95),
      p99:percentile(numbers,.99),max:numbers[numbers.length-1]||0,
      over16:numbers.filter(n=>n>16.7).length,
      over33:numbers.filter(n=>n>33.3).length,
      over50:numbers.filter(n=>n>50).length,
      over100:numbers.filter(n=>n>100).length,
      over250:numbers.filter(n=>n>250).length};
  }
  function delta(before,after){
    const names=['builds','diskHits','diskMisses','diskWrites','evictions',
      'terrainInvalidations','sharedUpdates','fullResets','workerBuilds',
      'workerFailures','workerStaleResponses','unitBufferRebuilds',
      'groundCalculations','cameraOnlyFrames','worldModelCalculations',
      'worldModelReuse','terrainMs','workerTimeMs','workerUploadMs'];
    const output={};
    for(const key of names)if(Number.isFinite(before?.[key])&&Number.isFinite(after?.[key]))
      output[key]=after[key]-before[key];
    return output;
  }
  function rounded(n,digits=1){return Number.isFinite(n)?n.toFixed(digits):'n/a';}
  function move(phase,index,start,zoomOut,zoomIn,extent){
    const t=(index+1)/phase.frames;
    // Each phase starts and ends near the original camera position.
    const angle=2*Math.PI*t;
    if(phase.key==='zoomed-out-pan')
      return {x:start.x+Math.sin(angle)*extent*4.5,
        y:start.y+(1-Math.cos(angle))*extent*1.4,
        scale:zoomOut};
    if(phase.key==='zoom-cycles'){
      // Three FULL zoom-in/out cycles, 48 frames per cycle.
      const cycle=(index%48+1)/48;
      const eased=(1-Math.cos(cycle*2*Math.PI))/2;
      return {x:start.x,y:start.y,scale:zoomOut+(zoomIn-zoomOut)*eased};
    }
    return {x:start.x+Math.sin(angle)*extent*1.3,
      y:start.y+(1-Math.cos(angle))*extent*.4,scale:zoomIn};
  }
  function format(report){
    const lines=[
      'TribeNet Terrain Dev — Camera Performance Diagnostic',
      'Version: '+(report.meta.version||'unknown')+
        ' | Turn: '+(report.meta.turn||'none')+
        ' | Knowledge: '+(report.meta.knowledge||'none'),
      'Date: '+report.meta.date,
      'Display: '+report.meta.width+'x'+report.meta.height+
        ' @ DPR '+report.meta.dpr+
        ' | Start zoom '+rounded(report.meta.scale,1)+
        ' | Zoom out '+rounded(report.meta.zoomOut,1)+
        ' | Zoom in '+rounded(report.meta.zoomIn,1)+
        ' | Fixed GPU visibility zoom '+(report.meta.visibilityZoom??'not set'),
      'Terrain: '+report.meta.known+' known / '+report.meta.total+
        ' records | Geometry targets: '+report.meta.targets+
        ' | World prepared: '+(report.meta.prepared?'yes':'no')+
        ' | Hydration complete: '+(report.meta.hydrated?'yes':'no')+
        ' | Temporary fallback: '+(report.meta.fallback?'yes':'no'),
      'Result: '+report.status+
        (report.error?' ('+report.error+')':''),
      'Elapsed: '+rounded(report.elapsed,0)+'ms | '+report.phases.length+
        ' stages completed',
      ''
    ];
    for(const phase of report.phases){
      lines.push(phase.label+' ('+phase.frames+' frames)');
      const print=(label,s)=>label+': avg '+rounded(s.mean)+
        'ms | p50 '+rounded(s.p50)+'ms | p95 '+rounded(s.p95)+
        'ms | p99 '+rounded(s.p99)+'ms | max '+rounded(s.max)+
        'ms | >33ms '+s.over33+' | >100ms '+s.over100+
        ' | >250ms '+s.over250;
      lines.push('  '+print('Draw CPU',phase.draw));
      lines.push('  '+print('Frame interval',phase.interval));
      lines.push('  Resident '+phase.before.cachedChunks+' -> '+phase.after.cachedChunks+
        ' / known targets '+phase.after.knownChunkTargets+
        ' | queued '+phase.before.queuedChunks+' -> '+phase.after.queuedChunks);
      lines.push('  Prepared '+String(Boolean(phase.before.worldGeometryComplete))+
        ' -> '+String(Boolean(phase.after.worldGeometryComplete))+
        ' | memory '+rounded(phase.before.residentBytes/1048576)+
        ' -> '+rounded(phase.after.residentBytes/1048576)+' MiB');
      lines.push('  Counters Δ: '+Object.entries(phase.changes)
        .map(([name,value])=>name+'='+rounded(value,Number.isInteger(value)?0:1)).join(', '));
      lines.push('  Slowest frames: '+phase.slowest.map(f=>
        '#'+f.frame+' at zoom '+rounded(f.zoom)+
        ': draw '+rounded(f.draw)+'ms, interval '+rounded(f.interval)+'ms'
      ).join(' | '));
      lines.push('');
    }
    const last=report.last||{};
    lines.push('Final: generated='+last.builds+' saved='+last.diskWrites+
      ' diskRestored='+last.diskHits+' misses='+last.diskMisses+
      ' resident='+last.cachedChunks+' targets='+last.knownChunkTargets+
      ' evicted='+last.evictions+' invalidated='+last.terrainInvalidations+
      ' workerFailures='+last.workerFailures);
    lines.push('NOTE: Draw CPU is synchronous map rendering; frame interval includes browser scheduling and pauses.');
    lines.push('Diagnostic is local-only. This text is shared only if you copy it.');
    return lines.join('\n');
  }
  async function run({start,zoomOut=42,zoomIn=170,extent=1,
    nextFrame,render,snapshot,onProgress=()=>{},cancelled=()=>false,
    now=()=>performance.now(),meta={}}){
    if(typeof nextFrame!=='function'||typeof render!=='function'||
       typeof snapshot!=='function')throw Error('Missing diagnostic callbacks');
    const report={status:'completed',meta:{...meta,zoomOut,zoomIn},
      phases:[],elapsed:0};
    const started=now();
    let priorFrameTime=null;
    try{
      for(const phase of PLAN){
        if(cancelled()){report.status='cancelled';break;}
        const before=snapshot(),drawTimes=[],intervals=[],frames=[];
        for(let i=0;i<phase.frames;i++){
          if(cancelled()){report.status='cancelled';break;}
          const timestamp=await nextFrame();
          if(cancelled()){report.status='cancelled';break;}
          const point=move(phase,i,start,zoomOut,zoomIn,extent);
          const startedDraw=now();
          render(point);
          const drawMs=now()-startedDraw;
          // Frame-to-frame interval catches stalls that occur OUTSIDE draw().
          const interval=priorFrameTime===null?null:timestamp-priorFrameTime;
          priorFrameTime=timestamp;
          drawTimes.push(drawMs);
          if(Number.isFinite(interval)&&interval>=0)intervals.push(interval);
          frames.push({frame:i+1,zoom:point.scale,draw:drawMs,interval});
          if(i%12===0||i===phase.frames-1)
            onProgress({phase:phase.label,frame:i+1,total:phase.frames,
              completed:report.phases.length,stages:PLAN.length});
        }
        const after=snapshot();
        report.phases.push({key:phase.key,label:phase.label,
          frames:drawTimes.length,before,after,changes:delta(before,after),
          draw:stats(drawTimes),interval:stats(intervals),
          slowest:frames.sort((a,b)=>Math.max(b.draw,b.interval||0)-
            Math.max(a.draw,a.interval||0)).slice(0,5)});
        if(report.status==='cancelled')break;
      }
    }catch(error){
      report.status='failed';report.error=error?.message||String(error);
    }finally{
      report.elapsed=now()-started;
      try{report.last=snapshot();}
      catch(_){report.last={};}
    }
    return report;
  }
  const api={PLAN,move,stats,delta,format,run};
  root.TerrainDiagnostic=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

'use strict';
// Passive local-only terrain lifecycle capture. Does not draw or move the camera.
// A final idle window is observed after Stop is pressed, without forced redraws.
class TerrainManualRecorder {
  constructor({now=()=>Date.now(),clock=()=>new Date().toISOString(),
    every=(fn,ms)=>setInterval(fn,ms),clearEvery=id=>clearInterval(id),
    later=(fn,ms)=>setTimeout(fn,ms)}={}){
    this.now=now;this.clock=clock;this.every=every;
    this.clearEvery=clearEvery;this.later=later;
    this.active=false;this.timer=null;this.events=[];this.dropped=0;
    this.limit=2400;this.snapshot=null;
  }
  start(snapshot,meta={}){
    if(this.active)throw Error('Terrain recording is already running');
    if(typeof snapshot!=='function')throw Error('A snapshot callback is required');
    this.snapshot=snapshot;this.meta=meta;this.started=this.now();
    this.events=[];this.dropped=0;this.active=true;this.stopping=false;
    this.event('recording-started');
    // Observe render changes, idle uploads and the post-pan settle handler.
    // Sampling never requests a renderer frame.
    this.timer=this.every(()=>this.event('passive-sample'),250);
  }
  event(type,details={}){
    if(!this.active)return;
    let sample=null;
    try{sample=this.snapshot?.()||null;}
    catch(e){sample={snapshotError:String(e?.message||e)};}
    const value={ms:Math.round(this.now()-this.started),type,...details,sample};
    if(this.events.length>=this.limit){this.events.shift();this.dropped++;}
    this.events.push(value);
  }
  stop({idleMs=2000}={}){
    if(!this.active || this.stopping)throw Error('No running recording to stop');
    this.stopping=true;this.event('idle-observation-start',{idleMs});
    return new Promise(resolve=>{
      this.later(()=>{
        this.event('idle-observation-complete');
        this.clearEvery(this.timer);this.timer=null;this.active=false;
        resolve({
          format:'tribenet-terrain-manual-diagnostic-v1',
          started:this.clock(),elapsedMs:Math.round(this.now()-this.started),
          settings:this.meta,postStopIdleMs:idleMs,
          droppedEvents:this.dropped,events:[...this.events]
        });
      },idleMs);
    });
  }
}
module.exports={TerrainManualRecorder};

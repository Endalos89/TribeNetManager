/* World constants are independent of release versions. Developer overrides are local only. */
(function(root) {
  'use strict';
  // Endalos89/TribeNetManager was created 2026-09-26T12:16:52Z.
  const WORLD_SEED=1790425012;
  const STORAGE_KEY='tribenet:terrain-dev-settings-v1';
  const definitions=Object.freeze({
    hillAmplitude: {label:'Hill height', min:.15,max:1.1,step:.01,default:.53},
    mountainHeight: {label:'Mountain height',min:.40,max:1.7,step:.01,default:.83},
    ruggedness: {label:'Jagged detail',min:0,max:.5,step:.01,default:.15},
    ridgeSharpness: {label:'Ridge sharpness',min:1,max:5,step:.1,default:2.8},
    coastWaterShare: {label:'Coast water share',min:.3,max:.8,step:.01,default:.6},
    coastRoughness: {label:'Coast irregularity',min:0,max:.35,step:.01,default:.16},
    rockExposure: {label:'Exposed rock',min:.2,max:1.5,step:.02,default:.72},
    meshQuality: {label:'Close-up mesh detail',min:8,max:32,step:4,default:16},
    unitSpread: {label:'Unit layout spacing',min:.20,max:.49,step:.01,default:.38}
  });
  const defaults=()=>Object.fromEntries(Object.entries(definitions).map(([name,d])=>[name,d.default]));
  function normalise(input) {
    const result=defaults();
    for(const [name,d] of Object.entries(definitions)) {
      const n=Number(input?.[name]);
      if(input && Object.prototype.hasOwnProperty.call(input,name) && Number.isFinite(n))
        result[name]=Math.max(d.min,Math.min(d.max,d.step>=1?Math.round(n/d.step)*d.step:n));
    }
    return result;
  }
  let values=defaults();
  try {
    const stored=JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||'null');
    if(stored && typeof stored==='object')values=normalise(stored.settings||stored);
  }catch(_){}
  const subscribers=new Set();
  const get=()=>({...values});
  const value=name=>values[name] ?? definitions[name]?.default;
  function set(patch) {
    values=normalise({...values,...patch});
    try{root.localStorage?.setItem(STORAGE_KEY,JSON.stringify({worldSeed:WORLD_SEED,settings:values}));}catch(_){}
    for(const fn of subscribers)fn(get());
    return get();
  }
  function reset(){values=defaults();return set(values);}
  function exportPreset() {
    return JSON.stringify({format:'tribenet-terrain-preset',formatVersion:1,worldSeed:WORLD_SEED,settings:get()},null,2);
  }
  function importPreset(json) {
    const data=typeof json==='string'?JSON.parse(json):json;
    if(!data || data.format!=='tribenet-terrain-preset' || data.worldSeed!==WORLD_SEED || !data.settings || typeof data.settings!=='object')
      throw new Error('Not a compatible TribeNet terrain preset (the world seed cannot be changed).');
    return set(data.settings);
  }
  const api={WORLD_SEED,definitions,defaults,get,value,set,reset,exportPreset,importPreset,subscribe(fn){subscribers.add(fn);return ()=>subscribers.delete(fn);}};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  root.TerrainSettings=api;
})(typeof window!=='undefined'?window:globalThis);

/* Shared, deterministic livestock activity calculations.
 * Turn-start stocks are the only spendable input. No same-turn output recycling.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TribeNetLivestockEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const whole = n => Math.max(0, Math.floor(Number(n) || 0));
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const ANIMALS = Object.freeze({
    GOAT: { aliases: ['GOAT', 'GOATS'], herderRatio: 20, gut: 2, bone: 2, skin: 1, provs: 4, rate: { GUTTING: 6, BONING: 6, SKINNING: 3 } },
    CATTLE: { aliases: ['CATTLE'], herderRatio: 10, gut: 4, bone: 4, skin: 2, provs: 20, rate: { GUTTING: 3, BONING: 3, SKINNING: 1 } },
    HORSE: { aliases: ['HORSE', 'HORSES'], herderRatio: 10, gut: 6, bone: 6, skin: 3, provs: 30, rate: { GUTTING: 2, BONING: 2, SKINNING: 1 } },
    DOG: { aliases: ['DOG', 'DOGS'], herderRatio: 10, gut: 1, bone: 0, skin: 0, provs: 3, rate: { GUTTING: 8 } },
    ELEPHANT: { aliases: ['ELEPHANT', 'ELEPHANTS'], herderRatio: 5, gut: 12, bone: 0, skin: 0, provs: 60, rate: { GUTTING: 1 } }
  });
  const COMBINATIONS = Object.freeze({
    GUTTING: ['GUTTING'], SKINNING: ['SKINNING'], BONING: ['BONING'],
    SKIN_GUT: ['SKINNING', 'GUTTING'],
    SKIN_BONE: ['SKINNING', 'BONING'],
    GUT_BONE: ['GUTTING', 'BONING'],
    SKIN_GUT_BONE: ['SKINNING', 'GUTTING', 'BONING']
  });
  const EXPORT_CODES = Object.freeze({
    GUTTING: 'GUTTING', SKINNING: 'SKINNING', BONING: 'BONING',
    SKIN_GUT: 'SKIN&GUT', SKIN_BONE: 'SKIN&BONE',
    GUT_BONE: 'GUT&BONE', SKIN_GUT_BONE: 'SKIN&GUT&BONE'
  });
  function animalKey(name) {
    const key = canon(name);
    return Object.keys(ANIMALS).find(a => ANIMALS[a].aliases.includes(key)) || null;
  }
  function activityKey(name) {
    const key = canon(name).replace(/ /g, '_');
    if (COMBINATIONS[key]) return key;
    const pieces = canon(name).split(/[^A-Z]+/).filter(Boolean);
    const has = token => pieces.includes(token) || pieces.includes(token.replace('NING', ''));
    const selections = ['SKINNING','GUTTING','BONING'].filter(has);
    return Object.entries(COMBINATIONS).find(([,parts]) =>
      parts.length === selections.length && parts.every(part => selections.includes(part)))?.[0] || null;
  }
  function stockCount(stock, name) {
    const aliases = animalKey(name) ? ANIMALS[animalKey(name)].aliases : [canon(name)];
    return Object.entries(stock || {}).reduce((total,[key,count]) =>
      total + (aliases.includes(canon(key)) ? whole(count) : 0), 0);
  }
  function baseRate(activity, animal) {
    const type = animalKey(animal), code = activityKey(activity);
    if (!type || !code) return 0;
    const rates = COMBINATIONS[code].map(skill => ANIMALS[type].rate[skill] || 0);
    return rates.every(Boolean) ? Math.min(...rates) : 0;
  }
  function produce(activity, animal, animals) {
    const type=animalKey(animal),code=activityKey(activity),n=whole(animals);
    if (!type || !code || !baseRate(code,type)) return null;
    const parts=COMBINATIONS[code],rule=ANIMALS[type];
    return {animal:type,animals:n,outputs:{
      ...(parts.includes('SKINNING')?{SKINS:n*rule.skin}:{}),
      ...(parts.includes('GUTTING')?{GUT:n*rule.gut}:{}),
      ...(parts.includes('BONING')?{BONES:n*rule.bone}:{}),
      PROVS:n*rule.provs
    }};
  }
  function process({activity,animal,workers,knives=0,animalsAvailable=Infinity}) {
    const per=baseRate(activity,animal),people=whole(workers),tools=Math.min(people,whole(knives));
    if (!per) return null;
    const capacity=per*(people+tools);
    const animals=Math.min(capacity,Math.max(0,Number(animalsAvailable)||0));
    return {...produce(activity,animal,animals),people,knives:tools,capacity};
  }
  function staffForHerd(stock, slaughter={}, options={}) {
    if (options.atSea) return {workers:0,animals:{},reason:'Animals carried by ships at sea do not require Herding'};
    let workers=0;const animals={};
    for (const [type,rule] of Object.entries(ANIMALS)) {
      const count=Math.max(0,stockCount(stock,type)-whole(slaughter[type]));
      if (!count) continue;
      animals[type]=count;
      workers+=Math.ceil(count/rule.herderRatio);
    }
    return {workers,animals};
  }
  function capForLevel(level) {
    const n=Number(level);
    if (!Number.isFinite(n)||n<1) return 0;
    return n>=10?Infinity:Math.floor(n)*10;
  }
  function primaryOutput(activity) {
    const parts=COMBINATIONS[activityKey(activity)]||[];
    return parts.includes('SKINNING')?'SKINS':parts.includes('GUTTING')?'GUT':parts.includes('BONING')?'BONES':null;
  }
  function allocateProcessing({activity,animal,workerLimit,knivesAvailable=0,animalsAvailable=0,need=Infinity,goalItem=null}) {
    const per=baseRate(activity,animal),desired=String(goalItem||primaryOutput(activity)||'').toUpperCase();
    if (!per) return {workers:0,knives:0,animals:0,outputs:{},reason:'Unsupported animal/activity combination'};
    const allowed=whole(workerLimit),available=whole(animalsAvailable),knives=whole(knivesAvailable);
    let spent=0,workers=0,usedKnives=0,result=produce(activity,animal,0);
    for (let i=0;i<allowed && spent<available;i++) {
      if (Number.isFinite(need) && (result.outputs[desired]||0)>=need) break;
      const useKnife=i<knives,qty=Math.min(available-spent,per*(useKnife?2:1));
      if (!qty) break;
      spent+=qty;workers++;if(useKnife)usedKnives++;
      result=produce(activity,animal,spent);
    }
    return {...result,workers,knives:usedKnives,capacity:per*(workers+usedKnives)};
  }
  return {ANIMALS,COMBINATIONS,EXPORT_CODES,animalKey,activityKey,stockCount,baseRate,produce,process,staffForHerd,capForLevel,primaryOutput,allocateProcessing};
});
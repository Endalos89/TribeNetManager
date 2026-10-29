/* Hunting pilot: deterministic, assumption-based planner shared by the Mapper and tests.
 * Game rules are in Mandate N02.2 §13.1.15; numerical yield scenarios use
 * the existing Mapper Food Gathering calculator, not guaranteed GM output.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TribeNetHuntingEngine = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const TERRAIN = {
    ALPS:[0,0,0,0], AR:[1,.5,1,.6], BH:[2.6,1.9,1.7,.6], BR:[2.3,1.8,1.5,.4],
    CH:[2.9,1.9,1.8,.6], DE:[.4,0,.3,.2], DF:[3,2,1.9,.3], DH:[3,2.1,1.9,.3],
    GH:[2,1.8,1.5,.6], HSM:[1,.1,.1,.05], JG:[3,1.8,2,1], JH:[3,1.8,2,1],
    LCM:[1.8,1.4,1,.3], LJM:[2.5,1.4,1.7,.8], LSM:[.5,.5,.2,.1],
    PI:[.5,.8,.3,.3], PR:[2,1.7,1.4,.5], RH:[1,1.5,1.5,.6], SH:[.5,.8,.3,.3],
    SW:[1,.7,.5,.2], TU:[.5,.8,.5,.1]
  };
  const WEATHER = [
    { name:'Fine', factor:1 }, { name:'Light rain', factor:.9 },
    { name:'Heavy rain', factor:.5 }, { name:'Light snow', factor:.7 },
    { name:'Heavy snow', factor:.4 }, { name:'Wind', factor:.8 }
  ];
  const TOOLS = [
    { name:'Advanced Trap', bonus:1, max:1 },
    { name:'Improved Trap', bonus:.15, max:5 },
    { name:'Trap', bonus:.1, max:5 },
    { name:'Snare', bonus:.05, max:5 },
    { name:'Arbalest', bonus:.2, max:1 },
    { name:'Bow', bonus:.15, max:1 },
    { name:'Sling', bonus:.1, max:1 },
    { name:'Net', bonus:.1, max:1 },
    { name:'Spear', bonus:.05, max:1 },
    { name:'Bone Spear', bonus:.05, max:1 },
    { name:'Stone Spear', bonus:.05, max:1 },
    { name:'Spetum', bonus:.05, max:1 }
  ];
  const canon = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const whole = v => Math.max(0,Math.floor(Number(v)||0));
  const canonicalTerrain = t => {
    const key=canon(t).replace(/ /g,'');
    if(key==='D')return 'DF';
    if(['PP','PPR'].includes(key))return 'PR';
    if(['GHP','PGH'].includes(key))return 'GH';
    return TERRAIN[key]?key:null;
  };
  function stockCount(stock, name) {
    const singular = canon(name);
    for(const [key,value] of Object.entries(stock||{})){
      if(canon(key)===singular||canon(key)===singular+'S') return whole(value);
    }
    return 0;
  }
  function optimizeTools(workers, stock, reservations={}) {
    const n=whole(workers), offers=[];
    for(const tool of TOOLS){
      let available=Math.max(0,stockCount(stock,tool.name)-whole(reservations[canon(tool.name)]));
      while(available>0 && offers.length<n+50){
        const copies=Math.min(tool.max,available);
        offers.push({name:tool.name,copies,benefit:copies*tool.bonus});
        available-=copies;
      }
    }
    offers.sort((a,b)=>b.benefit-a.benefit||a.name.localeCompare(b.name));
    const chosen=offers.slice(0,n), quantities={};
    for(const o of chosen)quantities[o.name]=(quantities[o.name]||0)+o.copies;
    const dogs=Math.min(n,Math.max(0,stockCount(stock,'Hunting Dog')-whole(reservations['HUNTING DOG'])));
    if(dogs)quantities['Hunting Dog']=dogs;
    const effectiveAM=n+chosen.reduce((v,o)=>v+o.benefit,0)+dogs*2;
    return {effectiveAM,implements:Object.entries(quantities).map(([name,quantity])=>({name,quantity})),hunters:n};
  }
  function forecast({workers=0,skill=0,terrain,month=1,waterBorders=0,effectiveAM=null}={}) {
    const code=canonicalTerrain(terrain), months=whole(month);
    if(!code)return null;
    const season=Math.floor((Math.max(1,Math.min(12,months))-1)/3);
    const base=TERRAIN[code][season],water=whole(waterBorders);
    const waterFactor=water?1.1+.01*(water-1):1;
    const am=effectiveAM===null?whole(workers):Math.max(0,Number(effectiveAM)||0);
    const values=WEATHER.map(row=>({name:row.name,provs:Math.round(am*base*(1+Math.max(0,Number(skill)||0)*.1)*row.factor*waterFactor)}));
    return {min:Math.min(...values.map(x=>x.provs)),max:Math.max(...values.map(x=>x.provs)),
      average:values.reduce((sum,x)=>sum+x.provs,0)/values.length,
      fine:values[0].provs,values,terrain:code};
  }
  function predicted(yieldRange,mode) {
    if(!yieldRange)return null;
    return mode==='optimistic'?yieldRange.max:mode==='conservative'?yieldRange.min:yieldRange.average;
  }
  function allocation({workersAvailable,goalProvs=0,mode='average',skill=0,terrain,month,waterBorders,stock,reservations={}}) {
    const available=whole(workersAvailable);
    const calculate=n=>{
      const tools=optimizeTools(n,stock,reservations);
      const yieldRange=forecast({workers:n,effectiveAM:tools.effectiveAM,skill,terrain,month,waterBorders});
      return {...tools,range:yieldRange,expected:predicted(yieldRange,mode)};
    };
    if(!calculate(0).range)return {workers:0,tools:[],range:null,expected:null,error:'No verified Hunting calculator rate for this terrain'};
    let low=0,high=available,answer=available;
    while(low<=high){
      const mid=Math.floor((low+high)/2),estimate=calculate(mid);
      if(estimate.expected>=goalProvs){answer=mid;high=mid-1;}
      else low=mid+1;
    }
    const result=calculate(Math.max(0,answer));
    return {workers:answer,tools:result.implements,range:result.range,expected:result.expected,
      achievable:result.expected>=goalProvs,effectiveAM:result.effectiveAM};
  }
  function provisionTarget(months,eaters) {
    const perTurn=whole(eaters);
    return {afterEating:Math.ceil(Math.max(0,Number(months)||0)*perTurn),
      beforeEating:Math.ceil((Math.max(0,Number(months)||0)+1)*perTurn),currentTurn:perTurn};
  }
  function retentionCap({capacity,percent,otherWeight,provsWeight=1}){
    const values=[capacity,percent,otherWeight,provsWeight].map(Number);
    if(values.some(v=>!Number.isFinite(v))||values[0]<=0||values[1]<=0||values[1]>100||values[2]<0||values[3]<=0)
      return {quantity:null,warning:'Carrying capacity, non-Provs weight or Provs unit weight is unavailable'};
    const space=values[0]*values[1]/100-values[2];
    return {quantity:Math.max(0,Math.floor(space/values[3])),
      warning:space<0?'Non-Provs cargo already exceeds the selected weight limit':''};
  }
  return {TERRAIN,WEATHER,TOOLS,canonicalTerrain,forecast,predicted,optimizeTools,allocation,provisionTarget,retentionCap};
});

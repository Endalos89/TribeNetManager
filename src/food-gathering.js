(function(root){
  const WEATHER_SCENARIOS = [
    { key:'fine', label:'Fine', fishing:1, hunting:1 },
    { key:'light-rain', label:'Light rain', fishing:0.95, hunting:0.9 },
    { key:'heavy-rain', label:'Heavy rain', fishing:0.5, hunting:0.5 },
    { key:'light-snow', label:'Light snow', fishing:0.9, hunting:0.7 },
    { key:'heavy-snow', label:'Heavy snow', fishing:0.8, hunting:0.4 },
    { key:'wind', label:'Wind', fishing:0.8, hunting:0.8 }
  ];

  const TERRAIN = {
    ALPS:{name:'Alps', factors:[0,0,0,0]}, AR:{name:'Arid', factors:[1,0.5,1,0.6]},
    BH:{name:'Brush Hill', factors:[2.6,1.9,1.7,0.6]}, BR:{name:'Brush', factors:[2.3,1.8,1.5,0.4]},
    CH:{name:'Conifer Hill', factors:[2.9,1.9,1.8,0.6]}, DE:{name:'Desert', factors:[0.4,0,0.3,0.2]},
    DF:{name:'Deciduous', factors:[3,2,1.9,0.3]}, DH:{name:'Deciduous Hill', factors:[3,2.1,1.9,0.3]},
    GH:{name:'Grassy Hill', factors:[2,1.8,1.5,0.6]}, HSM:{name:'High Mountains', factors:[1,0.1,0.1,0.05]},
    JG:{name:'Jungle', factors:[3,1.8,2,1]}, JH:{name:'Jungle Hill', factors:[3,1.8,2,1]},
    LCM:{name:'Low Conifer Mountains', factors:[1.8,1.4,1,0.3]}, LJM:{name:'Low Jungle Mountain', factors:[2.5,1.4,1.7,0.8]},
    LSM:{name:'Low Snowy Mountains', factors:[0.5,0.5,0.2,0.1]}, PI:{name:'Polar Ice', factors:[0.5,0.8,0.3,0.3]},
    PR:{name:'Prairie', factors:[2,1.7,1.4,0.5]}, RH:{name:'Rocky Hill', factors:[1,1.5,1.5,0.6]},
    SH:{name:'Snow Hill', factors:[0.5,0.8,0.3,0.3]}, SW:{name:'Swamp', factors:[1,0.7,0.5,0.2]},
    TU:{name:'Tundra', factors:[0.5,0.8,0.5,0.1]}
  };

  const MODEL_BASE_YIELD = { 'TN 3.0':2.2, 'TN 3.1':2.6 };
  const STORAGE_KEY = 'tribenet.compendium.foodGathering.v1';
  const DEFAULTS = { model:'TN 3.0', people:1000, month:3, climate:'Temperate', fishingSkill:3, nets:0, huntingSkill:3, terrain:'PR', waterBorders:0, eaters:75, otherWorkers:80 };
  function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function seasonIndex(month){const m=clamp(Math.floor(number(month,1)),1,12);return m<=3?0:m<=6?1:m<=9?2:3;}
  function seasonLabel(month){return ['Spring (1-3)','Summer (4-6)','Autumn (7-9)','Winter (10-12)'][seasonIndex(month)];}
  function fishingEffectiveYield(model,skill,weatherFactor=1){const base=MODEL_BASE_YIELD[model]||MODEL_BASE_YIELD['TN 3.0'];return (1+number(skill)*0.05)*base*number(weatherFactor,1);}
  function calculateFishingYield({model='TN 3.0',skill=0,weatherFactor=1,people=0,nets=0}){const am=Math.max(0,number(people));const netCount=Math.max(0,number(nets));const effective=fishingEffectiveYield(model,skill,weatherFactor);return Math.floor(effective*(am+Math.min(netCount,am)/2));}
  function huntingWaterFactor(waterBorders){const borders=Math.max(0,Math.floor(number(waterBorders)));return borders>=1?1.1+0.01*(borders-1):1;}
  function calculateHuntingYield({people=0,skill=0,terrain='PR',month=1,weatherFactor=1,waterBorders=0}){const row=TERRAIN[terrain]||TERRAIN.PR;const terrainSeason=row.factors[seasonIndex(month)];return Math.round(Math.max(0,number(people))*terrainSeason*(1+number(skill)*0.1)*number(weatherFactor,1)*huntingWaterFactor(waterBorders));}
  function fishingAmToFeed({eaters=0,nets=0,effectiveYield=0}){const target=Math.max(0,number(eaters));const netCount=Math.max(0,number(nets));const eff=number(effectiveYield);if(target<=0)return 0;if(eff<=0)return null;const maxNetAm=Math.ceil(target/1.5/eff);const withoutNet=Math.floor((target-Math.floor(netCount*1.5*eff))/eff);return Math.max(netCount+withoutNet,maxNetAm,0);}
  function fishingAmToSupportWorkers({otherWorkers=0,nets=0,effectiveYield=0}){const others=Math.max(0,number(otherWorkers));const netCount=Math.max(0,number(nets));const eff=number(effectiveYield);if(others<=0)return 0;if(eff<=1)return null;const yieldWithNets=Math.floor(netCount*1.5*eff);if(yieldWithNets>(others+netCount)){const denominator=eff*1.5-1;return denominator>0?Math.ceil(others/denominator):null;}return Math.ceil((others+netCount-yieldWithNets)/(eff-1))+netCount;}
  function scenarioRows(state){return WEATHER_SCENARIOS.map(weather=>{const fishing=calculateFishingYield({model:state.model,skill:state.fishingSkill,weatherFactor:weather.fishing,people:state.people,nets:state.nets});const hunting=calculateHuntingYield({people:state.people,skill:state.huntingSkill,terrain:state.terrain,month:state.month,weatherFactor:weather.hunting,waterBorders:state.waterBorders});return {...weather,fishing,hunting,difference:Math.abs(fishing-hunting),higher:fishing===hunting?'Tie':fishing>hunting?'Fishing':'Hunting'};});}

  const api={WEATHER_SCENARIOS,TERRAIN,MODEL_BASE_YIELD,DEFAULTS,seasonIndex,seasonLabel,fishingEffectiveYield,calculateFishingYield,huntingWaterFactor,calculateHuntingYield,fishingAmToFeed,fishingAmToSupportWorkers,scenarioRows};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root||!root.document)return;
  root.TribeNetFoodGathering=api;

  function loadState(){try{return {...DEFAULTS,...JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}')};}catch(_){return {...DEFAULTS};}}
  function saveState(state){try{root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}}
  function value(id){const el=root.document.getElementById(id);return el?el.value:'';}
  function readState(){return {model:value('fgModel')||'TN 3.0',people:Math.max(0,number(value('fgPeople'))),month:clamp(Math.floor(number(value('fgMonth'),3)),1,12),climate:value('fgClimate')||'Temperate',fishingSkill:clamp(number(value('fgFishingSkill')),0,20),nets:Math.max(0,number(value('fgNets'))),huntingSkill:clamp(number(value('fgHuntingSkill')),0,20),terrain:value('fgTerrain')||'PR',waterBorders:Math.max(0,Math.floor(number(value('fgWaterBorders')))),eaters:Math.max(0,number(value('fgEaters'))),otherWorkers:Math.max(0,number(value('fgOtherWorkers')))};}
  function fmt(value){return value==null?'—':Math.round(value).toLocaleString();}
  function terrainOptions(selected){return Object.entries(TERRAIN).map(([code,row])=>`<option value="${code}" ${selected===code?'selected':''}>${code} — ${row.name}</option>`).join('');}
  function weatherTable(state){return `<div class="fg-table-wrap"><table class="fg-table"><thead><tr><th>Possible weather</th><th>Fishing</th><th>Hunting</th><th>Higher estimated return</th></tr></thead><tbody>${scenarioRows(state).map(row=>`<tr><td><strong>${row.label}</strong><small>Fishing ×${row.fishing} · Hunting ×${row.hunting}</small></td><td class="${row.higher==='Fishing'?'fg-best':''}">${fmt(row.fishing)}</td><td class="${row.higher==='Hunting'?'fg-best':''}">${fmt(row.hunting)}</td><td><strong>${row.higher}</strong>${row.higher==='Tie'?'':`<small>by ${fmt(row.difference)}</small>`}</td></tr>`).join('')}</tbody></table></div>`;}
  function fishingPlanningTable(state){return `<div class="fg-table-wrap"><table class="fg-table compact"><thead><tr><th>Weather</th><th>Effective yield / fisher</th><th>Fishers to feed ${fmt(state.eaters)}</th><th>Fishers to support ${fmt(state.otherWorkers)} other AM</th></tr></thead><tbody>${WEATHER_SCENARIOS.map(weather=>{const eff=fishingEffectiveYield(state.model,state.fishingSkill,weather.fishing);const feed=fishingAmToFeed({eaters:state.eaters,nets:state.nets,effectiveYield:eff});const support=fishingAmToSupportWorkers({otherWorkers:state.otherWorkers,nets:state.nets,effectiveYield:eff});return `<tr><td>${weather.label}</td><td>${eff.toFixed(2)}</td><td>${fmt(feed)}</td><td>${fmt(support)}</td></tr>`;}).join('')}</tbody></table></div>`;}
  function updateOutputs(){const state=readState();saveState(state);const season=root.document.getElementById('fgSeason');if(season)season.textContent=seasonLabel(state.month);const comparison=root.document.getElementById('fgComparison');if(comparison)comparison.innerHTML=weatherTable(state);const planning=root.document.getElementById('fgFishingPlanningOutput');if(planning)planning.innerHTML=fishingPlanningTable(state);}
  function bindCalculator(){root.document.querySelectorAll('#fgCalculator input,#fgCalculator select').forEach(el=>{el.addEventListener('input',updateOutputs);el.addEventListener('change',updateOutputs);});root.document.querySelectorAll('[data-skill-link]').forEach(el=>el.addEventListener('click',()=>showSkill(el.dataset.skillLink)));updateOutputs();}
  function showFoodGathering(push=true){
    const state=loadState();setView({type:'food-gathering',key:'food-gathering'},{push});$('compBreadcrumbs').textContent='Compendium › Food Gathering';
    $('compArticle').innerHTML=`<div id="fgCalculator">
      <div class="comp-title-row"><div><div class="comp-kicker">Interactive calculator</div><h1>Food Gathering</h1><div class="comp-short">Compare Fishing and Hunting under the same circumstances</div></div><span class="comp-badge">Assumption based</span></div>
      <p class="comp-lead">Enter the information you know once, then compare the estimated food return from Fishing and Hunting. Your entries are saved on this computer between sessions.</p>
      <div class="comp-callout warn"><strong>Assumption-based calculator.</strong> These estimates reproduce the logic in the supplied community spreadsheets rather than confirmed Mandate formulas. Actual GM results may differ. Weather is intentionally shown as a set of possible outcomes because it is not known when orders are chosen.</div>
      <section class="comp-section"><h2>Shared context</h2><div class="fg-input-grid">
        <label><span>People / AM available</span><input id="fgPeople" type="number" min="0" step="1" value="${state.people}"></label>
        <label><span>Month</span><select id="fgMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(state.month)===i+1?'selected':''}>${String(i+1).padStart(2,'0')}</option>`).join('')}</select><small id="fgSeason">${seasonLabel(state.month)}</small></label>
        <label><span>Climate / region</span><input id="fgClimate" type="text" value="${esc(state.climate)}"><small>Saved as context; not used by either supplied formula yet.</small></label>
        <label><span>Rules model</span><select id="fgModel"><option ${state.model==='TN 3.0'?'selected':''}>TN 3.0</option><option ${state.model==='TN 3.1'?'selected':''}>TN 3.1</option></select><small>TN 3.0 is the default. Currently affects Fishing only.</small></label>
      </div></section>
      <section class="comp-section"><h2>Method inputs</h2><div class="fg-method-grid">
        <div class="fg-method"><div class="fg-method-head"><div><strong>Fishing</strong><span>Community Fishing model</span></div><button class="comp-link" data-skill-link="Fishing">Open Fishing skill</button></div><div class="fg-input-grid two"><label><span>Fishing skill</span><input id="fgFishingSkill" type="number" min="0" max="20" step="1" value="${state.fishingSkill}"></label><label><span>Nets available</span><input id="fgNets" type="number" min="0" step="1" value="${state.nets}"><small>Only up to one net per fisher affects the simple yield calculation.</small></label></div></div>
        <div class="fg-method"><div class="fg-method-head"><div><strong>Hunting</strong><span>Community Hunting model</span></div><button class="comp-link" data-skill-link="Hunting">Open Hunting skill</button></div><div class="fg-input-grid two"><label><span>Hunting skill</span><input id="fgHuntingSkill" type="number" min="0" max="20" step="1" value="${state.huntingSkill}"></label><label><span>Terrain</span><select id="fgTerrain">${terrainOptions(state.terrain)}</select></label><label><span>Water borders</span><input id="fgWaterBorders" type="number" min="0" max="12" step="1" value="${state.waterBorders}"><small>0 = not next to water; 1+ applies the spreadsheet's water-border bonus.</small></label></div></div>
      </div></section>
      <section class="comp-section"><h2>Possible returns by weather</h2><p>Both methods use the same weather scenario, but the two source spreadsheets apply different weather multipliers.</p><div id="fgComparison">${weatherTable(state)}</div></section>
      <section class="comp-section"><h2>Fishing workforce planning</h2><p>These reproduce the additional Fishing-sheet calculations for sizing a fishing workforce.</p><div class="fg-input-grid two"><label><span>Eaters to feed</span><input id="fgEaters" type="number" min="0" step="1" value="${state.eaters}"></label><label><span>Other AM to support</span><input id="fgOtherWorkers" type="number" min="0" step="1" value="${state.otherWorkers}"><small>For example, miners who also need feeding alongside the fishers.</small></label></div><div id="fgFishingPlanningOutput">${fishingPlanningTable(state)}</div></section>
      <section class="comp-section"><h2>How the estimates are built</h2><div class="fg-assumptions"><div><strong>Fishing</strong><span>TN 3.0 base yield 2.2; TN 3.1 base yield 2.6; +5% per Fishing skill level; nets add 50% for up to one net per fisher; weather multiplier varies by scenario.</span></div><div><strong>Hunting</strong><span>Effective Actives × terrain/season factor × (1 + 10% per Hunting skill level) × weather factor × water-border factor. One water border gives ×1.10, then +0.01 per additional border.</span></div></div></section>
      <section class="comp-section fg-credits"><h2>Credits / Original Sources</h2><p>Fishing calculator: <strong>Squip (249/912)</strong><br>Hunting calculator: <strong>Andy (Bynna636)</strong></p></section>
    </div>`;bindCalculator();
  }
  root.showFoodGathering=showFoodGathering;
  if(typeof renderNav==='function'&&typeof bindLinks==='function'&&typeof renderView==='function'){
    const baseRenderNav=renderNav,baseBindLinks=bindLinks,baseRenderView=renderView;
    bindLinks=function(rootNode=document){baseBindLinks(rootNode);rootNode.querySelectorAll('[data-food-gathering]').forEach(el=>el.onclick=()=>showFoodGathering());};
    renderNav=function(){baseRenderNav();const host=$('compNav');if(!host||host.querySelector('[data-food-gathering]'))return;host.insertAdjacentHTML('afterbegin',`<section class="comp-nav-section"><div class="comp-nav-title">Planning tools</div><button class="comp-nav-link ${compState.view.type==='food-gathering'?'active':''}" data-food-gathering>Food Gathering <small>Calculator</small></button></section>`);bindLinks(host);};
    renderView=function(view,{push=false}={}){if(view&&view.type==='food-gathering')return showFoodGathering(push);return baseRenderView(view,{push});};
    renderNav();
  }
})(typeof window!=='undefined'?window:null);

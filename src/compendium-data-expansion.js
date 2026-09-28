(() => {
  const research = window.TribeNetResearchData || {topics:[],extraSkills:[]};
  const market = window.TribeNetFairPriceBenchmark;
  const orders = window.TribeNetOrdersReference || {skills:[],goods:[],implements:[]};
  const aliases = {'BRICKMAKING':'BRICK MAKING','ARCHEOLOGY':'ARCHAEOLOGY','CHEESE MAKING':'CHEESEMAKING','DANCING':'DANCE','ATHEISM':'RELIGION ATHEISM','RELIGION':'RELIGION ATHEISM','RANGERS':'RANGER','WAXWORKS':'WAXWORK','FIRECONTROL':'FIRE CONTROL'};
  const skillKey = value => aliases[canon(value)] || canon(value);
  const skillFind = value => { const key=skillKey(value); return skills().find(s=>skillKey(s.name)===key||skillKey(s.shortname)===key)||null; };
  const researchForSkill = value => { const key=skillKey(value?.name||value); return (research.topics||[]).filter(t=>skillKey(t.skill)===key); };
  const topicKind = topic => { const text=`${topic?.benefit||''} ${topic?.recipe||''}`; if(/new\s+ship\b/i.test(text))return'ship'; if(/new\s+building\b/i.test(text))return'facility'; if(/new\s+(item|crop|ammunition|trade good)\b/i.test(text))return'item'; return null; };
  const researchOnly = entity => Boolean(entity?.researchOnly || market?.lookup(entity?.name)?.researchOnly || (entity?.researchTopics||[]).some(topicKind));

  function addSkills(){
    for(const row of orders.skills||[]){
      const current=skillFind(row.name);
      if(current){ current.ordersListed=true; if(!current.shortname)current.shortname=row.shortname; if(!current.skillGroup)current.skillGroup=row.group; continue; }
      compState.catalog.skills.push({id:null,name:row.name,shortname:row.shortname,skillGroup:row.group,section:'12.2',sourceDocument:compState.catalog.sourceDocument,aliases:[row.name,row.shortname].filter(Boolean),summary:'Listed in the current Orders workbook Valid_Skills index.',sections:['12.2'],limitations:['The Mandate notes that some Valid Skills entries are reserved/future or research-unlocked and are not automatically available as normal Skill Attempts.'],topics:[],workerLimited:false,recipes:[],relatedRequirements:[],ordersListed:true,validSkillsOnly:true});
    }
    for(const row of research.extraSkills||[]){
      const current=skillFind(row.name);
      if(current){ current.researchUnlocked=true; current.unlockResearch=row.unlock||''; if(current.validSkillsOnly){current.validSkillsOnly=false;current.summary=row.summary||current.summary;} continue; }
      compState.catalog.skills.push({id:null,name:row.name,shortname:row.shortname,skillGroup:row.skillGroup,section:'Research',sourceDocument:research.source?.title||'Research List',aliases:[row.name,row.shortname].filter(Boolean),summary:row.summary||'',sections:[],limitations:row.unlock?[`Unlocked by: ${row.unlock}`]:[],topics:[],workerLimited:['Milking','Cheesemaking'].includes(row.name),recipes:[],relatedRequirements:[],researchUnlocked:true,unlockResearch:row.unlock||''});
    }
    compState.catalog.skills.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  }

  const originalEntities=entities;
  entities=function(){
    const list=originalEntities().map(e=>({...e,researchTopics:[...(e.researchTopics||[])]}));
    const map=new Map(list.map(e=>[canon(e.key||e.name),e]));
    const ensure=(name,seed={})=>{ const key=canon(name); let e=map.get(key); if(!e){e={key,name,kind:'item',summary:'',sections:[],notes:[],sourceSkills:[],uses:[],producers:[],consumers:[],researchTopics:[],...seed};list.push(e);map.set(key,e);} else Object.assign(e,Object.fromEntries(Object.entries(seed).filter(([,v])=>v!==undefined&&v!==null&&v!==''))); return e; };
    for(const good of orders.goods||[]){ if(canon(good.table)==='HUMANS')continue; const e=ensure(good.name,{kind:canon(good.table)==='SHIP'?'ship':'item',summary:`Current Orders workbook Valid Goods entry (${good.table||'goods'}).`}); e.validGoods=good; if(canon(good.table)==='SHIP')e.kind='ship'; }
    for(const imp of orders.implements||[]){ const e=ensure(imp.name,{kind:'item'}); e.implementUses=imp.uses||[]; e.isImplement=true; }
    const ships=new Set(); for(const s of skills())for(const r of s.recipes||[])if(canon(r.primarySkill)==='SHIPBUILDING'&&r.outputItem)ships.add(canon(r.outputItem));
    for(const e of list)if(ships.has(canon(e.name)))e.kind='ship';
    for(const t of research.topics||[]){ const kind=topicKind(t); let e=map.get(canon(t.name)); if(!e&&kind)e=ensure(t.name,{kind,summary:t.benefit||`Research topic under ${t.skill}.`,researchOnly:true}); if(!e)continue; if(!(e.researchTopics||[]).some(x=>x.key===t.key))e.researchTopics.push(t); if(kind==='ship')e.kind='ship'; else if(kind==='facility'&&e.kind!=='ship')e.kind='facility'; if(kind)e.researchOnly=true; }
    return list;
  };

  function rows(category){ const all=entities(); if(category==='buildings')return all.filter(e=>e.kind==='facility').sort((a,b)=>a.name.localeCompare(b.name)); if(category==='ships')return all.filter(e=>e.kind==='ship').sort((a,b)=>a.name.localeCompare(b.name)); return all.filter(e=>!['facility','ship'].includes(e.kind)).sort((a,b)=>a.name.localeCompare(b.name)); }
  function topic(key){return (research.topics||[]).find(t=>t.key===key)||null;}
  window.TribeNetCompendiumExpansion={research,orders,market,skillKey,skillFind,researchForSkill,topicKind,researchOnly,rows,topic,addSkills};
})();

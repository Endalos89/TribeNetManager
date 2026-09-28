(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  const huntingImplements = [
    { name:'Trap', value:'+0.10 AM', baseMax:'5', baseMaxBenefit:'+0.50 AM', craft:[{skill:'Metalwork',level:2}], requiresResearch:false, detail:'Up to 5 Traps per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.21', aliases:['Traps'] },
    { name:'Snare', value:'+0.05 AM', baseMax:'5', baseMaxBenefit:'+0.25 AM', craft:[{skill:'Weaving',level:3}], requiresResearch:false, detail:'Up to 5 Snares per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.36', aliases:['Snares'] },
    { name:'Bow', value:'+0.15 AM', baseMax:'1', baseMaxBenefit:'+0.15 AM', craft:[{skill:'Weapons',level:1}], requiresResearch:false, detail:'One Bow per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.35', aliases:['Bows'] },
    { name:'Sling', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', craft:[{skill:'Weapons',level:1},{skill:'Weaving',level:2},{skill:'Leatherwork',level:2}], requiresResearch:false, detail:'One Sling per Hunter as the chosen primary implement type. The Mandate lists several ways to make Slings.', source:'Mandate', section:'13.1.15', craftSection:'13.1.35', aliases:['Slings'] },
    { name:'Arbalest', value:'+0.20 AM', baseMax:'1', baseMaxBenefit:'+0.20 AM', craft:[{skill:'Weapons',level:8}], requiresResearch:false, detail:'One Arbalest per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.35', aliases:['Arbalests'] },
    { name:'Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Weapons',level:2}], requiresResearch:false, detail:'One Spear per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.35', aliases:['Spears'] },
    { name:'Bone Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Bonework',level:3}], requiresResearch:false, detail:'One Bone Spear per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.3', aliases:['Bone Spears'] },
    { name:'Stone Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Stonework',level:4}], requiresResearch:false, detail:'One Stone Spear per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.32', aliases:['Stone Spears'] },
    { name:'Spetum', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Weapons',level:1}], requiresResearch:false, detail:'One Spetum per Hunter as the chosen primary implement type.', source:'Mandate', section:'13.1.15', craftSection:'13.1.35', aliases:['Spetums'] },
    { name:'Net', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', craft:[{skill:'Weaving',level:3},{skill:'Weaving',level:5,note:'alternate recipe'}], requiresResearch:false, detail:'One Net per Hunter as the chosen primary implement type. The Mandate lists two Net recipes.', source:'Mandate', section:'13.1.15', craftSection:'13.1.36', aliases:['Nets'] },
    { name:'Improved Trap', value:'+0.15 AM', baseMax:'5', baseMaxBenefit:'+0.75 AM', craft:[{skill:'Metalwork',level:3}], requiresResearch:true, detail:'Base allowance is 5 Improved Traps per Hunter. Trappers research raises this to 10.', source:'Research', research:'Hunting / Improved Trap' },
    { name:'Advanced Trap', value:'+1.00 AM', baseMax:'1', baseMaxBenefit:'+1.00 AM', craft:[{skill:'Metalwork',level:10}], requiresResearch:true, detail:'Base allowance is 1 Advanced Trap per Hunter. Trappers research raises this to 2.', source:'Research', research:'Hunting / Advanced Trap' }
  ];

  const huntingSupport = [
    { name:'Hunting Dog', value:'+2 AM', baseMax:'1', baseMaxBenefit:'+2 AM', craft:[{skill:'Herding',level:10}], requiresResearch:true, detail:'A Hunting Dog is additional support rather than the Hunter’s primary implement. One Hunter with one Hunting Dog counts as three Hunters, so the Dog contributes +2 AM.', source:'Research', research:'Hunting / Hunting Dogs', aliases:['Hunting Dogs'] }
  ];

  const profiles = {
    HUNTING: {
      name:'Hunting',
      status:'prototype',
      mechanic:'efficiency',
      mechanicLabel:'Efficiency / output skill',
      primarySection:'13.1.15',
      additionalSections:['23.5'],
      workerRule:'No worker limit',
      summary:'Feeds the Tribe by gathering provisions. Hunting output scales with the number of Hunters, Hunting skill, terrain, season, weather and equipment.',
      outputs:[
        { item:'Provs', label:'Provisions', type:'Food / finished good', detail:'The normal output of Hunting; the exact quantity varies with Hunters, skill and other modifiers.', source:'13.1.15' }
      ],
      factors:[
        { factor:'Terrain', effect:'Affects Hunting returns.', detail:'Terrain is one of the factors used when determining Hunting output; no single universal terrain modifier is given in the Mandate.' },
        { factor:'River / Lake / Ocean border', effect:'+10% for the first water border.', detail:'Additional River, Lake or Ocean borders beyond the first give slight further improvements.' },
        { factor:'Season', effect:'Affects Hunting returns.', detail:'The Mandate states that season changes output but does not provide a single fixed modifier.' },
        { factor:'Weather', effect:'Affects Hunting returns.', detail:'The Mandate states that weather changes output but does not provide a single fixed modifier.' }
      ],
      implementRule:'Each Hunter may use one primary implement type. Trap-family implements may use multiple copies of that chosen type where the rules allow.',
      implements:huntingImplements,
      supportImplements:huntingSupport,
      researchEffectOverrides:{
        'Expert Trackers':'+5% Hunting returns.',
        'Veteran Trackers':'+5% Hunting returns.'
      },
      relatedSkills:['Herding','Furrier','Metalwork','Weapons','Weaving']
    }
  };

  const itemBenefits = new Map();
  for (const profile of Object.values(profiles)) {
    for (const item of [...(profile.implements || []), ...(profile.supportImplements || [])]) {
      const benefit = { ...item, skill:profile.name, keywords:[profile.name] };
      for (const name of [item.name, ...(item.aliases || [])]) {
        const key = canon(name);
        const rows = itemBenefits.get(key) || [];
        rows.push(benefit);
        itemBenefits.set(key, rows);
      }
    }
  }

  root.TribeNetSkillOverhaul = {
    canon,
    profiles,
    profile(name) { return profiles[canon(name)] || null; },
    itemBenefit(name) { return (itemBenefits.get(canon(name)) || [])[0] || null; },
    itemBenefitsFor(name) { return [...(itemBenefits.get(canon(name)) || [])]; },
    get itemBenefits() { return new Map([...itemBenefits].map(([key, rows]) => [key, [...rows]])); }
  };
})();

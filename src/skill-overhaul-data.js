(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  const huntingImplements = [
    { name:'Trap', value:'+0.10 effective AM each', detail:'Standard trap. The Research List describes the normal limit as 5 traps per Hunter.', source:'Mandate', section:'13.1.15', aliases:['Traps'] },
    { name:'Snare', value:'+0.05 effective AM each', detail:'Hunting implement. Trappers research increases the Trap/Snare allowance to 10 per Hunter.', source:'Mandate', section:'13.1.15', aliases:['Snares'] },
    { name:'Bow', value:'+0.15 effective AM', detail:'One hunting implement per Hunter unless a specific rule says otherwise.', source:'Mandate', section:'13.1.15', aliases:['Bows'] },
    { name:'Sling', value:'+0.10 effective AM', detail:'One hunting implement per Hunter unless a specific rule says otherwise.', source:'Mandate', section:'13.1.15', aliases:['Slings'] },
    { name:'Arbalest', value:'+0.20 effective AM', detail:'Highest listed non-research hunting implement benefit in the Mandate.', source:'Mandate', section:'13.1.15', aliases:['Arbalests'] },
    { name:'Spear', value:'+0.05 effective AM', detail:'Mandate hunting benefit for Spears.', source:'Mandate', section:'13.1.15', aliases:['Spears'] },
    { name:'Bone Spear', value:'+0.05 effective AM', detail:'Mandate hunting benefit for Bone Spears.', source:'Mandate', section:'13.1.15', aliases:['Bone Spears'] },
    { name:'Stone Spear', value:'+0.05 effective AM', detail:'Mandate hunting benefit for Stone Spears.', source:'Mandate', section:'13.1.15', aliases:['Stone Spears'] },
    { name:'Spetum', value:'+0.05 effective AM', detail:'Mandate hunting benefit for Spetums.', source:'Mandate', section:'13.1.15', aliases:['Spetums'] },
    { name:'Net', value:'+0.10 effective AM', detail:'Mandate hunting benefit for Nets.', source:'Mandate', section:'13.1.15', aliases:['Nets'] },
    { name:'Improved Trap', value:'+0.15 effective AM each', detail:'Normally up to 5 per Hunter for +0.75 total. Trappers research raises the Improved Trap allowance to 10.', source:'Research', research:'Hunting / Improved Trap' },
    { name:'Advanced Trap', value:'+1.00 effective Hunting', detail:'Base entry: one Advanced Trap makes one Hunter count as two. Trappers research raises the allowance to 2 Advanced Traps.', source:'Research', research:'Hunting / Advanced Trap' },
    { name:'Hunting Dog', value:'+2 Hunter-equivalents', detail:'One Hunter with one Hunting Dog counts as 3 Hunters. Hunting Dogs are used automatically when available and do not breed.', source:'Research', research:'Hunting / Hunting Dogs', aliases:['Hunting Dogs'] }
  ];

  const profiles = {
    HUNTING: {
      name:'Hunting',
      status:'prototype',
      mechanic:'efficiency',
      mechanicLabel:'Efficiency / output skill',
      primarySection:'13.1.15',
      additionalSections:['13.1.14','23.5'],
      output:'Provisions',
      workerRule:'No worker limit',
      levelRule:'Higher Hunting skill increases provisions gathered. The Mandate does not give a single fixed per-level output formula because returns also vary with labour, terrain, season and weather.',
      summary:'Feeds the Tribe by gathering provisions. Hunting output scales with the number of Hunters, Hunting skill, terrain, season, weather and equipment.',
      levelEffects:[
        { level:'Any level', effect:'Skill level contributes directly to Hunting output; more skill means better returns.' },
        { level:'Level 11+', effect:'Hunting is one of the output-based skills that may be extended beyond level 10 through research. Hunting 11 is a DL5 research topic.' }
      ],
      keyRules:[
        { label:'Water-border bonus', value:'+10% for the first River, Lake or Ocean border', detail:'Additional water borders give slight further improvements.' },
        { label:'Worker cap', value:'None', detail:'There is no 10 × skill worker cap on Hunting.' },
        { label:'Equipment', value:'Normally one implement per Hunter', detail:'Trap-family rules are the important exception; the Mandate gives the example of 50 Sling users and 50 Hunters sharing 250 Traps.' },
        { label:'Order behaviour', value:'No conditional stop amount', detail:'Hunters gather based on the number assigned for the turn; orders such as “stop at 10,000 provs” are not supported.' }
      ],
      noBenefit:[
        { name:'Club', note:'Explicitly listed as having no effect on Hunting returns.' },
        { name:'Axe', note:'Explicitly listed as having no effect on Hunting returns.' },
        { name:'Horse', note:'Explicitly listed as having no effect on Hunting returns.' }
      ],
      implements:huntingImplements,
      relatedSkills:['Herding','Furrier','Metalwork','Weapons','Weaving']
    }
  };

  const itemBenefits = new Map();
  for (const profile of Object.values(profiles)) {
    for (const item of profile.implements || []) {
      for (const name of [item.name, ...(item.aliases || [])]) {
        itemBenefits.set(canon(name), { ...item, skill:profile.name });
      }
    }
  }

  root.TribeNetSkillOverhaul = {
    canon,
    profiles,
    profile(name) { return profiles[canon(name)] || null; },
    itemBenefit(name) { return itemBenefits.get(canon(name)) || null; },
    get itemBenefits() { return new Map(itemBenefits); }
  };
})();

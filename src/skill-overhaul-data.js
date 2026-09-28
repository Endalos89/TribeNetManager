(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  const huntingImplements = [
    { name:'Trap', category:'Trap-family', value:'+0.10 AM', baseMax:'5', baseMaxBenefit:'+0.50 AM', detail:'A Hunter uses one implement type; Trap-family implements allow multiple copies of that type.', source:'Mandate', section:'13.1.15', aliases:['Traps'] },
    { name:'Snare', category:'Trap-family', value:'+0.05 AM', baseMax:'5', baseMaxBenefit:'+0.25 AM', detail:'A Hunter uses one implement type; Trap-family implements allow multiple copies of that type.', source:'Mandate', section:'13.1.15', aliases:['Snares'] },
    { name:'Bow', category:'Single implement', value:'+0.15 AM', baseMax:'1', baseMaxBenefit:'+0.15 AM', detail:'One Bow can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Bows'] },
    { name:'Sling', category:'Single implement', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', detail:'One Sling can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Slings'] },
    { name:'Arbalest', category:'Single implement', value:'+0.20 AM', baseMax:'1', baseMaxBenefit:'+0.20 AM', detail:'One Arbalest can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Arbalests'] },
    { name:'Spear', category:'Single implement', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', detail:'One Spear can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Spears'] },
    { name:'Bone Spear', category:'Single implement', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', detail:'One Bone Spear can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Bone Spears'] },
    { name:'Stone Spear', category:'Single implement', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', detail:'One Stone Spear can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Stone Spears'] },
    { name:'Spetum', category:'Single implement', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', detail:'One Spetum can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Spetums'] },
    { name:'Net', category:'Single implement', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', detail:'One Net can be used by a Hunter as their chosen implement type.', source:'Mandate', section:'13.1.15', aliases:['Nets'] },
    { name:'Improved Trap', category:'Trap-family · research', value:'+0.15 AM', baseMax:'5', baseMaxBenefit:'+0.75 AM', detail:'Base allowance is 5 Improved Traps per Hunter. Trappers research raises this to 10.', source:'Research', research:'Hunting / Improved Trap' },
    { name:'Advanced Trap', category:'Trap-family · research', value:'+1.00 AM', baseMax:'1', baseMaxBenefit:'+1.00 AM', detail:'Base allowance is 1 Advanced Trap per Hunter. Trappers research raises this to 2.', source:'Research', research:'Hunting / Advanced Trap' },
    { name:'Hunting Dog', category:'Research support', value:'+2 Hunter-equivalents', baseMax:'1 per Hunter', baseMaxBenefit:'+2 Hunter-equivalents', detail:'One Hunter with one Hunting Dog counts as 3 Hunters. Hunting Dogs are automatically used when available and are not listed as Hunting implements in the Mandate.', source:'Research', research:'Hunting / Hunting Dogs', aliases:['Hunting Dogs'] }
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
        { factor:'Terrain', effect:'Affects Hunting returns.', detail:'A hex with a River, Lake or Ocean border gets +10% Hunting returns for the first water border; additional water borders give slight further improvements.' },
        { factor:'Season', effect:'Affects Hunting returns.', detail:'The Mandate states that season changes output but does not provide a single fixed modifier.' },
        { factor:'Weather', effect:'Affects Hunting returns.', detail:'The Mandate states that weather changes output but does not provide a single fixed modifier.' }
      ],
      orderRules:[
        { label:'Conditional stop amounts', value:'Not supported', detail:'Hunters gather according to the number assigned for the turn; orders such as “stop at 10,000 provs” are not supported.' }
      ],
      implementRule:'Each individual Hunter uses only one implement type. Different Hunters in the same group may use different implement types. Trap-family implements are the exception to the one-item quantity: a Hunter may use several Traps/Snares/Improved Traps of the chosen type, while the base Advanced Trap allowance is one.',
      implements:huntingImplements,
      relatedSkills:['Herding','Furrier','Metalwork','Weapons','Weaving']
    }
  };

  const itemBenefits = new Map();
  for (const profile of Object.values(profiles)) {
    for (const item of profile.implements || []) {
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

(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const amDefinition = 'AM means Active Month: the amount of work one person can do in a month. Players also use AM as shorthand when comparing productivity or the effort needed to produce something.';

  const benefitAmount = value => {
    const match = String(value || '').replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const sortByBaseMaxBenefit = items => [...(items || [])].sort((a,b) => benefitAmount(b.baseMaxBenefit) - benefitAmount(a.baseMaxBenefit) || String(a.name || '').localeCompare(String(b.name || '')));

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

  const forestryModifiers = [
    { name:'Adze', appliesTo:'Logs', value:'×2 log output', effect:'Raises the base rate from 4 to 8 Logs per worker.', craft:[{skill:'Metalwork',level:4}], requiresResearch:false, source:'Mandate', section:'13.1.21', detail:'A Forester with an Adze fells 8 Logs.' },
    { name:'Saw', appliesTo:'Logs', value:'×4 log output', effect:'Raises the normal base rate from 4 to 16 Logs per worker. Cannot be used with an Adze.', craft:[{skill:'Metalwork',level:5}], requiresResearch:true, source:'Research', research:'Forestry / Saw', detail:'Research tool that multiplies Forestry logging by four.' },
    { name:'Scraper (Metal)', appliesTo:'Bark', value:'×2 bark output', effect:'Doubles Bark stripping output.', craft:[{skill:'Metalwork',level:1}], requiresResearch:true, source:'Research', research:'Forestry / Scraper (Metal)', detail:'Research tool that doubles Bark stripping.' },
    { name:'Scraper (Stone)', appliesTo:'Bark', value:'×2 bark output', effect:'Doubles Bark stripping output.', craft:[{skill:'Stonework',level:2}], requiresResearch:true, source:'Research', research:'Forestry / Scraper (Stone)', detail:'Research tool that doubles Bark stripping.' },
    { name:'Burner Improvement', appliesTo:'Charcoal', value:'×2 effective workers', effect:'Each Burner Improvement doubles the effective workers for one burner (10 Charcoal makers).', craft:[{skill:'Engineering',level:6},{skill:'Stonework',level:4},{skill:'Metalwork',level:4},{skill:'Brick Making',level:4}], requiresResearch:true, source:'Research', research:'Forestry / Burner Improvements', detail:'Research building improvement for Charcoal Making.' },
    { name:'Sawmill', appliesTo:'Logs', value:'×8 normal log output', effect:'Up to 100 workers per Sawmill produce eight times their normal Logs; Adze/Saw cannot be used with it, but Logs-per-Person research can.', craft:[{skill:'Engineering',level:6},{skill:'Woodwork',level:4},{skill:'Stonework',level:4}], requiresResearch:true, source:'Research', research:'Milling / Sawmill', detail:'Research building requiring Forestry 4 and a river/canal site in Forestry terrain.' }
  ];

  const profiles = {
    HUNTING: {
      name:'Hunting',
      status:'prototype',
      layout:'hunting',
      mechanic:'efficiency',
      mechanicLabel:'Efficiency / output skill',
      primarySection:'13.1.15',
      additionalSections:['23.5'],
      workerRule:'No worker limit',
      workerDetail:'Hunting is not limited to 10 workers per skill level.',
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
    },

    WOODWORK: {
      name:'Woodwork',
      aliases:['Woodworking'],
      researchAliases:['Woodwork','Woodworking','Wd','Wdw'],
      status:'prototype',
      layout:'unlock',
      mechanic:'unlock',
      mechanicLabel:'Level unlock / prerequisite skill',
      primarySection:'13.1.37',
      additionalSections:['13.1.23','13.1.29','14.2.2','14.3.3','21.6','24'],
      workerRule:'No worker limit',
      workerDetail:'Woodwork itself does not impose a worker cap; individual recipes still have their own people and material requirements.',
      summary:'Higher Woodwork levels unlock more wooden goods and are also used as prerequisites for instruments, construction, siege equipment and shipbuilding.',
      levelUses:[
        { level:1, item:'Clubs', use:'Clubs ×4', kind:'Craft', detail:'Makes four Clubs. In forest/jungle no Logs are needed; elsewhere one Log makes four Clubs.', source:'13.1.37' },
        { level:2, item:'Paddle', use:'Paddle', kind:'Craft', detail:'Makes a Paddle.', source:'13.1.37' },
        { level:3, item:'Rake', use:'Rake', kind:'Craft', detail:'Makes a Rake; a person with a Rake can plow 1 acre.', source:'13.1.37' },
        { level:3, item:'Wagon', use:'Wagon', kind:'Craft', detail:'Makes a Wagon.', source:'13.1.37' },
        { level:3, item:'Oar', use:'Oar', kind:'Craft', detail:'Makes an Oar.', source:'13.1.37' },
        { level:3, item:'Drum', use:'Drum', kind:'Music prerequisite', detail:'Drum construction requires Music 1 and Woodwork 3.', source:'13.1.23' },
        { level:3, item:'Courthouse', use:'Courthouse', kind:'Construction prerequisite', detail:'A Courthouse requires Woodwork 3 in addition to its other requirements.', source:'24' },
        { level:4, item:'Frame', use:'Frames ×2', kind:'Craft', detail:'Makes two Frames from one Log.', source:'13.1.37' },
        { level:4, item:'Chair', use:'Chair', kind:'Craft', detail:'Makes a Chair.', source:'13.1.37' },
        { level:4, item:'Bench', use:'Bench', kind:'Craft', detail:'Makes a Bench.', source:'13.1.37' },
        { level:4, item:'Planks', use:'Planks ×2', kind:'Craft', detail:'Makes two Planks used for ship repair.', source:'13.1.37' },
        { level:4, item:'Flute', use:'Flute', kind:'Music prerequisite', detail:'Flute construction requires Music 4 and Woodwork 4.', source:'13.1.23' },
        { level:4, use:'Wood in stone buildings', kind:'Construction option', detail:'Logs may replace up to 10% of Stones in eligible stone buildings and Stone Towers; each Log replaces 10 Stones.', source:'14.2.2' },
        { level:4, item:'Apiary', use:'Alternate Apiary construction', kind:'Construction prerequisite', detail:'The alternate all-wood Apiary method requires Engineering 6 and Woodwork 4.', source:'14.3.3' },
        { level:5, item:'Bed', use:'Bed', kind:'Craft', detail:'Makes a Bed.', source:'13.1.37' },
        { level:5, item:'Podium', use:'Podium', kind:'Craft', detail:'Makes a Podium.', source:'13.1.37' },
        { level:5, item:'Table', use:'Table', kind:'Craft', detail:'Makes a Table.', source:'13.1.37' },
        { level:5, item:'Horn', use:'Horn', kind:'Music prerequisite', detail:'Horn construction requires Music 3 and Woodwork 5.', source:'13.1.23' },
        { level:5, item:'Barge', use:'Barge construction', kind:'Shipbuilding prerequisite', detail:'Building Barges requires Shipbuilding 3, Woodwork 5 and Metalwork 3.', source:'21.6' },
        { level:6, item:'Trumpet', use:'Trumpet', kind:'Music prerequisite', detail:'Trumpet construction requires Music 6 and Woodwork 6.', source:'13.1.23' },
        { level:6, item:'Harp', use:'Harp', kind:'Music prerequisite', detail:'Harp construction requires Music 7 and Woodwork 6.', source:'13.1.23' },
        { level:6, item:'Onager', use:'Onager', kind:'Siege prerequisite', detail:'Onager construction also requires Woodwork 6.', source:'13.1.29' },
        { level:8, item:'Lute', use:'Lute', kind:'Music prerequisite', detail:'Lute construction requires Music 8 and Woodwork 8.', source:'13.1.23' }
      ],
      relatedSkills:['Music','Engineering','Shipbuilding','Siege Equipment','Metalwork']
    },

    ECONOMICS: {
      name:'Economics',
      aliases:['Economy'],
      researchAliases:['Economics','Eco'],
      status:'prototype',
      layout:'unlock',
      mechanic:'unlock',
      mechanicLabel:'Trade scaling / level unlock skill',
      primarySection:'15.1',
      additionalSections:['14.14','25','29.17'],
      workerRule:'Not a worker-assignment skill',
      workerDetail:'Economics changes trading access and returns rather than setting an Activity worker limit.',
      summary:'Economics improves Fair income, unlocks Fair trading at key levels and eventually enables Banks and the Banking skill.',
      levelUses:[
        { level:'Any', use:'Fair income scaling', kind:'Scaling benefit', detail:'Economics contributes Eco/4 to the Silver formulas for Triball and for cultural performances sold at Fair.', source:'15.1' },
        { level:4, item:'Trading Post', use:'Operate a Trading Post', kind:'Trade unlock', detail:'A functioning Trading Post can be operated with Economics 4 (or Diplomacy 7).', source:'14.14' },
        { level:4, use:'Trade at Fair with Trading Post', kind:'Trade unlock', detail:'Economics 4 permits Fair trading when the Tribe has the required Trading Post/Village arrangement.', source:'15.1' },
        { level:5, use:'Nomadic Fair trading', kind:'Trade unlock', detail:'Economics 5 permits a nomadic Tribe to trade at Fair without relying on the Economics 4 + Trading Post route.', source:'15.1' },
        { level:10, item:'Bank', use:'Establish and operate a Bank', kind:'Banking unlock', detail:'Economics 10 enables a suitable permanent stone-walled Village to establish a Bank; only the Economics 10 Tribe can operate it.', source:'25' },
        { level:10, use:'Attempt Banking skill', kind:'Skill unlock', detail:'A Tribe with Economics 10 may attempt the Group C Banking skill.', source:'25' }
      ],
      relatedSkills:['Diplomacy','Banking','Triball','Art','Music','Dance']
    },

    FORESTRY: {
      name:'Forestry',
      researchAliases:['Forestry'],
      status:'prototype',
      layout:'forestry',
      mechanic:'capacity-output',
      mechanicLabel:'Worker-limited output skill',
      primarySection:'13.1.9',
      additionalSections:['14.6.1'],
      workerRule:'10 workers per skill level; unlimited at level 10',
      workerDetail:'The Forestry cap is shared across Forestry work. At Forestry 5, for example, 50 total workers can be split between Logs, Bark and Charcoal Making.',
      summary:'Forestry gathers Logs and Bark in forest/jungle terrain and, from Forestry 5 with a Charhouse, can also turn Logs into Charcoal. Skill level primarily raises the number of workers you can assign.',
      outputs:[
        { item:'Logs', label:'Logs', rate:'4 / worker', type:'Raw material', detail:'Each assigned Forester fells 4 Logs in forest or jungle terrain.', source:'13.1.9' },
        { item:'Bark', label:'Bark', rate:'20 lb / worker', type:'Raw material', detail:'Each assigned Forester strips 20 lb of Bark in forest or jungle terrain.', source:'13.1.9' },
        { item:'Charcoal', label:'Charcoal', rate:'10 Coal-equivalent / worker', type:'Processed fuel', detail:'From Forestry 5, with a Charhouse, each worker turns 2 Logs into Charcoal equal in usage to 10 Coal.', source:'14.6.1' },
        { item:'Tar', label:'Tar', rate:'By-product', type:'By-product', detail:'Tar is produced as a by-product of the Charcoal Making activity.', source:'13.1.9' }
      ],
      factors:[
        { factor:'Terrain', effect:'Forest / jungle for Logs and Bark.', detail:'The base Forestry gathering activity for Logs and Bark is performed in forest or jungle terrain.' },
        { factor:'Same-turn use', effect:'New Logs are delayed.', detail:'Logs acquired through Forestry may not be used in the turn they are acquired.' },
        { factor:'Charcoal facility', effect:'Forestry 5 + Charhouse.', detail:'Charcoal Making requires Forestry 5 and a Charhouse; its workers count against the Forestry worker limit.' }
      ],
      modifiers:forestryModifiers,
      benefitItems:forestryModifiers,
      relatedSkills:['Metalwork','Stonework','Milling','Engineering']
    }
  };

  const aliases = new Map();
  for (const [key, profile] of Object.entries(profiles)) {
    aliases.set(key, key);
    aliases.set(canon(profile.name), key);
    for (const alias of profile.aliases || []) aliases.set(canon(alias), key);
  }

  const itemBenefits = new Map();
  for (const profile of Object.values(profiles)) {
    const items = [...(profile.implements || []), ...(profile.supportImplements || []), ...(profile.benefitItems || [])];
    for (const item of items) {
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
    amDefinition,
    benefitAmount,
    sortByBaseMaxBenefit,
    profiles,
    profile(name) { const key = aliases.get(canon(name)); return key ? profiles[key] : null; },
    itemBenefit(name) { return (itemBenefits.get(canon(name)) || [])[0] || null; },
    itemBenefitsFor(name) { return [...(itemBenefits.get(canon(name)) || [])]; },
    get itemBenefits() { return new Map([...itemBenefits].map(([key, rows]) => [key, [...rows]])); }
  };
})();

(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'C',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  register('SEEKING', {
    name:'Seeking',
    aliases:['Seek'],
    researchAliases:['Seeking','Seek'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Seasonal search / return-efficiency skill',
    levelDetail:'Seeking is a Springtide (month 01) Warrior activity. The current Mandate states that Seeking and Scouting improve guaranteed returns, but the exact return formula is supplied through the Seeking spreadsheet rather than published as a formula in N02.2.',
    primarySection:'13.1.26',
    additionalSections:['13.1.27'],
    workerRule:'Warrior limits are determined by the Seeking spreadsheet for each sought item; only one Tribe per Clan may perform normal Seeking',
    workerDetail:'Horses may not exceed the number of Warriors assigned. Warriors and Horses used for Seeking are unavailable for Combat or other Activities that turn.',
    summary:'A seasonal search skill used in Spring month 01 for animals, people and resources. Seeking and Scouting improve the result, while Horses, Dogs, Backpacks and research can further improve or broaden finds.',
    factors:[
      { factor:'Season', effect:'Spring month 01 only', detail:'Normal Seeking is performed during Springtide.' },
      { factor:'Clan limit', effect:'1 Seeking Tribe per Clan', detail:'Only one Tribe in the Clan may conduct normal Seeking each year.' },
      { factor:'Targets', effect:'Wax, Hives, Spice, recruits, Honey, Herbs, Goats, Cattle, Horses and Dogs', detail:'The Mandate lists these as normal Seeking targets.' },
      { factor:'Skills', effect:'Seeking + Scouting improve returns', detail:'Guaranteed returns depend on Seeking and Scouting levels, assigned Warriors and Horses, with other support shown in the Seeking spreadsheet.' },
      { factor:'Horses', effect:'Horses ≤ Warriors', detail:'Assigned Horses may not exceed assigned Warriors.' },
      { factor:'Dogs / Backpacks', effect:'Assist Seeking', detail:'The Mandate identifies Dogs and Backpacks among the support that can improve Seeking.' },
      { factor:'Published formula', effect:'Not published in N02.2', detail:'Players use the annual Seeking spreadsheet for the actual return calculation; no generic formula is inferred here.' },
      { factor:'Rich Seeking', effect:'Additional special-hex Seeking', detail:'A unit in a Rich Seeking hex may perform Rich Seeking in addition to normal Seeking under the Seeking Table.' }
    ],
    researchEffectOverrides:{
      'Bush Lore 1, 2, 3':'Bush Lore I adds +1 Seeking, Bush Lore II adds +3 Seeking and Bush Lore III adds +5 Seeking. Completing Bush Lore I also unlocks the Group C Bush Lore skill used to access Bush Lore IV and beyond.',
      'Experienced Seekers':'If the Tribe seeks the same item in the same hex as the previous year, double the Seeking return shown by the Seeking sheet. This also works in Rich Seeking hexes.',
      'Exotic Seekers':'Unlocks Seeking for a cycling set of exotic Desired Commodities at a special Seeking hex 45–60 movement points away, under the published selection rules.',
      'Exotic Seekers II, III':'Each expansion adds two more exotic item types to the exotic Seeking pool, taking the total to six and then eight.',
      'Seek Population':'When Seeking Actives, gain an equal number of Inactives.',
      'Seeking 11':'+1 Seeking level, taking Seeking 10 to 11.',
      'Trackers':'+10% Seeking returns, rounded up.',
      'Expert Trackers':'Adds a further +10% Seeking return (20% total with Trackers) and also gives +5% Hunting returns.',
      'Veteran Trackers':'Adds another +10% Seeking return, bringing Trackers + Expert Trackers + Veteran Trackers to +30% total.'
    },
    relatedSkills:['Scouting','Hunting','Bush Lore']
  });

  benefit('Backpack', { skill:'Seeking', value:'Seeking support item', detail:'Backpacks are among the support items accounted for by the Seeking spreadsheet.', source:'Mandate', section:'13.1.26' });
  benefit('Dogs', { skill:'Seeking', value:'Seeking support', detail:'Dogs assist Seeking under the annual Seeking rules/spreadsheet.', source:'Mandate', section:'13.1.26' });

  register('SHIPBUILDING', {
    name:'Shipbuilding',
    aliases:['ShB'],
    researchAliases:['Shipbuilding','ShB'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Vessel recipe / prerequisite skill',
    levelDetail:'Shipbuilding level unlocks vessel recipes. It does not set the number of actual shipbuilders: that capacity is controlled by Shipwright skill and available Shipyard capacity.',
    primarySection:'20.4',
    additionalSections:['20.2','20.3','14.15'],
    workerRule:'Shipbuilding itself has no published 10×level worker cap; actual builders are capped by Shipwright and Shipyard capacity',
    workerDetail:'Shipwright permits 10 actual shipbuilders per level until level 10, then unlimited, and the Shipyard must have matching capacity. Vessel recipes separately require a Shipbuilding level.',
    summary:'The recipe-unlock side of naval construction. Shipbuilding determines which vessel designs a Tribe can build, while Shipwright and Shipyard capacity determine how many actual workers can be assigned.',
    levelUses:[
      { level:1, item:'Boat', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Boat/Lifeboat requires Shipbuilding 1.', source:'20.4' },
      { level:2, item:'Ferry', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Ferry requires Shipbuilding 2.', source:'20.4' },
      { level:2, item:'Fisher', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Fisher requires Shipbuilding 2.', source:'20.4' },
      { level:3, item:'Barge', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Barge requires Shipbuilding 3.', source:'20.4' },
      { level:3, item:'Coaster', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Coaster requires Shipbuilding 3.', source:'20.4' },
      { level:4, item:'Small Galley', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Small Galley requires Shipbuilding 4.', source:'20.4' },
      { level:5, item:'Medium Galley', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Medium Galley requires Shipbuilding 5.', source:'20.4' },
      { level:6, item:'Large Galley', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Large Galley requires Shipbuilding 6.', source:'20.4' },
      { level:6, item:'Trader', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Trader requires Shipbuilding 6.', source:'20.4' },
      { level:8, item:'Longship', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Longship requires Shipbuilding 8.', source:'20.4' },
      { level:9, item:'Merchant', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Merchant requires Shipbuilding 9.', source:'20.4' },
      { level:9, item:'Warship', use:'Shipbuilding recipe', kind:'Direct vessel recipe', detail:'Warship requires Shipbuilding 9.', source:'20.4' }
    ],
    factors:[
      { factor:'Shipwright', effect:'Worker-cap skill', detail:'Each participating Tribe must have enough Shipwright levels for its actual shipbuilders.' },
      { factor:'Shipyard', effect:'Facility-capacity requirement', detail:'Ships may only be built in the hex containing a Shipyard with enough capacity.' },
      { factor:'Materials', effect:'Must be present when work is performed', detail:'Materials must be held by the building Tribe or its Goods Tribe during the work, not merely at completion.' },
      { factor:'Multi-turn builds', effect:'Track AM progress', detail:'Partial ship construction should show active-month progress and may require GM Actions when automation is unreliable.' }
    ],
    researchEffectOverrides:{
      'Felucca Class I, Felucca Class II':'Unlocks a Shipbuilding 8 / Woodwork 8 / Metalwork 6 Felucca. Class I has base 58 sail / 54 row movement; Class II raises this to 66 sail / 62 row.',
      'Felucca Class III, Felucca Class IV':'Further Felucca development using Oak or Mahogany. Class III reaches base 74 sail / 70 row; Class IV reaches 82 sail / 78 row with improved durability/capacity.',
      'Frigate':'Unlocks the Shipbuilding 10 Frigate, a sailing warship with 160 defence points, 80 hull damage rating, 25,000 cargo and capacity for up to 12 Naval Cannons.',
      'Shipbuilding 11':'Provides a 10% increase in Shipbuilding output represented by Auxiliaries equal to 10% of assigned workers. Extra Shipyard capacity is required for the effective workers.',
      'Whaler':'Unlocks a Shipbuilding 9 Whaler. It increases catch size (not catch chance) and allows whales to be processed at sea when equipped and crewed under the research rules.'
    },
    relatedSkills:['Shipwright','Engineering','Woodwork','Metalwork','Maintain Boats']
  });

  benefit('Shipyard', { skill:'Shipbuilding', value:'Required construction facility', detail:'Shipbuilding must occur in the hex containing a Shipyard with sufficient actual-worker capacity.', source:'Mandate', section:'20.2 / 20.4' });
  benefit('Felucca', { skill:'Shipbuilding', value:'Research vessel', detail:'Felucca research unlocks progressively faster Shipbuilding 8 vessels.', source:'Research', research:'Shipbuilding / Felucca Class' });
  benefit('Frigate', { skill:'Shipbuilding', value:'Shipbuilding 10 research vessel', detail:'Frigate research unlocks a large naval combat vessel capable of carrying Naval Cannons.', source:'Research', research:'Shipbuilding / Frigate' });
  benefit('Whaler', { skill:'Shipbuilding', value:'Shipbuilding 9 research vessel', detail:'Whaler research unlocks a vessel that improves whale catch size and supports at-sea processing.', source:'Research', research:'Shipbuilding / Whaler' });

  register('STONEWORK', {
    name:'Stonework',
    aliases:['Stn'],
    researchAliases:['Stonework','Stn'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Stone item / facility recipe skill',
    levelDetail:'Stonework has unlimited manpower. Skill levels unlock direct stone items and alternate stone-built Village installations; each recipe supplies its own material and labour requirement.',
    primarySection:'13.1.32',
    additionalSections:['14.13'],
    workerRule:'No Stonework worker limit',
    workerDetail:'Direct Stonework items use the people shown in their recipes. Village facility installations use Stones installed at 5 Stones per person.',
    summary:'A prerequisite-style crafting skill for stone tools, art objects and Millstones, and an alternate construction route for Ovens, Kilns, Burners and Smelters.',
    levelUses:[
      { level:2, item:'Stone Axe', use:'1 Stone + 1 Club + 1 Leather', kind:'Direct recipe', detail:'Requires 1 person.', source:'13.1.32' },
      { level:4, item:'Stone Spear', use:'1 Stone + 1 Shaft', kind:'Direct recipe', detail:'Requires 1 person.', source:'13.1.32' },
      { level:4, item:'Baking Oven', use:'300 Stones per 10-user Oven', kind:'Facility installation', detail:'Stones installed at 5 per person.', source:'14.13' },
      { level:5, item:'Sculpture', use:'5 Stones', kind:'Direct recipe', detail:'Requires 4 people.', source:'13.1.32' },
      { level:5, item:'Brickworks Kiln', use:'300 Stones per 10-user Kiln', kind:'Facility installation', detail:'Stones installed at 5 per person.', source:'14.13' },
      { level:6, item:'Millstone', use:'10 Stones', kind:'Direct recipe', detail:'Requires 10 people.', source:'13.1.32' },
      { level:6, item:'Charring Burner', use:'300 Stones per 10-user Burner', kind:'Facility installation', detail:'Stones installed at 5 per person.', source:'14.13' },
      { level:8, item:'Statue', use:'10 Stones', kind:'Direct recipe', detail:'Requires 10 people.', source:'13.1.32' },
      { level:8, item:'Refining Smelter', use:'400 Stones per 10-user Smelter', kind:'Facility installation', detail:'Stones installed at 5 per person.', source:'14.13' }
    ],
    factors:[
      { factor:'Worker cap', effect:'Unlimited', detail:'Unlike many production skills, Stonework does not use the 10-workers-per-level cap.' },
      { factor:'Stone installation rate', effect:'5 Stones per person', detail:'Used for the Village-based alternative installations in section 14.13.' },
      { factor:'Current coding note', effect:'Manual Stone usage may be required', detail:'N02.2 warns that Stone usage for Stonework items may be misreported by code; players should transfer Stones to usage and flag GM Actions where required.' }
    ],
    researchEffectOverrides:{
      'Chisel':'A worker with a Chisel doubles Stonework or Art output for stone items. For Quarrying it doubles base output to 10 Stones and may combine with a Mattock for 15 Stones per worker.',
      'Marble Statue':'Unlocks Marble Statues as a Stonework or Art activity. The recipe uses 12 people, Stonework 6, Art 6 and 200 Marble; the item is a Trade Good and completing the research also places a Marble mine near the chosen village.',
      'Scraper (Stone)':'Allows a Stonework 2 worker to make a Scraper from 1 Stone. The Scraper doubles bark-stripping output.'
    },
    relatedSkills:['Engineering','Art','Quarrying','Metalwork','Baking','Brick Making','Refining']
  });

  benefit('Chisel', { skill:'Stonework', value:'×2 stone-item output', detail:'Chisel research doubles Stonework output for stone items; it also improves Quarrying.', source:'Research', research:'Stonework / Chisel' });
  benefit('Marble Statue', { skill:'Stonework', value:'Stonework 6 research craft', detail:'Marble Statue research allows crafting as Stonework or Art and creates a Fair-tradeable good.', source:'Research', research:'Stonework / Marble Statue' });
  benefit('Scraper', { skill:'Stonework', value:'Stonework 2 research craft', detail:'Stone Scraper research creates a bark-stripping implement that doubles bark output.', source:'Research', research:'Stonework / Scraper (Stone)' });
  benefit('Millstone', { skill:'Stonework', value:'Stonework 6 recipe', detail:'10 people use 10 Stones to make a Millstone.', source:'Mandate', section:'13.1.32' });

  register('APIOLOGY', {
    name:'Apiology',
    aliases:['Apiol'],
    researchAliases:['Apiology','Apiol'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-unlocked access skill',
    levelDetail:'Apiology is a research-unlocked Group C skill whose stated purpose is purely to access Apiology IV and later research. The skill itself has no separately published worker activity or base production effect.',
    primarySection:'23',
    additionalSections:['14.3.1'],
    workerRule:'No Apiology worker activity is published',
    workerDetail:'Apiology is learned after Apiology I research is completed. Its function is to reach the skill threshold needed for later Apiology research.',
    summary:'A progression skill unlocked from the Apiarism research chain. Apiology does not directly tend Hives; instead it unlocks later research that increases effective Apiarism.',
    factors:[
      { factor:'Unlock', effect:'Complete Apiology I research', detail:'Apiology I requires Apiarism 11; once completed the Tribe may learn Apiology as a Group C skill.' },
      { factor:'Purpose', effect:'Access Apiology IV+', detail:'The Research List explicitly describes Apiology as purely a research-access skill.' },
      { factor:'Direct production effect', effect:'None published', detail:'No Honey/Wax/worker output is assigned directly to Apiology skill levels.' }
    ],
    researchEffectOverrides:{
      'Apiology IV, Apiology V, Apiology VI':'Each completed topic adds +2 Apiarism. Apiology IV requires Apiology 10 plus Apiology III from the Apiarism research chain.',
      'Apiology 7+':'Every Apiology research topic at level 7 or higher adds a further +2 Apiarism; the Research List states no current upper limit to Apiology research levels.'
    },
    relatedSkills:['Apiarism','Healing']
  });

  register('AGRICULTURE', {
    name:'Agriculture',
    aliases:['Agr'],
    researchAliases:['Agriculture','Agr'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-unlocked Farming progression skill',
    levelDetail:'Agriculture is a research-unlocked Group C skill described as purely providing access to Agriculture IV and later research, whose published benefit is to add levels to Farming.',
    primarySection:'23',
    additionalSections:['14.9'],
    workerRule:'No Agriculture worker activity is published',
    workerDetail:'Farming remains the activity skill. Agriculture is learned through the Farming research chain and is then raised to access later Agriculture research.',
    summary:'A progression skill unlocked from Farming research. Agriculture itself is an access skill; its research topics increase effective Farming levels.',
    factors:[
      { factor:'Unlock chain', effect:'Farming 11 → Agriculture I', detail:'Agriculture I requires Farming 11. Completing Agriculture I unlocks Agriculture as a learnable Group C skill.' },
      { factor:'Agriculture I–III', effect:'+2 Farming each', detail:'These topics are researched under Farming and lead into the Agriculture research chain.' },
      { factor:'Purpose', effect:'Access Agriculture IV+', detail:'The Research List explicitly says Agriculture skill is purely to access Agriculture research topics IV and beyond.' },
      { factor:'Agriculture 11 source gap', effect:'Effect not published', detail:'The current Research List names Agriculture 11 and makes it a prerequisite for Agriculture IV, but does not state an Agriculture 11 effect; none is inferred.' }
    ],
    researchEffectOverrides:{
      'Agriculture IV, Agriculture V, Agriculture VI':'Each completed topic adds +2 Farming. Agriculture IV requires Agriculture 11 under the current Research List.',
      'Agriculture 7+':'Every Agriculture research topic at level 7 or higher adds +2 Farming; the Research List states no current limit to Agriculture research levels.',
      'Agriculture 11':'Listed as a research topic and prerequisite for Agriculture IV, but the current published entry does not state its effect.'
    },
    relatedSkills:['Farming']
  });

  register('CHEESEMAKING', {
    name:'Cheesemaking',
    aliases:['Cheese'],
    researchAliases:['Cheesemaking','Cheese'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Research-unlocked worker capacity / food conversion skill',
    levelDetail:'Cheesemaking is unlocked by Dairy Cattle research. It allows 10 Cheesemakers per Cheesemaking level until level 10, then unlimited; each worker turns 90 Milk into 30 Cheese.',
    primarySection:'23',
    additionalSections:[],
    workerRule:'10 Cheesemakers per Cheesemaking level; unlimited at level 10',
    workerDetail:'Each Cheesemaker uses 90 Milk to produce 30 Cheese. Cheese is consumed as Provisions at 1 Cheese = 1 Prov.',
    summary:'A research-unlocked Group C production skill created by Dairy Cattle research. It converts fresh Milk into storable food, with a normal 10-workers-per-level capacity model.',
    outputs:[
      { item:'Cheese', label:'Cheese', type:'Food conversion', detail:'1 Cheesemaker uses 90 Milk to make 30 Cheese. 1 Cheese is consumed as 1 Provision.', source:'Research / Dairy Cattle' }
    ],
    factors:[
      { factor:'Unlock', effect:'Dairy Cattle research', detail:'Dairy Cattle enables both the Milking and Cheesemaking activities/skills for the Tribe with the research.' },
      { factor:'Worker capacity', effect:'10 per level; unlimited at 10', detail:'Cheesemaking follows the standard capped-worker progression.' },
      { factor:'Input', effect:'90 Milk per worker', detail:'Milk used for Cheesemaking must be available in the turn produced under the Dairy rules.' },
      { factor:'Food value', effect:'1 Cheese = 1 Prov', detail:'Cheese is consumed directly as Provisions.' }
    ],
    researchEffectOverrides:{
      'Cheesemaking 11':'Increases Cheesemaking output by 10%, represented by Auxiliaries equal to 10% of the workers assigned. Tool coverage, if applicable, remains based on actual workers.'
    },
    relatedSkills:['Herding','Milking']
  });

  benefit('Cheese', { skill:'Cheesemaking', value:'30 Cheese from 90 Milk per worker', detail:'Each Cheesemaker converts 90 Milk into 30 Cheese; 1 Cheese counts as 1 Provision.', source:'Research', research:'Herding / Dairy Cattle' });

  register('GEOLOGY', {
    name:'Geology',
    aliases:['Geo','Geol'],
    researchAliases:['Geology','Geo','Geol'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-unlocked Mining progression skill',
    levelDetail:'Geology is a research-unlocked Group C skill whose stated purpose is to access Geology IV and later research. Those research topics add effective Mining levels; Geology itself is not a mining worker/output skill.',
    primarySection:'23',
    additionalSections:['13.1.22'],
    workerRule:'No Geology worker activity is published',
    workerDetail:'Mining remains the activity skill. Geology is unlocked through Mining research and then raised to access later Geology research.',
    summary:'A Mining research progression skill. Geology I unlocks the Group C Geology skill; later Geology topics increase Mining rather than creating a separate Geology production activity.',
    factors:[
      { factor:'Unlock chain', effect:'Mining 11 → Geology I', detail:'Geology I requires Mining 11 and completing Geology I unlocks the Group C Geology skill.' },
      { factor:'Geology I–III', effect:'+2 Mining each', detail:'These early topics are researched under Mining before the standalone Geology research chain.' },
      { factor:'Purpose', effect:'Access Geology IV+', detail:'The Research List explicitly describes Geology as purely a research-access skill.' },
      { factor:'Direct output', effect:'None published', detail:'Geology level itself does not replace the Mining activity or establish a separate worker formula.' }
    ],
    researchEffectOverrides:{
      'Geology 11':'+1 Geology level (10 → 11). The Research List notes there is currently no separate benefit merely for Geology being above 10.',
      'Geology IV, Geology V, Geology VI':'Each completed topic adds +2 Mining. Geology IV follows the Geology I–III / Geology-skill progression.',
      'Geology 7+':'Every Geology research topic at level 7 or higher adds +2 Mining; the Research List states no current upper limit to Geology research levels.'
    },
    relatedSkills:['Mining']
  });
})();

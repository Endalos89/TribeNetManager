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

  register('LITERACY', {
    name:'Literacy',
    aliases:['Lit'],
    researchAliases:['Literacy','Lit'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Book reading / writing success scaling skill',
    levelDetail:'Book writing succeeds at 5% × Literacy level. Reading a Book to obtain DL0 also succeeds at 5% × Literacy level; a Library increases either reading or writing chance by 50%.',
    primarySection:'23.1',
    additionalSections:['23.2','23.3','29.24'],
    workerRule:'Book writing requires no people; Book reading is a Tribe research attempt',
    workerDetail:'Literacy changes the probability of reading and writing Books rather than the number of workers assigned.',
    summary:'Controls the chance of successfully writing permanent research Books and using Books to acquire DL0. It also has its own research topics for morale and Scroll production.',
    factors:[
      { factor:'Book writing chance', effect:'5% × Literacy level', detail:'The Tribe attempting to write uses its own Literacy skill.' },
      { factor:'Book reading chance', effect:'5% × Literacy level for DL0', detail:'Reading a Book counts as a research attempt and requires level 10 in the relevant skill plus any other prerequisites.' },
      { factor:'Library', effect:'×1.5 reading/writing chance', detail:'A Library increases the chance by 50%; for example a 20% chance becomes 30%.' },
      { factor:'Book materials', effect:'10×DL² Parchment + DL Leather + 3×DL Gold + DL Candle', detail:'No people are required; materials are sent to usage and lost on failure.' },
      { factor:'Attempt limit', effect:'1 Book-writing attempt per Clan per turn', detail:'A Tribe, including its units, may hold only one Book at a time.' },
      { factor:'Transfer limit', effect:'1 Book per unit per turn', detail:'Book creation and transfer are currently handled manually.' }
    ],
    researchEffectOverrides:{
      'Haiku':'Completing Haiku adds +0.05 General Morale. It may be completed repeatedly in the same Tribe; unlike the other Literacy topics, a Book may be written about Haiku.',
      'Scroll':'Allows the Tribe to make 5 Scrolls using 1 person, 100 Parchment and 100 Coin. After the five Scrolls are made, the research is removed and may be researched again.'
    },
    relatedSkills:['Research','Engineering','Stonework']
  });

  benefit('Book', { skill:'Literacy', value:'5% × Literacy to write/read DL0', detail:'Literacy sets Book-writing success and Book-reading DL0 success.', source:'Mandate', section:'23.1 / 23.2' });
  benefit('Library', { skill:'Literacy', value:'+50% reading/writing chance', detail:'A Library multiplies the Literacy-based chance by 1.5.', source:'Mandate', section:'23.3' });
  benefit('Scroll', { skill:'Literacy', value:'Research craft', detail:'Scroll research allows batches of five Scrolls to be made from Parchment and Coin.', source:'Research', research:'Literacy / Scroll' });

  register('MAINTAIN BOATS', {
    name:'Maintain Boats',
    aliases:['MtnB'],
    researchAliases:['Maintain Boats','MtnB'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Naval maintenance-crew scaling / endpoint skill',
    levelDetail:'Maintain Boats requirements are built into ship crew requirements. At Maintain Boats 10 the additional maintenance crew requirement is eliminated. N02.2 does not publish a numeric interpolation for levels 1–9, so none is inferred.',
    primarySection:'21.2',
    additionalSections:['21.3.1','29.25'],
    workerRule:'Maintenance workers are represented inside the vessel crew requirement rather than as a separate moving-fleet Activity order',
    workerDetail:'For example, a sailed Longship lists 10+6 crew: the additional six are the maintenance component. Required crew must be present for movement but may also perform Activities.',
    summary:'Reduces the maintenance burden built into naval crew requirements. The published hard endpoint is Maintain Boats 10, where the extra maintenance crew is no longer required; its research also increases ship people-space capacity.',
    factors:[
      { factor:'Crew integration', effect:'Maintenance is built into crew figures', detail:'Published ship crew entries use +x additions for the maintenance requirement.' },
      { factor:'Maintain Boats 10', effect:'No additional maintenance crew', detail:'The extra maintenance component is removed at level 10.' },
      { factor:'Levels 1–9', effect:'No published formula', detail:'The current Mandate does not state how the additional maintenance crew scales at intermediate levels.' },
      { factor:'Movement timing', effect:'Crew present in movement phase', detail:'Required crew may still perform other Activities.' },
      { factor:'Boatsheds / land', effect:'No separate Maintain Boats order', detail:'The Mandate says not to order people to maintain vessels when they are on land/in Boatsheds.' }
    ],
    researchEffectOverrides:{
      'Amphibious Warfare I':'Increases ship people-space capacity by 25%. The extra people-space can also be converted to animal transport space under the normal carrying rules.',
      'Amphibious Warfare II':'Adds a further 25%, for a total 50% increase to ship people-space capacity.'
    },
    relatedSkills:['Shipbuilding','Shipwright','Mariner','Navigation','Sailing','Rowing']
  });

  register('MILLING', {
    name:'Milling',
    aliases:['Mil'],
    researchAliases:['Milling','Mil'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Worker capacity / grain-to-flour output skill',
    levelDetail:'Normal Milling converts 80 Grain into 120 Flour per assigned worker. Worker capacity is 10 actual millers per Milling level until level 10, then unlimited, subject to Mill capacity.',
    primarySection:'14.11.1',
    additionalSections:['14.11.2'],
    workerRule:'10 Milling workers per skill level; unlimited at level 10',
    workerDetail:'Each normal Mill supports up to 10 workers and needs 2 Cattle or Horses to operate.',
    summary:'Controls normal flour-milling workforce and output. Research expands Milling into Windmills, Oilmills and Sawmills with separate facility capacities and production rules.',
    outputs:[
      { item:'Flour', label:'Normal Milling', type:'Conversion', detail:'Each miller processes 80 Grain into 120 Flour.', source:'14.11.1' }
    ],
    factors:[
      { factor:'Mill capacity', effect:'10 workers per Mill', detail:'The skill cap and available Mill capacity both constrain actual workers.' },
      { factor:'Animal power', effect:'2 Cattle or Horses per normal Mill', detail:'Normal Mills require two draft animals to operate.' },
      { factor:'Site limit', effect:'1,000 Mills / 10,000 millers', detail:'Published site maximum for normal Mills.' }
    ],
    researchEffectOverrides:{
      'Windmill':'Each Windmill uses 40 millers to convert 8,000 Grain into 12,000 Flour per month. Windmills plus Oilmills are limited to 100 total per site.',
      'Oilmill':'Requires Windmill research plus Flax research. Each miller converts 10 Cotton/Flax into 1 Oil + 10 Fodder; an Oilmill uses 20 millers, may operate only in the month Flax is harvested, and the Clan is limited to 10 Oilmills.',
      'Sawmill':'Requires Milling 10 and Forestry 4. Up to 100 workers per Sawmill produce ×8 their normal Forestry Log output; Adzes and Saws cannot be combined with this bonus, but Forestry output research can.'
    },
    relatedSkills:['Farming','Forestry','Engineering','Woodwork','Stonework','Metalwork']
  });

  benefit('Mill', { skill:'Milling', value:'10 workers; 80 Grain → 120 Flour each', detail:'A normal Mill supports ten millers and requires two Cattle or Horses.', source:'Mandate', section:'14.11' });
  benefit('Windmill', { skill:'Milling', value:'8,000 Grain → 12,000 Flour', detail:'Uses 40 millers per month under Windmill research.', source:'Research', research:'Milling / Windmill' });
  benefit('Oilmill', { skill:'Milling', value:'10 Flax → 1 Oil + 10 Fodder per miller', detail:'Oilmill research uses 20 millers and is tied to the Flax harvest month.', source:'Research', research:'Milling / Oilmill' });
  benefit('Sawmill', { skill:'Milling', value:'×8 Forestry Log output', detail:'Up to 100 workers per Sawmill; requires Milling 10 and Forestry 4.', source:'Research', research:'Milling / Sawmill' });

  register('MUSIC', {
    name:'Music',
    aliases:['C Mus','Mus'],
    researchAliases:['Music','C Mus','Mus'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Fair cultural-income scaling + instrument craft skill',
    levelDetail:'At Fair, Music generates Silver using Participants × (2 + Music/4 + Economics/4), with a maximum of 500 participants. Musical instruments count as half a participant, with at most one instrument per musician.',
    primarySection:'15.1',
    additionalSections:['13.1.23'],
    workerRule:'Maximum 500 participants in the Music cultural activity at Fair',
    workerDetail:'Music also unlocks instrument recipes at specified Music levels. Instrument construction additionally requires Woodwork and/or Metalwork as listed in the Mandate.',
    summary:'A cultural Fair skill that scales Silver income, allows musical-instrument construction and supports combat/festival research such as Military Band and Music in the Field.',
    levelUses:[
      { level:1, item:'Drum', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional Woodwork/Metalwork requirements in the instrument table.', source:'13.1.23' },
      { level:3, item:'Horn', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional craft requirements in the instrument table.', source:'13.1.23' },
      { level:4, item:'Flute', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional craft requirements in the instrument table.', source:'13.1.23' },
      { level:6, item:'Trumpet', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional craft requirements in the instrument table.', source:'13.1.23' },
      { level:7, item:'Harp', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional craft requirements in the instrument table.', source:'13.1.23' },
      { level:8, item:'Lute', use:'Instrument recipe', kind:'Craft unlock', detail:'Requires the additional craft requirements in the instrument table.', source:'13.1.23' }
    ],
    factors:[
      { factor:'Fair Silver formula', effect:'Participants × (2 + Music/4 + Economics/4)', detail:'Equivalent published form: Participants × (8 + Music + Economics) ÷ 4.' },
      { factor:'Participant cap', effect:'500', detail:'Maximum participants in each cultural activity.' },
      { factor:'Musical instruments', effect:'+0.5 participant each', detail:'At most one instrument may count per musician.' },
      { factor:'Trade limit', effect:'Uses 1 Fair slot', detail:'Selling Music as a cultural activity counts as one slot against the Fair trade limit.' }
    ],
    researchEffectOverrides:{
      'Military Band':'A participating unit from the researching Tribe may use 20–30 Actives equipped with instruments to give all same-Clan units +0.04 Military Morale for that combat. There is currently no extra benefit above 20 band members.',
      'Bagpipes':'When Military Band players are equipped with Bagpipes, the Military Morale bonus rises by an additional +0.02, to +0.06 total.',
      'Music in the Field':'With Military Band and Generalship prerequisites, land combat gains +1 effective Leadership, +2 effective Tactics and a further +0.04 Military Morale; naval combat gains +1 effective Captaincy, +2 effective Tactics and +0.04 Morale. Requires 5 Warriors per 100 participating Warriors, each equipped with a Drum.',
      'Spring Arts Festival Music':'Uses the Spring Arts Festival rules: once per year in Spring, adequate participation grants +0.02 General Morale and 20 Gold or equivalent desired commodity.',
      'Inter Spring Arts Festival Music':'With Administration 10 and an Amphitheatre, allows eligible Tribes from other Clans to participate under the published on-location restrictions.'
    },
    relatedSkills:['Economics','Art','Dance','Woodwork','Metalwork','Leadership','Generalship','Tactics','Captaincy']
  });

  for (const item of ['Drum','Horn','Flute','Trumpet','Harp','Lute']) {
    benefit(item, { skill:'Music', value:'+0.5 Fair participant', detail:'A musical instrument counts as half a participant when selling Music at Fair; maximum one instrument per musician.', source:'Mandate', section:'15.1' });
  }
  benefit('Bagpipes', { skill:'Music', value:'+0.02 additional Military Morale', detail:'With Military Band, Bagpipes raise the band bonus from +0.04 to +0.06.', source:'Research', research:'Music / Bagpipes' });

  register('REFINING', {
    name:'Refining',
    aliases:['Ref'],
    researchAliases:['Refining','Ref'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Worker capacity / ore-to-metal conversion skill',
    levelDetail:'Refining has a 10-workers-per-skill-level cap until level 10, then unlimited. Each assigned worker processes the published ore/metal recipe, subject to Smelter and Refinery capacity.',
    primarySection:'14.12.1',
    additionalSections:['14.12'],
    workerRule:'10 Refining workers per skill level; unlimited at level 10',
    workerDetail:'Each Smelter supports up to 10 refiners; each Refinery holds up to 100 Smelters; a Village may have up to 10 Refineries.',
    summary:'Turns ores and metals into usable metals through Refineries and Smelters. Research adds Coke, Steel and advanced materials while Hammer Mills increase effective worker output.',
    outputs:[
      { item:'Iron', label:'Iron', type:'Refining conversion', detail:'1 worker: 20 Iron Ore + 10 Coal → 15 Iron.', source:'14.12.1' },
      { item:'Copper', label:'Copper', type:'Refining conversion', detail:'1 worker: 20 Copper Ore + 4 Coal → 15 Copper.', source:'14.12.1' },
      { item:'Tin', label:'Tin', type:'Refining conversion', detail:'1 worker: 20 Tin Ore + 6 Coal → 15 Tin.', source:'14.12.1' },
      { item:'Zinc', label:'Zinc', type:'Refining conversion', detail:'1 worker: 20 Zinc Ore + 8 Coal → 15 Zinc.', source:'14.12.1' },
      { item:'Lead', label:'Lead', type:'Refining conversion', detail:'1 worker: 20 Lead Ore + 6 Coal → 15 Lead.', source:'14.12.1' },
      { item:'Bronze', label:'Bronze', type:'Refining conversion', detail:'1 worker: 25 Copper + 5 Tin + 10 Coal → 30 Bronze.', source:'14.12.1' },
      { item:'Brass', label:'Brass', type:'Refining conversion', detail:'1 worker: 16 Copper + 4 Zinc + 10 Coal → 20 Brass.', source:'14.12.1' },
      { item:'Nickel', label:'Nickel', type:'Refining conversion', detail:'1 worker: 20 Nickel Ore + 6 Coal → 15 Nickel.', source:'14.12.1' },
      { item:'Pewter', label:'Pewter', type:'Refining conversion', detail:'1 worker: 8 Lead + 32 Tin + 10 Coal → 40 Pewter.', source:'14.12.1' }
    ],
    factors:[
      { factor:'Smelter capacity', effect:'10 workers per Smelter', detail:'Effective Refining workers must be covered by available Smelter capacity.' },
      { factor:'Refinery capacity', effect:'100 Smelters per Refinery', detail:'A Village may have a maximum of 10 Refineries.' },
      { factor:'Transformation restriction', effect:'1 transformation type per Refinery per turn', detail:'Refining different metals in the same turn requires separate Refineries.' },
      { factor:'Location', effect:'Village + Refinery required', detail:'Normal Refining must be performed in a Village inside a Refinery.' }
    ],
    researchEffectOverrides:{
      'Coke':'1 worker converts 20 Coal into 15 Coke in a Refinery/Smelter. For supported uses, 1 Coke is equivalent to 2 Coal. Coke is required for Steel production.',
      'Hammer Mill':'Each Hammer Mill services 20 Mining or Refining workers and makes 2 workers count as 3. The extra effective refiners require matching Smelter capacity; off-river use requires 2 Horses or Cattle.',
      'Portland Cement':'Unlocks Refining production of 5 Portland Cement from 10 Limestone, 5 Clay and 10 Coal using 1 worker.',
      'Refined Sand':'Unlocks 15 Refined Sand from 20 Sand + 5 Coal using 1 worker in a Refinery/Smelter.',
      'Steel':'Requires Coke research in the same Tribe. 1 worker converts 20 Iron + 15 Silver + 10 Coke into 15 Steel.'
    },
    relatedSkills:['Mining','Engineering','Stonework','Metalwork','Alchemy']
  });

  benefit('Smelter', { skill:'Refining', value:'10 refiners per Smelter', detail:'Refining workforce is constrained by installed Smelter capacity.', source:'Mandate', section:'14.12' });
  benefit('Hammer Mill', { skill:'Refining', value:'2 workers count as 3 for up to 20 workers', detail:'Research productivity item for Refining; extra effective workers still need Smelter capacity.', source:'Research', research:'Refining / Hammer Mill' });
  benefit('Coke', { skill:'Refining', value:'1 Coke = 2 Coal for supported uses', detail:'Coke research also enables Steel research.', source:'Research', research:'Refining / Coke' });
  benefit('Steel', { skill:'Refining', value:'Research conversion', detail:'Steel research converts Iron, Silver and Coke into Steel.', source:'Research', research:'Refining / Steel' });

  register('RESEARCH', {
    name:'Research',
    aliases:['Res'],
    researchAliases:['Research','Res'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'University / advanced-research infrastructure unlock skill',
    levelDetail:'Research skill level 10 enables the fit-out/building of a University. Generic research in another skill is unlocked by that other skill reaching level 10; it does not require Research 10.',
    primarySection:'29.31',
    additionalSections:['23','23.4','23.4.1'],
    workerRule:'Not a worker-assignment skill',
    workerDetail:'Research topics are attempted by Tribes, not Elements. Normally each Tribe may research one topic per turn; Universities can expand the number of simultaneous attempts.',
    summary:'The Research skill is primarily an infrastructure unlock: Research 10 enables Universities. The broader research system is driven by level-10 skills, Development Levels and Tribe research attempts.',
    levelUses:[
      { level:10, item:'University', use:'Enables University fit-out/building', kind:'Infrastructure unlock', detail:'A Clan unit from a Tribe with Research 10 must be present when the University is built.', source:'23.4 / 29.31' }
    ],
    factors:[
      { factor:'Normal research eligibility', effect:'Relevant skill level 10', detail:'A Tribe may research applications of a skill once that particular skill reaches level 10.' },
      { factor:'Normal capacity', effect:'1 topic per Tribe per turn', detail:'This is in addition to skill attempts; Universities can raise the research capacity.' },
      { factor:'DL0', effect:'About 5% per turn; automatic after 12 consecutive failed turns', detail:'After DL0, topics progress through their published Development Levels.' },
      { factor:'Maintain skill 10', effect:'Required to retain topic and benefits', detail:'If the appropriate skill falls below 10, current topics and benefits are lost.' },
      { factor:'University build', effect:'Research 10 + Engineering 8 + Stonework 4', detail:'Also requires 10,000 Stones, 100 Parchment and 100 Candles; Research 10 must be represented by a present Clan unit but is not a builder skill.' },
      { factor:'University capacity', effect:'Population + distinct level-10 skills', detail:'Published examples give a 600-person Tribe up to 2 topics and a 1,340-person Tribe up to 3; each topic must relate to a different level-10 skill.' }
    ],
    researchEffectOverrides:{
      'Silver Age':'Requires a Library or University at the Tribe location. Costs 300 Silver per turn before DL0 and 900 Silver per turn after DL0. On completion, increase one Category A, one Category B and one Category C skill by +1, each capped at level 8. Only one Tribe per Clan may research it at a time; it is repeatable and cannot be written as a Book.'
    },
    relatedSkills:['Literacy','Engineering','Stonework']
  });

  benefit('University', { skill:'Research', value:'Research 10 infrastructure unlock', detail:'Research 10 enables the University fit-out; Engineering 8 and Stonework 4 cover construction.', source:'Mandate', section:'23.4' });

  register('SANITATION', {
    name:'Sanitation',
    aliases:['San'],
    researchAliases:['Sanitation','San'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Siege resilience / Well-capacity scaling skill',
    levelDetail:'Each Well supplies 50 Barrels of water per month plus 10 additional Barrels per Sanitation level. Sanitation also moderates siege sanitation losses, but N02.2 does not publish a numeric casualty formula.',
    primarySection:'29.35',
    additionalSections:['18.2','18.5.8'],
    workerRule:'No base Sanitation worker assignment is published',
    workerDetail:'The base skill acts through siege resilience and Well output. Camp Sanitation research introduces a separate sanitation-worker assignment for sharing skill across same-hex Clan units.',
    summary:'Improves a Village’s ability to endure siege and increases Well water output. Research can share Sanitation across stationary same-hex Clan units and unlock Sewers.',
    factors:[
      { factor:'Well output', effect:'50 + 10×Sanitation Barrels per month', detail:'The Sanitation level used is that of the Tribe owning the Village.' },
      { factor:'Siege losses', effect:'Moderated by Sanitation', detail:'The Mandate states the effect but does not provide a numeric loss-reduction formula.' },
      { factor:'Base workforce', effect:'None published', detail:'Sanitation is not listed with the 10-workers-per-level # rule.' }
    ],
    researchEffectOverrides:{
      'Camp Sanitation':'Allows Actives, Warriors or Slaves from the researching Tribe/Elements to provide Sanitation to same-hex same-Clan units. Sanitation workers must equal 0.5% of the supported population; supporting and supported units may not move. Supported units use the provider’s Sanitation skill/research for relevant purposes, but this does not affect population growth.',
      'Sewers':'Requires Sanitation 6, Engineering 10, an established Home City and a University to research. The structure uses 1,250 people, Engineering 9, Sanitation 6, Stonework 8, 5,000 Stones and 500 Logs; it gives +4 Sanitation during Sieges and +0.4% population growth to eligible long-term resident Clan units in the site.'
    },
    relatedSkills:['Engineering','Stonework','Politics']
  });

  benefit('Well', { skill:'Sanitation', value:'+10 Barrels per Sanitation level', detail:'A Well supplies a base 50 Barrels per month plus 10 per Sanitation level.', source:'Mandate', section:'18.5.8' });
  benefit('Sewers', { skill:'Sanitation', value:'+4 Sanitation during Siege; +0.4% population growth', detail:'Sewers research provides siege and long-term resident population benefits under its site rules.', source:'Research', research:'Sanitation / Sewers' });
})();

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

  register('BRICK MAKING', {
    name:'Brick Making',
    aliases:['Brickmaking','Brk'],
    researchAliases:['Brick Making','Brickmaking','Brk'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Worker-cap / production-output skill',
    levelDetail:'Brick Making uses the standard 10 actual workers per skill level until level 10, then unlimited. Base production in a Brickworks is 120 Bricks (=30 Stone) per worker, or 160 House Bricks per worker.',
    primarySection:'14.5.1',
    additionalSections:['14.5.2'],
    workerRule:'10 Brick Making workers per skill level; unlimited at level 10',
    workerDetail:'Facility capacity also applies: each Kiln supports up to 10 workers, each Brickworks holds up to 100 Kilns, and a hex may contain up to 10 Brickworks.',
    summary:'Turns Clay, Fodder and Coal into construction material inside a Brickworks. Skill level controls the normal workforce cap, while research can substantially increase Brick output per worker.',
    outputs:[
      { item:'Stone', label:'Standard Bricks', type:'Construction material', detail:'Each worker produces 120 Bricks, recorded as 30 Stone, using 20 Clay, 10 Fodder and 4 Coal.', source:'14.5.1' },
      { item:'House Bricks', label:'House Bricks', type:'Special construction material', detail:'Each worker produces 160 House Bricks using 20 Clay, 20 Fodder and 6 Coal. They are restricted to Dwellings; the Mandate notes Lodging/Dwelling rules may be developed further.', source:'14.5.1' }
    ],
    factors:[
      { factor:'Brickworks', effect:'Required facility', detail:'Standard Brick Making is performed within a Brickworks.' },
      { factor:'Kiln capacity', effect:'10 workers per Kiln', detail:'A Brickworks can contain up to 100 Kilns.' },
      { factor:'Site capacity', effect:'10 Brickworks per hex', detail:'This gives a maximum of 1,000 Kilns in one site under the published base rules.' },
      { factor:'Clay availability', effect:'Must be in inventory', detail:'Being next to a River or Lake does not replace the requirement to hold Clay in the unit inventory.' },
      { factor:'Brickworks construction', effect:'Engineering 5', detail:'The base building uses 80 Logs; each Kiln uses 150 Coal plus 40 Iron, Bronze or Brass, with Stonework alternatives for Kilns.' }
    ],
    researchEffectOverrides:{
      'Improved Brickmaking':'Raises standard Brick output by 50% to 180 Bricks (=45 Stone) per assigned worker.',
      'Advanced Brickmaking':'Raises standard Brick output by 100% to 240 Bricks (=60 Stone) per assigned worker; the published topic also adds Silver to the advanced process.',
      'Greater Brickmaking':'Raises standard Brick output by 150% to 300 Bricks (=75 Stone) per assigned worker; the published topic also adds Silver to the greater process.'
    },
    relatedSkills:['Engineering','Stonework','Gathering']
  });

  benefit('Brickworks', { skill:'Brick Making', value:'Required production facility', detail:'Brick Making is performed within a Brickworks; each Kiln supports up to 10 workers.', source:'Mandate', section:'14.5' });
  benefit('Kiln', { skill:'Brick Making', value:'10 workers per Kiln', detail:'Each installed Kiln supports up to ten Brick Making workers.', source:'Mandate', section:'14.5.2' });

  register('COOKING', {
    name:'Cooking',
    aliases:['Cook','C Cook'],
    researchAliases:['Cooking','Cook','C Cook'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity-scaling',
    mechanicLabel:'Worker-cap / food-output / Fair cultural skill',
    levelDetail:'Cooking has a 10-workers-per-level cap until level 10, then unlimited. It produces Provisions from raw foods and may also be sold as a cultural activity at Fair using Participants × (2 + Cooking/4 + Economics/4).',
    primarySection:'13.1.4',
    additionalSections:['15.1'],
    workerRule:'10 Cooking workers per skill level; unlimited at level 10',
    workerDetail:'The production worker cap applies to normal Cooking. Fair cultural participation has a separate maximum of 500 participants.',
    summary:'A mixed food-production and cultural skill. Cooking converts Grain, Grapes, Honey or Gut into Provisions, can be performed at sea, and can also generate Silver as a cultural activity at Fair.',
    outputs:[
      { item:'Provs', label:'Gruel / Provisions', type:'Food', detail:'One cook makes 4 Gruel, or 6 when using Grain. Each Gruel becomes 1 Prov and uses one of: 30 Grain, 15 Grapes, 5 Honey or 10 Gut. Gruel itself is not stored as an item.', source:'13.1.4' }
    ],
    factors:[
      { factor:'At sea', effect:'Allowed', detail:'Cooking can be performed at sea.' },
      { factor:'Fair Silver formula', effect:'Participants × (2 + Cooking/4 + Economics/4)', detail:'Cooking is one of the cultural activities that may be sold at Fair.' },
      { factor:'Fair participant cap', effect:'500', detail:'No more than 500 people may participate in a single cultural activity.' },
      { factor:'Fair trade limit', effect:'Uses 1 Fair slot', detail:'Selling Cooking as a cultural discipline counts as one item/transaction slot.' }
    ],
    researchEffectOverrides:{
      'Stew':'As a Cooking activity, 1 person converts 5 Goats into 40 Stew/Provisions.',
      'Banquet':'Once per year, consumes 20 Cattle and 20 Barrels of Grog per 1,000 participants to give the participating Tribe +0.02 General Morale; one guest Tribe may also be invited under the topic rules.'
    },
    relatedSkills:['Economics','Hunting','Baking','Herding','Distilling']
  });

  benefit('Stew', { skill:'Cooking', value:'40 Provisions per worker', detail:'Stew research lets one Cooking worker convert five Goats into forty Provisions.', source:'Research', research:'Cooking / Stew' });

  register('DANCE', {
    name:'Dance',
    aliases:['Dan','C Dan'],
    researchAliases:['Dance','Dan','C Dan'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Fair cultural-income scaling skill',
    levelDetail:'At Fair, Dance generates Silver using Participants × (2 + Dance/4 + Economics/4), with a maximum of 500 participants.',
    primarySection:'15.1',
    additionalSections:['29.14'],
    workerRule:'Maximum 500 participants in the Dance cultural activity at Fair',
    workerDetail:'Dance is a cultural Fair activity rather than a normal production workforce. Participation consumes one of the Fair trade slots.',
    summary:'A Group C cultural Fair skill. Dance level increases Silver generated from cultural participation and supports the Spring Arts Festival Dance research line.',
    factors:[
      { factor:'Fair Silver formula', effect:'Participants × (2 + Dance/4 + Economics/4)', detail:'Equivalent published form: Participants × (8 + Dance + Economics) ÷ 4.' },
      { factor:'Participant cap', effect:'500', detail:'No more than 500 people may participate in each cultural activity.' },
      { factor:'Trade limit', effect:'Uses 1 Fair slot', detail:'Dance participation counts as one slot against the Fair trade limit.' },
      { factor:'Goods Tribe relationship', effect:'Distributed participation permitted', detail:'Tribes with cultural skills in a Goods Tribe relationship with the trading Tribe may perform their cultural skill at Fair.' },
      { factor:'Player calculation', effect:'Manual responsibility', detail:'Players are responsible for calculating cultural Silver; where the Fair spreadsheet differs from the text rules, the spreadsheet prevails.' }
    ],
    researchEffectOverrides:{
      'Spring Arts Festival Dance':'Once per year in Spring, at least 500 Warriors/Actives may spend the month participating and doing no other work to gain +0.02 General Morale plus 20 Gold or an equivalent desired commodity. The topic leads into the Inter Spring Arts Festival chain.'
    },
    relatedSkills:['Economics','Art','Music','Engineering']
  });

  register('DISTILLING', {
    name:'Distilling',
    aliases:['Dis'],
    researchAliases:['Distilling','Dis'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock-capacity',
    mechanicLabel:'Recipe-unlock / facility-capacity skill',
    levelDetail:'Distilling levels unlock beverage recipes, while actual workforce is limited by installed Stills: 10 workers per Still. Every 5 workers make 100 lb of beverage per month.',
    primarySection:'14.7.1',
    additionalSections:['14.7.2'],
    workerRule:'10 Distilling workers per installed Still; 5 workers produce 100 lb of beverage',
    workerDetail:'A Distillery is required. A Distillery may contain up to 100 Stills and a hex may contain up to 10 Distilleries.',
    summary:'Produces alcoholic beverages in a Village. Skill level unlocks the base drink recipes; installed Stills determine worker capacity and research adds additional drinks, brands and alcohol-trading buildings.',
    levelUses:[
      { level:2, item:'Ale', use:'Ale from Grain', kind:'Recipe unlock', detail:'100 Grain makes one 100-lb barrel of Ale using 5 workers.', source:'14.7.1' },
      { level:4, item:'Mead', use:'Mead', kind:'Recipe unlock', detail:'20 Honey makes one barrel of Mead.', source:'14.7.1' },
      { level:5, item:'Ale', use:'Ale from Bark + Sugar', kind:'Recipe unlock', detail:'50 Bark + 50 Sugar makes one barrel of Ale.', source:'14.7.1' },
      { level:6, item:'Wine', use:'Wine', kind:'Recipe unlock', detail:'100 Grapes makes one barrel of Wine.', source:'14.7.1' },
      { level:8, item:'Rum', use:'Rum', kind:'Recipe unlock', detail:'100 Sugar makes one barrel of Rum.', source:'14.7.1' },
      { level:9, item:'Brandy', use:'Brandy', kind:'Recipe unlock', detail:'50 Grapes + 50 Sugar makes one barrel of Brandy.', source:'14.7.1' }
    ],
    factors:[
      { factor:'Distillery', effect:'Required', detail:'Base Distilling must be performed in a Distillery.' },
      { factor:'Still capacity', effect:'10 workers per Still', detail:'At full utilisation one Still produces 200 lb of beverage per month.' },
      { factor:'Barrels', effect:'1 empty Barrel per 100 lb', detail:'If an empty Barrel is not available the beverage is not made.' },
      { factor:'Arid / desert water', effect:'100 lb Water per 100 lb beverage', detail:'Applies to all base drinks except Wine.' },
      { factor:'Per-Distillery variety', effect:'1 beverage type per turn', detail:'Only one type of grog may be produced by a Distillery in a turn.' }
    ],
    researchEffectOverrides:{
      'Absinthe':'Adds Absinthe: 5 workers use 100 Grain, 10 Herbs and 5 Silver to make one barrel; it may be sold at Fair.',
      'Branded Alcohol (Ale, Wine etc)':'Allows a researched brand of a normal alcohol to be distilled normally in multiples of 5 workers and sold at Fair for 1.5× normal price.',
      'Gin':'Adds Gin: 5 workers use 50 Juniper, 25 Grain and 1 Herb per barrel. Completing the topic places a Juniper special-hex source within roughly one or two mapsheets for Intelligence searching.',
      'Port Wine':'Adds fortified Port Wine: 5 workers, Distilling 7, 100 Grapes and 10 Brandy per barrel.',
      'Tavern':'Unlocks a Tavern (Engineering 4, 500 Logs). It allows 2× normal Fair alcohol limits without requiring a Trading Post, subject to the overall Fair multiplier cap.',
      'Road House':'After Tavern, unlocks Roadhouses that buy up to 2 Barrels of each accepted alcohol per turn at standard Fair prices, subject to the research rules.'
    },
    relatedSkills:['Engineering','Economics','Farming','Apiarism']
  });

  for (const item of ['Ale','Mead','Wine','Rum','Brandy','Absinthe','Gin','Port Wine']) {
    benefit(item, { skill:'Distilling', value:'Distilling product', detail:'Produced through the Distilling rules or an associated Distilling research recipe.', source:'Mandate / Research', section:'14.7.1' });
  }
  benefit('Distillery', { skill:'Distilling', value:'Required facility', detail:'A Distillery is required for base Distilling and may contain up to 100 Stills.', source:'Mandate', section:'14.7.2' });
  benefit('Still', { skill:'Distilling', value:'10 workers per Still', detail:'Each Still supports up to ten Distilling workers.', source:'Mandate', section:'14.7.1' });

  register('ENGINEERING', {
    name:'Engineering',
    aliases:['Eng'],
    researchAliases:['Engineering','Eng'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Construction level-unlock / prerequisite skill',
    levelDetail:'Engineering has no general worker cap. Skill levels unlock structures and act as prerequisites; each project then uses its own materials, installation rates and facility rules.',
    primarySection:'14.8',
    additionalSections:['14.8.1','14.15'],
    workerRule:'No general Engineering worker limit',
    workerDetail:'Engineering labour is determined by the specific structure and its material installation rates. Container buildings and their installations normally require separate activity orders.',
    summary:'The principal construction skill for Village infrastructure, processing facilities, wells and fortifications. Higher levels unlock more structures and a large Engineering research tree extends defensive and civic construction.',
    levelUses:[
      { level:2, item:'Meeting House', use:'Meeting House', kind:'Construction unlock', detail:'100 Logs; required before a Tribe can become a Village.', source:'14.8' },
      { level:2, item:'Refinery', use:'Refinery', kind:'Construction unlock', detail:'100 Logs for the container building; Smelters are installed separately.', source:'14.8' },
      { level:2, item:'Trading Post', use:'Trading Post', kind:'Construction unlock', detail:'100 Logs; supports Fair trading under the Trading Post rules.', source:'14.8' },
      { level:3, item:'Bakery', use:'Bakery', kind:'Construction unlock', detail:'40 Logs for the building; Ovens are installed separately.', source:'14.8' },
      { level:3, item:'Moat', use:'Moat', kind:'Fortification unlock', detail:'Base fortification structure.', source:'14.8' },
      { level:4, item:'Distillery', use:'Distillery', kind:'Construction unlock', detail:'80 Logs for the building; Stills are installed separately.', source:'14.8' },
      { level:4, item:'Jetty', use:'Jetty', kind:'Construction unlock', detail:'100 Logs.', source:'14.8' },
      { level:4, item:'Palisade', use:'Palisade', kind:'Fortification unlock', detail:'Uses 3 Logs per yard under the base Engineering table.', source:'14.8' },
      { level:5, item:'Bank', use:'Bank', kind:'Construction unlock', detail:'Requires Economics 10 in the Clan to operate.', source:'14.8' },
      { level:5, item:'Brickworks', use:'Brickworks', kind:'Construction unlock', detail:'80 Logs for the building; Kilns are installed separately.', source:'14.8' },
      { level:5, item:'Charhouse', use:'Charhouse', kind:'Construction unlock', detail:'100 Logs for the building; Burners are installed separately.', source:'14.8' },
      { level:5, item:'Mill', use:'Mill', kind:'Construction unlock', detail:'Also requires Metalwork 3, 1 Rope and 1 Millstone.', source:'14.8' },
      { level:5, item:'Well', use:'Flat-terrain Well', kind:'Construction unlock', detail:'210 Logs and 1 Rope; flat terrain only.', source:'14.8' },
      { level:6, item:'Apiary', use:'Apiary', kind:'Construction unlock', detail:'Standard method also requires Metalwork 3; alternate method uses Woodwork 4.', source:'14.8' },
      { level:6, item:'Shipyard', use:'Shipyard', kind:'Construction unlock', detail:'50 Logs plus metal/Coal under the base table.', source:'14.8' },
      { level:6, item:'Well', use:'Hill-terrain Well', kind:'Construction unlock', detail:'300 Logs and 1 Rope; hill terrain only.', source:'14.8' },
      { level:7, item:'Well', use:'Low-mountain Well', kind:'Construction unlock', detail:'480 Logs and 2 Rope.', source:'14.8' },
      { level:'7–9', item:'Stone Wall', use:'Stone Walls', kind:'Fortification unlock', detail:'Stone requirement depends on wall height and fortification extent.', source:'14.8' },
      { level:8, item:'Stone Tower', use:'Stone Tower', kind:'Fortification unlock', detail:'3,000 Stone.', source:'14.8' },
      { level:8, item:'Well', use:'High-mountain Well', kind:'Construction unlock', detail:'600 Logs and 2 Rope.', source:'14.8' }
    ],
    factors:[
      { factor:'Container buildings', effect:'Two activity orders', detail:'Refinery, Bakery, Charhouse, Distillery and Brickworks are container buildings; the building and its Smelter/Oven/Burner/Still/Kiln installation are separate Engineering orders.' },
      { factor:'Materials during work', effect:'Must be available as work is done', detail:'Automated processing requires the unit to possess the resources that determine the workers assigned; a project cannot simply wait for materials to arrive later.' },
      { factor:'Multi-turn projects', effect:'Automation warning', detail:'The Mandate warns that Engineering/Shipbuilding projects spread across multiple turns can fail in automated processing and recommends GM Actions for those cases.' }
    ],
    researchEffectOverrides:{
      'Barbican':'Engineering 10 defensive structure. Adds +4 effective Archery for defenders and incorporates the Drawbridge bonus.',
      'Crenellations':'+5% to Fortification value under the published Engineering research topic.',
      'Drawbridge':'Engineering 10 structure that adds +2 effective Archery for defenders.',
      'Dungeon':'Engineering 7 structure. One Dungeon can hold 200 Slaves using only 1 Overseer with a Whip and is a prerequisite for some Torture/other research.',
      'Gate House':'Defensive structure that adds +2 effective Archery for defenders and leads into Barbican.',
      'Mining Ladder':'Item usable for Engineering/Mining/Woodwork contexts; each ladder provides a +100% effective-worker bonus to up to 10 Miners or Diggers, additive with other implements.',
      'Sappers I, Sappers II':'Reduce enemy fortification effectiveness by 5%, or 10% with Sappers II, using the published Sapper manpower and Log requirements.',
      'Sewers':'High-order civic work requiring Engineering 10, Sanitation 6, a Home City and University to research. Provides siege Sanitation and population-growth benefits under its rules.',
      'Stone Wall 25’':'Unlocks the 25-foot Stone Wall upgrade and leads to 30-foot Walls / Castle research.',
      'Stone Wall 30’':'Unlocks the 30-foot Stone Wall upgrade after the 25-foot Wall topic.',
      'Watchtower':'Village structure; each tower adds 2% to Security/Suppression detection, maximum 6 Watchtowers, with 2 observers per tower.'
    },
    relatedSkills:['Stonework','Woodwork','Metalwork','Architecture','Shipbuilding','Sanitation','Economics']
  });

  for (const item of ['Meeting House','Trading Post','Bakery','Distillery','Brickworks','Charhouse','Mill','Apiary','Shipyard','Bank']) {
    benefit(item, { skill:'Engineering', value:'Construction prerequisite', detail:'Engineering level is required to construct this base structure under the Mandate.', source:'Mandate', section:'14.8' });
  }
  benefit('Watchtower', { skill:'Engineering', value:'Research structure', detail:'Watchtower is built through Engineering research and improves detection.', source:'Research', research:'Engineering / Watchtower' });
  benefit('Mining Ladder', { skill:'Engineering', value:'Research item', detail:'Mining Ladder is listed under Engineering as well as Mining/Metalwork/Woodwork research contexts.', source:'Research', research:'Engineering / Mining Ladder' });

  register('FARMING', {
    name:'Farming',
    aliases:['Farm'],
    researchAliases:['Farming','Farm'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Seasonal crop / terrain / tool output skill',
    levelDetail:'Farming is a Village activity built around plowing, planting and harvesting. N02.2 gives per-person acre rates, crop/terrain/weather rules and research skill increases, but does not publish a simple universal yield-per-Farming-level formula.',
    primarySection:'14.9',
    additionalSections:['14.9.1','14.9.2','14.9.3','14.9.4'],
    workerRule:'No published 10×Farming-level worker cap; labour is determined by acres plowed, planted and harvested per person',
    workerDetail:'The Mandate’s Group C table does not mark Farming with the # worker-cap rule. Individual crop operations instead specify per-person acre rates and tool effects.',
    summary:'A seasonal Village activity covering plowing, planting and harvesting. Returns depend on crop, terrain, climate/weather and tools; research can raise Farming skill and unlock additional crops such as Flax.',
    factors:[
      { factor:'Crop cycle', effect:'Plant +3 turns → Harvest', detail:'Plowing and planting occur in the same turn. Crops are ready on the third turn after planting; e.g. plant 03, harvest 06.' },
      { factor:'Planting window', effect:'Months 01–06', detail:'Standard seasonal crops are harvested in months 04–09.' },
      { factor:'Plowing tools', effect:'Rake 1 · Hoe 2 · Plow 8 acres/person', detail:'A Rake is the minimum tool. A Plow must be pulled by one Horse or Cattle.' },
      { factor:'Weather restrictions', effect:'Can block work / destroy crops', detail:'Plowing cannot be done in Winter or heavy rain/snow; planting cannot be done in heavy rain/snow; harvesting cannot be done in rain, snow or Winter. Snow may kill growing crops.' },
      { factor:'Ownership continuity', effect:'Same unit must harvest', detail:'Crops and plowed land cannot be transferred; the unit that plows/plants must also harvest.' },
      { factor:'Skill-output formula', effect:'Not published as one universal multiplier', detail:'The Mandate specifies crop/acre mechanics but no single numeric return-per-Farming-level formula, so none is inferred.' }
    ],
    factTables:[{
      kicker:'Labour rates',
      title:'Published planting and harvesting acres per person',
      source:'14.9.3',
      columns:[{key:'crop',label:'Crop'},{key:'plant',label:'Plant acres/person'},{key:'harvest',label:'Harvest acres/person'},{key:'tool',label:'Tool improvement'}],
      rows:[
        {crop:'Cotton',plant:'3',harvest:'2',tool:'—'},
        {crop:'Grain',plant:'5',harvest:'3',tool:'6 with Scythe'},
        {crop:'Grape',plant:'2',harvest:'1',tool:'—'},
        {crop:'Rice',plant:'2',harvest:'1',tool:'—'},
        {crop:'Sugar',plant:'3',harvest:'2',tool:'4 with Scythe'},
        {crop:'Tobacco',plant:'2',harvest:'1',tool:'—'}
      ]
    }],
    researchEffectOverrides:{
      'Farming 11':'+1 Farming level, taking Farming 10 to 11 and leading into the Agriculture research chain.',
      'Agriculture I, Agriculture II, Agriculture III':'Each topic adds +2 Farming. Completing Agriculture I also unlocks the new Group C Agriculture skill used to access Agriculture IV and beyond.',
      'Flax':'Adds Flax as a crop. Best in flat/temperate terrain; each worker plants 3 acres and harvests 2, with Scythes doubling Flax harvesting acres. Harvest converts Flax to Cotton.'
    },
    relatedSkills:['Agriculture','Milling','Woodwork','Metalwork']
  });

  benefit('Rake', { skill:'Farming', value:'1 acre plowed per worker', detail:'A Rake is the minimum plowing tool.', source:'Mandate', section:'14.9.2' });
  benefit('Hoe', { skill:'Farming', value:'2 acres plowed per worker', detail:'A Hoe doubles the Rake plowing rate.', source:'Mandate', section:'14.9.2' });
  benefit('Plow', { skill:'Farming', value:'8 acres plowed per worker', detail:'Requires one Horse or Cattle to pull the Plow.', source:'Mandate', section:'14.9.2' });
  benefit('Scythe', { skill:'Farming', value:'Improves selected harvest rates', detail:'Doubles the listed Grain harvest rate from 3 to 6 acres/person and Sugar from 2 to 4; Flax research also uses Scythes.', source:'Mandate', section:'14.9.3' });

  register('GLASSWORK', {
    name:'Glasswork',
    aliases:['Glass','Gls'],
    researchAliases:['Glasswork','Glass','Gls'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Level-unlock / direct-crafting skill',
    levelDetail:'Glasswork has no worker limit. Skill levels unlock glass recipes from Beads at level 1 through Lenses at level 8; most recipes also require one Glasspipe per 10 users.',
    primarySection:'13.1.11',
    additionalSections:['13.1.8'],
    workerRule:'No Glasswork worker limit',
    workerDetail:'Recipes specify their own people and materials. A Glasspipe is required for most glassworking recipes at a ratio of one Glasspipe per 10 users.',
    summary:'Crafts glass goods from gathered Sand plus Lead, Coal and sometimes Clay. Higher levels unlock Beakers, Panes, Bottles and Lenses; research turns Lenses into military optical equipment.',
    levelUses:[
      { level:1, item:'Beads', use:'10 Beads', kind:'Craft', detail:'1 person uses 9 Sand, 1 Lead and 5 Coal. Requires one Glasspipe per 10 users.', source:'13.1.11' },
      { level:4, item:'Beaker', use:'Beaker', kind:'Craft', detail:'1 person uses 9 Sand, 1 Lead and 10 Coal. Requires one Glasspipe per 10 users.', source:'13.1.11' },
      { level:4, item:'Glass Pane', use:'Glass Pane', kind:'Craft', detail:'1 person uses 20 Sand, 4 Lead and 20 Coal. Used in some higher-end buildings; weighs 10 lb.', source:'13.1.11' },
      { level:6, item:'Bottle', use:'Bottle', kind:'Craft', detail:'1 person uses 12 Sand, 2 Lead, 12 Coal and 25 Clay. Requires one Glasspipe per 10 users; 50 Bottles equal one Barrel volume.', source:'13.1.11' },
      { level:7, item:'Bottle Perfume', use:'Perfume Bottle', kind:'Craft', detail:'1 person uses 2 Sand, 1 Lead and 2 Coal. Requires one Glasspipe per 10 users; use is noted as under development.', source:'13.1.11' },
      { level:8, item:'Lens', use:'Lens', kind:'Craft', detail:'5 people use 45 Sand, 5 Lead and 50 Coal. Requires one Glasspipe per 10 users.', source:'13.1.11' }
    ],
    factors:[
      { factor:'Sand source', effect:'20 Sand per gatherer', detail:'Sand can be gathered from a hex with a River hexside or adjacent to Ocean/Lake; Gathering itself requires no skill.' },
      { factor:'Shovel', effect:'×2 Sand gathering', detail:'A Shovel doubles Sand gathering to 40 per person.' },
      { factor:'Glasspipe', effect:'1 per 10 users for most recipes', detail:'Glasspipes are reusable working implements rather than consumed ingredients.' }
    ],
    researchEffectOverrides:{
      'Field Glasses':'Glasswork 10 + Metalwork 3 recipe using 2 Lenses. One pair present in any participating field-combat unit gives +2 Leadership to all participating units; not Siege/Assault. Research knowledge is not required to use the item.',
      'Spy Glass':'Glasswork 10 + Metalwork 3 recipe using 2 Lenses. One Spy Glass available in a Fleet gives +2 Captaincy in naval combat; research knowledge is not required to use the item.'
    },
    relatedSkills:['Metalwork','Leadership','Captaincy','Gathering']
  });

  benefit('Glasspipe', { skill:'Glasswork', value:'1 per 10 users', detail:'Required as a reusable implement for most Glasswork recipes.', source:'Mandate', section:'13.1.11' });
  benefit('Field Glasses', { skill:'Leadership', value:'+2 Leadership in Field combat', detail:'One pair in a participating combat unit applies the bonus to all participating units; not Siege/Assault.', source:'Research', research:'Glasswork / Field Glasses' });
  benefit('Spy Glass', { skill:'Captaincy', value:'+2 Captaincy in naval combat', detail:'One Spy Glass must be available in each Fleet receiving the benefit.', source:'Research', research:'Glasswork / Spy Glass' });
})();

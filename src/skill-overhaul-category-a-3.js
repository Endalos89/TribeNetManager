(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'A',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  const metalCraft = (level, entity, label, people, inputs, detail = '') => ({
    level, entity, label, people, inputs, detail, source:'13.1.21'
  });

  register('METALWORK', {
    name:'Metalwork',
    aliases:['Metalworking'],
    researchAliases:['Metalwork','Metalworking','Mtl'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / production skill',
    levelDetail:'Higher Metalwork unlocks progressively more metal tools and components; many other skills also require Metalwork as a prerequisite.',
    primarySection:'13.1.21',
    additionalSections:['13.1.23','20.4','21.6','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Metalwork itself has no 10×skill worker cap; each recipe states its own people requirement.',
    summary:'Produces tools, containers and fittings used across mining, forestry, farming, glasswork, combat and shipbuilding.',
    directCrafts:[
      metalCraft(1,'Pellets','Pellets ×20',1,[{entity:'Coal',quantity:1},{entity:'Lead',quantity:10}],'Ten Pellets are used per slinger in the missile phase; Pellets improve Sling effectiveness in battle.'),
      metalCraft(2,'Quarrels','Quarrels ×10',1,[{entity:'Iron',quantity:1},{entity:'Coal',quantity:10}],'IRON ONLY. Used with Arbalests and described as giving improvements similar to arrows.'),
      metalCraft(2,'Shovel','Shovel',2,[{entity:'Iron',quantity:2},{entity:'Coal',quantity:10}],'Doubles Ditch/Moat/Sand/Clay digging and adds 50% to Mining output.'),
      metalCraft(2,'Trap','Trap',1,[{entity:'Iron',quantity:1},{entity:'Coal',quantity:4}],'Hunting/Furrier implement; each hunter may use up to five standard Traps.'),
      metalCraft(3,'Barrel','Barrel',2,[{entity:'Iron',quantity:2},{entity:'Coal',quantity:4},{entity:'Log',quantity:1}],'Used for water at sea, alcohol and other liquids.'),
      metalCraft(3,'Mattock','Mattock',2,[{entity:'Iron',quantity:8},{entity:'Coal',quantity:25}],'Doubles normal Quarrying output and adds 50% to Mining output.'),
      metalCraft(3,'Pick','Pick',2,[{entity:'Iron',quantity:3},{entity:'Coal',quantity:15}],'Doubles Mining output and adds 50% to Ditch/Moat digging.'),
      metalCraft(4,'Adze','Adze',2,[{entity:'Iron',quantity:4},{entity:'Coal',quantity:20}],'A Forester with an Adze fells 8 Logs.'),
      metalCraft(4,'Hoe','Hoe',2,[{entity:'Iron',quantity:3},{entity:'Coal',quantity:10}],'A person with a Hoe can plow 2 acres.'),
      metalCraft(4,'Shackle','Shackle',1,[{entity:'Iron',quantity:2},{entity:'Coal',quantity:15}],'Shackled slaves count as half toward limits of slaves held by a unit.'),
      metalCraft(5,'Lamp','Lamp',1,[{entity:'Brass',quantity:1},{entity:'Silver',quantity:50},{entity:'Cotton',quantity:20},{entity:'Oil',quantity:20}],'Required for Lodging; this is the Permanent Lamp recipe.'),
      metalCraft(5,'Scythe','Scythe',2,[{entity:'Iron',quantity:3},{entity:'Coal',quantity:15}],'Doubles the acres harvested per person for grain, sugar and fodder.'),
      metalCraft(6,'Plow','Plow',5,[{entity:'Iron',quantity:10},{entity:'Coal',quantity:25},{entity:'Log',quantity:1}],'A person with a Plow and a horse/cow can plow 8 acres.'),
      metalCraft(8,'Cauldron','Cauldron',4,[{entity:'Iron',quantity:20},{entity:'Coal',quantity:100}],'Used for Waxwork recipes including Candles and Cuirboilli.'),
      metalCraft(9,'Glasspipe','Glasspipe',3,[{entity:'Iron',quantity:2},{entity:'Coal',quantity:40}],'Required for working glass.')
    ],
    requiredUses:[
      { level:6, entity:'Trumpet', label:'Trumpet', requirements:[{skill:'Music',level:6}], detail:'Trumpet construction uses Metalwork 6; unlike the other listed instruments it does not require Woodwork.', source:'13.1.23' },
      { level:3, entity:'Ferry', label:'Ferry', requirements:[{skill:'Shipbuilding',level:2},{skill:'Woodwork',level:5}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:3, entity:'Fisher', label:'Fisher', requirements:[{skill:'Shipbuilding',level:2},{skill:'Woodwork',level:6}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:3, entity:'Barge', label:'Barge', requirements:[{skill:'Shipbuilding',level:3},{skill:'Woodwork',level:5}], detail:'Shipbuilding table requirement; also described in the Barge travel rules.', source:'20.4' },
      { level:3, entity:'Coaster', label:'Coaster', requirements:[{skill:'Shipbuilding',level:3},{skill:'Woodwork',level:6}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:5, entity:'Small Galley', label:'Small Galley', requirements:[{skill:'Shipbuilding',level:4},{skill:'Woodwork',level:7}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:5, entity:'Medium Galley', label:'Medium Galley', requirements:[{skill:'Shipbuilding',level:5},{skill:'Woodwork',level:7}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:5, entity:'Large Galley', label:'Large Galley', requirements:[{skill:'Shipbuilding',level:6},{skill:'Woodwork',level:7}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:4, entity:'Trader', label:'Trader', requirements:[{skill:'Shipbuilding',level:6},{skill:'Woodwork',level:7}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:4, entity:'Longship', label:'Longship', requirements:[{skill:'Shipbuilding',level:8},{skill:'Woodwork',level:8}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:7, entity:'Merchant', label:'Merchant', requirements:[{skill:'Shipbuilding',level:9},{skill:'Woodwork',level:8}], detail:'Shipbuilding table requirement.', source:'20.4' },
      { level:7, entity:'Warship', label:'Warship', requirements:[{skill:'Shipbuilding',level:9},{skill:'Woodwork',level:8}], detail:'Shipbuilding table requirement.', source:'20.4' }
    ],
    notes:[
      'Any normal Metalwork recipe that uses Iron may instead use the same quantity of Bronze or Brass and only 75% of the Coal, rounded up per tool. Quarrels are explicitly IRON ONLY.',
      'State the metal used in the Orders Distinction field.',
      'Metal cannot be recovered from an item once it has been made.',
      'The shipbuilding table requires Brass specifically; Bronze may not replace that Brass.'
    ],
    researchEffectOverrides:{
      'Advanced Trap':'One Advanced Trap gives one Hunter/Furrier +1.0 AM; it cannot be mixed with standard or Improved Traps.',
      'Bronze Statue':'Craft a 1,000 lb Bronze Statue as an Art or Metalwork activity; it is a Trade good that may be sold at Fair and possibly Trade Towns.',
      'Chisel':'Doubles Quarrying output to 10 Stones and may combine with a Mattock for 15; also doubles Stonework and Art output for stone items.',
      'Improved Trap':'+0.15 AM each for Hunting/Furrier; up to five provide +0.75 AM and cannot be mixed with standard Traps.',
      'Knife':'Doubles Skinning, Gutting and Boning; also lets Farmers harvest double the acres. Anyone may use the item once made.',
      'Mining Ladder':'+100% Mining output for ten miners and +100% Digging output for ten diggers; additive with other Mining implements.',
      'Saw':'Multiplies Forestry logging by four and cannot be used with an Adze.',
      'Seam Wedges':'+50% Mining output for a miner already using a Pick or Shovel.',
      'Scraper (Metal)':'Doubles Bark stripping output.',
      'Water Tank':'Portable 1,000 lb water-supply capacity; improves a Village’s ability to withstand siege.'
    },
    relatedSkills:['Mining','Quarrying','Forestry','Farming','Glasswork','Music','Shipbuilding','Hunting','Furrier']
  });

  benefit('Shovel', { skill:'Mining', value:'+50% output', detail:'Adds 50% to Mining output.', source:'Mandate', section:'13.1.21' });
  benefit('Shovel', { skill:'Pottery', value:'×2 Clay digging', detail:'Raises Clay digging from 20 to 40 Clay per person where Clay may be dug.', source:'Mandate', section:'13.1.24' });
  benefit('Shovel', { skill:'Engineering', value:'×2 digging', detail:'Doubles Ditch/Moat/Sand/Clay digging rate.', source:'Mandate', section:'13.1.21' });
  benefit('Mattock', { skill:'Quarrying', value:'×2 output', detail:'Raises the normal base rate from 5 to 10 Stones per quarrier.', source:'Mandate', section:'13.1.25' });
  benefit('Mattock', { skill:'Mining', value:'+50% output', detail:'Adds 50% to Mining output.', source:'Mandate', section:'13.1.21' });
  benefit('Pick', { skill:'Mining', value:'×2 output', detail:'Doubles Mining output when used as the miner’s normal basic tool.', source:'Mandate', section:'13.1.21' });
  benefit('Pick', { skill:'Engineering', value:'+50% digging', detail:'Adds 50% to Ditch/Moat digging.', source:'Mandate', section:'13.1.21' });
  benefit('Hoe', { skill:'Farming', value:'2 acres plowed', detail:'One person with a Hoe can plow 2 acres.', source:'Mandate', section:'13.1.21' });
  benefit('Scythe', { skill:'Farming', value:'×2 harvest area', detail:'Doubles acres harvested by one person for grain, sugar and fodder.', source:'Mandate', section:'13.1.21' });
  benefit('Plow', { skill:'Farming', value:'8 acres plowed', detail:'One person with a Plow and a horse/cow can plow 8 acres.', source:'Mandate', section:'13.1.21' });
  benefit('Glasspipe', { skill:'Glasswork', value:'Required implement', detail:'Required for working glass.', source:'Mandate', section:'13.1.21' });
  benefit('Pellets', { skill:'Combat', value:'Improves Sling fire', detail:'Ten Pellets are used per slinger in the missile phase and improve Sling effectiveness.', source:'Mandate', section:'13.1.21' });
  benefit('Quarrels', { skill:'Archery', value:'Arbalest ammunition', detail:'Iron-only ammunition for Arbalests, described as having improvements similar to arrows.', source:'Mandate', section:'13.1.21' });
  benefit('Lamp', { skill:'Engineering', value:'Required for Lodging', detail:'A Permanent Lamp is required for Lodging.', source:'Mandate', section:'13.1.20' });

  register('MINING', {
    name:'Mining',
    researchAliases:['Mining','Min'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Efficiency / deposit-extraction skill',
    levelDetail:'Mining output varies with number of miners, Mining skill, weather and the basic/research implements used.',
    primarySection:'13.1.22',
    additionalSections:['13.1.21','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Mining is not a # skill and has no 10×skill worker cap.',
    summary:'Extracts the mineral deposit present in a hex. A scouting mineral find establishes that a deposit is available to mine.',
    outputs:[
      { label:'Mineral from the known deposit', rate:'Variable', type:'Raw material', detail:'A hex has one mineral deposit. Output is influenced by miner count, Mining skill and weather.', source:'13.1.22' }
    ],
    factors:[
      { factor:'Known deposit', effect:'Required', detail:'A scouting find of a mineral indicates its presence for Mining.' },
      { factor:'Number of miners', effect:'Affects output', detail:'Mining output scales with the number assigned.' },
      { factor:'Mining skill', effect:'Affects output and safety', detail:'Higher Mining increases output and reduces the danger of Mining.' },
      { factor:'Weather', effect:'Affects output', detail:'Weather is explicitly listed as a Mining-output factor.' },
      { factor:'Rare deposits', effect:'May differ', detail:'Gold, Jade, Gems and similar deposits may eventually be subject to depletion through saturated Mining.' },
      { factor:'Research-created deposits', effect:'Relevant research required', detail:'Deposits created by research, such as Limestone in the Mandate example, require the relevant research to be mined even if discovered.' }
    ],
    implements:[
      { name:'Pick', value:'×2 output', baseMax:'1 / miner', baseMaxBenefit:'+100%', craft:[{skill:'Metalwork',level:3}], requiresResearch:false, detail:'Normal basic Mining tool; doubles Mining output.', source:'Mandate', section:'13.1.21' },
      { name:'Shovel', value:'+50% output', baseMax:'1 / miner', baseMaxBenefit:'+50%', craft:[{skill:'Metalwork',level:2}], requiresResearch:false, detail:'Normal basic Mining tool; adds 50% to output.', source:'Mandate', section:'13.1.21' },
      { name:'Mattock', value:'+50% output', baseMax:'1 / miner', baseMaxBenefit:'+50%', craft:[{skill:'Metalwork',level:3}], requiresResearch:false, detail:'Normal basic Mining tool; adds 50% to output.', source:'Mandate', section:'13.1.21' },
      { name:'Mining Ladder', value:'+100% to 10 miners', baseMax:'1 / 10 miners', baseMaxBenefit:'+100%', craft:[{skill:'Woodwork',level:3},{skill:'Metalwork',level:3}], requiresResearch:true, detail:'Additive/cumulative with Picks, Shovels, Ore Carts and Seam Wedges; one ladder supports ten miners.', source:'Research', research:'Mining / Mining Ladder' },
      { name:'Ore Cart', value:'+100% to 10 miners', baseMax:'1 / 10 miners', baseMaxBenefit:'+100%', craft:[{skill:'Woodwork',level:3}], requiresResearch:true, detail:'Cumulative with other Mining implements. Despite the name, it is equipment rather than a vehicle.', source:'Research', research:'Mining / Ore Cart' },
      { name:'Seam Wedges', value:'+50% output', baseMax:'1 / miner', baseMaxBenefit:'+50%', craft:[{skill:'Metalwork',level:2}], requiresResearch:true, detail:'Adds 50% for one miner using a Pick or Shovel.', source:'Research', research:'Mining / Seam Wedges' }
    ],
    implementTitle:'Mining implements',
    implementRule:'Without the relevant research, use only one basic Mining tool: Pick OR Shovel OR Mattock. Research can authorise combinations and additional implements.',
    factTables:[
      { kicker:'Deposits', title:'Minerals explicitly listed in the Mandate', source:'13.1.22', columns:[
        { key:'material', label:'Deposit' }, { key:'note', label:'Rule note' }
      ], rows:[
        { material:{entity:'Coal',label:'Coal'}, note:'Normal deposit type.' },
        { material:{entity:'Iron Ore',label:'Iron Ore'}, note:'Normal deposit type.' },
        { material:{entity:'Copper Ore',label:'Copper Ore'}, note:'Normal deposit type.' },
        { material:{entity:'Tin Ore',label:'Tin Ore'}, note:'Normal deposit type.' },
        { material:{entity:'Zinc Ore',label:'Zinc Ore'}, note:'Normal deposit type.' },
        { material:{entity:'Lead Ore',label:'Lead Ore'}, note:'Normal deposit type.' },
        { material:{entity:'Salt',label:'Salt'}, note:'Normal deposit type.' },
        { material:{entity:'Silver',label:'Silver'}, note:'Normal deposit type.' },
        { material:{entity:'Gold',label:'Gold'}, note:'Rare mineral; depletion through saturated Mining is noted as a possible rule.' },
        { material:'Jade / Gems / other minerals', note:'Other assorted and rare minerals may occur.' }
      ] }
    ],
    researchEffectOverrides:{
      'Appropriate Mining Tool':'Allows one miner to use both a Pick and a Shovel in the same turn.',
      'Geology I, Geology II, Geology III':'Each stage adds +2 effective Mining; Geology I also unlocks the Group C Geology skill for later Geology research.',
      'Mining 11':'Raises Mining by +1, to level 11.',
      'Mining Ladder':'+100% Mining output for ten miners and +100% Digging output for ten diggers; additive rather than compounded.',
      'Ore Cart':'+100% Mining output for ten miners; cumulative with other Mining implements.',
      'Salt Panning':'Creates a Salt Mine in one chosen Prairie hex.',
      'Seam Wedges':'+50% Mining output for a miner using a Pick or Shovel.'
    },
    relatedSkills:['Scouting','Metalwork','Woodwork','Geology','Quarrying']
  });

  benefit('Mining Ladder', { skill:'Mining', value:'+100% to 10 miners', detail:'One ladder increases Mining output by 100% for ten miners; cumulative and additive with other implements.', source:'Research', research:'Mining / Mining Ladder' });
  benefit('Mining Ladder', { skill:'Pottery', value:'+100% to 10 diggers', detail:'Also doubles Digging output such as Clay for ten diggers.', source:'Research', research:'Mining / Mining Ladder' });
  benefit('Ore Cart', { skill:'Mining', value:'+100% to 10 miners', detail:'Cumulative with Picks, Shovels, Mining Ladders and Seam Wedges.', source:'Research', research:'Mining / Ore Cart' });
  benefit('Seam Wedges', { skill:'Mining', value:'+50% output', detail:'For a miner using a Pick or Shovel.', source:'Research', research:'Mining / Seam Wedges' });

  register('POTTERY', {
    name:'Pottery',
    researchAliases:['Pottery','Pot'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / direct production skill',
    levelDetail:'Pottery is a # skill: worker capacity is 10 × skill level; its base containers are all available from Pottery 1.',
    primarySection:'13.1.24',
    additionalSections:['12.2','13.1.21','23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'The production cap follows the Group A # rule. Clay digging associated with Pottery is explicitly unlimited.',
    summary:'Makes ceramic containers and can dig its own Clay at water-adjacent sites; arid/desert production can require additional water.',
    directCrafts:[
      { level:1, entity:'Ewer', label:'Ewer', people:1, inputs:[{entity:'Coal',quantity:3},{entity:'Clay',quantity:5}], detail:'Holds 20 lb; empty weight 5 lb.', source:'13.1.24' },
      { level:1, entity:'Jar', label:'Jar', people:2, inputs:[{entity:'Coal',quantity:5},{entity:'Clay',quantity:10}], detail:'Holds 50 lb; empty weight 10 lb.', source:'13.1.24' },
      { level:1, entity:'Urn', label:'Urn', people:4, inputs:[{entity:'Coal',quantity:10},{entity:'Clay',quantity:20}], detail:'Holds 150 lb; empty weight 20 lb.', source:'13.1.24' }
    ],
    factTables:[
      { kicker:'Clay', title:'Clay sourcing for Pottery', source:'13.1.24', columns:[
        { key:'situation', label:'Situation' }, { key:'rate', label:'Clay / requirement' }, { key:'detail', label:'Notes' }
      ], rows:[
        { situation:'Adjacent to river/lake', rate:'Pottery may proceed without stored Clay', detail:'Indicate in Orders whether stored Clay is being used.' },
        { situation:'Digging Clay', rate:'20 Clay / person', detail:'Unlimited diggers may gather Clay from a hex adjacent to a river/lake.' },
        { situation:'Digging with Shovel', rate:'40 Clay / person', detail:'A Shovel doubles the Clay digging rate.' },
        { situation:'Arid / desert', rate:'1 lb Water / 2 lb Clay', detail:'Extra water is required when Pottery is performed under these conditions.' }
      ] }
    ],
    researchEffectOverrides:{
      'Advanced Pottery':'Produces two Ewers/Jars/Urns for the normal Clay and Coal consumption, with added Silver cost.',
      'China':'Allows production of China: 2 people, 4 Kaolin, 20 Coal and 10 Silver per item, requiring a Kiln; maximum 100 potters per Clan.',
      'Crown Moulding':'Creates decorative Crown Moulding using Pottery 10 and Art 10; no public use was listed when released.',
      'Moulding':'Creates decorative Moulding using Pottery 10, Design 6 and Architecture 3; no public use was listed when released.',
      'Terracotta Army':'Marked “removed” in the current Research List; retained as source history rather than an active recommendation.'
    },
    notes:[
      'Pottery may be performed without stored Clay when adjacent to a river or lake.',
      'Clay digging is unlimited even though Pottery production itself is worker-capped.'
    ],
    relatedSkills:['Metalwork','Mining','Art','Architecture','Design']
  });

  benefit('Ewer', { skill:'Pottery', value:'20 lb capacity', detail:'Empty weight 5 lb.', source:'Mandate', section:'13.1.24' });
  benefit('Jar', { skill:'Pottery', value:'50 lb capacity', detail:'Empty weight 10 lb.', source:'Mandate', section:'13.1.24' });
  benefit('Urn', { skill:'Pottery', value:'150 lb capacity', detail:'Empty weight 20 lb.', source:'Mandate', section:'13.1.24' });

  register('QUARRYING', {
    name:'Quarrying',
    researchAliases:['Quarrying','Qry'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / fixed-output gathering skill',
    levelDetail:'Skill level controls worker capacity; the base output is 5 Stones per worker before tools or Quarrying research modify the per-worker rate.',
    primarySection:'13.1.25',
    additionalSections:['13.1.21','23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Quarrying is a Group A # skill. Research can also allow Inactives to provide a limited share of Quarrying labour.',
    summary:'Produces Stone in mountain or hill terrain. Mattocks double the base rate, while research can raise the base Stones/person and permit additional tools.',
    outputs:[
      { item:'Stones', label:'Stones', rate:'5 / worker', type:'Raw material', detail:'Base output in any mountain or hill area; each Stone is one cubic foot.', source:'13.1.25' }
    ],
    factors:[
      { factor:'Terrain', effect:'Mountain or hill required', detail:'The base Mandate rule provides Stones in any mountain or hill area.' },
      { factor:'Quarrying skill', effect:'Sets worker capacity', detail:'10 workers per skill level until level 10, then unlimited.' },
      { factor:'Base-rate research', effect:'Raises Stones / person', detail:'The Research List provides a chain from 6 up to 10 Stones per person; implement bonuses use the improved base.' },
      { factor:'Additional tools', effect:'Research-gated', detail:'Normally use the Mattock as the basic tool. Extra Quarrying Tools research allows a Shovel in addition.' }
    ],
    implements:[
      { name:'Mattock', value:'×2 output', baseMax:'1 / quarrier', baseMaxBenefit:'+100%', craft:[{skill:'Metalwork',level:3}], requiresResearch:false, detail:'Doubles the normal Mandate rate from 5 to 10 Stones per worker.', source:'Mandate', section:'13.1.25' },
      { name:'Chisel', value:'×2 output', baseMax:'1 / quarrier', baseMaxBenefit:'+100%', craft:[{skill:'Metalwork',level:3}], requiresResearch:true, detail:'Chisel research doubles Quarrying; a Chisel may also be used with a Mattock for 15 Stones at the normal 5-Stone base.', source:'Research', research:'Metalwork / Chisel' },
      { name:'Shovel', value:'+1 base-rate increment', baseMax:'1 / quarrier', baseMaxBenefit:'+100% with Mattock at base 5', craft:[{skill:'Metalwork',level:2}], requiresResearch:true, detail:'Extra Quarrying Tools research allows a Shovel in addition to a Mattock, producing 15 Stones at the normal 5-Stone base.', source:'Research', research:'Quarrying / Extra Quarrying Tools' }
    ],
    implementTitle:'Quarrying implements',
    implementRule:'Without research, Mattock is the normal basic implement. Research can authorise additional tools, and rate-raising research changes the base number used by those implements.',
    researchEffectOverrides:{
      '6 Stones / Person':'Raises the base Quarrying rate to 6 Stones per person; Mattock-style implement bonuses use 6 as the new base.',
      '7 Stones / Person':'Raises the base Quarrying rate to 7 Stones per person.',
      '8 Stones / Person':'Raises the base Quarrying rate to 8 Stones per person.',
      '9 Stones / Person':'Raises the base Quarrying rate to 9 Stones per person.',
      '10 Stones / Person':'Raises the base Quarrying rate to 10 Stones per person.',
      'Extra Quarrying Tools':'Allows a Shovel in addition to a Mattock; at the normal 5-Stone base this raises a worker from 10 to 15 Stones.',
      'Hill Sculpture':'Allows construction of a one-month Hill/Mountain sculpture; a Clan unit may honour it once per game year for +0.04 Morale.',
      'Inactive Quarriers':'Inactives may provide up to one-third of Quarrying labour but must accompany ordinary quarriers.',
      'Limestone':'Adds a new Limestone deposit near the Clan; Limestone is quarried at the normal Stone rate and receives Quarrying research/tool modifiers.'
    },
    relatedSkills:['Metalwork','Mining','Stonework','Engineering','Art','Architecture']
  });

  benefit('Chisel', { skill:'Quarrying', value:'×2 output', detail:'Doubles Quarrying output; may combine with a Mattock for 15 Stones at the normal base rate.', source:'Research', research:'Metalwork / Chisel' });
  benefit('Shovel', { skill:'Quarrying', value:'Extra tool with research', detail:'Extra Quarrying Tools permits a Shovel in addition to a Mattock.', source:'Research', research:'Quarrying / Extra Quarrying Tools' });

  register('SALTING', {
    name:'Salting',
    researchAliases:['Salting','Salt'],
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / preservation skill',
    levelDetail:'Skill level controls how many salters may work; each worker can preserve up to 100 provisions-worth of Fish.',
    primarySection:'22.2.1',
    additionalSections:['29.34','23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each assigned person can Salt up to 100 provs worth of Fish using 0.1 Salt per prov.',
    summary:'Preserves Fish by converting it into provisions so that excess catch is not lost at the end of the turn.',
    processRows:[
      { activity:'Salt Fish', perWorker:'Up to 100 provs worth', inputs:[{entity:'Fish',label:'up to 100 provs worth of Fish'},{entity:'Salt',label:'0.1 Salt per prov'}], outputs:[{entity:'Provisions',label:'preserved Provisions'}], detail:'Salting occurs before Movement and regardless of how many provisions will later be eaten.', source:'22.2.1' }
    ],
    researchEffectOverrides:{
      'Salt Panning':'Creates a Salt mine in one chosen Prairie hex. The site cannot already contain a Village and Villages may not later be built there.'
    },
    notes:[
      'Fish not eaten or Salted in the turn caught are lost.',
      'Salting is ordered in the Activities phase before Movement.'
    ],
    relatedSkills:['Fishing','Mining']
  });

  benefit('Salt', { skill:'Salting', value:'0.1 per prov', detail:'One salter uses 0.1 Salt for each provision-worth of Fish preserved.', source:'Mandate', section:'22.2.1' });

  register('SEWING', {
    name:'Sewing',
    researchAliases:['Sewing','Sew'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / production skill',
    levelDetail:'Higher Sewing unlocks containers, armour components, cloth goods and fur garments.',
    primarySection:'13.1.28',
    additionalSections:['15.1','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Sewing has no general 10×skill worker cap; individual recipes and research topics may impose their own limits.',
    summary:'Produces sewn containers, cloth goods, tents, fur garments and some armour. Several outputs have direct transport or trade uses.',
    directCrafts:[
      { level:2, entity:'Bladder', label:'Bladder ×2', people:1, inputs:[{entity:'Gut',quantity:2},{entity:'Leather',quantity:1}], detail:'Produces two Bladders; each holds 10 lb of water.', source:'13.1.28' },
      { level:4, entity:'Cloth', label:'Cloth', people:5, inputs:[{entity:'Parchment',quantity:20}], detail:'Base Sewing Cloth recipe.', source:'13.1.28' },
      { level:5, entity:'Tent', label:'Tent', people:2, inputs:[{entity:'Cloth',quantity:4},{entity:'Log',quantity:2},{entity:'Rope',quantity:2}], detail:'Portable Tent.', source:'13.1.28' },
      { level:5, entity:'Fur Jacket', label:'Fur Jacket ×10', people:10, inputs:[{entity:'Furs',quantity:20},{entity:'Cotton',quantity:1}], detail:'Ten Fur Jackets; may be sold at Trading Towns or International Cities for 2 Coin each, limit 10 per Clan per turn.', source:'13.1.28' },
      { level:6, entity:'Fur Coat', label:'Fur Coat ×10', people:15, inputs:[{entity:'Furs',quantity:30},{entity:'Cotton',quantity:2}], detail:'Ten Fur Coats; may be sold at Trading Towns or International Cities for 3 Coin each, limit 10 per Clan per turn.', source:'13.1.28' },
      { level:7, entity:'Curtains', label:'Curtains', people:2, inputs:[{entity:'Cotton',quantity:300}], detail:'300 Cotton per Curtain; each Curtain weighs 3 lb.', source:'13.1.28' }
    ],
    requiredUses:[
      { level:3, entity:'Ring Mail', label:'Ring Mail', requirements:[{skill:'Armour',level:4}], detail:'Requires 1 Jerkin, 8 Iron and 20 Coal in addition to Sewing 3.', source:'13.1.28' },
      { level:3, entity:'Scale Mail', label:'Scale Mail', requirements:[{skill:'Armour',level:3}], detail:'Requires 1 Jerkin, 10 Bronze and 15 Coal in addition to Sewing 3.', source:'13.1.28' }
    ],
    researchEffectOverrides:{
      'Brocade':'2 people with Sewing 10 and Weaving 4 use 10 Silk and 100 Cotton to produce 10 Brocade. Only 2 people per Tribe may do this monthly; Brocade sells for valuable commodities at NPC towns, not at Fair.',
      'Command Tent':'Sewing 10 recipe. Sufficient Command Tents give +1 Leadership Modifier to the side, and +2 Tactics when a participating unit has the research.'
    },
    notes:[
      'Fur Jacket and Fur Coat sales are limited to 10 of each per Clan per turn at Trading Towns or International Cities.',
      'The Research List marks Brocade “To be modified”; the dossier preserves the currently published values rather than inventing replacements.'
    ],
    relatedSkills:['Armour','Weaving','Furrier','Leadership','Tactics']
  });

  benefit('Bladder', { skill:'Sewing', value:'10 lb water capacity', detail:'The base Sewing recipe produces two Bladders; each holds 10 lb of water.', source:'Mandate', section:'13.1.28' });
  benefit('Fur Jacket', { skill:'Sewing', value:'2 Coin sale price', detail:'May be sold at a Trading Town or International City; limit 10 per Clan per turn.', source:'Mandate', section:'13.1.28' });
  benefit('Fur Coat', { skill:'Sewing', value:'3 Coin sale price', detail:'May be sold at a Trading Town or International City; limit 10 per Clan per turn.', source:'Mandate', section:'13.1.28' });
  benefit('Curtains', { skill:'Sewing', value:'3 lb each', detail:'Each Curtain requires 300 Cotton and weighs 3 lb.', source:'Mandate', section:'13.1.28' });
})();

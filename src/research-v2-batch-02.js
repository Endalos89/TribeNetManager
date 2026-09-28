(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 02');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const sr = (label, skill) => ({ label, skill: skill || label, type:'skill' });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  topics.push(
    t('Cheesemaking','Cheesemaking 11',4,51,{
      effects:['Increases Cheesemaking output by 10%.','For order accounting, add Auxiliaries equal to 10% of the workers assigned to Cheesemaking. The extra Auxiliaries represent efficiency rather than additional workers.'],
      restrictions:['Tools or implements may only be applied to the original number of workers, not to the efficiency Auxiliaries.'],
      affectsSkills:['Cheesemaking']
    })
  );

  topics.push(
    t('Combat','Assault Troops',5,51,{
      effects:['Adds +2 Combat Skill.','Adds +2 Assault Attack Terrain Proficiency (AA).','The terrain-proficiency bonus is specialised for attacks on fortifications.'],
      affectsSkills:['Combat']
    }),
    t('Combat','Close Order Infantry',4,52,{effects:['Adds +3 Combat Skill.'],affectsSkills:['Combat']}),
    t('Combat','Combat 11',5,52,{effects:['Adds +1 Combat Skill.'],leadsTo:[rr('Combat 12','Combat 12','Combat')],affectsSkills:['Combat']}),
    t('Combat','Combat 12',5,53,{prerequisites:[rr('Combat 11','Combat 11','Combat')],effects:['Adds +1 Combat Skill.'],affectsSkills:['Combat']}),
    t('Combat','Army',5,53,{
      prerequisites:[rr('Home Guard','Home Guard','Combat')],
      effects:['Units from Tribes with Army research gain +0.10 Combat Morale. The source states that together with Home Guard this is an effective +0.20.','The source describes Army as increasing outgoing Potential Casualties by a further 10% on top of Home Guard.','The Army combat bonus applies only if enough Barracks capacity exists to support the warriors.'],
      recipe:recipe('Engineering',{item:'Barracks',quantity:1},100,[{item:'Logs',quantity:200}],[{name:'Engineering',level:4}],'1 Barracks: 100 Person, Eng 4, Logs 200'),
      requirements:['One Barracks is required for each 50 Warriors in the Tribe with the research and its Elements. If the Army is not fully supported by Barracks, the Army bonus does not apply in combat.'],
      notes:['The source says Barracks may be built by another Tribe or Clan, but only once Army research is completed.','Logs for the Barracks are installed at 2 Logs per person.'],
      creates:[building('Barracks',['Supports up to 50 Warriors for the Army research combat bonus.'],{recipe:recipe('Engineering',{item:'Barracks',quantity:1},100,[{item:'Logs',quantity:200}],[{name:'Engineering',level:4}]),requirements:['Army research must be completed before the Barracks described by this research can be built.'],notes:['One Barracks required per 50 Warriors for the Army bonus.']})]
    }),
    t('Combat','Home Guard',5,54,{
      prerequisites:[sr('Combat 10','Combat'),sr('Mobilisation 11','Mobilisation')],
      effects:['Adds +0.5 Terrain Proficiency when units of the Tribe fight in an owned hex, whether attacking or defending and whether inside or outside fortifications.','The source states +0.5 Terrain Proficiency gives a base damage improvement of 10%.'],
      requirements:['An owned hex is one listed in the Settlements section of the Clan turn report.'],
      leadsTo:[rr('Army','Army','Combat')],
      sourceIssues:['The Home Guard block is printed twice on the source page; the Compendium records the operational rule once.']
    })
  );

  topics.push(
    t('Cooking','Banquet',5,56,{
      effects:['Once per year, the participating Tribe gains +0.02 General Morale.','The Host Tribe may invite one guest Tribe from inside or outside the Clan; the guest also receives the morale increase.','The Banquet occurs outside normal activities and defence.'],
      recipe:{activity:'Cooking / Banquet',output:{item:'Banquet',quantity:1},labour:'Whole Tribe participates; outside normal activities',inputs:[{item:'Cattle',quantity:20,note:'per 1,000 participants'},{item:'Barrel of Grog',quantity:20,note:'per 1,000 participants'}],raw:'Once per Year: Cattle 20, Barrel of Grog 20 per 1000 participants'},
      requirements:['Use 20 Cattle and 20 Barrels of Grog per 1,000 participants.','Cattle and drink must be shown as a Transfer to usage.']
    }),
    t('Cooking','Stew',3,56,{
      effects:['One person assigned to Cooking produces 40 Stew (Provisions) from 5 Goats.'],
      recipe:recipe('Cooking',{item:'Stew',quantity:40},1,[{item:'Goats',quantity:5}],[],'40 Stew (Provisions): 1 Cook, 5 Goats'),
      creates:[item('Stew',['Counts as Provisions; 40 Stew are produced from 5 Goats by one Cook.'],{recipe:recipe('Cooking',{item:'Stew',quantity:40},1,[{item:'Goats',quantity:5}])})]
    })
  );

  topics.push(
    t('Dance','Spring Arts Festival Dance',6,57,{
      effects:['Once per year during a Spring month, the Tribe may hold the Dance version of the Spring Arts Festival.','If participation requirements are met, the Tribe gains +0.02 General Morale and 20 Gold, or a player-selected equivalent.','If the Tribe has Spring Arts Festival research for Art, Music and Dance, further research may become available; contact the GM.'],
      recipe:recipe('Engineering',{item:'Amphitheatre',quantity:1},null,[{item:'Stone',quantity:10000},{item:'Cloth',quantity:1000},{item:'Silver',quantity:5000}],[{name:'Engineering',level:8}],'Amphitheatre: Eng8, Stones 10k, Cloth 1k, Silver 5k'),
      leadsTo:[rr('Inter Spring Arts Festival (Dance)','Inter Spring Arts Festival','Dance')],
      requirements:['At least 500 Warriors/Actives, in any combination, must spend the month participating and perform no other work.','The festival must be held during Spring.'],
      restrictions:['Books may not be written for this topic.'],
      notes:['Any Tribe, including another Clan’s Tribe, may build an Amphitheatre regardless of research.','The source note says Inter Spring Arts Festival requires Administration 10, an Amphitheatre, at least 1,000 W/A audience for other-Clan participants, and no Hunting by those participants during the Fair turn.'],
      relatedSkills:['Art','Music','Administration','Engineering'],
      sourceIssues:['The Artist Participation requirement in the Dance entry says “Spring Arts Festival – Art”; this appears verbatim in the source and is not silently rewritten.']
    })
  );

  topics.push(
    t('Diplomacy','Diplomatic Rumours',2,57,{
      effects:['Reveals the location of the closest International City or Trading Town, at the player’s choice.','The research may be repeated to learn additional locations.'],
      notes:['Known locations may be excluded by telling the GM.']
    }),
    t('Diplomacy','Expanded Horizons',5,58,{
      effects:['Adds one additional Desired Commodity to the Clan.','The Desired Commodity type is determined randomly by the GM.','The source says the added Desired Commodity will yield Slaves at the Fair.'],
      leadsTo:[rr('Expanded Horizons II','Expanded Horizons II','Diplomacy')],
      notes:['This research is also available under Economics.'],
      relatedSkills:['Economics']
    }),
    t('Diplomacy','Expanded Horizons II',5,58,{
      prerequisites:[rr('Expanded Horizons','Expanded Horizons','Diplomacy')],
      effects:['Adds another additional Desired Commodity to the Clan.','The Desired Commodity type is determined randomly by the GM.','The source says the added Desired Commodity will yield Slaves at the Fair.'],
      notes:['The prerequisite may have been completed as Diplomacy or Economics research.'],
      relatedSkills:['Economics']
    }),
    t('Diplomacy','Trade Envoy',4,58,{
      prerequisites:[sr('Economics 6','Economics')],
      effects:['Allows the Tribe to create a Trade Envoy at the main Tribe’s location. The Envoy must then be physically moved by a Clan unit to an International City or Trading Town.','At an International City, the Envoy increases delivery-route volumes, and therefore commissions, by 50% in both directions while remaining in that city.','At a Trading Town, the Envoy increases the Clan’s buy and sell quantities there by 50% while remaining in that town.','The research may be repeated to create additional Trade Envoys.'],
      requirements:['International City benefit requires a Clan unit delivering goods on commission.','The Envoy must remain at the relevant city/town to maintain the benefit.','The player must calculate modified quantities and flag the Trade Envoy use in GM Actions.'],
      relatedSkills:['Economics']
    })
  );

  topics.push(
    t('Distilling','Absinthe',5,60,{
      effects:['Unlocks Absinthe for sale at the Fair.','The source gives an opening Fair price of 500 Silver and starting quantity of 20 Barrels.'],
      recipe:recipe('Distilling',{item:'Absinthe',quantity:1},5,[{item:'Grain',quantity:100},{item:'Herbs',quantity:10},{item:'Silver',quantity:5}],[],'1 Barrel: People 5, Grain 100, Herbs 10, Silver 5'),
      creates:[item('Absinthe',['Alcohol sold at the Fair; source opening benchmark is 500 Silver with starting quantity 20 Barrels.'],{recipe:recipe('Distilling',{item:'Absinthe',quantity:1},5,[{item:'Grain',quantity:100},{item:'Herbs',quantity:10},{item:'Silver',quantity:5}])})]
    }),
    t('Distilling','Branded Alcohol (Ale, Wine etc)',4,60,{
      effects:['Allows a researched brand of an existing alcohol to be produced.','Branded Alcohol may be sold at the Fair for 1.5 times the normal price of that alcohol.'],
      requirements:['Research the generic Branded Alcohol topic, then assign the brand so a new valid good can be created.','Distilling is done as normal but in multiples of 5 people and consumes a Barrel.'],
      notes:['The source example is 5 people producing 100 branded Ale from 100 Grain and 1 Barrel.'],
      sourceGaps:['The source says “As per standard Alcohol” rather than giving one universal recipe because the exact production depends on the alcohol being branded.'],
      creates:[item('Branded Alcohol',['A branded version of an existing alcohol that sells for 1.5 times its normal Fair price.'],{requirements:['Produced using the normal recipe for the chosen alcohol, in multiples of 5 people, consuming a Barrel.']})]
    }),
    t('Distilling','Gin',4,60,{
      effects:['Unlocks Gin for sale at the Fair.','The source gives an opening Fair price of 1,000 Silver and starting quantity of 20 Barrels.'],
      recipe:recipe('Distilling',{item:'Gin',quantity:1},5,[{item:'Juniper',quantity:50},{item:'Grain',quantity:25},{item:'Herbs',quantity:1}],[],'1 Barrel: People 5, Juniper 50, Grain 25, Herbs 1'),
      notes:['After research is completed, a Juniper Special Hex is added within one or two mapsheets of the player’s position. Intelligence 5 may be used to find it under normal Intelligence rules.'],
      relatedSkills:['Intelligence'],
      creates:[item('Gin',['Alcohol sold at the Fair; source opening benchmark is 1,000 Silver with starting quantity 20 Barrels.'],{recipe:recipe('Distilling',{item:'Gin',quantity:1},5,[{item:'Juniper',quantity:50},{item:'Grain',quantity:25},{item:'Herbs',quantity:1}])})]
    }),
    t('Distilling','Port Wine',2,61,{
      effects:['Unlocks fortified Port Wine for sale at the Fair.'],
      recipe:recipe('Distilling',{item:'Port Wine',quantity:1},5,[{item:'Grapes',quantity:100},{item:'Brandy',quantity:10}],[{name:'Distilling',level:7}],'1 Barrel: People 5, Distilling 7, Grapes 100, Brandy 10'),
      creates:[item('Port Wine',['Fortified wine sold at the Fair.'],{recipe:recipe('Distilling',{item:'Port Wine',quantity:1},5,[{item:'Grapes',quantity:100},{item:'Brandy',quantity:10}],[{name:'Distilling',level:7}])})]
    }),
    t('Distilling','Road House',3,61,{
      prerequisites:[rr('Tavern','Tavern','Distilling')],
      effects:['Each Road House buys up to 2 Barrels of each accepted alcohol per turn from the Clan at standard Fair prices.','Accepted alcohol is Ale, Mead and Wine.','Branded Alcohol may replace its corresponding normal alcohol in the Road House sale, but is not an additional sale type.','Other alcohol price modifiers also apply to Road House purchase prices.'],
      recipe:recipe('Engineering',{item:'Road House',quantity:1},500,[{item:'Logs',quantity:1000},{item:'Silver',quantity:2000}],[{name:'Engineering',level:5}],'Road House: People 500, Eng 5, Logs 1000, Silver 2000'),
      requirements:['Road Houses must be built in the six adjacent hexes surrounding a village that houses a unit from a Tribe with Tavern and Road House research.','Players must use autotransfers to/from 1263 for the barrels/alcohol and returned Silver.'],
      restrictions:['A maximum of 6 Road Houses may be built through this research.','Road Houses may not be built on water.'],
      notes:['The source attributes the proposal to Lucas Riley.'],
      creates:[building('Road House',['Buys up to 2 Barrels each of Ale, Mead and Wine per turn at standard Fair prices; branded versions substitute for normal versions.'],{recipe:recipe('Engineering',{item:'Road House',quantity:1},500,[{item:'Logs',quantity:1000},{item:'Silver',quantity:2000}],[{name:'Engineering',level:5}]),requirements:['Build in one of the six hexes adjacent to a village containing a unit from a Tribe with Tavern and Road House research.'],restrictions:['Maximum 6 via this research.','Not on water.']})],
      relatedSkills:['Engineering']
    }),
    t('Distilling','Tavern',4,62,{
      effects:['Allows the owner to sell 2 times the normal Fair limit for alcohol.','A Trading Post is not required for this alcohol multiplier.'],
      recipe:recipe('Engineering',{item:'Tavern',quantity:1},250,[{item:'Logs',quantity:500}],[{name:'Engineering',level:4}],'Tavern: People 250, Eng 4, Logs 500'),
      leadsTo:[rr('Road House','Road House','Distilling')],
      requirements:['If the Tribe with Tavern research and the Tribe conducting the Fair are different, they may cooperate only when they share the same Village site.'],
      restrictions:['The overall Fair trading multiplier remains capped at ×3.'],
      notes:['The source notes a possible future use for Taverns outside villages to generate monthly beverage-sale income; no current operational rule is provided for that possibility.'],
      creates:[building('Tavern',['Doubles the normal Fair sale limit for alcohol without requiring a Trading Post.'],{recipe:recipe('Engineering',{item:'Tavern',quantity:1},250,[{item:'Logs',quantity:500}],[{name:'Engineering',level:4}]),restrictions:['Overall Fair trading multiplier remains capped at ×3.']})],
      relatedSkills:['Engineering']
    })
  );

  topics.push(
    t('Economics','Carnival',3,64,{
      effects:['Once per year, Carnival replaces a single Fair.','For that Fair, quantities available in each buy/sell slot are doubled.','The number of Fair slots remains unchanged at 10.','Where multiple effects modify the Fair Multiplier, Carnival increases the multiplier only up to a maximum of ×3.']
    }),
    t('Economics','Extra Fair Slot 1','Not listed',64,{
      effects:['Adds one additional Fair slot to the Clan.'],
      leadsTo:[rr('Extra Fair Slot 2','Extra Fair Slot 2','Economics')],
      sourceGaps:['The source groups Extra Fair Slot 1, 2 and 3 together but does not provide a DL for any of them.']
    }),
    t('Economics','Extra Fair Slot 2','Not listed',64,{
      prerequisites:[rr('Extra Fair Slot 1','Extra Fair Slot 1','Economics')],
      effects:['Adds a second additional Fair slot to the Clan.'],
      leadsTo:[rr('Extra Fair Slot 3','Extra Fair Slot 3','Economics')],
      sourceGaps:['The source groups Extra Fair Slot 1, 2 and 3 together but does not provide a DL for any of them.']
    }),
    t('Economics','Extra Fair Slot 3','Not listed',64,{
      prerequisites:[rr('Extra Fair Slot 2','Extra Fair Slot 2','Economics')],
      effects:['Adds a third additional Fair slot to the Clan. This is the stated maximum from this research chain.'],
      sourceGaps:['The source groups Extra Fair Slot 1, 2 and 3 together but does not provide a DL for any of them.']
    }),
    t('Economics','Expanded Horizons',5,64,{
      effects:['Adds one additional Desired Commodity to the Clan.','The Desired Commodity is determined randomly by the GM.','The source says this Desired Commodity provides Slaves.'],
      leadsTo:[rr('Expanded Horizons II','Expanded Horizons II','Economics')],
      notes:['This research is also available under Diplomacy.'],
      relatedSkills:['Diplomacy']
    }),
    t('Economics','Expanded Horizons II',5,65,{
      prerequisites:[rr('Expanded Horizons','Expanded Horizons','Economics')],
      effects:['Adds another additional Desired Commodity to the Clan.','The Desired Commodity is determined randomly by the GM.'],
      notes:['The prerequisite may have been completed under Diplomacy or Economics.'],
      relatedSkills:['Diplomacy']
    }),
    t('Economics','Market Place',5,65,{
      effects:['Increases the number of items that may be traded at the Fair from 10 to 15.'],
      recipe:recipe('Engineering',{item:'Market Place',quantity:1},250,[{item:'Logs',quantity:500}],[{name:'Engineering',level:4}],'1 Market Place: Eng 4, People 250, Log 500'),
      requirements:['Research is required to use the Market Place benefit, but the research is not required to build the Market Place.'],
      creates:[building('Market Place',['Raises Fair trading slots from 10 to 15 for a Tribe with the research.'],{researchOnly:false,recipe:recipe('Engineering',{item:'Market Place',quantity:1},250,[{item:'Logs',quantity:500}],[{name:'Engineering',level:4}]),requirements:['May be built without the research; research is required to use its Fair-slot benefit.']})],
      relatedSkills:['Engineering']
    }),
    t('Economics','Toll Gate',3,65,{
      effects:['Once a City has two Toll Gates, it gains either 100 Gold or 1,000 Coin immediately and again every twelve months.'],
      recipe:recipe('Engineering',{item:'Toll Gate',quantity:1},700,[{item:'Stone',quantity:2000},{item:'Logs',quantity:500},{item:'Iron',quantity:500}],[{name:'Engineering',level:6}],'Toll Gate: People 700, Eng 6, Stone 2000, Logs 500, Iron 500'),
      requirements:['The City must have a stone wall surrounding it.','Two Toll Gates are required before the tax income applies.'],
      restrictions:['Only Cities may have Toll Gates.','Toll Gates may only be built for the research holder’s City.'],
      creates:[building('Toll Gate',['Two Toll Gates in a walled City generate either 100 Gold or 1,000 Coin immediately and every 12 months.'],{recipe:recipe('Engineering',{item:'Toll Gate',quantity:1},700,[{item:'Stone',quantity:2000},{item:'Logs',quantity:500},{item:'Iron',quantity:500}],[{name:'Engineering',level:6}]),requirements:['City with surrounding stone wall; two gates required for income.'],restrictions:['Cities only.','Research holder’s City only.']})],
      relatedSkills:['Engineering']
    }),
    t('Economics','Wholesale Trading',4,66,{
      effects:['Increases the Tribe’s Fair Multiplier by one step, from ×1 to ×2 or from ×2 to ×3.','The number of Fair slots remains 10; the quantity available in each slot increases with the multiplier.','Multiple Fair Multiplier effects are capped at ×3.']
    })
  );

  const drawbridgeIron=recipe('Engineering',{item:'Drawbridge',quantity:1},55,[{item:'Logs',quantity:100},{item:'Iron',quantity:50},{item:'Coal',quantity:400},{item:'Rope',quantity:10}],[{name:'Engineering',level:10}],'Drawbridge: People 55, Engineering 10, Logs 100, Iron/Brass/Bronze 50, Coal 400, Rope 10',[
    recipe('Engineering',{item:'Drawbridge',quantity:1},55,[{item:'Logs',quantity:100},{item:'Brass',quantity:50},{item:'Coal',quantity:400},{item:'Rope',quantity:10}],[{name:'Engineering',level:10}],'Brass alternative'),
    recipe('Engineering',{item:'Drawbridge',quantity:1},55,[{item:'Logs',quantity:100},{item:'Bronze',quantity:50},{item:'Coal',quantity:400},{item:'Rope',quantity:10}],[{name:'Engineering',level:10}],'Bronze alternative')
  ]);

  topics.push(
    t('Engineering','Barbican',4,67,{
      prerequisites:[rr('Drawbridge','Drawbridge','Engineering'),rr('Gate House','Gate House','Engineering')],
      effects:['A Barbican takes four times the damage required to destroy a standard Stone Tower.','Adds +4 to effective Archery Skill for defenders in combat; the source says this incorporates the +2 from Drawbridge.','Barbicans may be built for other Clans and used by those Clans in their villages.'],
      recipe:recipe('Engineering',{item:'Barbican',quantity:1},null,[{item:'Stone',quantity:4000},{item:'Logs',quantity:500},{item:'Iron',quantity:500},{item:'Silver',quantity:10000}],[{name:'Engineering',level:10}],'Barbican: Eng 10, Stone 4000, Logs 500, Iron 500, Silver 10000'),
      affectsSkills:['Archery'],
      notes:['The source attributes the proposal to Paul Malone.'],
      creates:[building('Barbican',['Takes four times standard Stone Tower damage to destroy.','Adds +4 effective Archery to defenders, including the Drawbridge contribution.'],{recipe:recipe('Engineering',{item:'Barbican',quantity:1},null,[{item:'Stone',quantity:4000},{item:'Logs',quantity:500},{item:'Iron',quantity:500},{item:'Silver',quantity:10000}],[{name:'Engineering',level:10}]),notes:['May be built for and used by other Clans.']})]
    }),
    t('Engineering','Crenellations',4,67,{
      effects:['Full Crenellation coverage adds +5% to Fortification Value.','Partial coverage gives a proportional fraction of the +5% bonus.'],
      recipe:recipe('Engineering',{item:'Crenellations',quantity:1},6,[{item:'Stone',quantity:30}],[{name:'Engineering',level:6}],'1 yard of Crenellation: Eng 6, People 6, Stone 30'),
      requirements:['One yard of Crenellations is required for every yard of wall for the full +5% bonus.'],
      notes:['Grandfathered settlements occupied by a unit from a Tribe with this research automatically receive Crenellations equal to their longest wall length.','Existing Crenellations remain valid if the wall height is later increased.'],
      creates:[building('Crenellations',['Adds up to +5% Fortification Value depending on wall coverage.'],{recipe:recipe('Engineering',{item:'Crenellations',quantity:1},6,[{item:'Stone',quantity:30}],[{name:'Engineering',level:6}]),requirements:['One yard per yard of wall for full benefit.']})]
    }),
    t('Engineering','Drawbridge',5,68,{
      effects:['Adds +2 to effective Archery Skill for defenders in combat.','Drawbridges may be built for other Clans and used by those Clans in their villages.'],
      recipe:drawbridgeIron,
      leadsTo:[rr('Barbican','Barbican','Engineering')],
      affectsSkills:['Archery'],
      creates:[building('Drawbridge',['Adds +2 effective Archery to defenders.'],{recipe:drawbridgeIron,notes:['May be built for and used by other Clans.']})]
    }),
    t('Engineering','Dungeon',4,68,{
      effects:['Each Dungeon can hold 200 Slaves with only 1 Overseer, provided the Overseer has a Whip.','A Dungeon is a prerequisite for some Torture and other research topics.','Dungeons may be built in other Clans’ villages and used by those Clans.'],
      recipe:recipe('Engineering',{item:'Dungeon',quantity:1},400,[{item:'Stone',quantity:2000}],[{name:'Engineering',level:7}],'Dungeon: People 400, Eng 7, Stones 2000'),
      leadsTo:[rr('Colosseum','Colosseum','Engineering'),rr('Treachery','Treachery','Torture')],
      requirements:['May only be built in established Villages.','A Whip is required for the single Overseer arrangement.'],
      creates:[building('Dungeon',['Holds up to 200 Slaves with one Overseer using a Whip; prerequisite for some later research.'],{recipe:recipe('Engineering',{item:'Dungeon',quantity:1},400,[{item:'Stone',quantity:2000}],[{name:'Engineering',level:7}]),requirements:['Established Village.','Whip for the Overseer arrangement.'],notes:['May be built for and used by other Clans.']})]
    }),
    t('Engineering','Gate House',6,69,{
      effects:['Adds +2 to effective Archery Skill for defenders in combat.','Gate Houses may be built in other Clans’ villages and used by those Clans.'],
      recipe:recipe('Engineering',{item:'Gate House',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500},{item:'Iron',quantity:100},{item:'Coal',quantity:400}],[],'Gatehouse: People 1250, Stone 5000, Logs 500, Iron 100, Coal 400'),
      requirements:['May only be installed in 20-foot Stone Walls or better.'],
      notes:['The source permits Logs to substitute for Stone at normal building substitution rates, but does not restate that conversion rate here.'],
      leadsTo:[rr('Barbican','Barbican','Engineering')],
      affectsSkills:['Archery'],
      creates:[building('Gate House',['Adds +2 effective Archery to defenders.'],{recipe:recipe('Engineering',{item:'Gate House',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500},{item:'Iron',quantity:100},{item:'Coal',quantity:400}]),requirements:['Install only in 20-foot Stone Walls or better.'],notes:['Logs may substitute for Stone at normal building rates.','May be built for and used by other Clans.']})]
    }),
    t('Engineering','Keep',7,69,{
      effects:['A basic Keep1 uses 4,000 Stone per 1,000 square yards of capacity. Each additional wall layer uses the same Stone quantity again.','Keep capacity uses half normal Village capacity restraints; each 1,000 lb of non-animal/non-person contents requires 5 square yards.','At the start of a combat turn a unit may enter the Keep, but then gives up external buildings and may not return to external defences on subsequent continuous combat turns.','Keeps remain subject to siege.','Keeps may be built at Waystations and may be used there by the Clan that established the Waystation or by a friendly Clan; only one Clan may occupy a single Keep in a turn.','Keeps may be built for other Clans.'],
      recipe:{activity:'Engineering',raw:'Basic Keep1: 4,000 Stone per 1,000 square yards capacity; each additional wall layer uses the same Stone quantity again.'},
      restrictions:['Elephants, Cattle and Goats may not be housed in a Keep.','Capacity calculations apply to the Keep or normal fortified defence, not both.'],
      sourceIssues:['The source recipe line says “will be radically changed”; the current figures are therefore shown as source-current but explicitly flagged as potentially unstable.'],
      creates:[building('Keep',['Fortified capacity structure using 4,000 Stone per 1,000 square yards for the first wall layer; supports a distinct defensive choice in combat.'],{recipe:{activity:'Engineering',raw:'Basic Keep1: 4,000 Stone per 1,000 square yards capacity; each additional layer repeats that Stone requirement.'},restrictions:['No Elephants, Cattle or Goats.','Keep capacity and normal fortified-defence capacity are alternatives, not simultaneous.'],notes:['May be built at Waystations and for other Clans.','Source explicitly flags the recipe for future radical change.']})]
    }),
    t('Engineering','Mining Ladder',5,70,{
      effects:['One Mining Ladder gives +100% Mining output to 10 miners.','One Mining Ladder also gives +100% Digging output to 10 diggers for activities such as Clay, Sand and Moats.','The bonus is cumulative with other implements and additive rather than compounded.'],
      recipe:recipe('Engineering / Mining / Metalwork / Woodwork',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}],'People 15, Wd3, Mtl3, Log 4, Iron 25, Coal 150'),
      notes:['Weight: 50 lb.','The source cross-lists this research under Mining, Metalwork and Woodwork.'],
      affectsSkills:['Mining'],
      relatedSkills:['Woodwork','Metalwork'],
      creates:[item('Mining Ladder',['Provides +100% output to 10 miners and +100% Digging output to 10 diggers; additive with other implements.'],{recipe:recipe('Engineering / Mining / Metalwork / Woodwork',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}]),notes:['Weight: 50 lb.']})]
    }),
    t('Engineering','Outpost',5,70,{
      effects:['An Element with at least 20 Warriors in an Outpost cannot be overrun via Locate and will report Locating scouts.','The Outpost does not allow the garrison to Suppress enemy Scouts.','An Outpost can be Assaulted as a 15-foot Stone Wall or Sieged normally; it may add stronger Stone Walls but may not build towers.','A garrison in an Outpost hex may use 2 additional Scout groups above the normal 8-group limit for its Tribe.'],
      recipe:{activity:'Engineering',output:{item:'Outpost',quantity:1},skills:[{name:'Engineering',level:6},{name:'Stonework',level:5}],inputs:[{item:'Stone',quantity:1000},{item:'Logs',quantity:200}],raw:'Outpost: Eng6, Stn 5 required to build, Sec6 required to use. Stones 1000, Logs 200, at normal install rates.'},
      requirements:['Security 6 is required to use the Outpost.','The garrison must contain at least 20 Warriors for the Locate protection/reporting effect.','Must be within 6 hexes of the main Village.'],
      restrictions:['Clans without the Outpost research may not use the structure.','The Outpost may not build towers.'],
      relatedSkills:['Security','Stonework'],
      creates:[building('Outpost',['Prevents Locate overrun for a qualifying 20-Warrior Element, reports Locating scouts, and allows 2 extra Scout groups.'],{recipe:{activity:'Engineering',output:{item:'Outpost',quantity:1},skills:[{name:'Engineering',level:6},{name:'Stonework',level:5}],inputs:[{item:'Stone',quantity:1000},{item:'Logs',quantity:200}]},requirements:['Security 6 to use.','At least 20 Warriors.','Within 6 hexes of main Village.'],restrictions:['Research required to use.','Cannot build towers.']})]
    }),
    t('Engineering','Sappers I',5,71,{
      effects:['Reduces the effectiveness of enemy defensive fortifications by 5% when deployed.'],
      recipe:{activity:'Sappers deployment',inputs:[{item:'Logs',quantity:500}],labour:'1 Sapper per 20 yards of wall; Sappers are Warriors not engaged in combat',raw:'Uses 500 Logs each time deployed. Requires 1 Sapper per 20 yards wall. Sappers come from Warriors not engaged in combat (beyond the 33%).'},
      leadsTo:[rr('Sappers II','Sappers II','Engineering')],
      requirements:['Uses 500 Logs each time deployed.','Requires 1 Sapper per 20 yards of wall.','Sappers are drawn from Warriors not engaged in combat, described by the source as beyond the 33%.']
    }),
    t('Engineering','Sappers II',7,71,{
      prerequisites:[rr('Sappers I','Sappers I','Engineering')],
      effects:['Increases the Sappers reduction to enemy defensive-fortification effectiveness from 5% to 10%.'],
      recipe:{activity:'Sappers deployment',inputs:[{item:'Logs',quantity:500}],labour:'1 Sapper per 20 yards of wall; Sappers are Warriors not engaged in combat',raw:'Uses 500 Logs each time deployed. Requires 1 Sapper per 20 yards wall.'},
      requirements:['Uses 500 Logs each time deployed.','Requires 1 Sapper per 20 yards of wall.','Sappers are drawn from Warriors not engaged in combat.']
    }),
    t('Engineering','Sewers',8,71,{
      prerequisites:[sr('Sanitation 6','Sanitation'),sr('Engineering 10','Engineering'),{label:'Home City established',type:'site'},{label:'University',entity:'University',type:'building'}],
      effects:['Adds +4 Sanitation during Sieges for affected resident Tribes.','Adds +0.4% population growth, similar to a Hospital.','Sewers serve affected Tribes of one Clan at the site; they affect units in the hex only and do not extend through gt relationships. Fleets are not affected.'],
      recipe:{activity:'Engineering / Stonework',output:{item:'Sewers',quantity:1},people:1250,skills:[{name:'Engineering',level:9},{name:'Sanitation',level:6},{name:'Stonework',level:8}],inputs:[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}],raw:'Sewers: People 1250, Eng 9, San 6, Stn 8, Stones 5000, Logs 500'},
      requirements:['May only be built at sites adjacent to River, Lake, Ocean or Swamp.','Players must tell the GM which Tribes are affected when Sewers are first built, and when long-term resident units arrive or leave the Home City.'],
      restrictions:['Population-growth modifiers from all sources are capped at 1.0% for any one unit.','Short-term visitors do not receive the population modifier.'],
      notes:['At this stage Sewers may not be built in the Autosheet; build via GM Comments and transfer materials to usage (1263).','Sewers may be built for other Clans, but those Clans require Sewers research to use them.'],
      affectsSkills:['Sanitation'],
      relatedSkills:['Stonework'],
      sourceIssues:['The prerequisite block says Engineering 10, while the listed construction recipe says Engineering 9. Both values are preserved.'],
      creates:[building('Sewers',['Adds +4 Sanitation during Sieges and +0.4% population growth for affected long-term resident Tribes.'],{recipe:{activity:'Engineering / Stonework',output:{item:'Sewers',quantity:1},people:1250,skills:[{name:'Engineering',level:9},{name:'Sanitation',level:6},{name:'Stonework',level:8}],inputs:[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}]},requirements:['Adjacent to River, Lake, Ocean or Swamp.','Home City and University requirements are listed by the source.'],restrictions:['Overall population-growth bonus capped at 1.0%.','Fleets and short-term visitors are not affected.'],notes:['Research required to utilise Sewers built by another Clan.']})]
    }),
    t('Engineering','Stone Wall 25’',7,72,{
      effects:['A 25-foot wall layer has 8 Damage Points and the source gives a total wall Damage Point value of 20.','May be built in other Clans’ villages and used by those Clans.'],
      recipe:{activity:'Engineering',output:{item:'Stone Wall 25’',quantity:1},labour:'Per yard',inputs:[{item:'Stone',quantity:75}],raw:'If prior three layers exist: 12 people and 75 Stone per yard. If previous walls do not exist: 30 people and 210 Stone per yard.'},
      requirements:['Normally requires the prior three wall layers to exist.'],
      leadsTo:[rr('Castle','Castle','Politics'),rr('Stone Wall 30’','Stone Wall 30’','Engineering')],
      notes:['If the prior walls do not exist, the source gives 30 people and 210 Stone per yard instead of 12 people and 75 Stone.'],
      creates:[building('Stone Wall 25’',['25-foot wall layer: 8 Damage Points; source total wall Damage Points 20.'],{recipe:{activity:'Engineering',labour:'12 people per yard with prior layers; 30 without',inputs:[{item:'Stone',quantity:75,note:'per yard with prior layers; 210 without'}]},notes:['May be built for and used by other Clans.']})]
    }),
    t('Engineering','Stone Wall 30’',9,73,{
      prerequisites:[rr('Stone Wall 25’','Stone Wall 25’','Engineering')],
      effects:['A 30-foot wall layer has 10 Damage Points and the source gives a total wall Damage Point value of 30.','May be built in other Clans’ villages and used by those Clans.'],
      recipe:{activity:'Engineering',output:{item:'Stone Wall 30’',quantity:1},labour:'Per yard',inputs:[{item:'Stone',quantity:90}],raw:'If 25-foot wall exists: 18 people and 90 Stone per yard. If it does not already exist: 48 people and 300 Stone per yard.'},
      requirements:['Normally requires the prior four wall layers to exist.'],
      notes:['If the 25-foot wall does not exist, the source gives 48 people and 300 Stone per yard instead of 18 people and 90 Stone.'],
      creates:[building('Stone Wall 30’',['30-foot wall layer: 10 Damage Points; source total wall Damage Points 30.'],{recipe:{activity:'Engineering',labour:'18 people per yard with 25-foot wall; 48 without',inputs:[{item:'Stone',quantity:90,note:'per yard with 25-foot wall; 300 without'}]},notes:['May be built for and used by other Clans.']})]
    }),
    t('Engineering','Watchtower',4,73,{
      effects:['Each Watchtower adds 2 percentage points to the chances of Security and Suppressors detecting Spies, Scouts, Raiders and Locating groups.','A Village may have at most 6 Watchtowers.','Each Watchtower requires 2 observers.','Watchtowers may be built in other Clans’ villages and used by those Clans.'],
      recipe:recipe('Engineering',{item:'Watchtower',quantity:1},300,[{item:'Logs',quantity:600}],[{name:'Engineering',level:6}],'Watchtower: People 300, Eng 6, Logs 600'),
      affectsSkills:['Security'],
      creates:[building('Watchtower',['Adds 2 percentage points per tower to Security/Suppressor detection chances for Spies, Scouts, Raiders and Locating groups.'],{recipe:recipe('Engineering',{item:'Watchtower',quantity:1},300,[{item:'Logs',quantity:600}],[{name:'Engineering',level:6}]),requirements:['2 observers per Watchtower.'],restrictions:['Maximum 6 per Village.'],notes:['30 feet high.','May be built for and used by other Clans.']})]
    })
  );

  topics.push(
    t('Excavation','Expert Dig',4,75,{
      effects:['Allows two Artefacts to be dug per turn.','A unit with Expert Dig may carry unlimited Artefacts.'],
      requirements:['Requires 20 people with implements.'],
      leadsTo:[rr('Tomb Robbers','Tomb Robbers','Excavation')]
    }),
    t('Excavation','Holy Artefact',6,75,{
      status:'proposed',
      prerequisites:[rr('Expert Dig','Expert Dig','Excavation')],
      effects:['Once per year the Clan may search for a Holy Artefact at its excavation site.','When found, a Holy Artefact adds +0.05 General Morale to one Tribe in the Clan.','If the Holy Artefact is lost in any way, its morale bonus is removed.','A Holy Artefact may be used in the same way as normal Artefacts and is worth 12 normal Artefacts.'],
      notes:['Weight: 2 lb.','The source marks this topic “Proposed” and attributes it to D Thacker.'],
      sourceIssues:['The source first describes the benefit as +0.05 General Morale, then refers to removal of a “0.05% bonus”. The Compendium preserves the stated +0.05 General Morale effect and flags the inconsistent percent sign.'],
      creates:[item('Holy Artefact',['Adds +0.05 General Morale to one Tribe while retained; counts as 12 normal Artefacts for normal Artefact uses.'],{notes:['Weight: 2 lb.','Research topic is marked Proposed in the source.']})]
    }),
    t('Excavation','Tomb Robbers',7,75,{
      effects:['The Excavation entry does not restate the rules; it directs the reader to the Archaeology Tomb Robbers entry.'],
      relatedSkills:['Archaeology'],
      sourceGaps:['Prerequisite, recipe and description are all printed as “See Archaeology”. The detailed operational rules are therefore held under Archaeology → Tomb Robbers rather than invented here.']
    })
  );

  topics.push(
    t('Farming','Agriculture I',1,77,{
      prerequisites:[rr('Farming 11','Farming 11','Farming')],
      effects:['Adds +2 levels to Farming.','Unlocks the new Group C skill Agriculture. Agriculture exists to access Agriculture IV and later research topics.'],
      leadsTo:[rr('Agriculture II','Agriculture II','Farming')],
      affectsSkills:['Farming'],
      notes:['Books may be written.'],
      creates:[{name:'Agriculture',kind:'skill',researchOnly:true,effects:['Group C research skill unlocked by Agriculture I; used to access Agriculture IV and later research.']}]
    }),
    t('Farming','Agriculture II',2,77,{
      prerequisites:[rr('Agriculture I','Agriculture I','Farming')],
      effects:['Adds +2 levels to Farming.'],
      leadsTo:[rr('Agriculture III','Agriculture III','Farming')],
      affectsSkills:['Farming'],
      notes:['Books may be written.']
    }),
    t('Farming','Agriculture III',3,77,{
      prerequisites:[rr('Agriculture II','Agriculture II','Farming')],
      effects:['Adds +2 levels to Farming.'],
      leadsTo:[rr('Agriculture IV','Agriculture IV','Agriculture')],
      affectsSkills:['Farming'],
      notes:['Books may be written.']
    }),
    t('Farming','Farming 11',5,77,{
      effects:['Adds +1 Farming Skill, taking Farming from 10 to 11.'],
      leadsTo:[rr('Agriculture I','Agriculture I','Farming')],
      affectsSkills:['Farming']
    }),
    t('Farming','Flax',6,78,{
      effects:['Provides an alternative Farming route for producing Cotton.','Best location is flat/temperate terrain. Each person plants 3 acres and harvests 2 acres.','The source states 1 Flax = 1 Cotton and that harvest returns should automatically convert Flax to Cotton.','A Scythe doubles the acres harvested for Flax.'],
      leadsTo:[rr('Oilmill','Oilmill','Milling')],
      notes:['Weight: 1 lb.'],
      relatedSkills:['Milling'],
      creates:[item('Flax',['Farming crop used as an alternative method of producing Cotton; harvested Flax is automatically converted to Cotton.'],{notes:['Best on flat/temperate terrain.','1 lb weight as listed by the source.','Scythe doubles harvested acreage.']})]
    })
  );

  R.registerBatch({
    id:'research-02-cheesemaking-farming',
    title:'Batch 2 · Cheesemaking through Farming',
    pages:'51–78',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Cheesemaking','Combat','Cooking','Dance','Diplomacy','Distilling','Economics','Engineering','Excavation','Farming'],
    topics
  });
})();

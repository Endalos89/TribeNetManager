(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 07');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const sr = (label, skill) => ({ label, skill: skill || label, type:'skill' });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const ship = (name, effects=[], extra={}) => ({ name, kind:'ship', effects, ...extra });
  const skillEntity = (name, effects=[], extra={}) => ({ name, kind:'skill', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  // Rowing
  topics.push(
    t('Rowing','Rowing 11',5,158,{
      effects:['Raises Rowing by +1, for example from Rowing 10 to Rowing 11.'],
      affectsSkills:['Rowing']
    })
  );

  // Sailing
  topics.push(
    t('Sailing','Expert Sailors 1',6,159,{
      effects:['Adds +3 Seamanship and +3 Navigation.','The bonus does not become active until the unit has at least Navigation 10 and Seamanship 10.'],
      leadsTo:[rr('Professional Sailor','Professional Sailor','Mariner')],
      requirements:['Navigation must be at least 10 and Seamanship must be at least 10 before the bonus activates.','If those levels are reached after the research was completed, the player must notify the GM.'],
      affectsSkills:['Seamanship','Navigation'],
      relatedSkills:['Mariner'],
      sourceIssues:['The source says “Professional Sailors” in Leads To, while the Mariner topic is titled “Professional Sailor”.']
    }),
    t('Sailing','Raincatching',3,159,{
      effects:['Adds the Gather / Rain activity while at sea.','Gather / Rain fills water equal to 25% of the fleet’s total container capacity each turn.'],
      requirements:['The fleet needs 5 Cloth per ship/boat for full output; with less Cloth, water gathered is reduced proportionately.','2 crew members per ship/boat must be assigned to catching rain and may perform no other work.'],
      notes:['Weather does not change the amount of water gathered.','The player is responsible for calculating capacity, transferring the Water from usage (1263), and adding a Comment explaining the action.']
    }),
    t('Sailing','Sailing 11',5,160,{
      effects:['Raises Sailing by +1.'],
      affectsSkills:['Sailing']
    }),
    t('Sailing','Two Hex Ferry',4,160,{
      effects:['Allows a ferry to operate across two hexes of Ocean and/or Lake.','A two-hex ferry trip costs 16 MP instead of the normal 8 MP one-hex trip.'],
      notes:['All normal ferry rules continue to apply.'],
      relatedSkills:['Navigation']
    })
  );

  // Salting
  topics.push(
    t('Salting','Salt Panning',6,161,{
      effects:['Creates a Salt Mine in one Prairie hex chosen by the Clan.'],
      restrictions:['The chosen hex cannot already contain a Village.','A Village may not later be built on the Salt Mine site.'],
      creates:[building('Salt Mine',['A Prairie resource site created by Salt Panning research.'],{restrictions:['Cannot be an existing Village site and cannot later become a Village site.']})]
    })
  );

  // Sanitation
  topics.push(
    t('Sanitation','Camp Sanitation',6,162,{
      effects:['Allows a Tribe or Element to provide Sanitation workers to other same-Clan Tribes, Elements, Villages, Garrisons or Fleets in the same hex.','Supported units are treated as having the same Sanitation skill as the supplying Tribe and also receive that Tribe’s Sanitation research benefits.'],
      requirements:['Sanitation workers must equal 0.5% of the total population of the supported units.','Workers may be Actives, Warriors or Slaves from the supplying Tribe or its Elements.','All supplying and supported units must belong to the same Clan and be in the same hex.'],
      restrictions:['Neither the supplying unit nor any supported unit may move during the turn.','The shared Sanitation does not affect population growth.'],
      notes:['The supported units are identified in the Notes field of the Sanitation activity.'],
      affectsSkills:['Sanitation']
    }),
    t('Sanitation','Sewers',8,162,{
      prerequisites:[sr('Sanitation 6','Sanitation'),sr('Engineering 10','Engineering'),{label:'Home City established'},{label:'University',type:'building',entity:'University'}],
      effects:['Sewers give +4 Sanitation during Sieges.','Sewers improve population growth by +0.4%, similar to a Hospital.','Sewers serve long-term resident Tribes of one Clan at the site.'],
      recipe:recipe('Engineering / Stonework',{item:'Sewers',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}],[{name:'Engineering',level:9},{name:'Sanitation',level:6},{name:'Stonework',level:8}],'People 1250, Eng 9, San 6, Stn 8, Stones 5000, Logs 500'),
      requirements:['May only be built at a site adjacent to River, Lake, Ocean or Swamp.','Research requires Sanitation 6, Engineering 10, an established Home City and a University.','The player must tell the GM which long-term resident Tribes are covered and when long-term residents enter or leave.'],
      restrictions:['Short-term occupants do not receive the population-growth modifier.','Sewers cannot currently be built in Autosheet; materials are transferred to usage (1263) and construction is handled through GM Comments.','Other Clans may have Sewers built for them but require Sewers research to use them.'],
      sourceIssues:['Research prerequisites require Engineering 10, while the construction recipe itself lists Engineering 9.'],
      affectsSkills:['Sanitation'],
      relatedSkills:['Engineering','Stonework'],
      creates:[building('Sewers',['+4 Sanitation during Sieges.','+0.4% population growth for covered long-term residents.'],{recipe:recipe('Engineering / Stonework',{item:'Sewers',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}],[{name:'Engineering',level:9},{name:'Sanitation',level:6},{name:'Stonework',level:8}]),requirements:['Adjacent River, Lake, Ocean or Swamp.'],restrictions:['Research is required to use Sewers, including Sewers built by another Clan.']})]
    })
  );

  // Scouting
  topics.push(
    t('Scouting','Extra Movement 1',4,164,{
      effects:['One selected scouting unit in the Tribe gains +2 MV for Scout movement.'],
      leadsTo:[rr('Extra Movement 2','Extra Movement 2','Scouting')],
      restrictions:['The modifier can be applied to only one unit in the Tribe with the research.'],
      notes:['When Elements are created, the modifier may need to be added manually and the player should notify the GM.']
    }),
    t('Scouting','Extra Movement 2',4,164,{
      prerequisites:[rr('Extra Movement 1','Extra Movement 1','Scouting')],
      effects:['The selected scouting unit gains a further +2 MV, for +4 MV total from Extra Movement 1 and 2.'],
      restrictions:['The modifier can be applied to only one unit in the Tribe with the research.']
    }),
    t('Scouting','Ranger I',1,164,{
      effects:['Adds +1 Scouting level, for example Scouting 10 to 11.','Unlocks the new Group C skill Ranger.'],
      leadsTo:[rr('Ranger II','Ranger II','Scouting')],
      affectsSkills:['Scouting'],
      relatedSkills:['Ranger'],
      creates:[skillEntity('Ranger',['Group C research-access skill unlocked by Ranger I.','Ranger skill is used to access Ranger IV and higher research.'])]
    }),
    t('Scouting','Ranger II',2,164,{
      prerequisites:[rr('Ranger I','Ranger I','Scouting')],
      effects:['Adds +3 Scouting levels, with the source example moving Scouting 11 to 14.'],
      leadsTo:[rr('Ranger III','Ranger III','Scouting')],
      affectsSkills:['Scouting'],
      relatedSkills:['Ranger'],
      sourceIssues:['The source prerequisite text calls Ranger II prerequisite “Ranger 1 (Seeking research)” even though the entry is in the Scouting section.']
    }),
    t('Scouting','Ranger III',3,164,{
      prerequisites:[rr('Ranger II','Ranger II','Scouting')],
      effects:['Adds +5 Scouting levels, with the source example moving Scouting 14 to 19.'],
      leadsTo:[rr('Ranger IV','Ranger IV','Ranger')],
      requirements:['Ranger skill must reach level 10 before Ranger IV and higher can be researched.'],
      affectsSkills:['Scouting'],
      relatedSkills:['Ranger'],
      sourceIssues:['The source prerequisite text calls Ranger III prerequisite “Ranger II (Seeking research)” even though the entry is in the Scouting section.']
    }),
    t('Scouting','Scout Veterans',5,165,{
      effects:['Adds +2 Scouting.'],
      affectsSkills:['Scouting']
    }),
    t('Scouting','Scouting 11',5,165,{
      effects:['Adds +1 Scouting, for example Scouting 10 to 11.'],
      notes:['The source says there is currently no benefit for Scouting above 10.'],
      affectsSkills:['Scouting']
    })
  );

  // Seamanship
  topics.push(
    t('Seamanship','Fleet Movement 4',4,167,{
      effects:['Fleets gain +4 MV.'],
      leadsTo:[rr('Fleet Movement 6','Fleet Movement 6','Seamanship')],
      restrictions:['Applies to Fleets only; it does not apply to Tribes, Elements or Couriers.','To Limit movement will try to use the full modified movement allowance, so explicit directions should be used when stopping early is important.'],
      notes:['Also available via Administration.','The source advises checking with the GM regarding coding.']
    }),
    t('Seamanship','Fleet Movement 6',4,167,{
      prerequisites:[rr('Fleet Movement 4','Fleet Movement 4','Seamanship')],
      effects:['Adds a further +2 Fleet MV, for +6 MV total with Fleet Movement 4.'],
      restrictions:['Applies to Fleets only; it does not apply to Tribes, Elements or Couriers.','To Limit movement will try to use the full modified movement allowance, so explicit directions should be used when stopping early is important.'],
      notes:['Also available via Administration.','The source advises checking with the GM regarding coding.']
    }),
    t('Seamanship','Seamanship 11',5,168,{
      effects:['Raises Seamanship to level 11.'],
      leadsTo:[rr('Heart of Oak','Heart of Oak','Navigation'),rr('Heart of Oak','Heart of Oak','Sailing'),rr('Heart of Oak','Heart of Oak','Seamanship')],
      affectsSkills:['Seamanship']
    })
  );

  // Security
  topics.push(
    t('Security','Outpost',5,169,{
      effects:['An Element with at least 20 Warriors at an Outpost cannot be overrun via Locate and will report Locating scouts.','A Garrison at an Outpost may use 2 additional scouting groups above the normal limit of 8.','For combat, an Outpost may be Assaulted as a 15 Stone Wall or Sieged normally.'],
      recipe:recipe('Construction',{item:'Outpost',quantity:1},null,[{item:'Stone',quantity:1000},{item:'Logs',quantity:200}],[{name:'Engineering',level:6},{name:'Stonework',level:5}],'Eng 6, Stn 5 required to build; Security 6 required to use; Stones 1000, Logs 200 at normal install rates'),
      requirements:['Security 6 is required to use the Outpost.','The Outpost must be within 6 hexes of the main Village.','At least 20 Warriors are required for the anti-overrun / scout-reporting benefit.'],
      restrictions:['An Outpost does not allow its garrison to Suppress enemy Scouts.','It cannot build towers, though it may build 20-foot etc. Stone Walls for stronger protection.','Clans without the Outpost research may not use the structure.'],
      creates:[building('Outpost',['Prevents a qualifying garrison from being overrun via Locate and reports Locating scouts.','Allows +2 scout groups over the normal limit.','Counts as a 15 Stone Wall for Assault unless further walls are built.'],{recipe:recipe('Construction',{item:'Outpost',quantity:1},null,[{item:'Stone',quantity:1000},{item:'Logs',quantity:200}],[{name:'Engineering',level:6},{name:'Stonework',level:5}]),requirements:['Security 6 to use; within 6 hexes of main Village; 20+ Warriors for anti-overrun benefit.'],restrictions:['Research required to use.']})]
    }),
    t('Security','Security 11',5,169,{
      effects:['Adds +1 Security, for example Security 10 to 11.'],
      leadsTo:[rr('Security Patrol','Security Patrol','Security')],
      affectsSkills:['Security']
    }),
    t('Security','Security Patrol',4,170,{
      prerequisites:[rr('Security 11','Security 11','Security')],
      effects:['Increases the chance of detecting Scouts using Raid or Locate by 3 percentage points per Security level; at Security 11 the source example is +33%.'],
      affectsSkills:['Security']
    })
  );

  // Seeking
  topics.push(
    t('Seeking','Bush Lore I',1,172,{
      effects:['Adds +1 Seeking level, for example Seeking 10 to 11.','Unlocks the new Group C skill Bush Lore.'],
      leadsTo:[rr('Bush Lore II','Bush Lore II','Seeking')],
      affectsSkills:['Seeking'],
      relatedSkills:['Bush Lore'],
      creates:[skillEntity('Bush Lore',['Group C research-access skill unlocked by Bush Lore I.','Bush Lore skill is used to access Bush Lore IV and higher research.'])]
    }),
    t('Seeking','Bush Lore II',2,172,{
      prerequisites:[rr('Bush Lore I','Bush Lore I','Seeking')],
      effects:['Adds +3 Seeking levels, with the source example moving Seeking 11 to 14.'],
      leadsTo:[rr('Bush Lore III','Bush Lore III','Seeking')],
      affectsSkills:['Seeking'],
      relatedSkills:['Bush Lore']
    }),
    t('Seeking','Bush Lore III',3,172,{
      prerequisites:[rr('Bush Lore II','Bush Lore II','Seeking')],
      effects:['Adds +5 Seeking levels, with the source example moving Seeking 14 to 19.'],
      leadsTo:[rr('Bush Lore IV','Bush Lore IV','Bush Lore')],
      requirements:['Bush Lore must reach level 10 before Bush Lore IV and higher may be researched.'],
      affectsSkills:['Seeking'],
      relatedSkills:['Bush Lore']
    }),
    t('Seeking','Exotic Seekers',5,173,{
      effects:['Creates an Exotic Seeking destination 45–60 MV away where normal Seeking rules apply and combat is possible.','The player chooses 4 desired Commodities from the 21-item pool, but only one may be the Clan’s Desired Commodity; the GM chooses another 4 and excludes the Clan’s second Desired Commodity.','The 8 commodities cycle over two years, with four available each year.'],
      leadsTo:[rr('Exotic Seekers II','Exotic Seekers II','Seeking')],
      requirements:['The player must flag the designated Exotic Seeking hex in orders when using the boosted returns.']
    }),
    t('Seeking','Exotic Seekers II',2,173,{
      prerequisites:[rr('Exotic Seekers','Exotic Seekers','Seeking'),rr('Experienced Seekers','Experienced Seekers','Seeking')],
      effects:['Adds +2 Exotic Seeking items, increasing the number available from 4 to 6.'],
      leadsTo:[rr('Exotic Seekers III','Exotic Seekers III','Seeking')],
      notes:['The player must identify Exotic Seeking finds in the Transfer summary from the Seeking table.']
    }),
    t('Seeking','Exotic Seekers III',6,173,{
      prerequisites:[rr('Exotic Seekers II','Exotic Seekers II','Seeking')],
      effects:['Adds a further +2 Exotic Seeking items, increasing the number available to 8.'],
      notes:['The player must identify Exotic Seeking finds in the Transfer summary from the Seeking table.']
    }),
    t('Seeking','Experienced Seekers',2,173,{
      effects:['If the Tribe Seeks the same item in the same hex as the previous year, its Seeking return for that item is doubled.','The bonus also works in Rich Seeking special hexes.'],
      leadsTo:[rr('Exotic Seekers','Exotic Seekers','Seeking')],
      requirements:['The same item must have been sought in the same hex in the previous year; the amount sought previously does not matter.','Recent Seeking history for the hex must be shown below the line in GM Actions.']
    }),
    t('Seeking','Seek Herbs',1,174,{
      sourceGaps:['The Seeking section does not restate a DL, prerequisites, recipe or effect; it directs the player to the Healing version of Seek Herbs for all rules.'],
      relatedSkills:['Healing']
    }),
    t('Seeking','Seek Population',4,174,{
      effects:['When Seeking produces Actives, the Tribe also gains an equal number of Inactives.']
    }),
    t('Seeking','Seeking 11',5,174,{
      effects:['Adds +1 Seeking, for example Seeking 10 to 11.'],
      affectsSkills:['Seeking']
    }),
    t('Seeking','Expert Trackers',5,175,{
      prerequisites:[rr('Trackers','Trackers','Seeking'),sr('Seeking 10','Seeking')],
      effects:['Adds a further +10% Seeking return, taking Trackers + Expert Trackers to +20% total.','Adds +5% Hunting return.'],
      leadsTo:[rr('Veteran Trackers','Veteran Trackers','Seeking')],
      notes:['The player must manually add the extra Seeking output to transfers and the extra Hunting output to orders according to the source instructions.'],
      affectsSkills:['Seeking','Hunting'],
      relatedSkills:['Hunting'],
      sourceIssues:['The source prerequisite calls Trackers “Hunting research”, while the Trackers entry itself appears in the Seeking section and leads to Expert Trackers as Seeking research.']
    }),
    t('Seeking','Trackers',5,176,{
      effects:['Adds +10% to Seeking returns, rounded up.'],
      leadsTo:[rr('Expert Trackers','Expert Trackers','Seeking')],
      notes:['TN Classic requires the player to add the extra Seeking output manually; TN3 is stated to add the percentage automatically.'],
      affectsSkills:['Seeking']
    }),
    t('Seeking','Veteran Trackers',5,176,{
      prerequisites:[rr('Expert Trackers','Expert Trackers','Seeking'),rr('Seeking 11','Seeking 11','Seeking')],
      effects:['Adds another +10% Seeking return, taking Trackers + Expert Trackers + Veteran Trackers to +30% total.','Adds another +5% Hunting return, taking Expert Trackers + Veteran Trackers to +10% Hunting total.'],
      notes:['The player must manually add the extra Seeking output to transfers and the extra Hunting output to orders according to the source instructions.'],
      affectsSkills:['Seeking','Hunting'],
      relatedSkills:['Hunting']
    })
  );

  // Sewing
  topics.push(
    t('Sewing','Brocade',5,178,{
      prerequisites:[sr('Sewing 10','Sewing')],
      effects:['Unlocks Brocade as a high-value trade good sold for Gold and other valuable commodities at NPC towns rather than at Fair.','The source says 10 Brocade sells for around 5 Gold.'],
      recipe:recipe('Sewing',{item:'Brocade',quantity:10},2,[{item:'Silk',quantity:10},{item:'Cotton',quantity:100}],[{name:'Weaving',level:4},{name:'Sewing',level:10}],'10 Brocade: People 2, Wv 4, Sew 10, Silk 10, Cotton 100'),
      restrictions:['Only 2 people per Tribe with Sewing 10 may produce Brocade each month.'],
      notes:['Weight: 10 lb for the produced batch as stated by the source.','The source says Loom development will markedly improve efficiency.','The entry is marked “To be modified”.'],
      creates:[item('Brocade',['Trade good sold at NPC towns for Gold / valuable commodities rather than at Fair.'],{recipe:recipe('Sewing',{item:'Brocade',quantity:10},2,[{item:'Silk',quantity:10},{item:'Cotton',quantity:100}],[{name:'Weaving',level:4},{name:'Sewing',level:10}]),restrictions:['Only 2 people per Tribe with Sewing 10 may produce Brocade each month.'],notes:['Source benchmark: 10 Brocade sells for around 5 Gold.','Source marks the topic “To be modified”.']})]
    }),
    t('Sewing','Command Tent',6,178,{
      effects:['Allows Command Tents to be crafted via the Armour activity.','A side using enough Command Tents gains +1 Leadership Modifier for all participants.','If at least one participating unit has completed Command Tent research, all participants on that side also gain +2 Tactics for the combat.'],
      recipe:recipe('Armour',{item:'Command Tent',quantity:1},10,[{item:'Cloth',quantity:10},{item:'Logs',quantity:2},{item:'Iron',quantity:1},{item:'Coal',quantity:5},{item:'Silk',quantity:2}],[{name:'Sewing',level:10}],'1 Command Tent: People 10, Sew 10, Cloth 10, Log 2, Iron 1, Coal 5, Silk 2'),
      requirements:['1 Command Tent is required per 100 Warriors participating in combat; with fewer tents, the bonuses are reduced proportionately.'],
      restrictions:['If a unit using Command Tents is routed and the enemy is not, 100% of the Command Tents used are captured as Spoils.'],
      notes:['Any unit, Tribe or Clan may use Command Tents, but the +2 Tactics benefit requires at least one participating unit with the research.','Weight: 200 lb.'],
      affectsSkills:['Leadership','Tactics'],
      creates:[item('Command Tent',['Provides +1 Leadership Modifier to the using side when supplied at the required ratio.','Provides +2 Tactics when a participating unit knows Command Tent research.'],{recipe:recipe('Armour',{item:'Command Tent',quantity:1},10,[{item:'Cloth',quantity:10},{item:'Logs',quantity:2},{item:'Iron',quantity:1},{item:'Coal',quantity:5},{item:'Silk',quantity:2}],[{name:'Sewing',level:10}]),requirements:['1 per 100 participating Warriors for full benefit.'],restrictions:['Used tents are all captured if the using unit is routed and the enemy is not.'],notes:['Weight: 200 lb.']})]
    })
  );

  // Shipbuilding
  topics.push(
    t('Shipbuilding','Felucca Class I',6,180,{
      effects:['Unlocks Felucca Class I, a fast light ship.','Base movement is 58 MV under sail and 54 MV under oars.','Its movement bonus applies only when the fleet is composed entirely of Feluccas.'],
      recipe:recipe('Shipbuilding',{item:'Felucca Class I',quantity:1},215,[{item:'Logs',quantity:250},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'People 215, ShB8, Wdw8, Mtl6, Logs 250, Brass 75, Coal 300, Sheath 200, Leather 50, Rope 15, Cloth 40, Oars'),
      leadsTo:[rr('Felucca Class II','Felucca Class II','Shipbuilding')],
      notes:['Weight: 18,000 lb. No ram.','Sail modifiers: Navigation 3, Seamanship 2, Sailing 4; sail crew 10 (8+2).','Row modifiers: Navigation 1, Seamanship 1, Rowing 2; row crew 34 (32+2).','Maximum people: 45. Base cargo: 7,500. MEF 6. Hull damage points 30; Sail damage points 25; Defense points 15.','Cannot carry Catapults but may carry Ballistae.'],
      sourceGaps:['The source requires Oars but does not state an Oar quantity for Felucca Class I.'],
      creates:[ship('Felucca Class I',['58 MV Sail / 54 MV Row.','Fast Felucca movement bonus applies only to all-Felucca fleets.'],{recipe:recipe('Shipbuilding',{item:'Felucca Class I',quantity:1},215,[{item:'Logs',quantity:250},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}]),notes:['Weight 18,000; max people 45; base cargo 7,500; MEF 6; defense 15; hull 30; sails 25.','No ram; Ballistae allowed; Catapults not allowed.']})]
    }),
    t('Shipbuilding','Felucca Class II',2,180,{
      prerequisites:[rr('Felucca Class I','Felucca Class I','Shipbuilding')],
      effects:['Upgrades Felucca base movement to 66 MV under sail and 62 MV under oars.'],
      notes:['The source presents Class II as a research upgrade following Class I and does not provide a separate construction recipe.'],
      sourceGaps:['No separate Class II construction recipe or changed non-movement statistics are provided.']
    }),
    t('Shipbuilding','Felucca Class III',3,181,{
      prerequisites:[rr('Felucca Class II','Felucca Class II','Shipbuilding')],
      effects:['Unlocks / upgrades Felucca Class III to 74 MV Sail and 70 MV Row.'],
      recipe:recipe('Shipbuilding',{item:'Felucca Class III',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Oak',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'Oak version',[
        recipe('Shipbuilding',{item:'Felucca Class III',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Mahogany',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'Mahogany version')
      ]),
      leadsTo:[rr('Felucca Class IV','Felucca Class IV','Shipbuilding')],
      notes:['Damage: Hull 35, Sails 30. Defense 36.','Sail crew 10 (9+2) as printed by source; Row crew 34 (32+2).','Maximum people 45; base cargo 8,000; weight 16,000. No ram.','Cannot carry Catapults but may carry Ballistae.'],
      sourceIssues:['The source says Sail crew “10 (9+2)”; 9+2 equals 11. The Compendium preserves the printed values rather than correcting them.'],
      creates:[ship('Felucca Class III',['74 MV Sail / 70 MV Row.'],{recipe:recipe('Shipbuilding',{item:'Felucca Class III',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Oak',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'',[
        recipe('Shipbuilding',{item:'Felucca Class III',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Mahogany',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}])
      ]),notes:['Defense 36; Hull 35; Sails 30; max people 45; cargo 8,000; weight 16,000; no ram.']})]
    }),
    t('Shipbuilding','Felucca Class IV',4,181,{
      prerequisites:[rr('Felucca Class III','Felucca Class III','Shipbuilding')],
      effects:['Unlocks / upgrades Felucca Class IV to 82 MV Sail and 78 MV Row.'],
      recipe:recipe('Shipbuilding',{item:'Felucca Class IV',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Oak',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'Oak version',[
        recipe('Shipbuilding',{item:'Felucca Class IV',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Mahogany',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'Mahogany version')
      ]),
      notes:['Damage: Hull 40, Sails 32. Defense 40.','Sail crew 12 (9+3); Row crew 35 (32+3).','Maximum people 50; base cargo 9,500; weight 15,000. No ram.','Sail modifiers: Navigation 3, Seamanship 2, Sailing 4. Row modifiers: Navigation 1, Seamanship 1, Rowing 2.','Cannot carry Catapults but may carry Ballistae.'],
      creates:[ship('Felucca Class IV',['82 MV Sail / 78 MV Row.'],{recipe:recipe('Shipbuilding',{item:'Felucca Class IV',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Oak',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}],'',[
        recipe('Shipbuilding',{item:'Felucca Class IV',quantity:1},215,[{item:'Logs',quantity:150},{item:'Brass',quantity:75},{item:'Coal',quantity:300},{item:'Sheath',quantity:200},{item:'Leather',quantity:50},{item:'Rope',quantity:15},{item:'Cloth',quantity:40},{item:'Mahogany',quantity:100}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:6}])
      ]),notes:['Defense 40; Hull 40; Sails 32; max people 50; cargo 9,500; weight 15,000; no ram.']})]
    }),
    t('Shipbuilding','Frigate',8,182,{
      effects:['Unlocks the Frigate, a sail-only warship.','A Frigate may deploy up to 12 Naval Cannons.'],
      recipe:recipe('Shipbuilding',{item:'Frigate',quantity:1},243,[{item:'Logs',quantity:850},{item:'Brass',quantity:175},{item:'Coal',quantity:900},{item:'Sheath',quantity:600},{item:'Leather',quantity:250},{item:'Cloth',quantity:150},{item:'Rope',quantity:100},{item:'Oak',quantity:50},{item:'Coin',quantity:500}],[{name:'Shipbuilding',level:10},{name:'Woodwork',level:9},{name:'Metalwork',level:9}],'People 243, ShB10, Wdw9, Mtl9, Logs 850, Brass 175, Coal 900, Sheath 600, Leather 250, Rope 100, Cloth 150, Coin 500, Oak 50'),
      requirements:['Requires a Jetty to dock.'],
      restrictions:['No Row movement is allowed, so no Oars or Paddles are required.'],
      notes:['Source explicitly lists Defense Points 160, Hull Damage Rating 80 and Cargo 25,000.','The source table also lists Sail movement 50 and maximum people 180.'],
      sourceGaps:['Several compact stat-table columns are difficult to reconstruct reliably from the extracted text; the Compendium records the clearly stated stats and preserves the source rather than inferring unclear columns.'],
      creates:[ship('Frigate',['Sail-only warship able to deploy up to 12 Naval Cannons.'],{recipe:recipe('Shipbuilding',{item:'Frigate',quantity:1},243,[{item:'Logs',quantity:850},{item:'Brass',quantity:175},{item:'Coal',quantity:900},{item:'Sheath',quantity:600},{item:'Leather',quantity:250},{item:'Cloth',quantity:150},{item:'Rope',quantity:100},{item:'Oak',quantity:50},{item:'Coin',quantity:500}],[{name:'Shipbuilding',level:10},{name:'Woodwork',level:9},{name:'Metalwork',level:9}]),requirements:['Jetty required to dock.'],restrictions:['No Row movement.'],notes:['Defense 160; Hull damage 80; Cargo 25,000; Sail movement 50; max people 180.']})]
    }),
    t('Shipbuilding','Shipbuilding 11',4,183,{
      effects:['Increases Shipbuilding output by 10%.','The extra output is represented by Auxiliaries equal to 10% of the actual workers assigned.'],
      requirements:['Additional Shipyards are required to cover the increased effective output.'],
      restrictions:['Tools, where applicable, may only be applied to the original workers, not the efficiency Auxiliaries.'],
      affectsSkills:['Shipbuilding']
    }),
    t('Shipbuilding','Whaler',6,183,{
      effects:['Unlocks the Whaler.','A Whaler increases the size of a whale catch but does not increase the chance of finding whales.','Allows whales to be processed at sea using 2 Cauldrons and the crew Tribe’s peeling, flensing and blubbering skills.'],
      recipe:recipe('Shipbuilding',{item:'Whaler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheath',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:40},{item:'Cloth',quantity:20},{item:'Rope',quantity:50},{item:'Cauldron',quantity:2},{item:'Longboat',quantity:6}],[{name:'Shipbuilding',level:9},{name:'Woodwork',level:8},{name:'Metalwork',level:8}],'People 160, ShB9, Wdw8, Mtl8, Logs 160, Brass 40, Coal 200, Sheath 150, Silver 3000, Leather 40, Cloth 20, Rope 50, Oars, Cauldrons 2, Longboats 6 minimum (11 maximum), Oars 6 per longboat, Spear/Spetum 3 per longboat minimum'),
      requirements:['At least 6 Longboats are required; the source allows up to 11.','Each Longboat requires 6 Oars and at least 3 Spears/Spetums.','2 Cauldrons are required for at-sea processing.','The using unit must hold a Whaling licence.'],
      notes:['Defense Points 16; Cargo 40,000; Weight 20,000.','Source table lists Sail movement 25 and Row movement 15, maximum people 60.'],
      sourceIssues:['The prose recipe requires Metalwork 8, while the compact stat table prints Metalwork 5. The Compendium preserves the prose recipe and flags the discrepancy.','The source includes a general Oars requirement for the Whaler as well as 6 Oars per Longboat; a separate hull-Oar quantity is not clearly stated.'],
      creates:[ship('Whaler',['Increases whale catch size and supports at-sea processing.'],{recipe:recipe('Shipbuilding',{item:'Whaler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheath',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:40},{item:'Cloth',quantity:20},{item:'Rope',quantity:50},{item:'Cauldron',quantity:2},{item:'Longboat',quantity:6}],[{name:'Shipbuilding',level:9},{name:'Woodwork',level:8},{name:'Metalwork',level:8}]),requirements:['Whaling licence; 6–11 Longboats; 6 Oars and at least 3 Spears/Spetums per Longboat; 2 Cauldrons.'],notes:['Defense 16; Cargo 40,000; Weight 20,000; max people 60.']})]
    })
  );

  R.registerBatch({
    id:'research-v2-batch-07',
    title:'Batch 7 · Rowing through Shipbuilding',
    pages:'158–184',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Rowing','Sailing','Salting','Sanitation','Scouting','Seamanship','Security','Seeking','Sewing','Shipbuilding'],
    topics
  });
})();
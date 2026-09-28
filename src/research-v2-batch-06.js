(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 06');
  const t=(skill,name,dl,page,extra={})=>({skill,name,dl:String(dl),page,...extra});
  const rr=(label,topic,skill)=>({label,topic:topic||label,type:'research',...(skill?{skill}:{})});
  const sr=(label,skill)=>({label,skill:skill||label,type:'skill'});
  const item=(name,effects=[],extra={})=>({name,kind:'item',effects,...extra});
  const building=(name,effects=[],extra={})=>({name,kind:'facility',effects,...extra});
  const recipe=(activity,output,people,inputs=[],skills=[],raw='',variants=[])=>({activity,output,people,inputs,skills,raw,variants});
  const topics=[];

  // Mobilisation
  topics.push(
    t('Mobilisation','Militia Mobilisation',4,129,{
      effects:['In controlled hexes, increases the number of Locals mobilised for defence from 20 per hex to 25 per hex.','The mobilised Locals retain their normal combat skills unless another rule or research changes them.'],
      affectsSkills:['Mobilisation']
    }),
    t('Mobilisation','Mobilisation 11',5,129,{
      effects:['Raises the mobilisation rate from 30% at Mobilisation 10 to 33% of available Warriors.'],
      affectsSkills:['Mobilisation']
    })
  );

  // Music
  topics.push(
    t('Music','Bagpipes',4,130,{
      prerequisites:[rr('Military Band','Military Band','Music')],
      effects:['When every member of the active Military Band is equipped with Bagpipes, the Military Morale bonus rises by a further +0.02, taking the Military Band bonus from +0.04 to +0.06.'],
      recipe:recipe('Sewing',{item:'Bagpipes',quantity:1},1,[{item:'Bladders',quantity:2},{item:'Flute',quantity:1}],[{name:'Sewing',level:5}],'1 Bagpipes: People 1, Sew5, Bladders 2, Flute 1'),
      requirements:['Each participating Military Band member must be equipped with Bagpipes for the additional +0.02 bonus.'],
      notes:['Weight: 6 lb.'],
      creates:[item('Bagpipes',['Increase an active Military Band’s Military Morale bonus by +0.02, from +0.04 to +0.06, when all band members are equipped.'],{recipe:recipe('Sewing',{item:'Bagpipes',quantity:1},1,[{item:'Bladders',quantity:2},{item:'Flute',quantity:1}],[{name:'Sewing',level:5}]),requirements:['One set of Bagpipes per participating Military Band member.'],notes:['Weight: 6 lb.']})]
    }),
    t('Music','Military Band',4,130,{
      effects:['An active Military Band gives all participating units from the same Clan +0.04 Military Morale for that combat.'],
      leadsTo:[rr('Bagpipes','Bagpipes','Music')],
      requirements:['A participating unit belonging to the Tribe with Military Band research must assign 20–30 Actives to the band.','Every band member must have an instrument; drums, horns, flutes, trumpets, harps and lutes are examples, and any mixture is allowed.'],
      restrictions:['The benefit does not extend to allied units from other Clans.','A unit can benefit from only one Military Band in a battle, regardless of how many bands or Tribes are present.'],
      notes:['The source says there is currently no additional benefit for a band larger than 20 Actives.','Until directly supported in orders, leave the 20–30 Actives unassigned and explain the band and instruments in Comments.']
    }),
    t('Music','Music in the Field',7,131,{
      prerequisites:[rr('Military Band','Military Band','Music'),rr('Generalship','Generalship','Leadership')],
      effects:['In Land Combat, qualifying units gain +1 effective Leadership, +2 effective Tactics and a further +0.04 Military Morale for the duration of combat.','In Naval Combat, qualifying units gain +1 effective Captaincy, +2 effective Tactics and a further +0.04 Military Morale for the duration of combat.'],
      requirements:['Allocate 5 Warriors to Music in the Field for every 100 Warriors participating in the battle.','Every Warrior allocated to Music in the Field must have a Drum.'],
      notes:['The extra Warriors assigned to Music in the Field do not count against the one-third limit.','The source notes that increases to Leadership Modifier have diminishing effect at higher Leadership, but Leadership Modifier increases always affect Potential Casualties.'],
      affectsSkills:['Leadership','Tactics','Captaincy']
    }),
    t('Music','Spring Arts Festival Music','*See Art',132,{
      effects:['Uses the rules of Spring Arts Festival Art to host a Festival during Fair and raise Morale.'],
      prerequisites:[{label:'See Spring Arts Festival Art',type:'research',topic:'Spring Arts Festival Art',skill:'Art'}],
      leadsTo:[rr('Inter Spring Arts Festival Music','Inter Spring Arts Festival Music','Music')],
      relatedSkills:['Art'],
      sourceGaps:['This Music entry delegates its DL, prerequisite, recipe and detailed effects to the Art version rather than repeating them.']
    }),
    t('Music','Inter Spring Arts Festival Music',8,132,{
      prerequisites:[rr('Spring Arts Festival Music','Spring Arts Festival Music','Music'),sr('Administration 10','Administration')],
      effects:['Extends Spring Arts Festival Music so Tribes from other Clans may participate.'],
      recipe:recipe('Engineering',{item:'Amphitheatre',quantity:1},2000,[{item:'Stone',quantity:10000},{item:'Cloth',quantity:1000},{item:'Silver',quantity:5000}],[{name:'Engineering',level:8}],'1 Amphitheatre: People 2k, Eng 8, Stone 10k, Cloth 1k, Silver 5k'),
      requirements:['A visiting Tribe must have a unit with Warriors/Actives population in the same hex as the host Tribe and Amphitheatre. Inactives do not satisfy this requirement.'],
      restrictions:['Visiting units participating in the Inter Spring Arts Festival Music may not Hunt during the Fair turn.'],
      creates:[building('Amphitheatre',['Allows the Spring Arts Festival Music to include visiting Tribes from other Clans.'],{recipe:recipe('Engineering',{item:'Amphitheatre',quantity:1},2000,[{item:'Stone',quantity:10000},{item:'Cloth',quantity:1000},{item:'Silver',quantity:5000}],[{name:'Engineering',level:8}]),requirements:['Visiting Tribes require Warriors/Actives population on location.'],restrictions:['Participating visiting units may not Hunt during the Fair turn.']})],
      relatedSkills:['Administration','Engineering']
    })
  );

  // Navigation
  topics.push(
    t('Navigation','Navigation 11',5,134,{
      effects:['Raises Navigation by +1, from level 10 to level 11.'],
      leadsTo:[rr('Astronomy','Astronomy','Astronomy')],
      affectsSkills:['Navigation']
    }),
    t('Navigation','Wetlands Wayfinder',6,134,{
      effects:['Allows qualifying shallow-hulled fleets to include Swamp hexes in GOTO routes.','Rowed movement through an unimproved Swamp costs 12 MP for a full hex or 6 MP for a hexside.'],
      restrictions:['Only shallow-hulled ships that are unhindered by Fords may use this research; examples given are Boat, Barge and Longboat.','A fleet containing any non-qualifying ship may not cross Swamp this way.','The rule applies only to GOTO routes; standard fleet movement through Swamp remains prohibited.'],
      notes:['Players are responsible for monitoring whether their fleet composition is eligible.'],
      leadsTo:[rr('Wetlands Corridor','Wetlands Corridor','Navigation')],
      affectsSkills:['Navigation']
    }),
    t('Navigation','Wetlands Corridor',2,134,{
      prerequisites:[rr('Wetlands Wayfinder','Wetlands Wayfinder','Navigation')],
      effects:['Creates a Swamp hex improvement that reduces Wetlands Wayfinder movement through that Swamp to 8 MP for the full hex or 4 MP for a hexside.','A Clan with Wetlands Wayfinder and Two Hex Ferry may operate a ferry across the improved Swamp for 16 MP per round trip, allowing Jetties on opposite sides of the Swamp.'],
      recipe:recipe('Engineering',{item:'Wetlands Corridor',quantity:1},200,[{item:'Rope',quantity:40},{item:'Wagon',quantity:10,note:'Required/reusable equipment'},{item:'Cattle/Horse',quantity:20,note:'Required draught animals'},{item:'Shovel',quantity:50,note:'Required/reusable equipment'}],[{name:'Engineering',level:4}],'People 200, Eng 4, Rope 40, Requires Wagon 10, Cattle and/or Horse 20, Shovel 50'),
      requirements:['The improvement is made to the Swamp hex, but the construction unit may stand in any adjacent land hex.','Using an existing Wetlands Corridor requires the fleet/ferry to have Wetlands Corridor research.'],
      restrictions:['All other restrictions of Wetlands Wayfinder and Two Hex Ferry continue to apply.'],
      relatedSkills:['Engineering','Sailing'],
      creates:[building('Wetlands Corridor',['Reduces eligible GOTO Swamp movement to 8 MP per full hex / 4 MP per hexside.','Supports a 16 MP round-trip Swamp ferry when combined with Wetlands Wayfinder and Two Hex Ferry.'],{recipe:recipe('Engineering',{item:'Wetlands Corridor',quantity:1},200,[{item:'Rope',quantity:40},{item:'Wagon',quantity:10},{item:'Cattle/Horse',quantity:20},{item:'Shovel',quantity:50}],[{name:'Engineering',level:4}]),requirements:['Built in a Swamp hex from an adjacent land hex.','Users require Wetlands Corridor research.']})]
    })
  );

  // Politics
  topics.push(
    t('Politics','Banqueting Hall',4,136,{
      prerequisites:[sr('Politics 10','Politics'),rr('Government Level 1','Government Level 1 (to 5 and beyond)','Politics')],
      effects:['A Banqueting Hall gives the hosting Tribe +0.01 General Morale and can recruit Actives according to food supplied.','Up to 10,000 Provisions may be laid on; 1 Active joins per 100 Provisions, for a maximum of 100 Actives.','The host may invite one guest Tribe, from inside or outside the Clan, which is also subject to the Morale increase.'],
      recipe:recipe('Construction',{item:'Banqueting Hall',quantity:1},null,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500},{item:'Gold',quantity:20},{item:'Silver',quantity:10000},{item:'Copper',quantity:500},{item:'Cloth',quantity:200},{item:'Pewter',quantity:1000}],[],'1 Banqueting Hall: Stone 5000, Logs 500, Gold 20, Silver 10000, Copper 500, Cloth 200, Pewter 1000'),
      notes:['The source describes the feast as normally held in month 12.','If a separate Banquet is also held by any Tribe in the Clan using the Banqueting Hall, the source says the Banquet and Banqueting Hall effects are cancelled and replaced, but the replacement text is incomplete.'],
      sourceGaps:['The source does not state labour or construction skills for the Banqueting Hall recipe.','The sentence describing what replaces the combined Banquet + Banqueting Hall effects is incomplete.'],
      creates:[building('Banqueting Hall',['Adds +0.01 General Morale to the host and can recruit up to 100 Actives from up to 10,000 Provisions.','One guest Tribe may also receive the Morale benefit.'],{recipe:recipe('Construction',{item:'Banqueting Hall',quantity:1},null,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500},{item:'Gold',quantity:20},{item:'Silver',quantity:10000},{item:'Copper',quantity:500},{item:'Cloth',quantity:200},{item:'Pewter',quantity:1000}]),notes:['The source does not state construction labour/skills.']})]
    }),
    t('Politics','Castle',6,136,{
      status:'under review',
      prerequisites:[rr("25' Wall","25' Wall",'Engineering')],
      effects:['Acts as a 30-foot Stone Wall for Siege and Assault.','Can house up to 6,000 people and all Goods at the site except Animals.','The Defender may choose the Castle as the fortified defence.','Increases Silver collected per Tax Collector by 50% when used with the Doomsday Book rule.'],
      recipe:recipe('Construction',{item:'Castle',quantity:1},null,[{item:'Stone',quantity:12000},{item:'Logs',quantity:2000},{item:'Bronze/Iron',quantity:500},{item:'Lead',quantity:500},{item:'Gold',quantity:50},{item:'Exotic Timber',quantity:500}],[{name:'Engineering',level:10},{name:'Architecture',level:8}],"1 Castle: Eng10, Archit8, Stones 12,000, Logs 2,000, Bronze/Iron 500, Lead 500, Gold 50, exotic timber 500"),
      leadsTo:[rr('Fortress','Fortress','Politics'),rr('Mission','Mission','Politics'),rr('Palace','Palace','Politics')],
      restrictions:['Only one Castle may be built in a hex.','When attackers are considered inside the outer walls, Village activities such as Milling and Refining and external activities such as Hunting and Mining cannot be performed; Baking is an exception and Armour/Weapons may still be made where sensible.','All herd is lost in the described Castle-defence situation.'],
      notes:['The source explicitly says the Castle topic is currently under review.','The source says materials are installed at normal rates.'],
      sourceIssues:['The recipe says “Bronze/Iron 500” without defining whether 500 of either metal is a free alternative; the source wording is retained.'],
      relatedSkills:['Engineering','Architecture'],
      creates:[building('Castle',['Functions as a 30-foot Stone Wall in Siege/Assault.','Capacity: 6,000 people plus Goods except Animals.','Provides +50% Doomsday Book tax collection per Tax Collector.'],{recipe:recipe('Construction',{item:'Castle',quantity:1},null,[{item:'Stone',quantity:12000},{item:'Logs',quantity:2000},{item:'Bronze/Iron',quantity:500},{item:'Lead',quantity:500},{item:'Gold',quantity:50},{item:'Exotic Timber',quantity:500}],[{name:'Engineering',level:10},{name:'Architecture',level:8}]),restrictions:['One Castle per hex.'],notes:['Research topic is under review.']})]
    }),
    t('Politics','Doomsday Book',2,137,{
      prerequisites:[rr('Government Level 2','Government Level 1 (to 5 and beyond)','Politics')],
      effects:['Allows more efficient tax collection: 400 Silver per controlled hex beyond Government Level 2, paid in month 12.','A separate Doomsday Book must be written for each hex to be taxed, although only one research topic is required.','A Castle increases the Silver collected per Tax Collector by 50%.'],
      recipe:recipe('Literacy',{item:'Doomsday Book',quantity:1},null,[{item:'Gold',quantity:1},{item:'Leather',quantity:1},{item:'Parchment',quantity:10}],[{name:'Literacy',level:4}],'1 Doomsday Book: Lit4, Gold 1, Leather 1, Parchment 10'),
      requirements:['Doomsday Books must be kept in the Home City.','The player must claim the total month-12 payment and must not claim for hexes controlled by another City.'],
      notes:['Weight: 10 lb.','Source credits proposal to David Steinheilper.'],
      creates:[item('Doomsday Book',['Enables the source tax rule of 400 Silver per eligible controlled hex, paid in month 12.'],{recipe:recipe('Literacy',{item:'Doomsday Book',quantity:1},null,[{item:'Gold',quantity:1},{item:'Leather',quantity:1},{item:'Parchment',quantity:10}],[{name:'Literacy',level:4}]),requirements:['One book per taxed hex; books remain in the Home City.'],notes:['Weight: 10 lb.']})]
    }),
    t('Politics','Fortress',8,138,{
      prerequisites:[rr('Castle','Castle','Politics'),{label:'Scroll',type:'entity',entity:'Scroll'},{label:'Relic',type:'entity',entity:'Relic'}],
      effects:['Allows a Castle-equivalent fortification to be built away from the political centre without controlling surrounding hexes.','A Fortress can house up to 6,000 people and all Goods except Animals.'],
      recipe:recipe('Construction',{item:'Fortress',quantity:1},null,[{item:'Gold',quantity:60,note:'Per year'}],[],"See Castle; Gold 60 / Year"),
      requirements:['The first Fortress must be at least 10 hexes from the Castle; a second may be built at least 10 hexes from the first.','The required Scroll is destroyed/transferred to Usage when research completes.'],
      restrictions:['A Fortress cannot be built in a hex under Politics control of another Clan.','Third and fourth Fortresses require further research.'],
      sourceGaps:['The recipe refers to “See Castle” instead of restating the Castle material quantities.'],
      creates:[building('Fortress',['Castle-equivalent fortification with 6,000-person capacity but no surrounding political control.'],{requirements:['At least 10 hexes from the Castle; later Fortresses have spacing/research limits.'],restrictions:['Cannot be built in another Clan’s Politics-controlled hex.'],notes:['Uses Castle materials plus the listed 60 Gold/year rule; the source does not restate the full Castle recipe here.']})]
    }),
    t('Politics','Government Level 1 (to 5 and beyond)','1 / 2 / 3 / 4 / 5',138,{
      effects:['Progressively increases the number of controlled hexes available to the Clan’s State/Nation under the Politics rules.','Each level requires the previous Government Level.'],
      leadsTo:[rr('Banqueting Hall','Banqueting Hall','Politics'),rr('Boat People','Boat People','Politics'),rr('Feudal Security','Feudal Security','Politics'),rr('Doomsday Book','Doomsday Book','Politics'),rr('Sheriffs','Sheriffs','Politics'),rr('Marshals','Marshals','Politics')],
      notes:['The source gives DLs 1, 2, 3, 4 and 5 for Government Levels 1–5 respectively and describes this progression as the start of the Empire.'],
      affectsSkills:['Politics']
    }),
    t('Politics','Ho Chi Minh Trail',8,139,{
      prerequisites:[{label:'Home City not in Prairie or Tundra',type:'condition'}],
      effects:['If the Politics 10 centre/Home City is besieged or attacked, people or Goods may be moved to any of the Clan’s units within 12 hexes.','The evacuation may be activated in the same turn as the attack and represents movement through concealed passages assisted by Locals.'],
      recipe:recipe('Engineering',{item:'Ho Chi Minh Trail',quantity:1},2000,[{item:'Silver',quantity:20000},{item:'Gold',quantity:200},{item:'Relic',quantity:1}],[{name:'Engineering',level:7}],'People 2000, Eng7, Silver 20000, Gold 200, Relic 1'),
      restrictions:['The Home City cannot be in Prairie or Tundra terrain.'],
      notes:['The attacker may immediately take ownership of Village works/site left behind after evacuation.'],
      relatedSkills:['Engineering'],
      creates:[building('Ho Chi Minh Trail',['Emergency escape network allowing evacuation of people/Goods from an attacked Politics 10 centre to friendly units within 12 hexes.'],{recipe:recipe('Engineering',{item:'Ho Chi Minh Trail',quantity:1},2000,[{item:'Silver',quantity:20000},{item:'Gold',quantity:200},{item:'Relic',quantity:1}],[{name:'Engineering',level:7}]),restrictions:['Home City cannot be Prairie or Tundra.']})]
    }),
    t('Politics','Marshals',3,139,{
      prerequisites:[rr('Government Level 3','Government Level 1 (to 5 and beyond)','Politics'),rr('Sheriffs','Sheriffs','Politics')],
      effects:['One Marshal replaces three Sheriffs for the Politics/security function.','Marshals are always considered on defence and automatically contribute to assigned defenders.'],
      requirements:['Each Marshal requires Shield, Full Plate, Sword, Spear, Horse and Saddle; better equipment may substitute where appropriate.','100 Marshals require one Hall of Justice.'],
      notes:['If the Politics 10 City is under siege, the source says “Sheriffs” may be dismounted and assigned to defensive positions; this appears within the Marshals entry.','Fluted Plate may substitute for Full Plate during combat.'],
      sourceIssues:['The siege sentence in the Marshals entry refers to Sheriffs rather than Marshals; the Compendium preserves and flags that wording.'],
      restrictions:['Loss of Government Level 3 counters/removes this capability.'],
      relatedSkills:['Security']
    }),
    t('Politics','Mission',4,140,{
      effects:['A Mission raises General Morale by +0.02.','Once per year, at least 12 months after construction, the Castle owner may contribute up to 8,000 Silver to the local community in return for 80 Inactives joining a unit present at the Mission site.'],
      prerequisites:[rr('Castle','Castle','Politics')],
      recipe:recipe('Construction',{item:'Mission',quantity:1},3260,[{item:'Stone',quantity:15000},{item:'Logs',quantity:500},{item:'Brass',quantity:100}],[{name:'Engineering',level:7},{name:'Woodwork',level:3},{name:'Metalwork',level:3},{name:'Stonework',level:4}],'1 Mission: People 3260, Eng 7, Wd 3, Mtl 3, Stn 4, Stones 15k, Logs 500, Brass 100'),
      requirements:['A Mission must be at least 12 hexes from the Castle.'],
      restrictions:['A Mission cannot be built at an existing Village site.'],
      notes:['The source says Missions may sometimes be offered to Clans without the research, but the receiving Clan may not control placement and likely receives no more than one.'],
      creates:[building('Mission',['Adds +0.02 General Morale.','Supports an annual 8,000 Silver contribution that recruits 80 Inactives after the first 12 months.'],{recipe:recipe('Construction',{item:'Mission',quantity:1},3260,[{item:'Stone',quantity:15000},{item:'Logs',quantity:500},{item:'Brass',quantity:100}],[{name:'Engineering',level:7},{name:'Woodwork',level:3},{name:'Metalwork',level:3},{name:'Stonework',level:4}]),requirements:['At least 12 hexes from the Castle.'],restrictions:['Cannot be built on an existing Village site.']})]
    }),
    t('Politics','Posse',4,140,{
      effects:['For every 5 Warriors assigned to Security, one Local may be added when required.'],
      affectsSkills:['Security']
    }),
    t('Politics','Sheriffs',4,140,{
      prerequisites:[rr('Government Level 2','Government Level 1 (to 5 and beyond)','Politics')],
      effects:['One Sheriff replaces three Pacifiers for the Politics/security function.'],
      leadsTo:[rr('Marshals','Marshals','Politics')],
      requirements:['Sheriffs require Shields, Helms, Chain, Breastplate and Trews or better; Bronze, Ring and Scale armour are not allowed.','Minimum weapons are both Swords and Spears; bows may also be used, and better weapons/armour may substitute.','Sheriffs must be mounted on Horses with Saddles.','100 Sheriffs require one Hall of Justice.'],
      restrictions:['Loss of Government Level 2 counters/removes this capability.'],
      notes:['A Hall of Justice requires 10,000 Stones and Engineering 9 according to this entry.','If the Politics 10 City is under siege, Sheriffs may be dismounted and assigned to defensive positions.'],
      creates:[building('Hall of Justice',['Houses up to 100 Sheriffs or Marshals.'],{requirements:['Engineering 9.'],notes:['The Sheriffs entry states 10,000 Stones but does not give labour or a complete construction recipe.']})],
      sourceGaps:['The source gives only Engineering 9 and 10,000 Stones for the Hall of Justice and does not state labour or other construction requirements.'],
      relatedSkills:['Security','Engineering']
    })
  );

  // Pottery
  topics.push(
    t('Pottery','Advanced Pottery',5,142,{
      effects:['Allows more efficient but Silver-intensive production of Ewers, Jars and Urns while Clay and Coal consumption remain unchanged.'],
      recipe:recipe('Pottery',null,null,[],[],'2 Ewers: People 1, Silver 5 each; 2 Jars: People 2, Silver 10 each; 2 Urns: People 4, Silver 10 each'),
      sourceGaps:['The entry says Clay and Coal consumption remain the same but does not restate those base quantities, so they are not invented here.']
    }),
    t('Pottery','China',6,142,{
      effects:['Unlocks China as a Desired Commodity.'],
      recipe:recipe('Pottery',{item:'China',quantity:1},2,[{item:'Kaolin',quantity:4},{item:'Coal',quantity:20},{item:'Silver',quantity:10}],[{name:'Pottery',level:0}],'1 China: People 2, Kaolin 4, Coal 20, Silver 10, Requires Kiln'),
      requirements:['Requires a Kiln.'],
      restrictions:['Maximum 100 Potters per Clan may be assigned to China production.'],
      creates:[item('China',['Desired Commodity produced by Pottery research.'],{recipe:recipe('Pottery',{item:'China',quantity:1},2,[{item:'Kaolin',quantity:4},{item:'Coal',quantity:20},{item:'Silver',quantity:10}],[]),requirements:['Kiln required.'],restrictions:['Maximum 100 Potters per Clan.']})]
    }),
    t('Pottery','Crown Moulding',5,142,{
      prerequisites:[sr('Art 10','Art')],
      effects:['Creates Crown Moulding, a decorative plaster component intended for prestigious buildings.','Crown Moulding is installed at 2 units per worker.'],
      recipe:recipe('Pottery',{item:'Crown Moulding',quantity:10},1,[{item:'Portland Cement',quantity:10},{item:'Clay',quantity:10},{item:'Refined Sand',quantity:10},{item:'Water',quantity:40}],[{name:'Pottery',level:10},{name:'Art',level:10}],'10 Crown Moulding: People 1, Pot 10, Art 10, Portland Cement 10, Clay 10, Refined Sand 10, Water 40, Weighs 10lb'),
      notes:['The source says there were no public uses for Crown Moulding when this topic was released.','Some ingredients come from other research topics; the crafter need not know those topics if it has the components.','Weight: 10 lb per source recipe wording.'],
      creates:[item('Crown Moulding',['Decorative component for prestigious buildings; installs at 2 per worker.'],{recipe:recipe('Pottery',{item:'Crown Moulding',quantity:10},1,[{item:'Portland Cement',quantity:10},{item:'Clay',quantity:10},{item:'Refined Sand',quantity:10},{item:'Water',quantity:40}],[{name:'Pottery',level:10},{name:'Art',level:10}]),notes:['No public use was listed at topic release.']})],
      relatedSkills:['Art']
    }),
    t('Pottery','Moulding',4,143,{
      prerequisites:[sr('Design 6','Design'),sr('Architecture 3','Architecture')],
      effects:['Creates Moulding, a decorative plaster component intended for prestigious buildings.','Moulding is installed at 2 units per worker.'],
      recipe:recipe('Pottery',{item:'Moulding',quantity:5},1,[{item:'Portland Cement',quantity:10},{item:'Clay',quantity:20},{item:'Refined Sand',quantity:20},{item:'Water',quantity:40}],[{name:'Pottery',level:10},{name:'Design',level:6},{name:'Architecture',level:3}],'5 Moulding: People 1, Pot 10, Design 6, Architecture 3, Portland Cement 10, Clay 20, Refined Sand 20, Water 40, Weighs 10lb'),
      notes:['The source says there were no public uses for Moulding when this topic was released.','Some ingredients come from other research topics; the crafter need not know those topics if it has the components.'],
      sourceIssues:['The source labels Design as “Group ? skill”; the Compendium does not infer a group here.'],
      creates:[item('Moulding',['Decorative component for prestigious buildings; installs at 2 per worker.'],{recipe:recipe('Pottery',{item:'Moulding',quantity:5},1,[{item:'Portland Cement',quantity:10},{item:'Clay',quantity:20},{item:'Refined Sand',quantity:20},{item:'Water',quantity:40}],[{name:'Pottery',level:10},{name:'Design',level:6},{name:'Architecture',level:3}]),notes:['No public use was listed at topic release.']})],
      relatedSkills:['Design','Architecture']
    }),
    t('Pottery','Terracotta Army',8,144,{
      status:'removed',
      effects:['The removed topic states that completing the Terracotta Army would give +2 Combat skill and +0.04 Combat Morale in combat.'],
      recipe:recipe('Pottery',{item:'Terracotta Warrior',quantity:1000},4000,[{item:'Clay',quantity:20000},{item:'Coal',quantity:10000},{item:'Stone',quantity:10000,note:'Housing'},{item:'Logs',quantity:1000,note:'Housing'}],[{name:'Pottery',level:7},{name:'Engineering',level:8},{name:'Art',level:10}],'1000 Terracotta Warriors required: Eng8, Art10, Stones 10k, Logs 1k housing; each Warrior requires 20 Clay, 10 Coal, Pot7, 4 AM'),
      requirements:['The source says the Terracotta Army is housed in the Home City hex.'],
      notes:['Housing Stone/Logs are installed at 5 Stone and 2 Logs per person.','The source credits proposal to Mark Ryan.','Each Terracotta Warrior weighs 100 lb.'],
      affectsSkills:['Combat'],
      creates:[item('Terracotta Warrior',['Removed research item; the full set of 1,000 was described as giving +2 Combat and +0.04 Combat Morale.'],{notes:['Research topic is marked removed.','Weight: 100 lb each.']})]
    })
  );

  // Quarrying
  for (const [n,dl,page,next] of [[6,5,145,7],[7,6,145,8],[8,7,145,9],[9,8,146,10],[10,8,146,null]]) {
    topics.push(t('Quarrying',`${n} Stones / Person`,dl,page,{
      prerequisites:n===6?[]:[rr(`${n-1} Stones / Person`,`${n-1} Stones / Person`,'Quarrying')],
      effects:[`Each Quarrier produces ${n} Stone as the base output.`,`Implements use ${n} Stone as the new base; with a Mattock the source example is ${n*2} Stone per worker.`],
      leadsTo:next?[rr(`${next} Stones / Person`,`${next} Stones / Person`,'Quarrying')]:[],
      affectsSkills:['Quarrying']
    }));
  }
  topics.push(
    t('Quarrying','Extra Quarrying Tools',4,146,{
      effects:['Allows a Quarrier already using a Mattock to also use a Shovel for another +5 Stone at the base 5-Stone rate: 5 base +5 Mattock +5 Shovel = 15 Stone.','The Shovel bonus applies only when the worker has both Mattock and Shovel.'],
      notes:['The source says equivalent workers must be shown in orders; its example of 100 workers with Mattocks, Shovels and Wheelbarrows is represented as 400 Quarriers.'],
      affectsSkills:['Quarrying']
    }),
    t('Quarrying','Hill Sculpture',2,147,{
      prerequisites:[sr('Art 3','Art'),sr('Architecture 2','Architecture'),sr('Engineering 2','Engineering')],
      effects:['Creates a Clan Hill Sculpture in an empty Grass Hill hex.','After completion, any Tribe/unit in the Clan may celebrate or honour the Clan to gain +0.04 Morale.','The celebration may be performed only once per game year.'],
      recipe:recipe('Construction',{item:'Hill Sculpture',quantity:1},1500,[],[{name:'Art',level:3},{name:'Architecture',level:2},{name:'Engineering',level:2}],'1 Hill Sculpture on grass hill hex: 1500 people; Shovels or Picks increase construction effectiveness by 50%; must be completed in one month'),
      requirements:['Must be built and completed in a single month.','Must be in an unoccupied Grass Hill hex; the source says to identify the coordinates in GM Actions.'],
      notes:['Shovels or Picks increase construction effectiveness by 50%.','Another Clan can destroy the sculpture with 250 effort; the owner then loses 0.04 Morale.'],
      creates:[building('Hill Sculpture',['Allows the owning Clan to perform an annual celebration/honour activity for +0.04 Morale.'],{recipe:recipe('Construction',{item:'Hill Sculpture',quantity:1},1500,[],[{name:'Art',level:3},{name:'Architecture',level:2},{name:'Engineering',level:2}]),requirements:['Empty Grass Hill hex; complete in one month.'],notes:['Picks/Shovels provide +50% construction effectiveness.']})],
      relatedSkills:['Art','Architecture','Engineering']
    }),
    t('Quarrying','Inactive Quarriers',5,147,{
      effects:['Inactives may supply up to one-third of Quarrying labour.','Inactive Quarriers may use tools such as Mattocks.'],
      requirements:['Inactives must accompany normal Quarriers; they cannot be assigned as the only Quarrying workforce.'],
      notes:['The source describes the relationship as Inactives adding up to 50% of the ordinary Quarrier number, equivalent to one-third of total labour.','Until coded, represent the extra people as Auxiliaries.'],
      affectsSkills:['Quarrying']
    }),
    t('Quarrying','Limestone',6,148,{
      prerequisites:[sr('Scouting 6','Scouting')],
      effects:['Unlocks placement of a new Limestone resource hex by the GM.','Limestone is quarried at the normal Stone rate and benefits from all Quarrying research and implements that affect Stone.','Once discovered, any Clan may quarry Limestone without possessing this research.'],
      requirements:['After completing the research, contact the GM to place a Limestone deposit approximately 12–15 hexes from both the researching Tribe and the Clan’s main village/home village/home city.'],
      restrictions:['The Limestone deposit must be in Hills or Mountains.','The chosen hex must not have a water hexside at placement time and may not already have a Mine.'],
      affectsSkills:['Quarrying'],
      relatedSkills:['Scouting'],
      creates:[item('Limestone',['Special Stone resource used in specific construction.','Quarried at the normal Stone rate and affected by normal Quarrying bonuses.'],{researchOnly:false,notes:['Research places/discovers a deposit; possession of Limestone does not require the research.']})]
    })
  );

  // Rangers
  topics.push(
    t('Ranger','Ranger IV, V, VI','4 / 5 / 6',150,{
      prerequisites:[sr('Ranger 10','Ranger'),rr('Ranger III','Ranger III','Scouting')],
      effects:['Ranger IV adds +2 Scouting.','Ranger V adds +2 Scouting.','Ranger VI adds +2 Scouting.','Every Ranger research topic numbered 7 or higher adds a further +2 Scouting levels.'],
      affectsSkills:['Scouting'],
      relatedSkills:['Ranger'],
      sourceIssues:['The source provides explicit prerequisites for Ranger IV and V but does not separately state the prerequisite line for Ranger VI; its progression wording implies the sequence but is not silently expanded here.']
    })
  );

  // Refining
  topics.push(
    t('Refining','Coke',8,151,{
      effects:['Unlocks Refining of 20 Coal into 15 Coke.','For listed refining, armour and weapon uses, 1 Coke is equivalent to 2 Coal.','Coke is required for Steel production.','Coke may be used by any Clan that has an application for it, even without Coke research.'],
      recipe:recipe('Refining',{item:'Coke',quantity:15},1,[{item:'Coal',quantity:20}],[],'15 Coke: People 1, Coal 20'),
      leadsTo:[rr('Steel','Steel','Refining')],
      requirements:['Coke production is a Refining activity and uses Refineries/Smelters like normal Refining.'],
      notes:['The source lists conventional Coke applications including Breastplate, Helm, Shield, Chain and Sword; research items include Bascinet, Fluted Plate, Full Plate, Greaves, Heavy Fluted Plate and Heavy Full Plate.','Listed refining applications include Copper, Iron and Steel, with Steel requiring Coke.','Some items using Coke also require Silver.'],
      creates:[item('Coke',['Advanced fuel: 1 Coke substitutes for 2 Coal in supported applications.','Required for Steel production.'],{recipe:recipe('Refining',{item:'Coke',quantity:15},1,[{item:'Coal',quantity:20}],[]),researchOnly:false,requirements:['Production requires Refinery/Smelter capacity.']})]
    }),
    t('Refining','Hammer Mill',5,152,{
      effects:['Each Hammer Mill supports up to 20 workers assigned to Mining or Refining, making 2 workers perform the work of 3.','The effect is analogous to Scaffolds: a 50% effective-worker increase for the supported 20 workers.','Hammer Mills may be used by other Clans.'],
      recipe:recipe('Construction',{item:'Hammer Mill',quantity:1},11,[{item:'Logs',quantity:20},{item:'Iron',quantity:5},{item:'Coal',quantity:10},{item:'Leather',quantity:2}],[{name:'Woodwork',level:5},{name:'Engineering',level:6}],'1 Hammer Mill: People 11, Wd5, Eng6, Logs20, Iron5, Coal10, Leather2'),
      requirements:['On a hex with a River hexside, no draught animals are required.','Without a River hexside, operating a Hammer Mill requires 2 Horses or Cattle.','For Refining, effective extra AM require enough additional Smelter capacity.'],
      notes:['For Mining/Refining orders the extra effective workers are represented as Auxiliaries until coded.','Hammer Mills are items, not buildings, and may be traded.','Weight: 2,000 lb.','Source credits proposal to Chris S.'],
      affectsSkills:['Mining','Refining'],
      relatedSkills:['Engineering','Woodwork'],
      creates:[item('Hammer Mill',['Supports up to 20 Miners or Refiners at a 2-workers-do-the-work-of-3 rate.','Tradeable item rather than a building.'],{recipe:recipe('Construction',{item:'Hammer Mill',quantity:1},11,[{item:'Logs',quantity:20},{item:'Iron',quantity:5},{item:'Coal',quantity:10},{item:'Leather',quantity:2}],[{name:'Woodwork',level:5},{name:'Engineering',level:6}]),requirements:['2 Horses/Cattle to operate unless powered by a River hexside.'],notes:['Weight: 2,000 lb.']})]
    }),
    t('Refining','Portland Cement',4,152,{
      effects:['Unlocks Portland Cement as an advanced resource.','Portland Cement may be used by any Clan regardless of whether that Clan completed the research.'],
      recipe:recipe('Refining',{item:'Portland Cement',quantity:5},1,[{item:'Limestone',quantity:10},{item:'Clay',quantity:5},{item:'Coal',quantity:10}],[],'5 Portland Cement: 1 AM, Limestone 10, Clay 5, Coal 10'),
      creates:[item('Portland Cement',['Advanced construction/crafting resource usable by any Clan once obtained.'],{recipe:recipe('Refining',{item:'Portland Cement',quantity:5},1,[{item:'Limestone',quantity:10},{item:'Clay',quantity:5},{item:'Coal',quantity:10}],[]),researchOnly:false})]
    }),
    t('Refining','Refined Sand',3,153,{
      effects:['Unlocks Refined Sand as an advanced resource.','Refined Sand may be used by any Clan regardless of whether that Clan completed the research.'],
      recipe:recipe('Refining',{item:'Refined Sand',quantity:15},1,[{item:'Sand',quantity:20},{item:'Coal',quantity:5}],[],'15 Refined Sand: People 1, Sand 20, Coal 5'),
      requirements:['Production is a Refining activity and requires Refineries/Smelters.'],
      creates:[item('Refined Sand',['Advanced resource usable by any Clan once obtained.'],{recipe:recipe('Refining',{item:'Refined Sand',quantity:15},1,[{item:'Sand',quantity:20},{item:'Coal',quantity:5}],[]),researchOnly:false,requirements:['Refinery/Smelter capacity required for production.']})]
    }),
    t('Refining','Steel',8,153,{
      prerequisites:[rr('Coke','Coke','Refining')],
      effects:['Unlocks Steel production and Steel versions of supported armour and weapons.','Working Steel requires one skill level higher than the equivalent Iron item.','Steel versions of conventional armour/weapons may be produced without monthly quantity limits unless a specific higher-level item says otherwise.'],
      recipe:recipe('Refining',{item:'Steel',quantity:15},1,[{item:'Iron',quantity:20},{item:'Silver',quantity:15},{item:'Coke',quantity:10}],[],'Steel 15: People 1, Iron 20, Silver 15, Coke 10'),
      notes:['The source lists Steel Chain +30 Silver, Breastplate +40, Helm +15, Shield +15, Full Plate +50, Fluted Plate +40, Bascinet +20, Greaves +20, Sword +20 and Spear with Silver n/a.','Scimitar and Ulfbehrt Sword use their own research topics and may have monthly worker limits.'],
      sourceIssues:['For Spear, the source explicitly lists “Silver n/a”, so no Silver amount is inferred.'],
      relatedSkills:['Armour Making','Weapons'],
      creates:[item('Steel',['Advanced metal used for higher-grade armour and weapons.'],{recipe:recipe('Refining',{item:'Steel',quantity:15},1,[{item:'Iron',quantity:20},{item:'Silver',quantity:15},{item:'Coke',quantity:10}],[]),researchOnly:false,notes:['Working Steel requires one skill level higher than equivalent Iron work.']})]
    })
  );

  // Religion
  topics.push(
    t('Religion','Additional Member (Atheism / Religion)',4,155,{
      effects:['Allows the Atheist/Religious organisation to have one additional member.'],
      restrictions:['Each organisation can benefit from this research only once, regardless of how many Tribes research it.','Books may not be written on this topic.'],
      relatedSkills:['Atheism']
    }),
    t('Religion','Military Orders',6,155,{
      prerequisites:[{label:'Missionary Element only',type:'condition'}],
      effects:['For battle calculations, a Missionary Element and its sub-units use effective Leadership = Leadership + half Religion skill, with the half-Religion contribution rounded up.'],
      requirements:['The Vanguard Tribe must have completed Military Orders.','The benefit applies to Warriors belonging to the Missionary Element.'],
      affectsSkills:['Leadership'],
      relatedSkills:['Religion']
    })
  );

  // Research
  topics.push(
    t('Research','Silver Age',2,156,{
      prerequisites:[{label:'Library or University at the Tribe location',type:'building'}],
      effects:['On completion, increase one Group A skill by +1, one Group B skill by +1 and one Group C skill by +1.','Each selected skill can be raised only to a maximum of level 8 by Silver Age.','Silver Age may be researched repeatedly.'],
      requirements:['The Tribe must be settled in a Village containing a Library or University.','Before reaching DL 0, transfer 300 Silver to Usage each turn; once DL 0 is reached, transfer 900 Silver to Usage each turn until completion.','These Silver costs are additional to any University costs for researching multiple topics.'],
      restrictions:['Only one Tribe per Clan may research Silver Age at a time.','Books may not be written on Silver Age.'],
      notes:['The Silver transfer must be flagged in GM Actions.'],
      relatedSkills:['Research']
    })
  );

  R.registerBatch({
    id:'research-v2-batch-06',
    title:'Batch 6 · Mobilisation through Research',
    pages:'129–157',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Mobilisation','Music','Navigation','Politics','Pottery','Quarrying','Ranger','Refining','Religion','Research'],
    topics
  });
})();
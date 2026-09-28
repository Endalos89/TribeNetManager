(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 05');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const sr = (label, skill) => ({ label, skill: skill || label, type:'skill' });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const skillEntity = (name, effects=[], extra={}) => ({ name, kind:'skill', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  // Leatherwork
  topics.push(
    t('Leatherwork','Combat Boots',3,110,{
      effects:['When all Warriors in a combat unit are equipped with Combat Boots, Combat Morale increases by 0.02 on a sliding-scale basis when only part of the force is equipped.'],
      recipe:recipe('Leatherwork',{item:'Combat Boots',quantity:1},2,[],[{name:'Leatherwork',level:4}],'2 People use 2 Leather, 2 Cloth or 2 Fur, Ltr4, weighs 2 lb'),
      requirements:['The morale benefit is based on Warriors being equipped with Combat Boots.'],
      notes:['Weight: 2 lb.'],
      sourceIssues:['The recipe wording “2 Leather, 2 Cloth or 2 Fur” does not make clear whether Cloth/Fur are alternatives to Leather or additional lining materials, so the Compendium preserves the source wording instead of inventing a structured substitution.'],
      relatedSkills:['Combat'],
      creates:[item('Combat Boots',['Increase Combat Morale by up to +0.02 when Warriors are equipped, using the source sliding-scale rule.'],{recipe:recipe('Leatherwork',{item:'Combat Boots',quantity:1},2,[],[{name:'Leatherwork',level:4}],'2 People use 2 Leather, 2 Cloth or 2 Fur, Ltr4, weighs 2 lb'),notes:['Weight: 2 lb.','The material wording is ambiguous in the source and is preserved verbatim.']})]
    }),
    t('Leatherwork','Dog Leash',2,110,{
      effects:['If every Dog assigned to Suppression or Security has a Dog Leash, the unit gains +2 Security for determining success.'],
      recipe:recipe('Leatherwork',{item:'Dog Leash',quantity:1},2,[{item:'Leather',quantity:2},{item:'Rope',quantity:1}],[{name:'Leatherwork',level:4}],'2 People use 2 Leather, 1 Rope, Ltr4, weighs 1 lb'),
      requirements:['A Leash is required for each Dog assigned to Suppression or Security to gain the +2 Security bonus.'],
      notes:['Weight: 1 lb.'],
      affectsSkills:['Security'],
      relatedSkills:['Suppression'],
      creates:[item('Dog Leash',['Provides +2 Security when every Dog assigned to Suppression or Security is equipped with one.'],{recipe:recipe('Leatherwork',{item:'Dog Leash',quantity:1},2,[{item:'Leather',quantity:2},{item:'Rope',quantity:1}],[{name:'Leatherwork',level:4}]),requirements:['One Leash per Dog assigned to Suppression or Security.'],notes:['Weight: 1 lb.']})]
    }),
    t('Leatherwork','Triball Saddle',3,110,{
      effects:['Gives +2 effective Triball skill in Triball tournaments and at Fair when every player is mounted and equipped with a Triball Saddle.','The bonus may be combined with Triball Maneuvers.'],
      recipe:recipe('Leatherwork',{item:'Triball Saddle',quantity:1},3,[{item:'Leather',quantity:4},{item:'Cotton',quantity:1},{item:'Brass',quantity:1}],[],'3 People use 4 Leather, 1 Cotton and 1 Brass to create 1 Triball Saddle'),
      requirements:['Every player must have a Horse and a Triball Saddle for the bonus to apply.'],
      affectsSkills:['Triball'],
      relatedSkills:['Horsemanship'],
      creates:[item('Triball Saddle',['Adds +2 effective Triball when the whole team is mounted and equipped.','Stacks with Triball Maneuvers.'],{recipe:recipe('Leatherwork',{item:'Triball Saddle',quantity:1},3,[{item:'Leather',quantity:4},{item:'Cotton',quantity:1},{item:'Brass',quantity:1}]),requirements:['All players require Horses and Triball Saddles.']})]
    })
  );

  // Literacy
  topics.push(
    t('Literacy','Haiku',6,112,{
      effects:['Adds +0.05 General Morale.','May be researched multiple times by the same Tribe.'],
      requirements:['After completion, the player contacts the GM to have the Morale applied and the completed topic removed.'],
      notes:['Unlike the general Literacy note on this page, the Haiku entry explicitly says books may be written about Haiku.'],
      sourceIssues:['The description spells the topic “Haiju” once, while the heading and surrounding text use “Haiku”.','The Literacy section says books may not be written about these topics, but the Haiku entry explicitly creates an exception and allows books.']
    }),
    t('Literacy','Scroll',6,112,{
      effects:['Allows the Tribe to create 5 Scrolls.','After the 5 Scrolls are made, the research is removed and may be researched again.'],
      recipe:recipe('Literacy',{item:'Scroll',quantity:5},1,[{item:'Parchment',quantity:100},{item:'Coin',quantity:100}],[],'Scrolls 5: People 1, Parchment 100, Coin 100'),
      notes:['Special Ink is required for the Parchment, but there is no Special Ink item. Its one-time 100 Coin purchase is rolled into the listed recipe.'],
      creates:[item('Scroll',['Research-created written item; the topic creates 5 Scrolls per completion.'],{recipe:recipe('Literacy',{item:'Scroll',quantity:5},1,[{item:'Parchment',quantity:100},{item:'Coin',quantity:100}]),notes:['The 100 Coin in the recipe represents the one-time purchase of Special Ink; no separate Special Ink item exists.']})]
    })
  );

  // Maintain Boats
  topics.push(
    t('Maintain Boats','Amphibious Warfare I',4,113,{
      effects:['Increases ship people-space capacity by 25%.','The extra people space may instead be converted to transport-animal capacity.','The increased capacity also applies when transporting units from other Clans.'],
      leadsTo:[rr('Amphibious Warfare II','Amphibious Warfare II','Maintain Boats')],
      notes:['Source example: a Longship with a normal capacity of 100 people can carry 125 after Amphibious Warfare I.']
    }),
    t('Maintain Boats','Amphibious Warfare II',4,113,{
      prerequisites:[rr('Amphibious Warfare I','Amphibious Warfare I','Maintain Boats')],
      effects:['Provides a further 25% increase, for an aggregate +50% ship people-space capacity.','The extra people space may instead be converted to transport-animal capacity.','The increased capacity also applies when transporting units from other Clans.'],
      notes:['Source example: a Longship with a normal capacity of 100 people can carry 150 after Amphibious Warfare II.']
    })
  );

  // Mariner
  topics.push(
    t('Mariner','Mariner 11',5,114,{
      effects:['Raises Mariner to level 11.'],
      leadsTo:[rr('Mariner 12','Mariner 12','Mariner')],
      affectsSkills:['Mariner']
    }),
    t('Mariner','Mariner 12',5,114,{
      prerequisites:[rr('Mariner 11','Mariner 11','Mariner')],
      effects:['Raises Mariner to level 12.'],
      affectsSkills:['Mariner'],
      sourceIssues:['The source entry itself lists “Pre-Req n/a”, but Mariner 11 explicitly says it is a prerequisite for Mariner 12. The Compendium records that relationship and flags the wording discrepancy.']
    }),
    t('Mariner','Marines',4,114,{
      prerequisites:[sr('Mariner 10','Mariner')],
      effects:['Adds +3 effective Mariner skill.','The research represents trained marines specialising in boarding actions and repelling enemy boarders.'],
      affectsSkills:['Mariner']
    }),
    t('Mariner','Professional Sailor',4,115,{
      status:'proposed',
      prerequisites:[rr('Expert Sailors','Expert Sailors','Sailing'),sr('Navigation 10','Navigation'),sr('Captaincy 10','Captaincy'),sr('Sailing 10','Sailing')],
      effects:['For crewing purposes, 1 Professional Sailor counts as 1.5 sailors.','The source describes this as reducing crew requirements by 33%.'],
      notes:['The source marks this topic as proposed by Darren Thacker.'],
      relatedSkills:['Sailing','Navigation','Captaincy']
    })
  );

  // Metalwork
  topics.push(
    t('Metalwork','Advanced Trap',4,116,{
      prerequisites:[rr('Improved Trap','Improved Trap','Metalwork'),rr('Improved Trap','Improved Trap','Furrier')],
      effects:['One Hunter/Furrier using one Advanced Trap gains +1.0 effective Hunting, so one Hunter counts as two.'],
      recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}],'1 Advanced Trap: People 2, Mtl 10, Iron 2, Coal 8'),
      restrictions:['One Hunter/Furrier may use one Advanced Trap and no standard or Improved Traps at the same time.'],
      notes:['Weight: 1 lb.','The source also lists this research under Furrier and Hunting.'],
      affectsSkills:['Hunting'],
      relatedSkills:['Furrier'],
      creates:[item('Advanced Trap',['Adds +1.0 effective Hunting for one Hunter/Furrier.'],{recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}]),restrictions:['One per Hunter/Furrier; do not combine with standard or Improved Traps.'],notes:['Weight: 1 lb.']})]
    }),
    t('Metalwork','Bronze Statue',6,116,{
      effects:['Unlocks Bronze Statues as a new trade good.','The owning Tribe and its units may craft Bronze Statues as either an Art or Metalwork activity.','Bronze Statues may be sold at Fair and possibly Trade Towns.'],
      recipe:recipe('Art / Metalwork',{item:'Bronze Statue',quantity:1},20,[{item:'Bronze',quantity:1000},{item:'Coal',quantity:200},{item:'Silver',quantity:200}],[{name:'Art',level:8}],'20 People, Art 8, Bronze 1k, Coal 200, Silver 200'),
      notes:['Weight: 1,000 lb.','The source also lists this research under Art.'],
      relatedSkills:['Art'],
      creates:[item('Bronze Statue',['Trade good craftable as an Art or Metalwork activity and sellable at Fair.'],{recipe:recipe('Art / Metalwork',{item:'Bronze Statue',quantity:1},20,[{item:'Bronze',quantity:1000},{item:'Coal',quantity:200},{item:'Silver',quantity:200}],[{name:'Art',level:8}]),notes:['Weight: 1,000 lb.','The source says it may also sell at Trade Towns.']})]
    }),
    t('Metalwork','Chisel',2,117,{
      effects:['A worker with a Chisel doubles Quarrying output to 10 Stone.','A worker may use a Chisel and a Mattock together for 15 Stone.','A Chisel doubles the worker contribution to Stonework and to Art when producing stone items.'],
      recipe:recipe('Metalwork',{item:'Chisel',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:3}],'1 Chisel: People 1, Mtl 3, Iron 1, Coal 4'),
      notes:['Weight: 1 lb.','For Stonework or stone Art, the source says to represent 1 worker with a Chisel as 2 workers.','The source also lists this research under Stonework.'],
      affectsSkills:['Quarrying','Stonework','Art'],
      creates:[item('Chisel',['Doubles Quarrying output to 10 Stone and can combine with a Mattock for 15 Stone.','Doubles worker output for Stonework and stone-item Art.'],{recipe:recipe('Metalwork',{item:'Chisel',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:3}]),notes:['Weight: 1 lb.']})]
    }),
    t('Metalwork','Improved Trap',2,117,{
      effects:['Each Improved Trap adds +0.15 effective Hunting instead of the standard Trap bonus of +0.10.','Five Improved Traps provide +0.75 effective Hunting.'],
      recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}],'1 Improved Trap: People 1, Mtl 3, Iron 1, Coal 6'),
      leadsTo:[rr('Advanced Trap','Advanced Trap','Furrier'),rr('Advanced Trap','Advanced Trap','Metalwork')],
      restrictions:['The standard limit of five traps per Hunter applies.','A Hunter/Furrier using Improved Traps may not mix them with standard Traps.'],
      notes:['The source also lists this research under Furrier and Hunting.'],
      affectsSkills:['Hunting'],
      creates:[item('Improved Trap',['Adds +0.15 effective Hunting per trap; five provide +0.75.'],{recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}]),restrictions:['Up to five per Hunter under the normal trap limit; do not mix with standard Traps.']})]
    }),
    t('Metalwork','Knife',2,118,{
      effects:['A person using a Knife doubles Skinning, Gutting and Boning output.','A Farmer using a Knife can harvest twice the normal number of acres.','Knives may be used by units that do not own the research.'],
      recipe:recipe('Metalwork',{item:'Knife',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}],'1 Knife: People 1, Mtl 3, Iron 1, Coal 6'),
      notes:['Weight: 1 lb.','For Farming, the source says a Farmer with a Knife should be shown as equivalent to 2 Farmers when submitting orders.','The source also lists this research under Skinning.'],
      affectsSkills:['Skinning','Gutting','Boning','Farming'],
      creates:[item('Knife',['Doubles Skinning, Gutting and Boning.','Doubles the acres a Farmer can harvest.','May be used without owning the research.'],{recipe:recipe('Metalwork',{item:'Knife',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}]),notes:['Weight: 1 lb.']})]
    }),
    t('Metalwork','Mining Ladder',5,118,{
      effects:['One Mining Ladder adds +100% Mining output for up to 10 Miners.','One Mining Ladder also adds +100% Digging output for up to 10 Diggers.','The bonus is cumulative with Picks, Shovels, Ore Carts, Seam Wedges and similar implements, but is additive rather than compounded.'],
      recipe:recipe('Construction',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}],'People 15, Wd3, Mtl3, Log 4, Iron 25, Coal 150'),
      notes:['Weight: 50 lb.','The source says Mining Ladder represents both reinforced ladders and ramps.','The source also lists this research under Engineering, Mining and Woodwork.'],
      affectsSkills:['Mining','Digging'],
      relatedSkills:['Engineering','Woodwork'],
      creates:[item('Mining Ladder',['Adds +100% output for up to 10 Miners and +100% for up to 10 Diggers.','Stacks additively with other mining implements.'],{recipe:recipe('Construction',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}]),notes:['Weight: 50 lb.']})]
    }),
    t('Metalwork','Saw',5,119,{
      effects:['A Saw multiplies logging output by ×4.','The source examples are 4 Logs with no tool, 8 with an Adze, and 16 with a Saw.'],
      recipe:recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}],[{name:'Metalwork',level:5}],'1 Saw: People 3, Mtl5, Iron 5, Coal 40; Alt to Iron. Bronze/Brass 7, Coal 30',[
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Bronze',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}],'Bronze alternative'),
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Brass',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}],'Brass alternative')
      ]),
      restrictions:['A Saw cannot be used together with an Adze.'],
      notes:['The source also lists this research under Forestry.'],
      affectsSkills:['Forestry'],
      creates:[item('Saw',['Multiplies logging output by ×4.'],{recipe:recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}],[{name:'Metalwork',level:5}],'',[
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Bronze',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}]),
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Brass',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}])
      ]),restrictions:['Cannot be used with an Adze.']})]
    }),
    t('Metalwork','Seam Wedges',4,119,{
      effects:['One person using a Seam Wedge adds +50% Mining output when mining with a Pick or Shovel.'],
      recipe:recipe('Metalwork',{item:'Seam Wedge',quantity:1},1,[{item:'Iron',quantity:5},{item:'Coal',quantity:15}],[{name:'Metalwork',level:2}],'1 Seam Wedge: People 1, Mtl 2, Iron 5, Coal 15'),
      notes:['Weight: 1 lb.','The source also lists this research under Mining.'],
      affectsSkills:['Mining'],
      creates:[item('Seam Wedge',['Adds +50% Mining output for a person using a Pick or Shovel.'],{recipe:recipe('Metalwork',{item:'Seam Wedge',quantity:1},1,[{item:'Iron',quantity:5},{item:'Coal',quantity:15}],[{name:'Metalwork',level:2}]),notes:['Weight: 1 lb.']})]
    }),
    t('Metalwork','Scraper (Metal)',1,119,{
      effects:['A metal Scraper doubles the rate of Bark Stripping.'],
      recipe:recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:1}],'1 Scraper: People 1, Mtl1, Iron1, Coal 4 (or Bronze 1, Coal 3)',[
        recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Bronze',quantity:1},{item:'Coal',quantity:3}],[{name:'Metalwork',level:1}],'Bronze alternative')
      ]),
      affectsSkills:['Forestry'],
      creates:[item('Scraper',['Doubles Bark Stripping output.'],{recipe:recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:1}],'',[
        recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Bronze',quantity:1},{item:'Coal',quantity:3}],[{name:'Metalwork',level:1}])
      ])})]
    }),
    t('Metalwork','Water Tank',3,120,{
      effects:['A Water Tank increases a Village’s capacity to withstand a siege.','Each Water Tank provides 1,000 lb of supply capacity, equivalent to 10 Barrels.','Water Tanks are portable and may be transported by Barges and by medium or large ships.'],
      recipe:recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Bronze',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}],'1 Water Tank: People 4, Mtl 6, 40 Metal (Bronze, Brass, Tin, Copper), 80 Coal',[
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Brass',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}],'Brass alternative'),
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Tin',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}],'Tin alternative'),
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Copper',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}],'Copper alternative')
      ]),
      notes:['Weight: 50 lb.','The source says Sanitation is important to avoid disease when stored Water Tank water is required.'],
      relatedSkills:['Sanitation'],
      creates:[item('Water Tank',['Provides 1,000 lb / 10 Barrels of supply capacity for siege endurance.','Portable by Barge and medium/large ships.'],{recipe:recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Bronze',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}],'',[
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Brass',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}]),
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Tin',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}]),
        recipe('Metalwork',{item:'Water Tank',quantity:1},4,[{item:'Copper',quantity:40},{item:'Coal',quantity:80}],[{name:'Metalwork',level:6}])
      ]),notes:['Weight: 50 lb.','Sanitation matters when stored tank water is relied upon.']})]
    })
  );

  // Milking
  topics.push(
    t('Milking','Milking 11',4,121,{
      effects:['Increases Milking output by 10%.'],
      notes:['Until coded, represent the efficiency increase by adding Auxiliaries equal to 10% of workers assigned to Milking.','Tools, if applicable, may only be applied to the original number of actual workers, not the efficiency Auxiliaries.'],
      affectsSkills:['Milking']
    }),
    t('Milking','Milk Maids',4,121,{
      effects:['Each Milking Active Month can milk 3 additional Cattle, increasing the per-worker capacity from 10 to 13 Cattle.','Until coded, represent this by adding Auxiliaries equal to 30% of the people Milking.'],
      notes:['The source explicitly says this does not increase output per Cattle.'],
      sourceIssues:['The entry says 13 Cattle produce 1,300 Milk per worker, while the earlier Dairy Cattle rule states 10 Cattle produce 100 Milk and says Milk Maids do not increase output per Cattle. The Compendium preserves the 1,300 figure as source wording and flags the inconsistency instead of correcting it.'],
      affectsSkills:['Milking']
    })
  );

  // Milling
  topics.push(
    t('Milling','Oilmill',3,122,{
      prerequisites:[rr('Windmill','Windmill','Milling'),rr('Flax','Flax','Farming')],
      effects:['An Oilmill processes Flax/Cotton into Oil and Fodder.','One Miller processes 10 Cotton (10 Flax) into 1 Oil and 10 Fodder in the same month.','An Oilmill requires 20 Millers to keep it supplied and remove its output.'],
      recipe:recipe('Engineering',{item:'Oilmill',quantity:1},500,[{item:'Logs',quantity:500},{item:'Stone',quantity:1000},{item:'Iron',quantity:500},{item:'Coal',quantity:1000},{item:'Millstones',quantity:2}],[{name:'Engineering',level:10},{name:'Woodwork',level:4},{name:'Stonework',level:4}],'1 Oilmill: People 500, Eng 10, Wd 4, Stn 4, Logs 500, Stones 1000, Iron 500, Coal 1000, Millstones 2'),
      requirements:['May only be operated in the same month that Flax is harvested.','A Unit from another Clan requires Milling 10 to operate the Oilmill.'],
      restrictions:['Maximum 10 Oilmills per Clan.','The source states a maximum of 100 Oilmill workers per turn.','At a site, total Windmills + Oilmills must be no more than 100.'],
      notes:['The source says the Flax fibre is lost when the whole plant is used for Linseed Oil production.','May be built under Joint Project rules and may be built for and used by other Clans.'],
      sourceIssues:['The entry says each Oilmill requires 20 Millers, allows up to 10 Oilmills per Clan, and also states a maximum of 100 workers per turn. Those limits do not arithmetically align if all 10 Oilmills operate simultaneously, so the Compendium preserves all three rules without reconciling them.'],
      relatedSkills:['Farming','Engineering','Woodwork','Stonework'],
      creates:[building('Oilmill',['Processes 10 Cotton/Flax per Miller into 1 Oil + 10 Fodder during the harvest month.'],{recipe:recipe('Engineering',{item:'Oilmill',quantity:1},500,[{item:'Logs',quantity:500},{item:'Stone',quantity:1000},{item:'Iron',quantity:500},{item:'Coal',quantity:1000},{item:'Millstones',quantity:2}],[{name:'Engineering',level:10},{name:'Woodwork',level:4},{name:'Stonework',level:4}]),requirements:['20 Millers per Oilmill.','Operate only in the same month Flax is harvested.','Other-Clan operators require Milling 10.'],restrictions:['10 Oilmills per Clan.','100 Oilmill workers per turn stated by source.','Windmills + Oilmills ≤ 100 per site.']})]
    }),
    t('Milling','Sawmill',6,122,{
      prerequisites:[sr('Milling 10','Milling'),sr('Forestry 4','Forestry')],
      effects:['Workers using a Sawmill produce ×8 their normal number of Logs.','Research topics that increase base Logs per Person still apply.'],
      recipe:recipe('Engineering',{item:'Sawmill',quantity:1},300,[{item:'Logs',quantity:250},{item:'Stone',quantity:625},{item:'Iron',quantity:500},{item:'Coal',quantity:4000}],[{name:'Engineering',level:6},{name:'Woodwork',level:4},{name:'Stonework',level:4}],'1 Sawmill: People 300, Eng 6, Wd 4, Stn 4, Logs 250, Stones 625, Iron 500, Coal 4000'),
      requirements:['The site must be in terrain that allows Forestry activities producing Logs.','The hex must have at least one River or Canal hexside.','A Tribe from another Clan using the Sawmill must have Forestry 4 or better.'],
      restrictions:['Maximum 100 Sawmills per site.','Maximum 100 people may use each Sawmill.','Workers using a Sawmill may not use an Adze or Saw.'],
      notes:['The source says extra Logs are shown as Transfers from 1263.'],
      affectsSkills:['Forestry'],
      relatedSkills:['Engineering','Woodwork','Stonework'],
      creates:[building('Sawmill',['Multiplies a user’s normal Log output by ×8.'],{recipe:recipe('Engineering',{item:'Sawmill',quantity:1},300,[{item:'Logs',quantity:250},{item:'Stone',quantity:625},{item:'Iron',quantity:500},{item:'Coal',quantity:4000}],[{name:'Engineering',level:6},{name:'Woodwork',level:4},{name:'Stonework',level:4}]),requirements:['Log-producing Forestry terrain.','At least one River or Canal hexside.','Other-Clan users need Forestry 4+.'],restrictions:['100 Sawmills per site.','100 users per Sawmill.','No Adze or Saw for Sawmill users.']})]
    }),
    t('Milling','Windmill',3,123,{
      effects:['Each Windmill converts 8,000 Grain into 12,000 Flour per month.','Each Windmill requires 40 Millers to supply Grain and remove Flour.'],
      recipe:recipe('Engineering',{item:'Windmill',quantity:1},500,[{item:'Logs',quantity:500},{item:'Stone',quantity:1000},{item:'Iron',quantity:500},{item:'Coal',quantity:1000},{item:'Millstones',quantity:2}],[{name:'Engineering',level:10},{name:'Woodwork',level:4},{name:'Stonework',level:4}],'1 Windmill: People 500, Eng 10, Wd 4, Stn 4, Logs 500, Stones 1000, Iron 500, Coal 1000, Millstones 2, Materials installed at normal rates'),
      leadsTo:[rr('Oilmill','Oilmill','Milling')],
      restrictions:['At a site, total Windmills + Oilmills must be no more than 100.'],
      notes:['Milling with Windmills and with Grain Hoppers require separate Orders; otherwise normal Milling is assumed.','May be built under Joint Project rules.'],
      relatedSkills:['Engineering','Woodwork','Stonework'],
      creates:[building('Windmill',['Converts 8,000 Grain into 12,000 Flour per month with 40 Millers.'],{recipe:recipe('Engineering',{item:'Windmill',quantity:1},500,[{item:'Logs',quantity:500},{item:'Stone',quantity:1000},{item:'Iron',quantity:500},{item:'Coal',quantity:1000},{item:'Millstones',quantity:2}],[{name:'Engineering',level:10},{name:'Woodwork',level:4},{name:'Stonework',level:4}]),requirements:['40 Millers to operate.'],restrictions:['Windmills + Oilmills ≤ 100 per site.']})]
    })
  );

  // Mining
  topics.push(
    t('Mining','Appropriate Mining Tool',4,125,{
      effects:['Allows a Miner to use both a Pick and a Shovel in the same turn.'],
      notes:['The source marks this rule as coded.'],
      affectsSkills:['Mining']
    }),
    t('Mining','Geology I',1,125,{
      prerequisites:[rr('Mining 11','Mining 11','Mining')],
      effects:['Adds +2 to Mining skill.','Unlocks Geology as a new Group C skill.'],
      leadsTo:[rr('Geology II','Geology II','Mining')],
      notes:['Books may be written.'],
      affectsSkills:['Mining'],
      relatedSkills:['Geology'],
      creates:[skillEntity('Geology',['Group C skill unlocked by Geology I research.','Used to access Geology research topics Geology IV and beyond.'])]
    }),
    t('Mining','Geology II',2,125,{
      prerequisites:[rr('Geology I','Geology I','Mining')],
      effects:['Adds +2 to Mining skill.'],
      leadsTo:[rr('Geology III','Geology III','Mining')],
      notes:['Books may be written.'],
      affectsSkills:['Mining'],
      relatedSkills:['Geology']
    }),
    t('Mining','Geology III',3,125,{
      prerequisites:[rr('Geology II','Geology II','Mining')],
      effects:['Adds +2 to Mining skill.'],
      leadsTo:[rr('Geology IV','Geology IV','Geology')],
      notes:['Books may be written.'],
      affectsSkills:['Mining'],
      relatedSkills:['Geology']
    }),
    t('Mining','Mining 11',5,126,{
      effects:['Raises Mining by +1.'],
      leadsTo:[rr('Geology I','Geology I','Mining')],
      affectsSkills:['Mining']
    }),
    t('Mining','Mining Ladder',5,126,{
      effects:['One Mining Ladder adds +100% Mining output for up to 10 Miners.','One Mining Ladder also adds +100% Digging output for up to 10 Diggers.','The bonus is cumulative with Picks, Shovels, Ore Carts, Seam Wedges and similar implements, but additive rather than compounded.'],
      recipe:recipe('Construction',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}],'People 15, Wd3, Mtl3, Log 4, Iron 25, Coal 150'),
      notes:['In GM Actions, state how many Mining Ladders are being used. The source example has 100 Miners using 10 Ladders represented as 100 Auxiliaries and 200 assigned to Mining.','Weight: 50 lb.','The source also lists this research under Engineering, Metalwork and Woodwork.'],
      affectsSkills:['Mining','Digging'],
      relatedSkills:['Engineering','Metalwork','Woodwork'],
      creates:[item('Mining Ladder',['Adds +100% output for up to 10 Miners and +100% for up to 10 Diggers.','Stacks additively with other mining implements.'],{recipe:recipe('Construction',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}]),notes:['Weight: 50 lb.']})]
    }),
    t('Mining','Ore Cart',5,127,{
      effects:['One Ore Cart adds +100% Mining output for up to 10 Miners.','The bonus is cumulative with other Mining implements such as Picks, Shovels, Mining Ladders and Seam Wedges.'],
      recipe:recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Iron',quantity:15},{item:'Coal',quantity:100}],[{name:'Woodwork',level:3}],'1 Ore Cart: People 12, Wdwork 3, Log 10, Iron 15, Coal 100 (Distinction None), Alt to Iron. Bronze/Brass 20, Coal 75',[
        recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Bronze',quantity:20},{item:'Coal',quantity:75}],[{name:'Woodwork',level:3}],'Bronze alternative'),
        recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Brass',quantity:20},{item:'Coal',quantity:75}],[{name:'Woodwork',level:3}],'Brass alternative')
      ]),
      notes:['Despite its name, an Ore Cart is not a vehicle and must be moved as equipment.','Weight: 200 lb.'],
      sourceGaps:['The recipe lists Woodwork 3 but does not explicitly state the production activity; the Compendium therefore leaves the activity as “Not stated”.'],
      affectsSkills:['Mining'],
      relatedSkills:['Woodwork'],
      creates:[item('Ore Cart',['Adds +100% Mining output for up to 10 Miners.','Moved as equipment, not as a vehicle.'],{recipe:recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Iron',quantity:15},{item:'Coal',quantity:100}],[{name:'Woodwork',level:3}],'',[
        recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Bronze',quantity:20},{item:'Coal',quantity:75}],[{name:'Woodwork',level:3}]),
        recipe('Not stated',{item:'Ore Cart',quantity:1},12,[{item:'Logs',quantity:10},{item:'Brass',quantity:20},{item:'Coal',quantity:75}],[{name:'Woodwork',level:3}])
      ]),notes:['Weight: 200 lb.']})]
    }),
    t('Mining','Salt Panning',6,127,{
      effects:['Completion creates a Salt Mine in one Prairie Hex chosen by the Clan.'],
      notes:['The source heading says “Salt Panning (See Salting)”.'],
      relatedSkills:['Salting']
    }),
    t('Mining','Seam Wedges',4,127,{
      effects:['One person using a Seam Wedge adds +50% Mining output when using a Pick or Shovel.'],
      recipe:recipe('Metalwork',{item:'Seam Wedge',quantity:1},1,[{item:'Iron',quantity:5},{item:'Coal',quantity:15}],[{name:'Metalwork',level:2}],'1 Seam Wedge: People 1, Mtl 2, Iron 5, Coal 15'),
      notes:['Weight: 1 lb.','The source also lists this research under Metalwork.'],
      affectsSkills:['Mining'],
      relatedSkills:['Metalwork'],
      creates:[item('Seam Wedge',['Adds +50% Mining output for a person using a Pick or Shovel.'],{recipe:recipe('Metalwork',{item:'Seam Wedge',quantity:1},1,[{item:'Iron',quantity:5},{item:'Coal',quantity:15}],[{name:'Metalwork',level:2}]),notes:['Weight: 1 lb.']})]
    })
  );

  R.registerBatch({
    id:'research-v2-batch-05',
    title:'Batch 5 · Leatherwork through Mining',
    pages:'110–128',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Leatherwork','Literacy','Maintain Boats','Mariner','Metalwork','Milking','Milling','Mining'],
    topics
  });
})();

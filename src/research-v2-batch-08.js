(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 08');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const sr = (label, skill) => ({ label, skill: skill || label, type:'skill' });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  // Shipwright
  topics.push(
    t('Shipwright','Improved Productivity I (ShipW 25)',4,185,{
      effects:['Every 3 workers assigned to building ships do the work of 4 effective workers.'],
      leadsTo:[rr('Improved Productivity II','Improved Productivity II','Shipwright')],
      notes:['The topic appears as “ShipW 25” in the auto sheet and must be entered with that name in research orders.','Until fully coded, add 1 Auxiliary for each 3 actual workers assigned to shipbuilding, then assign all 4 effective workers to the activity.'],
      sourceGaps:['Improved Productivity II is described only as planned/not yet finalised; no completed rule entry is supplied in this source.'],
      relatedSkills:['Shipbuilding']
    }),
    t('Shipwright','Drydock',4,185,{
      effects:['A worker using a Drydock counts as 1.5 effective shipbuilding workers.','One Drydock can support a maximum of 100 actual workers, allowing 100 workers to count as 150 effective workers.'],
      recipe:recipe('Construction',{item:'Drydock',quantity:1},130,[{item:'Logs',quantity:250}],[{name:'Engineering',level:6},{name:'Woodwork',level:10}],'1 Drydock: People 130, Eng 6, Wdw 10, Logs 250'),
      requirements:['One Drydock is required per 100 workers receiving the productivity benefit.'],
      notes:['Can be built for other Clans, which may use it with the normal benefit.','Additional effective workers are recorded in the Auxiliaries tab.'],
      relatedSkills:['Shipbuilding','Engineering','Woodwork'],
      creates:[building('Drydock',['Shipbuilding facility where each supported worker counts as 1.5 effective workers.'],{
        recipe:recipe('Construction',{item:'Drydock',quantity:1},130,[{item:'Logs',quantity:250}],[{name:'Engineering',level:6},{name:'Woodwork',level:10}]),
        requirements:['Supports up to 100 actual workers per Drydock.'],
        notes:['May be built for and used by another Clan.']
      })]
    })
  );

  // Siege Equipment
  topics.push(
    t('Siege Equipment','Trebuchet',6,188,{
      effects:['Trebuchets damage Walls by creating breaches and reducing the defender defensive-factor bonus.','Each Trebuchet consumes 5 Stones during combat.'],
      recipe:recipe('Siege Equipment',{item:'Trebuchet',quantity:1},30,[{item:'Logs',quantity:15},{item:'Rope',quantity:4},{item:'Iron',quantity:2},{item:'Coal',quantity:30},{item:'Stones',quantity:50}],[{name:'Siege Equipment',level:10}],'Source places this apparent build data in “Leads To”: People 30, Seq 10, Logs 15, Rope 4, Iron 2, Coal 30, Stones 50. Crew 4.'),
      requirements:['10 Warriors are required to operate a Trebuchet in combat.'],
      notes:['Weight: 2,000 lb.'],
      sourceIssues:['The source says Recipe n/a, but places apparent construction requirements in the “Leads To” field. The Compendium records those values as an apparent recipe while preserving the discrepancy.','The same line says “Crew 4”, while the description states that 10 Warriors operate the Trebuchet. Both values are preserved rather than reconciled.'],
      creates:[item('Trebuchet',['Siege engine that damages Walls and reduces defensive-factor bonuses by creating breaches.'],{
        recipe:recipe('Siege Equipment',{item:'Trebuchet',quantity:1},30,[{item:'Logs',quantity:15},{item:'Rope',quantity:4},{item:'Iron',quantity:2},{item:'Coal',quantity:30},{item:'Stones',quantity:50}],[{name:'Siege Equipment',level:10}]),
        requirements:['10 Warriors to operate in combat.','Consumes 5 Stones per Trebuchet per combat.'],
        notes:['Weight: 2,000 lb.','Source also contains a conflicting “Crew 4” value.']
      })]
    })
  );

  // Skinning
  topics.push(
    t('Skinning','Knife',2,189,{
      effects:['A person using a Knife doubles Skinning, Gutting and Boning output.','A Farmer using a Knife can harvest twice the normal number of acres.'],
      recipe:recipe('Metalwork',{item:'Knife',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}],'1 Knife: People 1, Mtl 3, Iron 1, Coal 6'),
      notes:['Weight: 1 lb.','The source also lists this research under Metalwork.','For Farming orders, a Farmer with a Knife is represented as 2 equivalent Farmers.'],
      affectsSkills:['Skinning','Gutting','Boning','Farming'],
      relatedSkills:['Metalwork'],
      creates:[item('Knife',['Doubles Skinning, Gutting and Boning output.','Doubles acres harvested by a Farmer.'],{
        recipe:recipe('Metalwork',{item:'Knife',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}]),
        notes:['Weight: 1 lb.']
      })]
    })
  );

  // Slavery
  topics.push(
    t('Slavery','Press Gang',5,190,{
      effects:['Once per year, an Element may enter a non-Village hex and enslave 50 + 4d12 Locals.'],
      restrictions:['May be used once per year.','The Element must be sent into a non-Village hex.']
    })
  );

  // Spying
  topics.push(
    t('Spying','Expert Spies',4,191,{
      effects:['Raises the chance of a successful Raid, Locate or Spy mission by 25% for units belonging to this Tribe.'],
      affectsSkills:['Spying']
    })
  );

  // Stonework
  topics.push(
    t('Stonework','Chisel',2,192,{
      effects:['A worker with a Chisel doubles Quarrying output to 10 Stones.','A Chisel may be combined with a Mattock for 15 Stones per worker.','A Chisel doubles the worker contribution to Stonework and to Art when producing stone items.'],
      recipe:recipe('Metalwork',{item:'Chisel',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:3}],'1 Chisel: People 1, Mtl 3, Iron 1, Coal 4'),
      notes:['Weight: 1 lb.','The source also lists this research under Metalwork.','For Stonework or stone Art, represent 1 worker with a Chisel as 2 workers.'],
      affectsSkills:['Quarrying','Stonework','Art'],
      relatedSkills:['Metalwork'],
      creates:[item('Chisel',['Doubles Quarrying output and can combine with a Mattock for 15 Stones.','Doubles worker output for Stonework and stone-item Art.'],{
        recipe:recipe('Metalwork',{item:'Chisel',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:3}]),notes:['Weight: 1 lb.']
      })]
    }),
    t('Stonework','Marble Statue',3,192,{
      effects:['Unlocks Marble Statues as a Trade Good craftable as an Art or Stonework activity.','Marble Statues may be sold at Fair and possibly at Trade Towns.','Completing the research causes a Marble mine hex to be placed near the chosen Home Village, Home City or other village.','Marble Statues may be used as improvements to Palaces and similar structures.'],
      recipe:recipe('Art / Stonework',{item:'Marble Statue',quantity:1},12,[{item:'Marble',quantity:200}],[{name:'Stonework',level:6},{name:'Art',level:6}],'12 People, Stn 6, Art 6, Marble 200'),
      requirements:['Stonework must be at least level 6 to craft the Statue.'],
      notes:['Weight: 500 lb.','On completing the research, contact the GM for placement of the Marble mine.','The source also lists this topic under Art.'],
      relatedSkills:['Art'],
      creates:[item('Marble Statue',['Trade Good craftable through Art or Stonework and usable as an improvement to Palaces and similar structures.'],{
        recipe:recipe('Art / Stonework',{item:'Marble Statue',quantity:1},12,[{item:'Marble',quantity:200}],[{name:'Stonework',level:6},{name:'Art',level:6}]),
        notes:['Weight: 500 lb.','Sellable at Fair and possibly Trade Towns.']
      }),building('Marble Mine',['Resource site placed near a selected village when Marble Statue research is completed.'])]
    }),
    t('Stonework','Scraper (Stone)',1,193,{
      effects:['A Stone Scraper doubles the rate of bark stripping.'],
      recipe:recipe('Stonework',{item:'Scraper',quantity:1},1,[{item:'Stone',quantity:1}],[{name:'Stonework',level:2}],'1 Scraper: People 1, Stn 2, Stone 1'),
      notes:['The source also lists this research under Forestry.','The source says this implement is coded.'],
      affectsSkills:['Forestry'],
      relatedSkills:['Forestry'],
      creates:[item('Scraper',['Doubles the rate of bark stripping.'],{recipe:recipe('Stonework',{item:'Scraper',quantity:1},1,[{item:'Stone',quantity:1}],[{name:'Stonework',level:2}])})]
    })
  );

  // Tactics
  topics.push(
    t('Tactics','Tactics 11',5,194,{
      effects:['Raises Tactics by +1, for example from Tactics 10 to Tactics 11.'],
      affectsSkills:['Tactics']
    }),
    t('Tactics','Wagon Laager',4,194,{
      effects:['Allows Defenders in field combat to form a wagon laager that provides an effect equivalent to a Palisade when the unit has a Defend order.'],
      requirements:['1 Wagon or Ore Cart is required per 10 Warriors.','The unit must be defending in the field.'],
      restrictions:['Cannot be used in Mountains, Forests, Swamps or Jungle.','The source describes the benefit for Defenders only.'],
      relatedSkills:['Combat']
    })
  );

  // Tanning
  topics.push(
    t('Tanning','Cascade Tanning Pits',3,196,{
      effects:['A worker using Cascade Tanning Pits can process 8 Leather from 8 Skins and 20 Bark.','One Cascade Tanning Pit serves all Tanners in the Village.','The source summary describes this as doubling Tanning output.'],
      recipe:recipe('Construction',{item:'Cascade Tanning Pits',quantity:1},100,[{item:'Stone',quantity:500},{item:'Rope',quantity:30},{item:'Logs',quantity:200}],[{name:'Engineering',level:4}],'Tanning Pits: 500 Stone, 30 Rope, 200 Logs, Eng 4, 100 People to install'),
      relatedSkills:['Engineering'],
      creates:[building('Cascade Tanning Pits',['Village facility allowing one worker to process 8 Leather from 8 Skins and 20 Bark and serving all Tanners at the Village.'],{
        recipe:recipe('Construction',{item:'Cascade Tanning Pits',quantity:1},100,[{item:'Stone',quantity:500},{item:'Rope',quantity:30},{item:'Logs',quantity:200}],[{name:'Engineering',level:4}])
      })]
    })
  );

  // Torture
  topics.push(
    t('Torture','Dungeon','*See Engineering',197,{
      description:'The Torture section delegates the Dungeon research entry to Engineering rather than repeating the rule text here.',
      prerequisites:[rr('Dungeon','Dungeon','Engineering')],
      sourceGaps:['DL, prerequisites, recipe, leads-to and detailed effect are all given only as “See Engineering” in this Torture entry.'],
      relatedSkills:['Engineering']
    }),
    t('Torture','Thumb Screws',3,197,{
      effects:['Normally Torture allows one question per discrete captured group; Thumb Screws allow one additional question per captured group.'],
      recipe:recipe('Metalwork',{item:'Thumb Screws',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:2}],[{name:'Metalwork',level:4}],'1 Thumb Screws: People 1, Mtl 4, Iron 1, Coal 2'),
      notes:['The rule applies per discrete captured group, not per individual scout.'],
      relatedSkills:['Metalwork'],
      creates:[item('Thumb Screws',['Allows one additional Torture question per discrete captured group.'],{recipe:recipe('Metalwork',{item:'Thumb Screws',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:2}],[{name:'Metalwork',level:4}])})]
    })
  );

  // Triball
  topics.push(
    t('Triball','Inactive Players',5,198,{
      prerequisites:[rr('Triball Guild','Triball Guild','Triball')],
      effects:['Inactives may perform up to one-half of the Triball activities for a Triball Guild or for normal Triball Silver generation during Fair.'],
      requirements:['The Clan must be a member of a Triball Guild.']
    }),
    t('Triball','Large Teams',5,198,{
      prerequisites:[rr('Triball Guild','Triball Guild','Triball')],
      effects:['Allows Triball Guild members to assign twice the normal number of Warriors, Horses and Clubs to Gold-generation calculations, up to 1,600 of each.'],
      requirements:['The Tribe must be the Guild Master of a Triball Guild.']
    }),
    t('Triball','Off Season',3,198,{
      prerequisites:[rr('Triball Guild','Triball Guild','Triball')],
      effects:['Allows Triball Guild activity in non-Fair months 1 and 7 in addition to normal Fair months.','During these Off Season months the cost rises from 250 Silver-equivalent per Gold to 1,000 per Gold.'],
      requirements:['The Tribe must be the Guild Master of a Triball Guild.'],
      notes:['The source summary describes this as allowing Triball Guild operation four times per year rather than twice.']
    }),
    t('Triball','Triball Arena',5,199,{
      effects:['During each Fair, the owner of a Triball Arena receives +50% Silver from Triball.'],
      recipe:recipe('Construction',{item:'Triball Arena',quantity:1},3000,[{item:'Stone',quantity:15000}],[{name:'Engineering',level:8},{name:'Triball',level:10}],'Triball Arena: People 3k, Eng 8 and Triball 10, Stone 15k',[
        recipe('Construction',{item:'Triball Arena',quantity:1},3000,[{item:'Stone',quantity:15000}],[{name:'Engineering',level:10},{name:'Triball',level:8}],'Alternative listed by source: People 3k, Eng 10 and Triball 8, Stone 15k')
      ]),
      notes:['A Triball Arena may be built for another Clan.'],
      relatedSkills:['Engineering'],
      creates:[building('Triball Arena',['Provides +50% Silver from Triball during each Fair.'],{
        recipe:recipe('Construction',{item:'Triball Arena',quantity:1},3000,[{item:'Stone',quantity:15000}],[{name:'Engineering',level:8},{name:'Triball',level:10}],'',[
          recipe('Construction',{item:'Triball Arena',quantity:1},3000,[{item:'Stone',quantity:15000}],[{name:'Engineering',level:10},{name:'Triball',level:8}])
        ]),notes:['May be built for another Clan.']
      })]
    }),
    t('Triball','Triball 11',5,199,{
      effects:['Raises Triball by +1, for example from Triball 10 to Triball 11.'],
      affectsSkills:['Triball']
    }),
    t('Triball','Triball Club',3,200,{
      effects:['If all Warriors in a Triball activity have Triball Clubs, generated Silver or Gold-calculation value is doubled.','If only part of the force has Triball Clubs, apply a proportional bonus.'],
      recipe:recipe('Woodwork',{item:'Triball Club',quantity:1},1,[{item:'Logs',quantity:1},{item:'Brass',quantity:1}],[{name:'Woodwork',level:4}],'1 Triball Club: People 1, Wd 4, Log 1, Brass 1'),
      notes:['Weight: 5 lb.','The source examples show a 50/50 split between normal Clubs and Triball Clubs producing a ×1.5 result.'],
      creates:[item('Triball Club',['Doubles Triball Silver/Gold-generation value when the entire assigned force is equipped, with proportional scaling for partial equipment.'],{recipe:recipe('Woodwork',{item:'Triball Club',quantity:1},1,[{item:'Logs',quantity:1},{item:'Brass',quantity:1}],[{name:'Woodwork',level:4}]),notes:['Weight: 5 lb.']})]
    }),
    t('Triball','Triball Guild',2,200,{
      effects:['Creates a public Triball Guild structure that allows members to run a separate Triball Minor League activity during each Fair month.','The Minor League activity is independent of normal Triball, allowing an additional 800 Warriors, 800 Horses and 800 Clubs to be assigned during Fair.','Minor League Gold equals the Silver value produced by the standard Fair Triball calculation divided by 250, rounded down.','The Guild Master receives 5 Gold annually for each Guild member, paid on turn 1 using the membership recorded when the preceding turn-12 TribeNews is published.'],
      recipe:recipe('Construction',{item:'Minor League Arena',quantity:1},1500,[{item:'Stone',quantity:7500}],[{name:'Engineering',level:6},{name:'Triball',level:6}],'1 Minor League Arena: People 1.5k, Eng 6, Tri 6, Stone 7.5k'),
      leadsTo:[rr('Large Teams','Large Teams','Triball')],
      requirements:['A member needs access to a Minor League Arena to perform the Guild activity.','Guild activity is available in normal Fair months 4 and 10 unless modified by additional research.'],
      restrictions:['A Triball Guild is limited to 10 Clans total, including the Guild Master.','A Clan may be a member of only one Guild of each type; Triball Guild is explicitly not an exclusive Guild.'],
      notes:['Guild formation is public and is reported in TribeNews/public portals. Membership requires a Guild Master invitation and explicit acceptance, both copied to the GM.','Members may resign by notifying the Guild Master and GM; benefits end from the resignation date. Members may be removed by a 60% membership vote, with the Guild Master counting as two votes.','A Guild may adopt a public Constitution agreed with the GM. If the Guild Master can no longer run the Guild, the GM may appoint a deputy from existing members; otherwise the Guild dissolves.'],
      relatedSkills:['Engineering'],
      creates:[building('Minor League Arena',['Required facility for participating in a Triball Guild Minor League activity.'],{
        recipe:recipe('Construction',{item:'Minor League Arena',quantity:1},1500,[{item:'Stone',quantity:7500}],[{name:'Engineering',level:6},{name:'Triball',level:6}])
      })]
    })
  );

  // Weapons
  topics.push(
    t('Weapons','Crossbow',6,203,{
      effects:['Unlocks the Crossbow, described as a heavy arbalest with normal missile range.'],
      recipe:recipe('Weapons',{item:'Crossbow',quantity:1},4,[{item:'Iron',quantity:5},{item:'Coal',quantity:40},{item:'String',quantity:1},{item:'Silver',quantity:30}],[{name:'Weapons',level:8}],'Iron recipe',[
        recipe('Weapons',{item:'Crossbow',quantity:1},4,[{item:'Bronze',quantity:5},{item:'Coal',quantity:30},{item:'String',quantity:1},{item:'Silver',quantity:30}],[{name:'Weapons',level:8}],'Bronze recipe')
      ]),
      restrictions:['Crossbows may not be made in Desert or Arid terrain.'],
      notes:['Weight: 6 lb.','The source summary calls the Crossbow armour-penetrating, but the detailed description supplies no numeric armour-penetration mechanic.'],
      creates:[item('Crossbow',['Heavy arbalest with normal missile range.'],{
        recipe:recipe('Weapons',{item:'Crossbow',quantity:1},4,[{item:'Iron',quantity:5},{item:'Coal',quantity:40},{item:'String',quantity:1},{item:'Silver',quantity:30}],[{name:'Weapons',level:8}],'',[
          recipe('Weapons',{item:'Crossbow',quantity:1},4,[{item:'Bronze',quantity:5},{item:'Coal',quantity:30},{item:'String',quantity:1},{item:'Silver',quantity:30}],[{name:'Weapons',level:8}])
        ]),restrictions:['Cannot be made in Desert or Arid terrain.'],notes:['Weight: 6 lb.']
      })]
    }),
    t('Weapons','Katana',5,203,{
      effects:['A Katana is treated as equivalent to a Steel Sword and may appear as a Steel Sword in reports.'],
      recipe:recipe('Weapons',{item:'Katana',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}],[],'1 Katana: People 3, Iron 5, Coal 40'),
      notes:['Weight: 5 lb.','The source attributes the Steel-Sword equivalence to the folding process.'],
      creates:[item('Katana',['Functions as the equivalent of a Steel Sword.'],{recipe:recipe('Weapons',{item:'Katana',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}]),notes:['Weight: 5 lb.']})]
    }),
    t('Weapons','Repeating Arbalest',5,203,{
      effects:['Produces about one-third more casualties than a normal Arbalest.','Consumes 20 Quarrels per combat instead of the 5 used by a normal Arbalest.'],
      recipe:recipe('Weapons',{item:'Repeating Arbalest',quantity:1},4,[{item:'Iron',quantity:2},{item:'Coal',quantity:25},{item:'String',quantity:1}],[{name:'Weapons',level:9}],'1 R. Arbalest: People 4, Wpn 9, Iron 2, Coal 25, String 1'),
      notes:['Weight: 2 lb.'],
      creates:[item('Repeating Arbalest',['Produces about one-third more casualties than a normal Arbalest.','Uses 20 Quarrels per combat.'],{recipe:recipe('Weapons',{item:'Repeating Arbalest',quantity:1},4,[{item:'Iron',quantity:2},{item:'Coal',quantity:25},{item:'String',quantity:1}],[{name:'Weapons',level:9}]),notes:['Weight: 2 lb.']})]
    }),
    t('Weapons','Scimitar',8,204,{
      effects:['Unlocks a Scimitar, described as an upgraded curved Sword for Cavalry.'],
      recipe:recipe('Weapons',{item:'Scimitar',quantity:1},3,[{item:'Steel',quantity:5},{item:'Coke',quantity:20},{item:'Gold',quantity:2},{item:'Silver',quantity:20},{item:'Ivory',quantity:1}],[],'1 Scimitar: People 3, Steel 5, Coke 20, Gold 2, Silver 20, Ivory 1'),
      restrictions:['A maximum of 150 people across the Clan per turn may be assigned to making Scimitars.'],
      relatedSkills:['Combat'],
      creates:[item('Scimitar',['Upgraded curved Sword intended for Cavalry.'],{recipe:recipe('Weapons',{item:'Scimitar',quantity:1},3,[{item:'Steel',quantity:5},{item:'Coke',quantity:20},{item:'Gold',quantity:2},{item:'Silver',quantity:20},{item:'Ivory',quantity:1}]),restrictions:['Maximum 150 people per Clan per turn may make Scimitars.']})]
    }),
    t('Weapons','Ulfbehrt Sword',9,204,{
      effects:['Unlocks the Ulfbehrt Sword, described as a top-tier Sword used only by Infantry.'],
      recipe:recipe('Weapons',{item:'Ulfbehrt Sword',quantity:1},4,[{item:'Steel',quantity:5},{item:'Coke',quantity:30},{item:'Silver',quantity:40}],[],'1 Ulfbehrt Sword: People 4, Steel 5, Coke 30, Silver 40'),
      restrictions:['Used only by Infantry.','A maximum of 200 people across the Clan per turn may be assigned to making Ulfbehrt Swords.'],
      relatedSkills:['Combat'],
      creates:[item('Ulfbehrt Sword',['Top-tier Sword intended for Infantry only.'],{recipe:recipe('Weapons',{item:'Ulfbehrt Sword',quantity:1},4,[{item:'Steel',quantity:5},{item:'Coke',quantity:30},{item:'Silver',quantity:40}]),restrictions:['Infantry only.','Maximum 200 people per Clan per turn may make Ulfbehrt Swords.']})]
    })
  );

  R.registerBatch({
    id:'research-v2-batch-08',
    title:'Batch 8 · Shipwright through Weapons',
    pages:'185–204',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Shipwright','Siegecraft','Siege Equipment','Skinning','Slavery','Spying','Stonework','Tactics','Tanning','Torture','Triball','Waxworks','Weapons'],
    skillNotes:[
      {skill:'Siegecraft',page:187,status:'source-empty',note:'The Research List contains a Siegecraft heading on page 187 but lists no research topics beneath it in this source edition.'},
      {skill:'Waxworks',page:202,status:'source-empty',note:'The Research List contains a Waxworks heading on page 202 but lists no research topics beneath it in this source edition.'}
    ],
    topics
  });
})();
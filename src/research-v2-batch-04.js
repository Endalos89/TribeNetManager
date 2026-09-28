(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 04');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const skillEntity = (name, effects=[], extra={}) => ({ name, kind:'skill', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  // Healing
  topics.push(
    t('Healing','Healing 11',5,94,{
      effects:['Raises Healing by +1, for example from Healing 10 to Healing 11.'],
      affectsSkills:['Healing']
    }),
    t('Healing','Hospital',8,94,{
      prerequisites:[rr('Medicine 1','Medicine 1','Healing')],
      effects:['A Hospital adds +0.4% population growth.','In combat conducted in the Village containing the Hospital, it adds +4 to Healing.','One Hospital serves all Tribes of one Clan at the site.'],
      recipe:recipe('Engineering',{item:'Hospital',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}],[{name:'Engineering',level:9}],'Hospital: People 1250, Eng9, Stones 5000, Logs 500'),
      requirements:['Healing must be at least level 10 for the population-growth benefit to be applied.','A Tribe using a Hospital built for it by another Tribe must possess Hospital research.'],
      restrictions:['The maximum population-growth bonus for any one unit is 1.0%.'],
      notes:['The source says population benefits are automatically credited each turn once the requirements are satisfied.'],
      affectsSkills:['Healing'],
      relatedSkills:['Engineering'],
      creates:[building('Hospital',['Adds +0.4% population growth.','Adds +4 Healing for combat in the Village where it is located.'],{recipe:recipe('Engineering',{item:'Hospital',quantity:1},1250,[{item:'Stone',quantity:5000},{item:'Logs',quantity:500}],[{name:'Engineering',level:9}]),requirements:['Healing 10+ for the population-growth modifier.','Other Tribes require Hospital research to use a Hospital built for them.'],restrictions:['Population-growth bonuses are capped at 1.0% per unit.']})]
    }),
    t('Healing','Medicine 1',6,94,{
      effects:['Adds +0.2% population growth to the Tribe and its units.','The Tribe and its units count as having +4 Healing for combat-related healing.'],
      leadsTo:[rr('Medicine 2','Medicine 2','Healing')],
      restrictions:['The maximum population-growth bonus for any one unit is 1.0%.'],
      notes:['Books may be written.','The population modifier is applied manually. New units or converted units require the player to notify the GM so the modifier can be applied.'],
      affectsSkills:['Healing']
    }),
    t('Healing','Medicine 2',6,95,{
      prerequisites:[rr('Medicine 1','Medicine 1','Healing')],
      effects:['Adds a further +0.2% population growth beyond Medicine 1.','The combined Medicine description states that the Tribe and its units count as having +4 Healing for combat-related healing.'],
      restrictions:['The maximum population-growth bonus for any one unit is 1.0%.'],
      notes:['Books may be written.','The population modifier is applied manually. New units or converted units require the player to notify the GM so the modifier can be applied.'],
      sourceGaps:['The source does not state that Medicine 2 adds a second +4 Healing bonus; it describes a +4 temporary Healing boost for the Medicine research set.'],
      affectsSkills:['Healing']
    }),
    t('Healing','Seek Herbs',3,95,{
      effects:['Triples Herb finds when Seeking with the same number of people.','The tripled figure is applied after Horses, Backpacks and similar modifiers have been applied.'],
      relatedSkills:['Seeking']
    }),
    t('Healing','Triage',4,95,{
      effects:['Reduces Herbs, Salves and similar healing items consumed after combat by 25%.'],
      requirements:['The Tribe possessing Triage must be present in the combat hex for the saving to apply.'],
      affectsSkills:['Healing']
    })
  );

  // Heavy Weapons
  topics.push(
    t('Heavy Weapons','Artillerists',5,97,{
      prerequisites:[rr('Heavy Weapons 11','Heavy Weapons 11','Heavy Weapons')],
      effects:['In Siege or Assault, the owning Tribe counts its Heavy Weapons skill as +2 higher.'],
      affectsSkills:['Heavy Weapons']
    }),
    t('Heavy Weapons','Heavy Weapons 11',5,97,{
      effects:['Raises Heavy Weapons by +1, for example from Heavy Weapons 10 to Heavy Weapons 11.'],
      affectsSkills:['Heavy Weapons']
    })
  );

  // Herding
  topics.push(
    t('Herding','Angora Goats',5,98,{
      effects:['All Goats in the Clan are treated as Angora Goats.','Angora Goats may be sheared for Cotton in months 6 and 12.','One person can shear 10 Goats; each Goat produces 15 Cotton, so one person with 10 Goats produces 150 Cotton.'],
      requirements:['Only the Tribe with the research and its Elements may perform the shearing.','Population used for shearing in months 6 and 12 must not be assigned to other tasks that turn.'],
      notes:['Until Shearing is coded, the player manually reports the action and uses autotransfer to move Cotton from 1263 to the unit performing the shearing.'],
      relatedSkills:['Herding']
    }),
    t('Herding','Dairy Cattle',6,98,{
      effects:['Unlocks the Milking activity and the Group A Milking skill.','Unlocks the Cheesemaking activity and the Group C Cheesemaking skill.','One person milks 10 reusable Cattle to produce 100 Milk.','One person converts 90 Milk into 30 Cheese.','10 Milk is consumed as 1 Provision; 1 Cheese is consumed as 1 Provision.'],
      requirements:['Milk must be used in the turn it is produced or it is lost.'],
      restrictions:['Milk cannot be produced in Desert or Arid terrain.','Milking allows 10 Milkers per skill level, unlimited at Milking 10.','Cheesemaking allows 10 Cheesemakers per skill level, unlimited at Cheesemaking 10.'],
      notes:['Milk may be used as either provisions or water.'],
      creates:[
        skillEntity('Milking',['Group A skill unlocked by Dairy Cattle research.','Allows 10 Milkers per level, unlimited at level 10.']),
        skillEntity('Cheesemaking',['Group C skill unlocked by Dairy Cattle research.','Allows 10 Cheesemakers per level, unlimited at level 10.']),
        item('Milk',['Produced by Milking.','10 Milk is consumed as 1 Provision and Milk may also be used as water.'],{recipe:recipe('Milking',{item:'Milk',quantity:100},1,[{item:'Cattle',quantity:10,note:'Reusable'}],[],'100 Milk: 1 Person, 10 Cattle (Reusable)'),restrictions:['Must be used in the turn produced or it is lost.','Cannot be produced in Desert or Arid terrain.']}),
        item('Cheese',['Consumed as provisions at 1 Cheese = 1 Provision.'],{recipe:recipe('Cheesemaking',{item:'Cheese',quantity:30},1,[{item:'Milk',quantity:90}],[],'30 Cheese: 1 Person, 90 Milk')})
      ],
      relatedSkills:['Milking','Cheesemaking']
    }),
    t('Herding','Expert Breeding',6,99,{
      effects:['Adds +3 to Herding for the purpose of Herd Growth.'],
      notes:['The source says the player must notify the GM when the research first becomes active so the Herding skill can be manually adjusted to 13.'],
      affectsSkills:['Herding']
    }),
    t('Herding','Herding 11',5,99,{
      effects:['Raises Herding to level 11.'],
      leadsTo:[rr('Herding 12','Herding 12','Herding')],
      affectsSkills:['Herding']
    }),
    t('Herding','Herding 12',6,99,{
      prerequisites:[rr('Herding 11','Herding 11','Herding')],
      effects:['Raises Herding to level 12.'],
      leadsTo:[rr('Herding 13','Herding 13','Herding')],
      sourceGaps:['Herding 13 is referenced as the next prerequisite target, but no Herding 13 research entry appears in this batch of the source.'],
      affectsSkills:['Herding']
    }),
    t('Herding','Hunting Dogs',6,100,{
      effects:['A Hunter with one Hunting Dog counts as three Hunters; the Dog therefore contributes the equivalent of two additional Hunters.','Dogs may be converted into Hunting Dogs.','Hunting Dogs are used automatically when available.'],
      restrictions:['Hunting Dogs do not breed.'],
      notes:['The source says to use Auxiliaries until this is coded.'],
      affectsSkills:['Hunting'],
      relatedSkills:['Hunting'],
      creates:[item('Hunting Dog',['When assigned to Hunting, one Hunter with one Hunting Dog counts as three Hunters.'],{restrictions:['Hunting Dogs do not breed.'],notes:['Created by converting Dogs after researching Hunting Dogs.']})]
    })
  );

  // Horsemanship
  topics.push(
    t('Horsemanship','Close Formation (Close Order Cavalry)',4,101,{
      prerequisites:[{label:'Horsemanship 10',skill:'Horsemanship',type:'skill'},{label:'Tactics 5',skill:'Tactics',type:'skill'}],
      effects:['Adds +3 effective Horsemanship.'],
      affectsSkills:['Horsemanship'],
      relatedSkills:['Tactics']
    }),
    t('Horsemanship','Horsemanship 11',5,101,{
      effects:['Raises Horsemanship by +1, for example from Horsemanship 10 to Horsemanship 11.'],
      affectsSkills:['Horsemanship']
    }),
    t('Horsemanship','Triball Maneuvers',4,101,{
      effects:['When the entire Triball team is mounted, adds +2 effective Triball skill.','The bonus may be combined with Triball Saddles.'],
      requirements:['Every member of the Triball team must be mounted for the bonus to apply.'],
      affectsSkills:['Triball'],
      relatedSkills:['Triball']
    })
  );

  // Hunting
  topics.push(
    t('Hunting','Advanced Trap',4,102,{
      prerequisites:[rr('Improved Trap','Improved Trap','Metalwork'),rr('Improved Trap','Improved Trap','Furrier')],
      effects:['One Hunter/Furrier using one Advanced Trap gains +1.0 effective Hunting, so one Hunter counts as two.','Advanced Traps may be used by units that do not possess the research.'],
      recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}],'1 Advanced Trap: People 2, Mtl 10, Iron 2, Coal 8'),
      restrictions:['A Hunter/Furrier using an Advanced Trap may use one Advanced Trap and no standard or Improved Traps at the same time.'],
      relatedSkills:['Furrier','Metalwork'],
      affectsSkills:['Hunting'],
      creates:[item('Advanced Trap',['One trap gives one Hunter/Furrier +1.0 effective Hunting, making one Hunter count as two.','May be used without owning the research.'],{recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}]),restrictions:['One Advanced Trap per Hunter/Furrier; do not combine with standard or Improved Traps.']})]
    }),
    t('Hunting','Hunting 11',5,102,{
      effects:['Raises Hunting by +1, for example from Hunting 10 to Hunting 11.'],
      affectsSkills:['Hunting']
    }),
    t('Hunting','Hunting Dogs',6,103,{
      effects:['A Hunter with one Hunting Dog counts as three Hunters; the Dog contributes the equivalent of two additional Hunters.','Dogs may be converted into Hunting Dogs.','Hunting Dogs are used automatically when available.'],
      restrictions:['Hunting Dogs do not breed.'],
      notes:['The source advises converting only when a significant number can be converted, giving more than 100 as an example.','Until coded, assign two Auxiliaries for each Hunting Dog used.'],
      relatedSkills:['Herding'],
      affectsSkills:['Hunting'],
      creates:[item('Hunting Dog',['When assigned to Hunting, one Hunter with one Hunting Dog counts as three Hunters.'],{restrictions:['Hunting Dogs do not breed.'],notes:['Created by converting Dogs after researching Hunting Dogs.','Source guidance suggests converting significant batches, e.g. over 100.']})]
    }),
    t('Hunting','Improved Trap',2,103,{
      effects:['Each Improved Trap adds +0.15 effective Hunting rather than the +0.10 standard Trap bonus.','Five Improved Traps provide +0.75 effective Hunting.'],
      recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}],'1 Improved Trap: People 1, Mtl 3, Iron 1, Coal 6'),
      leadsTo:[rr('Advanced Trap','Advanced Trap','Furrier'),rr('Advanced Trap','Advanced Trap','Metalwork')],
      restrictions:['The standard limit of five traps per Hunter applies.','A Hunter/Furrier using Improved Traps may not mix them with standard Traps.'],
      relatedSkills:['Furrier','Metalwork'],
      affectsSkills:['Hunting'],
      creates:[item('Improved Trap',['Adds +0.15 effective Hunting per trap; five provide +0.75.'],{recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}]),restrictions:['Up to five per Hunter under the normal trap limit; do not mix with standard Traps.']})]
    }),
    t('Hunting','Mongol Hunt',4,104,{
      effects:['With at least 1,000 Hunters, multiplies the base Hunter workforce by 1.2: 1,000 Hunters count as 1,200.','The 20% increase applies to people, not equipment.'],
      leadsTo:[rr('Mongol Hunt 2','Mongol Hunt 2','Hunting')],
      requirements:['At least 1,000 Hunters are required.'],
      notes:['The current code base automatically adds the extra 20% base Hunters.'],
      affectsSkills:['Hunting']
    }),
    t('Hunting','Mongol Hunt 2',4,104,{
      prerequisites:[rr('Mongol Hunt','Mongol Hunt','Hunting')],
      effects:['With at least 1,000 Hunters, multiplies the base Hunter workforce by 1.4: 1,000 Hunters count as 1,400.','The 40% increase applies to people, not equipment.'],
      requirements:['At least 1,000 Hunters are required.'],
      notes:['For spreadsheet calculations, multiply ordinary Hunters by 1.4 and then add implements.','The current code base automatically adds the extra 40% base Hunters; virtual workers no longer need to be added manually.'],
      affectsSkills:['Hunting']
    }),
    t('Hunting','Trappers',4,104,{
      effects:['Allows each Hunter to use up to 10 standard Traps/Snares.','Allows each Hunter to use up to 10 Improved Traps.','Allows each Hunter to use up to 2 Advanced Traps.'],
      affectsSkills:['Hunting']
    })
  );

  // Intelligence
  topics.push(
    t('Intelligence','Collect Trade City Market Sheet',2,106,{
      effects:['Once per year, obtains a current market spreadsheet for any known Trade City.'],
      restrictions:['May be used once per year.']
    }),
    t('Intelligence','Goods Audit',2,106,{
      effects:['Once per year, reveals the highest quantity of one specified good held by any single unit in the game.','The result gives the quantity only and does not identify the Clan holding it.'],
      leadsTo:[rr('Goods Audit II','Goods Audit II','Intelligence')],
      restrictions:['No Books can be written on this topic.','The result concerns the largest quantity held by one unit, not the total held by a Clan.'],
      sourceIssues:['The source Leads To line says “Good Audit II”; the following topic is named “Goods Audit II”.']
    }),
    t('Intelligence','Goods Audit II',2,106,{
      prerequisites:[rr('Goods Audit','Goods Audit','Intelligence')],
      effects:['Provides a second Goods Audit use per year, revealing the highest quantity of a specified good held by any single unit without identifying the Clan.'],
      restrictions:['No Books can be written on this topic.','The result concerns the largest quantity held by one unit, not the total held by a Clan.']
    }),
    t('Intelligence','Informed Marketing',4,107,{
      effects:['Adds one additional slot at each Fair.'],
      restrictions:['No Books can be written on this topic.']
    }),
    t('Intelligence','Market Research',4,107,{
      effects:['Adds one additional slot at each Fair.','The topic is repeatable; each repeat increases the DL by 1.'],
      restrictions:['A maximum of four additional Fair slots may be gained from Market Research.']
    })
  );

  // Leadership
  topics.push(
    t('Leadership','Generalship',7,108,{
      prerequisites:[{label:'Leadership 10',skill:'Leadership',type:'skill'}],
      effects:['Unlocks the new Group B skill Generalship.','For all combat calculations, Leadership is increased by one-half of the Tribe’s Generalship skill, rounded down.'],
      leadsTo:[rr('Music In The Field','Music In The Field','Music')],
      creates:[skillEntity('Generalship',['Group B skill unlocked by Leadership research.','Adds half Generalship, rounded down, to Leadership for all combat calculations.'])],
      affectsSkills:['Leadership'],
      relatedSkills:['Generalship']
    }),
    t('Leadership','Junior Officer',5,108,{
      effects:['Adds +1 to Leadership.','Reduces rout severity by 5%.'],
      affectsSkills:['Leadership']
    }),
    t('Leadership','Leadership 11',5,109,{
      effects:['Raises Leadership by +1, for example from Leadership 10 to Leadership 11.'],
      affectsSkills:['Leadership']
    })
  );

  R.registerBatch({
    id:'research-04-healing-leadership',
    title:'Batch 4 · Healing through Leadership',
    pages:'94–109',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Healing','Heavy Weapons','Herding','Horsemanship','Hunting','Intelligence','Leadership'],
    skillNotes:[
      {skill:'Herding',page:98,status:'under-review',note:'The Herding section says “Numerous topics under review.” Listed topics are indexed individually, but the source warns that the wider Herding research set is under review.'},
      {skill:'Herding',page:100,status:'under-review',note:'The source separately marks “Herding Process” as under review.'}
    ],
    topics
  });
})();
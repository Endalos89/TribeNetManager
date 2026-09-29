(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'B',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  register('GARRISON', {
    name:'Garrison',
    aliases:['Gar'],
    researchAliases:['Garrison','Gar'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Special-unit capacity skill',
    levelDetail:'Each Garrison level permits one Garrison unit, subject to the current unit-designation ceiling of nine per Tribe.',
    primarySection:'8.7.8',
    additionalSections:['8.7.4','29.20'],
    workerRule:'Not a worker-cap skill',
    workerDetail:'Garrison level controls how many Garrison units the Tribe may have rather than how many people may perform an activity.',
    summary:'Controls immobile defensive Garrison units. Garrisons are independent of Administration capacity, normally do not move, and are intended to defend important hexes.',
    factors:[
      { factor:'Unit capacity', effect:'1 Garrison per skill level', detail:'Garrison 1 permits one Garrison, Garrison 2 permits two, and so on.' },
      { factor:'Administration', effect:'Independent of Admin', detail:'Garrisons do not consume the ordinary Element/Fleet capacity controlled by Administration.' },
      { factor:'Movement', effect:'Normally immobile', detail:'A Garrison may be transported by a Fleet using Follow, or by Ferry into an adjacent hex.' },
      { factor:'Creation', effect:'Created from a present unit', detail:'A Tribe, Element or Fleet is normally moved to the target hex before the Garrison is created.' },
      { factor:'Meeting House exception', effect:'Adjacent placement', detail:'If a Meeting House is present in the creation hex, the new Garrison may instead be placed in an adjacent hex through GM Actions.' },
      { factor:'Current hard limit', effect:'9 per Tribe', detail:'Current unit designations run from ####g1 to ####g9, limiting Garrisons to nine per Tribe even if skill effects would otherwise allow more.' },
      { factor:'Primary role', effect:'Defence', detail:'The Mandate identifies defending important hexes as the main role of Garrisons.' }
    ],
    relatedSkills:['Administration','Courier','Combat','Leadership','Security']
  });

  register('HEALING', {
    name:'Healing',
    aliases:['Heal'],
    researchAliases:['Healing','Heal'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Combat-recovery efficiency skill',
    levelDetail:'Healing improves the chance that wounded combatants recover; Herbs, weather, terrain and whether the force fled also affect recovery.',
    primarySection:'13.1.13',
    additionalSections:['17.11'],
    workerRule:'No worker limit',
    workerDetail:'Any Tribe member may heal. One healer can tend up to five wounded combatants, and Healing is only relevant when combat has produced wounded.',
    summary:'Improves treatment of wounded combatants. One healer can tend five wounded, Herbs help recovery, and researched Medicine/Hospitals can raise effective Healing further.',
    factors:[
      { factor:'Who may heal', effect:'Any Tribe member', detail:'Healing can be performed by any Tribe member.' },
      { factor:'Healer capacity', effect:'5 wounded / healer', detail:'One healer may tend up to five wounded combatants.' },
      { factor:'Herbs', effect:'Improve recovery', detail:'Herbs assist healing; after battle the Mandate states one Herb treats one wounded Warrior.' },
      { factor:'Weather', effect:'Affects recovery', detail:'Reasonable weather improves the chance of a wounded Warrior recovering.' },
      { factor:'Terrain', effect:'Affects recovery', detail:'Terrain is one of the stated factors affecting recovery.' },
      { factor:'Fleeing', effect:'Worse recovery', detail:'Not fleeing the battlefield improves recovery chances.' },
      { factor:'Orders', effect:'Not a normal Activity', detail:'Healing should not be entered as a routine Activity; it is relevant only if combat occurs.' }
    ],
    factTables:[{
      kicker:'Consumables',
      title:'Published Healing consumables',
      source:'17.11',
      columns:[{key:'item',label:'Item'},{key:'effect',label:'Healing effect'},{key:'detail',label:'Detail'}],
      rows:[
        { item:{entity:'Herbs',label:'Herbs'}, effect:'1 Herb treats 1 wounded Warrior', detail:'Herbs improve recovery, especially in the hands of skilled healers.' },
        { item:{entity:'Salve',label:'Salve'}, effect:'Counts as 2 Herbs', detail:'Apothecary research defines one Salve as the equivalent of two Herbs during combat Healing.' }
      ]
    }],
    researchEffectOverrides:{
      'Healing 11':'+1 Healing level.',
      'Hospital':'+4 effective Healing for combat in the Village containing the Hospital, plus +0.4% population growth; Healing 10 is required for the population benefit.',
      'Medicine 1, Medicine 2':'Each Medicine topic adds +0.2% population growth; Medicine provides +4 effective Healing for combat-related healing.',
      'Medicine 1':'+0.2% population growth and +4 effective Healing for combat-related healing.',
      'Medicine 2':'An additional +0.2% population growth; the Medicine line provides +4 effective Healing for combat-related healing.',
      'Seek Herbs':'Triples Herbs found through Seeking using the same number of people, after other Seeking modifiers are applied.',
      'Triage':'Reduces use of Herbs, Salves and other healing items by 25% when the research-holding Tribe is present at the combat hex.'
    },
    relatedSkills:['Apothecary','Seeking','Combat']
  });

  benefit('Herbs', { skill:'Healing', value:'1 Herb treats 1 wounded Warrior', detail:'Herbs improve post-combat recovery; the Mandate states one Herb treats one wounded Warrior.', source:'Mandate', section:'17.11' });

  register('HEAVY WEAPONS', {
    name:'Heavy Weapons',
    aliases:['HvyW','HWeapons'],
    researchAliases:['Heavy Weapons','HvyW','HWeapons'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Heavy-weapon combat efficiency skill',
    levelDetail:'Higher Heavy Weapons improves effectiveness when heavy weapons such as Ballistae are used in combat.',
    primarySection:'29.21',
    additionalSections:['17.5','18.4','18.4.1','18.4.2','17.15'],
    workerRule:'Weapon crews, not an activity cap',
    workerDetail:'Crew size depends on the weapon. Heavy Weapons modifies combat effectiveness rather than defining a general workforce limit.',
    summary:'Improves the use of heavy weapons in battle. Heavy weapons appear in ranged combat, sieges and naval combat, with crew, ammunition and deployment limits defined by weapon.',
    factors:[
      { factor:'Field combat', effect:'Ranged heavy-weapon role', detail:'Ballistae are listed with missile/ranged troops; each Ballista requires a crew of four.' },
      { factor:'Siege use', effect:'Breaching / counter-battery', detail:'Catapults and Trebuchets may reduce wall effectiveness; defensive Onagers and Mortars may counter attacking siege equipment.' },
      { factor:'Assault restriction', effect:'Siege weapons not used', detail:'Siege weapons are part of a Siege attack and are not used during an Assault because of friendly-fire risk.' },
      { factor:'Deployment limit', effect:'1 attacking piece / 20 yd wall', detail:'One piece of attacking siege equipment may be assigned per 20 yards of fortification.' },
      { factor:'Naval combat', effect:'Anti-personnel heavy weapons included', detail:'The Warrior-vs-Warrior component of naval combat includes archery, anti-personnel heavy weapons and hand-to-hand combat.' }
    ],
    factTables:[{
      kicker:'Mandate equipment',
      title:'Heavy weapons with published crew rules',
      source:'18.4',
      columns:[{key:'weapon',label:'Weapon'},{key:'horses',label:'Horses to move'},{key:'crew',label:'Warriors to man'},{key:'ammo',label:'Missile / placement'}],
      rows:[
        { weapon:{entity:'Ballista',label:'Ballista'}, horses:'2', crew:'4', ammo:'Shafts; uses 5 Shafts per Ballista.' },
        { weapon:{entity:'Onager',label:'Onager'}, horses:'—', crew:'4', ammo:'Stones; each Onager is placed in one Wooden or Stone Tower.' },
        { weapon:{entity:'Catapult',label:'Catapult'}, horses:'2', crew:'6', ammo:'Stones; if used in defence it is placed in one Stone Tower.' }
      ]
    }],
    researchEffectOverrides:{
      'Artillerists':'+2 effective Heavy Weapons in Siege/Assault for the owning Tribe.',
      'Heavy Weapons 11':'+1 Heavy Weapons level.'
    },
    relatedSkills:['Combat','Archery','Siege Equipment','Tactics','Mariner']
  });

  for (const weapon of ['Ballista','Onager','Catapult']) {
    benefit(weapon, { skill:'Heavy Weapons', value:'Uses Heavy Weapons in combat', detail:'This weapon is explicitly listed in the Mandate heavy-weapons rules.', source:'Mandate', section:'18.4' });
  }

  register('HORSEMANSHIP', {
    name:'Horsemanship',
    aliases:['Hor'],
    researchAliases:['Horsemanship','Hor'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Mounted-combat efficiency skill',
    levelDetail:'Higher Horsemanship improves effectiveness when Warriors fight mounted on Horses.',
    primarySection:'29.22',
    additionalSections:['17.5','17.7','17.9','17.13'],
    workerRule:'No activity worker cap',
    workerDetail:'Horsemanship applies to Warriors fighting as Cavalry; every Cavalry Warrior must have a Horse available.',
    summary:'Improves Cavalry effectiveness in land combat. Cavalry enters the general melee, requires one Horse per Warrior, and cannot be used by an attacker crossing a ford.',
    factors:[
      { factor:'Combat role', effect:'Cavalry melee', detail:'Mounted Warriors fight as Cavalry in the general melee.' },
      { factor:'Horse requirement', effect:'1 Horse per Cavalry Warrior', detail:'Each Warrior assigned as Cavalry must have a Horse available.' },
      { factor:'Fords', effect:'Attacking Cavalry prohibited', detail:'An attacker fighting while crossing a ford cannot use Cavalry.' },
      { factor:'General combat factors', effect:'Combined calculation', detail:'Numbers, terrain, weather, combat skills, terrain proficiency, weapons, armour, Combat Morale and research also affect the battle.' },
      { factor:'Naval combat', effect:'No Cavalry component', detail:'Naval combat explicitly has no Cavalry component.' }
    ],
    researchEffectOverrides:{
      'Close Formation':'+3 Horsemanship. Requires Horsemanship 10 and Tactics 5.',
      'Close Formation (Close Order Cavalry)':'+3 Horsemanship. Requires Horsemanship 10 and Tactics 5.',
      'Horsemanship 11':'+1 Horsemanship level.',
      'Triball Maneuvers':'+2 effective Triball when the entire Triball team is mounted; may combine with Triball Saddles.'
    },
    relatedSkills:['Combat','Tactics','Leadership','Triball']
  });

  benefit('Horse', { skill:'Horsemanship', value:'Required for Cavalry', detail:'Each Warrior assigned as Cavalry in combat must have a Horse available.', source:'Mandate', section:'17.5' });

  register('INTELLIGENCE', {
    name:'Intelligence',
    aliases:['Int'],
    researchAliases:['Intelligence','Int'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Information-access / level-unlock skill',
    levelDetail:'Intelligence level determines which questions the Clan may ask local informants.',
    primarySection:'13.1.16',
    additionalSections:[],
    workerRule:'No worker assignment',
    workerDetail:'Intelligence is an information request rather than a production activity. The Clan may make only one Intelligence request per 12 months regardless of skill level.',
    summary:'Unlocks increasingly specific information from locals, ranging from nearby terrain and base-ore mines to Special Hexes, cities, shipwrecks and exotic mineral or desired-commodity sources.',
    levelUses:[
      { level:3, use:'Nearest specified terrain', kind:'Information request', detail:'Nearest or close-to-nearest hex of a specified terrain type.', source:'13.1.16' },
      { level:3, use:'Nearest base-ore mine', kind:'Information request', detail:'Nearest mine of a specified base ore.', source:'13.1.16' },
      { level:4, use:'Nearest Rich Seeking hex', kind:'Information request', detail:'Nearest Rich Seeking hex.', source:'13.1.16' },
      { level:5, use:'Nearest Rich Seeking hex by type', kind:'Information request', detail:'Nearest Rich Seeking hex of a specified type A–E.', source:'13.1.16' },
      { level:6, use:'Two random Special Hexes', kind:'Information request', detail:'Coordinates of two random Special Hexes on a chosen map sheet; known ones may be excluded.', source:'13.1.16' },
      { level:7, use:'Lake-island enquiry', kind:'Information request', detail:'Ask local fishermen whether a particular map-sheet lake contains islands; yes/no answer.', source:'13.1.16' },
      { level:9, use:'Named city/town or Shipwreck', kind:'Information request', detail:'Location of a named International City or Trading Town, or a Shipwreck that need not be the closest and may already have been plundered.', source:'13.1.16' },
      { level:10, use:'Exotic mineral / desired commodity source', kind:'Information request', detail:'Nearest mineable source of the named exotic mineral or desired commodity: Diamonds, Silver, Jade, Frankincense, Rubies or Gold.', source:'13.1.16' }
    ],
    ruleGroups:[{
      title:'Request rules',
      source:'13.1.16',
      rows:[
        { label:'Frequency', values:['One request per Clan per 12 months, regardless of Intelligence level.'] },
        { label:'Distance', values:['Distance is linear distance, not movement points.'] },
        { label:'Reference point', values:['Any Tribe or subunit hex with the required Intelligence level may be used as the request reference point.'] },
        { label:'Timing', values:['The Mandate says Intelligence should be used in the week after receiving Reports.'] },
        { label:'Changing world', values:['Special Hexes, Towns and similar sites may appear over time, so old intelligence can become outdated.'] }
      ]
    }],
    researchEffectOverrides:{
      'Collect Trade City Market Sheet':'Once per year, obtain a current market spreadsheet for any known trade city.',
      'Goods Audit':'Once per year, learn the highest quantity of one specified good held by any single unit in the game, without learning which Clan holds it.',
      'Goods Audit II':'Allows the Goods Audit question a second time per year.',
      'Informed Marketing':'Adds one additional Fair slot.',
      'Market Research':'Adds one Fair slot; repeatable at +1 DL per extra slot, to a maximum of four additional slots.'
    },
    relatedSkills:['Spying','Scouting','Seeking','Economics','Diplomacy']
  });

  register('LEADERSHIP', {
    name:'Leadership',
    aliases:['Ldr'],
    researchAliases:['Leadership','Ldr'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Land-command efficiency skill',
    levelDetail:'Higher Leadership improves command effectiveness in land combat; Fleet combat uses Captaincy instead.',
    primarySection:'29.23',
    additionalSections:['17.9','17.15'],
    workerRule:'No activity worker cap',
    workerDetail:'Leadership is a combat command skill rather than a labour-cap skill.',
    summary:'Improves command in land combat. Leadership works alongside Combat and other battlefield factors, while Captaincy replaces Leadership in Fleet combat.',
    factors:[
      { factor:'Land combat', effect:'Improves command effectiveness', detail:'The Mandate states that Leadership enhances effectiveness in land combat.' },
      { factor:'Other combat factors', effect:'Combined calculation', detail:'Numbers, terrain, weather, combat skills, terrain proficiency, weapons, armour, Combat Morale and research all contribute to combat.' },
      { factor:'Naval combat', effect:'Replaced by Captaincy', detail:'Fleet combat uses Captaincy instead of Leadership.' }
    ],
    researchEffectOverrides:{
      'Generalship':'Unlocks the Group B Generalship skill; half Generalship level, rounded down, is added to Leadership for all combat calculations.',
      'Junior Officer':'+1 Leadership and reduces rout severity by 5%.',
      'Leadership 11':'+1 Leadership level.'
    },
    relatedSkills:['Combat','Captaincy','Tactics','Generalship','Mobilisation']
  });

  benefit('Field Glasses', { skill:'Leadership', value:'+2 Leadership', detail:'One pair present in a participating combat unit gives +2 Leadership to all units in Field combat; not Siege/Assault.', source:'Research', research:'Glasswork / Field Glasses' });

  register('MARINER', {
    name:'Mariner',
    aliases:['Mar'],
    researchAliases:['Mariner','Mar'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Naval-melee efficiency skill',
    levelDetail:'Mariner replaces Combat in Fleets and therefore governs effectiveness in naval melee.',
    primarySection:'29.26',
    additionalSections:['17.15'],
    workerRule:'No activity worker cap',
    workerDetail:'Mariner is used by Warriors in Fleet combat rather than controlling a production workforce.',
    summary:'The Fleet equivalent of Combat. Mariner replaces Combat in naval melee, while Captaincy replaces Leadership and Archery continues to use Archery.',
    factors:[
      { factor:'Naval melee', effect:'Replaces Combat', detail:'Mariner is used instead of Combat in Fleet combat.' },
      { factor:'Command skill', effect:'Captaincy replaces Leadership', detail:'Mariner governs melee effectiveness while Captaincy supplies Fleet command.' },
      { factor:'Archery', effect:'Archery remains Archery', detail:'The Archery skill is unchanged for the naval ranged component.' },
      { factor:'Cavalry', effect:'None', detail:'Naval combat has no Cavalry component.' },
      { factor:'Warrior availability', effect:'One-third rule + ship DP cap', detail:'Warriors able to fight are constrained both by the normal one-third availability rule and by the Defensive Points of their ships.' },
      { factor:'Combat phases', effect:'Ship battle then Warrior battle', detail:'Naval combat resolves ship-vs-ship first, followed by Warrior-vs-Warrior combat if capacity remains.' }
    ],
    researchEffectOverrides:{
      'Mariner 11':'+1 Mariner level.',
      'Mariner 12':'+1 Mariner level after Mariner 11.',
      'Marines':'+3 Mariner. Requires Mariner 10.',
      'Professional Sailor':'One professional sailor counts as 1.5 crew, reducing crew requirements by about 33%; requires Expert Sailors plus Navigation 10, Captaincy 10 and Sailing 10.'
    },
    relatedSkills:['Combat','Captaincy','Archery','Heavy Weapons','Seamanship','Navigation','Sailing']
  });
})();

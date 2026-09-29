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

  register('ADMINISTRATION', {
    name:'Administration',
    aliases:['Admin'],
    researchAliases:['Administration','Admin','Adm'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Unit-capacity / level-unlock skill',
    levelDetail:'Administration level determines how many ordinary Elements/Fleets a Tribe may maintain; higher even-numbered levels add another unit slot.',
    primarySection:'8.7.5',
    additionalSections:['8.7.4','29.1'],
    workerRule:'No activity worker cap',
    workerDetail:'Administration is not a production activity. Its main Mandate effect is the number of Elements/Fleets the Tribe may split off and maintain.',
    summary:'Controls ordinary Element/Fleet capacity for a Tribe and provides access to Administration research that can add unit slots or movement bonuses.',
    levelUses:[
      { level:2, use:'1 Element or Fleet', kind:'Unit capacity', detail:'At Administration 2 the Tribe may have one Element/Fleet, mobile or immobile.', source:'8.7.5' },
      { level:4, use:'2 Elements/Fleets', kind:'Unit capacity', detail:'At Administration 4 the Tribe may have two Elements/Fleets.', source:'8.7.5' },
      { level:6, use:'3 Elements/Fleets', kind:'Unit capacity', detail:'At Administration 6 the Tribe may have three Elements/Fleets.', source:'8.7.5' },
      { level:8, use:'4 Elements/Fleets', kind:'Unit capacity', detail:'At Administration 8 the Tribe may have four Elements/Fleets.', source:'8.7.5' },
      { level:10, use:'5 Elements/Fleets', kind:'Unit capacity', detail:'At Administration 10 the Tribe may have five Elements/Fleets.', source:'8.7.5' }
    ],
    researchEffectOverrides:{
      'Extra Element':'Adds one Element beyond the normal Administration limit; may be completed up to three times per Tribe.',
      'Extra Movement 4':'+4 MP to the Tribe and its Elements; does not apply to Fleets or Couriers.',
      'Extra Movement 6':'Adds another +2 MP to the Tribe and its Elements, for +6 MP total with Extra Movement 4; not Fleets/Couriers.',
      'Fleet Movement 4':'+4 MP to Fleets; does not apply to Tribes, Elements or Couriers. Also available via Seamanship.',
      'Fleet Movement 6':'Adds another +2 MP to Fleets, for +6 MP total with Fleet Movement 4. Also available via Seamanship.'
    },
    relatedSkills:['Garrison','Courier','Diplomacy','Seamanship']
  });

  register('APOTHECARY', {
    name:'Apothecary',
    aliases:['Apoth'],
    researchAliases:['Apothecary','Apoth'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'research-access',
    mechanicLabel:'Research-access skill',
    levelDetail:'The current Mandate defines Apothecary as a Group B research skill and does not give it a separate base activity or level-by-level production effect.',
    primarySection:'29.3',
    additionalSections:[],
    workerRule:'No base Apothecary activity',
    workerDetail:'Workers are assigned only when a specific researched activity or item requires them; the skill itself has no published base workforce rule.',
    summary:'A Group B research skill. Its currently published Research List topics unlock Hashish cultivation/trading and Salves for Healing.',
    factTables:[{
      kicker:'Current rule',
      title:'What Apothecary does now',
      source:'29.3',
      columns:[{key:'aspect',label:'Aspect'},{key:'detail',label:'Current published rule'}],
      rows:[
        { aspect:'Mandate role', detail:'Group B research skill.' },
        { aspect:'Base activity', detail:'No separate Apothecary activity or inherent level bonus is specified in the Mandate.' },
        { aspect:'Research', detail:'Published topics currently provide new products/uses rather than a generic Apothecary productivity formula.' }
      ]
    }],
    researchEffectOverrides:{
      'Hashish':'Maintaining one plot with 10 people each month can produce 1,000 Hashish in Spring month 03 after the initial six-month cultivation period; it may be traded at major cities.',
      'Salves':'1 Herb + 2 Silver makes 1 Salve as a Healing activity. One Salve counts as 2 Herbs during combat Healing; one person can convert 10 Herbs into 10 Salves.'
    },
    relatedSkills:['Healing']
  });

  benefit('Salve', { skill:'Healing', value:'Counts as 2 Herbs', detail:'During combat Healing, one Salve has the effect of two Herbs.', source:'Research', research:'Apothecary / Salves' });

  register('ARCHERY', {
    name:'Archery',
    aliases:['Arc'],
    researchAliases:['Archery','Arc'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Combat-efficiency skill',
    levelDetail:'Higher Archery improves effectiveness with missile weapons such as Slings, Bows and Arbalests; the detailed combat calculation is handled by the combat module.',
    primarySection:'29.5',
    additionalSections:['17.5','17.9','17.13','17.15'],
    workerRule:'No activity worker cap',
    workerDetail:'Archery modifies Warriors assigned as missile/ranged troops rather than controlling how many workers may perform an activity.',
    summary:'Improves missile combat on land and at sea. Missile troops fight in the ranged phase, are subject to the Tactics ranged-troop limit, and cannot employ shields.',
    factors:[
      { factor:'Combat role', effect:'Missile / ranged phase', detail:'Archers include slingers, bow users and arbalest users. Missile troops shoot before the general melee.' },
      { factor:'Ranged troop limit', effect:'25% + 1% per Tactics level', detail:'This percentage of Warriors assigned to defence may be deployed as ranged troops.' },
      { factor:'Shield restriction', effect:'No shield', detail:'Missile troops may carry other armour and a melee weapon, but cannot employ shields.' },
      { factor:'Fords', effect:'+4 Archery when defending', detail:'Defenders fighting while an enemy crosses a ford receive +4 to Archery and +4 to Combat; the attacker cannot use Cavalry.' },
      { factor:'Naval combat', effect:'Archery remains Archery', detail:'Unlike Combat and Leadership, Archery is not replaced by a naval skill in Fleet combat.' },
      { factor:'Other combat factors', effect:'Combined calculation', detail:'Numbers, terrain, weather, terrain proficiency, weapons, armour, Combat Morale and relevant research also affect combat.' }
    ],
    factTables:[{
      kicker:'Equipment',
      title:'Missile weapons explicitly associated with Archery',
      source:'29.5',
      columns:[{key:'weapon',label:'Weapon'},{key:'role',label:'Archery relationship'}],
      rows:[
        { weapon:{entity:'Sling',label:'Sling'}, role:'Missile weapon; Archery affects combat effectiveness.' },
        { weapon:{entity:'Bow',label:'Bow'}, role:'Missile weapon; Archery affects combat effectiveness.' },
        { weapon:{entity:'Arbalest',label:'Arbalest'}, role:'Missile weapon; Archery affects combat effectiveness.' }
      ]
    }],
    researchEffectOverrides:{
      'Archery 11':'+1 Archery level.',
      'Archery 12':'+1 Archery level after Archery 11.',
      'Marksmen':'+3 Archery.'
    },
    relatedSkills:['Tactics','Combat','Heavy Weapons','Mariner','Captaincy']
  });

  for (const weapon of ['Sling','Bow','Arbalest']) {
    benefit(weapon, { skill:'Archery', value:'Uses Archery in missile combat', detail:'Archery improves effectiveness when this missile weapon is used in combat.', source:'Mandate', section:'29.5' });
  }

  register('CAPTAINCY', {
    name:'Captaincy',
    aliases:['Capt'],
    researchAliases:['Captaincy','Capt'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Naval command-efficiency skill',
    levelDetail:'Captaincy replaces Leadership for Fleets and improves naval combat calculations, including command effects such as casualties and routing.',
    primarySection:'29.11',
    additionalSections:['17.15'],
    workerRule:'No activity worker cap',
    workerDetail:'Captaincy is a Fleet combat command skill; it modifies naval combat rather than controlling labour assignments.',
    summary:'The Fleet equivalent of Leadership. Captaincy is used for naval command while Mariner replaces Combat and Archery continues to use Archery.',
    factors:[
      { factor:'Naval command', effect:'Replaces Leadership', detail:'Captaincy is used instead of Leadership for Fleet combat.' },
      { factor:'Naval combat structure', effect:'Fleet-specific', detail:'Naval combat has ship-vs-ship and Warrior-vs-Warrior components; Captaincy is the command skill for the Fleet.' },
      { factor:'Warrior availability', effect:'Still limited', detail:'The normal one-third available-Warrior limit still applies, and deployed Warriors are also constrained by ship Defensive Points.' },
      { factor:'Related naval skills', effect:'Used together', detail:'Mariner replaces Combat, while Archery remains Archery in naval combat.' }
    ],
    researchEffectOverrides:{
      'Admiralty':'Unlocks the Group B Admiralty skill; half Admiralty level, rounded down, is added to Captaincy for all combat calculations.',
      'Captaincy 11':'+1 Captaincy level.',
      'Junior Naval Officer':'+1 Captaincy and reduces rout severity by 5%.',
      'Naval Second in Command (NSIC)':'+1 Captaincy Modifier for Potential Casualties and +2 Captaincy for other naval-combat uses such as routing.'
    },
    relatedSkills:['Leadership','Mariner','Archery','Admiralty','Seamanship']
  });

  register('COMBAT', {
    name:'Combat',
    aliases:['Com'],
    researchAliases:['Combat','Com'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Land melee-efficiency skill',
    levelDetail:'Higher Combat improves effectiveness during melee in land combat. Exact resolution includes hidden/random elements in the combat module.',
    primarySection:'29.12',
    additionalSections:['17.5','17.7','17.9','17.10','17.13','17.15'],
    workerRule:'No activity worker cap',
    workerDetail:'Combat modifies Warriors participating in melee rather than controlling an activity workforce.',
    summary:'Improves land melee combat. Its effect combines with numbers, terrain, weather, terrain proficiency, weapons, armour, morale and research; in Fleet combat Mariner replaces Combat.',
    factors:[
      { factor:'Combat role', effect:'General melee', detail:'Combat applies to land melee involving Infantry and Cavalry after the missile/ranged phase.' },
      { factor:'Numbers', effect:'Major factor', detail:'The Mandate identifies troop numbers as the biggest single factor influencing combat.' },
      { factor:'Terrain & weather', effect:'Modify combat', detail:'Terrain, weather and terrain proficiency all contribute to the combat calculation.' },
      { factor:'Weapons & armour', effect:'Modify combat', detail:'Assigned weapons and armour affect the result; melee troops may use a weapon plus armour in the permitted armour categories.' },
      { factor:'Combat Morale', effect:'Modify combat', detail:'Combat Morale and relevant research are explicit combat factors.' },
      { factor:'Fords', effect:'+4 Combat when defending', detail:'Defenders receive +4 Combat and +4 Archery while the opponent crosses a ford; the attacker cannot use Cavalry.' },
      { factor:'Naval combat', effect:'Replaced by Mariner', detail:'Fleet melee uses Mariner in place of Combat.' }
    ],
    factTables:[{
      kicker:'Resolution',
      title:'Published land-combat sequence',
      source:'17.7',
      columns:[{key:'phase',label:'Phase'},{key:'detail',label:'What happens'}],
      rows:[
        { phase:'1. Missile / ranged', detail:'Missile damage is resolved against enemy Archers, Cavalry and Infantry in ratio.' },
        { phase:'2. General melee', detail:'Surviving melee forces, including Infantry and Cavalry, fight the general melee.' }
      ]
    }],
    researchEffectOverrides:{
      'Assault Troops':'+2 Combat and +2 Assault Attack Terrain Proficiency; specialised for attacking fortifications.',
      'Close Order Infantry':'+3 Combat.',
      'Combat 11':'+1 Combat level.',
      'Combat 12':'+1 Combat level after Combat 11.',
      'Army':'+0.10 Combat Morale / roughly +10% outgoing Potential Casualties, provided the required Barracks capacity is maintained.',
      'Home Guard':'+0.5 Terrain Proficiency in an owned hex (base damage improvement stated as 10%); available from Combat 10 or Mobilisation 11.'
    },
    relatedSkills:['Leadership','Archery','Heavy Weapons','Horsemanship','Tactics','Mobilisation','Mariner']
  });

  register('COURIER', {
    name:'Courier',
    aliases:['Cour'],
    researchAliases:['Courier','Cour'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Special-unit capacity skill',
    levelDetail:'Each Courier level allows one Courier unit. Only one Tribe in a Clan may learn Courier.',
    primarySection:'8.7.9',
    additionalSections:['8.7.4','29.13'],
    workerRule:'Not a worker-cap skill',
    workerDetail:'Skill level controls the number of Courier units: one Courier per level, rather than the number of people assigned to an activity.',
    summary:'Controls fast trade-oriented Courier units. Couriers gain +14 MP, have restricted transfers and activities, cannot Scout or initiate combat, and cannot own Villages or act as Goods Tribes.',
    factors:[
      { factor:'Unit capacity', effect:'1 Courier per skill level', detail:'Courier 1 permits one Courier, Courier 2 permits two, and so on.' },
      { factor:'Clan restriction', effect:'One learning Tribe', detail:'Only one Tribe in the Clan may take the Courier skill.' },
      { factor:'Movement', effect:'+14 MP', detail:'Couriers receive a +14 movement-point bonus.' },
      { factor:'Routine activities', effect:'Broad but restricted', detail:'Couriers may Hunt, Furrier, Fish and Herd and perform one other Activity each turn. Security and Suppression are also permitted.' },
      { factor:'Prohibited activities', effect:'Cannot perform', detail:'Couriers cannot perform Engineering, Shipbuilding or Scouting.' },
      { factor:'Combat', effect:'Cannot initiate', detail:'Couriers may not initiate combat, but can be Raided or Attacked under normal engagement rules.' },
      { factor:'Transfers / spawning', effect:'Restricted', detail:'After creation, people transfer only with the parent Tribe or other Couriers in the same Tribe. Couriers cannot create sub-units or convert to another unit type.' },
      { factor:'Village / Goods Tribe', effect:'Not permitted', detail:'Couriers cannot own a Village and may not act as Goods Tribes.' },
      { factor:'Real-life turn cost', effect:'Lower than conventional Elements', detail:'The Mandate explicitly notes the lower real-life dollar cost; current dollar values are in the Costs section.' }
    ],
    relatedSkills:['Administration','Garrison','Hunting','Furrier','Fishing','Herding','Security']
  });

  register('DIPLOMACY', {
    name:'Diplomacy',
    aliases:['Dip'],
    researchAliases:['Diplomacy','Dip'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Clan-capacity / trade-unlock skill',
    levelDetail:'The highest Diplomacy in the Clan sets the maximum number of Tribes; Diplomacy 7 also qualifies a functioning Trading Post for Fair trading.',
    primarySection:'8.7.1',
    additionalSections:['14.14','29.16'],
    workerRule:'No activity worker cap',
    workerDetail:'Diplomacy is a Clan-structure and trade-access skill, not a production activity.',
    summary:'Controls how many Tribes a Clan may contain and provides one route into Fair trading. Diplomacy research adds information, desired commodities and Trade Envoys.',
    levelUses:[
      { level:'Any', use:'Clan Tribe capacity', kind:'Clan structure', detail:'The highest Diplomacy in the Clan permits one Tribe per Diplomacy level, up to the code-supported maximum of 10 Tribes at Diplomacy 10.', source:'8.7.1' },
      { level:7, use:'Fair access through a Trading Post', item:'Trading Post', kind:'Trade unlock', detail:'A functioning Trading Post may operate at the Fair with Diplomacy 7 (or Economics 4). A Clan may have multiple Trading Posts but only one Fair.', source:'14.14' }
    ],
    researchEffectOverrides:{
      'Diplomatic Rumours':'Reveals the location of the closest International City or Trading Town of your chosen type; may be repeated to learn additional locations.',
      'Expanded Horizons, Expanded Horizons II':'Each completion adds an additional randomly determined Desired Commodity; these topics may also be researched under Economics.',
      'Expanded Horizons':'Adds an additional randomly determined Desired Commodity; may also be researched under Economics.',
      'Expanded Horizons II':'Adds a second additional randomly determined Desired Commodity after Expanded Horizons.',
      'Trade Envoy':'Creates a repeatable Trade Envoy. At an International City it gives +50% delivery-route volume/commissions; at a Trading Town it gives +50% buy/sell quantities while the Envoy remains there.'
    },
    relatedSkills:['Economics','Administration','Politics']
  });
})();

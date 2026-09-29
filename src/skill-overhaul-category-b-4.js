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

  register('SEAMANSHIP', {
    name:'Seamanship',
    aliases:['Sea'],
    researchAliases:['Seamanship','Sea'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Vessel-specific Fleet movement scaling skill',
    levelDetail:'Seamanship increases movement for both sailing and rowing vessels. Its movement-point contribution varies by vessel and movement method.',
    primarySection:'29.36',
    additionalSections:['21.1','21.2','21.3.8','21.3.9'],
    workerRule:'No general worker assignment',
    workerDetail:'Seamanship modifies Fleet movement. Crew numbers are determined by the vessels being operated rather than by Seamanship level.',
    summary:'Represents practical ocean-going skill: managing crews, reading conditions and handling vessels. It contributes to movement for both rowed and sailed Fleets alongside Navigation and the applicable Rowing or Sailing skill.',
    factors:[
      { factor:'Sailing example — Longship', effect:'+2 MP per Seamanship level', detail:'The published Longship sailing formula is 40 + 3×Navigation + 2×Seamanship + 4×Sailing.' },
      { factor:'Rowing example — Longship', effect:'+1 MP per Seamanship level', detail:'The published Longship rowing formula is 36 + Navigation + Seamanship + 2×Rowing.' },
      { factor:'Ship type', effect:'Coefficient varies by vessel', detail:'Each vessel has its own base movement and Navigation/Seamanship/Rowing/Sailing coefficients.' },
      { factor:'Movement method', effect:'Applies to sailing and rowing', detail:'Unlike Rowing and Sailing, Seamanship contributes to both methods where the vessel supports them.' },
      { factor:'Mixed Fleets', effect:'Slowest usable movement total governs', detail:'When rowing and sailing vessels travel together, Fleet distance is limited by the smaller movement-point capability.' }
    ],
    researchEffectOverrides:{
      'Fleet Movement 4':'+4 Fleet movement points. Applies to Fleets only; To Limit orders will try to use the full modified allowance.',
      'Fleet Movement 6':'Adds a further +2 Fleet movement points after Fleet Movement 4, for +6 total.',
      'Seamanship 11':'Raises Seamanship to level 11.',
      'Expert Sailors 1':'+3 Seamanship and +3 Navigation once both base skills have reached 10.'
    },
    relatedSkills:['Navigation','Rowing','Sailing','Mariner','Captaincy','Maintain Boats']
  });

  register('SECURITY', {
    name:'Security',
    aliases:['Sec'],
    researchAliases:['Security','Sec'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Counter-scout detection / protection skill',
    levelDetail:'Security helps Warriors assigned to Security detect and engage Spies and Raiders. Suppression is the separate activity used against Patrol and Locate scouts entering the hex.',
    primarySection:'16.5',
    additionalSections:['16.6','16.1'],
    workerRule:'Warriors only; normal one-third combat assignment limits apply',
    workerDetail:'Security and Suppression draw from the unit’s Warrior assignments. The Mandate limits Security and/or Suppression assignments to the normal one-third Warrior combat framework.',
    summary:'Protects the Clan against Spies and Raiders. Security differs from Suppression because it protects the Clan rather than the whole hex, while half of Security-assigned Warriors may still be available for Defence if the one-third combat rule allows.',
    factors:[
      { factor:'Targets', effect:'Spies and Raiders', detail:'Security attempts to detect and attack Spies and Raiders. Locate and ordinary Patrol scouts are instead dealt with through Suppression.' },
      { factor:'Defence availability', effect:'50% of Security Warriors may also Defend', detail:'Half of Warriors assigned to Security may participate in Defence if doing so does not violate the one-third combat rule.' },
      { factor:'Security vs Suppression', effect:'Separate Warrior assignments', detail:'Warriors assigned to Security do not also count as Suppressors; a unit using both effectively presents two separate units against Spies and Raiders.' },
      { factor:'Who is protected', effect:'The Clan, not allied units in the hex', detail:'Security protects its own Clan. Suppression applies across the hex and may protect other Clans there.' },
      { factor:'Conditional activation', effect:'Allowed', detail:'Security may be ordered conditionally, for example not activating against a raiding group above a specified size.' },
      { factor:'Dogs', effect:'Useful support', detail:'The Mandate explicitly notes that Dogs are useful when assigned to Security.' }
    ],
    researchEffectOverrides:{
      'Outpost':'Security 6 allows use of an Outpost. A qualifying Element with 20+ Warriors cannot be overrun via Locate, reports Locating scouts, and an Outpost Garrison may run +2 scout groups.',
      'Security 11':'+1 Security level, taking Security 10 to 11.',
      'Security Patrol':'After Security 11, adds 3 percentage points per Security level to detecting scouts on Raid or Locate missions; the source example is +33% at Security 11.',
      'Dog Leash':'With a Leash for each Dog assigned to Security or Suppression, the unit receives +2 Security for determining success.',
      'Watchtower':'Each Watchtower adds 2 percentage points to Security/Suppression detection, up to six towers; each requires two observers.',
      'Posse':'For each 5 Warriors assigned to Security, one Local may be added when required.'
    },
    relatedSkills:['Scouting','Spying','Combat','Leadership','Tactics','Healing']
  });

  benefit('Dog Leash', { skill:'Security', value:'+2 Security', detail:'If each Dog assigned to Security or Suppression has a Dog Leash, the unit receives +2 Security when determining success.', source:'Research', research:'Leatherwork / Dog Leash' });
  benefit('Watchtower', { skill:'Security', value:'+2% detection per tower', detail:'Each Watchtower adds 2 percentage points to Security and Suppression detection; maximum six Watchtowers, with two observers required per tower.', source:'Research', research:'Engineering / Watchtower' });

  register('SHIPWRIGHT', {
    name:'Shipwright',
    aliases:['ShW','ShipW'],
    researchAliases:['Shipwright','ShW','ShipW'],
    baseline:'Woodwork',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Shipbuilding workforce-capacity skill',
    levelDetail:'Shipwright allows 10 actual people per skill level to be assigned to Shipbuilding until level 10, when the Shipwright worker limit becomes unlimited.',
    primarySection:'20.3',
    additionalSections:['20.2','20.4','14.15.1'],
    workerRule:'10 Shipbuilding workers per Shipwright level; unlimited at level 10',
    workerDetail:'The Shipyard must also have enough capacity for the actual workers assigned. Each Tribe participating in a Joint Project applies its own Shipwright limit.',
    summary:'Controls how many actual people a Tribe may assign to Shipbuilding. It works together with Shipbuilding skill and Shipyard capacity; Shipwright itself is a workforce-cap skill rather than the vessel recipe skill.',
    factors:[
      { factor:'Worker capacity', effect:'10 actual workers per skill level', detail:'At Shipwright 1–9 the cap is 10×level; at Shipwright 10 the Shipwright worker cap is unlimited.' },
      { factor:'Shipyard', effect:'Must match actual worker capacity', detail:'A Shipyard is required and must be large enough for the actual people assigned to Shipbuilding.' },
      { factor:'Joint Projects', effect:'Each Tribe checks its own Shipwright', detail:'Actual workers contributed by each participating Tribe are limited by that Tribe’s Shipwright level.' },
      { factor:'Location', effect:'Shipbuilding facilities must be in the same hex', detail:'Ships may only be built in the hex containing the required building facilities; adjacent units cannot use the Shipyard.' },
      { factor:'Effective workers', effect:'Research can raise output without raising actual-worker cap', detail:'Improved Productivity and Drydock increase effective shipbuilding labour while Shipwright continues to govern actual people assigned.' }
    ],
    researchEffectOverrides:{
      'Improved Productivity I (ShipW 25)':'Every 3 actual workers assigned to shipbuilding count as 4 effective workers. The research is entered as “ShipW 25” in research orders.',
      'Drydock':'Each supported Shipbuilding worker counts as 1.5 effective workers; one Drydock supports up to 100 actual workers.'
    },
    relatedSkills:['Shipbuilding','Engineering','Woodwork','Metalwork','Administration']
  });

  benefit('Drydock', { skill:'Shipwright', value:'×1.5 effective workers', detail:'A Drydock allows up to 100 actual Shipbuilding workers to count as 150 effective workers.', source:'Research', research:'Shipwright / Drydock' });
  benefit('Shipyard', { skill:'Shipwright', value:'Required capacity', detail:'Shipbuilding requires a Shipyard with enough capacity for the actual workers assigned under the Shipwright limit.', source:'Mandate', section:'20.2' });

  register('SLAVERY', {
    name:'Slavery',
    aliases:['Slv'],
    researchAliases:['Slavery','Slv'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Passive slave-control scaling skill',
    levelDetail:'Each Slavery level passively controls that many Slaves per 10 Clan members present. Active overseers can control additional Slaves at 1 overseer per 10 uncontrolled Slaves.',
    primarySection:'13.1.31',
    additionalSections:['17.6'],
    workerRule:'No production-worker cap',
    workerDetail:'Slavery governs control of Slaves rather than the number of workers on a production activity. Slaves themselves work as Actives once controlled.',
    summary:'Controls how many Slaves a unit may safely hold and work. Skill level provides passive control based on local Clan population; Warriors or Actives can oversee additional Slaves, and Shackles reduce the effective number requiring control.',
    factors:[
      { factor:'Passive control', effect:'Slavery level per 10 Clan members', detail:'Slavery 1 passively controls 1 Slave per 10 Warriors/Actives/Inactives present; Slavery 10 controls 10 per 10.' },
      { factor:'Active overseers', effect:'1 overseer per 10 uncontrolled Slaves', detail:'Warriors or Actives may oversee Slaves not covered by passive control. At Slavery 0 all controlled Slaves require overseers.' },
      { factor:'Shackles', effect:'Shackled Slaves count as half', detail:'Shackles are applied before passive-control and overseer calculations, halving the effective count of each shackled Slave.' },
      { factor:'Unsupervised Slaves', effect:'1 in 5 flee', detail:'Unsupervised Slaves flee at the rate of one per five uncontrolled Slaves.' },
      { factor:'Transfer', effect:'Unlimited between the Clan’s Tribes', detail:'Slaves may be transferred between Tribes without the normal people-transfer limit, but cannot be transferred to another Clan as goods.' },
      { factor:'Fleet baseline', effect:'10 Slaves per overseeing Warrior at Slavery 0', detail:'The Mandate explicitly states the Slavery 0 fleet carrying/control relationship.' }
    ],
    researchEffectOverrides:{
      'Press Gang':'Once per year, send an Element into a non-Village hex to enslave 50 + 4d12 Locals.'
    },
    relatedSkills:['Combat','Raiding','Security','Torture']
  });

  benefit('Shackles', { skill:'Slavery', value:'Counts shackled Slaves as 0.5', detail:'For passive-control and overseeing calculations, each shackled Slave counts as half a Slave.', source:'Mandate', section:'13.1.31' });

  register('SPYING', {
    name:'Spying',
    aliases:['Spy'],
    researchAliases:['Spying','Spy'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Scout intelligence-mission success skill',
    levelDetail:'Spying contributes to spy missions and also matters to Locate success. It operates through scouting parties rather than as a normal production activity.',
    primarySection:'16.4.5',
    additionalSections:['16.3','16.4.3','16.5'],
    workerRule:'Uses scouting parties; one spy group targets one unit',
    workerDetail:'Spy missions count within the Tribe’s scouting-party allowance. One spy group may spy on one unit, and a specific target unit may be named when several are present.',
    summary:'Provides intelligence through scouting parties. A successful Spy mission reveals one selected category of Warrior numbers and also reveals fortifications; Spying is also one of the skills relevant to Locate missions.',
    factors:[
      { factor:'Targeting', effect:'1 spy group → 1 unit', detail:'If several units are present, the GM chooses randomly unless the player specifies the target unit.' },
      { factor:'Successful result', effect:'One Warrior-number category + fortifications', detail:'A successful attempt reports one of the listed Warrior categories and also reveals fortifications in the hex.' },
      { factor:'Orders', effect:'State the requested information in GM Actions', detail:'Different parties may target different information categories.' },
      { factor:'Truced Clans', effect:'Spying prohibited', detail:'A Truce must be cancelled before spying on that Clan.' },
      { factor:'Locate', effect:'Spying and Scouting are both relevant', detail:'The Locate rules identify Scouting and Spying as the two relevant skills when dealing with defending Suppressors.' },
      { factor:'Countered by', effect:'Security', detail:'Security Warriors attempt to detect and attack Spies.' }
    ],
    factTables:[{
      kicker:'Spy result',
      title:'Information a successful spy attempt can target',
      source:'16.4.5',
      note:'Choose one Warrior-number category for the spy attempt. A successful attempt also reveals fortifications in the hex.',
      columns:[{key:'target',label:'Requested information'},{key:'result',label:'Successful result'}],
      rows:[
        { target:'Defence / Security', result:'Number of Warriors assigned to Defence or Security' },
        { target:'Suppression', result:'Number of Warriors assigned to Suppression' },
        { target:'Total Warriors', result:'Total number of Warriors in the target unit' }
      ]
    }],
    researchEffectOverrides:{
      'Expert Spies':'+25 percentage points to the chance of a successful Raid, Locate or Spy mission for units belonging to the researching Tribe.'
    },
    relatedSkills:['Scouting','Security','Tactics','Torture']
  });

  register('TACTICS', {
    name:'Tactics',
    aliases:['Tac'],
    researchAliases:['Tactics','Tac'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Combat composition / raid-capacity scaling skill',
    levelDetail:'Tactics scales both raid-party capacity and the proportion of defending/field-combat Warriors that may be assigned as ranged troops.',
    primarySection:'29.37',
    additionalSections:['16.4.2','17.10'],
    workerRule:'Not a normal activity worker cap',
    workerDetail:'Tactics sets combat composition limits: raid parties may contain 10 Raiders per Tactics level, and ranged participation is 25% + 1 percentage point per Tactics level.',
    summary:'Shapes land-combat organisation. It determines the maximum size of each raiding scouting party and raises the share of Warriors who may be used as ranged troops in Field combat.',
    factors:[
      { factor:'Raid party capacity', effect:'10 Raiders per Tactics level per scouting party', detail:'At Tactics 10, each raiding party may contain up to 100 Raiders.' },
      { factor:'Ranged troop ratio', effect:'25% + 1% per Tactics level', detail:'This is the maximum share of Warriors in the relevant combat force who may be ranged troops.' },
      { factor:'Ranged roles', effect:'Archers + Heavy Weapons', detail:'The ranged proportion includes missile troops such as Archers and Heavy Weapons crews under the combat assignment rules.' },
      { factor:'Land combat', effect:'May improve effectiveness', detail:'The Mandate also states that Tactics gives a chance of improving effectiveness in land combat.' }
    ],
    researchEffectOverrides:{
      'Tactics 11':'+1 Tactics level, taking Tactics 10 to 11.',
      'Wagon Laager':'Defenders in Field combat may use 1 Wagon or Ore Cart per 10 Warriors to gain an effect equivalent to a Palisade; unavailable in Mountains, Forests, Swamps or Jungle.',
      'Command Tent':'+2 Tactics for the duration of combat when a participating unit has the Command Tent research; one Command Tent is required per 100 Warriors for full benefit.'
    },
    relatedSkills:['Combat','Leadership','Archery','Heavy Weapons','Scouting','Spying','Horsemanship']
  });

  benefit('Command Tent', { skill:'Tactics', value:'+2 Tactics in combat', detail:'If a participating unit has Command Tent research, Command Tents provide +2 Tactics for the duration of combat; full benefit requires one tent per 100 Warriors.', source:'Research', research:'Leadership / Command Tent' });
  benefit('Wagon', { skill:'Tactics', value:'Wagon Laager support', detail:'With Wagon Laager research, Defenders may use one Wagon or Ore Cart per 10 Warriors for an effect equivalent to a Palisade in eligible terrain.', source:'Research', research:'Tactics / Wagon Laager' });
  benefit('Ore Cart', { skill:'Tactics', value:'Wagon Laager support', detail:'With Wagon Laager research, Defenders may use one Wagon or Ore Cart per 10 Warriors for an effect equivalent to a Palisade in eligible terrain.', source:'Research', research:'Tactics / Wagon Laager' });

  register('TORTURE', {
    name:'Torture',
    aliases:['Tor'],
    researchAliases:['Torture','Tor'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Post-capture interrogation success scaling skill',
    levelDetail:'The written success formula is (10% + 10% × Torture level) per question. Torture is resolved immediately after capture in the week following the Turn Report.',
    primarySection:'16.7',
    additionalSections:['16.5','16.6'],
    workerRule:'One Warrior performs the activity; questions are limited by captured groups',
    workerDetail:'Torture is not a normal next-turn Activity. One question is normally available per discrete captured group, not per individual captive.',
    summary:'Allows immediate post-capture interrogation of captured enemy groups. Questions must concern the captured Clan, should be quantifiable where possible, and cannot reveal unit locations.',
    factors:[
      { factor:'Success chance', effect:'10% + 10% × Torture level', detail:'The Mandate gives this formula directly. It does not state a separate cap in the Torture section.' },
      { factor:'Question allowance', effect:'1 question per discrete captured group', detail:'Capturing two different scouting groups permits two questions under the base rule.' },
      { factor:'Timing', effect:'Immediately after capture', detail:'Torture is handled in the week following the Turn Report rather than waiting for the next normal Orders.' },
      { factor:'Who performs it', effect:'A Warrior', detail:'The activity is performed by a Warrior and aided by the Torture skill.' },
      { factor:'Skill sharing', effect:'Any same-hex sub-Tribe Torture skill may cover it', detail:'The Torture skill of any one sub-Tribe present in the same hex may be used for the interrogation.' },
      { factor:'Question scope', effect:'Captured Clan only; no unit locations', detail:'Questions should concern the captured Clan and specific or general unit positions are not revealed through Torture.' }
    ],
    researchEffectOverrides:{
      'Dungeon':'The Torture research entry delegates to Engineering. Engineering’s Dungeon rule holds 200 Slaves with one Overseer when a Whip is present and is a prerequisite for some Torture research; no numeric Torture bonus is stated there.',
      'Thumb Screws':'Allows one additional Torture question per discrete captured group; also unlocks manufacture of Thumb Screws via Metalwork 4.'
    },
    relatedSkills:['Security','Scouting','Spying','Slavery','Engineering','Metalwork']
  });

  benefit('Thumb Screws', { skill:'Torture', value:'+1 question per captured group', detail:'Thumb Screws allow one additional Torture question for each discrete captured group.', source:'Research', research:'Torture / Thumb Screws' });
  benefit('Dungeon', { skill:'Torture', value:'Torture research prerequisite / captive holding', detail:'Dungeon research is referenced by Torture and allows 200 Slaves to be held with one Overseer when a Whip is present; the source does not give a numeric Torture-skill modifier.', source:'Research', research:'Engineering / Dungeon' });
})();

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

  register('MOBILISATION', {
    name:'Mobilisation',
    aliases:['Mob'],
    researchAliases:['Mobilisation','Mob'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Defensive combat-availability scaling skill',
    levelDetail:'When a unit is attacked, Mobilisation may make 3% × skill level of its remaining otherwise-available Warriors available for combat, while the normal one-third combat ceiling still applies.',
    primarySection:'17.2.1',
    additionalSections:['17.2','29.27'],
    workerRule:'Not a worker-cap skill',
    workerDetail:'Mobilisation changes defensive combat availability; it does not set the number of people who may perform a normal Activity.',
    summary:'Lets a defending unit call on a proportion of Warriors who performed other Activities that turn. It applies when the unit is attacked, not when it initiates combat, and never overrides the overall one-third Warrior limit.',
    factors:[
      { factor:'When it activates', effect:'When the unit is attacked', detail:'Mobilisation applies to a unit defending against an attack.' },
      { factor:'Mobilised share', effect:'3% × Mobilisation level', detail:'This percentage of the remaining Warriors who are otherwise available may be added to the assigned defence.' },
      { factor:'Overall combat ceiling', effect:'Maximum 33% of unit Warriors', detail:'Mobilisation does not allow an individual unit to exceed the normal one-third Warrior limit.' },
      { factor:'Initiating combat', effect:'Mobilisation does not apply', detail:'Field Combat, Assaults, Sieges, Locates and Raids all count as initiating combat for this rule.' },
      { factor:'Multiple units', effect:'Calculated per unit', detail:'Where units have different Mobilisation levels, each unit calculates its own mobilised Warriors separately.' },
      { factor:'Militia', effect:'Available in original defence', detail:'Where applicable, Militia are always available in the original defence subject to their own rules.' }
    ],
    researchEffectOverrides:{
      'Militia Mobilisation':'Raises defending local Militia from 20 to 25 per controlled hex; their combat skills are otherwise unchanged.',
      'Mobilisation 11':'Raises Mobilisation from 30% at level 10 to 33% of the remaining available Warriors.',
      'Home Guard':'+0.5 Terrain Proficiency for the Tribe in an owned hex; requires Combat 10 or Mobilisation 11.'
    },
    relatedSkills:['Combat','Leadership','Security','Politics','Tactics']
  });

  register('NAVIGATION', {
    name:'Navigation',
    aliases:['Nav'],
    researchAliases:['Navigation','Nav'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Vessel-specific Fleet movement scaling skill',
    levelDetail:'Navigation adds movement points to Fleets. The amount added per Navigation level depends on the vessel and movement method rather than using one universal multiplier.',
    primarySection:'21.1',
    additionalSections:['21.3.8','21.3.9','29.28'],
    workerRule:'No worker assignment',
    workerDetail:'Navigation modifies Fleet movement. Crew requirements are determined by the vessels being operated, not by Navigation level.',
    summary:'Increases Fleet movement for both sailing and rowing vessels. Each vessel has its own base movement and skill coefficients, so Navigation works alongside Seamanship and either Sailing or Rowing.',
    factors:[
      { factor:'Sailing example — Longship', effect:'+3 MP per Navigation level', detail:'The published Longship sailing example is 40 + 3×Navigation + 2×Seamanship + 4×Sailing.' },
      { factor:'Rowing example — Longship', effect:'+1 MP per Navigation level', detail:'The published Longship rowing example is 36 + Navigation + Seamanship + 2×Rowing.' },
      { factor:'Ship type', effect:'Coefficient varies', detail:'The amount each skill contributes varies by vessel as shown in the naval movement table.' },
      { factor:'Movement method', effect:'Works for sailing and rowing', detail:'Navigation contributes to both movement methods; Sailing and Rowing contribute only to their respective methods.' },
      { factor:'Fleet composition', effect:'Slowest movement capability governs', detail:'A mixed rowing/sailing Fleet is limited by the smaller movement-point capability, and sailing vessels must be able to move.' }
    ],
    researchEffectOverrides:{
      'Navigation 11':'+1 Navigation level, taking Navigation 10 to 11.',
      'Wetlands Wayfinder':'Allows eligible shallow-hulled Fleets to use GOTO routes through Swamps: 12 MP for a whole Swamp hex or 6 MP for a hexside.',
      'Wetlands Corridor':'Improves a Wetlands Wayfinder route to 8 MP for a whole Swamp hex or 4 MP for a hexside and can interact with Two Hex Ferry.',
      'Astronomy 1, Astronomy 2, Astronomy 3':'Each Astronomy stage adds +2 Navigation, with the line beginning from Navigation 11.',
      'Expert Sailors 1':'+3 Navigation and +3 Seamanship once both base skills have reached 10.'
    },
    relatedSkills:['Seamanship','Rowing','Sailing','Shipbuilding','Mariner','Captaincy']
  });

  register('POLITICS', {
    name:'Politics',
    aliases:['Pol'],
    researchAliases:['Politics','Pol'],
    baseline:'Economics',
    layout:'unlock',
    mechanic:'scaling-unlock',
    mechanicLabel:'Territorial control unlock / Government scaling skill',
    levelDetail:'Politics 10 establishes the Clan Home City at Government Level 0. Subsequent Government Level research expands the radius and number of controlled hexes.',
    primarySection:'24',
    additionalSections:['24.1','29.29'],
    workerRule:'Administration requirements, not a skill worker cap',
    workerDetail:'Controlled territory must be supported by Pacifiers and, above GL0, Governors. These are political administration requirements rather than a 10-workers-per-skill-level cap.',
    summary:'Politics 10 creates a City-State/Home City and opens territorial government. Controlled territory can provide morale, taxation and Militia, but must be continuously administered with Pacifiers and Governors.',
    levelUses:[
      { level:10, use:'City-State / Home City (GL0)', kind:'Major unlock', detail:'The Politics 10 Tribe becomes the Clan Home City, with an initial claim to its occupied hex. Only one Home City is created per Clan.', source:'24' }
    ],
    factors:[
      { factor:'Pacifiers', effect:'10 Warriors per controlled hex', detail:'Pacifiers require mounts, full metal armour and at least one metal weapon. Without required Pacifiers, the affected territory loses its productive political benefits for that turn.' },
      { factor:'Governors', effect:'10 Actives per Government Level', detail:'Above GL0, the required Governors are assigned in aggregate from a single unit residing in the Home City. A Courthouse halves this requirement.' },
      { factor:'Government Level', effect:'+1 hex radius per level', detail:'Government Level research extends the State outward from the Home City; the current Mandate permits levels beyond GL5 up to GL8.' },
      { factor:'Controlled-hex defence', effect:'+10% of existing Combat Morale vs invaders', detail:'The State benefit applies to combat against invaders within a controlled hex.' },
      { factor:'Tithes / taxes', effect:'Silver and basic goods', detail:'Administered controlled territory produces political income subject to the detailed Government Level rules.' },
      { factor:'Militia', effect:'20 per controlled hex', detail:'Militia defend the Home City, fight at Leadership 5 and 0 in other combat skills, and must be equipped for combat.' }
    ],
    factTables:[{
      kicker:'Territorial scale',
      title:'Published Government Level control',
      source:'24',
      columns:[{key:'level',label:'Government Level'},{key:'hexes',label:'Controlled hexes'},{key:'detail',label:'Administration note'}],
      rows:[
        { level:'GL0', hexes:'1', detail:'Politics 10 establishes the Home City and its initial controlled hex.' },
        { level:'GL1', hexes:'7', detail:'First researched expansion ring.' },
        { level:'GL2', hexes:'19', detail:'Second expansion ring.' },
        { level:'GL3', hexes:'37', detail:'Third expansion ring.' },
        { level:'GL4', hexes:'61', detail:'Fourth expansion ring.' },
        { level:'GL5', hexes:'91', detail:'Fifth expansion ring; outer-ring administration/tithe rules change at GL5 and beyond.' }
      ]
    }],
    researchEffectOverrides:{
      'Government Level 1 (to 5 and beyond)':'Each Government Level extends the State by one hex radius; the published counts are GL1 7, GL2 19, GL3 37, GL4 61 and GL5 91 controlled hexes.',
      'Banqueting Hall':'Politics 10 + Government Level 1 unlocks a Banqueting Hall research path for annual morale and recruitment benefits.',
      'Doomsday Book':'Politics research supporting administration of the State.',
      'Castle':'Politics research enabling the published Castle project once its prerequisites are met.',
      'Fortress':'Politics research enabling Fortresses outside the Home City under its published placement restrictions.',
      'Marshals':'Politics research associated with higher Government Levels.',
      'Sheriffs':'Politics research associated with Government Level development.'
    },
    relatedSkills:['Mobilisation','Security','Leadership','Engineering','Woodwork','Stonework']
  });

  benefit('Courthouse', { skill:'Politics', value:'Halves Governing requirement', detail:'A Courthouse halves the number of Actives required for Governing the Home City State.', source:'Mandate', section:'24' });

  register('RELIGION ATHEISM', {
    name:'Religion',
    aliases:['Atheism','Rel','Ath','Religion / Atheism'],
    researchAliases:['Religion','Atheism','Religion / Atheism','Rel','Ath'],
    baseline:'Economics',
    layout:'unlock',
    mechanic:'scaling-unlock',
    mechanicLabel:'Movement membership / level-unlock skill',
    levelDetail:'Religion or Atheism levels unlock participation, movement formation, belief benefits and the Missionary Element. The same framework accommodates an atheistic movement.',
    primarySection:'27',
    additionalSections:['27.1','27.2','27.4','27.5','27.6','27.7','27.8','29.30'],
    workerRule:'No general worker cap',
    workerDetail:'Religion is not a normal production activity. Some religious obligations, such as Festival-month meditation, require people according to the Religion rules.',
    summary:'Develops a Clan belief into a shared Religious Movement, including atheistic movements. Level thresholds govern joining/founding, special abilities, Missionary Elements and belief-linked skill bonuses.',
    levelUses:[
      { level:2, use:'Eligible to join a Religious Movement', kind:'Membership unlock', detail:'A Clan needs at least one Tribe at Religion 2 to join an existing Movement, subject to approval.', source:'27.2' },
      { level:3, use:'Eligible to found a Religious Movement', kind:'Formation unlock', detail:'The founder needs at least one Tribe at Religion 3 and must identify the Movement belief.', source:'27.2' },
      { level:4, use:'Hard-Belief Special Ability', kind:'Clan benefit', detail:'One Tribe in the Clan gains the minor Special Ability associated with the chosen Hard Belief while membership persists.', source:'27.1' },
      { level:5, use:'Missionary Element', kind:'Unit unlock', detail:'The Vanguard Tribe may designate an ordinary Element as the Movement Missionary Element, subject to normal Administration requirements and the Religion-specific unit rules.', source:'27.8' },
      { level:6, use:'+2 Hard-Belief skill bonus', kind:'Skill benefit', detail:'One Tribe gains +2 to one skill allowed by the chosen Hard Belief; this bonus cannot raise that skill above 6.', source:'27.1' }
    ],
    factors:[
      { factor:'Movement formation', effect:'At least 4 Clans', detail:'Four Clans are required to form a Movement; the current maximum membership is eight Clans.' },
      { factor:'Dormancy', effect:'Below 4 members', detail:'A Movement below four members becomes dormant; if another member is not found within 12 months it lapses.' },
      { factor:'Internal combat', effect:'Member Clans may not attack each other', detail:'Leaving the Movement loses 0.10 Morale to the Tribe and removes the benefits.' },
      { factor:'Festival month', effect:'20% of Clan Actives meditate', detail:'During the annual Festival month, 20% of Actives across the Clan must be assigned to meditation/do nothing; failure may cause a 0.02 Morale loss.' },
      { factor:'Atheism', effect:'Uses the same framework', detail:'A Clan may instead form an atheistic movement and pursue Atheism where Religion would otherwise apply; current rules limit atheists to no more than three Religion places.' }
    ],
    researchEffectOverrides:{
      'Additional Member (Atheism / Religion)':'Adds one member place to the Atheist/Religious organisation; each group may benefit from this research only once and books cannot be written on it.',
      'Military Orders':'For the Missionary Element and its sub-units, battle Leadership becomes Leadership + half Religion level, rounded up.'
    },
    relatedSkills:['Leadership','Mobilisation','Security','Navigation','Seamanship','Economics','Courier']
  });

  register('ROWING', {
    name:'Rowing',
    aliases:['Row'],
    researchAliases:['Rowing','Row'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Rowed Fleet movement scaling skill',
    levelDetail:'Rowing adds movement points to rowed vessels. The amount per Rowing level varies by ship type and combines with Navigation and Seamanship.',
    primarySection:'21.3.8',
    additionalSections:['21.1','29.32'],
    workerRule:'Crew requirement comes from the vessel',
    workerDetail:'Rowing does not set a general activity workforce. Each rowed vessel has its own crew requirement, and rowed craft require Oars for that crew.',
    summary:'Increases movement when a Fleet rows. A vessel starts with its base Row MP, then gains vessel-specific contributions from Navigation, Seamanship and Rowing.',
    factors:[
      { factor:'Longship example', effect:'+2 MP per Rowing level', detail:'The published Longship formula is 36 + Navigation + Seamanship + 2×Rowing.' },
      { factor:'Ship type', effect:'Coefficient varies', detail:'Other rowed vessels use their own base Row MP and skill multipliers from the naval movement table.' },
      { factor:'Oars', effect:'Required for rowed crew', detail:'Rowed craft require Oars for the crew.' },
      { factor:'Ocean/Lake movement cost', effect:'4 MP per hex before modifiers', detail:'Rowing costs rise for coastal movement and adverse wind as specified in the naval movement rules.' },
      { factor:'Mixed Fleet', effect:'Slowest movement capability governs', detail:'When rowed and sailing vessels travel together, Fleet distance is limited by the smaller available movement-point total.' }
    ],
    researchEffectOverrides:{
      'Rowing 11':'+1 Rowing level, taking Rowing 10 to 11.'
    },
    relatedSkills:['Navigation','Seamanship','Sailing','Shipbuilding']
  });

  benefit('Oar', { skill:'Rowing', value:'Required by rowed craft', detail:'Rowed craft require Oars for their crew.', source:'Mandate', section:'21.3.8' });

  register('SAILING', {
    name:'Sailing',
    aliases:['Sail'],
    researchAliases:['Sailing','Sail'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Sailing Fleet movement scaling skill',
    levelDetail:'Sailing adds movement points to sailing vessels. The amount per Sailing level varies by ship type and combines with Navigation and Seamanship.',
    primarySection:'21.3.9',
    additionalSections:['21.1','21.3.10','29.33'],
    workerRule:'Crew requirement comes from the vessel',
    workerDetail:'Sailing does not set a general activity workforce. Each vessel has its own minimum crew and movement characteristics.',
    summary:'Increases movement when a Fleet sails. Sailing combines vessel base MP with Navigation and Seamanship, while wind speed and direction affect both usable MP and movement cost.',
    factors:[
      { factor:'Longship example', effect:'+4 MP per Sailing level', detail:'The published Longship formula is 40 + 3×Navigation + 2×Seamanship + 4×Sailing.' },
      { factor:'Ship type', effect:'Coefficient varies', detail:'Other sailing vessels use their own base Sail MP and skill multipliers from the naval movement table.' },
      { factor:'Wind', effect:'Changes movement', detail:'Sailing movement depends on wind speed and direction; in Calm conditions sailing movement is not available.' },
      { factor:'Mixed Fleet', effect:'Slowest movement capability governs', detail:'A mixed Fleet can only move if its sailing vessels can move and is limited by the smaller movement-point capability.' }
    ],
    researchEffectOverrides:{
      'Expert Sailors 1':'+3 Seamanship and +3 Navigation once both skills have reached 10; leads toward Professional Sailors.',
      'Raincatching':'Adds Gather / Rain: fill 25% of Fleet water-container capacity using 5 Cloth and 2 crew per ship/boat; weather does not alter the quantity.',
      'Sailing 11':'+1 Sailing level.',
      'Two Hex Ferry':'Allows a Ferry to operate across two Ocean/Lake hexes for 16 MP per trip, with normal Ferry rules otherwise applying.'
    },
    relatedSkills:['Navigation','Seamanship','Rowing','Shipbuilding','Mariner']
  });

  register('SCOUTING', {
    name:'Scouting',
    aliases:['Sct','Scout'],
    researchAliases:['Scouting','Sct','Scout'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Exploration / scouting-party effectiveness skill',
    levelDetail:'Scouting supports scout survival and effectiveness. The Mandate does not publish a simple per-level output formula, and the normal limit remains eight scouting parties per Tribe.',
    primarySection:'16.3',
    additionalSections:['8.7.4','16.4','16.4.1','16.4.2','16.4.3','16.4.5'],
    workerRule:'Up to 8 scouting parties per Tribe',
    workerDetail:'The limit is eight parties, not eight Warriors. Parties launched by Elements, Fleets or Garrisons count against the parent Tribe total; Couriers cannot scout.',
    summary:'Covers exploration by scouting parties after unit movement. Scouts can Patrol, Locate, Spy or Raid; people, animals and equipment committed to a party cannot be used for other work that turn.',
    factors:[
      { factor:'Party limit', effect:'8 parties per Tribe', detail:'Scout parties from all of the Tribe’s sub-units share the same eight-party total.' },
      { factor:'Timing', effect:'After unit movement', detail:'Scouts depart after their parent unit has moved and automatically return to it if they survive.' },
      { factor:'Committed resources', effect:'Unavailable elsewhere that turn', detail:'Warriors, Horses and items assigned to scouting cannot be used for other Activities that turn.' },
      { factor:'Patrol', effect:'Normal exploration mission', detail:'Patrol searches the route/final hex for terrain, minerals, useful finds and other units according to the scouting rules.' },
      { factor:'Locate / Spy / Raid', effect:'Special scouting missions', detail:'Locate, Spy and Raid are missions performed by scouts; they are not separate current Group B skills.' },
      { factor:'Raid party size', effect:'10 raiders per Tactics level per party', detail:'Tactics, not a Raiding skill, sets the maximum number of raiders in each scouting party.' },
      { factor:'Fleet scouts', effect:'Land scouting only', detail:'Fleets can send scouts by land when in a land hex such as a coastal or riverside hex; scouts do not scout across Ocean/Lake hexes.' }
    ],
    researchEffectOverrides:{
      'Extra Movement 1':'+2 scouting movement points for one nominated unit in the Tribe.',
      'Extra Movement 2':'Adds another +2 scouting movement points, for +4 total, for one nominated unit in the Tribe.',
      'Ranger 1, 2, 3':'Ranger I/II/III add +1 / +3 / +5 Scouting levels respectively and begin the separate Group C Ranger research line.',
      'Scout Veterans':'+2 Scouting levels.',
      'Scouting 11':'+1 Scouting level.'
    },
    relatedSkills:['Tactics','Security','Spying','Mobilisation','Intelligence']
  });
})();
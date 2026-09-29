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

  // Economics is one of the four approved dossier baselines and is itself a current Group B skill.
  // Preserve its baseline content while making its Group B classification explicit for the final audit.
  const economicsBaseline = S.profile('Economics');
  if (economicsBaseline) S.registerProfile('ECONOMICS', { ...economicsBaseline, status:'baseline', category:'B' });

  register('TRIBALL', {
    name:'Triball',
    aliases:['Tri'],
    researchAliases:['Triball','Tri'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Fair-event income scaling skill',
    levelDetail:'Normal Fair Triball income is Participants × (2 + Triball/2 + Economics/4) Silver. Warriors count as 1 participant, Horses as 1 and Clubs as 0.5.',
    primarySection:'15.1',
    additionalSections:['29.38'],
    workerRule:'Normal Fair activity: maximum 800 Warriors, 800 Horses and 800 Clubs',
    workerDetail:'Triball uses Warriors rather than a standard production workforce. Warriors committed to Triball are unavailable for combat; Horses used for Triball are unavailable for other tasks such as Scouting, though they may still be used during movement.',
    summary:'A Group B Fair skill that converts participation by Warriors, Horses and Clubs into Silver. Research can add Gold-producing Guild play, expand team size, improve equipment, extend the season and increase Fair income.',
    factors:[
      { factor:'Base Silver formula', effect:'Participants × (2 + Triball/2 + Economics/4)', detail:'The Mandate formula uses the Triball and Economics levels of the participating Tribe.' },
      { factor:'Participant values', effect:'Warrior 1 · Horse 1 · Club 0.5', detail:'Example: 500 Warriors + 500 Horses + 500 Clubs = 1,250 participants.' },
      { factor:'Normal team cap', effect:'800 Warriors / 800 Horses / 800 Clubs', detail:'The cap applies to normal Triball participation; Guild research can create a separate additional Triball activity.' },
      { factor:'Fair timing', effect:'Months 4 and 10', detail:'Normal Triball is played during the twice-yearly Fair.' },
      { factor:'Fair access', effect:'Fair requirements still apply', detail:'The participating Tribe must meet the published Fair access conditions, such as Economics/Diplomacy plus Village/Trading Post access or the nomadic Economics route.' },
      { factor:'Trade-slot use', effect:'Counts against the 10-item Fair trade limit', detail:'Playing Triball consumes one of the Fair transaction/item slots.' },
      { factor:'Warrior availability', effect:'Committed Warriors cannot fight that turn', detail:'Warriors assigned to Triball are unavailable should combat occur.' }
    ],
    researchEffectOverrides:{
      'Inactive Players':'Inactives may perform up to one-half of Triball activities for a Triball Guild or normal Fair Silver generation.',
      'Large Teams':'For Triball Guild Gold generation, members may assign up to 1,600 Warriors, Horses and Clubs rather than the normal 800.',
      'Off Season':'A Triball Guild may also operate in months 1 and 7; the Gold cost rate changes from 250 Silver per Gold to 1,000 Silver per Gold in those months.',
      'Triball Arena':'+50% Silver from Triball during each Fair for the Arena owner. The Arena may be built using either Eng 8 + Triball 10 or Eng 10 + Triball 8, with 3,000 people and 15,000 Stone.',
      'Triball 11':'+1 Triball level, taking Triball 10 to 11.',
      'Triball Club':'If all assigned participants who need Clubs use Triball Clubs, Triball Silver/Gold-generation value is doubled; partial coverage gives a proportional bonus.',
      'Triball Guild':'Creates the Minor League/Guild activity: an additional Fair Triball assignment of up to 800 Warriors, Horses and Clubs generates Gold equal to calculated Silver ÷ 250, rounded down.',
      'Triball Maneuvers':'+2 effective Triball when the entire Triball team is mounted; combines with Triball Saddles.',
      'Triball Saddle':'+2 effective Triball in tournaments/Fair when all players have Horses and Triball Saddles; combines with Triball Maneuvers.'
    },
    relatedSkills:['Economics','Diplomacy','Horsemanship','Leadership','Woodwork','Engineering']
  });

  benefit('Triball Club', { skill:'Triball', value:'Up to ×2 Triball income value', detail:'Full Triball Club coverage doubles the Silver/Gold-generation value of the Triball activity; partial coverage is ratioed.', source:'Research', research:'Triball / Triball Club' });
  benefit('Triball Saddle', { skill:'Triball', value:'+2 effective Triball', detail:'When the entire team is mounted and has Triball Saddles, effective Triball increases by 2; this can combine with Triball Maneuvers.', source:'Research', research:'Leatherwork / Triball Saddle' });
  benefit('Triball Arena', { skill:'Triball', value:'+50% Fair Silver', detail:'During each Fair, the owner of a Triball Arena receives 50% more Silver from Triball.', source:'Research', research:'Triball / Triball Arena' });
  benefit('Minor League Arena', { skill:'Triball', value:'Enables Triball Guild activity', detail:'Triball Guild participants need access to the Minor League Arena created by the Triball Guild research.', source:'Research', research:'Triball / Triball Guild' });

  register('ADMIRALTY', {
    name:'Admiralty',
    aliases:['Admty'],
    researchAliases:['Admiralty','Admty'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Research-unlocked naval command scaling skill',
    levelDetail:'For combat calculations, effective Captaincy gains one-half of Admiralty level, rounded down: Captaincy + floor(Admiralty/2).',
    primarySection:'17.15',
    additionalSections:['29.12'],
    workerRule:'No worker assignment',
    workerDetail:'Admiralty is a research-unlocked command skill. It modifies naval combat command calculations rather than setting an Activity workforce.',
    summary:'A research-unlocked Category B naval command skill. Once the Captaincy research topic Admiralty has been completed, the Tribe may develop Admiralty; half its Admiralty level, rounded down, is added to Captaincy for combat calculations.',
    factors:[
      { factor:'Unlock', effect:'Captaincy research: Admiralty', detail:'Completing the Admiralty research topic creates the Category B Admiralty skill for that Tribe.' },
      { factor:'Captaincy modifier', effect:'+ floor(Admiralty ÷ 2)', detail:'The bonus is added to Captaincy for all combat calculations.' },
      { factor:'Naval command role', effect:'Supports naval combat command', detail:'The Research List describes Admiralty as exercising naval command and improving command/control of naval formations.' },
      { factor:'Naval combat context', effect:'Captaincy replaces Leadership', detail:'The Mandate uses Captaincy as the leadership-equivalent skill in naval combat, making Admiralty a modifier to that naval command skill.' }
    ],
    researchEffectOverrides:{
      'Admiralty':'Unlocks the new Category B Admiralty skill; effective Captaincy gains half Admiralty level, rounded down, for combat calculations.',
      'Navy':'+0.20 Combat Morale in naval engagements.',
      'Naval Tradition':'Changes the morale gain from winning naval combat from +0.02 to +0.03.'
    },
    relatedSkills:['Captaincy','Mariner','Navigation','Seamanship','Sailing','Rowing','Leadership']
  });

  register('GENERALSHIP', {
    name:'Generalship',
    aliases:['Gship'],
    researchAliases:['Generalship','Gship'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Research-unlocked land-command scaling skill',
    levelDetail:'For combat calculations, effective Leadership gains one-half of Generalship level, rounded down: Leadership + floor(Generalship/2).',
    primarySection:'17.13',
    additionalSections:['17.9','17.10'],
    workerRule:'No worker assignment',
    workerDetail:'Generalship is a research-unlocked command skill. It modifies combat Leadership rather than setting an Activity workforce.',
    summary:'A research-unlocked Category B military-command skill. Leadership 10 unlocks the Generalship research topic; after completion the Tribe may develop Generalship, and half its level, rounded down, is added to Leadership for combat calculations.',
    factors:[
      { factor:'Unlock prerequisite', effect:'Leadership 10', detail:'The Generalship research topic requires Leadership 10 and unlocks the new Category B skill.' },
      { factor:'Leadership modifier', effect:'+ floor(Generalship ÷ 2)', detail:'The Generalship contribution is added to Leadership for all combat calculations.' },
      { factor:'Command role', effect:'Land military command and control', detail:'The Research List describes Generalship as the officer-class skill for improving command and control of military formations.' },
      { factor:'Order of attacks', effect:'No effect', detail:'The Mandate specifically states that Generalship research does not affect the order of attacks.' },
      { factor:'Current own-topic status', effect:'Under review', detail:'The Research List’s standalone Generalship section says its topics are under review; no unsupported Generalship-only research bonuses are invented here.' }
    ],
    researchEffectOverrides:{
      'Generalship':'Unlocks the new Category B Generalship skill; effective Leadership gains half Generalship level, rounded down, for combat calculations.'
    },
    relatedSkills:['Leadership','Combat','Tactics','Mobilisation','Garrison','Heavy Weapons','Archery']
  });
})();

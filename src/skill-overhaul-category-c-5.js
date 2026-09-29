(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'C',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });

  register('RANGER', {
    name:'Ranger',
    aliases:['Rangers'],
    researchAliases:['Ranger','Rangers','Ranger I','Ranger II','Ranger III','Ranger IV','Ranger V','Ranger VI'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-unlocked Scouting progression skill',
    levelDetail:'Ranger is a research-unlocked Group C skill. Completing Ranger I unlocks the learnable Ranger skill; Ranger skill level 10 is then required to enter the Ranger IV+ research chain, whose published effect is to add effective Scouting levels.',
    primarySection:'23',
    additionalSections:['13.1.26'],
    workerRule:'No Ranger worker activity is published',
    workerDetail:'Scouting remains the activity skill. Ranger is a progression/access skill used to reach later Ranger research topics.',
    summary:'A Scouting research-progression skill. Ranger I unlocks the Group C Ranger skill, and later Ranger research increases effective Scouting rather than creating a separate Ranger activity.',
    factors:[
      { factor:'Unlock', effect:'Complete Ranger I', detail:'The current Research List explicitly states that completing Ranger I allows the Tribe to learn the new Group C Ranger skill.' },
      { factor:'Ranger I–III', effect:'+1 / +3 / +5 Scouting', detail:'The early research topics progressively increase Scouting and lead into the standalone Ranger research chain.' },
      { factor:'Skill requirement', effect:'Ranger 10 for Ranger IV+', detail:'Ranger IV requires Ranger Skill Level 10 plus Ranger III research.' },
      { factor:'Purpose', effect:'Access Ranger IV+', detail:'The Research List describes Ranger as purely a skill to access Ranger research topics IV and beyond.' },
      { factor:'Direct activity/output', effect:'None published', detail:'Ranger does not replace Scouting and has no separate worker or production formula.' }
    ],
    researchEffectOverrides:{
      'Ranger I, Ranger II, Ranger III':'Ranger I adds +1 Scouting, Ranger II adds +3 Scouting and Ranger III adds +5 Scouting. Completing Ranger I unlocks the learnable Group C Ranger skill.',
      'Ranger IV, Ranger V, Ranger VI':'Each completed topic adds +2 Scouting. Ranger IV requires Ranger 10 and Ranger III research.',
      'Ranger 7+':'Every Ranger research topic at level 7 or higher adds an additional +2 Scouting levels.'
    },
    relatedSkills:['Scouting','Seeking']
  });

  register('BUSH LORE', {
    name:'Bush Lore',
    aliases:['BushLore'],
    researchAliases:['Bush Lore','BushLore','Bush Lore I','Bush Lore II','Bush Lore III','Bush Lore IV','Bush Lore V','Bush Lore VI'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-unlocked Seeking progression skill',
    levelDetail:'Bush Lore is a research-unlocked Group C skill. Completing Bush Lore I unlocks the learnable Bush Lore skill; Bush Lore skill level 10 is then required to enter the Bush Lore IV+ research chain, whose published effect is to add effective Seeking levels.',
    primarySection:'23',
    additionalSections:['13.1.26','13.1.27'],
    workerRule:'No Bush Lore worker activity is published',
    workerDetail:'Seeking remains the activity skill. Bush Lore is a progression/access skill used to reach later Bush Lore research topics.',
    summary:'A Seeking research-progression skill. Bush Lore I unlocks the Group C Bush Lore skill, and later Bush Lore research increases effective Seeking rather than creating a separate Bush Lore activity.',
    factors:[
      { factor:'Unlock', effect:'Complete Bush Lore I', detail:'The current Research List explicitly states that completing Bush Lore I allows the Tribe to learn the new Group C Bush Lore skill.' },
      { factor:'Bush Lore I–III', effect:'+1 / +3 / +5 Seeking', detail:'The early research topics progressively increase Seeking and lead into the standalone Bush Lore research chain.' },
      { factor:'Skill requirement', effect:'Bush Lore 10 for Bush Lore IV+', detail:'Bush Lore IV requires Bush Lore Skill Level 10 plus Bush Lore III research.' },
      { factor:'Purpose', effect:'Access Bush Lore IV+', detail:'The Research List describes Bush Lore as purely a skill to access Bush Lore research topics IV and beyond.' },
      { factor:'Direct activity/output', effect:'None published', detail:'Bush Lore does not replace Seeking and has no separate worker or production formula.' }
    ],
    researchEffectOverrides:{
      'Bush Lore I, Bush Lore II, Bush Lore III':'Bush Lore I adds +1 Seeking, Bush Lore II adds +3 Seeking and Bush Lore III adds +5 Seeking. Completing Bush Lore I unlocks the learnable Group C Bush Lore skill.',
      'Bush Lore IV, Bush Lore V, Bush Lore VI':'Each completed topic adds +2 Seeking. Bush Lore IV requires Bush Lore 10 and Bush Lore III research.',
      'Bush Lore 7+':'Every Bush Lore research topic at level 7 or higher adds an additional +2 Seeking levels.'
    },
    relatedSkills:['Seeking','Scouting']
  });

  // Final N02.2 + Research List reconciliation. This is deliberately explicit so
  // stale Excel-valid skills cannot silently become current Group C dossiers.
  S.groupCAudit = Object.freeze({
    mandateRevision:'N02.2',
    researchRevision:'April 11 2026',
    baseTableSkills:Object.freeze([
      'Archaeology','Architecture','Alchemy','Apiarism','Art','Banking','Baking',
      'Brick Making','Cooking','Dance','Distilling','Engineering','Farming','Glasswork',
      'Literacy','Maintain Boats','Milling','Music','Refining','Research','Sanitation',
      'Seeking','Shipbuilding','Stonework'
    ]),
    researchUnlockedSkills:Object.freeze([
      'Apiology','Agriculture','Cheesemaking','Geology','Ranger','Bush Lore'
    ]),
    currentSkills:Object.freeze([
      'Archaeology','Architecture','Alchemy','Apiarism','Art','Banking','Baking',
      'Brick Making','Cooking','Dance','Distilling','Engineering','Farming','Glasswork',
      'Literacy','Maintain Boats','Milling','Music','Refining','Research','Sanitation',
      'Seeking','Shipbuilding','Stonework','Apiology','Agriculture','Cheesemaking',
      'Geology','Ranger','Bush Lore'
    ]),
    notCurrentGroupCSkillAttempts:Object.freeze([
      { name:'Design', reason:'N02.2 says this is gone for the time being and it is not in the current Group C table.' },
      { name:'Furniture', reason:'N02.2 says this is gone for the time being and it is not in the current Group C table.' },
      { name:'Astronomy', reason:'N02.2 describes it as research-only, but it is not listed in the current Group C table or explicitly introduced by Research as a new Group C skill.' }
    ])
  });
})();

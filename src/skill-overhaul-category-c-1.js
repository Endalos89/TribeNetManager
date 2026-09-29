(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'C',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  register('ARCHAEOLOGY', {
    name:'Archaeology',
    aliases:['Arch'],
    researchAliases:['Archaeology','Arch'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Special-site / excavation unlock skill',
    levelDetail:'Archaeology 1 allows one Tribe in the Clan to be designated as the Archaeology Tribe. That Tribe and eligible sub-units may excavate owned ruin sites when they also have access to Excavation 1.',
    primarySection:'26',
    additionalSections:['29.4','8.7.4'],
    workerRule:'10 excavators with Shovels or Picks produce 1 Artefact per turn at an owned archaeological site',
    workerDetail:'The fixed excavation rule uses Excavation 1 and 10 people. Archaeology itself unlocks the special Tribe/site relationship rather than multiplying the number of workers or Artefacts.',
    summary:'Unlocks archaeological excavation for one designated Tribe per Clan. Archaeology works with Excavation: the Archaeology Tribe, one of its Elements, or one of its Garrisons may recover Artefacts from owned ruins and use them for population, morale, Fair sales and research benefits.',
    levelUses:[
      { level:1, use:'Designate the Clan’s Archaeology Tribe', kind:'Special-unit unlock', detail:'Only one Archaeology Tribe is allowed per Clan. Notify the GM once a Tribe gains Archaeology 1.', source:'26' }
    ],
    outputs:[
      { item:'Artefact', label:'Artefact', type:'Archaeological find', detail:'At an owned archaeological site, 10 people with Shovels or Picks and Excavation 1 recover exactly 1 Artefact per turn. Artefacts weigh 10 lb.', source:'26' }
    ],
    factors:[
      { factor:'Clan limit', effect:'1 Archaeology Tribe', detail:'Only one Tribe per Clan may be designated as the Archaeology Tribe.' },
      { factor:'Required supporting skill', effect:'Excavation 1', detail:'Archaeology permits the special excavation role, but Excavation 1 is still required to dig for Artefacts.' },
      { factor:'Eligible excavation units', effect:'Parent Tribe, Element or Garrison', detail:'Elements/Garrisons must belong to the Archaeology Tribe. Couriers and Fleets cannot be excavation units.' },
      { factor:'Initial site', effect:'Guaranteed roughly 15–25 hexes away', detail:'The player requests placement but is not told the position. The initial ruins site belongs exclusively to that Clan and cannot be transferred.' },
      { factor:'Site control', effect:'Can be lost in combat', detail:'If defenders at the site are attacked and defeated, the victor may subsequently excavate it with an eligible Archaeology/Excavation unit.' }
    ],
    factTables:[{
      kicker:'Artefact uses',
      title:'Published Archaeology exchange options',
      source:'26',
      columns:[{key:'cost',label:'Artefacts'},{key:'benefit',label:'Benefit'},{key:'conditions',label:'Conditions'}],
      rows:[
        { cost:'10', benefit:'50 Actives', conditions:'Artefacts must be returned to the parent Archaeology Tribe; Actives may be transferred to another same-site Clan unit.' },
        { cost:'15', benefit:'75 Warriors', conditions:'Artefacts must be returned to the parent Archaeology Tribe; Warriors may be transferred to another same-site Clan unit.' },
        { cost:'1 each', benefit:'1,200 Silver at Fair', conditions:'Maximum 5 per Fair; parent Tribe and Artefacts must be present; counts against trade limits and does not scale with Fair multipliers.' },
        { cost:'10', benefit:'+0.01 General Morale', conditions:'Artefacts must be returned to the parent Archaeology Tribe claiming the morale.' }
      ]
    }],
    researchEffectOverrides:{
      'Relic':'At the original Artefact site, immediately gain 1 Relic and thereafter gain 1 Relic each year in month 1 while normal Excavation continues.',
      'Relic 2':'Adds a second immediate and annual month-1 Relic at the original Artefact site.',
      'Relic 3':'Adds a third immediate and annual month-1 Relic at the original Artefact site; this is the stated maximum for the main site.',
      'Second Site':'Provides the rough location of a second Ruin site within 30 hexes; only one Archaeology unit may excavate any single site.',
      'Second Site Relic 1':'Begins the equivalent Relic chain at the second Artefact site; later Second Site Relic levels add further annual Relics.',
      'Tomb Robbers':'At the original Artefact site, immediately and then annually grants three different rare resources of unknown quantity from the listed pool, and enables robbing other Clans’ Archaeology sites under its rules.'
    },
    relatedSkills:['Excavation','Administration','Garrison','Research']
  });

  benefit('Artefact', { skill:'Archaeology', value:'1 per turn at an owned site', detail:'10 excavators with Shovels or Picks and Excavation 1 recover exactly one Artefact per turn at an owned archaeological site.', source:'Mandate', section:'26' });

  register('ARCHITECTURE', {
    name:'Architecture',
    aliases:['Archit'],
    researchAliases:['Architecture','Archit'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'unlock',
    mechanicLabel:'Higher-order construction prerequisite skill',
    levelDetail:'The current Mandate defines Architecture as a Group C skill required for higher-order buildings and structures. It does not publish a generic per-level production formula.',
    primarySection:'29.6',
    additionalSections:[],
    workerRule:'No published Architecture worker cap',
    workerDetail:'Architecture acts as a prerequisite where a specific construction or research recipe calls for it; labour requirements come from that project’s own recipe.',
    summary:'A prerequisite-style construction skill. Current public rules describe Architecture as necessary for higher-order buildings/structures, while individual recipes or research topics specify the level actually required.',
    levelUses:[
      { level:3, item:'Moulding', use:'Architecture 3 prerequisite', kind:'Research recipe prerequisite', detail:'The published Moulding research recipe requires Architecture 3 alongside Design 6 and Pottery 10.', source:'Research / Moulding' }
    ],
    researchEffectOverrides:{
      'Moulding':'Architecture 3 is a prerequisite for producing Moulding under the published research recipe; Moulding is described as a decorative component for prestigious future buildings.'
    },
    relatedSkills:['Engineering','Stonework','Woodwork','Design','Pottery']
  });

  register('ALCHEMY', {
    name:'Alchemy',
    aliases:['Alc'],
    researchAliases:['Alchemy','Alc'],
    baseline:'Woodwork',
    layout:'unlock',
    mechanic:'research-access',
    mechanicLabel:'Research-access / specialist recipe skill',
    levelDetail:'The Mandate currently defines Alchemy as a Group C research skill and notes that further expansion is planned. Its published current recipe use is Greek Fire at Alchemy 10.',
    primarySection:'29.2',
    additionalSections:[],
    workerRule:'No base Alchemy activity or generic worker cap is published',
    workerDetail:'Workers are assigned under the activity specified by a researched recipe. Greek Fire, for example, is made under Refining rather than a standalone Alchemy activity.',
    summary:'A Group C research skill whose current public rules are deliberately narrow. The Research List presently uses Alchemy 10 as a prerequisite for Greek Fire; no broader base Alchemy productivity effect is stated in N02.2.',
    levelUses:[
      { level:10, item:'Greek Fire', use:'Unlocks Greek Fire research recipe', kind:'Research prerequisite', detail:'Greek Fire requires Alchemy 10 and Refining 3 and is made as a Refining activity.', source:'Research / Greek Fire' }
    ],
    researchEffectOverrides:{
      'Greek Fire':'At Alchemy 10 and Refining 3, 2 people may make 1 Greek Fire from 1 Jar, 1 Oil, 2 Tar and 4 Sulphur under Refining. Clan-wide production is capped at 40 assigned people per turn; a Catapult may use 5 Greek Fire in naval combat.'
    },
    relatedSkills:['Refining','Heavy Weapons','Mariner']
  });

  benefit('Greek Fire', { skill:'Alchemy', value:'Alchemy 10 prerequisite', detail:'Greek Fire research requires Alchemy 10; production is performed under Refining 3.', source:'Research', research:'Alchemy / Greek Fire' });

  register('APIARISM', {
    name:'Apiarism',
    aliases:['Api'],
    researchAliases:['Apiarism','Api'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Apiary tending / research progression skill',
    levelDetail:'Current N02.2 states the Apiary tending workload (1 person maintains 5 Hives and collects Honey/Wax) but does not publish a per-level Honey/Wax output multiplier for Apiarism.',
    primarySection:'14.3.1',
    additionalSections:['14.3.2','14.3.3'],
    workerRule:'1 person tends 5 Hives and collects their Honey and Wax',
    workerDetail:'This tending relationship is fixed in the current Mandate and is not expressed as 10 workers per Apiarism level. One Apiary houses up to 20 Hives.',
    summary:'Supports beekeeping through Apiary tending and a substantial research chain. The current Mandate gives the tending workload and Apiary construction rules, while research raises effective Apiarism, expands Hives and unlocks Propolis.',
    factors:[
      { factor:'Tending workload', effect:'1 worker per 5 Hives', detail:'The worker both maintains the Hives and collects Honey and Wax.' },
      { factor:'Apiary capacity', effect:'20 Hives per Apiary', detail:'Each Apiary may house up to 20 Hives.' },
      { factor:'Terrain restriction', effect:'No Apiary in arid, desert, snow or tundra', detail:'The construction restriction applies to Apiaries.' },
      { factor:'Standard construction', effect:'Engineering 6 + Metalwork 3', detail:'Uses 100 Logs, 20 Iron, 100 Coal and 2 Cloth (or 20 Leather); Bronze/Brass may substitute under normal rules.' },
      { factor:'Alternate construction', effect:'Engineering 6 + Woodwork 4', detail:'Uses 160 Logs and 2 Cloth (or 20 Leather).' },
      { factor:'Per-level base output', effect:'Not published', detail:'N02.2 does not state a generic Honey/Wax multiplier by Apiarism level, so none is inferred here.' }
    ],
    researchEffectOverrides:{
      'Apiarism 11':'+1 Apiarism level, taking Apiarism 10 to 11 and leading into the Apiology research chain.',
      'Apiology I, Apiology II, Apiology III':'Each topic adds +2 Apiarism. Completing Apiology I also unlocks the Group C Apiology skill used to access Apiology IV and beyond.',
      'Breed New Queens':'Once per year in Spring month 1, automatically adds 24 new Hives to the researching Tribe.',
      'Propolis':'Allows the Tribe itself to collect Propolis from Hives. Propolis weighs 1 lb and counts as twice the effectiveness of Herbs for Healing.',
      'Apiology IV, Apiology V, Apiology VI':'Each adds +2 Apiarism; every Apiology research topic at level 7 or higher also adds +2 Apiarism.'
    },
    relatedSkills:['Apiology','Healing','Engineering','Metalwork','Woodwork']
  });

  benefit('Propolis', { skill:'Apiarism', value:'Research collection product', detail:'Propolis research allows the Tribe to collect Propolis from Hives.', source:'Research', research:'Apiarism / Propolis' });
  benefit('Propolis', { skill:'Healing', value:'Counts as 2 Herbs', detail:'When used for Healing, Propolis is twice as powerful as Herbs.', source:'Research', research:'Apiarism / Propolis' });

  register('ART', {
    name:'Art',
    aliases:['C Art'],
    researchAliases:['Art','C Art'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Fair cultural-income scaling skill',
    levelDetail:'At Fair, Art generates Silver using Participants × (2 + Art/4 + Economics/4), with a maximum of 500 participants in the Art activity.',
    primarySection:'15.1',
    additionalSections:['29.7'],
    workerRule:'Maximum 500 participants in the Art cultural activity at Fair',
    workerDetail:'Cultural Art participation is separate from normal crafting recipes. It counts as one slot against the Fair’s 10-item trade limit.',
    summary:'A Group C cultural Fair skill. Art level scales Silver generated by participants and also supports research crafts such as Bronze and Marble Statues plus the Spring Arts Festival Art chain.',
    factors:[
      { factor:'Fair Silver formula', effect:'Participants × (2 + Art/4 + Economics/4)', detail:'Equivalent published form: Participants × (8 + Art + Economics) ÷ 4.' },
      { factor:'Participant cap', effect:'500', detail:'No more than 500 people may participate in each cultural activity.' },
      { factor:'Trade limit', effect:'Uses 1 Fair slot', detail:'Participation in Art counts as one slot against the 10-item Fair trade limit.' },
      { factor:'Goods Tribe relationship', effect:'Allows distributed participation', detail:'Tribes with cultural skills in a Goods Tribe relationship with the trading Tribe may perform their cultural skill at Fair.' },
      { factor:'Player calculation', effect:'Manual responsibility', detail:'Players are responsible for calculating Silver generated from cultural activities; where the Fair spreadsheet differs, the spreadsheet prevails.' }
    ],
    researchEffectOverrides:{
      'Bronze Statue':'Unlocks Bronze Statues as an Art or Metalwork activity: 20 people, Metalwork 8, 1,000 Bronze, 200 Coal and 200 Silver. They are Trade Goods sellable at Fair/eligible Trade Towns.',
      'Marble Statue':'Unlocks Marble Statues as an Art or Stonework activity: 12 people, Stonework 6, Art 6 and 200 Marble. Completing the research also causes a Marble mine hex to be placed near the selected village.',
      'Spring Arts Festival Art':'Once per year in Spring, 500 Warriors/Actives may spend the month on the festival and no other work to gain +0.02 General Morale plus 20 Gold or an equivalent desired commodity.',
      'Inter Spring Arts Festival Art':'With Administration 10 and an Amphitheatre, extends the Art festival so eligible Tribes from other Clans may participate under the published on-location restrictions.'
    },
    relatedSkills:['Economics','Music','Dance','Metalwork','Stonework','Engineering']
  });

  benefit('Bronze Statue', { skill:'Art', value:'Research craft / Trade Good', detail:'Bronze Statue research allows the item to be crafted as an Art or Metalwork activity and sold at Fair/eligible Trade Towns.', source:'Research', research:'Art / Bronze Statue' });
  benefit('Marble Statue', { skill:'Art', value:'Art 6 research craft', detail:'Marble Statue research uses Art 6 and Stonework 6 and creates a sellable Trade Good.', source:'Research', research:'Art / Marble Statue' });

  register('BANKING', {
    name:'Banking',
    aliases:['Bank'],
    researchAliases:['Banking','Bank'],
    baseline:'Economics',
    layout:'category-a-activity',
    mechanic:'scaling',
    mechanicLabel:'Fixed-term deposit interest scaling skill',
    levelDetail:'Each Banking level adds 1.5% interest to a 12-month deposit, using the Banking level at the time the deposit is made. Example: Banking 8 = 12% return.',
    primarySection:'25',
    additionalSections:['29.10'],
    workerRule:'Not a worker-assignment skill',
    workerDetail:'Banking controls deposit returns. Construction of the Bank uses Engineering; deposits and withdrawals follow the Banking process rather than an Activity workforce.',
    summary:'A Group C skill unlocked by Economics 10. Banking sets the interest rate on fixed 12-month deposits and governs a network beginning with one Silver Bank and potentially up to three additional desired-commodity Banks.',
    factors:[
      { factor:'Skill unlock', effect:'Economics 10', detail:'A Tribe with Economics 10 may attempt Banking.' },
      { factor:'Interest rate', effect:'+1.5% per Banking level', detail:'The level is fixed when the deposit is made; Banking 8 therefore yields 12% after 12 months.' },
      { factor:'Deposit term', effect:'12 months', detail:'Deposited goods are unavailable during the term. No early withdrawals are permitted.' },
      { factor:'Deposit timing', effect:'1 deposit cycle per 12 months', detail:'The owner chooses the first deposit month; deposits into later Banks must be made in that same annual month.' },
      { factor:'First Bank', effect:'Silver Bank first', detail:'The first Bank must deal in Silver before desired-commodity Banks are established.' },
      { factor:'Clan Bank limit', effect:'1 Silver + up to 3 other Banks', detail:'Only one Bank per commodity and one of the Clan’s Banks per NPC town/city; an NPC town/city can have at most three Banks total.' },
      { factor:'Record keeping', effect:'Player responsibility', detail:'The Bank operator must keep accurate deposit/rate/return records and may be audited by the GM.' }
    ],
    researchEffectOverrides:{
      'Banking 11':'Raises Banking to 11, increasing deposit interest; the Research List states Banking 11 is the maximum research level.',
      'Letter of Credit':'With a Silver Bank built, one Silver-priced purchase per Fair may be made by any Clan unit and paid for by a home unit at the Silver Bank location.'
    },
    relatedSkills:['Economics','Engineering','Research']
  });

  benefit('Bank', { skill:'Banking', value:'+1.5% interest per Banking level', detail:'A Bank returns the fixed-term deposit after 12 months with interest determined by Banking level when deposited.', source:'Mandate', section:'25' });

  register('BAKING', {
    name:'Baking',
    aliases:['Bak'],
    researchAliases:['Baking','Bak'],
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity',
    mechanicLabel:'Worker capacity / food conversion skill',
    levelDetail:'Baking allows 10 actual workers per skill level until level 10, when the Baking skill worker limit becomes unlimited. A Bakery and enough Ovens are also required.',
    primarySection:'14.4.1',
    additionalSections:['14.4.2'],
    workerRule:'10 Baking workers per skill level; unlimited at level 10',
    workerDetail:'Each Oven supports up to 10 Baking workers. Each Bakery can contain up to 100 Ovens, and a site/hex may contain at most 10 Bakeries.',
    summary:'Converts Grain or Flour into Bread using a Bakery. Skill level controls the number of assigned bakers, while Ovens provide the physical worker capacity. Research adds lighter Waybread and improved flour-based production with Yeast.',
    outputs:[
      { item:'Bread', label:'Bread from Grain', type:'Food', detail:'1 baker uses 20 lb Grain to make 5 Bread. Each Bread is 1 Prov and must be eaten in the turn it is made.', source:'14.4.1' },
      { item:'Bread', label:'Bread from Flour', type:'Food', detail:'1 baker uses 40 Flour to make 15 Bread.', source:'14.4.1' }
    ],
    factors:[
      { factor:'Skill worker cap', effect:'10 workers per level; unlimited at 10', detail:'Baking is one of the # skills in the Mandate skill table.' },
      { factor:'Bakery', effect:'Required', detail:'Baking cannot be performed without a Bakery.' },
      { factor:'Oven capacity', effect:'10 bakers per Oven', detail:'A Bakery may contain up to 100 Ovens.' },
      { factor:'Site capacity', effect:'10 Bakeries / 1,000 Ovens', detail:'A single hex is capped at ten Bakeries.' },
      { factor:'Bakery shell', effect:'Engineering 3 + 40 Logs', detail:'Logs are installed at 2 per person.' },
      { factor:'Iron Oven', effect:'100 Iron + 200 Coal', detail:'Metal installs at 10 lb/person; Bronze/Brass and Stonework alternatives are also published.' }
    ],
    researchEffectOverrides:{
      'Waybread':'1 worker may make 6 Waybread from 20 Grain or 15 from 40 Flour. Each counts as 1 Prov but weighs only 5 lb and is consumed automatically after ordinary Bread/Provs in the published food order.',
      'Yeast':'When Baking from Flour, increases Bread production by 50% and increases Flour consumption proportionately.'
    },
    relatedSkills:['Engineering','Stonework','Milling','Farming','Cooking']
  });

  benefit('Waybread', { skill:'Baking', value:'Lighter preserved bread', detail:'Waybread research makes 1-Prov bread weighing 5 lb each: 6 from 20 Grain or 15 from 40 Flour per worker.', source:'Research', research:'Baking / Waybread' });
  benefit('Bakery', { skill:'Baking', value:'Required facility', detail:'A Bakery is required for Baking; each Oven supports up to 10 Baking workers.', source:'Mandate', section:'14.4.1' });
})();

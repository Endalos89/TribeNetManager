(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'A',
    researchAliases:[profile.name],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  register('EXCAVATION', {
    name:'Excavation',
    baseline:'Forestry',
    layout:'category-a-activity',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / site activity skill',
    levelDetail:'Excavation is a # skill: worker capacity is 10 × skill level, while the basic archaeological dig has a fixed site return.',
    primarySection:'26',
    additionalSections:['12.2','23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'A normal archaeological dig uses 10 people. Expert Dig research can use 20 people to recover two Artefacts in a turn.',
    summary:'Excavation is used with Archaeology at owned archaeological sites to recover Artefacts.',
    outputs:[
      { item:'Artefact', label:'Artefact', rate:'1 / turn', type:'Archaeological find', detail:'At an owned excavation site, 10 people with Shovels or Picks and Excavation 1 recover one Artefact per turn.', source:'26' }
    ],
    factors:[
      { factor:'Archaeology', effect:'Archaeology 1 required', detail:'The Clan must designate one Archaeology Tribe; only that Tribe and eligible sub-units may excavate its archaeological sites.' },
      { factor:'Excavation skill', effect:'Excavation 1 required', detail:'The digging unit needs Excavation 1. The general Group A # worker-cap rule still applies.' },
      { factor:'Implements', effect:'Shovels or Picks required', detail:'The 10 people performing the normal dig must use Shovels or Picks.' },
      { factor:'Site', effect:'Owned archaeological site required', detail:'The guaranteed base return applies at an archaeological site available to the Archaeology Tribe.' }
    ],
    factTables:[
      { kicker:'Artefacts', title:'What Artefacts can be used for', source:'26', columns:[
        { key:'cost', label:'Artefacts' }, { key:'result', label:'Result' }, { key:'detail', label:'Conditions / notes' }
      ], rows:[
        { cost:'10', result:'50 Actives', detail:'Artefacts must be returned to the parent Archaeology Tribe; the Actives may be transferred to a Clan unit at the same site.' },
        { cost:'15', result:'75 Warriors', detail:'Artefacts must be returned to the parent Archaeology Tribe; the Warriors may be transferred to a Clan unit at the same site.' },
        { cost:'Up to 5 / Fair', result:'1,200 Silver each', detail:'The Artefact and parent Tribe must attend the Fair. The trade counts against Trade limits and does not scale with Fair multipliers.' },
        { cost:'10', result:'+0.01 General Morale', detail:'Morale is received by the parent Archaeology Tribe.' }
      ] }
    ],
    researchEffectOverrides:{
      'Expert Dig':'Two Artefacts may be dug per turn using 20 people with implements; the unit may carry unlimited Artefacts.',
      'Holy Artefact':'Once per year, search for a Holy Artefact; while retained it adds +0.05 General Morale to one Tribe and is worth 12 normal Artefacts.',
      'Tomb Robbers':'See the linked Archaeology research rules.'
    },
    notes:[
      'Only one Archaeology Tribe per Clan may be designated.',
      'An Excavation unit may be the Archaeology Tribe, one of its Elements, or one of its Garrisons; Couriers and Fleets may not be Excavation units.',
      'Artefacts weigh 10 lb each under the Mandate base rules.'
    ],
    relatedSkills:['Archaeology','Metalwork']
  });

  register('FISHING', {
    name:'Fishing',
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Efficiency / food-gathering skill',
    levelDetail:'Fishing can be performed from level 0; skill, equipment and suitable water access determine its useful output.',
    primarySection:'22',
    additionalSections:['22.1.1','22.2','22.2.1','29.18','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Fishing does not use the 10 × skill-level worker cap. Salting is a separate worker-limited skill/activity.',
    summary:'Collects Fish for food from suitable water. Fish are caught during Activities, carried through Movement, then eaten or lost unless preserved.',
    outputs:[
      { item:'Fish', label:'Fish', rate:'Variable', type:'Food', detail:'Fish caught contribute food that turn. They weigh 1 lb each, are carried during Movement, and uneaten Fish are discarded unless Salted.', source:'22.1' }
    ],
    factors:[
      { factor:'Water access', effect:'Required', detail:'Land units must be coastal or adjacent to lake/river/ocean water. Fleets may also fish off the coast and in deep ocean.' },
      { factor:'Land / naval fishing', effect:'Both supported', detail:'Land Fishing happens during Activities; Fleet crews may also be assigned to Fishing during Activities.' },
      { factor:'Village vessels', effect:'Improve land-based returns', detail:'Vessels and similar support based in a Village can add to land-based Fishing returns.' },
      { factor:'Preservation', effect:'Excess Fish require Salting', detail:'Fish not eaten or Salted in the turn caught are lost at end of turn.' }
    ],
    implements:[
      { name:'Net', value:'Improves Fishing returns', baseMax:'1 / fisher', baseMaxBenefit:'Amount not stated', craft:[{skill:'Weaving',level:3},{skill:'Weaving',level:5,note:'alternate recipe'}], requiresResearch:false, detail:'Nets add to land-based Fishing returns. A Trawling Net research rule confirms a single fisher uses either a Net or Trawling Net, not both.', source:'Mandate', section:'22.1.1' },
      { name:'Trawling Net', value:'+2 AM', baseMax:'1 / fisher', baseMaxBenefit:'+2 AM', craft:[{skill:'Weaving',level:7}], requiresResearch:true, detail:'Counts as +2 AM when Fishing using a Trawler. Trawling Nets cannot exceed the number of fishers and cannot be combined with a normal Net on the same worker.', source:'Research', research:'Fishing / Trawling Net' }
    ],
    supportImplements:[
      { name:'Trawler', value:'Greater Fishing output', baseMax:'—', baseMaxBenefit:'Amount not stated', craft:[{skill:'Shipbuilding',level:8},{skill:'Woodwork',level:8},{skill:'Metalwork',level:7}], requiresResearch:true, detail:'A purpose-built vessel that increases Fish output. The Research List does not state a fixed multiplier, and Trawlers may be used without holding the research.', source:'Research', research:'Fishing / Trawler' }
    ],
    implementTitle:'Fishing implements',
    implementRule:'A fisher may use a normal Net or a Trawling Net, not both. Trawling Nets require a Trawler to provide their +2 AM benefit.',
    supportTitle:'Fishing vessel support',
    researchEffectOverrides:{
      'Trawling Net':'+2 AM when Fishing using a Trawler; one per fisher maximum and mutually exclusive with a normal Net.',
      'Trawler':'Increases Fish output; no fixed numerical multiplier is stated, and the vessel may be used by Tribes without the research.'
    },
    relatedSkills:['Salting','Weaving','Shipbuilding','Woodwork','Metalwork']
  });

  benefit('Net', { skill:'Fishing', value:'Improves Fishing returns', detail:'Adds to land-based Fishing returns; the Mandate does not state a fixed numerical bonus.', source:'Mandate', section:'22.1.1' });
  benefit('Trawling Net', { skill:'Fishing', value:'+2 AM', detail:'When Fishing using a Trawler; one per fisher maximum and cannot be combined with a normal Net.', source:'Research', research:'Fishing / Trawling Net' });
  benefit('Trawler', { skill:'Fishing', value:'Greater Fishing output', detail:'Purpose-built Fishing vessel; the Research List does not give a fixed multiplier.', source:'Research', research:'Fishing / Trawler' });

  const furrierImplements = [
    { name:'Trap', value:'+0.10 AM', baseMax:'5', baseMaxBenefit:'+0.50 AM', craft:[{skill:'Metalwork',level:2}], requiresResearch:false, detail:'Up to five Traps per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Snare', value:'+0.05 AM', baseMax:'5', baseMaxBenefit:'+0.25 AM', craft:[{skill:'Weaving',level:3}], requiresResearch:false, detail:'Up to five Snares per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Bow', value:'+0.15 AM', baseMax:'1', baseMaxBenefit:'+0.15 AM', craft:[{skill:'Weapons',level:1}], requiresResearch:false, detail:'One Bow per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Sling', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', craft:[{skill:'Weapons',level:1},{skill:'Weaving',level:2},{skill:'Leatherwork',level:2}], requiresResearch:false, detail:'One Sling per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Arbalest', value:'+0.20 AM', baseMax:'1', baseMaxBenefit:'+0.20 AM', craft:[{skill:'Weapons',level:8}], requiresResearch:false, detail:'One Arbalest per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Weapons',level:2}], requiresResearch:false, detail:'One Spear per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Bone Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Bonework',level:3}], requiresResearch:false, detail:'One Bone Spear per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Stone Spear', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Stonework',level:4}], requiresResearch:false, detail:'One Stone Spear per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Spetum', value:'+0.05 AM', baseMax:'1', baseMaxBenefit:'+0.05 AM', craft:[{skill:'Weapons',level:1}], requiresResearch:false, detail:'One Spetum per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Net', value:'+0.10 AM', baseMax:'1', baseMaxBenefit:'+0.10 AM', craft:[{skill:'Weaving',level:3},{skill:'Weaving',level:5,note:'alternate recipe'}], requiresResearch:false, detail:'One Net per Furrier as the chosen implement type.', source:'Mandate', section:'13.1.15' },
    { name:'Improved Trap', value:'+0.15 AM', baseMax:'5', baseMaxBenefit:'+0.75 AM', craft:[{skill:'Metalwork',level:3}], requiresResearch:true, detail:'Up to five Improved Traps per Furrier, with no standard Traps mixed in.', source:'Research', research:'Furrier / Improved Trap' },
    { name:'Advanced Trap', value:'+1.00 AM', baseMax:'1', baseMaxBenefit:'+1.00 AM', craft:[{skill:'Metalwork',level:10}], requiresResearch:true, detail:'One Advanced Trap per Furrier, with no standard or Improved Traps mixed in.', source:'Research', research:'Furrier / Advanced Trap' }
  ];

  register('FURRIER', {
    name:'Furrier',
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Efficiency / mixed-output gathering skill',
    levelDetail:'Furrying follows the same proportional effects from tools, terrain, weather, water access and relevant skill level as Hunting.',
    primarySection:'13.1.10',
    additionalSections:['13.1.15','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Furrier is not limited to 10 workers per skill level. In Winter the Mandate advises assigning at least 10 Furriers.',
    summary:'A form of Hunting focused on preserving hides. It produces fewer Provisions but also produces Skins and Furs, with seasonal output ratios.',
    outputs:[
      { item:'Provisions', label:'Provisions', rate:'Lower than Hunting', type:'Food', detail:'Furriers return substantially fewer Provisions than Hunters.', source:'13.1.10' },
      { item:'Skins', label:'Skins', rate:'Variable', type:'Raw material', detail:'Furrying provides Skins; the output mix is seasonally dependent.', source:'13.1.10' },
      { item:'Furs', label:'Furs', rate:'Variable', type:'Raw material', detail:'Furrying provides Furs; the output mix is seasonally dependent.', source:'13.1.10' },
      { item:'Leather', label:'Leather', rate:'Variable', type:'Processed material', detail:'The Mandate states that the ratio of Provisions, Furs and Leather obtained from Furrying is seasonally dependent.', source:'13.1.10' }
    ],
    factors:[
      { factor:'Terrain', effect:'Affects returns', detail:'Uses the same proportional terrain effects as Hunting.' },
      { factor:'River / Lake / Ocean border', effect:'Affects returns', detail:'Water-access effects are proportional in the same way as Hunting.' },
      { factor:'Season', effect:'Changes output mix', detail:'The ratio of Provisions, Furs and Leather is seasonally dependent. In Winter, do not assign fewer than 10 Furriers.' },
      { factor:'Weather', effect:'Affects returns', detail:'Uses the same proportional weather effects as Hunting.' },
      { factor:'Furrier skill', effect:'Affects returns', detail:'The relevant skill level affects output in the same proportional manner as Hunting.' }
    ],
    implements:furrierImplements,
    implementTitle:'Furrier implements',
    implementRule:'Furriers follow the Hunting implement rule: an individual uses one implement type, while trap-family implements may use multiple copies where the rules allow.',
    researchEffectOverrides:{
      'Advanced Trap':'+1.00 AM for one Furrier using one Advanced Trap; do not mix it with standard or Improved Traps.',
      'Improved Trap':'+0.15 AM each; up to five Improved Traps provide +0.75 AM.',
      'Winter Furs':'During Winter, a Furrier with 5 Traps or better produces 4 Winter Furs in addition to ordinary Furrying.'
    },
    notes:['In Winter the Mandate advises assigning at least 10 Furriers.'],
    relatedSkills:['Hunting','Metalwork','Weapons','Weaving','Leatherwork']
  });

  for (const item of furrierImplements) {
    benefit(item.name, { skill:'Furrier', value:item.value, detail:item.detail, source:item.source, section:item.section, research:item.research });
  }

  register('GUTTING', {
    name:'Gutting',
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / animal processing skill',
    levelDetail:'Skill level controls worker capacity; animal type determines how many animals one worker can process.',
    primarySection:'13.1.12',
    additionalSections:['8.4','13.1.30'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'The cap is shared across the Tribe and its Elements. Gutting may be combined with Skinning and/or Boning.',
    summary:'Processes slaughtered animals to recover Gut. The animal itself also yields Provisions when processed.',
    processRows:[
      { activity:'Gut Goats', perWorker:'1 worker', inputs:[{entity:'Goat',label:'6 Goats'}], outputs:[{entity:'Gut',label:'12 Gut'},{entity:'Provisions',label:'24 Provisions'}], detail:'Six Goats per worker.', source:'13.1.12' },
      { activity:'Gut Cattle', perWorker:'1 worker', inputs:[{entity:'Cattle',label:'3 Cattle'}], outputs:[{entity:'Gut',label:'12 Gut'},{entity:'Provisions',label:'60 Provisions'}], detail:'Three Cattle per worker.', source:'13.1.12' },
      { activity:'Gut Horses', perWorker:'1 worker', inputs:[{entity:'Horse',label:'2 Horses'}], outputs:[{entity:'Gut',label:'12 Gut'},{entity:'Provisions',label:'60 Provisions'}], detail:'Two Horses per worker.', source:'13.1.12' },
      { activity:'Gut Elephant', perWorker:'1 worker', inputs:[{entity:'Elephant',label:'1 Elephant'}], outputs:[{entity:'Gut',label:'12 Gut'},{entity:'Provisions',label:'60 Provisions'}], detail:'The animal-processing summary gives one Elephant per Gutting worker.', source:'8.4' },
      { activity:'Gut Dogs', perWorker:'1 worker', inputs:[{entity:'Dog',label:'8 Dogs'}], outputs:[{entity:'Gut',label:'8 Gut'},{entity:'Provisions',label:'24 Provisions'}], detail:'The animal-processing summary gives eight Dogs per Gutting worker.', source:'8.4' }
    ],
    combinedWith:['Skinning','Boning'],
    relatedSkills:['Skinning','Boning','Leatherwork','Curing']
  });

  register('HERDING', {
    name:'Herding',
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Efficiency / fixed-staffing skill',
    levelDetail:'Extra herders do not increase the effect. Herd growth depends on Herding skill plus animal, terrain, season and weather.',
    primarySection:'13.1.14',
    additionalSections:['8.4','23.5'],
    workerRule:'Fixed staffing by herd size',
    workerDetail:'1 herder per 20 Goats; 10 Horses, Cattle or Dogs; or 5 Elephants. Assigning more people does not improve herd growth.',
    summary:'Manages domesticated animals so they remain controlled and reproduce. Herd growth is applied after Activities.',
    outputs:[
      { label:'Herd growth', rate:'Variable', type:'Animal population', detail:'Breeding occurs after Activities using the animal type, Herding skill, season, weather, terrain and other applicable factors.', source:'13.1.14' }
    ],
    factors:[
      { factor:'Animal type', effect:'Changes breeding rate', detail:'Different species have different breeding behaviour and herder requirements.' },
      { factor:'Herding skill', effect:'Changes herd growth', detail:'Higher effective Herding improves the breeding-rate calculation.' },
      { factor:'Season', effect:'Changes herd growth', detail:'Season is one of the factors used in the breeding rate.' },
      { factor:'Weather', effect:'Changes herd growth', detail:'Weather is one of the factors used in the breeding rate.' },
      { factor:'Terrain', effect:'Changes herd growth', detail:'The terrain of the unit performing Herding is used for the Activity result.' }
    ],
    factTables:[
      { kicker:'Staffing', title:'Herding requirements by animal', source:'8.4', columns:[
        { key:'animal', label:'Animal' }, { key:'amount', label:'Animals per herder' }
      ], rows:[
        { animal:{entity:'Goat',label:'Goats'}, amount:'20' },
        { animal:{entity:'Cattle',label:'Cattle'}, amount:'10' },
        { animal:{entity:'Horse',label:'Horses'}, amount:'10' },
        { animal:{entity:'Elephant',label:'Elephants'}, amount:'5' },
        { animal:{entity:'Dog',label:'Dogs'}, amount:'10' }
      ] }
    ],
    researchEffectOverrides:{
      'Angora Goats':'In months 6 and 12, one person can shear 10 Goats for 150 Cotton; only the research Tribe and its Elements may perform the shearing.',
      'Dairy Cattle':'Unlocks Milking and Cheesemaking: one person with 10 Cattle produces 100 Milk; one person converts 90 Milk into 30 Cheese.',
      'Expert Breeding':'+3 effective Herding for Herd Growth.',
      'Herding 11':'Raises Herding to 11 and is the prerequisite for Herding 12.',
      'Herding 12':'Raises Herding to 12 and is the prerequisite for Herding 13.',
      'Hunting Dogs':'Converts Dogs into non-breeding Hunting Dogs; each one effectively adds +2 Hunters when Hunting.'
    },
    notes:[
      'Animals must be Herded in order to grow; unherded animals may stray.',
      'A specific cohort of animals may be Herded by only one unit. Herding the same animals twice causes strays.',
      'Killing animals purely for Provisions uses a Kill order and requires no skill or manpower; do not use that order for animals being Skinned, Gutted or Boned.',
      'Animals carried by ships at sea do not need to be Herded.',
      'Dogs and Hunting Dogs may require manual checking against the Clan Herding tab.'
    ],
    relatedSkills:['Hunting','Furrier','Skinning','Gutting','Boning']
  });

  register('JEWELLERY', {
    name:'Jewellery',
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / crafting skill',
    levelDetail:'Higher Jewellery levels unlock additional decorative and valuable goods.',
    primarySection:'13.1.17',
    workerRule:'No worker limit',
    workerDetail:'Jewellery has no 10 × skill-level worker cap; each recipe specifies its own people and materials.',
    summary:'Makes Trinkets, Ornaments, Goldwork and Inlay from Copper, Gold and Jade.',
    directCrafts:[
      { level:1, entity:'Trinket', label:'Trinket', people:1, inputs:[{entity:'Copper',quantity:1}], source:'13.1.17' },
      { level:3, entity:'Ornament', label:'Ornament', people:1, inputs:[{entity:'Coal',quantity:2},{entity:'Copper',quantity:2}], source:'13.1.17' },
      { level:5, entity:'Goldwork', label:'Goldwork', people:1, inputs:[{entity:'Gold',quantity:15}], source:'13.1.17' },
      { level:8, entity:'Inlay', label:'Inlay', people:2, inputs:[{entity:'Gold',quantity:20},{entity:'Jade',quantity:1}], source:'13.1.17' }
    ],
    notes:['Trinkets and Ornaments may be sold at the biannual Fair. The Mandate notes that Jewellery uses may expand as the game develops.'],
    relatedSkills:['Economics','Mining','Refining']
  });

  register('LEATHERWORK', {
    name:'Leatherwork',
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / crafting skill',
    levelDetail:'Higher Leatherwork levels unlock additional armour, carrying equipment and animal gear.',
    primarySection:'13.1.18',
    additionalSections:['11.1','17.10'],
    workerRule:'No worker limit',
    workerDetail:'Leatherwork has no 10 × skill-level worker cap; each recipe specifies its own people and materials.',
    summary:'Turns Leather into armour, Slings, carrying equipment, Rope and Saddles.',
    directCrafts:[
      { level:1, entity:'Hood', label:'Hoods ×2', people:1, inputs:[{entity:'Leather',quantity:2}], detail:'Light head protection.', source:'13.1.18' },
      { level:2, entity:'Heater', label:'Heater', people:1, inputs:[{entity:'Leather',quantity:3},{entity:'Frame',quantity:1}], detail:'A form of shield.', source:'13.1.18' },
      { level:2, entity:'Sling', label:'Sling', people:1, inputs:[{entity:'Leather',quantity:1}], source:'13.1.18' },
      { level:3, entity:'Jerkin', label:'Jerkin', people:2, inputs:[{entity:'Leather',quantity:4}], detail:'A type of armour.', source:'13.1.18' },
      { level:3, entity:'Trews', label:'Trews', people:1, inputs:[{entity:'Leather',quantity:2}], detail:'Leg armour.', source:'13.1.18' },
      { level:4, entity:'Backpack', label:'Backpack', people:2, inputs:[{entity:'Leather',quantity:2}], detail:'+30 lb to a Warrior or Active carrying capacity.', source:'13.1.18' },
      { level:4, entity:'Rope', label:'Rope', people:2, inputs:[{entity:'Leather',quantity:5}], source:'13.1.18' },
      { level:5, entity:'Saddlebags', label:'Saddlebags', people:2, inputs:[{entity:'Leather',quantity:4}], detail:'+100 lb to a Horse carrying capacity (+50 lb when Scouting); also adds carrying capacity for Camels.', source:'13.1.18' },
      { level:6, entity:'Saddle', label:'Saddle', people:3, inputs:[{entity:'Leather',quantity:4}], detail:'The Mandate directs readers to Research for additional Saddle uses.', source:'13.1.18' }
    ],
    researchEffectOverrides:{
      'Combat Boots':'+0.02 Combat Morale when all Warriors in combat are equipped; applies on a sliding scale when only some are equipped.',
      'Dog Leash':'+2 Security for determining Suppression/Security success when each assigned Dog has a Leash.',
      'Triball Saddle':'+2 effective Triball when all players are mounted and have Triball Saddles; combines with Triball Maneuvers.'
    },
    relatedSkills:['Curing','Dressing','Tanning','Armour','Hunting','Security','Triball']
  });

  benefit('Combat Boots', { skill:'Combat', value:'+0.02 Combat Morale', detail:'When all Warriors in combat are equipped; partial coverage uses a sliding scale.', source:'Research', research:'Leatherwork / Combat Boots' });
  benefit('Dog Leash', { skill:'Security', value:'+2 Security', detail:'For determining Suppression/Security success when each assigned Dog has a Leash.', source:'Research', research:'Leatherwork / Dog Leash' });
  benefit('Triball Saddle', { skill:'Triball', value:'+2 effective Triball', detail:'Applies when all players have Horses and Triball Saddles; combines with Triball Maneuvers.', source:'Research', research:'Leatherwork / Triball Saddle' });
})();

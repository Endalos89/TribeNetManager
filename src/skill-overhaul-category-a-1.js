(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.profiles) return;

  const add = (key, profile) => {
    S.profiles[key] = {
      status:'baseline-derived',
      category:'A',
      researchAliases:[profile.name],
      ...profile
    };
  };

  add('ARMOUR', {
    name:'Armour',
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / crafting skill',
    levelDetail:'Higher Armour levels unlock additional armour recipes.',
    primarySection:'13.1.1',
    additionalSections:['17.10'],
    workerRule:'No worker limit',
    workerDetail:'Armour does not use the 10 × skill-level worker cap; each recipe specifies its own people and materials.',
    summary:'Makes shields, helmets and body armour used to equip Warriors in combat.',
    directCrafts:[
      { level:2, entity:'Scutum', label:'Scutum', people:2, inputs:[{entity:'Coal',quantity:15},{entity:'Bronze',quantity:5}], detail:'Bronze shield.', source:'13.1.1' },
      { level:3, entity:'Haube', label:'Haube', people:2, inputs:[{entity:'Coal',quantity:10},{entity:'Bronze',quantity:3}], detail:'Bronze helm.', source:'13.1.1' },
      { level:3, entity:'Shield', label:'Shield', people:2, inputs:[{entity:'Coal',quantity:30},{entity:'Iron',quantity:5}], source:'13.1.1' },
      { level:4, entity:'Cuirass', label:'Cuirass', people:3, inputs:[{entity:'Coal',quantity:20},{entity:'Bronze',quantity:30}], detail:'Bronze breastplate.', source:'13.1.1' },
      { level:4, entity:'Helm', label:'Helm', people:2, inputs:[{entity:'Coal',quantity:20},{entity:'Iron',quantity:3}], source:'13.1.1' },
      { level:6, entity:'Chain', label:'Chain Mail', people:4, inputs:[{entity:'Coal',quantity:40},{entity:'Iron',quantity:18}], source:'13.1.1' },
      { level:8, entity:'Breastplate', label:'Breastplate', people:4, inputs:[{entity:'Coal',quantity:40},{entity:'Iron',quantity:20}], source:'13.1.1' }
    ],
    ruleGroups:[
      { title:'Armour categories', detail:'Each Warrior may wear one item from each category.', rows:[
        { label:'Head', values:['Helm','Haube','Hood'] },
        { label:'Shielding', values:['Shield','Scutum','Heater'] },
        { label:'Torso', values:['Chain','Scale','Ring','Jerkin'] },
        { label:'Over torso', values:['Breastplate','Cuirass','Cuirboilli','Bone Armour'] },
        { label:'Leg', values:['Trews'] }
      ] }
    ],
    notes:['Missile troops may wear armour, but cannot employ shields in Field combat.'],
    relatedSkills:['Leatherwork','Sewing','Waxwork','Combat']
  });

  add('BONEWORK', {
    name:'Bonework',
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / crafting skill',
    levelDetail:'Higher Bonework levels unlock additional bone goods and armour.',
    primarySection:'13.1.3',
    workerRule:'No worker limit',
    workerDetail:'Bonework does not use the 10 × skill-level worker cap; individual recipes specify people and materials.',
    summary:'Turns Bones into weapons, frames and Bone Armour.',
    directCrafts:[
      { level:1, entity:'Bone Axe', label:'Bone Axe', people:2, inputs:[{entity:'Bones',quantity:1},{entity:'Club',quantity:1},{entity:'Leather',quantity:1}], source:'13.1.3' },
      { level:3, entity:'Bone Spear', label:'Bone Spear', source:'13.1.3', variants:[
        { label:'Forest / jungle', people:2, inputs:[{entity:'Bones',quantity:1}], detail:'Made in forest or jungle.' },
        { label:'Using a Shaft', people:1, inputs:[{entity:'Bones',quantity:1},{entity:'Shaft',quantity:1}], detail:'Alternative method using a Shaft.' }
      ] },
      { level:3, entity:'Bone Arrow', label:'Bone Arrows ×10', people:1, inputs:[{entity:'Bones',quantity:10}], detail:'One worker makes 10 Bone Arrows.', source:'13.1.3' },
      { level:4, entity:'Bone Frame', label:'Bone Frame', people:2, inputs:[{entity:'Bones',quantity:3}], source:'13.1.3' },
      { level:8, entity:'Bone Armour', label:'Bone Armour', people:4, inputs:[{entity:'Bones',quantity:10},{entity:'Leather',quantity:2}], source:'13.1.3' }
    ],
    relatedSkills:['Boning','Woodwork','Leatherwork','Hunting','Armour']
  });

  add('BONING', {
    name:'Boning',
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / processing skill',
    levelDetail:'Skill level controls worker capacity; the per-worker conversion is fixed.',
    primarySection:'13.1.2',
    additionalSections:['13.1.30'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'The cap is shared across the Tribe and its Elements when they use this skill.',
    summary:'Processes slaughtered animals into Bones and can be combined with Skinning and Gutting.',
    processRows:[
      { activity:'Bone animals', perWorker:'1 worker', inputs:[{entity:'Goat',label:'6 Goats'},{entity:'Cattle',label:'3 Cattle'},{entity:'Horse',label:'2 Horses'}], inputJoin:' or ', outputs:[{entity:'Bones',label:'12 Bones'}], detail:'Any one of the listed animal quantities yields 12 Bones.', source:'13.1.2' }
    ],
    combinedWith:['Skinning','Gutting'],
    relatedSkills:['Skinning','Gutting','Bonework']
  });

  add('CURING', {
    name:'Curing',
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / processing skill',
    levelDetail:'Skill level controls worker capacity; the per-worker conversion is fixed.',
    primarySection:'13.1.5',
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each assigned worker performs the same conversion; higher skill mainly raises how many workers may be assigned.',
    summary:'Converts Skins or Furs into Leather using Gut.',
    processRows:[
      { activity:'Cure hides', perWorker:'1 worker', inputs:[{entity:'Skin',label:'2 Skins'},{entity:'Fur',label:'or 2 Furs'},{entity:'Gut',label:'+ 5 Gut'}], outputs:[{entity:'Leather',label:'2 Leather'}], detail:'The Mandate notes that urine is also involved, but sufficient quantities are presumed.', source:'13.1.5' }
    ],
    relatedSkills:['Skinning','Furrier','Gutting','Leatherwork','Tanning','Dressing']
  });

  add('DRESSING', {
    name:'Dressing',
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / processing skill',
    levelDetail:'Skill level controls worker capacity; the per-worker conversion is fixed.',
    primarySection:'13.1.6',
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each assigned worker performs the same conversion; higher skill mainly raises how many workers may be assigned.',
    summary:'Converts Skins or Furs into Leather using Salt.',
    processRows:[
      { activity:'Dress hides', perWorker:'1 worker', inputs:[{entity:'Skin',label:'4 Skins'},{entity:'Fur',label:'or 4 Furs'},{entity:'Salt',label:'+ 1 Salt'}], outputs:[{entity:'Leather',label:'4 Leather'}], source:'13.1.6' }
    ],
    relatedSkills:['Skinning','Furrier','Mining','Leatherwork','Tanning','Curing']
  });

  add('FLETCHING', {
    name:'Fletching',
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / ammunition production skill',
    levelDetail:'Skill level controls worker capacity; the ammunition recipe is fixed per worker.',
    primarySection:'13.1.7',
    additionalSections:['17','17.10'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each worker can make one 10-arrow batch per activity assignment.',
    summary:'Produces bow ammunition from Coal and metal; arrow quality affects battlefield effectiveness.',
    processRows:[
      { activity:'Bronze Arrows', perWorker:'1 worker', inputs:[{entity:'Coal',label:'10 Coal'},{entity:'Bronze',label:'+ 1 Bronze'}], outputs:[{entity:'Arrow',label:'10 Bronze Arrows'}], detail:'Coke cannot replace the Coal used by this recipe.', source:'13.1.7' },
      { activity:'Iron Arrows', perWorker:'1 worker', inputs:[{entity:'Coal',label:'10 Coal'},{entity:'Iron',label:'+ 1 Iron'}], outputs:[{entity:'Arrow',label:'10 Iron Arrows'}], detail:'Coke cannot replace the Coal used by this recipe.', source:'13.1.7' },
      { activity:'Steel Arrows', perWorker:'1 worker', inputs:[{entity:'Coal',label:'10 Coal'},{entity:'Steel',label:'+ 1 Steel'}], outputs:[{entity:'Arrow Steel',label:'10 Steel Arrows'}], detail:'Coke cannot replace the Coal used by this recipe.', source:'13.1.7' }
    ],
    notes:[
      'In Field battle, bowmen use 10 arrows in the missile phase of each Combat.',
      'If there are not enough arrows, remaining shots are treated as wooden-tipped arrows.',
      'Arrow effectiveness increases from wooden through the better metal qualities.'
    ],
    relatedSkills:['Archery','Weapons','Combat','Metalwork']
  });
})();

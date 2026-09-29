(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.registerProfile) return;

  const register = (key, profile) => S.registerProfile(key, {
    status:'baseline-derived',
    category:'A',
    researchAliases:[profile.name, ...(profile.researchAliases || [])],
    ...profile
  });
  const benefit = (name, row) => S.registerItemBenefit?.(name, row);

  register('MILKING', {
    name:'Milking',
    researchAliases:['Milking','Milk'],
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / food-production skill',
    levelDetail:'Milking is a Group A # skill unlocked through Dairy Cattle research; skill level controls how many milkers may work.',
    primarySection:'12.2',
    additionalSections:['23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each worker normally milks 10 Cattle and produces 100 Milk.',
    summary:'Produces Milk from Dairy Cattle after the Herding research topic Dairy Cattle unlocks the skill and activity.',
    processRows:[
      { activity:'Milk Cattle', perWorker:'1 worker', inputs:[{entity:'Cattle',label:'10 Cattle (reusable)'}], outputs:[{entity:'Milk',label:'100 Milk'}], detail:'Milk must be used in the turn produced. It may be consumed as water or as food at 10 Milk = 1 Provision.', source:'12.2' }
    ],
    factors:[
      { factor:'Dairy Cattle research', effect:'Unlocks Milking', detail:'The Herding research topic Dairy Cattle unlocks both the Milking skill and Milking activity.' },
      { factor:'Terrain', effect:'No Milk in arid/desert', detail:'The published Dairy Cattle rules state Milk is not produced in desert or arid terrain.' },
      { factor:'Shelf life', effect:'Same-turn use', detail:'Milk not used in the turn produced is lost.' }
    ],
    researchEffectOverrides:{
      'Milking 11':'+10% Milking output; represent the efficiency gain with Auxiliaries equal to 10% of assigned workers until coded.',
      'Milk Maids':'Each worker may milk 13 Cattle instead of 10, producing 1,300 Milk per worker; this increases cattle handled, not Milk per cattle.'
    },
    notes:['Milking is not a base Mandate activity section; its published operating rules are introduced by Dairy Cattle research.'],
    relatedSkills:['Herding','Cheese Making']
  });

  benefit('Milk', { skill:'Milking', value:'100 / worker', detail:'One worker normally milks 10 Cattle to produce 100 Milk.', source:'Research', research:'Herding / Dairy Cattle' });

  register('SIEGE EQUIPMENT', {
    name:'Siege Equipment',
    aliases:['Siege Equipment Making'],
    researchAliases:['Siege Equipment','Siegecraft','Seq'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / siege-engine crafting skill',
    levelDetail:'Higher Siege Equipment unlocks larger engines, culminating in Catapults at level 10; Trebuchets are research/special-hex equipment.',
    primarySection:'13.1.29',
    additionalSections:['18','20.5','23.5'],
    workerRule:'No worker limit',
    workerDetail:'The skill has no 10×skill worker cap; each engine recipe has its own people and materials.',
    summary:'Builds Rams, Ballistae, Onagers and Catapults used in naval and siege combat.',
    directCrafts:[
      { level:3, entity:'Ram', label:'Ram', people:10, inputs:[{entity:'Log',quantity:5},{entity:'Coal',quantity:50}], detail:'Armoured prow used in ship-versus-ship combat.', source:'13.1.29' },
      { level:8, entity:'Ballista', label:'Ballista', people:10, inputs:[{entity:'Log',quantity:3},{entity:'Coal',quantity:20},{entity:'Iron',quantity:3},{entity:'Rope',quantity:1}], detail:'Anti-personnel device; treated as cargo and weighs 300 lb.', source:'13.1.29' },
      { level:8, entity:'Onager', label:'Onager', people:15, inputs:[{entity:'Log',quantity:12},{entity:'Coal',quantity:30},{entity:'Iron',quantity:4},{entity:'Rope',quantity:4}], detail:'Also requires Woodwork 6. Anti-siege engine; each Onager requires one Wooden or Stone Tower.', source:'13.1.29' },
      { level:10, entity:'Catapult', label:'Catapult', people:15, inputs:[{entity:'Log',quantity:10},{entity:'Coal',quantity:30},{entity:'Iron',quantity:2},{entity:'Rope',quantity:4}], detail:'Used against walls and ships; weighs 1,000 lb and needs 2 horses/cattle to transport.', source:'13.1.29' }
    ],
    requiredUses:[
      { level:8, entity:'Onager', label:'Onager', requirements:[{skill:'Woodwork',level:6}], detail:'The Mandate explicitly requires Woodwork 6 in addition to Siege Equipment 8.', source:'13.1.29' }
    ],
    researchEffectOverrides:{
      'Trebuchet':'Research-only siege engine: 30 people, Siege Equipment 10, 15 Logs, 4 Rope, 2 Iron, 30 Coal and 50 Stones; uses a four-person crew and consumes 5 Stones in combat.'
    },
    notes:[
      'Ballistae have no special requirement when used defensively behind fortifications.',
      'Onagers target enemy Catapults and Trebuchets when defending during a Siege.',
      'Trebuchets are identified by the Mandate as special-hex/research equipment.'
    ],
    relatedSkills:['Woodwork','Engineering','Heavy Weapons','Artillery']
  });

  benefit('Ballista', { skill:'Siege Equipment', value:'Anti-personnel siege engine', detail:'No special requirement when used defensively behind fortifications.', source:'Mandate', section:'13.1.29' });
  benefit('Onager', { skill:'Siege Equipment', value:'Anti-siege engine', detail:'Targets enemy Catapults/Trebuchets while defending a Siege and requires a Tower.', source:'Mandate', section:'13.1.29' });
  benefit('Catapult', { skill:'Siege Equipment', value:'Walls / ships', detail:'May be used against walls and ships.', source:'Mandate', section:'13.1.29' });

  register('SKINNING', {
    name:'Skinning',
    researchAliases:['Skinning','Skn'],
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / animal-processing skill',
    levelDetail:'Skinning is a # skill: worker capacity is 10 × skill level and animal type sets throughput and Skin output.',
    primarySection:'13.1.30',
    additionalSections:['13.1.2','13.1.12','23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Skinning, Gutting and Boning can be submitted as combined activities; the normal worker caps for the component skills still matter.',
    summary:'Processes slaughtered Goats, Cattle and Horses into Skins while also yielding the animals’ provisions.',
    processRows:[
      { activity:'Skin Goats', perWorker:'3 Goats', inputs:[{entity:'Goat',label:'3 Goats'}], outputs:[{entity:'Skin',label:'3 Skins'}], detail:'Each Goat gives 1 Skin.', source:'13.1.30' },
      { activity:'Skin Cattle', perWorker:'1 Cattle', inputs:[{entity:'Cattle',label:'1 Cattle'}], outputs:[{entity:'Skin',label:'2 Skins'}], detail:'Each Cattle gives 2 Skins.', source:'13.1.30' },
      { activity:'Skin Horses', perWorker:'1 Horse', inputs:[{entity:'Horse',label:'1 Horse'}], outputs:[{entity:'Skin',label:'3 Skins'}], detail:'Each Horse gives 3 Skins.', source:'13.1.30' }
    ],
    combinedWith:['Gutting','Boning'],
    researchEffectOverrides:{
      'Knife':'A Knife doubles Skinning, Gutting and Boning throughput, allowing the combined SGB work twice during Activities.'
    },
    notes:[
      'Animals that are skinned are dead; their provisions are gained and they do not need Herding or count toward breeding that turn.',
      'The Orders spreadsheet provides combined Skinning/Gutting/Boning activities.'
    ],
    relatedSkills:['Gutting','Boning','Metalwork','Curing','Dressing','Tanning']
  });

  benefit('Knife', { skill:'Skinning', value:'×2 throughput', detail:'Doubles Skinning throughput and also doubles Gutting and Boning.', source:'Research', research:'Skinning / Knife' });

  register('TANNING', {
    name:'Tanning',
    researchAliases:['Tanning','Tan'],
    baseline:'Forestry',
    layout:'category-a-process',
    mechanic:'capacity-output',
    mechanicLabel:'Worker-cap / hide-processing skill',
    levelDetail:'Tanning is a # skill: worker capacity is 10 × skill level and each worker uses hides plus Bark to make Leather.',
    primarySection:'13.1.33',
    additionalSections:['23.5'],
    workerRule:'10 workers per skill level; unlimited at level 10',
    workerDetail:'Each worker normally converts 4 Skins or Furs plus 10 Bark into 4 Leather.',
    summary:'Turns Skins or Furs into Leather using Bark.',
    processRows:[
      { activity:'Tan hides', perWorker:'1 worker', inputs:[{entity:'Skin',label:'4 Skins or Furs'},{entity:'Bark',label:'+ 10 Bark'}], outputs:[{entity:'Leather',label:'4 Leather'}], detail:'Furs may be selected for Tanning in the auto-orders spreadsheet.', source:'13.1.33' }
    ],
    researchEffectOverrides:{
      'Cascade Tanning Pits':'Doubles Tanning output: one worker processes 8 Skins into 8 Leather using 20 Bark; one Cascade Pit services all Tanners in the Village.'
    },
    relatedSkills:['Skinning','Furrier','Forestry','Leatherwork','Engineering']
  });

  register('WAXWORK', {
    name:'Waxwork',
    aliases:['Waxworks'],
    researchAliases:['Waxwork','Waxworks','Wax'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / wax crafting skill',
    levelDetail:'Higher Waxwork unlocks Parchment, Candles, Strings, Seals and Cuirboilli.',
    primarySection:'13.1.34',
    workerRule:'No worker limit',
    workerDetail:'Waxwork has unlimited workers. Cauldrons must be present for Candles and Cuirboilli but are not consumed.',
    summary:'Uses Wax to make writing materials, lighting, strings, diplomatic seals and Cuirboilli armour.',
    directCrafts:[
      { level:1, entity:'Parchment', label:'Parchment ×5', people:1, inputs:[{entity:'Wax',quantity:1},{entity:'Skin',quantity:5}], detail:'Produces five Parchment.', source:'13.1.34' },
      { level:2, entity:'Candle', label:'Candles ×20', people:4, inputs:[{entity:'Wax',quantity:20},{entity:'Cotton',quantity:1},{entity:'Coal',quantity:5}], detail:'Requires one Cauldron available; the Cauldron is not consumed.', source:'13.1.34' },
      { level:2, entity:'String', label:'Strings ×5', people:1, inputs:[{entity:'Wax',quantity:1},{entity:'Cotton',quantity:1}], detail:'Gut may be used instead of Cotton.', source:'13.1.34' },
      { level:3, entity:'Seal', label:'Seal', people:1, inputs:[{entity:'Wax',quantity:5},{entity:'Gold',quantity:1}], detail:'One Seal is required per enduring truce.', source:'13.1.34' },
      { level:4, entity:'Cuirboilli', label:'Cuirboilli', people:2, inputs:[{entity:'Wax',label:'2 Wax per suit'},{entity:'Coal',quantity:2},{entity:'Leather',quantity:2}], detail:'Requires one Cauldron available; up to 10 Cuirboilli may be made.', source:'13.1.34' }
    ],
    notes:['Cauldrons function as reusable implements for Candles/Cuirboilli, similar to Glasspipes in Glasswork.'],
    relatedSkills:['Armour','Metalwork','Leatherwork','Literacy','Diplomacy']
  });

  benefit('Cauldron', { skill:'Waxwork', value:'Reusable production implement', detail:'Must be available for Candles and Cuirboilli but is not consumed.', source:'Mandate', section:'13.1.34' });

  register('WEAPONS', {
    name:'Weapons',
    aliases:['Weapon Making'],
    researchAliases:['Weapons','Weapon Making','Wpn'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / weapon crafting skill',
    levelDetail:'Higher Weapons unlocks more advanced melee and missile weapons; terrain and component alternatives matter for Bows, Spetums and Spears.',
    primarySection:'13.1.35',
    additionalSections:['17.10','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Weapons may use unlimited workers; each recipe specifies people and materials.',
    summary:'Makes shafts, bows, slings, spears, melee weapons and Arbalests used in Hunting and combat.',
    directCrafts:[
      { level:1, entity:'Shaft', label:'Shaft', people:1, inputs:[], detail:'Only in forest/jungle.', source:'13.1.35' },
      { level:1, entity:'Bow', label:'Bow', source:'13.1.35', variants:[
        { label:'Deciduous/jungle', people:2, inputs:[{entity:'String',quantity:1}], detail:'Made directly in suitable terrain.' },
        { label:'Using Stave', people:1, inputs:[{entity:'String',quantity:1},{entity:'Stave',quantity:1}], detail:'May be made in any terrain.' }
      ] },
      { level:1, entity:'Sling', label:'Slings ×10', people:5, inputs:[{entity:'Cloth',quantity:1}], detail:'Uses one bolt of Cloth; Weaving also has Sling recipes.', source:'13.1.35' },
      { level:1, entity:'Spetum', label:'Spetum', source:'13.1.35', variants:[
        { label:'Forest/jungle', people:2, inputs:[{entity:'Coal',quantity:5},{entity:'Bronze',quantity:2}], detail:'Made without Shaft in suitable terrain.' },
        { label:'Using Shaft', people:1, inputs:[{entity:'Coal',quantity:5},{entity:'Bronze',quantity:2},{entity:'Shaft',quantity:1}], detail:'May be made anywhere.' }
      ] },
      { level:1, entity:'Stave', label:'Stave', people:1, inputs:[], detail:'Only in deciduous forest/jungle.', source:'13.1.35' },
      { level:2, entity:'Spear', label:'Spear', source:'13.1.35', variants:[
        { label:'Forest/jungle', people:2, inputs:[{entity:'Coal',quantity:10},{entity:'Iron',quantity:2}], detail:'Made directly in suitable terrain.' },
        { label:'Using Shaft / Bone Spear', people:1, inputs:[{entity:'Coal',quantity:10},{entity:'Iron',quantity:2},{entity:'Shaft',quantity:1}], detail:'May be made anywhere using the listed component alternative.' }
      ] },
      { level:3, entity:'Mace', label:'Mace', source:'13.1.35', variants:[
        { label:'Iron', people:2, inputs:[{entity:'Coal',quantity:30},{entity:'Iron',quantity:6}] },
        { label:'Bronze', people:2, inputs:[{entity:'Coal',quantity:20},{entity:'Bronze',quantity:6}] }
      ] },
      { level:4, entity:'Axe', label:'Axe', people:2, inputs:[{entity:'Coal',quantity:20},{entity:'Iron',quantity:4}], source:'13.1.35' },
      { level:4, entity:'Falchion', label:'Falchion', people:2, inputs:[{entity:'Coal',quantity:15},{entity:'Iron',quantity:5}], source:'13.1.35' },
      { level:6, entity:'Sword', label:'Sword', people:3, inputs:[{entity:'Coal',quantity:30},{entity:'Iron',quantity:5}], source:'13.1.35' },
      { level:8, entity:'Arbalest', label:'Arbalest', source:'13.1.35', variants:[
        { label:'Iron', people:3, inputs:[{entity:'Coal',quantity:20},{entity:'Iron',quantity:2},{entity:'String',quantity:1}] },
        { label:'Bronze / Brass', people:3, inputs:[{entity:'Coal',quantity:15},{entity:'Bronze',quantity:2},{entity:'String',quantity:1}], detail:'The Mandate notes Brass may also be used.' }
      ] }
    ],
    researchEffectOverrides:{
      'Crossbow':'Armour-penetrating ranged weapon; Weapons 8. Published recipes allow Iron or Bronze construction.',
      'Katana':'Iron weapon that functions as a Steel Sword.',
      'Repeating Arbalest':'Produces about one-third more casualties than a normal Arbalest and uses 20 Quarrels per combat.',
      'Scimitar':'Steel cavalry Sword; maximum 150 people in the Clan per turn may be assigned to production.',
      'Ulfbehrt Sword':'Top-tier infantry Sword; maximum 200 people in the Clan per turn may be assigned to production.'
    },
    notes:[
      'Metal cannot be recovered from Weapons once made.',
      'Clubs are under Woodwork and some weapons are under Bonework.',
      'If Spear/Bow terrain requirements are not met, provide the listed Shaft/Stave-style component.'
    ],
    relatedSkills:['Combat','Archery','Hunting','Woodwork','Bonework','Weaving','Metalwork']
  });

  register('WEAVING', {
    name:'Weaving',
    researchAliases:['Weaving','Wv'],
    baseline:'Woodwork',
    layout:'category-a-craft',
    mechanic:'unlock',
    mechanicLabel:'Level unlock / textile crafting skill',
    levelDetail:'Higher Weaving unlocks rope, hunting/fishing equipment and progressively more valuable textiles.',
    primarySection:'13.1.36',
    additionalSections:['15.1','22.1.1','23.5'],
    workerRule:'No worker limit',
    workerDetail:'Weaving may use unlimited workers; each recipe specifies its own labour and inputs.',
    summary:'Produces Rope, Slings, Nets, Snares, Cloth and decorative textiles used across Fishing, Hunting, construction and trade.',
    directCrafts:[
      { level:1, entity:'Rope', label:'Ropes ×2', people:1, inputs:[{entity:'Cotton',quantity:20}], detail:'Cotton recipe producing two Ropes.', source:'13.1.36' },
      { level:2, entity:'Sling', label:'Slings ×2', people:1, inputs:[{entity:'Cotton',quantity:1}], source:'13.1.36' },
      { level:3, entity:'Net', label:'Net', people:2, inputs:[{entity:'Cotton',quantity:10}], detail:'Helps in Fishing.', source:'13.1.36' },
      { level:3, entity:'Rope', label:'Rope', people:2, inputs:[{entity:'Gut',quantity:10},{entity:'Bark',quantity:10}], detail:'Alternate Rope recipe.', source:'13.1.36' },
      { level:3, entity:'Snare', label:'Snares ×2', people:1, inputs:[{entity:'Rope',quantity:1}], detail:'Helps in Hunting.', source:'13.1.36' },
      { level:4, entity:'Rug', label:'Rug', people:5, inputs:[{entity:'Cotton',quantity:20}], source:'13.1.36' },
      { level:5, entity:'Cloth', label:'Cloth', people:5, inputs:[{entity:'Cotton',quantity:15}], source:'13.1.36' },
      { level:5, entity:'Net', label:'Net', people:3, inputs:[{entity:'Gut',quantity:10},{entity:'Bark',quantity:10}], detail:'Alternate Net recipe; helps in Fishing.', source:'13.1.36' },
      { level:6, entity:'Carpet', label:'Carpet', people:10, inputs:[{entity:'Cotton',quantity:50}], source:'13.1.36' },
      { level:8, entity:'Tapestry', label:'Tapestry', people:20, inputs:[{entity:'Cotton',quantity:100}], source:'13.1.36' }
    ],
    researchEffectOverrides:{
      'Basket':'Doubles crop-harvesting worker effectiveness and may combine linearly with allowed implements such as Scythes.',
      'Epic Tapestry':'+0.04 General Morale to one assigned owning Tribe and +0.06 Military Morale in combat; loss/destruction causes -0.05 Morale.',
      'Exotic Weaving':'Unlocks regional Carpets, Rugs and Tapestries for special NPC-city trade and can lead to an exclusive Exotic Weavers Guild.'
    },
    relatedSkills:['Fishing','Hunting','Sewing','Farming','Art']
  });

  benefit('Net', { skill:'Weaving', value:'Fishing implement', detail:'Weaving provides two base recipes for Nets, both described as helping Fishing.', source:'Mandate', section:'13.1.36' });
  benefit('Snare', { skill:'Weaving', value:'Hunting implement', detail:'Weaving 3 makes two Snares from one Rope.', source:'Mandate', section:'13.1.36' });
  benefit('Basket', { skill:'Farming', value:'×2 harvest worker effectiveness', detail:'Doubles harvesting productivity and combines linearly with allowed harvesting implements.', source:'Research', research:'Weaving / Basket' });

  register('WHALING', {
    name:'Whaling',
    researchAliases:['Whaling','Wha'],
    baseline:'Hunting',
    layout:'category-a-activity',
    mechanic:'efficiency',
    mechanicLabel:'Efficiency / catch skill',
    levelDetail:'The Mandate states that Whaling skill determines both the chance of catching whales and the number caught.',
    primarySection:'29.39',
    additionalSections:['23.5'],
    workerRule:'No worker-cap rule stated in the Mandate',
    workerDetail:'The Mandate gives Whaling as a Group A skill but does not publish a general worker formula in §29.39.',
    summary:'Determines the chance of catching whales and the number caught; specialised Whaler vessels improve the size of the catch and allow processing at sea.',
    outputs:[
      { label:'Whales caught', rate:'Variable', type:'Catch', detail:'Whaling skill controls catch chance and number of whales caught.', source:'29.39' }
    ],
    factors:[
      { factor:'Whaling skill', effect:'Catch chance + quantity', detail:'Both are explicitly controlled by Whaling according to the Mandate.' },
      { factor:'Whaler vessel', effect:'Increases catch size', detail:'The Whaler research vessel increases the size of catch, not the chance, and supports at-sea processing.' }
    ],
    supportImplements:[
      { name:'Whaler', value:'Larger catch + at-sea processing', baseMax:'—', baseMaxBenefit:'Amount not stated', craft:[{skill:'Shipbuilding',level:9},{skill:'Woodwork',level:8},{skill:'Metalwork',level:'8 in recipe / 5 in table'}], requiresResearch:true, detail:'Published Whaler research increases catch size and permits processing at sea using Cauldrons plus the relevant processing skills. The Research List itself contains a Metalwork-level discrepancy between prose recipe and table.', source:'Research', research:'Whaling / Whaler' }
    ],
    supportTitle:'Whaling vessel support',
    researchEffectOverrides:{
      'Whaler':'Specialised vessel that increases catch size (not catch chance) and can process up to two whales in a turn for flensing/peeling and blubberwork concurrently.'
    },
    relatedSkills:['Shipbuilding','Woodwork','Metalwork','Flensing','Peeling','Blubberwork']
  });

  benefit('Whaler', { skill:'Whaling', value:'Larger catch + at-sea processing', detail:'Increases catch size, not catch chance, and supports at-sea whale processing.', source:'Research', research:'Whaling / Whaler' });
})();

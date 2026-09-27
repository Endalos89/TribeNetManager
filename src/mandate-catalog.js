const CATALOG_VERSION = 1;
const SOURCE_DOCUMENT = 'Mandate TN03 rev.N02.1 Feb 26 2026';

function canonical(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const SKILLS = [
  ['Armour','Arm','A'], ['Bonework','BnW','A'], ['Boning','Bon','A'], ['Curing','Cur','A'], ['Dressing','Dre','A'], ['Excavation','Exc','A'],
  ['Fishing','Fish','A'], ['Fletching','Flet','A'], ['Forestry','For','A'], ['Furrier','Fur','A'], ['Gutting','Gut','A'], ['Herding','Herd','A'],
  ['Hunting','Hunt','A'], ['Jewellery','Jew','A'], ['Leatherwork','Ltr','A'], ['Metalwork','Mtl','A'], ['Mining','Min','A'], ['Pottery','Pot','A'],
  ['Quarrying','Qry','A'], ['Salting','Salt','A'], ['Sewing','Sew','A'], ['Siege Equipment','Seq','A'], ['Skinning','Skn','A'], ['Tanning','Tan','A'],
  ['Waxwork','Wax','A'], ['Weapons','Wpn','A'], ['Weaving','Wv','A'], ['Whaling','Wha','A'], ['Woodwork','Wd','A'],
  ['Administration','Adm','B'], ['Apothecary','Apoth','B'], ['Archery','Arc','B'], ['Captaincy','Capt','B'], ['Combat','Com','B'], ['Courier','Cour','B'],
  ['Diplomacy','Dip','B'], ['Economics','Eco','B'], ['Garrison','Gar','B'], ['Healing','Heal','B'], ['Heavy Weapons','HvyW','B'], ['Horsemanship','Hor','B'],
  ['Intelligence','Int','B'], ['Leadership','Ldr','B'], ['Mariner','Mar','B'], ['Mobilisation','Mob','B'], ['Navigation','Nav','B'], ['Politics','Pol','B'],
  ['Rowing','Row','B'], ['Sailing','Sail','B'], ['Scouting','Sct','B'], ['Seamanship','Sea','B'], ['Security','Sec','B'], ['Shipwright','ShW','B'],
  ['Slavery','Slv','B'], ['Spying','Spy','B'], ['Tactics','Tac','B'], ['Torture','Tor','B'], ['Triball','Tri','B'],
  ['Archaeology','Arch','C'], ['Architecture','Archit','C'], ['Alchemy','Alc','C'], ['Apiarism','Api','C'], ['Art','Art','C'], ['Banking','Bank','C'],
  ['Baking','Bak','C'], ['Brick Making','Brk','C'], ['Cooking','Cook','C'], ['Dance','Dan','C'], ['Distilling','Dis','C'], ['Engineering','Eng','C'],
  ['Farming','Farm','C'], ['Glasswork','Glass','C'], ['Literacy','Lit','C'], ['Maintain Boats','MtnB','C'], ['Milling','Mil','C'], ['Music','Mus','C'],
  ['Religion / Atheism','Rel','C'], ['Refining','Ref','C'], ['Research','Res','C'], ['Sanitation','San','C'], ['Seeking','Seek','C'], ['Shipbuilding','ShB','C'],
  ['Stonework','Stn','C']
].map(([name, shortname, group]) => ({ name, shortname, group, section: '12.2' }));

const EXTRA_ALIASES = {
  'WEAPONS': ['WEAPON', 'WEAPON MAKING', 'WEAPONMAKING'],
  'SIEGE EQUIPMENT': ['SIEGE', 'SIEGE EQUIPMENT MAKING'],
  'BRICK MAKING': ['BRICKMAKING', 'BRICKS'],
  'MAINTAIN BOATS': ['BOAT MAINTENANCE', 'MAINTENANCE'],
  'WOODWORK': ['WOODWORKING'],
  'RELIGION ATHEISM': ['RELIGION', 'ATHEISM']
};

const SKILL_BY_ALIAS = new Map();
for (const skill of SKILLS) {
  for (const alias of [skill.name, skill.shortname, ...(EXTRA_ALIASES[canonical(skill.name)] || [])]) {
    SKILL_BY_ALIAS.set(canonical(alias), skill);
  }
}

function resolveSkillDefinition(value) {
  return SKILL_BY_ALIAS.get(canonical(value)) || null;
}

function resolveSkillKey(value) {
  const found = resolveSkillDefinition(value);
  return found ? canonical(found.name) : canonical(value);
}

function req(skill, level) { return { skill, level }; }
function input(item, quantity, optional = false) { return { item, quantity, optional }; }
function recipe(key, name, activityCode, primarySkill, skillLevel, people, section, inputs = [], output = null, options = {}) {
  return {
    key, name, activityCode, primarySkill, skillLevel, people, section, inputs, output,
    requirements: options.requirements || [], facilities: options.facilities || [], conditions: options.conditions || [],
    notes: options.notes || '', distinction: options.distinction || '', sourceDocument: SOURCE_DOCUMENT
  };
}

const RECIPES = [
  recipe('armour-scutum','Scutum','ARMOUR','Armour',2,2,'13.1.1',[input('Coal',15),input('Bronze',5)],{item:'Scutum',quantity:1},{notes:'Bronze shield.'}),
  recipe('armour-haube','Haube','ARMOUR','Armour',3,2,'13.1.1',[input('Coal',10),input('Bronze',3)],{item:'Haube',quantity:1},{notes:'Bronze helm.'}),
  recipe('armour-shield','Shield','ARMOUR','Armour',3,2,'13.1.1',[input('Coal',30),input('Iron',5)],{item:'Shield',quantity:1}),
  recipe('armour-cuirass','Cuirass','ARMOUR','Armour',4,3,'13.1.1',[input('Coal',20),input('Bronze',30)],{item:'Cuirass',quantity:1},{notes:'Bronze breastplate.'}),
  recipe('armour-helm','Helm','ARMOUR','Armour',4,2,'13.1.1',[input('Coal',20),input('Iron',3)],{item:'Helm',quantity:1}),
  recipe('armour-chain','Chain Mail','ARMOUR','Armour',6,4,'13.1.1',[input('Coal',40),input('Iron',18)],{item:'Chain Mail',quantity:1}),
  recipe('armour-breastplate','Breastplate','ARMOUR','Armour',8,4,'13.1.1',[input('Coal',40),input('Iron',20)],{item:'Breastplate',quantity:1}),

  recipe('boning-goat','Bones from Goats','BONING','Boning',1,1,'13.1.2',[input('Goats',6)],{item:'Bones',quantity:12},{notes:'Can be combined with Skinning and/or Gutting.'}),
  recipe('boning-cattle','Bones from Cattle','BONING','Boning',1,1,'13.1.2',[input('Cattle',3)],{item:'Bones',quantity:12},{notes:'Can be combined with Skinning and/or Gutting.'}),
  recipe('boning-horse','Bones from Horses','BONING','Boning',1,1,'13.1.2',[input('Horses',2)],{item:'Bones',quantity:12},{notes:'Can be combined with Skinning and/or Gutting.'}),
  recipe('bonework-axe','Bone Axe','BONEWORK','Bonework',1,2,'13.1.3',[input('Bones',1),input('Club',1),input('Leather',1)],{item:'Bone Axe',quantity:1}),
  recipe('bonework-spear','Bone Spear','BONEWORK','Bonework',3,1,'13.1.3',[input('Bones',1),input('Shaft',1)],{item:'Bone Spear',quantity:1},{notes:'In forest/jungle it may instead be made by 2 people without a Shaft.'}),
  recipe('bonework-arrows','Bone Arrows x10','BONEWORK','Bonework',3,1,'13.1.3',[input('Bones',10)],{item:'Bone Arrow',quantity:10}),
  recipe('bonework-frames','Bone Frames','BONEWORK','Bonework',4,2,'13.1.3',[input('Bones',3)],{item:'Bone Frames',quantity:1}),
  recipe('bonework-armour','Bone Armour','BONEWORK','Bonework',8,4,'13.1.3',[input('Bones',10),input('Leather',2)],{item:'Bone Armour',quantity:1}),

  recipe('cooking-grain','Cook Provs from Grain','COOKING','Cooking',1,1,'13.1.4',[input('Grain',180)],{item:'Provs',quantity:6},{notes:'One person can cook 6 Gruel/Provs when using Grain.'}),
  recipe('cooking-grapes','Cook Provs from Grapes','COOKING','Cooking',1,1,'13.1.4',[input('Grapes',60)],{item:'Provs',quantity:4}),
  recipe('cooking-honey','Cook Provs from Honey','COOKING','Cooking',1,1,'13.1.4',[input('Honey',20)],{item:'Provs',quantity:4}),
  recipe('cooking-gut','Cook Provs from Gut','COOKING','Cooking',1,1,'13.1.4',[input('Gut',40)],{item:'Provs',quantity:4}),
  recipe('curing-leather','Cure Leather','CURING','Curing',1,1,'13.1.5',[input('Skins/Furs',2),input('Gut',5)],{item:'Leather',quantity:2}),
  recipe('dressing-leather','Dress Leather','DRESSING','Dressing',1,1,'13.1.6',[input('Skins/Furs',4),input('Salt',1)],{item:'Leather',quantity:4}),
  recipe('fletching-bronze','Bronze Arrows x10','FLETCHING','Fletching',1,1,'13.1.7',[input('Coal',10),input('Bronze',1)],{item:'Bronze Arrows',quantity:10}),
  recipe('fletching-iron','Iron Arrows x10','FLETCHING','Fletching',1,1,'13.1.7',[input('Coal',10),input('Iron',1)],{item:'Iron Arrows',quantity:10}),
  recipe('fletching-steel','Steel Arrows x10','FLETCHING','Fletching',1,1,'13.1.7',[input('Coal',10),input('Steel',1)],{item:'Steel Arrows',quantity:10}),
  recipe('forestry-logs','Fell Logs','FORESTRY','Forestry',1,1,'13.1.9',[],{item:'Logs',quantity:4},{conditions:['Forest or Jungle'],notes:'Logs may not be used in the turn they are acquired.'}),
  recipe('forestry-bark','Strip Bark','FORESTRY','Forestry',1,1,'13.1.9',[],{item:'Bark',quantity:20},{conditions:['Forest or Jungle']}),
  recipe('forestry-charcoal','Make Charcoal','FORESTRY','Forestry',5,1,'14.6.1',[input('Logs',2)],{item:'Charcoal',quantity:10},{facilities:['Charhouse'],notes:'Output is equal in usage to 10 Coal; Charcoal workers count against the Forestry worker limit.'}),

  recipe('glass-beads','Beads x10','GLASSWORK','Glasswork',1,1,'13.1.11',[input('Sand',9),input('Lead',1),input('Coal',5)],{item:'Beads',quantity:10},{facilities:['1 Glasspipe per 10 users']}),
  recipe('glass-beaker','Beaker','GLASSWORK','Glasswork',4,1,'13.1.11',[input('Sand',9),input('Lead',1),input('Coal',10)],{item:'Beaker',quantity:1},{facilities:['1 Glasspipe per 10 users']}),
  recipe('glass-pane','Glass Pane','GLASSWORK','Glasswork',4,1,'13.1.11',[input('Sand',20),input('Lead',4),input('Coal',20)],{item:'Glass Pane',quantity:1}),
  recipe('glass-bottle','Bottle','GLASSWORK','Glasswork',6,1,'13.1.11',[input('Sand',12),input('Lead',2),input('Coal',12),input('Clay',25)],{item:'Bottle',quantity:1},{facilities:['1 Glasspipe per 10 users']}),
  recipe('glass-perfume-bottle','Perfume Bottle','GLASSWORK','Glasswork',7,1,'13.1.11',[input('Sand',2),input('Lead',1),input('Coal',2)],{item:'Perfume Bottle',quantity:1},{facilities:['1 Glasspipe per 10 users'],notes:'Mandate marks this as under development.'}),
  recipe('glass-lens','Lens','GLASSWORK','Glasswork',8,5,'13.1.11',[input('Sand',45),input('Lead',5),input('Coal',50)],{item:'Lens',quantity:1},{facilities:['1 Glasspipe per 10 users']}),

  recipe('gutting-goat','Gut from Goats','GUTTING','Gutting',1,1,'13.1.12',[input('Goats',6)],{item:'Gut',quantity:12},{notes:'Can be combined with Skinning and/or Boning.'}),
  recipe('gutting-cattle','Gut from Cattle','GUTTING','Gutting',1,1,'13.1.12',[input('Cattle',3)],{item:'Gut',quantity:12},{notes:'Can be combined with Skinning and/or Boning.'}),
  recipe('gutting-horse','Gut from Horses','GUTTING','Gutting',1,1,'13.1.12',[input('Horses',2)],{item:'Gut',quantity:12},{notes:'Can be combined with Skinning and/or Boning.'}),

  recipe('jewellery-trinket','Trinket','JEWELLERY','Jewellery',1,1,'13.1.17',[input('Coal',1),input('Copper',1)],{item:'Trinket',quantity:1}),
  recipe('jewellery-ornament','Ornament','JEWELLERY','Jewellery',3,1,'13.1.17',[input('Coal',2),input('Copper',2)],{item:'Ornament',quantity:1}),
  recipe('jewellery-goldwork','Goldwork','JEWELLERY','Jewellery',5,1,'13.1.17',[input('Coal',15),input('Gold',1)],{item:'Goldwork',quantity:1}),
  recipe('jewellery-inlay','Inlay','JEWELLERY','Jewellery',8,2,'13.1.17',[input('Coal',20),input('Jade',1)],{item:'Inlay',quantity:1}),

  recipe('leather-hoods','Hoods x2','LEATHERWORK','Leatherwork',1,1,'13.1.18',[input('Leather',2)],{item:'Hood',quantity:2}),
  recipe('leather-heater','Heater','LEATHERWORK','Leatherwork',2,1,'13.1.18',[input('Leather',3),input('Frame',1)],{item:'Heater',quantity:1}),
  recipe('leather-sling','Sling','LEATHERWORK','Leatherwork',2,1,'13.1.18',[input('Leather',1)],{item:'Sling',quantity:1}),
  recipe('leather-jerkin','Jerkin','LEATHERWORK','Leatherwork',3,2,'13.1.18',[input('Leather',4)],{item:'Jerkin',quantity:1}),
  recipe('leather-trews','Trews','LEATHERWORK','Leatherwork',3,1,'13.1.18',[input('Leather',2)],{item:'Trews',quantity:1}),
  recipe('leather-backpack','Backpack','LEATHERWORK','Leatherwork',4,2,'13.1.18',[input('Leather',2)],{item:'Backpack',quantity:1}),
  recipe('leather-rope','Leather Rope','LEATHERWORK','Leatherwork',4,2,'13.1.18',[input('Leather',5)],{item:'Rope',quantity:1}),
  recipe('leather-saddlebags','Saddlebags','LEATHERWORK','Leatherwork',5,2,'13.1.18',[input('Leather',4)],{item:'Saddlebags',quantity:1}),
  recipe('leather-saddle','Saddle','LEATHERWORK','Leatherwork',6,3,'13.1.18',[input('Leather',4)],{item:'Saddle',quantity:1}),

  recipe('metal-pellets','Pellets x20','METALWORK','Metalwork',1,1,'13.1.21',[input('Iron',1),input('Coal',10),input('Lead',10)],{item:'Pellets',quantity:20}),
  recipe('metal-quarrels','Quarrels x10','METALWORK','Metalwork',2,1,'13.1.21',[input('Iron',1),input('Coal',10)],{item:'Quarrels',quantity:10},{notes:'Iron only.'}),
  recipe('metal-shovel','Shovel','METALWORK','Metalwork',2,2,'13.1.21',[input('Iron',2),input('Coal',10)],{item:'Shovel',quantity:1}),
  recipe('metal-trap','Trap','METALWORK','Metalwork',2,1,'13.1.21',[input('Iron',1),input('Coal',4)],{item:'Trap',quantity:1}),
  recipe('metal-barrel','Barrel','METALWORK','Metalwork',3,2,'13.1.21',[input('Iron',2),input('Coal',4),input('Logs',1)],{item:'Barrel',quantity:1}),
  recipe('metal-mattock','Mattock','METALWORK','Metalwork',3,2,'13.1.21',[input('Iron',8),input('Coal',25)],{item:'Mattock',quantity:1}),
  recipe('metal-pick','Pick','METALWORK','Metalwork',3,2,'13.1.21',[input('Iron',3),input('Coal',15)],{item:'Pick',quantity:1}),
  recipe('metal-adze','Adze','METALWORK','Metalwork',4,2,'13.1.21',[input('Iron',4),input('Coal',20)],{item:'Adze',quantity:1}),
  recipe('metal-hoe','Hoe','METALWORK','Metalwork',4,2,'13.1.21',[input('Iron',3),input('Coal',10)],{item:'Hoe',quantity:1}),
  recipe('metal-shackle','Shackle','METALWORK','Metalwork',4,1,'13.1.21',[input('Iron',2),input('Coal',15)],{item:'Shackle',quantity:1}),
  recipe('metal-lamp','Lamp','METALWORK','Metalwork',5,1,'13.1.21',[input('Iron',1),input('Coal',50),input('Silver',20),input('Cotton',20),input('Oil',20)],{item:'Lamp',quantity:1}),
  recipe('metal-scythe','Scythe','METALWORK','Metalwork',5,2,'13.1.21',[input('Iron',3),input('Coal',15)],{item:'Scythe',quantity:1}),
  recipe('metal-plow','Plow','METALWORK','Metalwork',6,5,'13.1.21',[input('Iron',10),input('Coal',25),input('Logs',1)],{item:'Plow',quantity:1}),
  recipe('metal-cauldron','Cauldron','METALWORK','Metalwork',8,4,'13.1.21',[input('Iron',20),input('Coal',100)],{item:'Cauldron',quantity:1}),
  recipe('metal-glasspipe','Glasspipe','METALWORK','Metalwork',9,3,'13.1.21',[input('Iron',2),input('Coal',40)],{item:'Glasspipe',quantity:1}),

  recipe('pottery-ewer','Ewer','POTTERY','Pottery',1,1,'13.1.24',[input('Coal',3),input('Clay',5)],{item:'Ewer',quantity:1}),
  recipe('pottery-jar','Jar','POTTERY','Pottery',1,2,'13.1.24',[input('Coal',5),input('Clay',10)],{item:'Jar',quantity:1}),
  recipe('pottery-urn','Urn','POTTERY','Pottery',1,4,'13.1.24',[input('Coal',10),input('Clay',20)],{item:'Urn',quantity:1}),

  recipe('sewing-bladder','Bladders x2','SEWING','Sewing',2,1,'13.1.28',[input('Gut',2),input('Leather',1)],{item:'Bladder',quantity:2}),
  recipe('sewing-ring','Ring Mail','SEWING','Sewing',3,2,'13.1.28',[input('Jerkin',1),input('Iron',8),input('Coal',20)],{item:'Ring Mail',quantity:1},{requirements:[req('Armour',4)]}),
  recipe('sewing-scale','Scale Mail','SEWING','Sewing',3,2,'13.1.28',[input('Jerkin',1),input('Bronze',10),input('Coal',15)],{item:'Scale Mail',quantity:1},{requirements:[req('Armour',3)]}),
  recipe('sewing-cloth','Cloth','SEWING','Sewing',4,5,'13.1.28',[input('Parchment',20)],{item:'Cloth',quantity:1}),
  recipe('sewing-fur-jacket','Fur Jackets x10','SEWING','Sewing',5,10,'13.1.28',[input('Furs',20),input('Cotton',1)],{item:'Fur Jacket',quantity:10}),
  recipe('sewing-fur-coat','Fur Coats x10','SEWING','Sewing',6,15,'13.1.28',[input('Furs',30),input('Cotton',2)],{item:'Fur Coat',quantity:10}),
  recipe('sewing-curtain','Curtain','SEWING','Sewing',7,2,'13.1.28',[input('Cotton',300)],{item:'Curtain',quantity:1}),

  recipe('siege-ram','Ram','SIEGE','Siege Equipment',3,10,'13.1.29',[input('Logs',5),input('Coal',50),input('Iron',10)],{item:'Ram',quantity:1}),
  recipe('siege-ballista','Ballista','SIEGE','Siege Equipment',8,10,'13.1.29',[input('Logs',3),input('Coal',20),input('Iron',3),input('Rope',1)],{item:'Ballista',quantity:1}),
  recipe('siege-onager','Onager','SIEGE','Siege Equipment',8,15,'13.1.29',[input('Logs',12),input('Coal',30),input('Iron',4),input('Rope',4)],{item:'Onager',quantity:1},{requirements:[req('Woodwork',6)]}),
  recipe('siege-catapult','Catapult','SIEGE','Siege Equipment',10,15,'13.1.29',[input('Logs',10),input('Coal',30),input('Iron',2),input('Rope',4)],{item:'Catapult',quantity:1}),

  recipe('skinning-goat','Skin Goats','SKINNING','Skinning',1,1,'13.1.30',[input('Goats',3)],{item:'Skins',quantity:3},{notes:'Killed animals also yield their provisions.'}),
  recipe('skinning-cattle','Skin Cattle','SKINNING','Skinning',1,1,'13.1.30',[input('Cattle',1)],{item:'Skins',quantity:2},{notes:'Killed animals also yield their provisions.'}),
  recipe('skinning-horse','Skin Horses','SKINNING','Skinning',1,1,'13.1.30',[input('Horses',1)],{item:'Skins',quantity:3},{notes:'Killed animals also yield their provisions.'}),

  recipe('stone-axe','Stone Axe','STONEWORK','Stonework',2,1,'13.1.32',[input('Stones',1),input('Club',1),input('Leather',1)],{item:'Stone Axe',quantity:1}),
  recipe('stone-spear','Stone Spear','STONEWORK','Stonework',4,1,'13.1.32',[input('Stones',1),input('Shaft',1)],{item:'Stone Spear',quantity:1}),
  recipe('stone-sculpture','Sculpture','STONEWORK','Stonework',5,4,'13.1.32',[input('Stones',5)],{item:'Sculpture',quantity:1}),
  recipe('stone-millstone','Millstone','STONEWORK','Stonework',6,10,'13.1.32',[input('Stones',10)],{item:'Millstone',quantity:1}),
  recipe('stone-statue','Statue','STONEWORK','Stonework',8,10,'13.1.32',[input('Stones',10)],{item:'Statue',quantity:1}),
  recipe('tanning-leather','Tan Leather x4','TANNING','Tanning',1,1,'13.1.33',[input('Skins/Furs',4),input('Bark',10)],{item:'Leather',quantity:4}),

  recipe('wax-parchment','Parchment x5','WAXWORK','Waxwork',1,1,'13.1.34',[input('Wax',1),input('Skins',5)],{item:'Parchment',quantity:5}),
  recipe('wax-candles','Candles x20','WAXWORK','Waxwork',2,4,'13.1.34',[input('Wax',20),input('Cotton',1),input('Coal',5)],{item:'Candles',quantity:20},{facilities:['Cauldron']}),
  recipe('wax-strings','Strings x5','WAXWORK','Waxwork',2,1,'13.1.34',[input('Wax',1),input('Cotton/Gut',1),input('Coal',1)],{item:'Strings',quantity:5}),
  recipe('wax-seal','Seal','WAXWORK','Waxwork',3,1,'13.1.34',[input('Wax',5),input('Gold',1)],{item:'Seal',quantity:1}),
  recipe('wax-cuirboilli','Cuirboilli','WAXWORK','Waxwork',4,2,'13.1.34',[input('Wax',2),input('Coal',2),input('Leather',2)],{item:'Cuirboilli',quantity:1},{facilities:['Cauldron']}),

  recipe('weapon-shaft','Shaft','WEAPON','Weapons',1,1,'13.1.35',[],{item:'Shaft',quantity:1},{conditions:['Forest or Jungle']}),
  recipe('weapon-bow-stave','Bow from Stave','WEAPON','Weapons',1,1,'13.1.35',[input('String',1),input('Stave',1)],{item:'Bow',quantity:1}),
  recipe('weapon-slings','Slings x10','WEAPON','Weapons',1,5,'13.1.35',[input('Cloth',1)],{item:'Sling',quantity:10}),
  recipe('weapon-spetum','Spetum','WEAPON','Weapons',1,1,'13.1.35',[input('Coal',5),input('Iron',2),input('Shaft',1)],{item:'Spetum',quantity:1}),
  recipe('weapon-stave','Stave','WEAPON','Weapons',1,1,'13.1.35',[],{item:'Stave',quantity:1},{conditions:['Deciduous Forest or Jungle']}),
  recipe('weapon-spear','Spear','WEAPON','Weapons',2,1,'13.1.35',[input('Coal',10),input('Iron',2),input('Shaft/Bone Spear',1)],{item:'Spear',quantity:1}),
  recipe('weapon-mace','Mace','WEAPON','Weapons',3,2,'13.1.35',[input('Coal',30),input('Iron/Bronze',6)],{item:'Mace',quantity:1}),
  recipe('weapon-axe','Axe','WEAPON','Weapons',4,2,'13.1.35',[input('Coal',20),input('Iron',4)],{item:'Axe',quantity:1}),
  recipe('weapon-falchion','Falchion','WEAPON','Weapons',4,2,'13.1.35',[input('Coal',15),input('Iron',5)],{item:'Falchion',quantity:1}),
  recipe('weapon-sword','Sword','WEAPON','Weapons',6,3,'13.1.35',[input('Coal',30),input('Iron',5)],{item:'Sword',quantity:1}),
  recipe('weapon-arbalest','Arbalest','WEAPON','Weapons',8,3,'13.1.35',[input('Coal',20),input('Iron/Brass',2),input('String',1)],{item:'Arbalest',quantity:1}),

  recipe('weaving-ropes2','Ropes x2','WEAVING','Weaving',1,1,'13.1.36',[input('Cotton',20)],{item:'Rope',quantity:2}),
  recipe('weaving-slings2','Slings x2','WEAVING','Weaving',2,1,'13.1.36',[input('Cotton',1),input('Gut',1)],{item:'Sling',quantity:2}),
  recipe('weaving-net3','Net','WEAVING','Weaving',3,2,'13.1.36',[input('Cotton',10)],{item:'Net',quantity:1}),
  recipe('weaving-rope3','Rope','WEAVING','Weaving',3,2,'13.1.36',[input('Cotton',10),input('Bark',10)],{item:'Rope',quantity:1}),
  recipe('weaving-snares','Snares x2','WEAVING','Weaving',3,1,'13.1.36',[input('Cotton',1),input('Gut',1)],{item:'Snares',quantity:2}),
  recipe('weaving-rug','Rug','WEAVING','Weaving',4,5,'13.1.36',[input('Cotton',20)],{item:'Rug',quantity:1}),
  recipe('weaving-cloth','Cloth','WEAVING','Weaving',5,5,'13.1.36',[input('Cotton',15)],{item:'Cloth',quantity:1}),
  recipe('weaving-net5','Net with Rope','WEAVING','Weaving',5,3,'13.1.36',[input('Cotton',10),input('Rope',10)],{item:'Net',quantity:1}),
  recipe('weaving-carpet','Carpet','WEAVING','Weaving',6,10,'13.1.36',[input('Cotton',50)],{item:'Carpet',quantity:1}),
  recipe('weaving-tapestry','Tapestry','WEAVING','Weaving',8,20,'13.1.36',[input('Cotton',100)],{item:'Tapestry',quantity:1}),

  recipe('wood-clubs','Clubs x4','WOODWORK','Woodwork',1,1,'13.1.37',[input('Logs',1)],{item:'Club',quantity:4},{notes:'No Logs are needed in forest/jungle.'}),
  recipe('wood-paddle','Paddle','WOODWORK','Woodwork',2,1,'13.1.37',[input('Logs',1)],{item:'Paddle',quantity:1}),
  recipe('wood-rake','Rake','WOODWORK','Woodwork',3,1,'13.1.37',[input('Logs',1)],{item:'Rake',quantity:1}),
  recipe('wood-wagon','Wagon','WOODWORK','Woodwork',3,10,'13.1.37',[input('Logs',6)],{item:'Wagon',quantity:1}),
  recipe('wood-oar','Oar','WOODWORK','Woodwork',3,1,'13.1.37',[input('Logs',1)],{item:'Oar',quantity:1}),
  recipe('wood-frames','Frames x2','WOODWORK','Woodwork',4,2,'13.1.37',[input('Logs',1)],{item:'Frame',quantity:2}),
  recipe('wood-chair','Chair','WOODWORK','Woodwork',4,1,'13.1.37',[input('Logs',1),input('Wax',2),input('Coin',1)],{item:'Chair',quantity:1}),
  recipe('wood-bench','Bench','WOODWORK','Woodwork',4,2,'13.1.37',[input('Logs',2),input('Wax',2),input('Coin',5)],{item:'Bench',quantity:1}),
  recipe('wood-bed','Bed','WOODWORK','Woodwork',5,2,'13.1.37',[input('Logs',2),input('Wax',10),input('Coin',5)],{item:'Bed',quantity:1}),
  recipe('wood-podium','Podium','WOODWORK','Woodwork',5,5,'13.1.37',[input('Logs',3)],{item:'Podium',quantity:1}),
  recipe('wood-table','Table','WOODWORK','Woodwork',5,2,'13.1.37',[input('Logs',5),input('Wax',10),input('Coin',5)],{item:'Table',quantity:1}),

  recipe('baking-bread-grain','Bread from Grain','BAKING','Baking',1,1,'14.4.1',[input('Grain',20)],{item:'Bread/Provs',quantity:5},{facilities:['Bakery']}),
  recipe('baking-bread-flour','Bread from Flour','BAKING','Baking',1,1,'14.4.1',[input('Flour',40)],{item:'Bread/Provs',quantity:15},{facilities:['Bakery']}),
  recipe('brick-stone','Bricks (recorded as Stones)','BRICK_MAKING','Brick Making',1,1,'14.5.1',[input('Clay',20),input('Fodder',10),input('Coal',4)],{item:'Stones',quantity:30},{facilities:['Brickworks']}),
  recipe('brick-house','House Bricks x160','BRICK_MAKING','Brick Making',1,1,'14.5.1',[input('Clay',20),input('Fodder',20),input('Coal',6)],{item:'House Bricks',quantity:160},{facilities:['Brickworks']}),
  recipe('distill-ale-grain','Ale from Grain','DISTILLING','Distilling',2,5,'14.7.1',[input('Grain',100),input('Barrel',1)],{item:'Ale',quantity:100},{facilities:['Distillery','Still']}),
  recipe('distill-mead','Mead','DISTILLING','Distilling',4,5,'14.7.1',[input('Honey',20),input('Barrel',1)],{item:'Mead',quantity:100},{facilities:['Distillery','Still']}),
  recipe('distill-ale-bark','Ale from Bark/Sugar Cane','DISTILLING','Distilling',5,5,'14.7.1',[input('Bark',50),input('Sugar Cane',50),input('Barrel',1)],{item:'Ale',quantity:100},{facilities:['Distillery','Still']}),
  recipe('distill-wine','Wine','DISTILLING','Distilling',6,5,'14.7.1',[input('Grapes',100),input('Barrel',1)],{item:'Wine',quantity:100},{facilities:['Distillery','Still']}),
  recipe('distill-rum','Rum','DISTILLING','Distilling',8,5,'14.7.1',[input('Sugar Cane',100),input('Barrel',1)],{item:'Rum',quantity:100},{facilities:['Distillery','Still']}),
  recipe('distill-brandy','Brandy','DISTILLING','Distilling',9,5,'14.7.1',[input('Grapes',50),input('Sugar Cane',50),input('Barrel',1)],{item:'Brandy',quantity:100},{facilities:['Distillery','Still']}),
  recipe('milling-flour','Mill Flour','MILLING','Milling',1,1,'14.11.1',[input('Grain',80)],{item:'Flour',quantity:120},{facilities:['Mill','2 Cattle or Horses to operate']}),

  recipe('refine-iron','Refine Iron','REFINING','Refining',1,1,'14.12.1',[input('Iron Ore',20),input('Coal',10)],{item:'Iron',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-copper','Refine Copper','REFINING','Refining',1,1,'14.12.1',[input('Copper Ore',20),input('Coal',4)],{item:'Copper',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-tin','Refine Tin','REFINING','Refining',1,1,'14.12.1',[input('Tin Ore',20),input('Coal',6)],{item:'Tin',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-zinc','Refine Zinc','REFINING','Refining',1,1,'14.12.1',[input('Zinc Ore',20),input('Coal',8)],{item:'Zinc',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-lead','Refine Lead','REFINING','Refining',1,1,'14.12.1',[input('Lead Ore',20),input('Coal',6)],{item:'Lead',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-bronze','Make Bronze','REFINING','Refining',1,1,'14.12.1',[input('Copper',25),input('Tin',5),input('Coal',10)],{item:'Bronze',quantity:30},{facilities:['Refinery','Smelter']}),
  recipe('refine-brass','Make Brass','REFINING','Refining',1,1,'14.12.1',[input('Copper',16),input('Zinc',4),input('Coal',10)],{item:'Brass',quantity:20},{facilities:['Refinery','Smelter']}),
  recipe('refine-nickel','Refine Nickel','REFINING','Refining',1,1,'14.12.1',[input('Nickel Ore',20),input('Coal',6)],{item:'Nickel',quantity:15},{facilities:['Refinery','Smelter']}),
  recipe('refine-pewter','Make Pewter','REFINING','Refining',1,1,'14.12.1',[input('Lead',8),input('Tin',32),input('Coal',10)],{item:'Pewter',quantity:40},{facilities:['Refinery','Smelter']}),

  recipe('eng-meeting-house','Meeting House','MEETING_HOUSE','Engineering',2,50,'13.1.19',[input('Logs',100)],{item:'Meeting House',quantity:1}),
  recipe('eng-lodging','Lodging','LODGING','Engineering',2,100,'13.1.20',[input('Logs',200)],{item:'Lodging',quantity:1},{facilities:['1 Lamp must remain in inventory'],notes:'Mandate says Lodging is currently not in use.'}),
  recipe('eng-refinery','Refinery','ENGINEERING','Engineering',2,50,'14.8',[input('Logs',100)],{item:'Refinery',quantity:1}),
  recipe('eng-trading-post','Trading Post','ENGINEERING','Engineering',2,50,'14.14.1',[input('Logs',100)],{item:'Trading Post',quantity:1}),
  recipe('eng-bakery','Bakery','ENGINEERING','Engineering',3,20,'14.4.2',[input('Logs',40)],{item:'Bakery',quantity:1}),
  recipe('eng-distillery','Distillery','ENGINEERING','Engineering',4,40,'14.7.2',[input('Logs',80)],{item:'Distillery',quantity:1}),
  recipe('eng-jetty','Jetty','ENGINEERING','Engineering',4,50,'14.10.1',[input('Logs',100)],{item:'Jetty',quantity:1},{conditions:['Water frontage / appropriate site']}),
  recipe('eng-bank','Bank','ENGINEERING','Engineering',5,100,'14.8',[input('Logs',200),input('Iron',4000)],{item:'Bank',quantity:1},{requirements:[req('Economics',10)],notes:'Economics 10 is required in the Clan to operate.'}),
  recipe('eng-boatshed','Boatshed 1','ENGINEERING','Engineering',5,10,'20.1',[input('Logs',20)],{item:'Boatshed',quantity:1},{notes:'Boatshed 1 houses 10 Damage Rating of ships.'}),
  recipe('eng-brickworks','Brickworks','ENGINEERING','Engineering',5,40,'14.5.2',[input('Logs',80)],{item:'Brickworks',quantity:1}),
  recipe('eng-charhouse','Charhouse','ENGINEERING','Engineering',5,50,'14.6.2',[input('Logs',100)],{item:'Charhouse',quantity:1}),
  recipe('eng-mill','Mill','ENGINEERING','Engineering',5,58,'14.11.2',[input('Logs',110),input('Iron',20),input('Coal',100),input('Rope',1),input('Millstone',1)],{item:'Mill',quantity:1},{requirements:[req('Metalwork',3)]}),
  recipe('eng-wood-tower','Wooden Tower','ENGINEERING','Engineering',5,100,'14.8',[input('Logs',200)],{item:'Wooden Tower',quantity:1}),
  recipe('eng-apiary-metal','Apiary (metal)','ENGINEERING','Engineering',6,52,'14.3.2',[input('Logs',100),input('Iron',20),input('Coal',100),input('Cloth/Leather',2)],{item:'Apiary',quantity:1},{requirements:[req('Metalwork',3)],notes:'The alternative leather requirement is 20 Leather rather than 2 Cloth.'}),
  recipe('eng-apiary-wood','Apiary (wood)','ENGINEERING','Engineering',6,80,'14.3.3',[input('Logs',160),input('Cloth/Leather',2)],{item:'Apiary',quantity:1},{requirements:[req('Woodwork',4)],notes:'The alternative leather requirement is 20 Leather rather than 2 Cloth.'}),
  recipe('eng-shipyard','Shipyard 1','ENGINEERING','Engineering',6,26,'20.2',[input('Logs',50),input('Iron',10),input('Coal',20)],{item:'Shipyard',quantity:1},{notes:'Capacity 10 people. Brass/Bronze may be used instead with the Mandate substitution.'}),

  recipe('ship-boat','Boat / Lifeboat','SHIPBUILDING','Shipbuilding',1,5,'20.4',[input('Logs',10)],{item:'Boat',quantity:1},{requirements:[req('Woodwork',5)]}),
  recipe('ship-ferry','Ferry','SHIPBUILDING','Shipbuilding',2,22,'20.4',[input('Logs',40),input('Brass',10),input('Coal',40)],{item:'Ferry',quantity:1},{requirements:[req('Woodwork',5),req('Metalwork',3)]}),
  recipe('ship-fisher','Fisher','SHIPBUILDING','Shipbuilding',2,18,'20.4',[input('Logs',20),input('Brass',5),input('Coal',20),input('Copper/Lead',20),input('Leather',2),input('Cloth',2),input('Rope',3)],{item:'Fisher',quantity:1},{requirements:[req('Woodwork',6),req('Metalwork',3)]}),
  recipe('ship-barge','Barge','SHIPBUILDING','Shipbuilding',3,32,'20.4',[input('Logs',60),input('Brass',10),input('Coal',40)],{item:'Barge',quantity:1},{requirements:[req('Woodwork',5),req('Metalwork',3)]}),
  recipe('ship-coaster','Coaster','SHIPBUILDING','Shipbuilding',3,36,'20.4',[input('Logs',40),input('Brass',10),input('Coal',40),input('Copper/Lead',40),input('Leather',6),input('Cloth',4),input('Rope',6)],{item:'Coaster',quantity:1},{requirements:[req('Woodwork',6),req('Metalwork',3)]}),
  recipe('ship-small-galley','Small Galley','SHIPBUILDING','Shipbuilding',4,68,'20.4',[input('Logs',100),input('Brass',40),input('Coal',200),input('Copper/Lead',100),input('Leather',10)],{item:'Small Galley',quantity:1},{requirements:[req('Woodwork',7),req('Metalwork',5)]}),
  recipe('ship-medium-galley','Medium Galley','SHIPBUILDING','Shipbuilding',5,110,'20.4',[input('Logs',160),input('Brass',60),input('Coal',300),input('Copper/Lead',180),input('Leather',15)],{item:'Medium Galley',quantity:1},{requirements:[req('Woodwork',7),req('Metalwork',5)]}),
  recipe('ship-large-galley','Large Galley','SHIPBUILDING','Shipbuilding',6,156,'20.4',[input('Logs',220),input('Brass',80),input('Coal',400),input('Copper/Lead',300),input('Leather',20)],{item:'Large Galley',quantity:1},{requirements:[req('Woodwork',7),req('Metalwork',5)]}),
  recipe('ship-trader','Trader','SHIPBUILDING','Shipbuilding',6,144,'20.4',[input('Logs',160),input('Brass',25),input('Coal',100),input('Copper/Lead',150),input('Leather',40),input('Cloth',20),input('Rope',24)],{item:'Trader',quantity:1},{requirements:[req('Woodwork',7),req('Metalwork',4)]}),
  recipe('ship-longship','Longship','SHIPBUILDING','Shipbuilding',8,122,'20.4',[input('Logs',150),input('Brass',20),input('Coal',100),input('Copper/Lead',100),input('Leather',10),input('Cloth',15),input('Rope',18)],{item:'Longship',quantity:1},{requirements:[req('Woodwork',8),req('Metalwork',4)]}),
  recipe('ship-merchant','Merchant','SHIPBUILDING','Shipbuilding',9,138,'20.4',[input('Logs',160),input('Brass',40),input('Coal',200),input('Copper/Lead',150),input('Leather',30),input('Cloth',15),input('Rope',20)],{item:'Merchant',quantity:1},{requirements:[req('Woodwork',8),req('Metalwork',7)]}),
  recipe('ship-warship','Warship','SHIPBUILDING','Shipbuilding',9,160,'20.4',[input('Logs',200),input('Brass',50),input('Coal',250),input('Copper/Lead',150),input('Leather',30),input('Cloth',15),input('Rope',20)],{item:'Warship',quantity:1},{requirements:[req('Woodwork',8),req('Metalwork',7)]})
];

module.exports = {
  CATALOG_VERSION,
  SOURCE_DOCUMENT,
  SKILLS,
  RECIPES,
  canonical,
  resolveSkillDefinition,
  resolveSkillKey
};

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const fakeEntities = [
  'Adze','Advanced Trap','Arbalest','Arrow','Arrow Steel','Artefact','Backpack','Bark','Barrel','Bed','Bench','Bone Armour','Bone Arrow','Bone Axe','Bone Frame','Bone Spear','Bones','Bow','Brass','Breastplate','Bronze','Candle','Carpet','Cattle','Cauldron','Chain','Chair','Charcoal','Clay','Club','Cloth','Coal','Coaster','Copper','Copper Ore','Cuirass','Cuirboilli','Dog','Drum','Elephant','Ewer','Falchion','Ferry','Fish','Fisher','Flute','Frame','Fur','Furs','Glasspipe','Goat','Gold','Goldwork','Gut','Haube','Harp','Heater','Helm','Hood','Horn','Horse','Improved Trap','Inlay','Iron','Iron Ore','Jade','Jar','Jerkin','Lamp','Large Galley','Lead','Lead Ore','Leather','Log','Longship','Lute','Mace','Mattock','Medium Galley','Merchant','Milk','Net','Oar','Onager','Ornament','Paddle','Parchment','Pellets','Pick','Plank','Plow','Podium','Provisions','Quarrels','Rake','Ram','Rope','Rug','Saddle','Saddlebags','Salt','Saw','Scutum','Seal','Scythe','Shaft','Shackle','Shield','Shovel','Silver','Skin','Skins','Sling','Small Galley','Snare','Spear','Spetum','Stave','Steel','Stone Spear','Stones','String','Table','Tapestry','Tar','Tin Ore','Trader','Trap','Trews','Trumpet','Urn','Wagon','Warship','Wax','Whaler','Zinc Ore'
].map(name => ({ name, key:name }));

const context = {
  window:{}, globalThis:null, Map, Set, Object, String, Number, Array, RegExp, console,
  showSkill:() => {}, skillByName:() => null,
  entities:() => fakeEntities,
  entityByName:name => fakeEntities.find(row => canon(row.name) === canon(name) || canon(row.key) === canon(name)) || null,
  $:() => null, bindLinks:() => {}, esc:value => String(value ?? ''), canon
};
context.globalThis = context.window;
vm.createContext(context);
const run = name => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename:name });

function canon(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

run('skill-overhaul-data.js');
run('skill-overhaul-profile-registry.js');
run('skill-overhaul-woodwork-refinement.js');
run('skill-overhaul-category-a-1.js');
run('skill-overhaul-category-a-2.js');
run('skill-overhaul-category-a-3.js');
run('skill-overhaul-category-a-4.js');
run('skill-overhaul-armour-refinement.js');
run('compendium-group-a-mandate-links.js');

const S = context.window.TribeNetSkillOverhaul;
const L = context.window.TribeNetGroupAMandateLinks;
if (!S || !L) throw new Error('Group A Mandate-link audit helper did not load');

const groupA = [
  'Armour','Bonework','Boning','Curing','Dressing','Excavation','Fishing','Fletching','Forestry','Furrier',
  'Gutting','Herding','Hunting','Jewellery','Leatherwork','Metalwork','Milking','Mining','Pottery','Quarrying',
  'Salting','Sewing','Siege Equipment','Skinning','Tanning','Waxwork','Weapons','Weaving','Whaling','Woodwork'
];

for (const name of groupA) {
  const profile = S.profile(name);
  if (!profile) throw new Error(`Missing Group A profile during relationship audit: ${name}`);
  const linked = L.structuredNamesForProfile(profile);
  if (!(linked instanceof Set)) throw new Error(`Relationship collector did not return a Set for ${name}`);

  // Keep the audit helper accurate even though the UI no longer repeats these
  // relationships in a generic catch-all block.
  for (const row of profile.directCrafts || []) {
    if (row.entity && !linked.has(row.entity)) throw new Error(`${name}: direct craft entity missing from relationship audit: ${row.entity}`);
    for (const input of row.inputs || []) if (input.entity && !linked.has(input.entity)) throw new Error(`${name}: direct craft input missing: ${input.entity}`);
    for (const variant of row.variants || []) {
      for (const input of variant.inputs || []) if (input.entity && !linked.has(input.entity)) throw new Error(`${name}: variant input missing: ${input.entity}`);
    }
  }
  for (const row of profile.processRows || []) {
    for (const item of [...(row.inputs || []), ...(row.outputs || [])]) {
      if (item.entity && !linked.has(item.entity)) throw new Error(`${name}: process entity missing: ${item.entity}`);
    }
  }
  for (const row of profile.requiredUses || []) {
    if (row.entity && !linked.has(row.entity)) throw new Error(`${name}: required-use entity missing: ${row.entity}`);
  }
}

const armourProfile = S.profile('Armour');
const armour = L.structuredNamesForProfile(armourProfile);
if (armour.has('Adze')) throw new Error('Regression: Adze must never be related to Armour');
for (const expected of ['Shield','Scutum','Helm','Haube','Breastplate','Cuirass','Bronze','Iron','Coal','Hood','Heater','Trews']) {
  if (!armour.has(expected)) throw new Error(`Armour explicit relationship missing: ${expected}`);
}

// Armour-made items stay in Direct production; the secondary category table is
// cross-skill context only, preventing the page from listing the same armour twice.
const armourMade = new Set((armourProfile.directCrafts || []).map(row => row.entity).filter(Boolean));
const otherArmour = new Set((armourProfile.ruleGroups || []).flatMap(group => (group.rows || []).flatMap(row => row.values || [])));
for (const name of armourMade) {
  if (otherArmour.has(name)) throw new Error(`Armour duplication regression: ${name} appears in both direct production and other-armour table`);
}
for (const expected of ['Hood','Heater','Scale','Ring','Jerkin','Cuirboilli','Bone Armour','Trews']) {
  if (!otherArmour.has(expected)) throw new Error(`Armour cross-skill category item missing: ${expected}`);
}

const forestry = L.structuredNamesForProfile(S.profile('Forestry'));
for (const expected of ['Adze','Logs','Bark','Charcoal','Tar']) {
  if (!forestry.has(expected)) throw new Error(`Forestry explicit relationship missing: ${expected}`);
}
if (forestry.has('Shield')) throw new Error('Regression: Shield must not appear as a Forestry relationship');

const patch = fs.readFileSync(path.join(root, 'compendium-group-a-mandate-links.js'), 'utf8');
if (/sectionText\(|refs\.other|mentions\(/.test(patch)) throw new Error('Group A relationship audit must not use broad Mandate co-occurrence scanning');
if (/insertAdjacentHTML\([^\n]*Mandate-linked tools, goods & structures/.test(patch)) throw new Error('Overhauled Group A pages must not render the redundant Mandate-linked catch-all block');
if (!patch.includes("querySelectorAll('.mandate-skill-entities')")) throw new Error('Group A renderer should actively remove legacy Mandate-linked blocks');

const html = fs.readFileSync(path.join(root, 'compendium.html'), 'utf8');
if (!html.includes('skill-overhaul-armour-refinement.js')) throw new Error('Armour refinement script is not loaded');
if (html.indexOf('skill-overhaul-armour-refinement.js') > html.indexOf('compendium.js')) throw new Error('Armour refinement must load before Compendium renderers');

console.log('Group A relationship audit passed: generic catch-all removed, Armour duplication reduced, and Adze is Forestry-only');
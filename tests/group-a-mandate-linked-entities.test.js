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
  if (!profile) throw new Error(`Missing Group A profile during Mandate-link audit: ${name}`);
  const linked = L.structuredNamesForProfile(profile);
  if (!(linked instanceof Set)) throw new Error(`Mandate-link collector did not return a Set for ${name}`);

  // Every explicitly structured Mandate relationship must be retained.
  for (const row of profile.directCrafts || []) {
    if (row.entity && !linked.has(row.entity)) throw new Error(`${name}: direct craft entity missing from Mandate links: ${row.entity}`);
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

  // Research-only equipment must not leak into a block explicitly labelled Mandate-linked.
  for (const field of ['implements','supportImplements','modifiers','benefitItems']) {
    for (const row of profile[field] || []) {
      if (canon(row.source) === 'RESEARCH' && linked.has(row.name)) {
        const appearsElsewhere = (profile.directCrafts || []).some(x => x.entity === row.name) ||
          (profile.requiredUses || []).some(x => x.entity === row.name) ||
          (profile.levelUses || []).some(x => x.item === row.name);
        if (!appearsElsewhere) throw new Error(`${name}: research-only item leaked into Mandate links: ${row.name}`);
      }
    }
  }
}

const armour = L.structuredNamesForProfile(S.profile('Armour'));
if (armour.has('Adze')) throw new Error('Regression: Adze must never appear as an Armour Mandate-linked entity');
for (const expected of ['Shield','Scutum','Helm','Haube','Breastplate','Cuirass','Bronze','Iron','Coal','Hood','Heater','Trews']) {
  if (!armour.has(expected)) throw new Error(`Armour explicit Mandate entity missing: ${expected}`);
}

const forestry = L.structuredNamesForProfile(S.profile('Forestry'));
for (const expected of ['Adze','Logs','Bark','Charcoal','Tar']) {
  if (!forestry.has(expected)) throw new Error(`Forestry explicit Mandate entity missing: ${expected}`);
}
if (forestry.has('Shield')) throw new Error('Regression: Shield must not appear as a Forestry Mandate-linked entity');

const hunting = L.structuredNamesForProfile(S.profile('Hunting'));
for (const wrong of ['Improved Trap','Advanced Trap','Hunting Dog']) {
  if (hunting.has(wrong)) throw new Error(`Hunting research-only item leaked into Mandate-linked entities: ${wrong}`);
}
const fishing = L.structuredNamesForProfile(S.profile('Fishing'));
for (const wrong of ['Trawling Net','Trawler']) {
  if (fishing.has(wrong)) throw new Error(`Fishing research-only item leaked into Mandate-linked entities: ${wrong}`);
}
const mining = L.structuredNamesForProfile(S.profile('Mining'));
for (const wrong of ['Mining Ladder','Ore Cart','Seam Wedges']) {
  if (mining.has(wrong)) throw new Error(`Mining research-only item leaked into Mandate-linked entities: ${wrong}`);
}
const whaling = L.structuredNamesForProfile(S.profile('Whaling'));
if (whaling.has('Whaler')) throw new Error('Whaler is Research List support and must not be shown as a Mandate-linked Whaling entity');

const patch = fs.readFileSync(path.join(root, 'compendium-group-a-mandate-links.js'), 'utf8');
if (/sectionText\(|refs\.other|mentions\(/.test(patch)) throw new Error('Group A entity links must not use broad Mandate co-occurrence scanning');
if (!patch.includes('Incidental co-occurrence elsewhere in the Mandate is excluded')) throw new Error('UI should explain the stricter Group A relationship rule');

console.log('Group A Mandate-linked entity audit passed for all 30 skills; broad co-occurrence false positives are excluded');
const { canonical } = require('./mandate-catalog');

const MANUAL_ENTITIES = {
  LEATHER: {
    kind: 'material',
    summary: 'Processed animal hide used by Leatherwork, armour-related crafts, ships and other production.',
    sections: ['13.1.5','13.1.6','13.1.33']
  },
  CHARHOUSE: {
    kind: 'facility',
    summary: 'An Engineering 5 container building used for charcoal production. The building uses 100 Logs; charcoal capacity is provided by Burners.',
    sections: ['14.6.1','14.6.2','14.8.1'],
    notes: ['Charcoal production requires Forestry 5 and a Charhouse.', 'Each Burner supports up to 10 charcoal workers.']
  },
  BRASS: {
    kind: 'material',
    summary: 'A refined copper/zinc alloy used in tools, installations and ship construction.',
    sections: ['14.12.1','20.4'],
    notes: ['Shipbuilding entries that specify Brass require Brass: the Mandate explicitly says Bronze may not be substituted for Brass in ships.']
  },
  IRON: {
    kind: 'material',
    summary: 'Refined metal used throughout tools, buildings and equipment.',
    sections: ['13.1.21','14.12.1'],
    notes: ['For Metalwork items, Bronze or Brass may usually replace Iron using the same amount of metal and 75% of the Coal, rounded up. Quarrels are explicitly Iron only.']
  },
  SLING: {
    kind: 'item',
    summary: 'A missile weapon that can also be used as a Hunting implement.',
    sections: ['13.1.15','13.1.18','13.1.35','13.1.36'],
    uses: [
      { skill: 'Hunting', text: 'Each hunter may use one Sling as a hunting implement; it adds 0.1 effective AM to Hunting.', section: '13.1.15' },
      { skill: 'Archery', text: 'Slings are missile weapons in combat; Pellets improve their effectiveness.', section: '13.1.21' }
    ]
  },
  TRAP: { kind:'item', sections:['13.1.15','13.1.21'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Traps as improving Hunting returns.',section:'13.1.15'}] },
  SNARE: { kind:'item', sections:['13.1.15','13.1.36'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Snares as improving Hunting returns.',section:'13.1.15'}] },
  BOW: { kind:'item', sections:['13.1.15','13.1.35'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Bows as improving Hunting returns.',section:'13.1.15'},{skill:'Archery',text:'A missile weapon used with Archery in combat.',section:'29.5'}] },
  ARBALEST: { kind:'item', sections:['13.1.15','13.1.35'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Arbalests as improving Hunting returns.',section:'13.1.15'},{skill:'Archery',text:'A missile weapon used with Archery in combat.',section:'29.5'}] },
  SPEAR: { kind:'item', sections:['13.1.15','13.1.35'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Spears as improving Hunting returns.',section:'13.1.15'}] },
  'BONE SPEAR': { kind:'item', sections:['13.1.3','13.1.15'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Bone Spears as improving Hunting returns.',section:'13.1.15'}] },
  'STONE SPEAR': { kind:'item', sections:['13.1.15','13.1.32'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Stone Spears as improving Hunting returns.',section:'13.1.15'}] },
  SPETUM: { kind:'item', sections:['13.1.15','13.1.35'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Spetums as improving Hunting returns.',section:'13.1.15'}] },
  NET: { kind:'item', sections:['13.1.15','13.1.36','22'], uses:[{skill:'Hunting',text:'A Hunting implement; the Mandate lists Nets as improving Hunting returns.',section:'13.1.15'},{skill:'Fishing',text:'Nets can improve Fishing.',section:'22'}] },
  ADZE: { kind:'item', sections:['13.1.9','13.1.21'], uses:[{skill:'Forestry',text:'A Forestry worker with an Adze fells more Logs.',section:'13.1.21'}] },
  PICK: { kind:'item', sections:['13.1.21','13.1.22'], uses:[{skill:'Mining',text:'A Pick improves Mining output.',section:'13.1.21'}] },
  MATTOCK: { kind:'item', sections:['13.1.21','13.1.22','13.1.25'], uses:[{skill:'Mining',text:'A Mattock improves Mining output.',section:'13.1.21'},{skill:'Quarrying',text:'A Mattock increases stone production for Quarrying.',section:'13.1.21'}] },
  SHOVEL: { kind:'item', sections:['13.1.8','13.1.21','13.1.22'], uses:[{skill:'Mining',text:'A Shovel improves Mining output.',section:'13.1.21'}] },
  HOE: { kind:'item', sections:['13.1.21','14.9'], uses:[{skill:'Farming',text:'A Hoe increases ploughing capacity.',section:'13.1.21'}] },
  PLOW: { kind:'item', sections:['13.1.21','14.9'], uses:[{skill:'Farming',text:'A Plow used with a Horse or Cow greatly increases ploughing capacity.',section:'13.1.21'}] },
  SCYTHE: { kind:'item', sections:['13.1.21','14.9'], uses:[{skill:'Farming',text:'A Scythe doubles acres harvested per person for Grain, Sugar and Fodder.',section:'13.1.21'}] },

  LOGS: { kind:'raw material', summary:'Timber gathered by Forestry in Forest or Jungle terrain.', sourceSkills:['Forestry'], sections:['13.1.9'] },
  BARK: { kind:'raw material', summary:'Forest material gathered using Forestry.', sourceSkills:['Forestry'], sections:['13.1.9'] },
  COAL: { kind:'raw material', summary:'Mined from a known Coal deposit.', sourceSkills:['Mining'], sections:['13.1.22'] },
  'IRON ORE': { kind:'raw material', summary:'Mined from a known Iron Ore deposit, then refined into Iron.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  'COPPER ORE': { kind:'raw material', summary:'Mined from a known Copper Ore deposit, then refined into Copper.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  'TIN ORE': { kind:'raw material', summary:'Mined from a known Tin Ore deposit, then refined into Tin.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  'ZINC ORE': { kind:'raw material', summary:'Mined from a known Zinc Ore deposit, then refined into Zinc.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  'LEAD ORE': { kind:'raw material', summary:'Mined from a known Lead Ore deposit, then refined into Lead.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  'NICKEL ORE': { kind:'raw material', summary:'Mined from a known mineral deposit, then refined into Nickel.', sourceSkills:['Mining','Refining'], sections:['13.1.22','14.12.1'] },
  SALT: { kind:'raw material', summary:'A mineral resource obtained from known Salt deposits.', sourceSkills:['Mining'], sections:['13.1.22'] },
  GOLD: { kind:'raw material', summary:'A rare mineral resource obtained through Mining/Seeking where present.', sourceSkills:['Mining','Seeking'], sections:['13.1.22','13.1.26'] },
  SILVER: { kind:'raw material', summary:'A mineral resource obtained through Mining/Seeking where present.', sourceSkills:['Mining','Seeking'], sections:['13.1.22','13.1.26'] },
  JADE: { kind:'raw material', summary:'A rare mineral resource obtained through Mining/Seeking where present.', sourceSkills:['Mining','Seeking'], sections:['13.1.22','13.1.26'] },
  STONES: { kind:'raw material', summary:'Stone gathered through Quarrying or related stone-producing activities.', sourceSkills:['Quarrying'], sections:['13.1.25'] },
  STONE: { kind:'raw material', summary:'Stone gathered through Quarrying or related stone-producing activities.', sourceSkills:['Quarrying'], sections:['13.1.25'] },
  SAND: { kind:'raw material', summary:'Gathered without a skill from suitable water-adjacent hexes; Shovels improve the rate.', sections:['13.1.8'] },
  CLAY: { kind:'raw material', summary:'Gathered/digged as a general activity; some uses require Clay to be physically in the unit inventory.', sections:['13.1.8','13.1.24'] },
  FODDER: { kind:'raw material', summary:'Foraged in Prairie or Grassy Hills; a Scythe improves collection.', sections:['13.1.8'] },
  OIL: { kind:'raw material', summary:'Obtained through the general Oil Production activity where applicable.', sections:['13.1.8'] },
  SKINS: { kind:'raw material', summary:'Animal skins obtained through Skinning.', sourceSkills:['Skinning'], sections:['13.1.30'] },
  SKIN: { kind:'raw material', summary:'Animal skins obtained through Skinning.', sourceSkills:['Skinning'], sections:['13.1.30'] },
  FURS: { kind:'raw material', summary:'Animal fur obtained from animal-processing/hunting results where applicable.', sourceSkills:['Hunting','Skinning'], sections:['13.1.15','13.1.30'] },
  FUR: { kind:'raw material', summary:'Animal fur obtained from animal-processing/hunting results where applicable.', sourceSkills:['Hunting','Skinning'], sections:['13.1.15','13.1.30'] },
  GUT: { kind:'raw material', summary:'Obtained by Gutting slaughtered animals.', sourceSkills:['Gutting'], sections:['13.1.12'] },
  BONES: { kind:'raw material', summary:'Obtained by Boning slaughtered animals.', sourceSkills:['Boning'], sections:['13.1.2'] },
  COTTON: { kind:'raw material', summary:'An agricultural crop produced through Farming.', sourceSkills:['Farming'], sections:['14.9'] },
  GRAIN: { kind:'raw material', summary:'An agricultural crop produced through Farming.', sourceSkills:['Farming'], sections:['14.9'] },
  GRAPES: { kind:'raw material', summary:'An agricultural crop produced through Farming.', sourceSkills:['Farming'], sections:['14.9'] },
  'SUGAR CANE': { kind:'raw material', summary:'An agricultural crop produced through Farming.', sourceSkills:['Farming'], sections:['14.9'] },
  HONEY: { kind:'raw material', summary:'Produced from Apiaries/bees.', sourceSkills:['Apiarism'], sections:['14.3'] },
  WAX: { kind:'raw material', summary:'Produced from Apiaries/bees.', sourceSkills:['Apiarism'], sections:['14.3'] },
  GOATS: { kind:'animal', summary:'Livestock managed through Herding and held in unit inventory.', sourceSkills:['Herding'], sections:['13.1.14'] },
  CATTLE: { kind:'animal', summary:'Livestock managed through Herding and held in unit inventory.', sourceSkills:['Herding'], sections:['13.1.14'] },
  HORSES: { kind:'animal', summary:'Livestock managed through Herding and held in unit inventory.', sourceSkills:['Herding'], sections:['13.1.14'] }
};

const ENTITY_ALIASES = {
  STRINGS: 'STRING',
  SNARES: 'SNARE',
  'BONE ARROWS': 'BONE ARROW',
  PROVS: 'PROVISIONS',
  'SKINS FURS': 'SKINS/FURS'
};

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function entityKey(value) {
  const key = canonical(value);
  return ENTITY_ALIASES[key] || key;
}

function choiceInputs(recipe) {
  const base = recipe.inputs || [];
  let variants = [{ label: 'Standard', inputs: [] }];
  for (const source of base) {
    const raw = cleanName(source.item);
    let choices = [{ item: raw, quantity: Number(source.quantity || 0), optional: Boolean(source.optional) }];
    if (raw.includes('/')) {
      if (canonical(raw) === 'CLOTH LEATHER' && String(recipe.recipeKey || '').startsWith('eng-apiary')) {
        choices = [
          { item: 'Cloth', quantity: Number(source.quantity || 0), optional: Boolean(source.optional), label: 'Cloth' },
          { item: 'Leather', quantity: 20, optional: Boolean(source.optional), label: 'Leather' }
        ];
      } else {
        choices = raw.split('/').map(part => ({ item: cleanName(part), quantity: Number(source.quantity || 0), optional: Boolean(source.optional), label: cleanName(part) }));
      }
    }
    const next = [];
    for (const variant of variants) {
      for (const choice of choices) {
        next.push({
          label: choices.length > 1 ? `${variant.label === 'Standard' ? '' : `${variant.label} + `}${choice.label || choice.item}` : variant.label,
          inputs: [...variant.inputs, { item: choice.item, quantity: choice.quantity, optional: choice.optional }]
        });
      }
    }
    variants = next.slice(0, 16);
  }
  return variants;
}

function replaceMaterial(inputs, from, to, metalMultiplier = 1, coalMultiplier = 1) {
  return inputs.map(input => {
    if (canonical(input.item) === canonical(from)) return { ...input, item: to, quantity: Math.ceil(Number(input.quantity || 0) * metalMultiplier) };
    if (canonical(input.item) === 'COAL') return { ...input, quantity: Math.ceil(Number(input.quantity || 0) * coalMultiplier) };
    return { ...input };
  });
}

function recipeAlternatives(recipe) {
  let variants = choiceInputs(recipe);
  const key = String(recipe.recipeKey || '');
  const primary = canonical(recipe.primarySkill);

  if (primary === 'METALWORK' && key !== 'metal-quarrels') {
    const expanded = [...variants];
    for (const variant of variants) {
      if (!variant.inputs.some(input => canonical(input.item) === 'IRON')) continue;
      expanded.push({ label:'Bronze substitution', inputs:replaceMaterial(variant.inputs, 'Iron', 'Bronze', 1, 0.75), note:'Mandate 13.1.21 metal substitution.' });
      expanded.push({ label:'Brass substitution', inputs:replaceMaterial(variant.inputs, 'Iron', 'Brass', 1, 0.75), note:'Mandate 13.1.21 metal substitution.' });
    }
    variants = expanded;
  }

  if (['eng-mill','eng-apiary-metal'].includes(key)) {
    const expanded = [...variants];
    for (const variant of variants) {
      if (!variant.inputs.some(input => canonical(input.item) === 'IRON')) continue;
      expanded.push({ label:`${variant.label === 'Standard' ? '' : `${variant.label} + `}Bronze substitution`, inputs:replaceMaterial(variant.inputs, 'Iron', 'Bronze', 1.5, 0.75), note:'Mandate 14.2.1 installation substitution.' });
      expanded.push({ label:`${variant.label === 'Standard' ? '' : `${variant.label} + `}Brass substitution`, inputs:replaceMaterial(variant.inputs, 'Iron', 'Brass', 1.5, 0.75), note:'Mandate 14.2.1 installation substitution.' });
    }
    variants = expanded;
  }

  if (key === 'eng-shipyard') {
    const base = variants[0]?.inputs || recipe.inputs || [];
    variants = [
      { label:'Iron fittings', inputs:base.map(x=>({ ...x })) },
      { label:'Bronze fittings', inputs:replaceMaterial(base, 'Iron', 'Bronze', 1, 0.75), note:'Shipyard 1: 10 Bronze and 15 Coal.' },
      { label:'Brass fittings', inputs:replaceMaterial(base, 'Iron', 'Brass', 1, 0.75), note:'Shipyard 1: 10 Brass and 15 Coal.' }
    ];
  }

  const seen = new Set();
  return variants.filter(variant => {
    const signature = variant.inputs.map(x=>`${canonical(x.item)}:${Number(x.quantity||0)}`).sort().join('|');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function facilityNames(value) {
  const raw = cleanName(value);
  const exact = ['Bakery','Brickworks','Charhouse','Distillery','Still','Mill','Refinery','Smelter','Cauldron','Shipyard','Glasspipe','Burner','Kiln','Oven'];
  const result = exact.filter(name => new RegExp(`\\b${name.replace(/s$/,'')}s?\\b`, 'i').test(raw));
  return result.length ? result : [];
}

function enrichCompendiumCatalog(catalog) {
  const allRecipes = [];
  const seenRecipes = new Set();
  for (const skill of catalog.skills || []) {
    skill.recipes = (skill.recipes || []).map(recipe => ({ ...recipe, alternatives: recipeAlternatives(recipe) }));
    for (const recipe of skill.recipes) {
      const key = recipe.recipeKey || `${recipe.primarySkill}:${recipe.name}`;
      if (!seenRecipes.has(key)) { seenRecipes.add(key); allRecipes.push(recipe); }
    }
  }

  const entityMap = new Map();
  function ensure(name, kind = 'item') {
    const display = cleanName(name);
    const key = entityKey(display);
    if (!key) return null;
    if (!entityMap.has(key)) entityMap.set(key, { key, name:display, kind, summary:'', sections:[], notes:[], sourceSkills:[], uses:[], producers:[], consumers:[] });
    return entityMap.get(key);
  }

  for (const [key, detail] of Object.entries(MANUAL_ENTITIES)) {
    const entity = ensure(detail.name || key.replace(/\b\w/g, c => c), detail.kind || 'item');
    entity.name = detail.name || entity.name.replace(/\b\w/g, c => c.toUpperCase());
    entity.kind = detail.kind || entity.kind;
    entity.summary = detail.summary || entity.summary;
    entity.sections = Array.from(new Set([...(entity.sections||[]),...(detail.sections||[])]));
    entity.notes = [...(detail.notes || [])];
    entity.sourceSkills = [...(detail.sourceSkills || [])];
    entity.uses = [...(detail.uses || [])];
  }

  for (const recipe of allRecipes) {
    if (recipe.outputItem) {
      const output = ensure(recipe.outputItem, /house|yard|works|mill|refinery|distillery|bakery|apiary|tower|post|bank|boatshed/i.test(recipe.outputItem) ? 'facility' : 'item');
      output.producers.push({ recipeKey:recipe.recipeKey, name:recipe.name, skill:recipe.primarySkill, skillLevel:recipe.skillLevel, people:recipe.people, section:recipe.section, alternatives:recipe.alternatives, notes:recipe.notes || '' });
      output.sections.push(recipe.section);
    }
    const variants = recipe.alternatives?.length ? recipe.alternatives : [{ inputs:recipe.inputs || [] }];
    const inputNames = new Set();
    for (const variant of variants) for (const input of variant.inputs || []) inputNames.add(cleanName(input.item));
    for (const itemName of inputNames) {
      const entity = ensure(itemName);
      entity.consumers.push({ recipeKey:recipe.recipeKey, name:recipe.name, skill:recipe.primarySkill, section:recipe.section, role:'input' });
      entity.sections.push(recipe.section);
    }
    for (const facilityText of recipe.facilities || []) {
      for (const facilityName of facilityNames(facilityText)) {
        const entity = ensure(facilityName, 'facility');
        entity.consumers.push({ recipeKey:recipe.recipeKey, name:recipe.name, skill:recipe.primarySkill, section:recipe.section, role:'facility' });
        entity.sections.push(recipe.section);
      }
    }
  }

  for (const entity of entityMap.values()) {
    entity.sections = Array.from(new Set((entity.sections || []).filter(Boolean)));
    entity.producers = entity.producers.filter((row, index, arr) => arr.findIndex(x => x.recipeKey === row.recipeKey) === index);
    entity.consumers = entity.consumers.filter((row, index, arr) => arr.findIndex(x => x.recipeKey === row.recipeKey && x.role === row.role) === index);
  }

  return { ...catalog, entities:Array.from(entityMap.values()).sort((a,b)=>a.name.localeCompare(b.name)) };
}

module.exports = { MANUAL_ENTITIES, recipeAlternatives, enrichCompendiumCatalog, entityKey };

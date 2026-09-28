(() => {
  const source = {
    workbook: '10 903 Fair Prices.xlsx',
    year: 903,
    sheet: 'Dynamic Adjustments',
    field: 'Base Price',
    note: 'Stable benchmark only. Actual Fair prices can change with dynamic adjustments, tariffs and game state.'
  };

  const rows = [["Absinth","Premium - Research",5.69],["Absinth, Branded","Premium - Research",8.54],["Adze","Normal",92],["Ale","Premium",2.94],["Ale, Branded","Premium - Research",4.41],["Arbalest","Desirable",128],["Arrow","Normal",4],["Artefact","Special",1200],["Axe","Desirable",101],["Backpack","Desirable",80],["Ballista","Desirable",298],["Bark","Undesirable",2],["Barrel","Normal",55],["Beads","Desirable",4],["Beakers","Normal",46],["Bladder","Normal",19],["Boat","Normal",131],["Bones","Undesirable",2],["Bone Armour","Undesirable",132],["Bone Axe","Undesirable",48],["Bone Frame","Undesirable",36],["Bone Spear","Undesirable",31],["Bottle","Normal",85],["Bow","Desirable",52],["Brandy","Premium",5.38],["Brandy, Branded","Premium - Research",8.07],["Brass","Normal",6],["Breastplate","Desirable",334],["Bronze","Normal",5],["Bronze Statue","Premium - Research",15408],["Candle","Normal",5],["Carpet","Premium",425],["Cattle","Desirable",52],["Cauldron","Normal",416],["Chain","Desirable",295],["China","Commodity",100],["Clay","Undesirable",1],["Cloth","Normal",117],["Club","Normal",5],["Coal","Normal",2],["Coffee","Commodity",8],["Coin","Commodity",40],["Copper","Normal",5],["Copper Ore","Normal",3],["Cotton","Normal",2],["Cuirass","Normal",261],["Cuirboilli","Undesirable",77],["Diamond","Commodity",200],["Dog","Desirable",111],["Drum","Normal",54],["Ewer","Normal",23],["Falchion","Normal",88],["Flour","Normal",2],["Flute","Normal",38],["Fodder","Undesirable",1],["Frame","Normal",19],["Frankincense","Commodity",200],["Fur","Desirable",57],["Gin","Premium - Research",6.5],["Gin, Branded","Premium - Research",9.76],["Glasspipe","Normal",154],["Goat","Desirable",8],["Gold","Commodity",400],["Goldwork","Premium",11277],["Grain","Normal",2],["Grape","Normal",2],["Gut","Undesirable",2],["Harp","Normal",236],["Haube","Normal",65],["Heater","Undesirable",78],["Helm","Desirable",94],["Herb","Normal",4],["Hive","Desirable",110],["Hoe","Normal",69],["Honey","Normal",2],["Hood","Undesirable",22],["Horn","Normal",39],["Horse","Desirable",98],["Inlay","Premium",17279],["Iron","Normal",6],["Iron Ore","Normal",3],["Ivory","Commodity",40],["Jade","Commodity",200],["Jar","Normal",44],["Jerkin","Undesirable",96],["Lamp","Normal",107],["Lead","Normal",5],["Lead Ore","Normal",3],["Leather","Normal",17],["Lens","Normal",267],["Log","Normal",4],["Lute","Normal",138],["Mace","Normal",116],["Marble Statue","Special - Research",10000],["Mattock","Normal",120],["Mead","Premium",2.27],["Mead, Branded","Premium - Research",3.4],["Millstone","Normal",219],["Musk","Commodity",200],["Net","Normal",50],["Nickel","Normal",5],["Nickel Ore","Normal",3],["Oar","Normal",20],["Oil","Normal",98],["Olives","Commodity",40],["Opium","Commodity",400],["Ornament","Premium",43],["Paddle","Normal",19],["Parchment","Normal",16],["Pearls","Commodity",200],["Pellet","Normal",4],["Pewter","Normal",6],["Pick","Normal",74],["Plow","Normal",205],["Port","Premium - Research",5.38],["Port, Branded","Premium - Research",8.07],["Provs","Normal",6],["Quarrel","Normal",4],["Rake","Normal",20],["Ring","Normal",228],["Rope","Normal",24],["Rubies","Commodity",200],["Rug","Premium",182],["Rum","Premium",6.2],["Rum, Branded","Premium - Research",9.3],["Saddle","Normal",139],["Saddlebag","Desirable",127],["Salt","Normal",3],["Sand","Undesirable",1],["Scale","Normal",219],["Sculpture","Premium",131],["Scutum","Normal",80],["Scythe","Normal",80],["Shackle","Normal",60],["Shaft","Normal",14],["Shield","Desirable",120],["Shovel","Normal",58],["Silk","Commodity",40],["Skin","Normal",12],["Sling","Normal",9],["Snare","Normal",9],["Spear","Normal",73],["Spetum","Normal",62],["Spice","Commodity",80],["Statue","Premium",353],["Stave","Normal",14],["Stone","Normal",4],["Stone Axe","Undesirable",51],["Stone Spear","Undesirable",34],["String","Normal",4],["Sugar","Normal",4],["Sword","Desirable",156],["Tapestry","Premium",915],["Tar","Undesirable",1],["Tea","Commodity",8],["Tin","Normal",5],["Tin Ore","Normal",3],["Tobacco","Normal",4],["Trap","Normal",27],["Trews","Desirable",59],["Trinket","Premium",25],["Trumpet","Normal",118],["Urn","Normal",88],["Wagon","Normal",186],["Wax","Normal",2],["Whip","Normal",38],["Wine","Premium",3.89],["Wine, Branded","Premium - Research",5.83],["Winter Furs","Special - Research",226],["Zinc","Normal",6],["Zinc Ore","Normal",3]];

  const canonical = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const byKey = new Map(rows.map(([name,status,basePrice]) => [canonical(name), { name, status, basePrice }]));
  const aliases = {
    'LOGS':'LOG', 'STONES':'STONE', 'SKINS':'SKIN', 'FURS':'FUR', 'GOATS':'GOAT', 'HORSES':'HORSE', 'GRAPES':'GRAPE',
    'SUGAR CANE':'SUGAR', 'PROVISIONS':'PROVS', 'BREAD PROVS':'PROVS', 'ARROWS':'ARROW', 'QUARRELS':'QUARREL', 'PELLETS':'PELLET',
    'CANDLES':'CANDLE', 'STRINGS':'STRING', 'SADDLEBAGS':'SADDLEBAG', 'SNARES':'SNARE', 'BONE FRAMES':'BONE FRAME', 'FRAMES':'FRAME',
    'HOODS':'HOOD', 'HEATERS':'HEATER', 'JERKINS':'JERKIN', 'CLUBS':'CLUB', 'BOWS':'BOW', 'SPEARS':'SPEAR', 'SPETUMS':'SPETUM',
    'RING MAIL':'RING', 'SCALE MAIL':'SCALE', 'CHAIN MAIL':'CHAIN', 'BLADDERS':'BLADDER', 'SWORDS':'SWORD', 'AXES':'AXE',
    'FALCHIONS':'FALCHION', 'MATTocks':'MATTOCK', 'PICKS':'PICK', 'SHOVELS':'SHOVEL', 'OARS':'OAR', 'PADDLES':'PADDLE', 'ROPES':'ROPE',
    'SLINGS':'SLING', 'TRAPS':'TRAP', 'WAGONS':'WAGON', 'HIVES':'HIVE', 'BONE ARMOURS':'BONE ARMOUR'
  };

  function lookup(value) {
    let key = canonical(value);
    key = aliases[key] || key;
    if (byKey.has(key)) return byKey.get(key);
    if (key.endsWith('S') && byKey.has(key.slice(0, -1))) return byKey.get(key.slice(0, -1));
    return null;
  }

  function evaluateVariant(recipe, variant) {
    const output = lookup(recipe.outputItem);
    const quantity = Number(recipe.outputQuantity || 1);
    const outputValue = output ? output.basePrice * quantity : null;
    let inputValue = 0;
    const missingInputs = [];
    const pricedInputs = [];
    for (const input of (variant.inputs || [])) {
      if (input.optional) continue;
      const price = lookup(input.item);
      if (!price) {
        missingInputs.push(input.item);
        continue;
      }
      const value = Number(input.quantity || 0) * price.basePrice;
      inputValue += value;
      pricedInputs.push({ item: input.item, quantity:Number(input.quantity || 0), unitPrice:price.basePrice, value });
    }
    const complete = missingInputs.length === 0;
    const uplift = outputValue != null && complete && inputValue > 0 ? ((outputValue - inputValue) / inputValue) * 100 : null;
    return {
      label: variant.label || 'Standard', note: variant.note || '', outputUnitPrice: output?.basePrice ?? null, outputValue,
      inputValue: complete ? inputValue : null, pricedInputs, missingInputs, complete, uplift,
      noPricedInputs: complete && inputValue === 0
    };
  }

  function evaluateRecipe(recipe) {
    const variants = recipe.alternatives?.length ? recipe.alternatives : [{ label:'Standard', inputs:recipe.inputs || [] }];
    return {
      output: lookup(recipe.outputItem), outputQuantity:Number(recipe.outputQuantity || 1),
      variants: variants.map(variant => evaluateVariant(recipe, variant))
    };
  }

  window.TribeNetFairPriceBenchmark = { source, rows, lookup, evaluateRecipe };
})();

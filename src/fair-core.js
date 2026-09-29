(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairCore = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  function canonical(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const ITEM_ALIASES = {
    'LOGS':'LOG', 'STONES':'STONE', 'SKINS':'SKIN', 'FURS':'FUR', 'GOATS':'GOAT', 'HORSES':'HORSE',
    'GRAPES':'GRAPE', 'PROVISIONS':'PROVS', 'BREAD PROVS':'PROVS', 'ARROWS':'ARROW', 'QUARRELS':'QUARREL',
    'PELLETS':'PELLET', 'CANDLES':'CANDLE', 'STRINGS':'STRING', 'SADDLEBAGS':'SADDLEBAG', 'SNARES':'SNARE',
    'BONE FRAMES':'BONE FRAME', 'FRAMES':'FRAME', 'HOODS':'HOOD', 'HEATERS':'HEATER', 'JERKINS':'JERKIN',
    'CLUBS':'CLUB', 'BOWS':'BOW', 'SPEARS':'SPEAR', 'SPETUMS':'SPETUM', 'SLINGS':'SLING', 'TRAPS':'TRAP',
    'WAGONS':'WAGON', 'HIVES':'HIVE', 'BONE ARMOURS':'BONE ARMOUR', 'B AXE':'BONE AXE', 'B AXES':'BONE AXE',
    'BONE':'BONES', 'CHAIN MAIL':'CHAIN', 'RING MAIL':'RING', 'SCALE MAIL':'SCALE', 'BREAST PLATE':'BREASTPLATE'
  };

  function itemKey(value) {
    const key = canonical(value);
    if (!key) return '';
    if (ITEM_ALIASES[key]) return ITEM_ALIASES[key];
    if (key.endsWith('S') && ITEM_ALIASES[key.slice(0, -1)]) return ITEM_ALIASES[key.slice(0, -1)];
    return key;
  }

  function itemOptions(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const parts = text.split('/').map(part => itemKey(part)).filter(Boolean);
    return [...new Set(parts.length ? parts : [itemKey(text)])];
  }

  function rootTribe(unitCode) {
    const match = String(unitCode || '').match(/^(\d{4})/);
    return match ? match[1] : String(unitCode || '').trim();
  }

  function aggregateInventory(resultTurn) {
    const byKey = new Map();
    for (const unit of resultTurn?.units || []) {
      for (const [section, values] of Object.entries(unit.resources || {})) {
        for (const [name, rawQuantity] of Object.entries(values || {})) {
          const quantity = Number(rawQuantity || 0);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;
          const key = itemKey(name);
          if (!key) continue;
          if (!byKey.has(key)) byKey.set(key, { key, name, quantity:0, breakdown:[], sections:new Set() });
          const row = byKey.get(key);
          row.quantity += quantity;
          row.sections.add(section);
          row.breakdown.push({ unitCode:unit.unitCode, unitType:unit.unitType, tribe:rootTribe(unit.unitCode), section, quantity });
        }
      }
    }
    return [...byKey.values()].map(row => ({
      key:row.key,
      name:row.name,
      quantity:row.quantity,
      sections:[...row.sections],
      breakdown:row.breakdown.sort((a,b) => String(a.unitCode).localeCompare(String(b.unitCode)))
    })).sort((a,b) => a.name.localeCompare(b.name));
  }

  function buildSkillAliases(skillDefinitions = []) {
    const aliases = new Map();
    for (const skill of skillDefinitions || []) {
      const normalized = canonical(skill.name);
      if (!normalized) continue;
      aliases.set(normalized, normalized);
      if (skill.shortname) aliases.set(canonical(skill.shortname), normalized);
    }
    aliases.set('ECONOMY', 'ECONOMICS');
    aliases.set('ECO', 'ECONOMICS');
    return aliases;
  }

  function normalizedSkillMap(skills, skillDefinitions = []) {
    const aliases = buildSkillAliases(skillDefinitions);
    const map = new Map();
    for (const [name, rawLevel] of Object.entries(skills || {})) {
      const input = canonical(name);
      const key = aliases.get(input) || input;
      const level = Number(rawLevel || 0);
      map.set(key, Math.max(Number(map.get(key) || 0), Number.isFinite(level) ? level : 0));
    }
    return map;
  }

  function tribeSkillIndexes(resultTurn, skillDefinitions = []) {
    return (resultTurn?.units || [])
      .filter(unit => String(unit.unitType || '').toLowerCase() === 'tribe')
      .map(unit => ({ unitCode:unit.unitCode, skills:normalizedSkillMap(unit.skills, skillDefinitions) }));
  }

  function economicsLevel(unit, skillDefinitions = []) {
    const skills = normalizedSkillMap(unit?.skills || {}, skillDefinitions);
    return Number(skills.get('ECONOMICS') || 0);
  }

  function tradeEligibility(resultTurn, skillDefinitions = []) {
    const tribes = (resultTurn?.units || []).filter(unit => String(unit.unitType || '').toLowerCase() === 'tribe');
    const levels = tribes.map(unit => ({ unitCode:unit.unitCode, level:economicsLevel(unit, skillDefinitions) }));
    const best = levels.sort((a,b) => b.level - a.level || String(a.unitCode).localeCompare(String(b.unitCode)))[0] || { unitCode:null, level:0 };
    if (best.level >= 5) {
      return { status:'allowed', canTrade:true, level:best.level, unitCode:best.unitCode,
        message:`Fair trading is available: ${best.unitCode || 'a Tribe'} has Economics ${best.level}. Economics 5+ permits nomadic Fair trading.` };
    }
    if (best.level === 4) {
      return { status:'conditional', canTrade:null, level:best.level, unitCode:best.unitCode,
        message:`Fair trading is conditional: ${best.unitCode || 'a Tribe'} has Economics 4, which requires the Trading Post / Village arrangement.` };
    }
    return { status:'blocked', canTrade:false, level:best.level, unitCode:best.unitCode,
      message:`Fair trading is not currently unlocked by Economics. Highest Tribe level: ${best.level}. Economics 4 needs the Trading Post route; Economics 5 permits nomadic Fair trading.` };
  }

  function recipeSkillStatus(recipe, tribes, skillDefinitions = []) {
    const aliases = buildSkillAliases(skillDefinitions);
    const requirements = [
      { skill:recipe.primarySkill, level:Number(recipe.skillLevel || 0) },
      ...(recipe.requirements || []).map(row => ({ skill:row.skill, level:Number(row.level || 0) }))
    ].filter(row => row.skill);
    for (const tribe of tribes || []) {
      const skillMap = tribe.skills instanceof Map ? tribe.skills : normalizedSkillMap(tribe.skills, skillDefinitions);
      const missing = requirements.filter(req => {
        const key = aliases.get(canonical(req.skill)) || canonical(req.skill);
        return Number(skillMap.get(key) || 0) < Number(req.level || 0);
      });
      if (!missing.length) return { ok:true, unitCode:tribe.unitCode, missing:[] };
    }
    return { ok:false, unitCode:null, missing:requirements };
  }

  function recipeContextStatus(recipe) {
    const facilities = (recipe.facilities || []).filter(Boolean);
    const conditions = (recipe.conditions || []).filter(Boolean);
    if (facilities.length || conditions.length) {
      return { ok:false, facilities, conditions, message:'Facility or location prerequisites are not automatically verified.' };
    }
    return { ok:true, facilities:[], conditions:[], message:'' };
  }

  function recipesByOutput(recipes = []) {
    const map = new Map();
    for (const recipe of recipes || []) {
      const key = itemKey(recipe?.output?.item);
      if (!key) continue;
      const rows = map.get(key) || [];
      rows.push(recipe);
      map.set(key, rows);
    }
    return map;
  }

  function inventoryState(inventoryRows = []) {
    const stock = new Map();
    for (const row of inventoryRows || []) stock.set(row.key || itemKey(row.name), Number(row.quantity || 0));
    return { stock, origin:new Map(stock), ledger:new Map() };
  }

  function cloneState(state) {
    return { stock:new Map(state.stock), origin:new Map(state.origin), ledger:new Map(state.ledger) };
  }

  function consumeAvailable(key, quantity, state) {
    const available = Math.max(0, Number(state.stock.get(key) || 0));
    const use = Math.min(available, Math.max(0, Number(quantity || 0)));
    if (use <= 0) return 0;
    state.stock.set(key, available - use);
    const originAvailable = Math.max(0, Number(state.origin.get(key) || 0));
    const fromOrigin = Math.min(originAvailable, use);
    if (fromOrigin > 0) {
      state.origin.set(key, originAvailable - fromOrigin);
      state.ledger.set(key, Number(state.ledger.get(key) || 0) + fromOrigin);
    }
    return use;
  }

  function buildCraftContext(recipes, resultTurn, skillDefinitions) {
    return {
      recipeMap:recipesByOutput(recipes),
      tribes:tribeSkillIndexes(resultTurn, skillDefinitions),
      skillDefinitions
    };
  }

  function recipeUsable(recipe, context) {
    if (!recipe?.output?.item) return false;
    if (!(recipe.inputs || []).some(input => !input.optional && Number(input.quantity || 0) > 0)) return false;
    if (!recipeSkillStatus(recipe, context.tribes, context.skillDefinitions).ok) return false;
    if (!recipeContextStatus(recipe).ok) return false;
    return true;
  }

  function ensureSingleItem(key, quantity, state, context, stack) {
    const next = cloneState(state);
    let remaining = Math.max(0, Number(quantity || 0));
    remaining -= consumeAvailable(key, remaining, next);
    if (remaining <= 1e-9) return next;
    if (stack.has(key)) return null;

    const candidates = (context.recipeMap.get(key) || []).filter(recipe => recipeUsable(recipe, context));
    for (const recipe of candidates) {
      let attempt = cloneState(next);
      const nextStack = new Set(stack);
      nextStack.add(key);
      const outputQuantity = Math.max(1e-9, Number(recipe.output?.quantity || 1));
      const batches = Math.ceil(remaining / outputQuantity);
      let success = true;
      for (let i = 0; i < batches; i += 1) {
        attempt = craftRecipeBatch(recipe, attempt, context, nextStack, true);
        if (!attempt) { success = false; break; }
      }
      if (!success) continue;
      const completed = cloneState(attempt);
      const stillNeeded = Math.max(0, Number(quantity || 0) - (Number(state.stock.get(key) || 0) - Number(next.stock.get(key) || 0)));
      const consumed = consumeAvailable(key, stillNeeded, completed);
      if (consumed + 1e-9 >= stillNeeded) return completed;
    }
    return null;
  }

  function ensureInput(input, state, context, stack) {
    const quantity = Number(input.quantity || 0);
    if (input.optional || quantity <= 0) return cloneState(state);
    const options = itemOptions(input.item);
    for (const key of options) {
      const attempt = ensureSingleItem(key, quantity, state, context, stack);
      if (attempt) return attempt;
    }
    return null;
  }

  function craftRecipeBatch(recipe, state, context, stack = new Set(), addOutput = false) {
    let attempt = cloneState(state);
    for (const input of recipe.inputs || []) {
      if (input.optional) continue;
      attempt = ensureInput(input, attempt, context, stack);
      if (!attempt) return null;
    }
    if (addOutput) {
      const outKey = itemKey(recipe.output?.item);
      const qty = Number(recipe.output?.quantity || 1);
      attempt.stock.set(outKey, Number(attempt.stock.get(outKey) || 0) + qty);
    }
    return attempt;
  }

  function simulateRecipe(recipe, inventoryRows, context, batchCap = 1) {
    const skill = recipeSkillStatus(recipe, context.tribes, context.skillDefinitions);
    const contextStatus = recipeContextStatus(recipe);
    const hasInputs = (recipe.inputs || []).some(input => !input.optional && Number(input.quantity || 0) > 0);
    if (!skill.ok || !contextStatus.ok || !hasInputs) {
      return { batches:0, producedQuantity:0, ledger:new Map(), skill, contextStatus,
        reason:!skill.ok ? 'Required skills are not available on one Tribe.' : !contextStatus.ok ? contextStatus.message : 'No material-limited crafting recipe.' };
    }
    let state = inventoryState(inventoryRows);
    let batches = 0;
    const cap = Math.max(1, Math.min(10000, Number.isFinite(Number(batchCap)) ? Math.ceil(Number(batchCap)) : 10000));
    for (let i = 0; i < cap; i += 1) {
      const attempt = craftRecipeBatch(recipe, state, context, new Set([itemKey(recipe.output?.item)]), false);
      if (!attempt) break;
      state = attempt;
      batches += 1;
    }
    return {
      batches,
      producedQuantity:batches * Number(recipe.output?.quantity || 1),
      ledger:state.ledger,
      skill,
      contextStatus,
      reason:batches ? '' : 'Current combined holdings cannot supply one complete production chain.'
    };
  }

  function fairItemMap(snapshot) {
    const map = new Map();
    for (const item of snapshot?.items || []) map.set(itemKey(item.name), item);
    return map;
  }

  function valueLedger(ledger, snapshot) {
    const prices = fairItemMap(snapshot);
    let value = 0;
    const unpriced = [];
    const parts = [];
    for (const [key, quantity] of ledger || []) {
      const fair = prices.get(key);
      const price = fair && Number(fair.sellPrice) > 0 ? Number(fair.sellPrice) : null;
      if (price == null) unpriced.push(key);
      else value += quantity * price;
      parts.push({ key, quantity, unitValue:price, value:price == null ? null : quantity * price });
    }
    return { value, unpriced, parts, complete:unpriced.length === 0 };
  }

  function buildProfitRows({ recipes = [], resultTurn = null, skillDefinitions = [], snapshot = null } = {}) {
    if (!snapshot) return [];
    const inventory = aggregateInventory(resultTurn);
    const context = buildCraftContext(recipes, resultTurn, skillDefinitions);
    const fairItems = fairItemMap(snapshot);
    const candidates = [];

    for (const recipe of recipes || []) {
      const outputKey = itemKey(recipe?.output?.item);
      const fair = fairItems.get(outputKey);
      if (!fair || !(Number(fair.sellPrice) > 0)) continue;
      const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
      const fairLimit = Number(fair.sellQuantityLimit);
      const batchCap = Number.isFinite(fairLimit) && fairLimit > 0 ? Math.ceil(fairLimit / outputQty) : 10000;
      const sim = simulateRecipe(recipe, inventory, context, batchCap);
      const sellQty = sim.batches > 0
        ? Math.min(sim.producedQuantity, Number.isFinite(fairLimit) && fairLimit > 0 ? fairLimit : sim.producedQuantity)
        : 0;
      const inputValue = valueLedger(sim.ledger, snapshot);
      const revenue = sellQty * Number(fair.sellPrice || 0);
      const totalProfit = revenue - inputValue.value;
      candidates.push({
        key:outputKey,
        item:fair.name,
        recipeKey:recipe.key,
        recipeName:recipe.name,
        craftTribe:sim.skill.unitCode,
        craftableNow:sim.batches > 0,
        reason:sim.reason,
        sellPrice:Number(fair.sellPrice || 0),
        fairLimit:Number.isFinite(fairLimit) ? fairLimit : null,
        batches:sim.batches,
        producedQuantity:sim.producedQuantity,
        sellQuantity:sellQty,
        inputValue:inputValue.value,
        inputValueComplete:inputValue.complete,
        unpricedInputs:inputValue.unpriced,
        consumedInputs:inputValue.parts,
        revenue,
        profitEach:sellQty > 0 ? totalProfit / sellQty : null,
        totalProfit:sellQty > 0 ? totalProfit : null
      });
    }

    const best = new Map();
    for (const row of candidates) {
      const current = best.get(row.key);
      const score = row.craftableNow ? Number(row.totalProfit ?? -Infinity) : -Infinity;
      const currentScore = current?.craftableNow ? Number(current.totalProfit ?? -Infinity) : -Infinity;
      if (!current || score > currentScore || (!current.craftableNow && row.craftableNow)) best.set(row.key, row);
    }
    return [...best.values()].sort((a,b) => {
      if (a.craftableNow !== b.craftableNow) return a.craftableNow ? -1 : 1;
      return Number(b.totalProfit ?? -Infinity) - Number(a.totalProfit ?? -Infinity) || a.item.localeCompare(b.item);
    });
  }

  function nextFairSnapshot(current, snapshots = []) {
    if (!current) return null;
    const ordered = [...snapshots].sort((a,b) => Number(a.turnSort || 0) - Number(b.turnSort || 0));
    const index = ordered.findIndex(row => row.turnKey === current.turnKey);
    return index >= 0 ? ordered[index + 1] || null : null;
  }

  function cheapestPurchasableOption(input, fairMap) {
    const quantity = Number(input.quantity || 0);
    const options = itemOptions(input.item)
      .map(key => ({ key, fair:fairMap.get(key) }))
      .filter(row => row.fair && Number(row.fair.purchasePrice) > 0)
      .map(row => ({
        key:row.key,
        name:row.fair.name,
        quantity,
        unitPrice:Number(row.fair.purchasePrice),
        cost:quantity * Number(row.fair.purchasePrice),
        limit:Number(row.fair.purchaseQuantityLimit)
      }))
      .sort((a,b) => a.cost - b.cost);
    return options[0] || null;
  }

  function buildPurchaseToCraftRows({ recipes = [], resultTurn = null, skillDefinitions = [], snapshot = null, snapshots = [] } = {}) {
    if (!snapshot) return [];
    const context = buildCraftContext(recipes, resultTurn, skillDefinitions);
    const currentMap = fairItemMap(snapshot);
    const actualNext = nextFairSnapshot(snapshot, snapshots);
    const nextMap = fairItemMap(actualNext || snapshot);
    const candidates = [];

    for (const recipe of recipes || []) {
      const outputKey = itemKey(recipe?.output?.item);
      const outputFair = nextMap.get(outputKey);
      const currentOutputFair = currentMap.get(outputKey);
      if (!outputFair || !(Number(outputFair.sellPrice) > 0)) continue;
      const skill = recipeSkillStatus(recipe, context.tribes, skillDefinitions);
      const contextStatus = recipeContextStatus(recipe);
      const inputs = (recipe.inputs || []).filter(input => !input.optional && Number(input.quantity || 0) > 0);
      if (!skill.ok || !contextStatus.ok || !inputs.length) continue;

      const purchases = [];
      let valid = true;
      let maxBatches = Infinity;
      for (const input of inputs) {
        const choice = cheapestPurchasableOption(input, currentMap);
        if (!choice) { valid = false; break; }
        purchases.push(choice);
        if (Number.isFinite(choice.limit) && choice.limit >= 0) {
          maxBatches = Math.min(maxBatches, choice.quantity > 0 ? Math.floor(choice.limit / choice.quantity) : Infinity);
        }
      }
      if (!valid) continue;
      const distinctTrades = new Set(purchases.map(row => row.key)).size;
      if (distinctTrades > Number(snapshot.maxTransactions || 10)) continue;

      const outputQty = Number(recipe.output?.quantity || 1);
      const nextLimit = Number(outputFair.sellQuantityLimit);
      if (Number.isFinite(nextLimit) && nextLimit > 0) maxBatches = Math.min(maxBatches, Math.floor(nextLimit / outputQty));
      if (!Number.isFinite(maxBatches)) maxBatches = null;
      else maxBatches = Math.max(0, maxBatches);

      const purchaseCost = purchases.reduce((sum,row) => sum + row.cost, 0);
      const grossSale = outputQty * Number(outputFair.sellPrice || 0);
      const profitPerBatch = grossSale - purchaseCost;
      candidates.push({
        key:outputKey,
        item:outputFair.name || currentOutputFair?.name || recipe.output.item,
        recipeKey:recipe.key,
        recipeName:recipe.name,
        craftTribe:skill.unitCode,
        purchases,
        currentFairCost:purchaseCost,
        outputQuantity:outputQty,
        nextSellPrice:Number(outputFair.sellPrice || 0),
        valuation:actualNext ? 'actual' : 'estimated',
        valuationTurn:actualNext?.turnKey || null,
        grossSale,
        profitPerBatch,
        roi:purchaseCost > 0 ? profitPerBatch / purchaseCost : null,
        maxBatches,
        maxProfit:maxBatches == null ? null : profitPerBatch * maxBatches,
        currentFairTradesNeeded:distinctTrades
      });
    }

    const best = new Map();
    for (const row of candidates) {
      const current = best.get(row.key);
      if (!current || row.profitPerBatch > current.profitPerBatch) best.set(row.key, row);
    }
    return [...best.values()].sort((a,b) => b.profitPerBatch - a.profitPerBatch || a.item.localeCompare(b.item));
  }

  function compareFairItems(current, previous) {
    if (!current) return [];
    const previousMap = fairItemMap(previous);
    return (current.items || []).map(item => {
      const old = previousMap.get(itemKey(item.name));
      const sellPrice = Number(item.sellPrice || 0);
      const oldSell = old == null ? null : Number(old.sellPrice || 0);
      const purchasePrice = Number(item.purchasePrice || 0);
      const oldPurchase = old == null ? null : Number(old.purchasePrice || 0);
      return {
        key:itemKey(item.name), name:item.name,
        sellPrice, oldSellPrice:oldSell,
        sellDelta:oldSell == null ? null : sellPrice - oldSell,
        sellDeltaPct:oldSell > 0 ? ((sellPrice - oldSell) / oldSell) * 100 : null,
        purchasePrice, oldPurchasePrice:oldPurchase,
        purchaseDelta:oldPurchase == null ? null : purchasePrice - oldPurchase,
        purchaseDeltaPct:oldPurchase > 0 ? ((purchasePrice - oldPurchase) / oldPurchase) * 100 : null
      };
    }).sort((a,b) => Math.abs(Number(b.sellDeltaPct || 0)) - Math.abs(Number(a.sellDeltaPct || 0)) || a.name.localeCompare(b.name));
  }

  function selectTopTrades(rows, excludedKeys = new Set(), limit = 10) {
    const available = (rows || []).filter(row => row.craftableNow && !excludedKeys.has(row.key) && row.totalProfit != null);
    const selected = [...available].sort((a,b) => Number(b.totalProfit) - Number(a.totalProfit)).slice(0, Math.max(0, Number(limit || 0)));
    return { selected, totalProfit:selected.reduce((sum,row) => sum + Number(row.totalProfit || 0), 0) };
  }

  return {
    canonical, itemKey, itemOptions, rootTribe, aggregateInventory, buildSkillAliases, normalizedSkillMap,
    tribeSkillIndexes, economicsLevel, tradeEligibility, recipeSkillStatus, recipeContextStatus, recipesByOutput,
    buildCraftContext, simulateRecipe, fairItemMap, valueLedger, buildProfitRows, nextFairSnapshot,
    buildPurchaseToCraftRows, compareFairItems, selectTopTrades
  };
});

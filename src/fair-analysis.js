(function (root, factory) {
  const api = factory(root?.TribeNetFairCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis, core => {
  const itemKey = value => core ? core.itemKey(value) : String(value || '').trim().toUpperCase();

  function recipeRequirements(recipe) {
    return [
      { skill:recipe?.primarySkill, level:Number(recipe?.skillLevel || 0) },
      ...(recipe?.requirements || []).map(row => ({ skill:row.skill, level:Number(row.level || 0) }))
    ].filter(row => row.skill && row.level > 0);
  }

  function bestSkillGap(recipe, resultTurn, skillDefinitions = []) {
    const requirements = recipeRequirements(recipe);
    if (!requirements.length) return { ok:true, unitCode:null, skillUpsNeeded:0, maxGap:0, missing:[] };
    const aliases = core.buildSkillAliases(skillDefinitions);
    const tribes = (resultTurn?.units || []).filter(unit => String(unit.unitType || '').toLowerCase() === 'tribe');
    if (!tribes.length) return {
      ok:false, unitCode:null, skillUpsNeeded:null, maxGap:null,
      missing:requirements.map(req => ({ ...req, current:null, gap:null }))
    };

    let best = null;
    for (const tribe of tribes) {
      const skills = core.normalizedSkillMap(tribe.skills || {}, skillDefinitions);
      const missing = requirements.map(req => {
        const canonical = core.canonical(req.skill);
        const key = aliases.get(canonical) || canonical;
        const current = Number(skills.get(key) || 0);
        return { skill:req.skill, required:req.level, current, gap:Math.max(0, req.level - current) };
      }).filter(row => row.gap > 0);
      const skillUpsNeeded = missing.reduce((sum,row) => sum + row.gap, 0);
      const maxGap = missing.reduce((max,row) => Math.max(max, row.gap), 0);
      const candidate = { ok:skillUpsNeeded === 0, unitCode:tribe.unitCode, skillUpsNeeded, maxGap, missing };
      if (!best || candidate.skillUpsNeeded < best.skillUpsNeeded ||
          (candidate.skillUpsNeeded === best.skillUpsNeeded && candidate.maxGap < best.maxGap)) best = candidate;
    }
    return best;
  }

  function recipeMap(recipes = []) {
    const map = new Map();
    for (const recipe of recipes) {
      const key = itemKey(recipe?.output?.item);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(recipe);
    }
    return map;
  }

  function stockState(inventory = []) {
    const stock = new Map();
    for (const row of inventory) stock.set(row.key || itemKey(row.name), Number(row.quantity || 0));
    return { stock, origin:new Map(stock), ledger:new Map() };
  }

  function cloneState(state) {
    return { stock:new Map(state.stock), origin:new Map(state.origin), ledger:new Map(state.ledger) };
  }

  function consumeStock(key, quantity, state) {
    const available = Math.max(0, Number(state.stock.get(key) || 0));
    const used = Math.min(available, Math.max(0, Number(quantity || 0)));
    if (used <= 0) return 0;
    state.stock.set(key, available - used);
    const original = Math.max(0, Number(state.origin.get(key) || 0));
    const fromOriginal = Math.min(original, used);
    if (fromOriginal > 0) {
      state.origin.set(key, original - fromOriginal);
      state.ledger.set(key, Number(state.ledger.get(key) || 0) + fromOriginal);
    }
    return used;
  }

  function validMaterialRecipe(recipe) {
    if (!recipe?.output?.item) return false;
    if ((recipe.facilities || []).length || (recipe.conditions || []).length) return false;
    return (recipe.inputs || []).some(input => !input.optional && Number(input.quantity || 0) > 0);
  }

  function ensureItem(key, quantity, state, recipesByOutput, stack = new Set()) {
    let attempt = cloneState(state);
    let remaining = Math.max(0, Number(quantity || 0));
    remaining -= consumeStock(key, remaining, attempt);
    if (remaining <= 1e-9) return attempt;
    if (stack.has(key)) return null;

    for (const recipe of (recipesByOutput.get(key) || []).filter(validMaterialRecipe)) {
      let candidate = cloneState(attempt);
      const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
      const batches = Math.ceil(remaining / outputQty);
      const nextStack = new Set(stack); nextStack.add(key);
      let ok = true;
      for (let batch = 0; batch < batches && ok; batch += 1) {
        for (const input of recipe.inputs || []) {
          if (input.optional || Number(input.quantity || 0) <= 0) continue;
          let fulfilled = null;
          for (const option of core.itemOptions(input.item)) {
            fulfilled = ensureItem(option, Number(input.quantity), candidate, recipesByOutput, nextStack);
            if (fulfilled) break;
          }
          if (!fulfilled) { ok = false; break; }
          candidate = fulfilled;
        }
        if (ok) candidate.stock.set(key, Number(candidate.stock.get(key) || 0) + outputQty);
      }
      if (!ok) continue;
      if (consumeStock(key, remaining, candidate) + 1e-9 >= remaining) return candidate;
    }
    return null;
  }

  function simulateMaterials(recipe, inventory, recipesByOutput, batchCap = 1) {
    const contextBlocked = (recipe.facilities || []).length || (recipe.conditions || []).length;
    const inputs = (recipe.inputs || []).filter(input => !input.optional && Number(input.quantity || 0) > 0);
    if (!inputs.length) return { batches:0, producedQuantity:0, ledger:new Map(), contextBlocked:false, reason:'No material-limited crafting recipe.' };
    let state = stockState(inventory);
    let batches = 0;
    const cap = Math.max(1, Math.min(10000, Number.isFinite(Number(batchCap)) ? Math.ceil(Number(batchCap)) : 10000));
    for (let batch = 0; batch < cap; batch += 1) {
      let attempt = cloneState(state);
      let ok = true;
      for (const input of inputs) {
        let fulfilled = null;
        for (const option of core.itemOptions(input.item)) {
          fulfilled = ensureItem(option, Number(input.quantity), attempt, recipesByOutput, new Set([itemKey(recipe.output?.item)]));
          if (fulfilled) break;
        }
        if (!fulfilled) { ok = false; break; }
        attempt = fulfilled;
      }
      if (!ok) break;
      state = attempt; batches += 1;
    }
    return {
      batches,
      producedQuantity:batches * Number(recipe.output?.quantity || 1),
      ledger:state.ledger,
      contextBlocked:Boolean(contextBlocked),
      reason:batches ? (contextBlocked ? 'Materials are available, but facility/location prerequisites still need checking.' : '') : 'Current combined holdings cannot supply one complete production chain.'
    };
  }

  function buildProfitRows({ recipes = [], resultTurn = null, skillDefinitions = [], snapshot = null } = {}) {
    if (!snapshot) return [];
    const inventory = core.aggregateInventory(resultTurn);
    const recipesByOutput = recipeMap(recipes);
    const fairItems = core.fairItemMap(snapshot);
    const candidates = [];

    for (const recipe of recipes) {
      const key = itemKey(recipe?.output?.item);
      const fair = fairItems.get(key);
      if (!fair || !(Number(fair.sellPrice) > 0)) continue;
      const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
      const fairLimit = Number(fair.sellQuantityLimit);
      const batchCap = Number.isFinite(fairLimit) && fairLimit > 0 ? Math.ceil(fairLimit / outputQty) : 10000;
      const material = simulateMaterials(recipe, inventory, recipesByOutput, batchCap);
      const skill = bestSkillGap(recipe, resultTurn, skillDefinitions);
      const sellQty = material.batches > 0
        ? Math.min(material.producedQuantity, Number.isFinite(fairLimit) && fairLimit > 0 ? fairLimit : material.producedQuantity)
        : 0;
      const inputValue = core.valueLedger(material.ledger, snapshot);
      const revenue = sellQty * Number(fair.sellPrice || 0);
      const totalProfit = sellQty > 0 ? revenue - inputValue.value : null;
      const craftableNow = sellQty > 0 && skill.ok && !material.contextBlocked;
      candidates.push({
        key, item:fair.name, recipeKey:recipe.key, recipeName:recipe.name,
        craftTribe:skill.unitCode, craftableNow, skillUpsNeeded:skill.skillUpsNeeded,
        maxSkillGap:skill.maxGap, missingSkills:skill.missing, contextBlocked:material.contextBlocked,
        reason:craftableNow ? '' : material.reason || (skill.ok ? '' : 'Required skill levels are not yet available.'),
        sellPrice:Number(fair.sellPrice || 0), fairLimit:Number.isFinite(fairLimit) ? fairLimit : null,
        batches:material.batches, producedQuantity:material.producedQuantity, sellQuantity:sellQty,
        inputValue:inputValue.value, inputValueComplete:inputValue.complete, unpricedInputs:inputValue.unpriced,
        consumedInputs:inputValue.parts, revenue,
        profitEach:sellQty > 0 && totalProfit != null ? totalProfit / sellQty : null,
        totalProfit
      });
    }

    const best = new Map();
    for (const row of candidates) {
      const current = best.get(row.key);
      const score = Number(row.totalProfit ?? -Infinity);
      const currentScore = Number(current?.totalProfit ?? -Infinity);
      const gap = row.skillUpsNeeded == null ? Infinity : row.skillUpsNeeded;
      const currentGap = current?.skillUpsNeeded == null ? Infinity : current.skillUpsNeeded;
      if (!current || score > currentScore || (score === currentScore && gap < currentGap)) best.set(row.key, row);
    }
    return [...best.values()];
  }

  function sortRows(rows, field, direction = 'desc') {
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...(rows || [])].sort((a,b) => {
      const av = typeof field === 'function' ? field(a) : a?.[field];
      const bv = typeof field === 'function' ? field(b) : b?.[field];
      const aMissing = av == null || Number.isNaN(av);
      const bMissing = bv == null || Number.isNaN(bv);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (typeof av === 'number' || typeof bv === 'number') return (Number(av) - Number(bv)) * multiplier;
      return String(av ?? '').localeCompare(String(bv ?? '')) * multiplier;
    });
  }

  function skillGapLabel(row) {
    if (row.skillUpsNeeded == null) return 'Skills unknown';
    if (row.skillUpsNeeded === 0) return 'Current skills';
    return `${row.skillUpsNeeded} skillup${row.skillUpsNeeded === 1 ? '' : 's'} needed`;
  }

  return { recipeRequirements, bestSkillGap, buildProfitRows, sortRows, skillGapLabel };
});

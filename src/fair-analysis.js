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
      missing:requirements.map(req => ({ skill:req.skill, required:req.level, current:null, gap:null }))
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

  function materialInputs(recipe) {
    return (recipe?.inputs || []).filter(input => !input.optional && Number(input.quantity || 0) > 0);
  }

  function contextWarnings(recipe) {
    return [
      ...(recipe?.facilities || []).map(value => `Facility: ${value}`),
      ...(recipe?.conditions || []).map(value => `Condition: ${value}`)
    ];
  }

  function combineRequirements(rows = []) {
    const map = new Map();
    for (const row of rows) {
      const key = row.key || itemKey(row.name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { ...row, key, quantity:0, routes:new Set() });
      const current = map.get(key);
      current.quantity += Number(row.quantity || 0);
      if (row.sourceRecipe) current.routes.add(row.sourceRecipe);
      for (const route of row.routes || []) current.routes.add(route);
      if (row.sourceAvailable === false) current.sourceAvailable = false;
      if (row.sourceAvailable === true && current.sourceAvailable !== false) current.sourceAvailable = true;
      if (!current.name && row.name) current.name = row.name;
      if (!current.sourceSkill && row.sourceSkill) current.sourceSkill = row.sourceSkill;
      if (!current.sourceOutputQty && row.sourceOutputQty) current.sourceOutputQty = row.sourceOutputQty;
      current.warnings = [...new Set([...(current.warnings || []), ...(row.warnings || [])])];
    }
    return [...map.values()].map(row => ({ ...row, routes:[...row.routes] }));
  }

  function chooseBetterPlan(current, candidate) {
    if (!candidate) return current;
    if (!current) return candidate;
    if (candidate.sourceAvailable !== current.sourceAvailable) return candidate.sourceAvailable ? candidate : current;
    const candidateGap = candidate.skillUpsNeeded == null ? Infinity : candidate.skillUpsNeeded;
    const currentGap = current.skillUpsNeeded == null ? Infinity : current.skillUpsNeeded;
    if (candidateGap !== currentGap) return candidateGap < currentGap ? candidate : current;
    if (candidate.unknownSources !== current.unknownSources) return candidate.unknownSources < current.unknownSources ? candidate : current;
    return candidate.requirements.length < current.requirements.length ? candidate : current;
  }

  function sourcePlanForItem(item, quantity, context, stack = new Set()) {
    const requested = Math.max(0, Number(quantity || 0));
    const keys = core.itemOptions(item);
    let best = null;
    for (const key of keys) {
      if (!key || stack.has(key)) continue;
      const candidates = context.recipesByOutput.get(key) || [];
      const nextStack = new Set(stack); nextStack.add(key);

      // A no-material production recipe is a source: Forestry -> Logs, Mining -> ore, etc.
      for (const recipe of candidates.filter(row => materialInputs(row).length === 0)) {
        const skill = bestSkillGap(recipe, context.resultTurn, context.skillDefinitions);
        const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
        const plan = {
          sourceAvailable:true,
          unknownSources:0,
          skillUpsNeeded:skill.skillUpsNeeded,
          missingSkills:skill.missing || [],
          warnings:contextWarnings(recipe),
          requirements:[{
            key,
            name:recipe.output?.item || item,
            quantity:requested,
            sourceAvailable:true,
            sourceRecipe:recipe.name,
            sourceSkill:recipe.primarySkill || null,
            sourceOutputQty:outputQty,
            sourceBatches:Math.ceil(requested / outputQty),
            warnings:contextWarnings(recipe)
          }]
        };
        best = chooseBetterPlan(best, plan);
      }

      // Otherwise recursively reduce manufactured inputs to their known sources.
      for (const recipe of candidates.filter(row => materialInputs(row).length > 0)) {
        const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
        const batches = Math.ceil(requested / outputQty);
        const skill = bestSkillGap(recipe, context.resultTurn, context.skillDefinitions);
        const requirementRows = [];
        const missingSkills = [...(skill.missing || [])];
        const warnings = [...contextWarnings(recipe)];
        let sourceAvailable = true;
        let unknownSources = 0;
        let skillUpsNeeded = skill.skillUpsNeeded == null ? null : Number(skill.skillUpsNeeded || 0);

        for (const input of materialInputs(recipe)) {
          const child = sourcePlanForItem(input.item, Number(input.quantity) * batches, context, nextStack);
          if (!child) {
            sourceAvailable = false;
            unknownSources += 1;
            requirementRows.push({ key:itemKey(input.item), name:input.item, quantity:Number(input.quantity) * batches, sourceAvailable:false, warnings:[] });
            continue;
          }
          sourceAvailable = sourceAvailable && child.sourceAvailable;
          unknownSources += Number(child.unknownSources || 0);
          requirementRows.push(...child.requirements);
          missingSkills.push(...(child.missingSkills || []));
          warnings.push(...(child.warnings || []));
          if (skillUpsNeeded == null || child.skillUpsNeeded == null) skillUpsNeeded = null;
          else skillUpsNeeded += Number(child.skillUpsNeeded || 0);
        }

        best = chooseBetterPlan(best, {
          sourceAvailable,
          unknownSources,
          skillUpsNeeded,
          missingSkills,
          warnings:[...new Set(warnings)],
          requirements:combineRequirements(requirementRows)
        });
      }

      // If the Compendium has no way to create it, expose it as an unresolved source requirement.
      if (!candidates.length) {
        best = chooseBetterPlan(best, {
          sourceAvailable:false,
          unknownSources:1,
          skillUpsNeeded:0,
          missingSkills:[], warnings:[],
          requirements:[{ key, name:item, quantity:requested, sourceAvailable:false, warnings:[] }]
        });
      }
    }
    return best;
  }

  function valueRequirements(requirements, snapshot) {
    const prices = core.fairItemMap(snapshot);
    let value = 0;
    const unpriced = [];
    const parts = [];
    for (const requirement of requirements || []) {
      const fair = prices.get(requirement.key || itemKey(requirement.name));
      const price = fair && Number(fair.sellPrice) > 0 ? Number(fair.sellPrice) : null;
      if (price == null) unpriced.push(requirement.key || itemKey(requirement.name));
      else value += Number(requirement.quantity || 0) * price;
      parts.push({
        ...requirement,
        unitValue:price,
        value:price == null ? null : Number(requirement.quantity || 0) * price
      });
    }
    return { value, unpriced, parts, complete:unpriced.length === 0 };
  }

  function buildProfitRows({ recipes = [], resultTurn = null, skillDefinitions = [], snapshot = null } = {}) {
    if (!snapshot) return [];
    const recipesByOutput = recipeMap(recipes);
    const fairItems = core.fairItemMap(snapshot);
    const context = { recipesByOutput, resultTurn, skillDefinitions };
    const candidates = [];

    for (const recipe of recipes) {
      const key = itemKey(recipe?.output?.item);
      const fair = fairItems.get(key);
      if (!fair || !(Number(fair.sellPrice) > 0)) continue;
      const directInputs = materialInputs(recipe);
      if (!directInputs.length) continue;

      const outputQty = Math.max(1e-9, Number(recipe.output?.quantity || 1));
      const fairLimitRaw = Number(fair.sellQuantityLimit);
      const sellQuantity = Number.isFinite(fairLimitRaw) && fairLimitRaw > 0 ? fairLimitRaw : outputQty;
      const batches = Math.ceil(sellQuantity / outputQty);
      const rootSkill = bestSkillGap(recipe, resultTurn, skillDefinitions);
      const requirementRows = [];
      const missingSkills = [...(rootSkill.missing || [])];
      const warnings = [...contextWarnings(recipe)];
      let sourceAvailable = true;
      let unknownSources = 0;
      let skillUpsNeeded = rootSkill.skillUpsNeeded == null ? null : Number(rootSkill.skillUpsNeeded || 0);

      for (const input of directInputs) {
        const child = sourcePlanForItem(input.item, Number(input.quantity) * batches, context, new Set([key]));
        if (!child) {
          sourceAvailable = false;
          unknownSources += 1;
          requirementRows.push({ key:itemKey(input.item), name:input.item, quantity:Number(input.quantity) * batches, sourceAvailable:false, warnings:[] });
          continue;
        }
        sourceAvailable = sourceAvailable && child.sourceAvailable;
        unknownSources += Number(child.unknownSources || 0);
        requirementRows.push(...child.requirements);
        missingSkills.push(...(child.missingSkills || []));
        warnings.push(...(child.warnings || []));
        if (skillUpsNeeded == null || child.skillUpsNeeded == null) skillUpsNeeded = null;
        else skillUpsNeeded += Number(child.skillUpsNeeded || 0);
      }

      const plannedInputs = combineRequirements(requirementRows);
      const inputValue = valueRequirements(plannedInputs, snapshot);
      const revenue = sellQuantity * Number(fair.sellPrice || 0);
      const totalProfit = revenue - inputValue.value;
      const readyNow = sourceAvailable && Number(skillUpsNeeded || 0) === 0;
      const unresolved = plannedInputs.filter(row => row.sourceAvailable === false).map(row => row.name || row.key);
      const reasonParts = [];
      if (unresolved.length) reasonParts.push(`No production source modelled for: ${unresolved.join(', ')}`);
      if (skillUpsNeeded > 0) reasonParts.push(`${skillUpsNeeded} skillup${skillUpsNeeded === 1 ? '' : 's'} needed across the production chain`);
      if (warnings.length) reasonParts.push('Check listed facility/location conditions');

      candidates.push({
        key, item:fair.name, recipeKey:recipe.key, recipeName:recipe.name,
        craftTribe:rootSkill.unitCode, craftableNow:readyNow, sourceAvailable,
        skillUpsNeeded, maxSkillGap:rootSkill.maxGap, missingSkills,
        contextBlocked:warnings.length > 0, contextWarnings:[...new Set(warnings)],
        reason:reasonParts.join('. '),
        sellPrice:Number(fair.sellPrice || 0), fairLimit:Number.isFinite(fairLimitRaw) ? fairLimitRaw : null,
        batches, producedQuantity:batches * outputQty, sellQuantity,
        inputValue:inputValue.value, inputValueComplete:inputValue.complete, unpricedInputs:inputValue.unpriced,
        consumedInputs:inputValue.parts, plannedInputs:inputValue.parts,
        revenue,
        profitEach:sellQuantity > 0 ? totalProfit / sellQuantity : null,
        totalProfit:sellQuantity > 0 ? totalProfit : null,
        unknownSources
      });
    }

    const best = new Map();
    for (const row of candidates) {
      const current = best.get(row.key);
      const score = Number(row.totalProfit ?? -Infinity);
      const currentScore = Number(current?.totalProfit ?? -Infinity);
      const availableScore = row.sourceAvailable ? 1 : 0;
      const currentAvailableScore = current?.sourceAvailable ? 1 : 0;
      const gap = row.skillUpsNeeded == null ? Infinity : row.skillUpsNeeded;
      const currentGap = current?.skillUpsNeeded == null ? Infinity : current.skillUpsNeeded;
      if (!current || availableScore > currentAvailableScore ||
          (availableScore === currentAvailableScore && score > currentScore) ||
          (availableScore === currentAvailableScore && score === currentScore && gap < currentGap)) best.set(row.key, row);
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

  return { recipeRequirements, bestSkillGap, buildProfitRows, sortRows, skillGapLabel, sourcePlanForItem, valueRequirements };
});

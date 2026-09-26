function canonicalItem(value) {
  return String(value || '').trim().toUpperCase();
}

function postTransferAnimalCounts(plan) {
  const counts = new Map();

  for (const row of plan.clan || []) {
    counts.set(String(row.unit), {
      cattle: Number(row.cattle || 0),
      horse: Number(row.horse || 0),
      elephant: Number(row.elephant || 0)
    });
  }

  const ensure = unit => {
    const key = String(unit);
    if (!counts.has(key)) counts.set(key, { cattle: 0, horse: 0, elephant: 0 });
    return counts.get(key);
  };

  for (const transfer of plan.transfers || []) {
    if (String(transfer.timing || '').toUpperCase() !== 'BM') continue;
    const qty = Number(transfer.quantity || 0);
    if (!qty) continue;

    const item = canonicalItem(transfer.item);
    let field = null;
    if (item === 'CATTLE') field = 'cattle';
    else if (item === 'HORSE' || item === 'HORSES') field = 'horse';
    else if (item === 'ELEPHANT' || item === 'ELEPHANTS') field = 'elephant';
    if (!field) continue;

    const from = ensure(transfer.from);
    const to = ensure(transfer.to);
    from[field] = Math.max(0, Number(from[field] || 0) - qty);
    to[field] = Math.max(0, Number(to[field] || 0) + qty);
  }

  return counts;
}

function applyWagonAnimalRules(plan) {
  if (!plan || !Array.isArray(plan.unitStats)) return plan;

  const counts = postTransferAnimalCounts(plan);

  for (const stats of plan.unitStats) {
    const animals = counts.get(String(stats.unit)) || {
      cattle: Number(stats.cattleCount || 0),
      horse: Number(stats.horseCount || 0),
      elephant: Number(stats.elephantCount || 0)
    };

    const wagons = Math.max(0, Number(stats.wagonCount || 0));
    const cattle = Math.max(0, Number(animals.cattle || 0));
    const horses = Math.max(0, Number(animals.horse || 0));
    const elephants = Math.max(0, Number(animals.elephant || 0));

    // Explicit Mandate Woodwork rule: each wagon needs either 2 Cattle/Horses to pull it,
    // or 1 Elephant to carry it. For ordinary draft animals, Cattle are allocated before Horses.
    // Elephants are used for wagons first because they are a distinct "carry" alternative and preserve
    // ordinary draft/pack animals. We expose the allocation in the UI so the assumption is visible.
    const elephantsCarryingWagons = Math.min(elephants, wagons);
    const wagonsNeedingDraftAnimals = Math.max(0, wagons - elephantsCarryingWagons);
    const draftAnimalsNeeded = wagonsNeedingDraftAnimals * 2;
    const cattlePulling = Math.min(cattle, draftAnimalsNeeded);
    const horsePulling = Math.min(horses, Math.max(0, draftAnimalsNeeded - cattlePulling));
    const draftShortage = Math.max(0, draftAnimalsNeeded - cattlePulling - horsePulling);
    const loadHorses = Math.max(0, horses - horsePulling);

    const totalPeople = Math.max(0, Number(stats.totalPeople || 0));
    // Wagons carried by Elephants do not prevent mounted movement. Wagons pulled by Cattle/Horses do.
    const fullyMounted = wagonsNeedingDraftAnimals === 0 && totalPeople > 0 && loadHorses >= totalPeople;
    const riddenHorseCount = fullyMounted ? Math.min(totalPeople, loadHorses) : 0;
    const packHorseCount = Math.max(0, loadHorses - riddenHorseCount);

    const peopleCapacity = fullyMounted ? 0 : totalPeople * 30;
    const riddenHorseCapacity = riddenHorseCount * 100;
    const packHorseCapacity = packHorseCount * 300;
    const wagonGrossCapacity = wagons * 3000; // 1000 lb wagon weight + 2000 lb net cargo = 3000 lb gross CC.

    let carryingCapacity = peopleCapacity + riddenHorseCapacity + packHorseCapacity + wagonGrossCapacity;

    const backpacks = Math.max(0, Number(stats.backpacks || 0));
    const backpackEligible = fullyMounted ? 0 : Math.max(0, Number(stats.warrior || 0) + Number(stats.active || 0));
    const backpacksUsed = Math.min(backpacks, backpackEligible);
    const backpackGrossCapacity = backpacksUsed * 32; // 2 lb item + 30 lb net capacity.
    carryingCapacity += backpackGrossCapacity;

    const saddlebags = Math.max(0, Number(stats.saddlebags || 0));
    const camelCount = Math.max(0, Number(stats.camelCount || 0));
    const saddlebagEligible = Math.max(0, loadHorses + camelCount);
    const saddlebagsUsed = Math.min(saddlebags, saddlebagEligible);
    const saddlebagGrossCapacity = saddlebagsUsed * 104; // 4 lb item + 100 lb net capacity.
    carryingCapacity += saddlebagGrossCapacity;

    const capacityBreakdown = [];
    if (fullyMounted) {
      capacityBreakdown.push({ label: 'Ridden horses', quantity: riddenHorseCount, perUnit: 100, total: riddenHorseCapacity, note: 'Rider capacity is not added separately when fully mounted.' });
    } else {
      capacityBreakdown.push({ label: 'People on foot', quantity: totalPeople, perUnit: 30, total: peopleCapacity });
    }
    capacityBreakdown.push({ label: 'Pack horses', quantity: packHorseCount, perUnit: 300, total: packHorseCapacity, note: horsePulling ? `${horsePulling} horse${horsePulling === 1 ? '' : 's'} are pulling wagons and add no pack capacity.` : null });
    capacityBreakdown.push({ label: 'Wagons', quantity: wagons, perUnit: 3000, total: wagonGrossCapacity, note: 'Gross CC: each wagon weighs 1,000 lb and adds 2,000 lb net cargo capacity.' });
    if (backpacksUsed || backpacks) capacityBreakdown.push({ label: 'Backpacks in use', quantity: backpacksUsed, perUnit: 32, total: backpackGrossCapacity, note: 'Each weighs 2 lb and adds 30 lb net capacity.' });
    if (saddlebagsUsed || saddlebags) capacityBreakdown.push({ label: 'Saddlebags in use', quantity: saddlebagsUsed, perUnit: 104, total: saddlebagGrossCapacity, note: 'Each weighs 4 lb and adds 100 lb net capacity.' });

    const carriedWeight = Number(stats.carriedWeight || 0);
    const loadPercent = carryingCapacity > 0 ? (carriedWeight / carryingCapacity) * 100 : null;

    const preservedWarnings = (Array.isArray(stats.warnings) ? stats.warnings : []).filter(warning =>
      !String(warning).startsWith('Movement blocked:') &&
      !String(warning).startsWith('Over capacity by')
    );
    const warnings = [];
    if (draftShortage > 0) {
      const supported = cattlePulling + horsePulling;
      warnings.push(`Movement blocked: ${wagonsNeedingDraftAnimals} wagon${wagonsNeedingDraftAnimals === 1 ? '' : 's'} need ${draftAnimalsNeeded} Cattle/Horses; only ${supported} are available after ${elephantsCarryingWagons} wagon${elephantsCarryingWagons === 1 ? '' : 's'} are carried by Elephants.`);
    }
    if (carryingCapacity > 0 && carriedWeight > carryingCapacity) {
      warnings.push(`Over capacity by ${Math.round(carriedWeight - carryingCapacity).toLocaleString()} lb.`);
    }
    warnings.push(...preservedWarnings);

    Object.assign(stats, {
      horseCount: horses,
      cattleCount: cattle,
      elephantCount: elephants,
      elephantsCarryingWagons,
      wagonsNeedingDraftAnimals,
      horsePulling,
      cattlePulling,
      draftAnimalsNeeded,
      draftShortage,
      fullyMounted,
      riddenHorseCount,
      packHorseCount,
      backpacksUsed,
      saddlebagsUsed,
      carryingCapacity,
      capacityBreakdown,
      loadPercent,
      warnings,
      calculationBasis: `${stats.calculationBasis || 'Starting workbook inventory plus BM transfers.'} Wagon rule: 1 wagon = 2 Cattle/Horses to pull, or 1 Elephant to carry; Cattle are allocated before Horses.`
    });
  }

  return plan;
}

module.exports = { applyWagonAnimalRules };

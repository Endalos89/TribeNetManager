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

    // A wagon needs either two Cattle/Horses to pull it, or one Elephant to carry it.
    // Elephants are used to carry wagons first because this preserves ordinary draft/pack animals.
    // For the remaining wagons, Cattle are allocated before Horses.
    const elephantsCarryingWagons = Math.min(elephants, wagons);
    const wagonsNeedingDraftAnimals = Math.max(0, wagons - elephantsCarryingWagons);
    const draftAnimalsNeeded = wagonsNeedingDraftAnimals * 2;
    const cattlePulling = Math.min(cattle, draftAnimalsNeeded);
    const horsePulling = Math.min(horses, Math.max(0, draftAnimalsNeeded - cattlePulling));
    const draftShortage = Math.max(0, draftAnimalsNeeded - cattlePulling - horsePulling);
    const loadHorses = Math.max(0, horses - horsePulling);

    const totalPeople = Math.max(0, Number(stats.totalPeople || 0));
    // Wagons carried by elephants do not prevent mounted movement. Wagons that need cattle/horses do.
    const fullyMounted = wagonsNeedingDraftAnimals === 0 && totalPeople > 0 && loadHorses >= totalPeople;

    let carryingCapacity = fullyMounted
      ? (totalPeople * 100) + (Math.max(0, loadHorses - totalPeople) * 300)
      : (totalPeople * 30) + (loadHorses * 300);

    // Workbook weight includes the 1000 lb wagon itself. 3000 gross CC therefore gives 2000 lb net cargo capacity.
    carryingCapacity += wagons * 3000;

    const backpacks = Math.max(0, Number(stats.backpacks || 0));
    const backpackEligible = fullyMounted ? 0 : Math.max(0, Number(stats.warrior || 0) + Number(stats.active || 0));
    const backpacksUsed = Math.min(backpacks, backpackEligible);
    carryingCapacity += backpacksUsed * 32;

    const saddlebags = Math.max(0, Number(stats.saddlebags || 0));
    const camelCount = Math.max(0, Number(stats.camelCount || 0));
    const saddlebagEligible = Math.max(0, loadHorses + camelCount);
    const saddlebagsUsed = Math.min(saddlebags, saddlebagEligible);
    carryingCapacity += saddlebagsUsed * 104;

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
      backpacksUsed,
      saddlebagsUsed,
      carryingCapacity,
      loadPercent,
      warnings,
      calculationBasis: `${stats.calculationBasis || 'Starting workbook inventory plus BM transfers.'} Wagon rule: 1 wagon = 2 Cattle/Horses to pull, or 1 Elephant to carry; Cattle are allocated before Horses.`
    });
  }

  return plan;
}

module.exports = { applyWagonAnimalRules };

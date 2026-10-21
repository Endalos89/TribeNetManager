(function installUnitSustenance(root) {
  function dryTerrainRates(counts = {}) {
    return {
      waterPerTurn: Number(counts.ordinaryPeople || 0) * 10
        + (Number(counts.slaves || 0) + Number(counts.goats || 0) + Number(counts.dogs || 0)) * 5
        + (Number(counts.cattle || 0) + Number(counts.horses || 0)) * 20
        + Number(counts.elephants || 0) * 30,
      fodderPerTurn: Number(counts.horses || 0) * 8
        + Number(counts.cattle || 0) * 5
        + Number(counts.goats || 0)
        + Number(counts.elephants || 0) * 12
    };
  }

  function reserveMonths(stock, perTurn, monthsPerTurn = 1) {
    const quantity = Number(stock);
    const demand = Number(perTurn);
    const months = Number(monthsPerTurn);
    if (!Number.isFinite(quantity) || !Number.isFinite(demand) || !Number.isFinite(months) || quantity < 0 || demand < 0 || months <= 0) return null;
    if (demand === 0) return null;
    return quantity / demand * months;
  }

  function foodReserveStatus(months) {
    const quantity = Number(months);
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    if (quantity < 1) return 'critical';
    if (quantity < 4) return 'warning';
    return 'healthy';
  }

  const api = { dryTerrainRates, reserveMonths, foodReserveStatus };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UnitSustenance = api;
})(typeof window !== 'undefined' ? window : globalThis);

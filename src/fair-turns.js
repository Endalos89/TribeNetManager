(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairTurns = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  function parseTurnKey(value) {
    const match = String(value || '').trim().match(/^(\d+)[-_](\d+)$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return { year, month, turnKey:`${year}-${String(month).padStart(2, '0')}`, sort:year * 12 + month };
  }

  function fairKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function previousFairBefore(turnKey) {
    const turn = parseTurnKey(turnKey);
    if (!turn) return null;
    if (turn.month > 10) return fairKey(turn.year, 10);
    if (turn.month > 4) return fairKey(turn.year, 4);
    return fairKey(turn.year - 1, 10);
  }

  function nextFairAfter(turnKey) {
    const turn = parseTurnKey(turnKey);
    if (!turn) return null;
    if (turn.month < 4) return fairKey(turn.year, 4);
    if (turn.month < 10) return fairKey(turn.year, 10);
    return fairKey(turn.year + 1, 4);
  }

  function fairAtOrAfter(turnKey) {
    const turn = parseTurnKey(turnKey);
    if (!turn) return null;
    if (turn.month <= 4) return fairKey(turn.year, 4);
    if (turn.month <= 10) return fairKey(turn.year, 10);
    return fairKey(turn.year + 1, 4);
  }

  function fairsBetween(firstTurnKey, lastTurnKey) {
    const first = parseTurnKey(firstTurnKey);
    const last = parseTurnKey(lastTurnKey);
    if (!first || !last) return [];
    const min = Math.min(first.sort, last.sort);
    const max = Math.max(first.sort, last.sort);
    const rows = [];
    for (let year = first.year - 1; year <= last.year + 1; year += 1) {
      for (const month of [4, 10]) {
        const sort = year * 12 + month;
        if (sort >= min && sort <= max) rows.push(fairKey(year, month));
      }
    }
    return rows;
  }

  function buildFairTurnOptions(managedTurns = [], snapshots = []) {
    const managed = (managedTurns || [])
      .map(row => parseTurnKey(row?.turnKey ?? row))
      .filter(Boolean)
      .sort((a,b) => a.sort - b.sort);
    const saved = (snapshots || [])
      .map(row => parseTurnKey(row?.turnKey ?? row))
      .filter(row => row && [4,10].includes(row.month));

    const options = new Set(saved.map(row => row.turnKey));
    const basis = managed.length ? managed : saved.sort((a,b) => a.sort - b.sort);
    if (!basis.length) return [];

    const first = basis[0];
    const last = basis[basis.length - 1];
    for (const key of fairsBetween(first.turnKey, last.turnKey)) options.add(key);
    options.add(previousFairBefore(first.turnKey));
    options.add(nextFairAfter(last.turnKey));

    return [...options]
      .filter(Boolean)
      .map(parseTurnKey)
      .filter(row => row && [4,10].includes(row.month))
      .sort((a,b) => a.sort - b.sort)
      .map(row => row.turnKey);
  }

  return { parseTurnKey, previousFairBefore, nextFairAfter, fairAtOrAfter, fairsBetween, buildFairTurnOptions };
});

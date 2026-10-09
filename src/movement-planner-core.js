(function attachMovementPlannerCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MovementPlannerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function movementPlannerFactory() {
  const TOTAL_COLS = 16 * 30;
  const TOTAL_ROWS = 26 * 21;
  const DIRECTIONS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];

  // TribeNet Mandate TN3 Rev N01, sections 10.2 and 10.4.
  const MOVEMENT_ALLOWANCES = Object.freeze([
    Object.freeze({ key: 'foot', label: 'Foot movement', mp: 18 }),
    Object.freeze({ key: 'mounted', label: 'Mounted movement', mp: 27 }),
    Object.freeze({ key: 'scoutFoot', label: 'Scout foot movement', mp: 8 }),
    Object.freeze({ key: 'scoutMounted', label: 'Scout mounted movement', mp: 15 })
  ]);

  // TribeNet Mandate TN3 Rev N01, section 10.5. Costs are paid when entering a hex.
  // Plateau aliases currently use the cost of their stated base terrain.
  const TERRAIN_MOVEMENT_COST = Object.freeze({
    AR: 3,
    BR: 4,
    D: 5,
    DE: 5,
    JG: 5,
    PR: 3,
    SW: 8,
    TU: 4,
    PI: 7,
    BH: 6,
    CH: 6,
    DH: 6,
    GH: 5,
    JH: 6,
    RH: 6,
    SH: 7,
    LAM: 9,
    LCM: 10,
    LJM: 10,
    LSM: 10,
    LVM: 10,
    GHP: 5,
    PGH: 5,
    PP: 3,
    PPR: 3
  });

  const IMPASSABLE_TERRAIN = new Set(['UNKNOWN', 'O', 'L', 'HSM', 'ALPS']);
  // The planner deliberately keeps the normal route as the authoritative route.
  // This one-MP-per-entered-hex value is a conservative warning total for bad
  // weather, so weather never changes the route the player selected.
  const BAD_WEATHER_ENTRY_PENALTY = 1;

  function letter(index) {
    return String.fromCharCode(65 + index);
  }

  function coordinateFor(globalCol, globalRow) {
    if (globalCol < 0 || globalRow < 0 || globalCol >= TOTAL_COLS || globalRow >= TOTAL_ROWS) return null;
    const mapCol = Math.floor(globalCol / 30);
    const mapRow = Math.floor(globalRow / 21);
    const hexCol = globalCol % 30 + 1;
    const hexRow = globalRow % 21 + 1;
    return `${letter(mapRow)}${letter(mapCol)}${String(hexCol).padStart(2, '0')}${String(hexRow).padStart(2, '0')}`;
  }

  function parseCoordinate(input) {
    const cleaned = String(input || '').toUpperCase().replace(/\s+/g, '');
    const match = cleaned.match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
    if (!match) return null;
    const mapRow = match[1].charCodeAt(0) - 65;
    const mapCol = match[2].charCodeAt(0) - 65;
    const hexCol = Number(match[3]);
    const hexRow = Number(match[4]);
    if (mapRow < 0 || mapRow >= 26 || mapCol < 0 || mapCol >= 16 || hexCol < 1 || hexCol > 30 || hexRow < 1 || hexRow > 21) return null;
    const globalCol = mapCol * 30 + hexCol - 1;
    const globalRow = mapRow * 21 + hexRow - 1;
    return { coordinate: coordinateFor(globalCol, globalRow), globalCol, globalRow };
  }

  function step(point, direction) {
    if (!point || !DIRECTIONS.includes(direction)) return null;
    let c = Number(point.globalCol);
    let r = Number(point.globalRow);
    const odd = c % 2 === 1;
    if (direction === 'N') r -= 1;
    else if (direction === 'S') r += 1;
    else if (direction === 'NE') { c += 1; r += odd ? 0 : -1; }
    else if (direction === 'SE') { c += 1; r += odd ? 1 : 0; }
    else if (direction === 'NW') { c -= 1; r += odd ? 0 : -1; }
    else if (direction === 'SW') { c -= 1; r += odd ? 1 : 0; }
    const coordinate = coordinateFor(c, r);
    return coordinate ? { globalCol: c, globalRow: r, coordinate, direction } : null;
  }

  function adjacentHexes(point) {
    return DIRECTIONS.map(direction => step(point, direction)).filter(Boolean);
  }

  function terrainMovementCost(terrain, weatherPenalty = 0) {
    const code = String(terrain || 'UNKNOWN').toUpperCase();
    if (IMPASSABLE_TERRAIN.has(code)) return null;
    const base = TERRAIN_MOVEMENT_COST[code];
    if (!Number.isFinite(base)) return null;
    return base + Math.max(0, Number(weatherPenalty || 0));
  }

  function isRevealedLand(hex) {
    if (!hex) return false;
    const terrain = String(hex.terrain || 'UNKNOWN').toUpperCase();
    return terrainMovementCost(terrain, 0) != null;
  }

  function movementAllowanceSummary(totalMp) {
    const used = Math.max(0, Number(totalMp || 0));
    return MOVEMENT_ALLOWANCES.map(mode => ({
      ...mode,
      used,
      remaining: Math.max(0, mode.mp - used),
      overBy: Math.max(0, used - mode.mp),
      canComplete: used <= mode.mp
    }));
  }

  function numeric(value) {
    const number = Number(String(value ?? 0).replace(/,/g, ''));
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function unitMovementProfile(unit) {
    const people = unit?.people || unit?.resources?.Humans || {};
    const animals = unit?.resources?.Animals || {};
    const goods = unit?.resources?.Goods || {};
    const inventory = new Map((unit?.inventory || []).map(row => [String(row.item || '').toUpperCase(), numeric(row.quantity)]));
    const listedPeople = ['Warriors', 'Actives', 'Inactives', 'Slaves', 'Hirelings', 'Mercs', 'Locals', 'Residents', 'Followers', 'Auxiliaries']
      .reduce((total, key) => total + numeric(people[key] ?? people[key.toLowerCase()]), 0);
    const totalPeople = Math.max(numeric(unit?.totalPeople), numeric(people.People ?? people.people), listedPeople);
    const horses = numeric(unit?.horseCount ?? unit?.horses ?? animals.Horse ?? animals.Horses ?? inventory.get('HORSE') ?? inventory.get('HORSES'));
    const wagons = numeric(unit?.wagonCount ?? unit?.wagons ?? goods.Wagon ?? goods.Wagons ?? inventory.get('WAGON') ?? inventory.get('WAGONS'));
    const carts = numeric(unit?.cartCount ?? unit?.carts ?? goods.Cart ?? goods.Carts ?? inventory.get('CART') ?? inventory.get('CARTS'));
    const explicitMounted = typeof unit?.fullyMounted === 'boolean' ? unit.fullyMounted : null;
    const mounted = explicitMounted == null
      ? totalPeople > 0 && horses >= totalPeople && wagons + carts === 0
      : explicitMounted;
    const allowance = MOVEMENT_ALLOWANCES.find(row => row.key === (mounted ? 'mounted' : 'foot'))?.mp || (mounted ? 27 : 18);
    return {
      allowance,
      mounted,
      people: totalPeople,
      horses,
      wagons: wagons + carts,
      known: explicitMounted != null || totalPeople > 0 || horses > 0 || wagons + carts > 0
    };
  }

  function buildKnownHexMap(rows) {
    const result = new Map();
    for (const row of rows || []) {
      const parsed = parseCoordinate(row.coordinate);
      if (!parsed) continue;
      result.set(parsed.coordinate, {
        ...row,
        ...parsed,
        terrain: String(row.terrain || 'UNKNOWN').toUpperCase()
      });
    }
    return result;
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(value) {
      this.items.push(value);
      let i = this.items.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (!this.less(this.items[i], this.items[p])) break;
        [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
        i = p;
      }
    }
    pop() {
      if (!this.items.length) return null;
      const top = this.items[0];
      const last = this.items.pop();
      if (this.items.length) {
        this.items[0] = last;
        let i = 0;
        while (true) {
          const l = i * 2 + 1;
          const r = l + 1;
          let best = i;
          if (l < this.items.length && this.less(this.items[l], this.items[best])) best = l;
          if (r < this.items.length && this.less(this.items[r], this.items[best])) best = r;
          if (best === i) break;
          [this.items[i], this.items[best]] = [this.items[best], this.items[i]];
          i = best;
        }
      }
      return top;
    }
    less(a, b) {
      return a.cost < b.cost || (a.cost === b.cost && a.steps < b.steps);
    }
    get size() { return this.items.length; }
  }

  function reconstructRoute(goalCoordinate, originCoordinate, known, previous, distance, steps, weatherPenalty) {
    const coordinates = [];
    const directions = [];
    let cursor = goalCoordinate;
    while (cursor) {
      coordinates.push(cursor);
      if (cursor === originCoordinate) break;
      const link = previous.get(cursor);
      if (!link) return null;
      directions.push(link.direction);
      cursor = link.coordinate;
    }
    coordinates.reverse();
    directions.reverse();

    let cumulativeMp = 0;
    const path = coordinates.map((coordinate, index) => {
      const row = known.get(coordinate) || { coordinate, terrain: 'UNKNOWN', ...parseCoordinate(coordinate) };
      const baseCost = index === 0 ? 0 : TERRAIN_MOVEMENT_COST[row.terrain] || 0;
      const weather = index === 0 ? 0 : Math.max(0, Number(weatherPenalty || 0));
      const cost = index === 0 ? 0 : baseCost + weather;
      cumulativeMp += cost;
      return {
        coordinate,
        globalCol: row.globalCol,
        globalRow: row.globalRow,
        terrain: row.terrain,
        entryMp: cost,
        baseEntryMp: baseCost,
        weatherPenalty: weather,
        cumulativeMp
      };
    });

    return {
      path,
      directions,
      totalMp: Number(distance.get(goalCoordinate) || 0),
      badWeatherMp: path.slice(1).reduce((total, point) => total + (point.baseEntryMp == null ? 0 : point.baseEntryMp + BAD_WEATHER_ENTRY_PENALTY), 0),
      steps: Number(steps.get(goalCoordinate) || 0)
    };
  }

  function findFastestRoute(rowsOrMap, originInput, targetInput, options = {}) {
    const known = rowsOrMap instanceof Map ? rowsOrMap : buildKnownHexMap(rowsOrMap);
    const origin = typeof originInput === 'string' ? parseCoordinate(originInput) : originInput;
    const target = typeof targetInput === 'string' ? parseCoordinate(targetInput) : targetInput;
    const weatherPenalty = Math.max(0, Number(options.weatherPenalty || 0));

    if (!origin || !target) return { status: 'invalid-coordinate' };
    const originHex = known.get(origin.coordinate);
    if (!isRevealedLand(originHex)) {
      return { status: 'origin-unknown', origin: origin.coordinate, requestedTarget: target.coordinate };
    }

    const targetHex = known.get(target.coordinate);
    const targetKnown = isRevealedLand(targetHex);
    const targetIsRevealedButImpassable = Boolean(targetHex && String(targetHex.terrain || 'UNKNOWN').toUpperCase() !== 'UNKNOWN' && !targetKnown);
    if (targetIsRevealedButImpassable) {
      return {
        status: 'target-impassable',
        origin: origin.coordinate,
        requestedTarget: target.coordinate,
        targetTerrain: targetHex.terrain
      };
    }

    let goals;
    let targetIsUnknown = false;
    if (targetKnown) {
      goals = new Set([target.coordinate]);
    } else {
      targetIsUnknown = true;
      goals = new Set(
        adjacentHexes(target)
          .map(point => point.coordinate)
          .filter(coordinate => isRevealedLand(known.get(coordinate)))
      );
      if (!goals.size) {
        return {
          status: 'no-revealed-adjacent',
          origin: origin.coordinate,
          requestedTarget: target.coordinate,
          targetIsUnknown: true
        };
      }
    }

    if (goals.has(origin.coordinate)) {
      const route = reconstructRoute(origin.coordinate, origin.coordinate, known, new Map(), new Map([[origin.coordinate, 0]]), new Map([[origin.coordinate, 0]]), weatherPenalty);
      return {
        status: 'ok',
        origin: origin.coordinate,
        requestedTarget: target.coordinate,
        actualTarget: origin.coordinate,
        targetIsUnknown,
        candidateGoalCount: goals.size,
        ...route
      };
    }

    const distance = new Map([[origin.coordinate, 0]]);
    const stepCount = new Map([[origin.coordinate, 0]]);
    const previous = new Map();
    const heap = new MinHeap();
    heap.push({ coordinate: origin.coordinate, cost: 0, steps: 0 });
    let bestGoal = null;

    while (heap.size) {
      const current = heap.pop();
      const currentCost = distance.get(current.coordinate);
      const currentSteps = stepCount.get(current.coordinate);
      if (current.cost !== currentCost || current.steps !== currentSteps) continue;
      if (goals.has(current.coordinate)) {
        bestGoal = current.coordinate;
        break;
      }
      const point = known.get(current.coordinate) || parseCoordinate(current.coordinate);
      if (!point) continue;

      for (const next of adjacentHexes(point)) {
        const row = known.get(next.coordinate);
        if (!isRevealedLand(row)) continue;
        const entryCost = terrainMovementCost(row.terrain, weatherPenalty);
        if (entryCost == null) continue;
        const nextCost = currentCost + entryCost;
        const nextSteps = currentSteps + 1;
        const oldCost = distance.get(next.coordinate);
        const oldSteps = stepCount.get(next.coordinate);
        if (oldCost == null || nextCost < oldCost || (nextCost === oldCost && nextSteps < oldSteps)) {
          distance.set(next.coordinate, nextCost);
          stepCount.set(next.coordinate, nextSteps);
          previous.set(next.coordinate, { coordinate: current.coordinate, direction: next.direction });
          heap.push({ coordinate: next.coordinate, cost: nextCost, steps: nextSteps });
        }
      }
    }

    if (!bestGoal) {
      return {
        status: 'no-route',
        origin: origin.coordinate,
        requestedTarget: target.coordinate,
        targetIsUnknown,
        candidateGoalCount: goals.size
      };
    }

    const route = reconstructRoute(bestGoal, origin.coordinate, known, previous, distance, stepCount, weatherPenalty);
    return {
      status: 'ok',
      origin: origin.coordinate,
      requestedTarget: target.coordinate,
      actualTarget: bestGoal,
      targetIsUnknown,
      candidateGoalCount: goals.size,
      ...route
    };
  }

  return {
    DIRECTIONS,
    MOVEMENT_ALLOWANCES,
    TERRAIN_MOVEMENT_COST,
    IMPASSABLE_TERRAIN,
    BAD_WEATHER_ENTRY_PENALTY,
    coordinateFor,
    parseCoordinate,
    step,
    adjacentHexes,
    terrainMovementCost,
    isRevealedLand,
    movementAllowanceSummary,
    unitMovementProfile,
    buildKnownHexMap,
    findFastestRoute
  };
});

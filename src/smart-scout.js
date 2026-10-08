(function attachSmartScoutCore(root, factory) {
  const plannerCore = root?.MovementPlannerCore || (typeof require === 'function' ? require('./movement-planner-core') : null);
  const conditionalOrders = root?.ConditionalOrders || (typeof require === 'function' ? require('./conditional-orders') : null);
  const api = factory(plannerCore, conditionalOrders);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SmartScoutCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function smartScoutFactory(MovementPlannerCore, ConditionalOrders) {
  const VALID_MISSIONS = new Set(['LOCATE', 'PATROL', 'RAID', 'SPY']);
  const VALID_SCOUT_ORDERS = new Set([
    'EMPTY', 'FCL', 'FCR', 'FLL', 'FLR', 'FML', 'FMR', 'FOL', 'FOR', 'FOLLOW', 'FRL', 'FRR',
    'N', 'NE', 'NEL', 'NL', 'NW', 'NWL', 'S', 'SE', 'SEL', 'SL', 'Still', 'SW', 'SWL'
  ]);
  const CONDITIONAL_ORDERS = new Set(['FOL', 'FOR', 'FLL', 'FLR', 'FML', 'FMR', 'FRL', 'FRR']);
  const UNKNOWN_COST_SCENARIOS = Object.freeze([3, 6, 9]);
  const OPTIMISTIC_UNKNOWN_COST = UNKNOWN_COST_SCENARIOS[0];
  const TERRAIN_LIKELIHOOD_RADIUS = 2;

  function fail(message) {
    throw new Error(message);
  }

  function core() {
    if (!MovementPlannerCore) fail('The movement planner core is not loaded.');
    return MovementPlannerCore;
  }

  function conditional() {
    if (!ConditionalOrders) fail('The conditional-order core is not loaded.');
    return ConditionalOrders;
  }

  function canonical(value) {
    return String(value || '').trim().toUpperCase();
  }

  function terrainOf(row) {
    return canonical(row?.terrain || row?.terrainCode || row?.statusTerrain || 'UNKNOWN');
  }

  function knowledgeOf(row) {
    return canonical(row?.knowledgeLevel || row?.knowledge || row?.visibility || '');
  }

  function isOcean(row) {
    return conditional().hasFeature(row, 'ocean');
  }

  function isMountain(row) {
    return conditional().hasFeature(row, 'mountain');
  }

  function isFogOrQuestion(row) {
    if (!row) return true;
    const terrain = terrainOf(row);
    const knowledge = knowledgeOf(row);
    const marker = `${row?.marker || ''} ${row?.status || ''}`.toUpperCase();
    return terrain === 'UNKNOWN'
      || terrain === '?'
      || terrain === 'UNEXPLORED'
      || ['OBSERVED', 'ATTEMPTED', 'PARTIAL', 'FOG', 'UNEXPLORED', 'UNKNOWN'].includes(knowledge)
      || marker.includes('?')
      || marker.includes('FOG');
  }

  function isUnknownEntry(row) {
    if (!row) return true;
    if (isOcean(row) || conditional().hasFeature(row, 'lake') || isMountain(row)) return false;
    return isFogOrQuestion(row);
  }

  function isScoutRevealTarget(row) {
    if (!row) return true;
    if (isOcean(row) || conditional().hasFeature(row, 'lake') || isMountain(row)) return false;
    return isFogOrQuestion(row);
  }

  function isPassable(row) {
    return core().isRevealedLand(row);
  }

  function mapRows(rows) {
    return rows instanceof Map ? new Map(rows) : core().buildKnownHexMap(rows || []);
  }

  function addWeight(weights, coordinate, value) {
    if (!coordinate || !Number.isFinite(Number(value)) || Number(value) <= 0) return;
    const key = String(coordinate);
    const probability = Math.max(0, Math.min(1, Number(value)));
    const existing = Number(weights[key] || 0);
    weights[key] = 1 - ((1 - existing) * (1 - probability));
  }

  function mergeWeights(target, source) {
    for (const [coordinate, value] of Object.entries(source || {})) addWeight(target, coordinate, value);
    return target;
  }

  function terrainLikelihood(known, coordinate) {
    const origin = core().parseCoordinate(coordinate);
    if (!origin) return { land: .65, ocean: .2, mountain: .15, passable: .65 };

    let land = 3;
    let ocean = 1;
    let mountain = .5;
    const distances = new Map([[origin.coordinate, 0]]);
    const queue = [origin];
    while (queue.length) {
      const current = queue.shift();
      const distance = distances.get(current.coordinate);
      if (distance >= TERRAIN_LIKELIHOOD_RADIUS) continue;
      for (const next of core().adjacentHexes(current)) {
        if (distances.has(next.coordinate)) continue;
        distances.set(next.coordinate, distance + 1);
        queue.push(next);
      }
    }

    for (const [nearbyCoordinate, distance] of distances) {
      if (!distance) continue;
      const row = known.get(nearbyCoordinate);
      if (!row || isUnknownEntry(row)) continue;
      const weight = distance === 1 ? 4 : 1.5;
      if (isOcean(row) || conditional().hasFeature(row, 'lake')) ocean += weight;
      else if (isMountain(row)) mountain += weight;
      else land += weight;
    }

    const total = land + ocean + mountain;
    return {
      land: land / total,
      ocean: ocean / total,
      mountain: mountain / total,
      passable: land / total
    };
  }

  function directionBetween(fromCoordinate, toCoordinate) {
    const from = core().parseCoordinate(fromCoordinate);
    if (!from) return null;
    return core().adjacentHexes(from).find(point => point.coordinate === toCoordinate)?.direction || null;
  }

  function candidateTargets(known, originCoordinate, maxSteps) {
    const origin = core().parseCoordinate(originCoordinate);
    if (!origin) return [];
    const candidates = new Map();
    const add = (coordinate, reason) => {
      if (!coordinate || coordinate === origin.coordinate) return;
      const existing = candidates.get(coordinate) || { coordinate, reasons: new Set() };
      existing.reasons.add(reason);
      candidates.set(coordinate, existing);
    };

    for (const row of known.values()) {
      if (row?.coordinate && isScoutRevealTarget(row)) add(row.coordinate, 'question-mark');
    }

    for (const row of known.values()) {
      if (!isPassable(row)) continue;
      for (const adjacent of core().adjacentHexes(row)) {
        const neighbour = known.get(adjacent.coordinate);
        if (!neighbour || isScoutRevealTarget(neighbour)) add(adjacent.coordinate, 'fog-frontier');
      }
    }

    const distances = new Map([[origin.coordinate, 0]]);
    const queue = [origin];
    while (queue.length) {
      const current = queue.shift();
      const distance = distances.get(current.coordinate);
      if (distance >= Math.max(1, maxSteps)) continue;
      for (const next of core().adjacentHexes(current)) {
        if (distances.has(next.coordinate)) continue;
        distances.set(next.coordinate, distance + 1);
        queue.push(next);
      }
    }

    return [...candidates.values()]
      .filter(candidate => distances.has(candidate.coordinate) && distances.get(candidate.coordinate) <= maxSteps)
      .map(candidate => ({ ...candidate, reasons: [...candidate.reasons], gridDistance: distances.get(candidate.coordinate) }))
      .sort((left, right) => left.gridDistance - right.gridDistance || left.coordinate.localeCompare(right.coordinate))
      .slice(0, 320);
  }

  function pathCoverageWeights(known, path) {
    const weights = {};
    let reachProbability = 1;
    for (let index = 0; index < (path || []).length; index += 1) {
      const point = path[index];
      const row = known.get(point.coordinate);
      if (index > 0 && isUnknownEntry(row)) {
        reachProbability *= terrainLikelihood(known, point.coordinate).passable;
        if (isScoutRevealTarget(row)) addWeight(weights, point.coordinate, reachProbability);
      }
      // Entered unknown land is the scouting coverage target. Entering a hex
      // can reveal adjacent ocean/mountains, but adjacent unknown land is not
      // counted unless the scout actually reaches it. Ocean is never a target.
    }
    return weights;
  }

  function routeMetrics(known, path, unknownCount) {
    let knownMp = 0;
    let badWeatherMp = 0;
    for (const point of (path || []).slice(1)) {
      const row = known.get(point.coordinate);
      if (isUnknownEntry(row)) continue;
      const base = core().terrainMovementCost(terrainOf(row), 0);
      if (base == null) continue;
      knownMp += base;
      badWeatherMp += base + Number(core().BAD_WEATHER_ENTRY_PENALTY || 1);
    }
    const scenarioMp = UNKNOWN_COST_SCENARIOS.map(cost => knownMp + unknownCount * cost);
    return {
      knownMp,
      badWeatherMp: badWeatherMp + unknownCount * UNKNOWN_COST_SCENARIOS[2],
      optimisticMp: scenarioMp[0],
      estimatedMp: scenarioMp[1],
      worstCaseMp: scenarioMp[2],
      scenarioMp: { low: scenarioMp[0], expected: scenarioMp[1], high: scenarioMp[2] }
    };
  }

  function buildCandidate(known, state, options, conditionalResult = null, conditionalOrder = null) {
    const directions = conditionalOrder ? [...state.directions, conditionalOrder] : [...state.directions];
    const weights = pathCoverageWeights(known, state.path);
    if (conditionalResult) mergeWeights(weights, conditionalResult.coverageWeights);
    if (!Object.keys(weights).length && !conditionalResult?.valid) return null;

    const metrics = routeMetrics(known, state.path, state.unknownCount);
    const expectedCoverage = Object.values(weights).reduce((total, value) => total + Number(value || 0), 0);
    const continuationPotential = Number(conditionalResult?.continuationPotential || 0);
    const destinationHex = state.path[state.path.length - 1]?.coordinate || state.origin;
    return {
      status: 'ok',
      origin: state.origin,
      requestedTarget: conditionalOrder ? null : destinationHex,
      actualTarget: destinationHex,
      destinationCoordinate: destinationHex,
      destinationHex,
      targetIsUnknown: state.unknownCount > 0,
      path: state.path.map(point => ({ ...point })),
      directions,
      steps: state.path.length - 1,
      unknownEntryCount: state.unknownCount,
      ...metrics,
      conditionalOrder,
      specialOrder: conditionalOrder,
      conditionalPredictionPaths: conditionalResult?.predictionPaths || [],
      conditionalWarnings: conditionalResult?.warnings || [],
      conditionalFeature: conditionalResult?.feature || null,
      continuationPotential,
      coverage: Object.keys(weights),
      coverageWeights: weights,
      coverageCount: Object.keys(weights).length,
      expectedCoverage,
      signature: `${directions.join('>')}|${state.path.map(point => point.coordinate).join('>')}`,
      unitCode: options.unitCode || '',
      routeType: 'scout',
      noOfScouts: options.people,
      noOfHorses: options.horses,
      mission: options.mission,
      movementAllowance: options.allowance,
      mounted: options.mounted
    };
  }

  function forwardCandidates(known, origin, options) {
    const queue = [{
      origin: origin.coordinate,
      point: origin,
      path: [{ ...origin, kind: 'exact' }],
      directions: [],
      heading: null,
      knownMp: 0,
      unknownCount: 0,
      optimisticMp: 0,
      visited: new Set([origin.coordinate])
    }];
    const candidates = [];
    const signatures = new Set();
    let visitedStates = 0;
    const add = candidate => {
      if (!candidate || signatures.has(candidate.signature)) return;
      signatures.add(candidate.signature);
      candidates.push(candidate);
    };

    while (queue.length && visitedStates < 2400) {
      const state = queue.shift();
      visitedStates += 1;
      if (state.directions.length) add(buildCandidate(known, state, options));

      // A conditional order is deliberately terminal. The game, not this
      // planner, determines where the scout ends after following the feature.
      if (state.heading && isPassable(known.get(state.point.coordinate))) {
        for (const token of ['FOL', 'FOR']) {
          const preview = conditional().preview(known, state.point, state.heading, token, {
            remainingMp: Math.max(0, options.allowance - state.optimisticMp),
            maxSteps: options.maxCommands,
            optimisticUnknownCost: OPTIMISTIC_UNKNOWN_COST,
            landProbability: coordinate => terrainLikelihood(known, coordinate).passable
          });
          if (preview.valid) add(buildCandidate(known, state, options, preview, token));
        }
      }

      if (state.directions.length >= options.maxCommands) continue;
      for (const next of core().adjacentHexes(state.point)) {
        if (state.visited.has(next.coordinate)) continue;
        const row = known.get(next.coordinate);
        if (isOcean(row) || conditional().hasFeature(row, 'lake') || isMountain(row)) continue;
        const unresolved = isUnknownEntry(row);
        const entryCost = unresolved ? OPTIMISTIC_UNKNOWN_COST : core().terrainMovementCost(terrainOf(row), 0);
        if (entryCost == null || state.optimisticMp + entryCost > options.allowance) continue;

        const visited = new Set(state.visited);
        visited.add(next.coordinate);
        queue.push({
          ...state,
          point: next,
          path: [...state.path, {
            ...next,
            terrain: terrainOf(row),
            kind: unresolved ? 'possible' : 'exact'
          }],
          directions: [...state.directions, next.direction],
          heading: next.direction,
          knownMp: state.knownMp + (unresolved ? 0 : entryCost),
          unknownCount: state.unknownCount + (unresolved ? 1 : 0),
          optimisticMp: state.optimisticMp + entryCost,
          visited
        });
      }
    }
    return candidates;
  }

  function routeScore(route, covered, previousRoutes) {
    let newCoverage = 0;
    let overlap = 0;
    for (const [coordinate, value] of Object.entries(route.coverageWeights || {})) {
      const existing = Number(covered.get(coordinate) || 0);
      const probability = Number(value || 0);
      newCoverage += probability * (1 - existing);
      overlap += probability * existing;
    }
    const repeated = previousRoutes.some(previous => previous.signature === route.signature);
    return newCoverage * 1000
      + Number(route.continuationPotential || 0) * 160
      + Number(route.expectedCoverage || 0) * 20
      - Number(route.estimatedMp || 0) * 1.5
      - Number(route.worstCaseMp || 0) * .2
      - overlap * 8
      - (repeated ? 24 : 0);
  }

  function selectRoutes(candidates, scoutRows, origin, options) {
    const selected = [];
    const covered = new Map();
    const still = () => ({
      status: 'ok',
      origin: origin.coordinate,
      actualTarget: origin.coordinate,
      destinationCoordinate: origin.coordinate,
      destinationHex: origin.coordinate,
      path: [{ ...origin, kind: 'exact' }],
      directions: ['Still'],
      steps: 0,
      knownMp: 0,
      badWeatherMp: 0,
      optimisticMp: 0,
      estimatedMp: 0,
      worstCaseMp: 0,
      scenarioMp: { low: 0, expected: 0, high: 0 },
      unknownEntryCount: 0,
      coverage: [],
      coverageWeights: {},
      coverageCount: 0,
      expectedCoverage: 0,
      continuationPotential: 0,
      conditionalOrder: null,
      specialOrder: null,
      signature: `Still|${origin.coordinate}`,
      unitCode: options.unitCode || '',
      routeType: 'scout',
      noOfScouts: options.people,
      noOfHorses: options.horses,
      mission: options.mission,
      movementAllowance: options.allowance,
      mounted: options.mounted,
      warning: 'No route was expected to reveal additional land; this scout is stationary.'
    });

    const addSelected = route => {
      selected.push({ ...route, scoutIndex: selected.length + 1 });
      for (const [coordinate, value] of Object.entries(route.coverageWeights || {})) {
        const existing = Number(covered.get(coordinate) || 0);
        const probability = Math.max(0, Math.min(1, Number(value || 0)));
        covered.set(coordinate, 1 - ((1 - existing) * (1 - probability)));
      }
    };

    for (let index = 0; index < scoutRows; index += 1) {
      const usedSignatures = new Set(selected.map(route => route.signature));
      const unusedCandidates = candidates.filter(route => !usedSignatures.has(route.signature));
      // Overlap is allowed, but identical command sequences are only reused
      // when there is no other candidate left. This prevents the old failure
      // where every scout was sent to the same destination while preserving
      // useful overlapping/coastal strategies.
      const candidatePool = unusedCandidates.length ? unusedCandidates : candidates;
      const ranked = candidatePool
        .map(route => ({ route, score: routeScore(route, covered, selected) }))
        .sort((left, right) => right.score - left.score
          || Number(left.route.worstCaseMp || 0) - Number(right.route.worstCaseMp || 0)
          || left.route.signature.localeCompare(right.route.signature));
      const best = ranked[0];
      if (!best || best.score <= 0) addSelected(still());
      else addSelected(best.route);
    }

    return { selected, covered };
  }

  function specialOrderFor(knownRows, path, targetCoordinate) {
    if (!path || path.length < 2) return null;
    const endpoint = path[path.length - 1];
    const previous = path[path.length - 2];
    const heading = directionBetween(previous.coordinate, endpoint.coordinate);
    return conditional().orderForFeature(knownRows, endpoint, heading, targetCoordinate);
  }

  function generate(rows, originCoordinate, options = {}) {
    const known = mapRows(rows);
    const origin = core().parseCoordinate(originCoordinate);
    if (!origin) return { routes: [], targets: [], covered: [], warnings: ['The Smart Scout origin is not a valid hex.'] };

    const scoutRows = Math.max(1, Math.min(8, Math.floor(Number(options.scoutCount ?? options.routes ?? 1))));
    const people = Math.max(1, Math.floor(Number(options.noOfScouts ?? options.people ?? 2)));
    const horses = Math.max(0, Math.min(people, Math.floor(Number(options.noOfHorses ?? options.horses ?? 2))));
    const mounted = horses >= people;
    const allowance = mounted ? 15 : 8;
    const maxCommands = Math.max(1, Math.min(9, Math.floor(Number(options.maxCommands || 9))));
    const mission = canonical(options.mission || 'PATROL');
    if (!VALID_MISSIONS.has(mission)) fail(`Smart Scout mission ${mission || '(blank)'} is not valid.`);

    const candidateOptions = { unitCode: options.unitCode || '', people, horses, mission, allowance, mounted, maxCommands };
    const targets = candidateTargets(known, origin.coordinate, Math.min(maxCommands, mounted ? 6 : 4));
    const candidates = forwardCandidates(known, origin, candidateOptions);
    const { selected, covered } = selectRoutes(candidates, scoutRows, origin, candidateOptions);
    const stationary = selected.filter(route => route.directions.length === 1 && route.directions[0] === 'Still').length;

    return {
      routes: selected,
      targets,
      covered: [...covered.keys()],
      totalCoverage: covered.size,
      mounted,
      allowance,
      mission,
      expectedCoverage: [...covered.values()].reduce((total, value) => total + Number(value || 0), 0),
      warnings: stationary
        ? [`${stationary} scout${stationary === 1 ? '' : 's'} assigned Still because no additional route was expected to reveal land.`]
        : []
    };
  }

  return {
    VALID_MISSIONS,
    VALID_SCOUT_ORDERS,
    CONDITIONAL_ORDERS,
    UNKNOWN_COST_SCENARIOS,
    isFogOrQuestion,
    isOcean,
    isMountain,
    terrainLikelihood,
    specialOrderFor,
    generate
  };
});

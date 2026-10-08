(function attachSmartScoutCore(root, factory) {
  const plannerCore = root?.MovementPlannerCore || (typeof require === 'function' ? require('./movement-planner-core') : null);
  const api = factory(plannerCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SmartScoutCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function smartScoutFactory(MovementPlannerCore) {
  const VALID_MISSIONS = new Set(['LOCATE', 'PATROL', 'RAID', 'SPY']);
  const VALID_SCOUT_ORDERS = new Set([
    'EMPTY', 'FCL', 'FCR', 'FLL', 'FLR', 'FML', 'FMR', 'FOL', 'FOR', 'FOLLOW', 'FRL', 'FRR',
    'N', 'NE', 'NEL', 'NL', 'NW', 'NWL', 'S', 'SE', 'SEL', 'SL', 'Still', 'SW', 'SWL'
  ]);
  const UNKNOWN_COST_SCENARIOS = Object.freeze([3, 6, 9]);
  const OPTIMISTIC_UNKNOWN_COST = UNKNOWN_COST_SCENARIOS[0];
  const FEATURE_CODES = Object.freeze({
    ocean: ['O', 'OCEAN'],
    lake: ['L', 'LAKE'],
    mountain: ['HSM', 'ALPS', 'MOUNTAIN', 'MOUNTAINS'],
    river: ['R', 'RIVER']
  });

  function fail(message) {
    throw new Error(message);
  }

  function core() {
    if (!MovementPlannerCore) fail('The movement planner core is not loaded.');
    return MovementPlannerCore;
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

  function noteOf(row) {
    return `${row?.notes || ''} ${row?.statusNotes || ''} ${row?.reason || ''}`.toUpperCase();
  }

  function matchesFeature(row, feature) {
    const terrain = terrainOf(row);
    const notes = noteOf(row);
    return FEATURE_CODES[feature].includes(terrain)
      || (feature === 'ocean' && /\bOCEAN\b/.test(notes))
      || (feature === 'lake' && /\bLAKE\b/.test(notes))
      || (feature === 'mountain' && /\bMOUNTAIN(?:S)?\b|\bALPS\b|\bHSM\b/.test(notes))
      || (feature === 'river' && /\bRIVER\b/.test(notes));
  }

  function isOcean(row) { return matchesFeature(row, 'ocean'); }
  function isMountain(row) { return matchesFeature(row, 'mountain'); }

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

  function isPassable(row) {
    return core().isRevealedLand(row);
  }

  function isUnknownEntry(row) {
    if (!row) return true;
    if (isOcean(row) || matchesFeature(row, 'lake') || isMountain(row)) return false;
    const terrain = terrainOf(row);
    const knowledge = knowledgeOf(row);
    const marker = `${row?.marker || ''} ${row?.status || ''}`.toUpperCase();
    return ['UNKNOWN', '?', 'UNEXPLORED'].includes(terrain)
      || ['PARTIAL', 'FOG', 'UNEXPLORED', 'UNKNOWN'].includes(knowledge)
      || marker.includes('?')
      || marker.includes('FOG');
  }

  function directionBetween(fromCoordinate, toCoordinate) {
    const from = core().parseCoordinate(fromCoordinate);
    if (!from) return null;
    return core().adjacentHexes(from).find(point => point.coordinate === toCoordinate)?.direction || null;
  }

  function mapRows(rows) {
    const map = rows instanceof Map ? new Map(rows) : core().buildKnownHexMap(rows || []);
    return map;
  }

  function addCandidate(candidates, coordinate, reason) {
    if (!coordinate) return;
    const existing = candidates.get(coordinate) || { coordinate, reasons: new Set() };
    existing.reasons.add(reason);
    candidates.set(coordinate, existing);
  }

  function candidateTargets(known, originCoordinate, maxSteps) {
    const candidates = new Map();
    const origin = core().parseCoordinate(originCoordinate);
    if (!origin) return [];

    // Explicit ?/partial rows are the strongest targets because they represent
    // a tile the Results baseline knows about but has not fully revealed.
    for (const row of known.values()) {
      if (!row?.coordinate || row.coordinate === origin.coordinate || !isFogOrQuestion(row) || isOcean(row)) continue;
      addCandidate(candidates, row.coordinate, 'question-mark');
    }

    // A Results query returns revealed rows, not every fog tile. Build the
    // immediate fog frontier around revealed land so Smart Scout still works
    // when the map contains no explicit '?' rows.
    for (const row of known.values()) {
      if (!isPassable(row)) continue;
      for (const adjacent of core().adjacentHexes(row)) {
        const neighbour = known.get(adjacent.coordinate);
        if (!neighbour || (isFogOrQuestion(neighbour) && !isOcean(neighbour))) {
          addCandidate(candidates, adjacent.coordinate, neighbour ? 'partial-frontier' : 'fog-frontier');
        }
      }
    }

    // Keep the search local to scout movement. The BFS ignores terrain only to
    // bound the number of targets; actual candidates are routed with terrain
    // costs below.
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
      .map(candidate => ({ ...candidate, gridDistance: distances.get(candidate.coordinate) }))
      .sort((left, right) => left.gridDistance - right.gridDistance || left.coordinate.localeCompare(right.coordinate))
      .slice(0, 320);
  }

  function routeWithUnknownTarget(known, originCoordinate, targetCoordinate, options = {}) {
    const working = new Map(known);
    const origin = core().parseCoordinate(originCoordinate);
    if (!origin) return { status: 'invalid-coordinate' };
    const originRow = working.get(origin.coordinate);
    let syntheticOrigin = false;
    if (!isPassable(originRow)) {
      // Movement may end in fog. That fog hex is already occupied, so it costs
      // no additional MP; make it a temporary zero-cost start node for routing.
      working.set(origin.coordinate, {
        ...(originRow || {}),
        ...origin,
        coordinate: origin.coordinate,
        terrain: 'PR',
        smartScoutSyntheticOrigin: true
      });
      syntheticOrigin = true;
    }
    const result = core().findFastestRoute(working, origin.coordinate, targetCoordinate);
    if (result.status !== 'ok') return result;

    const path = (result.path || []).map(point => ({ ...point }));
    if (syntheticOrigin && path[0]) {
      path[0].terrain = terrainOf(originRow) === 'UNKNOWN' ? 'UNKNOWN' : terrainOf(originRow);
      path[0].smartScoutOrigin = true;
    }

    const requested = core().parseCoordinate(targetCoordinate);
    const actual = core().parseCoordinate(result.actualTarget || targetCoordinate);
    const targetRow = known.get(targetCoordinate);
    const targetIsFog = isFogOrQuestion(targetRow);
    let targetIsUnknown = Boolean(result.targetIsUnknown);
    if (targetIsUnknown && actual && requested && actual.coordinate !== requested.coordinate) {
      const direction = directionBetween(actual.coordinate, requested.coordinate);
      if (!direction) return { status: 'no-revealed-adjacent', requestedTarget: targetCoordinate };
      const entry = {
        ...requested,
        terrain: terrainOf(targetRow),
        entryMp: null,
        baseEntryMp: null,
        weatherPenalty: null,
        cumulativeMp: null,
        knownCumulativeMp: Number(result.totalMp || 0),
        unknownCumulativeCount: 1,
        kind: 'approx'
      };
      path.push(entry);
      result.directions = [...(result.directions || []), direction];
      result.steps = Number(result.steps || 0) + 1;
      targetIsUnknown = true;
    } else if (targetIsFog) {
      targetIsUnknown = true;
    }

    const knownMp = Number(result.totalMp || 0);
    const directions = [...(result.directions || [])];
    const maxCommands = Math.max(1, Number(options.maxCommands || 9));
    const movementAllowance = Math.max(0, Number(options.movementAllowance ?? Infinity));
    const visited = new Set(path.map(point => point.coordinate));
    let unknownEntries = path.slice(1).filter(point => isUnknownEntry(known.get(point.coordinate))).length;

    // Once a scout enters the unknown, keep extending the route while the
    // optimistic (all 3-MP terrain) total still fits. This is deliberately
    // separate from the normal route calculation: unknown hexes have no
    // terrain cost yet, but the generated orders should still cover the full
    // distance available in the best possible case.
    while (
      path.length - 1 < maxCommands
      && knownMp + (unknownEntries + 1) * OPTIMISTIC_UNKNOWN_COST <= movementAllowance
    ) {
      const endpoint = core().parseCoordinate(path[path.length - 1]?.coordinate);
      if (!endpoint) break;
      const nextOptions = core().adjacentHexes(endpoint)
        .filter(next => !visited.has(next.coordinate))
        .map(next => ({
          ...next,
          row: known.get(next.coordinate)
        }))
        .filter(next => !next.row || isUnknownEntry(next.row));
      if (!nextOptions.length) break;

      // Prefer branches that expose more unresolved neighbours, then keep the
      // direction ordering stable so repeated generations are reproducible.
      nextOptions.sort((left, right) => {
        const score = candidate => core().adjacentHexes(candidate).reduce((total, adjacent) => {
          const row = known.get(adjacent.coordinate);
          if (!row) return total + 2;
          if (isOcean(row)) return total + 1;
          return total + (isUnknownEntry(row) ? 2 : 0);
        }, 0);
        return score(right) - score(left) || left.direction.localeCompare(right.direction);
      });
      const next = nextOptions[0];
      path.push({
        ...next,
        terrain: terrainOf(next.row),
        entryMp: null,
        baseEntryMp: null,
        weatherPenalty: null,
        cumulativeMp: null,
        knownCumulativeMp: knownMp,
        unknownCumulativeCount: unknownEntries + 1,
        kind: 'approx'
      });
      directions.push(next.direction);
      result.steps = Number(result.steps || 0) + 1;
      visited.add(next.coordinate);
      unknownEntries += 1;
    }

    const scenarioMp = UNKNOWN_COST_SCENARIOS.map(cost => knownMp + unknownEntries * cost);
    if (directions.length > maxCommands) return { status: 'too-many-commands' };

    return {
      ...result,
      path,
      directions,
      targetIsUnknown,
      unknownEntryCount: unknownEntries,
      knownMp,
      badWeatherMp: Number(result.badWeatherMp || knownMp),
      estimatedMp: scenarioMp[1],
      worstCaseMp: scenarioMp[2],
      scenarioMp: { low: scenarioMp[0], expected: scenarioMp[1], high: scenarioMp[2] },
      targetCoordinate,
      destinationCoordinate: path[path.length - 1]?.coordinate || targetCoordinate,
      optimisticMp: scenarioMp[0]
    };
  }

  function featureFor(row) {
    if (isOcean(row)) return 'ocean';
    if (matchesFeature(row, 'lake')) return 'lake';
    if (isMountain(row)) return 'mountain';
    if (matchesFeature(row, 'river')) return 'river';
    return null;
  }

  function specialOrderFor(known, path, targetCoordinate) {
    if (!path || path.length < 2) return null;
    // Follow orders are issued from the last known land hex at the edge of
    // the route. A multi-hex unknown continuation means the final path point
    // itself has no known coastline/mountain row to inspect.
    let edgeIndex = path.length - 1;
    while (edgeIndex > 0 && isUnknownEntry(known.get(path[edgeIndex].coordinate))) edgeIndex -= 1;
    const endpoint = path[edgeIndex];
    const previous = path[edgeIndex - 1];
    if (!endpoint || !previous) return null;
    const moveDirection = directionBetween(previous.coordinate, endpoint.coordinate);
    if (!moveDirection) return null;
    const moveIndex = core().DIRECTIONS?.indexOf(moveDirection) ?? ['N', 'NE', 'SE', 'S', 'SW', 'NW'].indexOf(moveDirection);
    const target = core().parseCoordinate(targetCoordinate);
    const endpointPoint = core().parseCoordinate(endpoint.coordinate);
    const featureCandidates = endpointPoint
      ? core().adjacentHexes(endpointPoint).map(point => ({ point, row: known.get(point.coordinate) })).filter(item => featureFor(item.row))
      : [];
    if (target) {
      const targetRow = known.get(target.coordinate);
      const targetFeature = featureFor(targetRow);
      if (targetFeature) featureCandidates.unshift({ point: target, row: targetRow, forced: true });
    }
    const chosen = featureCandidates[0];
    if (!chosen) return null;
    const featureDirection = directionBetween(endpoint.coordinate, chosen.point.coordinate);
    const featureIndex = core().DIRECTIONS?.indexOf(featureDirection) ?? ['N', 'NE', 'SE', 'S', 'SW', 'NW'].indexOf(featureDirection);
    if (moveIndex < 0 || featureIndex < 0) return null;
    const delta = (featureIndex - moveIndex + 6) % 6;
    // DIRECTIONS is clockwise (N, NE, SE, S, SW, NW). Therefore one or two
    // clockwise steps from the movement heading are on the right, matching
    // the renderer's authoritative convention: FOR=right, FOL=left.
    const side = delta === 1 || delta === 2 ? 'right'
      : delta === 4 || delta === 5 ? 'left' : null;
    if (!side) return null;
    const suffix = side === 'left' ? 'L' : 'R';
    const prefix = featureFor(chosen.row) === 'ocean' ? 'FO'
      : featureFor(chosen.row) === 'lake' ? 'FL'
        : featureFor(chosen.row) === 'mountain' ? 'FM' : 'FR';
    const order = `${prefix}${suffix}`;
    return VALID_SCOUT_ORDERS.has(order) ? order : null;
  }

  function addCoverage(coverage, known, route) {
    const points = route.path || [];
    for (const point of points) {
      const row = known.get(point.coordinate);
      if (isFogOrQuestion(row) && !isOcean(row)) coverage.add(point.coordinate);
      const parsed = core().parseCoordinate(point.coordinate);
      if (!parsed) continue;
      for (const adjacent of core().adjacentHexes(parsed)) {
        const neighbour = known.get(adjacent.coordinate);
        if (!neighbour) coverage.add(adjacent.coordinate);
        else if (isFogOrQuestion(neighbour) && !isOcean(neighbour)) coverage.add(adjacent.coordinate);
        else if (isOcean(neighbour)) coverage.add(`ocean:${adjacent.coordinate}`);
      }
    }
    if (route.targetCoordinate && !isOcean(known.get(route.targetCoordinate))) coverage.add(route.targetCoordinate);
    return coverage;
  }

  function routeScore(route, covered, previousRoutes) {
    const newCoverage = [...route.coverage].filter(key => !covered.has(key)).length;
    const overlap = [...route.coverage].filter(key => covered.has(key)).length;
    const repeatedSignature = previousRoutes.some(previous => previous.signature === route.signature);
    const featureBonus = route.specialOrder ? 2 : 0;
    // Coverage dominates. MP and unknown-terrain risk break ties, while a
    // small overlap cost keeps identical duplicate routes for genuine hedging
    // only when they remain the best available option.
    return newCoverage * 1000
      + route.coverage.size * 18
      + featureBonus
      - route.estimatedMp * 2
      - route.worstCaseMp * .5
      - overlap * .15
      - (repeatedSignature ? 180 : 0);
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

    const targets = candidateTargets(known, origin.coordinate, Math.min(maxCommands, mounted ? 6 : 4));
    const candidates = [];
    for (const target of targets) {
      const route = routeWithUnknownTarget(known, origin.coordinate, target.coordinate, {
        maxCommands,
        movementAllowance: allowance
      });
      if (!route || route.status !== 'ok' || !route.directions?.length || route.optimisticMp > allowance) continue;
      const coverage = addCoverage(new Set(), known, route);
      if (!coverage.size) continue;
      const specialOrder = specialOrderFor(known, route.path, target.coordinate);
      const directions = [...route.directions];
      if (specialOrder && directions.length) directions[directions.length - 1] = specialOrder;
      if (directions.some(order => !VALID_SCOUT_ORDERS.has(order) || order === 'GOTO')) continue;
      candidates.push({
        ...route,
        unitCode: options.unitCode || '',
        routeType: 'scout',
        noOfScouts: people,
        noOfHorses: horses,
        mission,
        directions,
        specialOrder,
        coverage: [...coverage],
        coverageCount: coverage.size,
        signature: directions.join('>'),
        destinationHex: route.destinationCoordinate,
        movementAllowance: allowance,
        mounted
      });
    }

    const selected = [];
    const covered = new Set();
    for (let index = 0; index < scoutRows; index++) {
      if (!candidates.length) break;
      const unusedSignatures = new Set(candidates.map(route => route.signature));
      for (const previous of selected) unusedSignatures.delete(previous.signature);
      const pool = unusedSignatures.size
        ? candidates.filter(route => unusedSignatures.has(route.signature))
        : candidates;
      const ranked = pool.map(route => ({ route, score: routeScore(route, covered, selected) }))
        .sort((left, right) => right.score - left.score || left.route.worstCaseMp - right.route.worstCaseMp || left.route.signature.localeCompare(right.route.signature));
      const best = ranked[0]?.route;
      if (!best) break;
      selected.push({ ...best, scoutIndex: index + 1 });
      for (const key of best.coverage) covered.add(key);
    }

    return {
      routes: selected,
      targets,
      covered: [...covered],
      totalCoverage: covered.size,
      mounted,
      allowance,
      mission,
      warnings: selected.length < scoutRows
        ? [`Only ${selected.length} of ${scoutRows} scout route${scoutRows === 1 ? '' : 's'} could be generated within ${allowance} MP and ${maxCommands} commands.`]
        : []
    };
  }

  return {
    VALID_MISSIONS,
    VALID_SCOUT_ORDERS,
    UNKNOWN_COST_SCENARIOS,
    isFogOrQuestion,
    isOcean,
    isMountain,
    specialOrderFor,
    generate
  };
});

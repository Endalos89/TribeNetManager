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
  const TERRAIN_LIKELIHOOD_RADIUS = 2;
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

  function terrainLikelihood(known, coordinate) {
    const origin = core().parseCoordinate(coordinate);
    if (!origin) return { land: .65, ocean: .2, mountain: .15, passable: .65 };

    // This is a deliberately modest prior. Known nearby terrain then shifts
    // it: adjacent terrain is stronger evidence than terrain two hexes away.
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
      if (isOcean(row) || matchesFeature(row, 'lake')) ocean += weight;
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

  function addCoverageWeight(weights, key, value) {
    if (!key || !Number.isFinite(Number(value)) || Number(value) <= 0) return;
    const existing = Number(weights[key] || 0);
    weights[key] = Math.max(existing, Number(value));
  }

  function routeCoverageWeights(known, route) {
    const weights = {};
    let reachProbability = 1;
    for (let index = 0; index < (route.path || []).length; index += 1) {
      const point = route.path[index];
      const row = known.get(point.coordinate);
      if (index > 0 && isUnknownEntry(row)) {
        reachProbability *= terrainLikelihood(known, point.coordinate).passable;
        addCoverageWeight(weights, point.coordinate, reachProbability);
      }
      const parsed = core().parseCoordinate(point.coordinate);
      if (!parsed || reachProbability <= 0) continue;
      for (const adjacent of core().adjacentHexes(parsed)) {
        const neighbour = known.get(adjacent.coordinate);
        if (!neighbour) {
          addCoverageWeight(weights, adjacent.coordinate, reachProbability * terrainLikelihood(known, adjacent.coordinate).passable);
        } else if (isFogOrQuestion(neighbour) && !isOcean(neighbour)) {
          addCoverageWeight(weights, adjacent.coordinate, reachProbability * terrainLikelihood(known, adjacent.coordinate).passable);
        } else if (isOcean(neighbour)) {
          // Ocean is useful as a coastline signal, but it is not another
          // question-mark land hex to maximise.
          addCoverageWeight(weights, `ocean:${adjacent.coordinate}`, reachProbability * .1);
        }
      }
    }
    if (route.targetCoordinate && !isOcean(known.get(route.targetCoordinate))) {
      addCoverageWeight(weights, route.targetCoordinate, reachProbability * terrainLikelihood(known, route.targetCoordinate).passable);
    }
    return weights;
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

  function optimisticUnknownRoute(known, originCoordinate, targetCoordinate, options = {}) {
    const target = core().parseCoordinate(targetCoordinate);
    if (!target) return null;
    const maxCommands = Math.max(1, Number(options.maxCommands || 9));
    const queue = [{ point: target, path: [target] }];
    const visited = new Set([target.coordinate]);
    const approaches = [];
    while (queue.length && visited.size <= 240) {
      const current = queue.shift();
      if (current.path.length - 1 >= maxCommands) continue;
      for (const adjacent of core().adjacentHexes(current.point)) {
        if (visited.has(adjacent.coordinate)) continue;
        visited.add(adjacent.coordinate);
        const row = known.get(adjacent.coordinate);
        const path = [adjacent, ...current.path];
        if (isPassable(row)) {
          approaches.push({ coordinate: adjacent.coordinate, path });
          continue;
        }
        if (!row || isUnknownEntry(row)) queue.push({ point: adjacent, path });
      }
    }

    let best = null;
    for (const approach of approaches) {
      const route = core().findFastestRoute(known, originCoordinate, approach.coordinate);
      if (route.status !== 'ok') continue;
      const unknownSteps = approach.path.length - 1;
      const optimisticMp = Number(route.totalMp || 0) + unknownSteps * OPTIMISTIC_UNKNOWN_COST;
      const steps = Number(route.steps || route.directions?.length || 0) + unknownSteps;
      if (optimisticMp > Number(options.movementAllowance ?? Infinity) || steps > maxCommands) continue;
      const score = optimisticMp * 100 + steps;
      if (!best || score < best.score) best = { route, path: approach.path, score };
    }
    if (!best) return null;

    const path = [
      ...(best.route.path || []).map(point => ({ ...point })),
      ...best.path.slice(1).map(point => {
        const row = known.get(point.coordinate);
        return {
          ...point,
          terrain: terrainOf(row),
          entryMp: null,
          baseEntryMp: null,
          weatherPenalty: null,
          cumulativeMp: null,
          knownCumulativeMp: Number(best.route.totalMp || 0),
          kind: 'approx'
        };
      })
    ];
    const directions = [...(best.route.directions || [])];
    for (let index = 1; index < best.path.length; index += 1) {
      const direction = directionBetween(best.path[index - 1].coordinate, best.path[index].coordinate);
      if (!direction) return null;
      directions.push(direction);
    }
    return {
      ...best.route,
      status: 'ok',
      requestedTarget: target.coordinate,
      actualTarget: best.route.actualTarget || best.path[0].coordinate,
      targetIsUnknown: true,
      path,
      directions,
      steps: path.length - 1,
      targetIncluded: true
    };
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
    let result = core().findFastestRoute(working, origin.coordinate, targetCoordinate);
    if (result.status !== 'ok') {
      const requestedRow = known.get(targetCoordinate);
      if (requestedRow && !isUnknownEntry(requestedRow)) return result;
      result = optimisticUnknownRoute(known, origin.coordinate, targetCoordinate, options);
      if (!result) return result || { status: 'no-route' };
    }

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
    if (targetIsUnknown && actual && requested && actual.coordinate !== requested.coordinate && !result.targetIncluded) {
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
      const branch = Math.max(0, Math.floor(Number(options.extensionVariant || 0)));
      const next = nextOptions[Math.min(branch, nextOptions.length - 1)];
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

  function specialOrderContextFor(known, path, targetCoordinate) {
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
        .sort((left, right) => Number(featureFor(left.row) !== 'ocean') - Number(featureFor(right.row) !== 'ocean'))
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
    return VALID_SCOUT_ORDERS.has(order) ? { order, edgeIndex } : null;
  }

  function specialOrderFor(known, path, targetCoordinate) {
    return specialOrderContextFor(known, path, targetCoordinate)?.order || null;
  }

  function directionIndex(direction) {
    return (core().DIRECTIONS || ['N', 'NE', 'SE', 'S', 'SW', 'NW']).indexOf(direction);
  }

  function sideForFeature(moveDirection, featureDirection) {
    const moveIndex = directionIndex(moveDirection);
    const featureIndex = directionIndex(featureDirection);
    if (moveIndex < 0 || featureIndex < 0) return null;
    const delta = (featureIndex - moveIndex + 6) % 6;
    return delta === 1 || delta === 2 ? 'right'
      : delta === 4 || delta === 5 ? 'left' : null;
  }

  function firstCoastalUnknown(known, endpoint, side) {
    const directions = core().DIRECTIONS || ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
    const queue = [{ point: endpoint, visited: new Set([endpoint.coordinate]) }];
    const delta = side === 'right' ? -1 : 1;

    while (queue.length && queue[0].visited.size <= 90) {
      const current = queue.shift();
      const oceanIndexes = directions
        .map((direction, index) => ({ index, point: core().step(current.point, direction) }))
        .filter(item => item.point && isOcean(known.get(item.point.coordinate)));
      const preferred = [];
      for (const edge of oceanIndexes) {
        for (const offset of [delta, delta * 2, -delta, -delta * 2, 0]) {
          const candidate = core().step(current.point, directions[(edge.index + offset + 6) % 6]);
          if (candidate && !preferred.some(point => point.coordinate === candidate.coordinate)) preferred.push(candidate);
        }
      }
      for (const candidate of preferred) {
        const row = known.get(candidate.coordinate);
        if (!row || isUnknownEntry(row)) return candidate;
        if (!isOcean(row) && !current.visited.has(candidate.coordinate)) {
          const visited = new Set(current.visited);
          visited.add(candidate.coordinate);
          queue.push({ point: candidate, visited });
        }
      }
    }
    return null;
  }

  function coastalRouteCandidates(known, originCoordinate, allowance, maxCommands) {
    const origin = core().parseCoordinate(originCoordinate);
    if (!origin) return [];
    const candidates = [];
    const seen = new Set();

    for (const row of known.values()) {
      if (!isPassable(row) || row.coordinate === origin.coordinate) continue;
      const endpoint = core().parseCoordinate(row.coordinate);
      const route = core().findFastestRoute(known, origin.coordinate, row.coordinate);
      if (!endpoint || route.status !== 'ok' || !route.directions?.length) continue;
      const knownMp = Number(route.totalMp || 0);
      if (knownMp + OPTIMISTIC_UNKNOWN_COST > allowance || route.directions.length >= maxCommands) continue;
      const moveDirection = route.directions[route.directions.length - 1];

      for (const ocean of core().adjacentHexes(endpoint)) {
        if (!isOcean(known.get(ocean.coordinate))) continue;
        const side = sideForFeature(moveDirection, ocean.direction);
        if (!side) continue;
        const order = side === 'right' ? 'FOR' : 'FOL';
        const destination = firstCoastalUnknown(known, endpoint, side);
        if (!destination) continue;
        const signature = `${[...route.directions, order].join('>')}|${[...route.path, destination].map(point => point.coordinate).join('>')}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        const destinationRow = known.get(destination.coordinate);
        const path = [
          ...(route.path || []).map(point => ({ ...point })),
          {
            ...destination,
            terrain: terrainOf(destinationRow),
            entryMp: null,
            baseEntryMp: null,
            weatherPenalty: null,
            cumulativeMp: null,
            knownCumulativeMp: knownMp,
            unknownCumulativeCount: 1,
            kind: 'approx'
          }
        ];
        candidates.push({
          ...route,
          path,
          directions: [...route.directions, order],
          targetIsUnknown: true,
          targetCoordinate: destination.coordinate,
          destinationCoordinate: destination.coordinate,
          knownMp,
          totalMp: knownMp,
          steps: path.length - 1,
          unknownEntryCount: 1,
          badWeatherMp: Number(route.badWeatherMp || knownMp),
          specialOrder: order
        });
      }
    }
    return candidates;
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
    const weightedCoverage = route.coverageWeights || Object.fromEntries((route.coverage || []).map(key => [key, 1]));
    let newCoverage = 0;
    let overlap = 0;
    for (const [key, weight] of Object.entries(weightedCoverage)) {
      const existing = covered instanceof Map ? Number(covered.get(key) || 0) : (covered.has(key) ? 1 : 0);
      const value = Number(weight || 0);
      newCoverage += value * (1 - existing);
      overlap += value * existing;
    }
    const repeatedSignature = previousRoutes.some(previous => previous.signature === route.signature);
    const coastalBonus = /^FO[LR]$/i.test(route.specialOrder || '') ? 280 : 0;
    const likelihoodBonus = Number(route.expectedCoverage || 0) * 8;
    // Expected new coverage dominates. A route that only repeats already
    // covered hexes should therefore lose, while a different path remains
    // viable when it adds genuinely new coverage or hedges terrain risk.
    return newCoverage * 1000
      + coastalBonus
      + likelihoodBonus
      - route.estimatedMp * 2
      - route.worstCaseMp * .5
      - overlap * 12
      - (repeatedSignature ? 500 : 0);
  }

  function candidateFromRoute(known, route, options = {}) {
    const effectiveRoute = options.effectiveRoute || route;
    const directions = [...(options.directions || route.directions || [])];
    const coverage = addCoverage(new Set(), known, effectiveRoute);
    if (!coverage.size) return null;
    if (directions.some(order => !VALID_SCOUT_ORDERS.has(order) || order === 'GOTO')) return null;
    const effectiveUnknownEntryCount = (effectiveRoute.path || []).slice(1)
      .filter(point => isUnknownEntry(known.get(point.coordinate))).length;
    const knownMp = Number(route.knownMp ?? route.totalMp ?? 0);
    const effectiveScenario = UNKNOWN_COST_SCENARIOS.map(cost => knownMp + effectiveUnknownEntryCount * cost);
    const coverageWeights = routeCoverageWeights(known, { ...effectiveRoute, targetCoordinate: route.targetCoordinate });
    return {
      ...route,
      path: effectiveRoute.path,
      directions,
      unknownEntryCount: effectiveUnknownEntryCount,
      estimatedMp: effectiveScenario[1],
      worstCaseMp: effectiveScenario[2],
      scenarioMp: { low: effectiveScenario[0], expected: effectiveScenario[1], high: effectiveScenario[2] },
      optimisticMp: effectiveScenario[0],
      unitCode: options.unitCode || '',
      routeType: 'scout',
      noOfScouts: options.people,
      noOfHorses: options.horses,
      mission: options.mission,
      specialOrder: options.specialOrder || route.specialOrder || null,
      coverage: [...coverage],
      coverageWeights,
      coverageCount: coverage.size,
      expectedCoverage: Object.values(coverageWeights).reduce((total, value) => total + Number(value || 0), 0),
      signature: `${directions.join('>')}|${effectiveRoute.path.map(point => point.coordinate).join('>')}`,
      destinationHex: options.destinationHex || route.destinationCoordinate,
      movementAllowance: options.allowance,
      mounted: options.mounted
    };
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
    const candidateSignatures = new Set();
    const candidateOptions = {
      unitCode: options.unitCode || '',
      people,
      horses,
      mission,
      allowance,
      mounted
    };
    const addRouteCandidate = candidate => {
      if (!candidate || candidateSignatures.has(candidate.signature)) return;
      candidateSignatures.add(candidate.signature);
      candidates.push(candidate);
    };

    // Build coastline routes independently of target ranking. This guarantees
    // that a reachable known coastline gets a dedicated FOL/FOR candidate even
    // when the best fog target is somewhere else.
    for (const route of coastalRouteCandidates(known, origin.coordinate, allowance, maxCommands)) {
      addRouteCandidate(candidateFromRoute(known, route, {
        ...candidateOptions,
        effectiveRoute: route,
        directions: route.directions,
        specialOrder: route.specialOrder,
        destinationHex: route.destinationCoordinate
      }));
    }

    for (const target of targets) {
      // A target can have several equally plausible unknown continuations.
      // Keep a small branch set so the selection pass has real alternatives
      // instead of filling every requested row with one greedy route.
      const variantCount = Math.min(4, Math.max(1, scoutRows));
      for (let extensionVariant = 0; extensionVariant < variantCount; extensionVariant += 1) {
        const route = routeWithUnknownTarget(known, origin.coordinate, target.coordinate, {
          maxCommands,
          movementAllowance: allowance,
          extensionVariant
        });
        if (!route || route.status !== 'ok' || !route.directions?.length || route.optimisticMp > allowance) continue;
        const specialContext = specialOrderContextFor(known, route.path, target.coordinate);
        const specialOrder = specialContext?.order || null;
        let effectiveRoute = route;
        let directions = [...route.directions];
        let destinationHex = route.destinationCoordinate;
        if (specialContext && specialContext.edgeIndex > 0) {
          // FOL/FOR must be the final order and must start from the last known
          // land hex. Do not leave ordinary unknown-terrain commands after it.
          const firstUnknownIndex = specialContext.edgeIndex + 1;
          const coastalPath = route.path.slice(0, Math.min(route.path.length, firstUnknownIndex + 1));
          effectiveRoute = { ...route, path: coastalPath };
          directions = [...route.directions.slice(0, specialContext.edgeIndex), specialOrder];
          destinationHex = route.path[firstUnknownIndex]?.coordinate || route.destinationCoordinate;
        }
        addRouteCandidate(candidateFromRoute(known, route, {
          ...candidateOptions,
          effectiveRoute,
          directions,
          specialOrder,
          destinationHex
        }));
      }
    }

    const selected = [];
    const coveredWeights = new Map();
    const selectRoute = route => {
      selected.push({ ...route, scoutIndex: selected.length + 1 });
      for (const [key, weight] of Object.entries(route.coverageWeights || {})) {
        const existing = Number(coveredWeights.get(key) || 0);
        const probability = Number(weight || 0);
        // Union probability: a second route may still reveal a hex the first
        // route failed to reveal, but with diminishing marginal value.
        coveredWeights.set(key, existing + (1 - existing) * probability);
      }
    };

    // A known coastline deserves one route of its own. Without FOL/FOR, a
    // scout that reaches the water simply stops and wastes the remainder of
    // its exploration allowance.
    const coastalCandidates = candidates.filter(route => /^FO[LR]$/i.test(route.specialOrder || ''));
    if (coastalCandidates.length && scoutRows > 0) {
      const bestCoastal = coastalCandidates
        .map(route => ({ route, score: routeScore(route, coveredWeights, selected) }))
        .sort((left, right) => right.score - left.score || left.route.worstCaseMp - right.route.worstCaseMp || left.route.signature.localeCompare(right.route.signature))[0]?.route;
      if (bestCoastal) selectRoute(bestCoastal);
    }

    for (let index = selected.length; index < scoutRows; index++) {
      if (!candidates.length) break;
      const unusedSignatures = new Set(candidates.map(route => route.signature));
      for (const previous of selected) unusedSignatures.delete(previous.signature);
      // Do not save the same exact route repeatedly just to fill the requested
      // row count. A short warning is safer than producing duplicate orders
      // that give the player false coverage.
      if (!unusedSignatures.size) break;
      const pool = candidates.filter(route => unusedSignatures.has(route.signature));
      const ranked = pool.map(route => ({ route, score: routeScore(route, coveredWeights, selected) }))
        .sort((left, right) => right.score - left.score || left.route.worstCaseMp - right.route.worstCaseMp || left.route.signature.localeCompare(right.route.signature));
      const best = ranked[0]?.route;
      if (!best) break;
      selectRoute(best);
    }

    return {
      routes: selected,
      targets,
      covered: [...coveredWeights.keys()],
      totalCoverage: coveredWeights.size,
      mounted,
      allowance,
      mission,
      expectedCoverage: [...coveredWeights.values()].reduce((total, value) => total + Number(value || 0), 0),
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
    terrainLikelihood,
    specialOrderFor,
    generate
  };
});

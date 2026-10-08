(function attachConditionalOrders(root, factory) {
  const plannerCore = root?.MovementPlannerCore || (typeof require === 'function' ? require('./movement-planner-core') : null);
  const api = factory(plannerCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ConditionalOrders = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function conditionalOrdersFactory(MovementPlannerCore) {
  const DIRECTIONS = MovementPlannerCore?.DIRECTIONS || ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
  const FEATURE_CODES = Object.freeze({
    ocean: ['O', 'OCEAN'],
    lake: ['L', 'LAKE'],
    mountain: ['HSM', 'ALPS', 'MOUNTAIN', 'MOUNTAINS'],
    river: ['R', 'RIVER']
  });

  // These are order semantics, not path results. The game resolves the path
  // after the order is submitted and after more terrain is revealed.
  const DEFINITIONS = Object.freeze({
    FOL: Object.freeze({ token: 'FOL', feature: 'ocean', side: 'left' }),
    FOR: Object.freeze({ token: 'FOR', feature: 'ocean', side: 'right' }),
    FLL: Object.freeze({ token: 'FLL', feature: 'lake', side: 'left' }),
    FLR: Object.freeze({ token: 'FLR', feature: 'lake', side: 'right' }),
    FML: Object.freeze({ token: 'FML', feature: 'mountain', side: 'left' }),
    FMR: Object.freeze({ token: 'FMR', feature: 'mountain', side: 'right' }),
    FRL: Object.freeze({ token: 'FRL', feature: 'river', side: 'left' }),
    FRR: Object.freeze({ token: 'FRR', feature: 'river', side: 'right' })
  });

  function core() {
    if (!MovementPlannerCore) throw new Error('The movement planner core is not loaded.');
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

  function hasFeature(row, feature) {
    const terrain = terrainOf(row);
    const notes = noteOf(row);
    return FEATURE_CODES[feature]?.includes(terrain)
      || (feature === 'ocean' && /\bOCEAN\b/.test(notes))
      || (feature === 'lake' && /\bLAKE\b/.test(notes))
      || (feature === 'mountain' && /\bMOUNTAIN(?:S)?\b|\bALPS\b|\bHSM\b/.test(notes))
      || (feature === 'river' && /\bRIVER\b/.test(notes));
  }

  function isUnknown(row) {
    if (!row) return true;
    if (hasFeature(row, 'ocean') || hasFeature(row, 'lake') || hasFeature(row, 'mountain')) return false;
    const terrain = terrainOf(row);
    const knowledge = knowledgeOf(row);
    const marker = `${row?.marker || ''} ${row?.status || ''}`.toUpperCase();
    return ['UNKNOWN', '?', 'UNEXPLORED'].includes(terrain)
      || ['OBSERVED', 'ATTEMPTED', 'PARTIAL', 'FOG', 'UNEXPLORED', 'UNKNOWN'].includes(knowledge)
      || marker.includes('?')
      || marker.includes('FOG');
  }

  function isPassable(row) {
    return core().isRevealedLand(row);
  }

  function directionIndex(direction) {
    return DIRECTIONS.indexOf(canonical(direction));
  }

  function sideForFeature(moveDirection, featureDirection) {
    const moveIndex = directionIndex(moveDirection);
    const featureIndex = directionIndex(featureDirection);
    if (moveIndex < 0 || featureIndex < 0) return null;
    const delta = (featureIndex - moveIndex + 6) % 6;
    return delta === 1 || delta === 2 ? 'right'
      : delta === 4 || delta === 5 ? 'left' : null;
  }

  function rowMap(rowsOrMap) {
    return rowsOrMap instanceof Map ? new Map(rowsOrMap) : core().buildKnownHexMap(rowsOrMap || []);
  }

  function pointFor(input) {
    if (typeof input === 'string') return core().parseCoordinate(input);
    if (input && Number.isFinite(Number(input.globalCol)) && Number.isFinite(Number(input.globalRow))) return input;
    return input?.coordinate ? core().parseCoordinate(input.coordinate) : null;
  }

  function featureEdges(known, point, feature) {
    return core().adjacentHexes(point)
      .filter(next => hasFeature(known.get(next.coordinate), feature));
  }

  function clampProbability(value, fallback = .65) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }

  function candidateSteps(known, point, heading, definition) {
    const edges = featureEdges(known, point, definition.feature);
    if (!edges.length) return [];

    return core().adjacentHexes(point)
      .filter(next => !hasFeature(known.get(next.coordinate), definition.feature))
      .map(next => {
        const row = known.get(next.coordinate);
        const matchingEdges = edges.filter(edge => sideForFeature(next.direction, edge.direction) === definition.side);
        return { ...next, row, matchingEdges };
      })
      .filter(next => next.matchingEdges.length && (isUnknown(next.row) || isPassable(next.row)))
      .sort((left, right) => {
        const leftSame = canonical(left.direction) === canonical(heading) ? 0 : 1;
        const rightSame = canonical(right.direction) === canonical(heading) ? 0 : 1;
        return leftSame - rightSame || directionIndex(left.direction) - directionIndex(right.direction);
      });
  }

  function addWeight(weights, coordinate, value) {
    if (!coordinate || !Number.isFinite(Number(value)) || Number(value) <= 0) return;
    const key = String(coordinate);
    const existing = Number(weights[key] || 0);
    // A coordinate can be reached through multiple known coastline branches.
    // Union the probabilities rather than counting it multiple times.
    weights[key] = 1 - ((1 - existing) * (1 - Math.max(0, Math.min(1, Number(value)))));
  }

  function preview(rowsOrMap, startInput, headingInput, token, options = {}) {
    const known = rowMap(rowsOrMap);
    const order = canonical(token);
    const definition = DEFINITIONS[order];
    const start = pointFor(startInput);
    const heading = canonical(headingInput);
    const allowance = Math.max(0, Number(options.remainingMp ?? Infinity));
    const optimisticUnknownCost = Math.max(1, Number(options.optimisticUnknownCost || 3));
    const maxSteps = Math.max(1, Math.min(12, Math.floor(Number(options.maxSteps || 6))));
    const landProbability = typeof options.landProbability === 'function'
      ? coordinate => clampProbability(options.landProbability(coordinate, known.get(coordinate), known))
      : () => .65;

    if (!definition) return { valid: false, token: order, warnings: [`${order || 'Conditional order'} is not supported.`] };
    if (!start) return { valid: false, token: order, warnings: ['The conditional-order origin is not a valid hex.'] };

    const startPoint = { ...start, kind: 'exact' };
    const queue = [{
      point: start,
      heading,
      path: [startPoint],
      usedMp: 0,
      probability: 1,
      visited: new Set([start.coordinate])
    }];
    const predictionPaths = [];
    const coverageWeights = {};
    let bestKnownPath = [startPoint];
    let bestFrontierProbability = 0;
    let bestFrontierUsedMp = 0;
    let visitedStates = 0;

    while (queue.length && visitedStates < 320) {
      const current = queue.shift();
      visitedStates += 1;
      const nextSteps = candidateSteps(known, current.point, current.heading, definition);
      if (!nextSteps.length) continue;

      for (const next of nextSteps) {
        if (current.visited.has(next.coordinate)) continue;
        const unresolved = isUnknown(next.row);
        const entryCost = unresolved
          ? optimisticUnknownCost
          : core().terrainMovementCost(terrainOf(next.row), 0);
        if (entryCost == null || current.usedMp + entryCost > allowance) continue;

        const probability = current.probability * (unresolved ? landProbability(next.coordinate) : 1);
        const path = [
          ...current.path,
          { ...next, kind: 'conditional', order }
        ];

        if (unresolved) {
          addWeight(coverageWeights, next.coordinate, probability);
          predictionPaths.push({
            path,
            probability,
            usedMp: current.usedMp + entryCost,
            featureEdges: next.matchingEdges.map(edge => edge.coordinate)
          });
          if (probability > bestFrontierProbability) {
            bestFrontierProbability = probability;
            bestFrontierUsedMp = current.usedMp + entryCost;
            bestKnownPath = path;
          }
          continue;
        }

        const visited = new Set(current.visited);
        visited.add(next.coordinate);
        queue.push({
          point: next,
          heading: next.direction,
          path,
          usedMp: current.usedMp + entryCost,
          probability,
          visited
        });
      }
    }

    const firstEdges = featureEdges(known, start, definition.feature);
    const valid = firstEdges.length > 0 && predictionPaths.length > 0;
    const continuationSteps = valid
      ? Math.max(0, Math.min(maxSteps, Math.floor(Math.max(0, allowance - bestFrontierUsedMp) / optimisticUnknownCost)))
      : 0;
    const expectedCoverage = Object.values(coverageWeights).reduce((total, value) => total + Number(value || 0), 0);

    predictionPaths.sort((left, right) => right.probability - left.probability || left.path.length - right.path.length);
    return {
      valid,
      dynamic: true,
      token: order,
      feature: definition.feature,
      side: definition.side,
      anchor: startPoint,
      featureEdges: firstEdges.map(edge => edge.coordinate),
      predictionPaths: predictionPaths.slice(0, 8).map(item => item.path),
      previewPath: bestKnownPath,
      coverageWeights,
      expectedCoverage,
      continuationSteps,
      continuationPotential: bestFrontierProbability * continuationSteps,
      warnings: valid
        ? [`${order} is conditional: the game will continue following the ${definition.feature} with it on the ${definition.side}. The displayed corridor is only a forecast.`]
        : [`${order} has no visible ${definition.feature} continuation that is expected to reveal land from this hex.`]
    };
  }

  function orderForFeature(rowsOrMap, endpointInput, heading, targetInput) {
    const known = rowMap(rowsOrMap);
    const endpoint = pointFor(endpointInput);
    const target = pointFor(targetInput);
    if (!endpoint || !target) return null;
    const featureRow = known.get(target.coordinate);
    const feature = Object.keys(FEATURE_CODES).find(name => hasFeature(featureRow, name));
    if (!feature) return null;
    const side = sideForFeature(heading, core().adjacentHexes(endpoint).find(next => next.coordinate === target.coordinate)?.direction);
    if (!side) return null;
    const token = Object.values(DEFINITIONS).find(definition => definition.feature === feature && definition.side === side)?.token;
    return token || null;
  }

  return {
    DEFINITIONS,
    FEATURE_CODES,
    hasFeature,
    isUnknown,
    isPassable,
    sideForFeature,
    orderForFeature,
    preview
  };
});

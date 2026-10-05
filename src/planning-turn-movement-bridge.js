// A synthetic planning turn has no Results rows of its own yet. Route finding must
// therefore use the latest actual Results turn as its terrain/knowledge baseline.
const planningTurnMovementOriginalLoadKnowledge = movementPlannerLoadKnowledge;

movementPlannerLoadKnowledge = async function movementPlannerLoadPlanningBaselineKnowledge() {
  if (!resultsTimeline?.turn?.isPlanningTurn) {
    return planningTurnMovementOriginalLoadKnowledge();
  }

  const baselineTurnKey = resultsTimeline.turn.knowledgeTurnKey || resultsTimeline.turn.baselineTurnKey;
  const planningTurnKey = resultsTimeline.turn.turnKey;
  const key = `planning:${planningTurnKey}:baseline:${baselineTurnKey}`;
  if (movementPlannerState.knownHexes && movementPlannerState.knowledgeKey === key) {
    return movementPlannerState.knownHexes;
  }

  const bounds = { minCol: 0, maxCol: TOTAL_COLS - 1, minRow: 0, maxRow: TOTAL_ROWS - 1 };
  const rows = baselineTurnKey
    ? await window.tribenet.getResultHexesInArea(bounds, baselineTurnKey)
    : (resultsTimeline.turn.startHexKnowledge || []);

  movementPlannerState.knownHexes = MovementPlannerCore.buildKnownHexMap(rows);
  movementPlannerState.knowledgeKey = key;
  return movementPlannerState.knownHexes;
};

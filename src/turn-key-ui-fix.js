(() => {
  function canonical(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d+)[-_](\d+)$/);
    if (!match) return text || null;
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }

  const storageKey = 'tribenet:selectedResultTurn';
  const stored = localStorage.getItem(storageKey);
  const normalizedStored = canonical(stored);
  if (stored && normalizedStored && stored !== normalizedStored) localStorage.setItem(storageKey, normalizedStored);

  if (typeof TurnLifecycleCore !== 'undefined') {
    const originalPlanningKey = TurnLifecycleCore.planningTurnKey;
    TurnLifecycleCore.planningTurnKey = resultTurn => canonical(originalPlanningKey(resultTurn));

    const originalPlanningEntry = TurnLifecycleCore.planningTimelineEntry;
    TurnLifecycleCore.planningTimelineEntry = turns => {
      const entry = originalPlanningEntry(turns);
      if (!entry) return entry;
      const turnKey = canonical(entry.turnKey);
      return {
        ...entry,
        turnKey,
        metadata: { ...(entry.metadata || {}), planningTurn: turnKey }
      };
    };
  }
})();

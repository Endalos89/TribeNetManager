/* Results playback: activities, movement segments, then scouting reveals. */
(function(root) {
  const playback = root.resultsPlayback = {
    active: false,
    paused: false,
    phase: 'idle',
    events: [],
    index: 0,
    progress: 0,
    startedAt: 0,
    startTurnKey: null,
    eventTurnKey: null,
    targetTurnKey: null,
    targetUnitCodes: new Set(),
    revealed: new Set(),
    revealedQuestions: new Set(),
    revealTargets: new Set(),
    // Bumped whenever the baseline/reveal state changes. The 3D renderer uses
    // this to invalidate its cached terrain surface during playback.
    renderRevision: 0,
    baselineHexes: new Map(),
    targetHexes: new Map(),
    baselineLoaded: false,
    baselineTurnKey: null,
    autoHandoff: false,
    onComplete: null,
    raf: null,
    audioContext: null,
    audioByPhase: new Map(),
    speed: 1
  };

  const SPEED_STORAGE_KEY = 'tribenet:resultsPlaybackSpeed';

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function modelCount(value) {
    const n = Math.max(0, Math.floor(number(value)));
    return n < 1 ? 0 : Math.floor(Math.log10(n)) + 1;
  }

  function pointFor(coordinate) {
    const parsed = typeof parseCoordinate === 'function' ? parseCoordinate(coordinate) : null;
    return parsed ? { ...parsed, coordinate: parsed.coordinate || coordinate } : null;
  }

  // Route builders normally return parsed coordinate objects, but imported
  // reports and older saved plans can leave only a coordinate string on the
  // last point.  Keep the playback path fully drawable in both cases.
  function routePoint(value) {
    if (!value) return null;
    if (Number.isFinite(Number(value.globalCol)) && Number.isFinite(Number(value.globalRow))) {
      return { ...value, coordinate: value.coordinate || (typeof coordinateFor === 'function' ? coordinateFor(Number(value.globalCol), Number(value.globalRow)) : undefined) };
    }
    return pointFor(value.coordinate || value);
  }

  function splitTopLevel(text) {
    const output = [], source = String(text || '').trim();
    let depth = 0, start = 0;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '(') depth += 1;
      else if (char === ')') depth = Math.max(0, depth - 1);
      else if (char === ',' && depth === 0) {
        const part = source.slice(start, i).trim(); if (part) output.push(part);
        start = i + 1;
      }
    }
    const tail = source.slice(start).trim(); if (tail) output.push(tail);
    return output;
  }

  function activityClauses(message) {
    const comma = String(message || '').indexOf(',');
    const body = comma >= 0 ? String(message).slice(comma + 1).trim() : String(message || '').trim();
    return splitTopLevel(body);
  }

  function deltaChanges(unit) {
    const changes = [];
    for (const section of Object.values(unit?.deltas?.resources || {})) {
      for (const [name, raw] of Object.entries(section || {})) {
        const amount = number(raw);
        if (amount) changes.push({ name, amount });
      }
    }
    return changes;
  }

  function playbackMapData(coordinate, targetData) {
    if (!playback.active || !playback.baselineLoaded) return targetData;
    if (playback.revealed.has(coordinate) && !playback.revealedQuestions.has(coordinate)) {
      return playback.targetHexes.get(coordinate) || targetData;
    }
    const baseline = playback.baselineHexes.get(coordinate);
    return baseline && baseline.terrain !== 'UNKNOWN' ? baseline : null;
  }

  function hexCenter(point) {
    if (!point) return null;
    if (typeof baseCenter === 'function') return baseCenter(point.globalCol, point.globalRow);
    const col = Number(point.globalCol || 0), row = Number(point.globalRow || 0);
    return { x: 1 + col * 1.5, y: Math.sqrt(3) / 2 + Math.sqrt(3) * (row + (col % 2 ? .5 : 0)) };
  }

  function changeText(changes) {
    return (changes || []).map(change => `${change.amount > 0 ? '+' : ''}${change.amount.toLocaleString()} ${change.name}`).join(' · ');
  }

  const iconCache = new Map();
  function iconKey(name) {
    return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function itemIcon(name) {
    const filename = root.TribeNetItemIconManifest?.[iconKey(name)];
    if (!filename || typeof Image === 'undefined') return null;
    let image = iconCache.get(filename);
    if (!image) {
      image = new Image(); image.src = `item-icons/${filename}`; image.decoding = 'async';
      image.onload = () => { if (playback.active && typeof draw === 'function') draw(); };
      iconCache.set(filename, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  function activityChanges(clause, unit, isLastClause = false) {
    const text = String(clause || ''), changes = [];
    const add = (name, amount) => { if (name && amount) changes.push({ name: String(name).replace(/[.,;:]+$/, ''), amount }); };
    // Reports put several consumed resources in one parenthetical clause,
    // e.g. "using 100 Leather, 40 Bark". Keep every pair instead of only the
    // first one, without mistaking the next activity after the parenthesis for
    // another consumed resource.
    for (const section of text.matchAll(/using\s+([^)]*)/gi)) {
      for (const match of section[1].matchAll(/([\d,]+)\s+([A-Za-z][\w/-]*)/g)) add(match[2], -number(match[1].replace(/,/g, '')));
    }
    for (const match of text.matchAll(/(?:made|produced|crafted)\s+([\d,]+)\s+([A-Za-z][\w/-]*)/gi)) add(match[2], number(match[1].replace(/,/g, '')));
    const bred = text.match(/\bbred\s*\(([^)]+)\)/i);
    if (bred) for (const match of bred[1].matchAll(/([A-Za-z][\w/-]*)\s+([\d,]+)/g)) add(match[1], number(match[2].replace(/,/g, '')));
    for (const match of text.matchAll(/\b([A-Za-z][\w/-]*)\s+(?:cured|tanned|skinned|gutted|boned)\s+([\d,]+)/gi)) add(match[1], number(match[2].replace(/,/g, '')));
    // A slaughter/harvest clause commonly ends with “N Goat/Cattle/...”.
    if (/skin|gut|bone|slaughter|hunted/i.test(text)) {
      for (const match of text.matchAll(/\b([\d,]+)\s+(Goat|Cattle|Horse|Cow|Sheep|Pig|Deer|Animal)s?\b/gi)) add(match[2], -number(match[1].replace(/,/g, '')));
    }
    const butchered = text.match(/\b(skin(?:\\gut)?(?:\\bone)?|gut(?:\\bone)?|bone)\s+([\d,]+)\s+(Goat|Cattle|Horse|Cow|Sheep|Pig|Deer|Animal)s?\b/i);
    if (butchered) {
      for (const output of butchered[1].split('\\')) add(output, number(butchered[2].replace(/,/g, '')));
    }
    return changes.length || !isLastClause ? changes : deltaChanges(unit);
  }

  function activitySound(text) {
    const value = String(text || '').toLowerCase();
    if (/skin|gut|bone|slaughter|butcher/.test(value)) return 'butcher';
    if (/hunt|hunted/.test(value)) return 'hunt';
    if (/herd|herder|bred|breed/.test(value)) return 'herd';
    if (/cured|tanned|tan|crafted|craft|made\s+\d+\s+\w+/.test(value)) return 'craft';
    if (/wood|log|axe|b\/axe|carv/.test(value)) return 'wood';
    return 'unknown';
  }

  function currentSpeed() {
    const value = Number(playback.speed);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function now() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }

  function actualPlan(turn) {
    if (typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore.actualPlanFromResult) return TurnLifecycleCore.actualPlanFromResult(turn);
    return { movements: [], scouts: [] };
  }

  function playbackUnitPosition(unitCode, fallbackCoordinate) {
    const fallback = pointFor(fallbackCoordinate);
    if (!playback.active) return fallback;
    const events = playback.events.filter(event => event.phase === 'movement' && String(event.unitCode) === String(unitCode));
    if (!events.length) return fallback;
    const current = playback.events[playback.index];
    if (current?.phase === 'movement' && String(current.unitCode) === String(unitCode)) {
      const from = hexCenter(current.from), to = hexCenter(current.to);
      const eased = playback.progress * playback.progress * (3 - 2 * playback.progress);
      return { ...current.from, x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased, coordinate: current.from.coordinate || fallback?.coordinate };
    }
    const completed = playback.events.slice(0, playback.index).reverse().find(event => event.phase === 'movement' && String(event.unitCode) === String(unitCode));
    if (completed?.to) return pointFor(completed.to.coordinate) || completed.to;
    return pointFor(events[0].from.coordinate) || events[0].from || fallback;
  }

  function routesFor(turn) {
    const plan = actualPlan(turn);
    if (typeof buildPlanRoutes === 'function') return buildPlanRoutes(plan);
    return { movements: [], scouts: [] };
  }

  function borderPoint(from, to) {
    if (!from || !to) return null;
    const a = hexCenter(from);
    const b = hexCenter(to);
    // Stop just inside the attempted hex edge. The destination remains fogged
    // and receives the question marker, so a failed scout never appears to
    // have entered the tile.
    return { x: a.x + (b.x - a.x) * .48, y: a.y + (b.y - a.y) * .48 };
  }

  function normalisePartialReport(value) {
    return String(value || '').replace(/[’]/g, "'");
  }

  function partialDirection(value) {
    const text = normalisePartialReport(value);
    // Reports have appeared as M.P's, M.Ps, M.P’s and MP's.  They all mean
    // the same exhausted-movement result; keep the direction that follows
    // "to move to" so it can be animated as its own border segment.
    return text.match(/not enough\s+m\.?\s*p\.?\s*'?s?\b[\s\S]*?\bto\s+move\s+to\s+(N|NE|SE|S|SW|NW)\b/i)?.[1]?.toUpperCase() || null;
  }

  function coordinateIsAdjacent(point, coordinate) {
    if (!point || !coordinate || typeof stepHex !== 'function') return false;
    return ['N', 'NE', 'SE', 'S', 'SW', 'NW'].some(direction => stepHex(point, direction)?.coordinate === coordinate);
  }

  function attachRevealCoordinates(events, turn) {
    const targetRows = [];
    for (const row of playback.targetHexes.values()) {
      if (!row?.coordinate) continue;
      const baseline = playback.baselineHexes.get(row.coordinate);
      if (baseline && baseline.terrain && baseline.terrain !== 'UNKNOWN') continue;
      targetRows.push(row);
    }

    const remaining = new Set(targetRows.map(row => row.coordinate));
    for (const event of events) event.reveals = [];
    const add = (event, row) => {
      if (!event || !row?.coordinate || !remaining.has(row.coordinate)) return;
      event.reveals.push(row.coordinate);
      remaining.delete(row.coordinate);
    };

    // Movement reveals the hex as the unit arrives. Scout routes reveal their
    // entered hex one segment at a time; adjacent observations are revealed at
    // the end of the corresponding scouting run.
    for (const event of events) {
      if (!event.to?.coordinate) continue;
      for (const row of targetRows) {
        if (row.coordinate === event.to.coordinate) add(event, row);
      }
      if (event.phase === 'movement') {
        for (const row of targetRows) {
          if (String(row.sourceUnit || '') === String(event.unitCode || '') && row.knowledgeLevel === 'visited') add(event, row);
        }
      }
    }

    const scoutRuns = new Map();
    for (const event of events) {
      if (event.phase !== 'scouting') continue;
      const key = `${event.unitCode}:${event.scoutId}`;
      const run = scoutRuns.get(key) || [];
      run.push(event); scoutRuns.set(key, run);
      for (const row of targetRows) {
        if (String(row.sourceUnit || '') !== String(event.unitCode || '') || Number(row.scoutId || 0) !== Number(event.scoutId || 0)) continue;
        // A scout reports both the hex it entered and observations from its
        // current hex. Attach an adjacent observation to the segment where it
        // was made instead of deferring every observation to the final segment.
        if (row.coordinate === event.to?.coordinate
          || (row.knowledgeLevel === 'observed' && coordinateIsAdjacent(event.to, row.coordinate))) add(event, row);
      }
    }
    for (const run of scoutRuns.values()) {
      const last = run[run.length - 1];
      for (const row of targetRows) {
        if (String(row.sourceUnit || '') !== String(last.unitCode || '') || Number(row.scoutId || 0) !== Number(last.scoutId || 0)) continue;
        add(last, row);
      }
    }

    // A report can contain a current-hex visit or an observation without a
    // source row that matches a route segment. Do not let it appear at import;
    // reveal it with the first movement/scouting/activity event instead.
    const fallback = events.find(event => event.phase === 'movement')
      || events.find(event => event.phase === 'scouting')
      || events.find(event => event.phase === 'activities');
    if (fallback) for (const coordinate of remaining) { fallback.reveals.push(coordinate); remaining.delete(coordinate); }
  }

  function buildEvents(turn) {
    const events = [];
    const units = new Map((turn?.units || []).map(unit => [String(unit.unitCode), unit]));
    const activityEvents = (turn?.events || []).filter(event => event.eventType === 'activities');
    for (const event of activityEvents) {
      const unit = units.get(String(event.unitCode));
      const clauses = activityClauses(event.message);
      const rawActivityList = clauses.length ? clauses : [event.message];
      const activityList = [];
      for (const clause of rawActivityList) {
        const previous = activityList[activityList.length - 1];
        if (previous && activitySound(previous) === 'herd' && activitySound(clause) === 'herd') activityList[activityList.length - 1] = `${previous}, ${clause}`;
        else activityList.push(clause);
      }
      for (let clauseIndex = 0; clauseIndex < activityList.length; clauseIndex += 1) {
        const clause = activityList[clauseIndex];
        const changes = activityChanges(clause, unit, clauseIndex === activityList.length - 1);
        events.push({ phase: 'activities', unitCode: String(event.unitCode || ''), coordinate: unit?.previousHex || unit?.currentHex, title: 'Activity', text: clause, changes, sound: activitySound(clause), duration: 1050 });
      }
    }

    const routes = routesFor(turn);
    for (const movement of routes.movements || []) {
      const points = (movement.route?.points || []).map(routePoint).filter(Boolean);
      for (let i = 1; i < points.length; i += 1) events.push({ phase: 'movement', unitCode: String(movement.unit), from: points[i - 1], to: points[i], sound: 'movement', duration: 420 });
    }

    for (const scout of routes.scouts || []) {
      const rawPoints = scout.route?.points || [];
      const points = rawPoints.map(routePoint).filter(Boolean);
      const source = (turn?.units || []).find(unit => String(unit.unitCode) === String(scout.unit));
      const sourceScout = source?.scouts?.find(row => Number(row.id) === Number(scout.id));
      const scoutCount = Number(scout.noOfScouts || sourceScout?.noOfScouts || 0);
      const horseCount = Number(scout.noOfHorses || sourceScout?.noOfHorses || 0);
      const cartCount = Number(scout.noOfCarts || sourceScout?.noOfCarts || sourceScout?.carts || 0);
      const riders = modelCount(scoutCount || 1);
      const mounted = scoutCount > 0 && horseCount >= scoutCount && cartCount <= 0;
      for (let i = 1; i < points.length; i += 1) events.push({ phase: 'scouting', unitCode: String(scout.unit), scoutId: Number(scout.id), riders, mounted, from: points[i - 1], to: points[i], sound: mounted ? 'horse' : 'scout', duration: 440 });
      const direction = partialDirection(scout.report || scout.raw || sourceScout?.report || sourceScout?.raw);
      if (direction && points.length) {
        const last = points[points.length - 1];
        const attempted = typeof stepHex === 'function' ? routePoint(stepHex(last, direction)) : null;
        if (attempted && attempted.coordinate !== last.coordinate) events.push({ phase: 'scouting', unitCode: String(scout.unit), scoutId: Number(scout.id), riders, mounted, from: last, to: attempted, borderPoint: borderPoint(last, attempted), partial: true, sound: mounted ? 'horse' : 'scout', duration: 520 });
      }
    }
    attachRevealCoordinates(events, turn);
    return events;
  }

  function setButton() {
    const button = document.getElementById('mapResultPlayTurn');
    if (!button) return;
    button.textContent = playback.active ? (playback.paused ? 'Resume Turn' : 'Pause Turn') : 'Play Turn';
    button.classList.toggle('accent', !playback.active || playback.paused);
  }

  function phaseText(phase) {
    return phase === 'activities' ? 'Activities' : phase === 'movement' ? 'Movement' : phase === 'scouting' ? 'Scouting' : '';
  }

  function playTone(phase) {
    // The bundled clips are short CC0 UI sounds. Keep the oscillator fallback
    // for installations where the browser blocks local audio or a file is
    // unavailable; it is deliberately only a tiny UI cue.
    try {
      const sources = playback.soundSources;
      const Audio = root.Audio;
      const sound = sources[phase] ? phase : 'unknown';
      if (Audio && sources[sound]) {
        let audio = playback.audioByPhase.get(sound);
        if (!audio) { audio = new Audio(sources[sound]); audio.preload = 'auto'; playback.audioByPhase.set(sound, audio); }
        audio.currentTime = 0;
        audio.volume = .32;
        const started = audio.play();
        if (started?.catch) started.catch(() => {});
        return;
      }
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return;
      playback.audioContext ||= new AudioContext();
      const oscillator = playback.audioContext.createOscillator();
      const gain = playback.audioContext.createGain();
      oscillator.frequency.value = phase === 'butcher' ? 180 : phase === 'wood' ? 310 : phase === 'horse' ? 120 : phase === 'movement' || phase === 'scout' ? 250 : 690;
      oscillator.type = phase === 'scout' || phase === 'horse' ? 'triangle' : 'sine';
      gain.gain.setValueAtTime(.045, playback.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, playback.audioContext.currentTime + .08);
      oscillator.connect(gain); gain.connect(playback.audioContext.destination); oscillator.start(); oscillator.stop(playback.audioContext.currentTime + .09);
    } catch (_) { /* Audio is optional and may be blocked until user interaction. */ }
  }

  function cancelFrame() {
    if (playback.raf == null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(playback.raf);
    else clearTimeout(playback.raf);
    playback.raf = null;
  }

  function requestFrame(callback) {
    playback.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(() => callback(Date.now()), 40);
  }

  function stopResultsPlayback(options = {}) {
    cancelFrame();
    playback.active = false; playback.paused = false; playback.phase = 'idle'; playback.events = []; playback.index = 0; playback.progress = 0;
    playback.startTurnKey = null; playback.eventTurnKey = null; playback.targetTurnKey = null; playback.targetUnitCodes = new Set(); playback.revealed = new Set(); playback.revealedQuestions = new Set(); playback.revealTargets = new Set();
    playback.renderRevision += 1;
    playback.baselineHexes = new Map(); playback.targetHexes = new Map(); playback.baselineLoaded = false; playback.baselineTurnKey = null;
    playback.autoHandoff = false; playback.onComplete = null;
    setButton();
    if (options.draw !== false && typeof draw === 'function') draw();
  }

  function pauseResultsPlayback() {
    if (!playback.active || playback.paused) return false;
    cancelFrame(); playback.paused = true; setButton(); if (typeof draw === 'function') draw(); return true;
  }

  function resumeResultsPlayback() {
    if (!playback.active || !playback.paused) return false;
    const event = playback.events[playback.index];
    playback.paused = false;
    playback.startedAt = now() - playback.progress * ((event?.duration || 1) / currentSpeed());
    setButton(); if (typeof draw === 'function') draw(); requestFrame(tick); return true;
  }

  async function loadPlaybackBaseline(turn) {
    playback.baselineHexes = new Map();
    playback.baselineLoaded = false;
    playback.baselineTurnKey = turn?.knowledgeTurnKey || turn?.baselineTurnKey || null;
    const canFetch = root.tribenet?.getResultHexesInArea
      && typeof visibleBounds === 'function'
      && typeof state !== 'undefined'
      && state.mode === 'detail';
    if (canFetch) {
      const bounds = visibleBounds();
      const baselineRows = playback.baselineTurnKey
        ? await root.tribenet.getResultHexesInArea(bounds, playback.baselineTurnKey)
        : (turn?.startHexKnowledge || []);
      for (const row of baselineRows || []) if (row?.coordinate) playback.baselineHexes.set(row.coordinate, row);
      // Preserve older local knowledge only when a real historical baseline
      // exists.  The first imported report intentionally starts with its
      // report-derived starting hexes and must not inherit the live mapper's
      // broader cache.
      if (playback.baselineTurnKey) for (const row of state.hexCache.values()) {
        if (row?.coordinate && String(row.discoveredTurn || '') !== String(turn.turnKey || '') && !playback.baselineHexes.has(row.coordinate)) playback.baselineHexes.set(row.coordinate, row);
      }
    }
    playback.baselineLoaded = true;
  }

  async function loadPlaybackTarget(turnKey) {
    playback.targetHexes = new Map();
    if (!turnKey || !root.tribenet?.getResultHexesInArea || typeof visibleBounds !== 'function' || typeof state === 'undefined' || state.mode !== 'detail') return;
    const rows = await root.tribenet.getResultHexesInArea(visibleBounds(), turnKey);
    for (const row of rows || []) if (row?.coordinate) playback.targetHexes.set(row.coordinate, row);
  }

  async function extendPlaybackBaseline(bounds) {
    if (!playback.active || !root.tribenet?.getResultHexesInArea || !bounds) return;
    const baselineRows = playback.baselineTurnKey
      ? await root.tribenet.getResultHexesInArea(bounds, playback.baselineTurnKey)
      : [];
    const targetRows = playback.eventTurnKey
      ? await root.tribenet.getResultHexesInArea(bounds, playback.eventTurnKey)
      : [];
    let changed = false;
    for (const row of baselineRows || []) {
      if (!row?.coordinate || playback.baselineHexes.has(row.coordinate)) continue;
      playback.baselineHexes.set(row.coordinate, row);
      changed = true;
    }
    for (const row of targetRows || []) {
      if (!row?.coordinate || playback.targetHexes.has(row.coordinate)) continue;
      playback.targetHexes.set(row.coordinate, row);
      changed = true;
    }
    if (changed) playback.renderRevision += 1;
  }

  function collectRevealTargets(turn) {
    for (const row of playback.targetHexes.values()) {
      if (row?.coordinate) {
        const baseline = playback.baselineHexes.get(row.coordinate);
        if (!baseline || !baseline.terrain || baseline.terrain === 'UNKNOWN') playback.revealTargets.add(row.coordinate);
      }
    }
    for (const event of playback.events) {
      for (const coordinate of event.reveals || []) playback.revealTargets.add(coordinate);
      if (event.phase === 'scouting' && event.to?.coordinate) {
        const row = playback.targetHexes.get(event.to.coordinate);
        const baseline = playback.baselineHexes.get(event.to.coordinate);
        if ((!row || !baseline || !baseline.terrain || baseline.terrain === 'UNKNOWN')) playback.revealTargets.add(event.to.coordinate);
      }
      if (event.partial && event.to?.coordinate) playback.revealTargets.add(event.to.coordinate);
    }
  }

  async function completeResultsPlayback() {
    const targetTurnKey = playback.targetTurnKey;
    const callback = playback.onComplete;
    const handoff = playback.autoHandoff;
    if (typeof callback === 'function') {
      stopResultsPlayback({ draw: false });
      Promise.resolve(callback(targetTurnKey)).catch(error => console.error('Results playback completion failed', error));
    } else if (handoff && typeof root.advanceToNextStartState === 'function') {
      // Keep the target frame on screen while the next start-state snapshot
      // loads.  applyResultTurn() performs several async reads; allowing a
      // draw between those reads briefly exposes a reset/future-state frame.
      const timeline = root.resultsTimeline;
      if (timeline) timeline.transitionStaging = true;
      stopResultsPlayback({ draw: false });
      try {
        await root.advanceToNextStartState(targetTurnKey);
      } catch (error) {
        console.error('Planning handoff failed', error);
      } finally {
        if (timeline) timeline.transitionStaging = false;
        if (typeof draw === 'function') draw();
      }
    } else {
      stopResultsPlayback({ draw: false });
      if (typeof draw === 'function') draw();
    }
  }

  async function startResultsPlayback(options = {}) {
    const startState = root.resultsTimeline?.turn;
    if (!startState) return false;
    const eventTurnKey = options.eventTurnKey || startState.eventTurnKey || (!startState.isStartState ? startState.turnKey : null);
    const eventTurn = eventTurnKey && root.tribenet?.getResultTurn
      ? await root.tribenet.getResultTurn(eventTurnKey)
      : (!startState.isStartState ? startState : null);
    if (!eventTurn) return false;
    const events = buildEvents(eventTurn);
    stopResultsPlayback();
    playback.events = events; playback.active = events.length > 0; playback.paused = false; playback.index = 0; playback.progress = 0;
    playback.startedAt = now(); playback.startTurnKey = startState.turnKey; playback.eventTurnKey = eventTurn.turnKey; playback.targetTurnKey = eventTurn.turnKey;
    playback.targetUnitCodes = new Set(events.map(event => event.unitCode).filter(Boolean));
    // A completed report always resolves into the next turn's start state.
    // `handoff` remains accepted for older callers, but is no longer required
    // for the automatic transition.
    playback.autoHandoff = Boolean(options.handoff || options.autoHandoff || eventTurnKey);
    playback.onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    await loadPlaybackBaseline(startState);
    await loadPlaybackTarget(eventTurn.turnKey);
    attachRevealCoordinates(playback.events, eventTurn);
    collectRevealTargets(eventTurn);
    playback.phase = events[0]?.phase || 'idle';
    setButton();
    if (!playback.active) {
      if (typeof draw === 'function') draw();
      return false;
    }
    playTone(events[0]?.sound || playback.phase);
    if (typeof draw === 'function') draw();
    requestFrame(tick);
    return true;
  }

  function finishEvent(event) {
    for (const coordinate of event?.reveals || []) playback.revealed.add(coordinate);
    if (event?.phase === 'scouting' && event?.to?.coordinate) {
      playback.revealed.add(event.to.coordinate);
      if (event.partial) playback.revealedQuestions.add(event.to.coordinate);
    }
    playback.renderRevision += 1;
    playback.index += 1; playback.progress = 0;
    const next = playback.events[playback.index]; playback.phase = next?.phase || 'complete';
    if (next) playTone(next.sound || next.phase);
  }

  function tick(now) {
    if (!playback.active || playback.paused) return;
    const event = playback.events[playback.index];
    if (!event) { completeResultsPlayback(); return; }
    playback.phase = event.phase;
    playback.progress = Math.min(1, Math.max(0, (now - playback.startedAt) / (event.duration / currentSpeed())));
    if (playback.progress >= 1) {
      finishEvent(event); playback.startedAt = now;
      if (!playback.events[playback.index]) { completeResultsPlayback(); return; }
    }
    if (typeof draw === 'function') draw();
    requestFrame(tick);
  }

  function projectBase(point) {
    if (!point) return null;
    const base = { x: point.x ?? baseCenter(point.globalCol, point.globalRow).x, y: point.y ?? baseCenter(point.globalCol, point.globalRow).y };
    return typeof IsoMapper !== 'undefined' && IsoMapper.enabled ? IsoMapper.project(base) : screenFromBase(base);
  }

  function lerpPoint(from, to, progress, edge = null) {
    const eased = progress * progress * (3 - 2 * progress);
    const a = hexCenter(from), b = edge || to?.borderPoint || hexCenter(to);
    return { x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * eased };
  }

  function roundedPanel(x, y, width, height, border) {
    ctx.save(); ctx.fillStyle = 'rgba(8,17,23,.94)'; ctx.strokeStyle = border; ctx.lineWidth = 1.5;
    if (typeof roundedRect === 'function') roundedRect(ctx, x, y, width, height, 7); else { ctx.beginPath(); ctx.rect(x, y, width, height); ctx.closePath(); }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawActivity(event) {
    const point = projectBase(pointFor(event.coordinate)); if (!point) return;
    const fadeIn = Math.min(1, playback.progress / .14), fadeOut = Math.min(1, (1 - playback.progress) / .16);
    const lines = [event.title + (event.unitCode ? ` · ${event.unitCode}` : ''), event.text].filter(Boolean);
    ctx.save(); ctx.globalAlpha = Math.min(fadeIn, fadeOut); ctx.font = '700 12px Segoe UI';
    const changeWidth = event.changes?.length ? event.changes.reduce((sum, change) => sum + ctx.measureText(`${change.amount > 0 ? '+' : ''}${change.amount.toLocaleString()} `).width + 27 + ctx.measureText(change.name).width, 0) : 0;
    const width = Math.min(360, Math.max(170, ...lines.map(line => ctx.measureText(line).width + 26), changeWidth + 18)), height = 17 + lines.length * 16 + (event.changes?.length ? 24 : 0);
    const x = Math.max(8, Math.min(canvas.clientWidth - width - 8, point.x - width / 2)), y = Math.max(8, point.y - height - state.scale * .55);
    ctx.restore(); ctx.save(); ctx.globalAlpha = Math.min(fadeIn, fadeOut); roundedPanel(x, y, width, height, '#e4bd62');
    ctx.font = '700 12px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((line, index) => { ctx.fillStyle = index === 0 ? '#ffe4a4' : '#eef4f6'; ctx.fillText(line, x + width / 2, y + 14 + index * 16); });
    if (event.changes?.length) {
      let cursor = x + width / 2 - changeWidth / 2;
      const changeY = y + 14 + lines.length * 16;
      for (const change of event.changes) {
        const amount = `${change.amount > 0 ? '+' : ''}${change.amount.toLocaleString()}`;
        ctx.fillStyle = change.amount > 0 ? '#9fe0bd' : '#f1a6a6'; ctx.textAlign = 'left'; ctx.fillText(`${amount} `, cursor, changeY);
        cursor += ctx.measureText(`${amount} `).width;
        const image = itemIcon(change.name);
        if (image) { ctx.drawImage(image, cursor, changeY - 10, 18, 18); cursor += 22; }
        else { ctx.fillStyle = '#eef4f6'; ctx.fillText(change.name, cursor, changeY); cursor += ctx.measureText(change.name).width; }
        cursor += 7;
      }
    }
    ctx.restore();
  }

  function drawMovingMarker(event, scout = false, progress = playback.progress) {
    const base = lerpPoint(event.from, event.to, progress, event.borderPoint), point = projectBase(base); if (!point) return;
    const colour = scout ? (event.mounted ? '#d7a65e' : '#e0d39d') : '#ffe1a0';
    ctx.save(); ctx.strokeStyle = scout ? '#4b3324' : '#8b5b2d'; ctx.fillStyle = colour; ctx.lineWidth = Math.max(1.5, state.scale * .045);
    const count = scout ? Math.max(1, Math.min(5, event.riders || 1)) : 1;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * state.scale * .17, y = point.y + Math.abs(i - (count - 1) / 2) * state.scale * .025;
      if (scout && event.mounted) { ctx.beginPath(); ctx.ellipse(point.x + spread, y + state.scale * .035, state.scale * .11, state.scale * .045, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(point.x + spread, y - state.scale * .045, Math.max(2.5, state.scale * .042), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(point.x + spread, y - state.scale * .01); ctx.lineTo(point.x + spread, y + state.scale * .105); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(point.x + spread, y + state.scale * .05); ctx.lineTo(point.x + spread - state.scale * .055, y + state.scale * .11); ctx.moveTo(point.x + spread, y + state.scale * .05); ctx.lineTo(point.x + spread + state.scale * .055, y + state.scale * .11); ctx.stroke();
    }
    ctx.font = '800 11px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#f5e5bd'; ctx.strokeStyle = '#17262b'; ctx.lineWidth = 3; ctx.strokeText(scout ? `Scout ${event.scoutId}` : event.unitCode, point.x, point.y - state.scale * .22); ctx.fillText(scout ? `Scout ${event.scoutId}` : event.unitCode, point.x, point.y - state.scale * .22); ctx.restore();
  }

  function drawScoutReveals() {
    if (!playback.revealed.size) return;
    ctx.save(); ctx.strokeStyle = '#83d9ef'; ctx.fillStyle = 'rgba(131,217,239,.11)'; ctx.lineWidth = Math.max(1.5, state.scale * .04);
    for (const coordinate of playback.revealed) { const point = projectBase(pointFor(coordinate)); if (!point) continue; const question = playback.revealedQuestions.has(coordinate); ctx.fillStyle = 'rgba(131,217,239,.11)'; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(8, state.scale * .28), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (question) { ctx.fillStyle = '#f4e2a5'; ctx.font = `800 ${Math.max(12, state.scale * .42)}px Segoe UI`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', point.x, point.y); } }
    ctx.restore();
  }

  function drawCompletedScoutMarkers(currentEvent) {
    const currentKey = currentEvent?.phase === 'scouting'
      ? `${currentEvent.unitCode}:${currentEvent.scoutId}`
      : null;
    const latest = new Map();
    for (let index = 0; index < playback.index; index += 1) {
      const event = playback.events[index];
      if (event?.phase !== 'scouting') continue;
      const key = `${event.unitCode}:${event.scoutId}`;
      if (key === currentKey) continue;
      latest.set(key, event);
    }
    for (const event of latest.values()) drawMovingMarker(event, true, 1);
  }

  function drawResultsPlaybackOverlay() {
    if (!playback.active) return;
    const drawOverlay = () => {
      drawScoutReveals();
      const event = playback.events[playback.index]; if (!event) return;
      drawCompletedScoutMarkers(event);
      if (event.phase === 'activities') drawActivity(event);
      else drawMovingMarker(event, event.phase === 'scouting');
      ctx.save(); ctx.fillStyle = '#f0f2dc'; ctx.font = '800 11px Segoe UI'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${phaseText(event.phase)} · ${playback.index + 1}/${playback.events.length}`, 12, 12); ctx.restore();
    };
    if (typeof IsoMapper !== 'undefined' && IsoMapper.enabled && IsoMapper.withProjection) IsoMapper.withProjection(drawOverlay); else drawOverlay();
  }

  function resultsPlaybackShouldHideUnit(unitCode) {
    // Historical units remain rendered throughout playback; callers can use
    // playbackUnitPosition() to place them at their interpolated location.
    return false;
  }

  root.startResultsPlayback = startResultsPlayback;
  root.stopResultsPlayback = stopResultsPlayback;
  root.pauseResultsPlayback = pauseResultsPlayback;
  root.resumeResultsPlayback = resumeResultsPlayback;
  root.drawResultsPlaybackOverlay = drawResultsPlaybackOverlay;
  root.resultsPlaybackShouldHideUnit = resultsPlaybackShouldHideUnit;
  root.resultsPlaybackUnitPosition = playbackUnitPosition;
  root.resultsPlaybackMapData = playbackMapData;
  root.resultsPlaybackEnsureBaseline = extendPlaybackBaseline;
  root.resultsPlayback.buildEvents = buildEvents;
  root.resultsPlayback.modelCount = modelCount;
  root.resultsPlayback.activitySound = activitySound;

  // Keep the sound registry inspectable for tests and future sound packs. The
  // files are short CC0/public-domain clips already shipped with the app.
  playback.soundSources = Object.freeze({
    butcher: 'assets/results-sounds/butcher.ogg',
    wood: 'assets/results-sounds/woodcutting.ogg',
    hunt: 'assets/results-sounds/hunting.ogg',
    herd: 'assets/results-sounds/click_1.ogg',
    craft: 'assets/results-sounds/crafting.ogg',
    unknown: 'assets/results-sounds/dum.ogg',
    movement: 'assets/results-sounds/footstep.ogg',
    scout: 'assets/results-sounds/scouting.ogg',
    horse: 'assets/results-sounds/horse-gallop.ogg'
  });

  function bindSpeedSetting() {
    const select = document.getElementById('mapResultPlaybackSpeed');
    const stored = root.localStorage?.getItem(SPEED_STORAGE_KEY);
    playback.speed = Number(stored) > 0 ? Number(stored) : 1;
    if (!select) return;
    select.value = String(playback.speed);
    select.addEventListener('change', event => {
      const speed = Number(event.target.value);
      playback.speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      root.localStorage?.setItem(SPEED_STORAGE_KEY, String(playback.speed));
    });
  }

  bindSpeedSetting();

  const button = document.getElementById('mapResultPlayTurn');
  if (button) button.addEventListener('click', () => { if (!playback.active) startResultsPlayback(); else if (playback.paused) resumeResultsPlayback(); else pauseResultsPlayback(); });
})(typeof window !== 'undefined' ? window : globalThis);

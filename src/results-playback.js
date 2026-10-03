/* Results playback: activities, movement segments, then scouting reveals. */
(function(root) {
  const playback = root.resultsPlayback = {
    active: false,
    phase: 'idle',
    events: [],
    index: 0,
    progress: 0,
    startedAt: 0,
    targetTurnKey: null,
    targetUnitCodes: new Set(),
    revealed: new Set(),
    raf: null,
    audioContext: null,
    audioByPhase: new Map()
  };

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function modelCount(value) {
    const n = Math.max(0, Math.floor(number(value)));
    return n < 1 ? 0 : Math.floor(Math.log10(n)) + 1;
  }

  function pointFor(coordinate) {
    const parsed = typeof parseCoordinate === 'function' ? parseCoordinate(coordinate) : null;
    return parsed ? { ...parsed, coordinate: parsed.coordinate || coordinate } : null;
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

  function changeText(changes) {
    return (changes || []).map(change => `${change.amount > 0 ? '+' : ''}${change.amount.toLocaleString()} ${change.name}`).join(' · ');
  }

  function activityChanges(clause, unit, isLastClause = false) {
    const text = String(clause || ''), changes = [];
    const add = (name, amount) => { if (name && amount) changes.push({ name: String(name).replace(/[.,;:]+$/, ''), amount }); };
    for (const match of text.matchAll(/using\s+([\d,]+)\s+([A-Za-z][\w/-]*)/gi)) add(match[2], -number(match[1].replace(/,/g, '')));
    for (const match of text.matchAll(/(?:made|produced|crafted)\s+([\d,]+)\s+([A-Za-z][\w/-]*)/gi)) add(match[2], number(match[1].replace(/,/g, '')));
    const bred = text.match(/\bbred\s*\(([^)]+)\)/i);
    if (bred) for (const match of bred[1].matchAll(/([A-Za-z][\w/-]*)\s+([\d,]+)/g)) add(match[1], number(match[2].replace(/,/g, '')));
    for (const match of text.matchAll(/\b([A-Za-z][\w/-]*)\s+(?:cured|tanned|skinned|gutted|boned)\s+([\d,]+)/gi)) add(match[1], number(match[2].replace(/,/g, '')));
    // A slaughter/harvest clause commonly ends with “N Goat/Cattle/...”.
    if (/skin|gut|bone|slaughter|hunted/i.test(text)) {
      for (const match of text.matchAll(/\b([\d,]+)\s+(Goat|Cattle|Horse|Cow|Sheep|Pig|Deer|Animal)s?\b/gi)) add(match[2], -number(match[1].replace(/,/g, '')));
    }
    return changes.length || !isLastClause ? changes : deltaChanges(unit);
  }

  function actualPlan(turn) {
    if (typeof TurnLifecycleCore !== 'undefined' && TurnLifecycleCore.actualPlanFromResult) return TurnLifecycleCore.actualPlanFromResult(turn);
    return { movements: [], scouts: [] };
  }

  function routesFor(turn) {
    const plan = actualPlan(turn);
    if (typeof buildPlanRoutes === 'function') return buildPlanRoutes(plan);
    return { movements: [], scouts: [] };
  }

  function buildEvents(turn) {
    const events = [];
    const units = new Map((turn?.units || []).map(unit => [String(unit.unitCode), unit]));
    const activityEvents = (turn?.events || []).filter(event => event.eventType === 'activities');
    for (const event of activityEvents) {
      const unit = units.get(String(event.unitCode));
      const clauses = activityClauses(event.message);
      const activityList = clauses.length ? clauses : [event.message];
      for (let clauseIndex = 0; clauseIndex < activityList.length; clauseIndex += 1) {
        const clause = activityList[clauseIndex];
        const changes = activityChanges(clause, unit, clauseIndex === activityList.length - 1);
        events.push({ phase: 'activities', unitCode: String(event.unitCode || ''), coordinate: unit?.previousHex || unit?.currentHex, title: 'Activity', text: clause, changes, duration: 1050 });
      }
    }

    const routes = routesFor(turn);
    for (const movement of routes.movements || []) {
      const points = movement.route?.points || [];
      for (let i = 1; i < points.length; i += 1) events.push({ phase: 'movement', unitCode: String(movement.unit), from: points[i - 1], to: points[i], duration: 420 });
    }

    for (const scout of routes.scouts || []) {
      const points = scout.route?.points || [];
      const source = (turn?.units || []).find(unit => String(unit.unitCode) === String(scout.unit));
      const riders = modelCount(scout.noOfScouts || source?.scouts?.find(row => Number(row.id) === Number(scout.id))?.noOfScouts || 1);
      for (let i = 1; i < points.length; i += 1) events.push({ phase: 'scouting', unitCode: String(scout.unit), scoutId: Number(scout.id), riders, from: points[i - 1], to: points[i], duration: 440 });
    }
    return events;
  }

  function setButton() {
    const button = document.getElementById('mapResultPlayTurn');
    if (!button) return;
    button.textContent = playback.active ? 'Pause Turn' : 'Play Turn';
    button.classList.toggle('accent', !playback.active);
  }

  function phaseText(phase) {
    return phase === 'activities' ? 'Activities' : phase === 'movement' ? 'Movement' : phase === 'scouting' ? 'Scouting' : '';
  }

  function playTone(phase) {
    // The bundled clips are short CC0 UI sounds. Keep the oscillator fallback
    // for installations where the browser blocks local audio or a file is
    // unavailable; it is deliberately only a tiny UI cue.
    try {
      const sources = { activities: 'assets/results-sounds/chimes.ogg', movement: 'assets/results-sounds/click_1.ogg', scouting: 'assets/results-sounds/dum.ogg' };
      const Audio = root.Audio;
      if (Audio && sources[phase]) {
        let audio = playback.audioByPhase.get(phase);
        if (!audio) { audio = new Audio(sources[phase]); audio.preload = 'auto'; playback.audioByPhase.set(phase, audio); }
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
      oscillator.frequency.value = phase === 'activities' ? 420 : phase === 'movement' ? 250 : 690;
      oscillator.type = phase === 'scouting' ? 'triangle' : 'sine';
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

  function stopResultsPlayback() {
    cancelFrame();
    playback.active = false; playback.phase = 'idle'; playback.events = []; playback.index = 0; playback.progress = 0;
    playback.targetTurnKey = null; playback.targetUnitCodes = new Set(); playback.revealed = new Set();
    setButton();
    if (typeof draw === 'function') draw();
  }

  async function startResultsPlayback() {
    let turn = root.resultsTimeline?.turn;
    if (!turn) return false;
    if (turn.isPlanningTurn && turn.baselineTurnKey && root.tribenet?.getResultTurn) turn = await root.tribenet.getResultTurn(turn.baselineTurnKey);
    const events = buildEvents(turn);
    stopResultsPlayback();
    playback.events = events; playback.active = events.length > 0; playback.index = 0; playback.progress = 0;
    playback.startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); playback.targetTurnKey = turn.turnKey;
    playback.targetUnitCodes = new Set(events.map(event => event.unitCode).filter(Boolean));
    playback.phase = events[0]?.phase || 'idle';
    setButton();
    if (!playback.active) return false;
    playTone(playback.phase);
    if (typeof draw === 'function') draw();
    requestFrame(tick);
    return true;
  }

  function finishEvent(event) {
    if (event?.to?.coordinate) playback.revealed.add(event.to.coordinate);
    playback.index += 1; playback.progress = 0;
    const next = playback.events[playback.index]; playback.phase = next?.phase || 'complete';
    if (next) playTone(next.phase);
  }

  function tick(now) {
    if (!playback.active) return;
    const event = playback.events[playback.index];
    if (!event) { stopResultsPlayback(); return; }
    playback.phase = event.phase;
    playback.progress = Math.min(1, Math.max(0, (now - playback.startedAt) / event.duration));
    if (playback.progress >= 1) {
      finishEvent(event); playback.startedAt = now;
      if (!playback.events[playback.index]) { stopResultsPlayback(); return; }
    }
    if (typeof draw === 'function') draw();
    requestFrame(tick);
  }

  function projectBase(point) {
    if (!point) return null;
    const base = { x: point.x ?? baseCenter(point.globalCol, point.globalRow).x, y: point.y ?? baseCenter(point.globalCol, point.globalRow).y };
    return typeof IsoMapper !== 'undefined' && IsoMapper.enabled ? IsoMapper.project(base) : screenFromBase(base);
  }

  function lerpPoint(from, to, progress) {
    const a = baseCenter(from.globalCol, from.globalRow), b = baseCenter(to.globalCol, to.globalRow);
    return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
  }

  function roundedPanel(x, y, width, height, border) {
    ctx.save(); ctx.fillStyle = 'rgba(8,17,23,.94)'; ctx.strokeStyle = border; ctx.lineWidth = 1.5;
    if (typeof roundedRect === 'function') roundedRect(ctx, x, y, width, height, 7); else { ctx.beginPath(); ctx.rect(x, y, width, height); ctx.closePath(); }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawActivity(event) {
    const point = projectBase(pointFor(event.coordinate)); if (!point) return;
    const lines = [event.title + (event.unitCode ? ` · ${event.unitCode}` : ''), event.text, event.changes?.length ? changeText(event.changes) : ''].filter(Boolean);
    ctx.save(); ctx.font = '700 12px Segoe UI';
    const width = Math.min(360, Math.max(170, ...lines.map(line => ctx.measureText(line).width + 26))), height = 17 + lines.length * 16;
    const x = Math.max(8, Math.min(canvas.clientWidth - width - 8, point.x - width / 2)), y = Math.max(8, point.y - height - state.scale * .55);
    ctx.restore(); roundedPanel(x, y, width, height, '#e4bd62');
    ctx.save(); ctx.font = '700 12px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((line, index) => { ctx.fillStyle = index === 0 ? '#ffe4a4' : index === lines.length - 1 && event.changes?.length ? '#9fe0bd' : '#eef4f6'; ctx.fillText(line, x + width / 2, y + 14 + index * 16); });
    ctx.restore();
  }

  function drawMovingMarker(event, scout = false) {
    const base = lerpPoint(event.from, event.to, playback.progress), point = projectBase(base); if (!point) return;
    ctx.save(); ctx.strokeStyle = scout ? '#83d9ef' : '#f3bc68'; ctx.fillStyle = scout ? '#b6f1ff' : '#ffe1a0'; ctx.lineWidth = Math.max(2, state.scale * .06);
    ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(5, state.scale * (scout ? .12 : .16)), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const count = scout ? Math.max(1, event.riders || 1) : 1;
    for (let i = 0; i < count; i += 1) { const angle = (i / count) * Math.PI * 2; ctx.beginPath(); ctx.arc(point.x + Math.cos(angle) * state.scale * .16, point.y + Math.sin(angle) * state.scale * .09, Math.max(1.5, state.scale * .025), 0, Math.PI * 2); ctx.fill(); }
    ctx.font = '700 11px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(scout ? `S${event.scoutId} ${event.unitCode}` : event.unitCode, point.x, point.y - state.scale * .22); ctx.restore();
  }

  function drawScoutReveals() {
    if (!playback.revealed.size) return;
    ctx.save(); ctx.strokeStyle = '#83d9ef'; ctx.fillStyle = 'rgba(131,217,239,.11)'; ctx.lineWidth = Math.max(1.5, state.scale * .04);
    for (const coordinate of playback.revealed) { const point = projectBase(pointFor(coordinate)); if (!point) continue; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(8, state.scale * .28), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  function drawResultsPlaybackOverlay() {
    if (!playback.active) return;
    const drawOverlay = () => {
      drawScoutReveals();
      const event = playback.events[playback.index]; if (!event) return;
      if (event.phase === 'activities') drawActivity(event);
      else drawMovingMarker(event, event.phase === 'scouting');
      ctx.save(); ctx.fillStyle = '#f0f2dc'; ctx.font = '800 11px Segoe UI'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${phaseText(event.phase)} · ${playback.index + 1}/${playback.events.length}`, 12, 12); ctx.restore();
    };
    if (typeof IsoMapper !== 'undefined' && IsoMapper.enabled && IsoMapper.withProjection) IsoMapper.withProjection(drawOverlay); else drawOverlay();
  }

  function resultsPlaybackShouldHideUnit(unitCode) {
    return playback.active && playback.targetUnitCodes.has(String(unitCode));
  }

  root.startResultsPlayback = startResultsPlayback;
  root.stopResultsPlayback = stopResultsPlayback;
  root.drawResultsPlaybackOverlay = drawResultsPlaybackOverlay;
  root.resultsPlaybackShouldHideUnit = resultsPlaybackShouldHideUnit;
  root.resultsPlayback.buildEvents = buildEvents;
  root.resultsPlayback.modelCount = modelCount;

  const button = document.getElementById('mapResultPlayTurn');
  if (button) button.addEventListener('click', () => { if (playback.active) stopResultsPlayback(); else startResultsPlayback(); });
})(typeof window !== 'undefined' ? window : globalThis);

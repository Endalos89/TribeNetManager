const $ = id => document.getElementById(id);
const state = { turns: [], turn: null, catalog: [], selectedUnit: null };

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(value) { return Number(value || 0).toLocaleString(); }
function rootTribe(unit) { const m = String(unit || '').match(/^(\d{4})/); return m ? m[1] : String(unit || ''); }
function currentData() { return state.turn?.start?.data || state.turn?.final?.data || null; }
function allUnits() { return currentData()?.units || []; }
function selected() { return allUnits().find(u => String(u.unit) === String(state.selectedUnit)) || null; }
function skillsForTribe(tribe) { return currentData()?.skillsByTribe?.[tribe] || []; }
function canonical(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
function activityFor(code) { return state.catalog.find(a => a.code === code) || null; }

function skillLevel(activity, tribe) {
  if (!activity?.skill) return null;
  const wanted = new Set([canonical(activity.skill), ...(activity.aliases || []).map(canonical)]);
  for (const skill of skillsForTribe(tribe)) {
    if ([skill.skill, skill.shortname].map(canonical).some(name => wanted.has(name))) return Number(skill.level || 0);
  }
  return 0;
}

function sharedLimit(activity, level) {
  if (activity?.limitType !== 'sharedPerSkill10') return null;
  const n = Number(level || 0);
  return n >= 10 ? Infinity : n * 10;
}

function unitParent(unit) { return rootTribe(unit?.unit); }
function plannedForUnit(unit) { return (state.turn?.activities || []).filter(a => String(a.unit) === String(unit)); }
function plannedPeopleForUnit(unit) { return plannedForUnit(unit).reduce((sum, a) => sum + Number(a.people || 0), 0); }
function plannedUsage(parent, activityCode) {
  const unitIds = new Set(allUnits().filter(u => unitParent(u) === parent).map(u => String(u.unit)));
  return (state.turn?.activities || []).filter(a => unitIds.has(String(a.unit)) && a.activityCode === activityCode).reduce((sum,a) => sum + Number(a.people || 0), 0);
}
function workforce(unit) { return Math.max(0, Number(unit?.warrior || 0) + Number(unit?.active || 0) + Number(unit?.slave || 0)); }

function setStatus(message, error = false) {
  $('tmStatus').textContent = message || '';
  $('tmStatus').className = `update-message ${error ? 'tm-status-error' : 'tm-status-ok'}`;
}

async function refreshTurns(preferred = null) {
  state.turns = await window.tribenet.listManagedTurns();
  const picker = $('turnPicker');
  const keep = preferred || picker.value || state.turn?.turnKey || state.turns[0]?.turnKey || '';
  picker.innerHTML = '<option value="">No turn imported</option>' + state.turns.map(t => `<option value="${esc(t.turnKey)}">${esc(t.turnKey)}</option>`).join('');
  if (keep && state.turns.some(t => t.turnKey === keep)) picker.value = keep;
  if (picker.value) await loadTurn(picker.value); else renderEmpty();
}

async function loadTurn(turnKey) {
  state.turn = await window.tribenet.getManagedTurn(turnKey);
  if (!state.turn) return renderEmpty();
  const units = allUnits();
  if (!units.some(u => String(u.unit) === String(state.selectedUnit))) state.selectedUnit = units[0]?.unit || null;
  renderAll();
}

function renderEmpty() {
  state.turn = null; state.selectedUnit = null;
  $('tmEmpty').classList.remove('hidden'); $('tmWorkspace').classList.add('hidden');
  $('unitList').innerHTML = '<div class="history-empty">Import a turn workbook to begin.</div>';
  $('unitCount').textContent = '0';
}

function renderWorkbookState() {
  const fmt = iso => iso ? new Date(iso).toLocaleString() : '';
  $('startFile').textContent = state.turn?.start?.sourceFile || 'Not imported';
  $('startTime').textContent = fmt(state.turn?.start?.importedAt);
  $('finalFile').textContent = state.turn?.final?.sourceFile || 'Not imported';
  $('finalTime').textContent = fmt(state.turn?.final?.importedAt);
}

function renderUnits() {
  const query = $('unitSearch').value.trim().toLowerCase();
  const units = allUnits().filter(u => !query || `${u.unit} ${u.unitName || ''} ${u.type}`.toLowerCase().includes(query));
  $('unitCount').textContent = String(allUnits().length);
  if (!units.length) { $('unitList').innerHTML = '<div class="history-empty">No matching units.</div>'; return; }
  $('unitList').innerHTML = units.map(u => {
    const inherited = u.type !== 'Tribe' ? ` · skills from ${esc(u.parentTribe)}` : '';
    return `<button class="tm-unit-card ${String(u.unit)===String(state.selectedUnit)?'active':''}" data-unit="${esc(u.unit)}"><div class="top"><strong>${esc(u.unit)}</strong><span>${esc(u.type)}</span></div><small>${esc(u.unitName || '')}${inherited}</small><small>${esc(u.startHex || 'Location unknown')} · ${num(plannedPeopleForUnit(u.unit))} people planned</small></button>`;
  }).join('');
  document.querySelectorAll('.tm-unit-card').forEach(btn => btn.addEventListener('click', () => { state.selectedUnit = btn.dataset.unit; renderAll(); }));
}

function renderSelectedUnit() {
  const u = selected();
  if (!u) return;
  $('unitCode').textContent = u.unit; $('unitName').textContent = u.unitName || ''; $('unitType').textContent = u.type;
  $('parentTribe').textContent = u.parentTribe || rootTribe(u.unit); $('unitLocation').textContent = u.startHex || 'Unknown';
  $('unitWarriors').textContent = num(u.warrior); $('unitActives').textContent = num(u.active); $('unitSlaves').textContent = num(u.slave);
  $('unitAssigned').textContent = `${num(plannedPeopleForUnit(u.unit))} / ${num(workforce(u))}`;
  renderSkills(u); renderSharedLimits(u); renderPlannedActivities(u); renderFinalActivities(u); renderActivityRule();
}

function renderSkills(u) {
  const skills = u.skills || skillsForTribe(u.parentTribe);
  $('skillList').innerHTML = skills.length ? skills.map(s => `<span class="tm-skill ${u.type==='Tribe'?'':'inherited'}"><b>${esc(s.shortname || s.skill)}</b> ${num(s.level)}</span>`).join('') : '<div class="history-empty">No skill levels were detected in this workbook. Activity validation will warn rather than block on unknown skills.</div>';
}

function renderSharedLimits(u) {
  const parent = u.parentTribe || rootTribe(u.unit); $('sharedLimitTitle').textContent = `Tribe ${parent}`;
  const skills = skillsForTribe(parent); const hasSkills = skills.length > 0;
  const entries = [];
  for (const activity of state.catalog.filter(a => a.limitType === 'sharedPerSkill10')) {
    const level = skillLevel(activity, parent); const used = plannedUsage(parent, activity.code); const limit = sharedLimit(activity, level);
    if (!used && (!level || level <= 0)) continue;
    entries.push({ name: activity.name, used, limit, detail: hasSkills ? `${activity.skill} ${level}` : 'skill level unknown' });
  }
  const scoutSource = state.turn?.final?.data || state.turn?.start?.data;
  const scoutCount = (scoutSource?.scouts || []).filter(s => rootTribe(s.unit) === parent).length;
  entries.push({ name: 'Scout groups', used: scoutCount, limit: 8, detail: state.turn?.final ? 'from finalized workbook' : 'from available workbook' });
  $('sharedLimits').innerHTML = entries.map(e => {
    const finite = Number.isFinite(e.limit); const pct = finite && e.limit > 0 ? e.used / e.limit * 100 : 0;
    const cls = finite && e.used > e.limit ? 'over' : finite && pct >= 85 ? 'warn' : '';
    return `<div class="tm-limit"><div class="tm-limit-head"><span>${esc(e.name)}</span><strong>${num(e.used)} / ${finite ? num(e.limit) : '∞'}</strong></div>${finite?`<div class="tm-limit-bar"><div class="tm-limit-fill ${cls}" style="width:${Math.min(100,Math.max(0,pct))}%"></div></div>`:''}<div class="tm-limit-detail">${esc(e.detail)}</div></div>`;
  }).join('') || '<div class="history-empty">No shared limits currently in use.</div>';
}

function activityDescription(activity, u) {
  if (!activity) return '';
  const parent = u?.parentTribe || rootTribe(u?.unit); const level = skillLevel(activity, parent); const limit = sharedLimit(activity, level);
  const parts = [`Mandate ${activity.section}`];
  if (activity.skill) parts.push(`${activity.skill} ${level ?? '?'}`);
  if (activity.limitType === 'sharedPerSkill10') parts.push(level >= 10 ? 'worker limit: unlimited at level 10+' : `shared worker limit: ${limit} people across Tribe + Elements/Fleets`);
  else if (activity.limitType === 'none') parts.push('no skill-based worker limit');
  else if (activity.limitType) parts.push(`rule: ${activity.limitType}`);
  if (activity.minimumSkill) parts.push(`minimum skill ${activity.minimumSkill}`);
  if (activity.note) parts.push(activity.note);
  return parts.join(' · ');
}

function renderActivityRule() {
  const u = selected(); const activity = activityFor($('activitySelect').value);
  $('activityRule').textContent = activityDescription(activity, u);
  validateActivity();
}

function validateActivity() {
  const u = selected(); const activity = activityFor($('activitySelect').value); const people = Math.max(0, Number($('activityPeople').value || 0));
  const host = $('activityValidation'); host.className = 'tm-validation';
  if (!u || !activity) { host.textContent = ''; return { ok:false }; }
  const errors = [], warnings = []; const parent = u.parentTribe || rootTribe(u.unit); const skills = skillsForTribe(parent); const level = skillLevel(activity, parent);
  if (activity.tribeOnly && u.type !== 'Tribe') errors.push('This activity is Tribe-only.');
  if (activity.skill && skills.length) {
    const required = Number(activity.minimumSkill || (activity.levelZeroAllowed ? 0 : 1));
    if (Number(level || 0) < required) errors.push(`${activity.skill} ${required} required; Tribe ${parent} has ${level || 0}.`);
  } else if (activity.skill && !skills.length) warnings.push('Skill levels were not detected, so skill eligibility cannot be validated yet.');
  if (activity.limitType === 'sharedPerSkill10' && skills.length) {
    const limit = sharedLimit(activity, level); const used = plannedUsage(parent, activity.code);
    if (Number.isFinite(limit) && used + people > limit) errors.push(`Shared ${activity.name} allocation would be ${used + people}/${limit}.`);
  }
  const pool = workforce(u), already = plannedPeopleForUnit(u.unit);
  if (pool > 0 && already + people > pool) errors.push(`Unit workforce would be ${already + people}/${pool}.`);
  if (activity.code === 'CUSTOM') warnings.push('Custom activities are not rule-validated.');
  host.textContent = [...errors, ...warnings].join(' '); host.classList.add(errors.length ? 'error' : warnings.length ? 'warn' : '');
  return { ok: errors.length === 0, errors, warnings };
}

function renderPlannedActivities(u) {
  const rows = plannedForUnit(u.unit); $('unitPlanCount').textContent = String(rows.length);
  $('plannedActivityList').innerHTML = rows.length ? rows.map(row => {
    const a = activityFor(row.activityCode);
    return `<div class="tm-activity"><div class="tm-activity-head"><strong>${esc(a?.name || row.activityCode)}</strong><span>${num(row.people)} people</span></div><div class="tm-activity-meta">${row.target ? `Target: ${esc(row.target)}<br>` : ''}${row.notes ? esc(row.notes) : ''}</div><div class="tm-activity-actions"><button class="button danger tm-mini" data-delete="${row.id}">Remove</button></div></div>`;
  }).join('') : '<div class="history-empty">No activities planned for this unit.</div>';
  document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => { await window.tribenet.deletePlannedActivity(Number(btn.dataset.delete)); await loadTurn(state.turn.turnKey); }));
}

function renderFinalActivities(u) {
  const rows = (state.turn?.final?.data?.activities || []).filter(a => String(a.unit) === String(u.unit));
  $('finalActivities').innerHTML = rows.length ? rows.map(row => `<div class="tm-activity tm-final"><div class="tm-activity-head"><strong>${esc(row.activity || 'Activity')}</strong><span>${num(row.people)} people</span></div><div class="tm-activity-meta">${esc(row.item || row.distinction || '')}</div></div>`).join('') : '<div class="history-empty">No finalized activity rows for this unit, or no finalized workbook has been imported.</div>';
}

function renderAll() {
  $('tmEmpty').classList.add('hidden'); $('tmWorkspace').classList.remove('hidden');
  renderWorkbookState(); renderUnits(); renderSelectedUnit();
  $('turnContext').value = state.turn?.context?.notes || '';
}

async function doImport(role) {
  setStatus(role === 'start' ? 'Importing beginning workbook…' : 'Importing finalized workbook…');
  const result = await window.tribenet.importTurnWorkbook(role);
  if (result.canceled) return setStatus('');
  if (result.error) return setStatus(result.error, true);
  const key = result.turn?.turnKey; setStatus(`${role === 'start' ? 'Beginning' : 'Finalized'} workbook stored for ${key}.`);
  await refreshTurns(key);
}

async function addActivity() {
  const u = selected(); if (!u || !state.turn) return;
  const validation = validateActivity(); if (!validation.ok) return;
  await window.tribenet.addPlannedActivity(state.turn.turnKey, {
    unit: u.unit, activityCode: $('activitySelect').value, people: Number($('activityPeople').value || 0), target: $('activityTarget').value.trim(), notes: $('activityNotes').value.trim()
  });
  $('activityPeople').value = '0'; $('activityTarget').value = ''; $('activityNotes').value = '';
  await loadTurn(state.turn.turnKey);
}

async function init() {
  $('tmVersion').textContent = `TribeNet Manager ${await window.tribenet.getVersion()}`;
  state.catalog = await window.tribenet.getActivityCatalog();
  $('activitySelect').innerHTML = state.catalog.map(a => `<option value="${esc(a.code)}">${esc(a.name)}</option>`).join('');
  $('tmBack').addEventListener('click', () => location.href = 'index.html');
  $('importStart').addEventListener('click', () => doImport('start'));
  $('importFinal').addEventListener('click', () => doImport('final'));
  $('turnPicker').addEventListener('change', () => $('turnPicker').value ? loadTurn($('turnPicker').value) : renderEmpty());
  $('unitSearch').addEventListener('input', renderUnits);
  $('activitySelect').addEventListener('change', renderActivityRule); $('activityPeople').addEventListener('input', validateActivity);
  $('addActivity').addEventListener('click', addActivity);
  $('saveContext').addEventListener('click', async () => { if (!state.turn) return; await window.tribenet.saveTurnContext(state.turn.turnKey, $('turnContext').value); setStatus('Turn context saved.'); });
  $('tmBackup').addEventListener('click', async () => { const path = await window.tribenet.backupTurnManager(); await window.tribenet.showBackup(path); setStatus('Turn Manager backup created.'); });
  await refreshTurns();
}

init().catch(error => setStatus(error.message || String(error), true));

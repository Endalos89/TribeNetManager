(() => {
  'use strict';

  const STORAGE_KEY = 'tribenet.feedback.v1';
  const PENDING_KEY = 'tribenet.feedback.pendingContextJump.v5';

  function readNotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function versionNumber(value) {
    const match = String(value || '').match(/\d+\.\d+\.\d+/);
    return match ? match[0] : String(value || '').trim();
  }

  function currentVersionSync() {
    const label = document.querySelector('#versionLabel,#compVersion,#tmVersion,#tribeManagerVersion,#fairVersion,#fairgroundVersion')?.textContent || '';
    return versionNumber(label) || 'unknown';
  }

  async function currentVersion() {
    try {
      const value = versionNumber(await window.tribenet?.getVersion?.());
      if (value) return value;
    } catch (_) {}
    return currentVersionSync();
  }

  function downloadPayload(payload) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tribenet-feedback-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportOpenFeedback() {
    const version = await currentVersion();
    const now = new Date().toISOString();
    const notes = readNotes();
    for (const note of notes) {
      if (note.status !== 'open') continue;
      note.status = 'actioned';
      note.actionedAt = now;
      note.actionedVersion = version;
      note.updatedAt = now;
    }
    writeNotes(notes);
    downloadPayload({
      format:'tribenet-feedback',
      schemaVersion:1,
      exportedAt:now,
      appVersion:`Version ${version} · Local desktop application`,
      comments:notes.filter(note => note.status !== 'resolved').map(note => ({ ...note }))
    });
    applyHeldPresentation();
  }

  function compendiumRoute(note) {
    const context = String(note?.context?.compendium || '').trim();
    if (!context || !/^Compendium\b/i.test(context)) return null;
    const parts = context.split('›').map(part => part.trim()).filter(Boolean);
    const last = parts.at(-1) || '';

    if (/^Food Gathering$/i.test(last)) return { page:'compendium.html', type:'food-gathering', key:'food-gathering' };
    if (/^(Items|Buildings|Ships|Skills)$/i.test(last)) return { page:'compendium.html', type:'category', key:last.toLowerCase() };
    if (/^Group\s+[ABC]$/i.test(last)) return { page:'compendium.html', type:'group', key:last.match(/[ABC]/i)?.[0]?.toUpperCase() };

    const typeIndex = parts.findIndex(part => /^(item|ship|building|facility)$/i.test(part));
    if (typeIndex >= 0 && parts[typeIndex + 1]) return { page:'compendium.html', type:'entity', key:parts[typeIndex + 1] };

    const skillsIndex = parts.findIndex(part => /^Skills$/i.test(part));
    if (skillsIndex >= 0 && last && !/^Skills$/i.test(last) && !/^Group\s+[ABC]$/i.test(last)) {
      return { page:'compendium.html', type:'skill', key:last };
    }
    return { page:'compendium.html', type:'home', key:null };
  }

  function highlight(element) {
    if (!element) return false;
    element.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
    element.animate?.([{ outline:'3px solid #d8a643' }, { outline:'0 solid transparent' }], { duration:1200 });
    return true;
  }

  function executeCompendiumRoute(route) {
    if (!route || (location.pathname.split('/').pop() || '').toLowerCase() !== 'compendium.html') return false;
    try {
      if (route.type === 'entity' && typeof showEntity === 'function') showEntity(route.key, false);
      else if (route.type === 'skill' && typeof showSkill === 'function') showSkill(route.key, false);
      else if (route.type === 'group' && typeof showGroup === 'function') showGroup(route.key, false);
      else if (route.type === 'category' && typeof showCategory === 'function') showCategory(route.key, false);
      else if (route.type === 'food-gathering') {
        if (typeof renderView !== 'function') return false;
        renderView({ type:'food-gathering', key:'food-gathering' }, { push:false });
      } else if (typeof showHome === 'function') showHome(false);
      else return false;
    } catch (_) {
      return false;
    }
    const title = document.querySelector('#compArticle .comp-title-row,#fgCalculator .comp-title-row,#compArticle');
    return highlight(title);
  }

  function queueContextJump(note, route) {
    const payload = { id:note.id, route, createdAt:Date.now() };
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (currentPage !== route.page) {
      location.href = route.page;
      return;
    }
    retryContextJump();
  }

  function retryContextJump(attempt = 0) {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (_) {}
    if (!pending?.route) return;
    const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (currentPage !== pending.route.page) return;
    if (executeCompendiumRoute(pending.route)) {
      localStorage.removeItem(PENDING_KEY);
      return;
    }
    if (attempt < 35) setTimeout(() => retryContextJump(attempt + 1), 160);
    else localStorage.removeItem(PENDING_KEY);
  }

  function noteRank(note) {
    if (note?.status === 'resolved') return 2;
    if (note?.status === 'actioned') return 1;
    return 0;
  }

  function applyHeldPresentation() {
    const notes = readNotes();
    const byId = new Map(notes.map(note => [String(note.id), note]));
    const panel = document.querySelector('.feedback-panel');
    const list = panel?.querySelector('.feedback-list');
    if (!list) return;

    const cards = [...list.querySelectorAll('.feedback-card')];
    for (const card of cards) {
      const note = byId.get(String(card.dataset.feedbackId || ''));
      const held = note?.status === 'actioned';
      card.classList.toggle('feedback-card--actioned', held);
      let badge = card.querySelector('.feedback-actioned-badge');
      if (held) {
        const prefix = note.holdReason === 'amended' ? 'Amended' : 'Actioned';
        const text = `${prefix} in ${versionNumber(note.actionedVersion) || 'this build'} · awaiting next update`;
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'feedback-actioned-badge';
          card.querySelector('.feedback-card__meta')?.insertAdjacentElement('afterend', badge);
        }
        badge.textContent = text;
        const fail = card.querySelector('.feedback-fail');
        const pass = card.querySelector('.feedback-pass');
        if (fail) fail.disabled = true;
        if (pass) { pass.disabled = true; pass.textContent = 'Awaiting update'; }
      }
    }

    [...cards].sort((a,b) => {
      const left = byId.get(String(a.dataset.feedbackId || ''));
      const right = byId.get(String(b.dataset.feedbackId || ''));
      return noteRank(left) - noteRank(right) || String(right?.updatedAt || '').localeCompare(String(left?.updatedAt || ''));
    }).forEach(card => list.appendChild(card));
  }

  function holdAmendments(before) {
    const prior = new Map(before.map(note => [String(note.id), note]));
    const notes = readNotes();
    const now = new Date().toISOString();
    const version = currentVersionSync();
    let changed = false;
    for (const note of notes) {
      const old = prior.get(String(note.id));
      if (!old || note.status === 'resolved') continue;
      const amended = String(old.comment || '') !== String(note.comment || '') || String(old.type || '') !== String(note.type || '');
      if (!amended) continue;
      note.status = 'actioned';
      note.actionedAt = now;
      note.actionedVersion = version;
      note.holdReason = 'amended';
      note.updatedAt = now;
      changed = true;
    }
    if (changed) writeNotes(notes);
    applyHeldPresentation();
  }

  function installFairgroundTheme() {
    if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'fairground.html') return;
    const style = document.createElement('style');
    style.setAttribute('data-feedback-round5-fairground', 'true');
    style.textContent = `
      .fairground-app .cultural-activity-section{
        border:1px solid #9e7842!important;border-radius:12px!important;
        background:linear-gradient(165deg,#efe0b8,#cfb77f)!important;color:#342719!important;
        box-shadow:0 6px 14px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.22)!important;
      }
      .fairground-app .cultural-activity-section h4{color:#4b321d!important;font-family:Georgia,'Times New Roman',serif!important}
      .fairground-app .cultural-activity-metric{border:1px solid rgba(69,45,24,.22)!important;background:rgba(255,248,225,.32)!important}
      .fairground-app .cultural-activity-metric span,.fairground-app .cultural-profit>span{color:#725537!important}
      .fairground-app .cultural-activity-metric strong{color:#342719!important}
      .fairground-app .cultural-profit{border:1px solid rgba(69,45,24,.28)!important;background:rgba(86,58,29,.12)!important;color:#342719!important}
      .fairground-app .cultural-profit strong{color:#4b321d!important}.fairground-app .cultural-profit small{color:#6b543b!important}
      .fairground-app[data-season="winter"] .cultural-activity-section{background:linear-gradient(165deg,#e5dcc8,#b8aa8f)!important;color:#302a23!important;border-color:#8d7857!important}
      .fairground-app[data-season="winter"] .cultural-activity-metric{background:rgba(255,255,255,.18)!important;border-color:rgba(65,54,42,.24)!important}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('click', event => {
    const exportButton = event.target?.closest?.('.feedback-export');
    if (exportButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportOpenFeedback().catch(console.error);
      return;
    }

    const jump = event.target?.closest?.('.feedback-jump');
    if (jump) {
      const card = jump.closest('.feedback-card');
      const note = readNotes().find(row => String(row.id) === String(card?.dataset.feedbackId || ''));
      const route = compendiumRoute(note);
      if (note && route) {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.querySelector('.feedback-panel')?.closest('.feedback-backdrop')?.remove();
        queueContextJump(note, route);
        return;
      }
    }

    if (event.target?.closest?.('.feedback-followup-save,.feedback-save')) {
      const before = readNotes();
      setTimeout(() => holdAmendments(before), 20);
    }
  }, true);

  installFairgroundTheme();
  setTimeout(retryContextJump, 300);
})();

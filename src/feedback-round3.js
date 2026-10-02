(() => {
  'use strict';

  const STORAGE_KEY = 'tribenet.feedback.v1';
  const PENDING_JUMP_KEY = 'tribenet.feedback.pendingJump';
  let currentVersion = '';
  let presentationQueued = false;

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

  async function getCurrentVersion() {
    if (currentVersion) return currentVersion;
    try { currentVersion = versionNumber(await window.tribenet?.getVersion?.()); } catch (_) {}
    if (!currentVersion) {
      const label = document.querySelector('#versionLabel,#compVersion,#tmVersion,#tribeManagerVersion,#fairVersion,#fairgroundVersion')?.textContent || '';
      currentVersion = versionNumber(label);
    }
    return currentVersion || 'unknown';
  }

  async function restoreActionedAfterUpdate() {
    const version = await getCurrentVersion();
    const notes = readNotes();
    let changed = false;
    for (const note of notes) {
      if (note.status !== 'actioned') continue;
      const actionedVersion = versionNumber(note.actionedVersion || '');
      if (!actionedVersion || !version || actionedVersion === version) continue;
      note.status = 'open';
      note.reviewReadyAt = new Date().toISOString();
      note.reviewFromVersion = actionedVersion;
      note.updatedAt = note.reviewReadyAt;
      changed = true;
    }
    if (changed) writeNotes(notes);
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

  async function exportAndMarkActioned() {
    const version = await getCurrentVersion();
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
      comments:notes.map(note => ({ ...note }))
    });
    queuePresentation();
  }

  function noteRank(note) {
    if (note?.status === 'resolved') return 2;
    if (note?.status === 'actioned') return 1;
    return 0;
  }

  function applyActionedPresentation() {
    presentationQueued = false;
    const notes = readNotes();
    const byId = new Map(notes.map(note => [String(note.id), note]));
    const actionedComments = new Set(notes.filter(note => note.status === 'actioned').map(note => String(note.comment || '')));
    const openCount = notes.filter(note => note.status === 'open').length;
    const actionedCount = notes.filter(note => note.status === 'actioned').length;
    const resolvedCount = notes.filter(note => note.status === 'resolved').length;

    const launcherCount = document.querySelector('.feedback-launcher__count');
    if (launcherCount) launcherCount.textContent = String(openCount);

    document.querySelectorAll('.feedback-marker').forEach(marker => {
      marker.style.display = actionedComments.has(String(marker.title || '')) ? 'none' : '';
    });

    const panel = document.querySelector('.feedback-panel');
    const list = panel?.querySelector('.feedback-list');
    if (list) {
      const cards = [...list.querySelectorAll('.feedback-card')];
      cards.forEach(card => {
        const note = byId.get(String(card.dataset.feedbackId || ''));
        const actioned = note?.status === 'actioned';
        card.classList.toggle('feedback-card--actioned', actioned);
        card.querySelector('.feedback-actioned-badge')?.remove();
        if (actioned) {
          const badge = document.createElement('div');
          badge.className = 'feedback-actioned-badge';
          badge.textContent = `Actioned in ${versionNumber(note.actionedVersion) || 'this build'} · awaiting update`;
          card.querySelector('.feedback-card__meta')?.insertAdjacentElement('afterend', badge);
          const fail = card.querySelector('.feedback-fail');
          const pass = card.querySelector('.feedback-pass');
          if (fail) { fail.disabled = true; fail.title = 'Available again after the next app update'; }
          if (pass) { pass.disabled = true; pass.textContent = 'Awaiting update'; pass.title = 'This feedback will return for Pass / Fail after the next app version'; }
        }
      });
      cards.sort((a,b) => {
        const left = byId.get(String(a.dataset.feedbackId || ''));
        const right = byId.get(String(b.dataset.feedbackId || ''));
        return noteRank(left) - noteRank(right);
      }).forEach(card => list.appendChild(card));
    }

    const footerCount = panel?.querySelector('.feedback-panel__footer > span');
    if (footerCount) footerCount.textContent = `${openCount} open · ${actionedCount} actioned · ${resolvedCount} resolved`;
  }

  function queuePresentation() {
    if (presentationQueued) return;
    presentationQueued = true;
    requestAnimationFrame(applyActionedPresentation);
  }

  function desiredPage(note) {
    const selector = String(note?.target?.selector || '');
    if (/openFairgroundButton/i.test(selector)) return 'fairground.html';
    if (/openCompendiumButton/i.test(selector)) return 'compendium.html';
    if (/openTurnManagerButton/i.test(selector)) return 'turn-manager.html';
    if (/openTribeManagerButton/i.test(selector)) return 'tribe-manager.html';
    return String(note?.page?.key || 'index.html').toLowerCase();
  }

  function inferFairgroundFeature(note) {
    if (note?.context?.fairgroundFeature) return String(note.context.fairgroundFeature);
    const haystack = `${note?.target?.selector || ''} ${note?.target?.text || ''} ${note?.comment || ''}`.toLowerCase();
    if (/cultural|pavilion|activity-board|cultural-activity/.test(haystack)) return 'pavilion';
    if (/workshop|craft-card|craft workshop/.test(haystack)) return 'workshop';
    if (/trading-wagon|planned trades|buy from fair|sell to fair/.test(haystack)) return 'trading-wagon';
    if (/storehouse|stock-|holding location/.test(haystack)) return 'storehouse';
    if (/market-change|market stalls|price change/.test(haystack)) return 'market';
    if (/research|scholar/.test(haystack)) return 'scholar';
    if (/fairmaster/.test(haystack)) return 'fairmaster';
    if (/caravan/.test(haystack)) return 'caravan';
    return null;
  }

  function locate(note) {
    if (!note?.target) return null;
    if (note.target.id) {
      const byId = document.getElementById(note.target.id);
      if (byId) return byId;
    }
    if (note.target.selector) {
      try { return document.querySelector(note.target.selector); } catch (_) {}
    }
    return null;
  }

  function highlight(element) {
    if (!element) return false;
    element.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
    element.animate?.([{ outline:'3px solid #d8a643' }, { outline:'0 solid transparent' }], { duration:1200 });
    return true;
  }

  function openFairgroundFeature(feature) {
    if (!feature) return false;
    try {
      if (typeof openHotspot === 'function' && typeof hotspotsApi !== 'undefined') {
        const hotspot = hotspotsApi.getHotspot(feature);
        if (hotspot) { openHotspot(hotspot); return true; }
      }
    } catch (_) {}
    const button = document.querySelector(`[data-hotspot="${CSS.escape(feature)}"]`);
    if (button) { button.click(); return true; }
    return false;
  }

  function performJump(note, feature = null) {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (page === 'fairground.html' && feature) openFairgroundFeature(feature);
    const target = locate(note);
    if (target) return highlight(target);
    if (page === 'fairground.html' && feature) {
      const fallback = document.querySelector('.cultural-activity-sections,#featureContent,.feature-drawer');
      if (fallback && !fallback.classList.contains('hidden')) return highlight(fallback);
    }
    return false;
  }

  function schedulePendingJump(note, feature) {
    const payload = { id:note.id, page:desiredPage(note), feature:feature || null, createdAt:Date.now() };
    localStorage.setItem(PENDING_JUMP_KEY, JSON.stringify(payload));
    if (payload.page !== (location.pathname.split('/').pop() || 'index.html').toLowerCase()) {
      location.href = payload.page;
      return;
    }
    retryPendingJump();
  }

  function retryPendingJump(attempt = 0) {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_JUMP_KEY) || 'null'); } catch (_) {}
    if (!pending?.id) return;
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (pending.page && pending.page !== page) return;
    const note = readNotes().find(row => String(row.id) === String(pending.id));
    if (!note) { localStorage.removeItem(PENDING_JUMP_KEY); return; }
    if (performJump(note, pending.feature)) {
      localStorage.removeItem(PENDING_JUMP_KEY);
      return;
    }
    if (attempt < 25) setTimeout(() => retryPendingJump(attempt + 1), 180);
    else localStorage.removeItem(PENDING_JUMP_KEY);
  }

  function openFeedbackOnFeedback() {
    const panelBackdrop = document.querySelector('.feedback-panel')?.closest('.feedback-backdrop');
    panelBackdrop?.remove();
    const launcher = document.querySelector('.feedback-launcher');
    if (!launcher) return;
    const rect = launcher.getBoundingClientRect();
    launcher.removeAttribute('data-feedback-ui');
    launcher.dispatchEvent(new MouseEvent('click', {
      bubbles:true, cancelable:true, ctrlKey:true, button:0,
      clientX:rect.left + rect.width / 2, clientY:rect.top + rect.height / 2
    }));
    launcher.setAttribute('data-feedback-ui', 'true');
    setTimeout(() => {
      const type = document.querySelector('.feedback-dialog .feedback-type-select');
      if (type) type.value = 'ui';
      const field = document.querySelector('.feedback-dialog .feedback-comment');
      if (field) field.placeholder = 'What should change about the Feedback tool itself?';
    }, 0);
  }

  function enhanceFeedbackPanel() {
    const panel = document.querySelector('.feedback-panel');
    if (!panel) return;
    const actions = panel.querySelector('.feedback-footer-actions');
    if (actions && !actions.querySelector('.feedback-about-feedback')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'feedback-button feedback-about-feedback';
      button.textContent = 'Feedback about Feedback';
      button.addEventListener('click', openFeedbackOnFeedback);
      actions.prepend(button);
    }
    queuePresentation();
  }

  function installStyle() {
    const style = document.createElement('style');
    style.setAttribute('data-feedback-round3', 'true');
    style.textContent = `
      .feedback-card--actioned{opacity:.48;filter:saturate(.55);order:2}
      .feedback-actioned-badge{margin-top:6px;color:#c8ad73;font-size:11px;font-style:italic}
      .feedback-card--actioned .feedback-fail,.feedback-card--actioned .feedback-pass{cursor:default;opacity:.65}
      .feedback-footer-actions{flex-wrap:wrap;justify-content:flex-end}
      .fairground-app .cultural-activity-sections{display:grid;gap:14px}
      .fairground-app .cultural-activity-section{border:1px solid #735536;border-radius:12px;padding:15px 16px;background:linear-gradient(155deg,#38291c,#221a12);color:#f5e8d2;box-shadow:0 6px 14px rgba(0,0,0,.24),inset 0 1px rgba(255,230,188,.08)}
      .fairground-app .cultural-activity-section h4{margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#ffe8b8}
      .fairground-app .cultural-activity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}
      .fairground-app .cultural-activity-metric{padding:9px 10px;border:1px solid #6d5236;border-radius:8px;background:#241b13}
      .fairground-app .cultural-activity-metric span,.fairground-app .cultural-profit>span{display:block;color:#a99274;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
      .fairground-app .cultural-activity-metric strong{display:block;margin-top:3px;color:#f5deba}
      .fairground-app .cultural-profit{margin-top:11px;padding:11px 12px;border:1px solid #8f653b;border-radius:9px;background:#332619;color:#f4e8d2}
      .fairground-app .cultural-profit strong{color:#ffe0a2}.fairground-app .cultural-profit small{display:block;margin-top:4px;color:#c9b396;line-height:1.45}
      .fairground-app[data-season="winter"] .cultural-activity-section{background:linear-gradient(155deg,#302824,#1b1d1e);border-color:#6f5a47}
      .fairground-app[data-season="winter"] .cultural-activity-metric{background:#211c19;border-color:#65513f}
    `;
    document.head.appendChild(style);
  }

  function installHandlers() {
    document.addEventListener('click', event => {
      const exportButton = event.target?.closest?.('.feedback-export');
      if (exportButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        exportAndMarkActioned().catch(console.error);
        return;
      }
      const jump = event.target?.closest?.('.feedback-jump');
      if (jump) {
        const card = jump.closest('.feedback-card');
        const note = readNotes().find(row => String(row.id) === String(card?.dataset.feedbackId || ''));
        if (!note) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        document.querySelector('.feedback-panel')?.closest('.feedback-backdrop')?.remove();
        schedulePendingJump(note, desiredPage(note) === 'fairground.html' ? inferFairgroundFeature(note) : null);
      }
    }, true);

    const observer = new MutationObserver(() => {
      enhanceFeedbackPanel();
      queuePresentation();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(retryPendingJump, 250);
  }

  installStyle();
  window.TribeNetFeedbackRound3Ready = (async () => {
    await restoreActionedAfterUpdate();
    installHandlers();
  })();
})();

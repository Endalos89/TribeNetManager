(() => {
  'use strict';

  const STORAGE_KEY = 'tribenet.feedback.v1';
  const SHOW_RESOLVED_KEY = 'tribenet.feedback.showResolved';
  const ROOT_ATTR = 'data-feedback-ui';
  const TYPES = ['change', 'bug', 'data', 'ui'];
  let notes = loadNotes();
  let markerLayer = null;
  let launcher = null;
  let renderQueued = false;
  let showResolved = loadShowResolved();

  function loadNotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function loadShowResolved() {
    try {
      const saved = localStorage.getItem(SHOW_RESOLVED_KEY);
      return saved == null ? true : saved === 'true';
    } catch (_) {
      return true;
    }
  }

  function saveShowResolved() {
    try { localStorage.setItem(SHOW_RESOLVED_KEY, String(showResolved)); } catch (_) {}
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    renderLauncher();
    queueMarkers();
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function pageKey() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path.toLowerCase();
  }

  function textPreview(el) {
    if (!el) return '';
    const value = 'value' in el && typeof el.value === 'string' ? el.value : '';
    const raw = value || el.innerText || el.textContent || '';
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 220);
  }

  function meaningfulData(el) {
    const data = {};
    if (!el || !el.attributes) return data;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-') && attr.name !== ROOT_ATTR) data[attr.name] = attr.value;
    }
    return data;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`);
  }

  function stableSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${cssEscape(el.id)}`;

    const stableAttrs = ['data-section', 'data-skill', 'data-item', 'data-id', 'data-key', 'name'];
    for (const attr of stableAttrs) {
      const value = el.getAttribute && el.getAttribute(attr);
      if (value) return `${el.tagName.toLowerCase()}[${attr}="${String(value).replace(/"/g, '\\"')}"]`;
    }

    const parts = [];
    let current = el;
    while (current && current !== document.body && parts.length < 5) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part = `#${cssEscape(current.id)}`;
        parts.unshift(part);
        break;
      }
      const usefulClass = Array.from(current.classList || []).find(c => !/^active$|^hidden$|^selected$/.test(c));
      if (usefulClass) part += `.${cssEscape(usefulClass)}`;
      const parent = current.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(child => child.tagName === current.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ');
  }

  function describeTarget(el) {
    if (!el) return 'Unknown area';
    const bits = [el.tagName ? el.tagName.toLowerCase() : 'element'];
    if (el.id) bits.push(`#${el.id}`);
    const data = meaningfulData(el);
    const dataPairs = Object.entries(data).slice(0, 3).map(([k, v]) => `${k}=${v}`);
    if (dataPairs.length) bits.push(dataPairs.join(', '));
    const preview = textPreview(el);
    if (preview) bits.push(`“${preview.slice(0, 90)}${preview.length > 90 ? '…' : ''}”`);
    return bits.join(' · ');
  }

  function currentContext() {
    const context = {};
    const candidates = [
      ['turn', '#turnPicker, #planningTurnSelect, #turnSelect'],
      ['unit', '#unitCode, #selectedUnitCode, #unitTitle'],
      ['hex', '#selectedCoordinate'],
      ['compendium', '#compBreadcrumbs'],
      ['fairSnapshot', '#fairSnapshotSelect']
    ];
    candidates.forEach(([key, selector]) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const value = 'value' in el && el.value ? el.value : textPreview(el);
      if (value) context[key] = String(value).slice(0, 160);
    });
    return context;
  }

  function makeLocation(el, event) {
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    return {
      selector: stableSelector(el),
      tag: (el.tagName || '').toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList || []).slice(0, 8),
      data: meaningfulData(el),
      text: textPreview(el),
      point: {
        xRatio: Math.max(0, Math.min(1, (event.clientX - rect.left) / width)),
        yRatio: Math.max(0, Math.min(1, (event.clientY - rect.top) / height)),
        clientX: Math.round(event.clientX),
        clientY: Math.round(event.clientY)
      },
      canvas: el.tagName === 'CANVAS' ? {
        width: el.width,
        height: el.height,
        cssWidth: Math.round(rect.width),
        cssHeight: Math.round(rect.height)
      } : null
    };
  }

  function getAppVersion() {
    const ids = ['versionLabel', 'compVersion', 'tmVersion', 'tribeManagerVersion', 'fairVersion', 'fairgroundVersion'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && textPreview(el)) return textPreview(el);
    }
    return '';
  }

  function exportPayload() {
    return {
      format: 'tribenet-feedback',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: getAppVersion(),
      comments: notes.filter(note => note.status !== 'resolved').map(note => ({ ...note }))
    };
  }

  function downloadExport() {
    const payload = exportPayload();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tribenet-feedback-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function feedbackElement(el) {
    return el && el.closest && el.closest(`[${ROOT_ATTR}]`);
  }

  function openEditor(existing, capture) {
    const note = existing || {
      id: makeId(),
      type: 'change',
      status: 'open',
      comment: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      page: {
        key: pageKey(),
        title: document.title,
        path: location.pathname,
        hash: location.hash || ''
      },
      context: currentContext(),
      target: capture.location
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'feedback-backdrop';
    backdrop.setAttribute(ROOT_ATTR, 'true');
    const dialog = document.createElement('div');
    dialog.className = 'feedback-dialog';
    dialog.innerHTML = `
      <div class="feedback-dialog__head">
        <h2>${existing ? 'Edit comment' : 'Add comment'}</h2>
        <button class="feedback-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="feedback-dialog__body">
        <div class="feedback-target"></div>
        <label class="feedback-field"><span>Type</span><select class="feedback-type-select">
          <option value="change">Change</option>
          <option value="bug">Bug</option>
          <option value="data">Data / Rules</option>
          <option value="ui">UI</option>
        </select></label>
        <label class="feedback-field"><span>Comment</span><textarea class="feedback-comment" placeholder="What did you spot, and what should change?"></textarea></label>
        <div class="feedback-actions">
          ${existing ? '<button class="feedback-button feedback-delete feedback-button--danger" type="button">Delete</button>' : ''}
          ${existing ? `<button class="feedback-button feedback-resolve" type="button">${note.status === 'resolved' ? 'Reopen' : 'Pass'}</button>` : ''}
          <button class="feedback-button feedback-cancel" type="button">Cancel</button>
          <button class="feedback-button feedback-button--primary feedback-save" type="button">Save Comment</button>
        </div>
      </div>`;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    dialog.querySelector('.feedback-target').textContent = existing ? targetDescription(note.target) : describeTarget(capture.element);
    const typeSelect = dialog.querySelector('.feedback-type-select');
    const comment = dialog.querySelector('.feedback-comment');
    typeSelect.value = TYPES.includes(note.type) ? note.type : 'change';
    comment.value = note.comment || '';
    setTimeout(() => comment.focus(), 0);

    const close = () => backdrop.remove();
    dialog.querySelector('.feedback-close').addEventListener('click', close);
    dialog.querySelector('.feedback-cancel').addEventListener('click', close);
    backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
    dialog.querySelector('.feedback-save').addEventListener('click', () => {
      const value = comment.value.trim();
      if (!value) { comment.focus(); return; }
      note.type = typeSelect.value;
      note.comment = value;
      note.updatedAt = new Date().toISOString();
      note.context = { ...(note.context || {}), ...currentContext() };
      const index = notes.findIndex(item => item.id === note.id);
      if (index >= 0) notes[index] = note;
      else notes.push(note);
      saveNotes();
      close();
    });
    const resolve = dialog.querySelector('.feedback-resolve');
    if (resolve) resolve.addEventListener('click', () => {
      note.status = note.status === 'resolved' ? 'open' : 'resolved';
      note.updatedAt = new Date().toISOString();
      const index = notes.findIndex(item => item.id === note.id);
      if (index >= 0) notes[index] = note;
      saveNotes();
      close();
    });
    const del = dialog.querySelector('.feedback-delete');
    if (del) del.addEventListener('click', () => {
      notes = notes.filter(item => item.id !== note.id);
      saveNotes();
      close();
    });
  }

  function targetDescription(target) {
    if (!target) return 'Unknown area';
    const parts = [];
    if (target.id) parts.push(`#${target.id}`);
    else if (target.selector) parts.push(target.selector);
    if (target.text) parts.push(`“${target.text.slice(0, 100)}${target.text.length > 100 ? '…' : ''}”`);
    return parts.join(' · ') || target.tag || 'area';
  }

  function locateTarget(note) {
    if (!note.target) return null;
    if (note.target.id) {
      const byId = document.getElementById(note.target.id);
      if (byId) return byId;
    }
    if (note.target.selector) {
      try { return document.querySelector(note.target.selector); } catch (_) { /* ignore */ }
    }
    return null;
  }

  function renderMarkers() {
    renderQueued = false;
    if (!markerLayer) {
      markerLayer = document.createElement('div');
      markerLayer.setAttribute(ROOT_ATTR, 'true');
      document.body.appendChild(markerLayer);
    }
    markerLayer.innerHTML = '';
    const current = pageKey();
    notes.filter(note => note.status !== 'resolved' && note.page && note.page.key === current).forEach((note, index) => {
      const target = locateTarget(note);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return;
      const point = note.target.point || { xRatio:.5, yRatio:.5 };
      const rawX = Number(point.xRatio);
      const rawY = Number(point.yRatio);
      const xRatio = Number.isFinite(rawX) ? rawX : .5;
      const yRatio = Number.isFinite(rawY) ? rawY : .5;
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'feedback-marker';
      marker.dataset.type = note.type || 'change';
      marker.textContent = String(index + 1);
      marker.title = note.comment;
      marker.style.left = `${rect.left + rect.width * xRatio}px`;
      marker.style.top = `${rect.top + rect.height * yRatio}px`;
      marker.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        openEditor(note, { element:target, location:note.target });
      });
      markerLayer.appendChild(marker);
    });
  }

  function queueMarkers() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderMarkers);
  }

  function renderLauncher() {
    if (!launcher) {
      launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.className = 'feedback-launcher';
      launcher.setAttribute(ROOT_ATTR, 'true');
      launcher.innerHTML = '<span>Feedback</span><span class="feedback-launcher__count">0</span>';
      launcher.addEventListener('click', openPanel);
      document.body.appendChild(launcher);
    }
    launcher.querySelector('.feedback-launcher__count').textContent = String(notes.filter(note => note.status !== 'resolved').length);
  }

  function appendFollowUp(note, value) {
    const text = String(value || '').trim();
    if (!text) return false;
    const stamp = new Date();
    const label = stamp.toLocaleString();
    note.comment = `${String(note.comment || '').trim()}\n\nFollow-up (${label}): ${text}`.trim();
    note.status = 'open';
    note.updatedAt = stamp.toISOString();
    note.context = { ...(note.context || {}), ...currentContext() };
    const index = notes.findIndex(item => item.id === note.id);
    if (index >= 0) notes[index] = note;
    saveNotes();
    return true;
  }

  function openPanel() {
    const backdrop = document.createElement('div');
    backdrop.className = 'feedback-backdrop';
    backdrop.setAttribute(ROOT_ATTR, 'true');
    const panel = document.createElement('div');
    panel.className = 'feedback-panel';
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    const draw = () => {
      const ordered = [...notes].sort((a, b) => {
        const aResolved = a.status === 'resolved' ? 1 : 0;
        const bResolved = b.status === 'resolved' ? 1 : 0;
        if (aResolved !== bResolved) return aResolved - bResolved;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
      const visible = showResolved ? ordered : ordered.filter(note => note.status !== 'resolved');
      const openCount = notes.filter(n => n.status !== 'resolved').length;
      const resolvedCount = notes.filter(n => n.status === 'resolved').length;
      panel.innerHTML = `
        <div class="feedback-panel__head"><h2>Feedback comments</h2><button class="feedback-close" type="button">×</button></div>
        <div class="feedback-help">Ctrl+click anywhere to add feedback. Use <strong>Pass</strong> when a fix is confirmed; use <strong>Fail</strong> to append what still needs changing.</div>
        ${visible.length ? '<div class="feedback-list"></div>' : `<div class="feedback-empty">${notes.length ? 'No open comments are visible.' : 'No comments yet. Ctrl+click an area to add one.'}</div>`}
        <div class="feedback-panel__footer">
          <span>${openCount} open · ${resolvedCount} resolved</span>
          <div class="feedback-footer-actions">
            <button class="feedback-button feedback-toggle-resolved" type="button">${showResolved ? 'Hide resolved' : 'Show resolved'}</button>
            <button class="feedback-button feedback-button--primary feedback-export" type="button">Export JSON</button>
          </div>
        </div>`;
      panel.querySelector('.feedback-close').addEventListener('click', () => backdrop.remove());
      panel.querySelector('.feedback-export').addEventListener('click', downloadExport);
      panel.querySelector('.feedback-toggle-resolved').addEventListener('click', () => {
        showResolved = !showResolved;
        saveShowResolved();
        draw();
      });
      const list = panel.querySelector('.feedback-list');
      if (!list) return;
      visible.forEach(note => {
        const card = document.createElement('div');
        card.className = `feedback-card${note.status === 'resolved' ? ' feedback-card--resolved' : ''}`;
        card.dataset.feedbackId = note.id;
        card.innerHTML = `
          <span class="feedback-type">${escapeHtml(note.type || 'change')}</span>
          <div><div class="feedback-card__comment"></div><div class="feedback-card__meta"></div><div class="feedback-followup-slot"></div></div>
          <div class="feedback-card__buttons">
            <button class="feedback-button feedback-button--compact feedback-fail" type="button">Fail</button>
            <button class="feedback-button feedback-button--compact ${note.status === 'resolved' ? '' : 'feedback-button--pass'} feedback-pass" type="button">${note.status === 'resolved' ? 'Reopen' : 'Pass'}</button>
            <button class="feedback-icon-button feedback-jump" type="button" title="Jump to area">↗</button>
            <button class="feedback-icon-button feedback-edit" type="button" title="Edit">✎</button>
          </div>`;
        card.querySelector('.feedback-card__comment').textContent = note.comment || '';
        card.querySelector('.feedback-card__meta').textContent = `${note.page?.title || note.page?.key || 'Page'} · ${targetDescription(note.target)}`;
        card.querySelector('.feedback-edit').addEventListener('click', () => {
          backdrop.remove();
          openEditor(note, { element:locateTarget(note), location:note.target });
        });
        card.querySelector('.feedback-jump').addEventListener('click', () => jumpToNote(note, backdrop));
        card.querySelector('.feedback-pass').addEventListener('click', () => {
          note.status = note.status === 'resolved' ? 'open' : 'resolved';
          note.updatedAt = new Date().toISOString();
          const index = notes.findIndex(item => item.id === note.id);
          if (index >= 0) notes[index] = note;
          saveNotes();
          draw();
        });
        card.querySelector('.feedback-fail').addEventListener('click', () => {
          const slot = card.querySelector('.feedback-followup-slot');
          if (slot.querySelector('textarea')) {
            slot.querySelector('textarea').focus();
            return;
          }
          slot.innerHTML = `
            <div class="feedback-followup">
              <textarea placeholder="What still needs changing?"></textarea>
              <div class="feedback-followup-actions">
                <button class="feedback-button feedback-button--compact feedback-followup-cancel" type="button">Cancel</button>
                <button class="feedback-button feedback-button--compact feedback-button--primary feedback-followup-save" type="button">Add follow-up</button>
              </div>
            </div>`;
          const field = slot.querySelector('textarea');
          field.focus();
          slot.querySelector('.feedback-followup-cancel').addEventListener('click', () => { slot.innerHTML = ''; });
          slot.querySelector('.feedback-followup-save').addEventListener('click', () => {
            if (!appendFollowUp(note, field.value)) {
              field.focus();
              return;
            }
            draw();
          });
        });
        list.appendChild(card);
      });
    };
    backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) backdrop.remove(); });
    draw();
  }

  function jumpToNote(note, panelBackdrop) {
    if (!note.page || note.page.key !== pageKey()) {
      location.href = note.page?.key || 'index.html';
      return;
    }
    const target = locateTarget(note);
    if (!target) return;
    panelBackdrop.remove();
    target.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
    target.animate?.([{ outline:'3px solid #d8a643' }, { outline:'0 solid transparent' }], { duration:1100 });
    setTimeout(queueMarkers, 350);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function handleCapture(event) {
    if (!event.ctrlKey || event.button !== 0) return;
    if (feedbackElement(event.target)) return;
    const target = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!target || target === document.documentElement || target === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor(null, { element:target, location:makeLocation(target, event) });
  }

  function init() {
    renderLauncher();
    renderMarkers();
    document.addEventListener('click', handleCapture, true);
    window.addEventListener('scroll', queueMarkers, true);
    window.addEventListener('resize', queueMarkers);
    const observer = new MutationObserver(queueMarkers);
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class', 'style'] });
    window.TribeNetFeedback = {
      list: () => notes.map(note => ({ ...note })),
      exportPayload,
      exportJson:downloadExport,
      clearResolved: () => { notes = notes.filter(note => note.status !== 'resolved'); saveNotes(); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();

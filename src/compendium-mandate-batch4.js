(async () => {
  const M = window.TRIBENET_MANDATE;
  if (!M) return;
  await M.whenReady();

  const batch = M.batches.find(item => item.id === '4');
  if (!batch) return;

  const e = value => typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const get = id => document.getElementById(id);

  function exactBlocks(section) {
    const html = (section.body || []).map(block => {
      if (block.type === 'table') {
        return `<div class="mandate-table-wrap"><table class="mandate-table"><tbody>${(block.rows || []).map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      const style = String(block.style || '');
      const cls = style.includes('Bullet') ? ' mandate-bullet' : style.includes('Number') ? ' mandate-numbered' : '';
      return `<p class="mandate-exact-line${cls}">${e(block.text || '')}</p>`;
    }).join('');
    return html || '<p class="comp-muted">This heading contains no direct text before its first subsection.</p>';
  }

  function openReference(id) {
    const section = M.getSection(id);
    const modal = get('mandateReferenceModal');
    if (!section || !modal) return;
    get('mandateModalTitle').textContent = `§ ${section.section} — ${section.title}`;
    get('mandateModalMeta').textContent = `${M.sourceDocument} · printed page ${section.page || '—'}`;
    get('mandateModalBody').innerHTML = exactBlocks(section);
    get('mandateModalOpenArticle').onclick = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      renderView({type:'mandate-section', key:section.section}, {push:true});
    };
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function bindBatch4(root) {
    root.querySelectorAll('[data-b4-section]').forEach(button => {
      button.onclick = () => renderView({type:'mandate-section', key:button.dataset.b4Section}, {push:true});
    });
    root.querySelectorAll('[data-b4-ref]').forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        openReference(button.dataset.b4Ref);
      };
    });
  }

  function showBatch4(push = true) {
    if (typeof setView === 'function') setView({type:'mandate-batch', key:'4'}, {push});
    if (get('compBreadcrumbs')) get('compBreadcrumbs').textContent = 'Compendium › Mandate › Batch 4';
    const article = get('compArticle');
    if (!article) return;
    const topSections = M.topLevel().filter(section => batch.topSections.includes(section.section));
    article.innerHTML = `<div class="comp-title-row"><div><div class="comp-kicker">Mandate batch 4 · Complete</div><h1>Naval & advanced systems</h1><div class="comp-short">${batch.sectionCount} indexed sections · §§20–27 · pages 134–165</div></div><span class="comp-badge">✓ Complete</span></div>
      <p class="comp-lead">Click any section to browse it, or click Reference for the word-for-word Mandate text.</p>
      ${topSections.map(top => {
        const children = M.sections.filter(section => section.topSection === top.section && section.section !== top.section);
        const childRows = children.length ? `<div class="mandate-child-grid">${children.map(child => `<div class="mandate-child-row"><button class="mandate-article-link" data-b4-section="${e(child.section)}">§ ${e(child.section)} · ${e(child.title)}</button><button class="mandate-ref-button" data-b4-ref="${e(child.section)}">Reference</button></div>`).join('')}</div>` : '';
        return `<section class="comp-section mandate-top-card"><div class="mandate-top-heading"><div><button class="mandate-article-link" data-b4-section="${e(top.section)}">§ ${e(top.section)} · ${e(top.title)}</button><span>Printed page ${top.page || '—'} · ${children.length} subsections</span></div><button class="mandate-ref-button" data-b4-ref="${e(top.section)}">Exact reference</button></div>${childRows}</section>`;
      }).join('')}`;
    bindBatch4(article);
    patchNav();
  }

  function patchHome() {
    const article = get('compArticle');
    if (!article) return;
    const badge = article.querySelector('.comp-title-row .comp-badge');
    if (badge && /^\d+\/5$/.test(badge.textContent.trim())) badge.textContent = '4/5';
    const heading = article.querySelector('.mandate-progress-heading span');
    if (heading) heading.textContent = '4 of 5 batches complete · 80%';
    const track = article.querySelector('.mandate-progress-track span');
    if (track) track.style.width = '80%';
    const card = article.querySelector('[data-mandate-batch="4"]');
    if (card) {
      card.classList.remove('pending');
      card.classList.add('complete');
      const status = card.querySelector('.mandate-batch-status');
      if (status) status.textContent = '✓ Complete';
      const detail = card.querySelector('span:last-child');
      if (detail) detail.textContent = `§§20–27 · pages 134–165 · ${batch.sectionCount} indexed sections`;
    }
  }

  function patchNav() {
    const nav = get('compNav');
    if (!nav) return;
    const progress = nav.querySelector('[data-view="mandate-home"] small');
    if (progress) progress.textContent = '4/5';
    const button = nav.querySelector('[data-mandate-batch="4"]');
    if (button) {
      button.innerHTML = `✓ Batch 4 <small>${batch.sectionCount}</small>`;
    }
  }

  const previousRenderNav = renderNav;
  renderNav = function(...args) {
    const result = previousRenderNav(...args);
    patchNav();
    return result;
  };

  const previousRenderView = renderView;
  renderView = function(view, opt = {}) {
    if (view?.type === 'mandate-batch' && String(view.key) === '4') return showBatch4(opt.push || false);
    const result = previousRenderView(view, opt);
    if (view?.type === 'mandate-home') patchHome();
    patchNav();
    return result;
  };

  document.addEventListener('click', event => {
    const batch4 = event.target.closest?.('[data-mandate-batch="4"]');
    if (batch4) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showBatch4(true);
      return;
    }
    const home = event.target.closest?.('[data-view="mandate-home"]');
    if (home) {
      event.preventDefault();
      event.stopImmediatePropagation();
      previousRenderView({type:'mandate-home', key:null}, {push:true});
      patchHome();
      patchNav();
    }
  }, true);

  setTimeout(() => {
    patchNav();
    if (compState?.view?.type === 'mandate-home') patchHome();
  }, 0);
})();

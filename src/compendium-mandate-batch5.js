(async () => {
  const M = window.TRIBENET_MANDATE;
  if (!M) return;
  await M.whenReady();

  const batch = M.batches.find(item => item.id === '5');
  if (!batch) return;

  const e = value => typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const get = id => document.getElementById(id);
  const labelFor = section => section.section === 'Appendix A'
    ? `Appendix A · ${section.title}`
    : `§ ${section.section} · ${section.title}`;

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
    get('mandateModalTitle').textContent = `${section.section === 'Appendix A' ? 'Appendix A' : `§ ${section.section}`} — ${section.title}`;
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

  function bindBatch5(root) {
    root.querySelectorAll('[data-b5-section]').forEach(button => {
      button.onclick = () => renderView({type:'mandate-section', key:button.dataset.b5Section}, {push:true});
    });
    root.querySelectorAll('[data-b5-ref]').forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        openReference(button.dataset.b5Ref);
      };
    });
  }

  function showBatch5(push = true) {
    if (typeof setView === 'function') setView({type:'mandate-batch', key:'5'}, {push});
    if (get('compBreadcrumbs')) get('compBreadcrumbs').textContent = 'Compendium › Mandate › Batch 5';
    const article = get('compArticle');
    if (!article) return;
    const topSections = M.topLevel().filter(section => batch.topSections.includes(section.section));
    article.innerHTML = `<div class="comp-title-row"><div><div class="comp-kicker">Mandate batch 5 · Complete</div><h1>Remaining references & final audit</h1><div class="comp-short">${batch.sectionCount} indexed sections · §§28–35 + Appendix A · pages 165–191</div></div><span class="comp-badge">✓ Complete</span></div>
      <p class="comp-lead">The Mandate migration is complete. Click any section to browse it, or click Reference for the word-for-word Mandate text.</p>
      ${topSections.map(top => {
        const children = M.sections.filter(section => section.topSection === top.section && section.section !== top.section);
        const childRows = children.length ? `<div class="mandate-child-grid">${children.map(child => `<div class="mandate-child-row"><button class="mandate-article-link" data-b5-section="${e(child.section)}">${e(labelFor(child))}</button><button class="mandate-ref-button" data-b5-ref="${e(child.section)}">Reference</button></div>`).join('')}</div>` : '';
        return `<section class="comp-section mandate-top-card"><div class="mandate-top-heading"><div><button class="mandate-article-link" data-b5-section="${e(top.section)}">${e(labelFor(top))}</button><span>Printed page ${top.page || '—'} · ${children.length} subsections</span></div><button class="mandate-ref-button" data-b5-ref="${e(top.section)}">Exact reference</button></div>${childRows}</section>`;
      }).join('')}`;
    bindBatch5(article);
    patchNav();
  }

  function patchHome() {
    const article = get('compArticle');
    if (!article) return;
    const badge = article.querySelector('.comp-title-row .comp-badge');
    if (badge && /^\d+\/5$/.test(badge.textContent.trim()) && badge.textContent.trim() !== '5/5') badge.textContent = '5/5';
    const heading = article.querySelector('.mandate-progress-heading span');
    if (heading && heading.textContent !== '5 of 5 batches complete · 100%') heading.textContent = '5 of 5 batches complete · 100%';
    const track = article.querySelector('.mandate-progress-track span');
    if (track && track.style.width !== '100%') track.style.width = '100%';
    const card = article.querySelector('[data-mandate-batch="5"]');
    if (card) {
      card.classList.remove('pending');
      card.classList.add('complete');
      const status = card.querySelector('.mandate-batch-status');
      if (status && status.textContent !== '✓ Complete') status.textContent = '✓ Complete';
      const detail = card.querySelector('span:last-child');
      const expected = `§§28–35 + Appendix A · pages 165–191 · ${batch.sectionCount} indexed sections`;
      if (detail && detail.textContent !== expected) detail.textContent = expected;
    }
    if (!article.querySelector('.mandate-complete-note')) {
      const progress = article.querySelector('.mandate-progress-panel');
      progress?.insertAdjacentHTML('afterend', `<div class="comp-callout mandate-complete-note">Migration complete: all ${M.sections.length} Mandate headings and subheadings from §§1–35 and Appendix A are now indexed in the Compendium.</div>`);
    }
  }

  function patchNav() {
    const nav = get('compNav');
    if (!nav) return;
    const progress = nav.querySelector('[data-view="mandate-home"] small');
    if (progress && progress.textContent.trim() !== '5/5') progress.textContent = '5/5';
    const button = nav.querySelector('[data-mandate-batch="5"]');
    if (button && !button.textContent.includes('✓ Batch 5')) button.innerHTML = `✓ Batch 5 <small>${batch.sectionCount}</small>`;
  }

  const previousRenderNav = renderNav;
  renderNav = function(...args) {
    const result = previousRenderNav(...args);
    patchNav();
    return result;
  };

  const previousRenderView = renderView;
  renderView = function(view, opt = {}) {
    if (view?.type === 'mandate-batch' && String(view.key) === '5') return showBatch5(opt.push || false);
    const result = previousRenderView(view, opt);
    if (view?.type === 'mandate-home') patchHome();
    patchNav();
    return result;
  };

  document.addEventListener('click', event => {
    const batch5 = event.target.closest?.('[data-mandate-batch="5"]');
    if (batch5) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showBatch5(true);
    }
  }, true);

  const observer = new MutationObserver(() => {
    patchNav();
    if (compState?.view?.type === 'mandate-home') patchHome();
  });
  observer.observe(document.body, {childList:true, subtree:true});

  setTimeout(() => {
    if (compState?.view?.type === 'mandate-home') {
      previousRenderView({type:'mandate-home', key:null}, {push:false});
      patchHome();
    } else if (compState?.view?.type === 'mandate-batch' && String(compState.view.key) === '5') {
      showBatch5(false);
    }
    patchNav();
    window.TRIBENET_MANDATE_BATCH5_UI_READY = true;
  }, 0);
})();

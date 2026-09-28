(async () => {
  const M = window.TRIBENET_MANDATE;
  if (!M) return;
  const SOURCE = M.sourceDocument;

  const originalEnsureMandateSkills = ensureMandateSkills;
  ensureMandateSkills = catalog => {
    const result = originalEnsureMandateSkills(catalog);
    result.sourceDocument = SOURCE;
    return result;
  };

  await M.whenReady();

  const SKILL_ALIASES = {
    DANCE: ['dance', 'dancing'],
    ARCHAEOLOGY: ['archaeology', 'archeology'],
    'MAINTAIN BOATS': ['maintain boats', 'boat maintenance']
  };
  const e = value => esc(value);
  const cleanSection = value => String(value || '').replace(/^§\s*/, '').replace(/\.$/, '');
  const rx = phrase => new RegExp(`(^|[^a-z0-9])${String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}([^a-z0-9]|$)`, 'i');
  const sectionText = section => M.plainText(section);
  let scrollSpy = null;

  function sectionLabel(section) {
    const id = typeof section === 'string' ? section : section?.section;
    return /^Appendix\s+/i.test(String(id || '')) ? String(id) : `§ ${id}`;
  }

  function sectionLink(id, label = null, extraClass = '') {
    const section = M.getSection(id);
    if (!section) return '';
    const text = label || `${sectionLabel(section)} · ${section.title}`;
    return `<a class="mandate-section-link ${extraClass}" href="#${e(M.anchorId(section.section))}" data-mandate-open="${e(section.section)}">${e(text)}</a>`;
  }

  function linkifyExactText(text) {
    const source = String(text || '');
    const refs = M.findInlineReferences(source);
    if (!refs.length) return e(source);
    let cursor = 0;
    let html = '';
    for (const ref of refs) {
      if (ref.start < cursor) continue;
      html += e(source.slice(cursor, ref.start));
      html += `<a class="mandate-inline-reference" href="#${e(M.anchorId(ref.section))}" data-mandate-doc-link="${e(ref.section)}">${e(source.slice(ref.start, ref.end))}</a>`;
      cursor = ref.end;
    }
    html += e(source.slice(cursor));
    return html;
  }

  function exactBlocks(section) {
    const out = (section.body || []).map(block => {
      if (block.type === 'table') {
        return `<div class="mandate-table-wrap"><table class="mandate-table"><tbody>${(block.rows || []).map(row => `<tr>${row.map(cell => `<td>${linkifyExactText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      const style = String(block.style || '');
      const cls = style.includes('Bullet') ? ' mandate-bullet' : style.includes('Number') ? ' mandate-numbered' : '';
      return `<p class="mandate-exact-line${cls}">${linkifyExactText(block.text || '')}</p>`;
    }).join('');
    return out || '';
  }

  function renderDocumentSection(section) {
    const level = Math.max(1, Number(section.level || 1));
    const headingLevel = Math.min(6, level + 1);
    const tag = `h${headingLevel}`;
    return `<section id="${e(M.anchorId(section.section))}" class="mandate-doc-section mandate-doc-level-${level}" data-mandate-doc-section="${e(section.section)}" data-mandate-top-section="${e(section.topSection || section.section)}">
      <div class="mandate-doc-heading-row">
        <${tag} class="mandate-doc-heading"><span class="mandate-doc-number">${e(sectionLabel(section))}</span><span>${e(section.title)}</span></${tag}>
        ${section.page ? `<span class="mandate-doc-page">p. ${e(section.page)}</span>` : ''}
      </div>
      ${exactBlocks(section)}
    </section>`;
  }

  function renderToc() {
    return M.topLevel().map(top => {
      const descendants = M.sections.filter(section => section.topSection === top.section && section.section !== top.section);
      return `<div class="mandate-toc-group" data-mandate-toc-group="${e(top.section)}">
        <div class="mandate-toc-top-row">
          <a class="mandate-toc-link mandate-toc-top-link" href="#${e(M.anchorId(top.section))}" data-mandate-toc-link="${e(top.section)}" data-mandate-doc-link="${e(top.section)}"><span>${e(sectionLabel(top))}</span><strong>${e(top.title)}</strong></a>
          ${descendants.length ? `<button class="mandate-toc-toggle" data-mandate-top-toggle="${e(top.section)}" aria-expanded="false" title="Show subsections">›</button>` : ''}
        </div>
        ${descendants.length ? `<div class="mandate-toc-children" data-mandate-toc-children="${e(top.section)}" hidden>${descendants.map(child => `<a class="mandate-toc-link mandate-toc-child mandate-toc-level-${Math.min(6, Number(child.level || 2))}" href="#${e(M.anchorId(child.section))}" data-mandate-toc-link="${e(child.section)}" data-mandate-doc-link="${e(child.section)}"><span>${e(sectionLabel(child))}</span><strong>${e(child.title)}</strong></a>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  function leaveReaderMode() {
    if (scrollSpy) {
      scrollSpy.disconnect();
      scrollSpy = null;
    }
    $('compArticle')?.classList.remove('mandate-reader-mode');
  }

  function expandTop(topSection, open = true) {
    const article = $('compArticle');
    if (!article) return;
    const children = article.querySelector(`[data-mandate-toc-children="${CSS.escape(String(topSection))}"]`);
    const toggle = article.querySelector(`[data-mandate-top-toggle="${CSS.escape(String(topSection))}"]`);
    if (!children || !toggle) return;
    children.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? '⌄' : '›';
  }

  function setActiveBookmark(sectionId) {
    const article = $('compArticle');
    const section = M.getSection(sectionId);
    if (!article || !section) return;
    article.querySelectorAll('.mandate-toc-link.active').forEach(node => node.classList.remove('active'));
    const active = article.querySelector(`[data-mandate-toc-link="${CSS.escape(section.section)}"]`);
    if (active) active.classList.add('active');
    expandTop(section.topSection || section.section, true);
  }

  function scrollToSection(sectionId, smooth = true) {
    const section = M.getSection(sectionId);
    if (!section) return;
    const target = document.getElementById(M.anchorId(section.section));
    if (!target) return;
    setActiveBookmark(section.section);
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function installScrollSpy() {
    if (scrollSpy) scrollSpy.disconnect();
    const root = document.querySelector('.comp-main');
    const sections = [...document.querySelectorAll('.mandate-doc-section')];
    if (!root || !sections.length || typeof IntersectionObserver === 'undefined') return;
    scrollSpy = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveBookmark(visible[0].target.dataset.mandateDocSection);
    }, { root, rootMargin: '-8% 0px -78% 0px', threshold: [0, 1] });
    sections.forEach(section => scrollSpy.observe(section));
  }

  function showMandateReader(targetSection = null, push = true) {
    const target = targetSection && M.getSection(targetSection) ? M.getSection(targetSection).section : null;
    setView({ type: 'mandate-reader', key: target }, { push });
    $('compBreadcrumbs').textContent = target ? `Compendium › Mandate › ${sectionLabel(target)}` : 'Compendium › Mandate';
    const article = $('compArticle');
    article.classList.add('mandate-reader-mode');
    article.innerHTML = `<div class="mandate-reader-title"><div><div class="comp-kicker">Canonical rulebook</div><h1>The Mandate</h1><div class="comp-short">${e(SOURCE)} · ${M.sections.length} indexed sections</div></div><span class="comp-badge">Complete</span></div>
      <div class="mandate-reader-layout">
        <aside class="mandate-reader-toc" aria-label="Mandate bookmarks">
          <div class="mandate-toc-sticky"><div class="mandate-toc-title"><strong>Bookmarks</strong><span>Jump to a section</span></div><div class="mandate-toc-scroll">${renderToc()}</div></div>
        </aside>
        <div class="mandate-document" data-mandate-document>
          <header class="mandate-document-cover"><div class="mandate-document-kicker">${e(SOURCE)}</div><h2>TribeNet Mandate</h2><p>Revision ${e(M.revision)} · ${e(M.sourceDate)}</p></header>
          ${M.sections.map(renderDocumentSection).join('')}
        </div>
      </div>`;
    const main = document.querySelector('.comp-main');
    if (main && !target) main.scrollTop = 0;
    requestAnimationFrame(() => {
      installScrollSpy();
      if (target) scrollToSection(target, false);
      else if (M.topLevel()[0]) setActiveBookmark(M.topLevel()[0].section);
    });
  }

  function navigateMandate(sectionId, push = true) {
    const section = M.getSection(sectionId);
    if (!section) return;
    const article = $('compArticle');
    if (compState.view.type !== 'mandate-reader' || !article?.classList.contains('mandate-reader-mode')) {
      showMandateReader(section.section, push);
      return;
    }
    if (push) setView({ type: 'mandate-reader', key: section.section }, { push: true });
    $('compBreadcrumbs').textContent = `Compendium › Mandate › ${sectionLabel(section)}`;
    scrollToSection(section.section, true);
  }

  function skillTerms(skill) {
    const key = canon(skill.name);
    return [...new Set([String(skill.name || '').toLowerCase(), ...(SKILL_ALIASES[key] || [])])].filter(Boolean);
  }

  function mentions(section, terms) {
    const text = sectionText(section);
    return terms.some(term => rx(term).test(text));
  }

  function skillRefs(skill) {
    const core = new Set((skill.sections || []).map(cleanSection).filter(id => M.getSection(id)));
    const other = [];
    const terms = skillTerms(skill);
    M.sections.forEach(section => {
      if (terms.some(term => rx(term).test(String(section.title || '')))) core.add(section.section);
      else if (mentions(section, terms)) other.push(section.section);
    });
    return { core: [...core], other: other.filter(id => !core.has(id)) };
  }

  function entityRefs(entity) {
    const core = new Set((entity.sections || []).map(cleanSection).filter(id => M.getSection(id)));
    const other = [];
    const name = String(entity.name || '').toLowerCase();
    if (name.length < 3) return { core: [...core], other };
    M.sections.forEach(section => {
      if (rx(name).test(sectionText(section))) other.push(section.section);
    });
    return { core: [...core], other: other.filter(id => !core.has(id)) };
  }

  function skillRelatedEntities(skill, refs) {
    const ids = [...new Set([...(refs.core || []), ...(refs.other || [])])].filter(id => M.getSection(id));
    if (!ids.length) return [];
    const text = ids.map(id => sectionText(M.getSection(id))).join('\n');
    const skillName = canon(skill.name);
    return entities().filter(entity => {
      const name = String(entity.name || '').trim();
      if (name.length < 4 || canon(name) === skillName) return false;
      return rx(name.toLowerCase()).test(text);
    }).slice(0, 30);
  }

  function refList(ids, max = 40) {
    return [...new Set(ids)].filter(id => M.getSection(id)).slice(0, max).map(id => sectionLink(id, sectionLabel(id), 'mandate-coverage-link')).join('');
  }

  function removeLegacyMandateReferences(article) {
    if (!article) return;
    [...article.querySelectorAll('.comp-section')].forEach(section => {
      if (section.querySelector('h2')?.textContent?.trim() === 'Mandate references') section.remove();
    });
  }

  function appendCoverage(article, title, refs) {
    if (!article || (!refs.core.length && !refs.other.length)) return;
    article.insertAdjacentHTML('beforeend', `<section class="comp-section mandate-cross-links"><h2>${e(title)}</h2>
      ${refs.core.length ? `<div class="mandate-ref-group"><strong>Core rules</strong><div class="mandate-reference-links">${refList(refs.core)}</div></div>` : ''}
      ${refs.other.length ? `<div class="mandate-ref-group"><strong>Other uses & mentions</strong><div class="mandate-reference-links">${refList(refs.other)}</div></div>` : ''}
      <p class="comp-muted">These links open the full Mandate at the relevant section.</p></section>`);
  }

  function appendSkillEntities(article, skill, refs) {
    const related = skillRelatedEntities(skill, refs);
    if (!article || !related.length) return;
    article.insertAdjacentHTML('beforeend', `<section class="comp-section mandate-skill-entities"><h2>Mandate-linked tools, goods & structures</h2><p class="comp-muted">Items below are mentioned in Mandate rules connected to this skill.</p><div class="comp-tags">${related.map(item => `<button class="comp-link" data-entity="${e(item.key)}">${e(item.name)}</button>`).join('')}</div></section>`);
    bindLinks(article);
  }

  function upgradeRecipeReferences(article) {
    if (!article) return;
    article.querySelectorAll('.comp-recipe-table tbody tr').forEach(row => {
      const cell = row.lastElementChild;
      const id = cleanSection(cell?.textContent || '');
      if (cell && M.getSection(id)) cell.innerHTML = sectionLink(id, sectionLabel(id), 'mandate-table-reference');
    });
    article.querySelectorAll('.comp-method-card small, .comp-use small').forEach(node => {
      const text = node.textContent || '';
      const match = text.match(/Mandate\s+§\s*([0-9]+(?:\.[0-9]+)*)/i);
      if (!match || !M.getSection(match[1])) return;
      const prefix = text.slice(0, match.index) + 'Mandate ';
      const suffix = text.slice((match.index || 0) + match[0].length);
      node.innerHTML = `${e(prefix)}${sectionLink(match[1], `§ ${match[1]}`, 'mandate-inline-compendium-link')}${e(suffix)}`;
    });
  }

  const oldShowSkill = showSkill;
  showSkill = function(name, push = true) {
    leaveReaderMode();
    const result = oldShowSkill(name, push);
    const skill = skillByName(name);
    if (skill) {
      const article = $('compArticle');
      removeLegacyMandateReferences(article);
      const refs = skillRefs(skill);
      appendCoverage(article, 'Mandate coverage', refs);
      appendSkillEntities(article, skill, refs);
      upgradeRecipeReferences(article);
    }
    return result;
  };

  const oldShowEntity = showEntity;
  showEntity = function(name, push = true) {
    leaveReaderMode();
    const result = oldShowEntity(name, push);
    const entity = entityByName(name);
    if (entity) {
      appendCoverage($('compArticle'), 'Mandate coverage', entityRefs(entity));
      upgradeRecipeReferences($('compArticle'));
    }
    return result;
  };

  const oldShowTopic = showTopic;
  showTopic = function(key, push = true) {
    leaveReaderMode();
    const result = oldShowTopic(key, push);
    const topic = topicByKey(key);
    if (topic) {
      const ids = (topic.sections || [topic.section]).map(cleanSection);
      appendCoverage($('compArticle'), 'Mandate coverage', { core: ids.filter(id => M.getSection(id)), other: [] });
    }
    return result;
  };

  const oldShowHome = showHome;
  showHome = function(push = true) {
    leaveReaderMode();
    return oldShowHome(push);
  };

  const oldShowGroup = showGroup;
  showGroup = function(group, push = true) {
    leaveReaderMode();
    return oldShowGroup(group, push);
  };

  const oldRenderNav = renderNav;
  renderNav = function(...args) {
    const result = oldRenderNav(...args);
    const host = $('compNav');
    if (!host) return result;
    host.querySelectorAll('.mandate-reader-nav-section, .mandate-nav-section').forEach(node => node.remove());
    const section = document.createElement('section');
    section.className = 'comp-nav-section mandate-reader-nav-section';
    section.innerHTML = `<div class="comp-nav-title">Rulebook</div><button class="comp-nav-link ${compState.view.type === 'mandate-reader' ? 'active' : ''}" data-view="mandate-reader">Mandate <small>${M.sections.length}</small></button>`;
    const first = host.querySelector('.comp-nav-section');
    if (first?.nextSibling) host.insertBefore(section, first.nextSibling);
    else host.appendChild(section);
    return result;
  };

  const oldRenderView = renderView;
  renderView = function(view, opt = {}) {
    if (view?.type === 'mandate-reader') return showMandateReader(view.key, opt.push || false);
    if (view?.type === 'mandate-section') return showMandateReader(view.key, opt.push || false);
    if (view?.type === 'mandate-home' || view?.type === 'mandate-batch') return showMandateReader(null, opt.push || false);
    leaveReaderMode();
    return oldRenderView(view, opt);
  };

  const oldRunSearch = runSearch;
  runSearch = function(query) {
    leaveReaderMode();
    const result = oldRunSearch(query);
    const q = String(query || '').trim();
    if (!q) return result;
    const hits = M.search(q).slice(0, 60);
    const results = $('compArticle')?.querySelector('.comp-search-results');
    if (results && hits.length) {
      const block = document.createElement('div');
      block.className = 'mandate-search-group';
      block.innerHTML = `<h3>Mandate</h3>${hits.map(section => `<a class="comp-result mandate-search-result" href="#${e(M.anchorId(section.section))}" data-mandate-open="${e(section.section)}"><strong>${e(sectionLabel(section))} · ${e(section.title)}</strong><span>Mandate · printed page ${section.page || '—'}</span></a>`).join('')}`;
      results.appendChild(block);
    }
    return result;
  };

  document.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-view="mandate-reader"]');
    if (nav) {
      event.preventDefault();
      showMandateReader(null, true);
      return;
    }

    const link = event.target.closest?.('[data-mandate-open], [data-mandate-doc-link]');
    if (link) {
      event.preventDefault();
      const id = link.dataset.mandateOpen || link.dataset.mandateDocLink;
      navigateMandate(id, true);
      return;
    }

    const toggle = event.target.closest?.('[data-mandate-top-toggle]');
    if (toggle) {
      event.preventDefault();
      const id = toggle.dataset.mandateTopToggle;
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      expandTop(id, open);
    }
  });

  setTimeout(() => {
    if (compState.catalog) {
      compState.catalog.sourceDocument = SOURCE;
      if ($('compSource')) $('compSource').textContent = `Primary source: ${SOURCE}`;
      renderNav();
      if (['mandate-home', 'mandate-batch', 'mandate-section'].includes(compState.view?.type)) {
        showMandateReader(compState.view.type === 'mandate-section' ? compState.view.key : null, false);
      }
    }
  }, 0);
})();

(() => {
  'use strict';

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function injectStyle(css) {
    const style = document.createElement('style');
    style.setAttribute('data-feedback-review-fixes', 'true');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function turnSort(turnKey) {
    const parsed = window.TribeNetFairTurns?.parseTurnKey?.(turnKey);
    if (parsed) return parsed.sort;
    const match = String(turnKey || '').match(/^(\d+)[-_](\d+)$/);
    return match ? Number(match[1]) * 12 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  if (page === 'index.html') {
    const hero = document.querySelector('#launcherView .hero-panel');
    hero?.querySelector('h1')?.remove();
    const heroCopy = hero?.querySelector('.hero-copy');
    if (heroCopy) heroCopy.textContent = 'Import Results here';

    const classicFair = document.getElementById('openFairButton');
    classicFair?.remove();
    const fairgroundButton = document.getElementById('openFairgroundButton');
    if (fairgroundButton) {
      const title = fairgroundButton.querySelector('h2');
      const copy = fairgroundButton.querySelector('p');
      const status = fairgroundButton.querySelector('.module-status');
      if (title) title.textContent = 'Fairground';
      if (copy) copy.textContent = 'Plan Fair trading, crafting, cultural activities, research and Fair-to-Fair opportunities from the shared turn state.';
      if (status) status.textContent = 'Open';
    }

    async function nextFairTurn() {
      const managed = await window.tribenet.listManagedTurns();
      const candidates = (managed || []).map(row => row?.turnKey).filter(Boolean).sort((a,b) => turnSort(a) - turnSort(b));
      if (candidates.length) return window.TribeNetFairTurns?.fairAtOrAfter?.(candidates.at(-1)) || null;
      const results = await window.tribenet.listResultTurns();
      const resultTurns = (results || []).map(row => row?.turnKey || row).filter(Boolean).sort((a,b) => turnSort(a) - turnSort(b));
      if (!resultTurns.length) return null;
      const latest = window.TribeNetFairTurns?.parseTurnKey?.(resultTurns.at(-1));
      if (!latest) return null;
      const next = latest.month >= 12 ? `${latest.year + 1}-01` : `${latest.year}-${String(latest.month + 1).padStart(2,'0')}`;
      return window.TribeNetFairTurns?.fairAtOrAfter?.(next) || null;
    }

    async function refreshFairImport() {
      const button = document.getElementById('launcherImportFairButton');
      const status = document.getElementById('launcherFairImportStatus');
      if (!button || !window.fairnet) return;
      const target = await nextFairTurn();
      button.dataset.turnKey = target || '';
      if (!target) {
        button.disabled = true;
        button.textContent = 'Import Fair Workbook';
        if (status) status.textContent = 'Import Results first so the next Month 04 / Month 10 Fair can be identified.';
        return;
      }
      const snapshots = await window.fairnet.listSnapshots();
      const existing = (snapshots || []).find(row => String(row.turnKey) === String(target));
      button.disabled = false;
      button.textContent = existing ? `Replace Fair ${target}` : `Import Fair ${target}`;
      if (status) status.textContent = existing
        ? `Fair ${target}: ${existing.sourceFile} is loaded.`
        : `Fair ${target}: workbook not loaded yet.`;
      if (!button.dataset.feedbackFairBound) {
        button.dataset.feedbackFairBound = 'true';
        button.addEventListener('click', async () => {
          const turnKey = button.dataset.turnKey;
          if (!turnKey || button.disabled) return;
          button.disabled = true;
          if (status) status.textContent = `Importing Fair ${turnKey} workbook…`;
          try {
            const result = await window.fairnet.importWorkbook(turnKey);
            if (result?.canceled) {
              if (status) status.textContent = `Fair ${turnKey} import cancelled.`;
              return;
            }
            if (result?.error) {
              if (status) status.textContent = `Fair ${turnKey} import failed: ${result.error}`;
              return;
            }
            localStorage.setItem('tribenet:fair:planningTurn', turnKey);
            window.dispatchEvent(new CustomEvent('tribenet-fair-import-complete', { detail:{ turnKey } }));
          } finally {
            await refreshFairImport();
          }
        });
      }
    }

    function fairCell(turnKey, snapshotMap) {
      const parsed = window.TribeNetFairTurns?.parseTurnKey?.(turnKey);
      if (!parsed || ![4,10].includes(parsed.month)) return '<span class="turn-file-cell missing">—</span>';
      const snapshot = snapshotMap.get(turnKey);
      return snapshot
        ? `<span class="turn-file-cell present" title="${escapeText(snapshot.sourceFile || '')}">${escapeText(snapshot.sourceFile || 'Fair workbook loaded')}</span>`
        : '<span class="turn-file-cell missing">Missing</span>';
    }

    async function enhanceTurnHistory() {
      const host = document.querySelector('.turn-file-history');
      if (!host || !window.tribenet?.getTurnFilesInfo || !window.fairnet?.listSnapshots) return;
      const heading = document.querySelector('.turn-file-library-head h2');
      if (heading) heading.textContent = 'Turn & Fair history';
      const [info, snapshots] = await Promise.all([window.tribenet.getTurnFilesInfo(), window.fairnet.listSnapshots()]);
      const rows = new Map((info?.history || []).map(row => [String(row.turnKey), { ...row }]));
      for (const snapshot of snapshots || []) {
        const key = String(snapshot.turnKey);
        if (!rows.has(key)) rows.set(key, { turnKey:key, resultFile:null, completedFile:null });
      }
      const fairTurns = window.TribeNetFairTurns?.buildFairTurnOptions?.(info?.history || [], snapshots || []) || [];
      for (const key of fairTurns) if (!rows.has(key)) rows.set(key, { turnKey:key, resultFile:null, completedFile:null });
      const ordered = [...rows.values()].sort((a,b) => turnSort(a.turnKey) - turnSort(b.turnKey));
      const firstResultTurn = ordered.find(row => row.resultFile)?.turnKey || null;
      const snapshotMap = new Map((snapshots || []).map(row => [String(row.turnKey), row]));
      host.innerHTML = '<div class="turn-file-row header"><span>Turn</span><span>Completed Orders</span><span>Results</span><span>Fair</span></div>' + ordered.map(row => {
        const completed = row.completedFile
          ? `<span class="turn-file-cell present" title="${escapeText(row.completedPath || row.completedFile)}">${escapeText(row.completedFile)}</span>`
          : row.turnKey === firstResultTurn
            ? '<span class="turn-file-cell not-required">Not required</span>'
            : '<span class="turn-file-cell missing">Missing</span>';
        const results = row.resultFile
          ? `<span class="turn-file-cell present" title="${escapeText(row.resultPath || row.resultFile)}">${escapeText(row.resultFile)}</span>`
          : '<span class="turn-file-cell missing">Missing</span>';
        return `<div class="turn-file-row"><strong class="turn-file-turn">${escapeText(row.turnKey)}</strong>${completed}${results}${fairCell(row.turnKey, snapshotMap)}</div>`;
      }).join('');
    }

    injectStyle(`
      .turn-file-row{grid-template-columns:100px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)!important}
      .turn-file-cell.not-required{color:#91a8b4;font-style:italic}
      @media(max-width:850px){.turn-file-row{grid-template-columns:82px minmax(0,1fr)!important}.turn-file-row>span:nth-child(n+3),.turn-file-row>strong~span:nth-child(n+3){grid-column:2}}
    `);

    window.addEventListener('tribenet-import-complete', () => {
      refreshFairImport().catch(console.error);
      enhanceTurnHistory().catch(console.error);
    });
    window.addEventListener('tribenet-fair-import-complete', () => enhanceTurnHistory().catch(console.error));
    refreshFairImport().catch(console.error);
    enhanceTurnHistory().catch(console.error);

    const mapperButton = document.getElementById('openMapperButton');
    if (mapperButton && !mapperButton.dataset.feedbackCenterBound) {
      mapperButton.dataset.feedbackCenterBound = 'true';
      mapperButton.addEventListener('click', async () => {
        try {
          const turns = await window.tribenet.listResultTurns();
          if (!turns?.length) return;
          const latest = [...turns].sort((a,b) => Number(a.turnSort || 0) - Number(b.turnSort || 0)).at(-1);
          const detail = await window.tribenet.getResultTurn(latest.turnKey);
          const mainTribe = detail?.units?.find(unit => String(unit.unitType || '').toLowerCase() === 'tribe')
            || detail?.units?.find(unit => /^\d+$/.test(String(unit.unitCode || '')))
            || detail?.units?.[0];
          if (!mainTribe?.currentHex || typeof parseCoordinate !== 'function') return;
          const point = parseCoordinate(mainTribe.currentHex);
          if (!point) return;
          if (typeof showDetail === 'function') showDetail();
          if (typeof centerOnHex === 'function') centerOnHex(point.globalCol, point.globalRow);
        } catch (error) {
          console.error('Could not centre Mapper on main Tribe', error);
        }
      });
    }

    if (typeof resultIsPartial === 'function' && typeof requestVisibleData === 'function') {
      const originalResultIsPartial = resultIsPartial;
      const originalRequestVisibleData = requestVisibleData;
      const fullKnowledge = new Set();
      const checked = new Set();
      const inFlight = new Set();
      const knowledgeKey = (turnKey, coordinate) => `${turnKey || ''}:${coordinate || ''}`;

      resultIsPartial = function feedbackAwarePartial(data) {
        if (!originalResultIsPartial(data)) return false;
        const turnKey = typeof resultsTimeline !== 'undefined' ? resultsTimeline.turn?.turnKey : '';
        return !fullKnowledge.has(knowledgeKey(turnKey, data?.coordinate));
      };

      async function enrichPartialKnowledge() {
        if (typeof resultsTimeline === 'undefined' || !resultsTimeline.turn || typeof state === 'undefined') return;
        const turn = resultsTimeline.turn;
        const candidates = [...state.hexCache.values()].filter(data => originalResultIsPartial(data));
        await Promise.all(candidates.map(async data => {
          const key = knowledgeKey(turn.turnKey, data.coordinate);
          if (checked.has(key) || inFlight.has(key)) return;
          inFlight.add(key);
          try {
            const history = await window.tribenet.getResultHexHistory(data.coordinate);
            const wasFullyExplored = (history || []).some(row => Number(row.turnSort) <= Number(turn.turnSort) && ['visited','scouted'].includes(String(row.knowledgeLevel || '').toLowerCase()));
            if (wasFullyExplored) fullKnowledge.add(key);
            checked.add(key);
          } finally {
            inFlight.delete(key);
          }
        }));
        if (typeof draw === 'function') draw();
      }

      requestVisibleData = function feedbackAwareRequestVisibleData() {
        const result = originalRequestVisibleData.apply(this, arguments);
        setTimeout(() => enrichPartialKnowledge().catch(console.error), 120);
        return result;
      };
    }
  }

  if (page === 'compendium.html' && typeof showCategory === 'function' && typeof renderNav === 'function') {
    let skillGroupFilter = null;
    const originalRenderNav = renderNav;
    const originalShowCategory = showCategory;

    function tidyNav() {
      const host = document.getElementById('compNav');
      if (!host) return;
      [...host.querySelectorAll('.comp-nav-section')].forEach(section => {
        if (section.querySelector('.comp-nav-title')?.textContent.trim() === 'Skill groups') section.remove();
      });
      const food = host.querySelector('[data-food-gathering]')?.closest('.comp-nav-section');
      if (food) host.appendChild(food);
    }

    renderNav = function feedbackRenderNav() {
      originalRenderNav.apply(this, arguments);
      tidyNav();
    };

    function enhanceSkillTable() {
      const article = document.getElementById('compArticle');
      if (!article) return;
      const summaryButtons = [...article.querySelectorAll('.comp-skill-group-summary')];
      const groupPills = [...article.querySelectorAll('.comp-group-pill')];
      [...summaryButtons, ...groupPills].forEach(button => {
        const group = button.dataset.group || button.textContent.match(/Group\s+([ABC])/i)?.[1]?.toUpperCase();
        if (!group) return;
        const replacement = button.cloneNode(true);
        replacement.removeAttribute('data-group');
        // Keep the filter discoverable as a stable DOM attribute so feedback
        // selectors and automated checks can target the current skill table.
        replacement.setAttribute('data-skill-filter', group);
        replacement.classList.toggle('active', skillGroupFilter === group);
        replacement.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          skillGroupFilter = skillGroupFilter === group ? null : group;
          enhanceSkillTable();
        });
        button.replaceWith(replacement);
      });
      const rows = [...article.querySelectorAll('.comp-skill-table tbody tr')];
      rows.forEach(row => {
        const group = row.cells?.[2]?.textContent.match(/Group\s+([ABC])/i)?.[1]?.toUpperCase();
        row.hidden = Boolean(skillGroupFilter && group !== skillGroupFilter);
      });
      const short = article.querySelector('.comp-title-row .comp-short');
      if (short) {
        const visible = rows.filter(row => !row.hidden).length;
        short.textContent = skillGroupFilter
          ? `${visible} skills · Group ${skillGroupFilter} filter`
          : `${rows.length} indexed skills · alphabetical across all groups`;
      }
    }

    function enhanceItems() {
      const article = document.getElementById('compArticle');
      const grid = article?.querySelector('.comp-entity-grid');
      if (!grid) return;
      const cards = [...grid.querySelectorAll('.comp-entity-card')];
      const rows = cards.map(card => {
        const name = card.querySelector('strong')?.textContent?.trim() || 'Item';
        const detail = card.querySelector('span')?.textContent?.trim() || '';
        const key = card.dataset.entity || name;
        const iconKey = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        const filename = window.TribeNetItemIconManifest?.[iconKey];
        const icon = filename
          ? `<img class="comp-item-list-icon" src="item-icons/${escapeText(filename)}" width="32" height="32" alt="">`
          : '<span class="comp-item-list-placeholder">?</span>';
        return `<tr><td>${icon}<button class="comp-text-link skill-name" data-entity="${escapeText(key)}">${escapeText(name)}</button></td><td>${escapeText(detail)}</td></tr>`;
      }).join('');
      const wrap = document.createElement('div');
      wrap.className = 'comp-skill-table-wrap comp-item-table-wrap';
      wrap.innerHTML = `<table class="comp-skill-table"><thead><tr><th>Item</th><th>Type / availability</th></tr></thead><tbody>${rows}</tbody></table>`;
      grid.replaceWith(wrap);
      wrap.querySelectorAll('[data-entity]').forEach(button => button.addEventListener('click', () => showEntity(button.dataset.entity)));
    }

    showCategory = function feedbackShowCategory(key, push = true) {
      const result = originalShowCategory.call(this, key, push);
      if (key === 'skills') enhanceSkillTable();
      if (key === 'items') enhanceItems();
      tidyNav();
      return result;
    };

    injectStyle(`
      .comp-skill-group-summary.active,.comp-group-pill.active{border-color:#79b995!important;background:#173126!important;color:#e9fff2!important}
      .comp-item-table-wrap td:first-child{display:flex;align-items:center;gap:8px}
      .comp-item-list-icon{width:32px;height:32px;image-rendering:pixelated;object-fit:contain;flex:0 0 32px}
      .comp-item-list-placeholder{width:30px;height:30px;display:inline-grid;place-items:center;border:1px solid #315446;border-radius:5px;color:#6f8f80;flex:0 0 30px}
    `);

    renderNav();
    if (typeof compState !== 'undefined' && compState.view?.type === 'category') showCategory(compState.view.key, false);
  }

  if (page === 'fairground.html') {
    document.getElementById('classicFairButton')?.remove();
    document.querySelector('.preview-pill')?.remove();

    injectStyle(`
      .fair-item-pixel{width:42px;height:42px;display:block;object-fit:contain;image-rendering:pixelated;margin:auto}
      .fair-item-placeholder{width:40px;height:40px;display:grid;place-items:center;border:2px dashed rgba(93,69,35,.45);border-radius:6px;background:rgba(239,218,173,.35);color:#725d3e;font-weight:900;margin:auto}
      .interaction-icon .fair-item-pixel,.interaction-icon .fair-item-placeholder{width:54px;height:54px}
      .cultural-activity-sections{display:grid;gap:12px}
      .cultural-activity-section{border:1px solid rgba(88,65,37,.22);border-radius:12px;padding:14px;background:rgba(255,250,236,.58)}
      .cultural-activity-section h4{margin:0 0 10px;font-size:17px}
      .cultural-activity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
      .cultural-activity-metric{padding:8px 9px;border-radius:8px;background:rgba(255,255,255,.52)}
      .cultural-activity-metric span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;opacity:.7}
      .cultural-activity-metric strong{display:block;margin-top:3px}
      .cultural-profit{margin-top:10px;padding:10px;border-radius:8px;background:rgba(84,115,69,.13)}
    `);

    function iconKey(name) {
      return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function putPixelIcon(slot, name) {
      if (!slot || !name || slot.dataset.pixelIconName === name) return;
      slot.dataset.pixelIconName = name;
      slot.textContent = '';
      const filename = window.TribeNetItemIconManifest?.[iconKey(name)];
      if (filename) {
        const img = document.createElement('img');
        img.className = 'fair-item-pixel';
        img.src = `item-icons/${filename}`;
        img.alt = '';
        slot.appendChild(img);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'fair-item-placeholder';
        placeholder.textContent = '?';
        placeholder.title = 'No Compendium icon available';
        slot.appendChild(placeholder);
      }
    }

    function upgradeIcons(root = document) {
      const selectors = [
        ['.market-item-card', '.item-card-name', '.item-icon'],
        ['.storehouse-card', 'h4', '.stock-icon'],
        ['.craft-card', 'h4', '.craft-card-icon'],
        ['.caravan-card', 'h4', '.craft-card-icon']
      ];
      for (const [cardSelector, nameSelector, iconSelector] of selectors) {
        root.querySelectorAll?.(cardSelector).forEach(card => putPixelIcon(card.querySelector(iconSelector), card.querySelector(nameSelector)?.textContent?.trim()));
      }
      const dialog = document.getElementById('interactionDialog');
      if (dialog && !dialog.classList.contains('hidden')) putPixelIcon(document.getElementById('interactionIcon'), document.getElementById('interactionTitle')?.textContent?.trim());
    }

    function loadIconManifest() {
      if (window.TribeNetItemIconManifest) {
        upgradeIcons();
        return;
      }
      const script = document.createElement('script');
      script.src = 'item-icon-manifest.js';
      script.async = false;
      script.addEventListener('load', () => upgradeIcons(), { once:true });
      document.body.appendChild(script);
    }

    const observer = new MutationObserver(() => upgradeIcons());
    const featureContent = document.getElementById('featureContent');
    const interaction = document.getElementById('interactionDialog');
    if (featureContent) observer.observe(featureContent, { childList:true, subtree:true });
    if (interaction) observer.observe(interaction, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    loadIconManifest();

    if (typeof tradeSummaryHtml === 'function' && typeof fairgroundState !== 'undefined') {
      tradeSummaryHtml = function feedbackTradeSummaryHtml() {
        const silverKey = typeof itemKey === 'function' ? itemKey('Silver') : 'SILVER';
        const silverStock = fairgroundState.inventory.find(row => row.key === silverKey || String(row.name || '').toUpperCase() === 'SILVER');
        const currentSilver = Number(silverStock?.quantity || 0);
        return `<div class="trade-summary-strip">
          <div class="trade-summary-chip"><span>Current silver</span><strong>${silver(currentSilver)} Silver</strong></div>
          <div class="trade-summary-chip"><span>Trades planned</span><strong>${selectedTradeCount()} / ${maxTrades()}</strong></div>
          <div class="trade-summary-chip"><span>Remaining</span><strong>${tradesRemaining()}</strong></div>
          <div class="trade-summary-chip"><span>Buying</span><strong>${silver(resourceBuySpend())} Silver</strong></div>
          <div class="trade-summary-chip"><span>Selling</span><strong>${silver(resourceSaleIncome())} Silver</strong></div>
          <div class="trade-summary-chip"><span>Net cash</span><strong>${silver(resourceSaleIncome() - resourceBuySpend())} Silver</strong></div>
        </div>`;
      };
    }

    if (typeof renderWorkshop === 'function' && typeof fairgroundState !== 'undefined') {
      function primaryAttemptChance(targetLevel) {
        const level = Math.max(1, Math.min(10, Number(targetLevel) || 1));
        return Math.max(0.1, (11 - level) / 10);
      }

      function expectedPrimaryTurns(row) {
        const missing = Array.isArray(row?.missingSkills) ? row.missingSkills : [];
        if (!missing.length) return Number(row?.skillUpsNeeded || 0) === 0 ? 0 : Infinity;
        let turns = 0;
        for (const skill of missing) {
          const current = Math.max(0, Math.floor(Number(skill.current || 0)));
          const required = Math.max(current, Math.floor(Number(skill.required || current)));
          for (let level = current + 1; level <= required; level += 1) turns += 1 / primaryAttemptChance(level);
        }
        return turns;
      }

      renderWorkshop = function feedbackRenderWorkshop() {
        const horizon = Number(fairgroundState.workshopSkillLimit || 999);
        const rows = fairgroundState.profitRows
          .map(row => ({ ...row, expectedPrimaryTurns:expectedPrimaryTurns(row) }))
          .filter(row => horizon >= 999 || row.expectedPrimaryTurns <= horizon)
          .sort((a,b) => Number(b.totalProfit ?? -Infinity) - Number(a.totalProfit ?? -Infinity));
        document.getElementById('featureContent').innerHTML = `${featureIntro("Craftsman's Workshop",'Projects are filtered by the expected number of primary skill-attempt turns needed to reach their requirements. The model uses the TribeNet primary success chances: 100% for Level 1, falling by 10 percentage points per level to 10% for Level 10.',`${rows.filter(row => Number(row.totalProfit || 0) > 0).length} profitable`)}
          <div class="feature-tabs">${[1,2,4,8,16].map(turns => `<button class="fair-tab-button ${horizon === turns ? 'active' : ''}" data-turn-horizon="${turns}">≤ ${turns} turn${turns === 1 ? '' : 's'}</button>`).join('')}<button class="fair-tab-button ${horizon >= 999 ? 'active' : ''}" data-turn-horizon="999">All projects</button></div>
          ${rows.length ? `<div class="fair-card-grid large-cards">${rows.map(row => {
            const inputs = (row.planningInputs || row.consumedInputs || []).slice(0,3).map(part => `${part.name || part.key} × ${number(part.quantity)}`).join(' · ');
            const expectation = row.expectedPrimaryTurns === 0 ? 'Current skills' : Number.isFinite(row.expectedPrimaryTurns) ? `~${row.expectedPrimaryTurns.toFixed(1)} expected primary turns` : 'Skill timing unknown';
            return `<button type="button" class="craft-card" data-craft-key="${escapeHtml(row.key)}"><div class="craft-card-top"><span class="craft-card-icon">${escapeHtml(itemIcon(row.item))}</span><div><h4>${escapeHtml(row.item)}</h4><small>${number(row.sellQuantity)} planned to Fair limit</small></div><strong class="craft-profit">${row.totalProfit == null ? '—' : `${silver(row.totalProfit)} profit`}</strong></div><div class="craft-route">${escapeHtml(inputs || row.reason || 'Open to inspect production route')}</div><span class="skill-token ${row.expectedPrimaryTurns > 0 ? 'warn' : ''}">${escapeHtml(expectation)}</span></button>`;
          }).join('')}</div>` : emptyFeature('⚒️','No projects match this expected-turn filter','Try a longer expected skill-development horizon.')}`;
        document.querySelectorAll('[data-turn-horizon]').forEach(button => button.addEventListener('click', () => {
          fairgroundState.workshopSkillLimit = Number(button.dataset.turnHorizon);
          renderWorkshop();
          upgradeIcons(document.getElementById('featureContent'));
        }));
        document.querySelectorAll('[data-craft-key]').forEach(button => button.addEventListener('click', () => openCraftDialog(button.dataset.craftKey)));
        upgradeIcons(document.getElementById('featureContent'));
      };
    }

    if (typeof renderPavilion === 'function' && typeof sheetRows === 'function') {
      function culturalActivityData() {
        const rows = sheetRows('culturalActivities').filter(row => row.some(cell => String(cell ?? '').trim()));
        const headerIndex = rows.findIndex(row => row.some(cell => /culture\s*activity|^activity$/i.test(String(cell || '').trim())) && row.some(cell => /skill/i.test(String(cell || ''))));
        if (headerIndex < 0) return null;
        const headers = rows[headerIndex].map((cell,index) => String(cell || '').trim() || `Field ${index + 1}`);
        const activityIndex = headers.findIndex(header => /culture\s*activity|^activity$/i.test(header));
        return rows.slice(headerIndex + 1)
          .filter(row => row.some(cell => String(cell ?? '').trim()))
          .map(row => ({ headers, row, name:String(row[activityIndex >= 0 ? activityIndex : 0] || '').trim() }))
          .filter(entry => entry.name);
      }

      renderPavilion = function feedbackRenderPavilion() {
        const activities = culturalActivityData();
        if (!activities?.length) {
          document.getElementById('featureContent').innerHTML = `${featureIntro('Grand Pavilion','Cultural activities are presented as programmes and performance notices rather than another spreadsheet.',`${meaningfulSheetRows('culturalActivities')} entries`)}${sheetCards('culturalActivities','🎪')}`;
          return;
        }
        const sections = activities.map(({ headers, row, name }) => {
          const fields = headers.map((header,index) => ({ header, value:String(row[index] ?? '').trim() })).filter(field => field.value && !/culture\s*activity|^activity$/i.test(field.header));
          const skill = fields.find(field => /skill\s*level|^skill$/i.test(field.header));
          const participants = fields.find(field => /participant/i.test(field.header));
          const implementsUsed = fields.filter(field => /implement/i.test(field.header));
          const profitFields = fields.filter(field => /profit|silver|income|return|reward/i.test(field.header));
          const other = fields.filter(field => field !== skill && field !== participants && !implementsUsed.includes(field) && !profitFields.includes(field));
          const allocation = [
            skill ? `<div class="cultural-activity-metric"><span>${escapeText(skill.header)}</span><strong>${escapeText(skill.value)}</strong></div>` : '',
            participants ? `<div class="cultural-activity-metric"><span>${escapeText(participants.header)}</span><strong>${escapeText(participants.value)}</strong></div>` : '',
            ...implementsUsed.map(field => `<div class="cultural-activity-metric"><span>${escapeText(field.header)}</span><strong>${escapeText(field.value)}</strong></div>`),
            ...other.map(field => `<div class="cultural-activity-metric"><span>${escapeText(field.header)}</span><strong>${escapeText(field.value)}</strong></div>`)
          ].join('');
          const profit = profitFields.length
            ? profitFields.map(field => `<strong>${escapeText(field.header)}: ${escapeText(field.value)}</strong>`).join('<br>')
            : '<span>The Fair workbook does not expose a numeric profit/return field for this activity, so no profit amount is invented.</span>';
          return `<section class="cultural-activity-section"><h4>${escapeText(name)}</h4><div class="cultural-activity-grid">${allocation}</div><div class="cultural-profit"><span>Potential profit / return from the workbook allocation</span><br>${profit}</div></section>`;
        }).join('');
        document.getElementById('featureContent').innerHTML = `${featureIntro('Grand Pavilion','Each cultural activity now has its own section, showing its skill level, participants, allocated implements and any explicit profit/return supplied by the Fair workbook.',`${activities.length} activities`)}<div class="cultural-activity-sections">${sections}</div>`;
      };
    }
  }
})();

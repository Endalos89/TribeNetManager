(() => {
  'use strict';

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function addStyle(css) {
    const style = document.createElement('style');
    style.setAttribute('data-feedback-followup-fixes', 'true');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function parseTurn(value) {
    if (window.TribeNetFairTurns?.parseTurnKey) return window.TribeNetFairTurns.parseTurnKey(value);
    const match = String(value || '').trim().match(/^(\d+)[-_](\d+)$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return { year, month, turnKey:`${year}-${String(month).padStart(2, '0')}`, sort:year * 12 + month };
  }

  function fairAtOrAfter(turnKey) {
    if (window.TribeNetFairTurns?.fairAtOrAfter) return window.TribeNetFairTurns.fairAtOrAfter(turnKey);
    const turn = parseTurn(turnKey);
    if (!turn) return null;
    if (turn.month <= 4) return `${turn.year}-04`;
    if (turn.month <= 10) return `${turn.year}-10`;
    return `${turn.year + 1}-04`;
  }

  if (page === 'index.html') {
    let fairRefreshTimer = null;
    let fairRefreshRunning = false;

    async function robustNextFairTurn() {
      const managed = await window.tribenet.listManagedTurns();
      const managedParsed = (managed || []).map(row => parseTurn(row?.turnKey ?? row)).filter(Boolean).sort((a,b) => a.sort - b.sort);
      if (managedParsed.length) return fairAtOrAfter(managedParsed.at(-1).turnKey);

      const results = await window.tribenet.listResultTurns();
      const resultParsed = (results || []).map(row => parseTurn(row?.turnKey ?? row)).filter(Boolean).sort((a,b) => a.sort - b.sort);
      if (!resultParsed.length) return null;
      const latest = resultParsed.at(-1);
      const nextPlanning = latest.month >= 12
        ? `${latest.year + 1}-01`
        : `${latest.year}-${String(latest.month + 1).padStart(2, '0')}`;
      return fairAtOrAfter(nextPlanning);
    }

    async function importFairFallback(button) {
      const turnKey = button.dataset.turnKey;
      if (!turnKey || button.disabled) return;
      const status = document.getElementById('launcherFairImportStatus');
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
        scheduleFairRefresh(50);
      }
    }

    async function stabilizeFairImport() {
      if (fairRefreshRunning) return;
      const button = document.getElementById('launcherImportFairButton');
      if (!button || !window.fairnet || !window.tribenet) return;
      fairRefreshRunning = true;
      try {
        const target = await robustNextFairTurn();
        const status = document.getElementById('launcherFairImportStatus');
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
          ? `Fair ${target}: ${existing.sourceFile || 'workbook'} is loaded.`
          : `Fair ${target}: ready for workbook import.`;

        if (!button.dataset.launcherImportBound) {
          button.dataset.launcherImportBound = 'followup';
          button.dataset.feedbackFairBound = 'true';
          button.addEventListener('click', () => importFairFallback(button));
        }
      } catch (error) {
        console.error('Could not stabilize Fair import button', error);
      } finally {
        fairRefreshRunning = false;
      }
    }

    function scheduleFairRefresh(delay = 120) {
      clearTimeout(fairRefreshTimer);
      fairRefreshTimer = setTimeout(() => stabilizeFairImport(), delay);
    }

    const launcherObserver = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList' || record.target?.id === 'launcherImportFairButton')) scheduleFairRefresh();
    });
    const launcher = document.getElementById('launcherView');
    if (launcher) launcherObserver.observe(launcher, { childList:true, subtree:true, attributes:true, attributeFilter:['disabled'] });
    window.addEventListener('tribenet-import-complete', () => scheduleFairRefresh(250));
    window.addEventListener('tribenet-fair-import-complete', () => scheduleFairRefresh(250));
    scheduleFairRefresh(0);
  }

  if (page === 'compendium.html') {
    function removeDuplicatedItemNameIcons(root = document) {
      root.querySelectorAll?.('.comp-item-table-wrap .item-inline-icon').forEach(icon => icon.remove());
    }
    removeDuplicatedItemNameIcons();
    const iconObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.comp-item-table-wrap .item-inline-icon')) node.remove();
          else removeDuplicatedItemNameIcons(node);
        }
      }
    });
    iconObserver.observe(document.getElementById('compArticle') || document.body, { childList:true, subtree:true });
    addStyle('.comp-item-table-wrap .item-inline-icon{display:none!important}.comp-item-table-wrap .comp-text-link{gap:0!important}');
  }

  if (page === 'fairground.html') {
    addStyle(`
      .cultural-activity-sections{display:grid;gap:14px}
      .cultural-activity-section{border:1px solid #304958;border-radius:12px;background:#15222b;color:var(--text,#edf4f8);padding:15px 16px;box-shadow:0 6px 18px rgba(0,0,0,.14)}
      .cultural-activity-section h4{margin:0 0 12px;color:#f4e6bd;font-size:17px}
      .cultural-activity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}
      .cultural-activity-metric{padding:9px 10px;border:1px solid #2b414f;border-radius:8px;background:#101b22}
      .cultural-activity-metric span,.cultural-profit>span{display:block;color:#8fa5b4;font-size:10px;text-transform:uppercase;letter-spacing:.07em}
      .cultural-activity-metric strong{display:block;margin-top:3px;color:#edf4f8}
      .cultural-profit{margin-top:11px;padding:11px 12px;border-radius:9px;background:#0d171d;border:1px solid #344b57;color:#edf4f8}
      .cultural-profit strong{color:#f1d17d}.cultural-profit small{display:block;margin-top:4px;color:#9fb2be;line-height:1.45}
      .craft-skill-needs{display:block;margin-top:7px;color:#efc76f;font-size:11px;line-height:1.35}
      .trade-summary-chip.balance-negative{border-color:#8e4c49!important;background:#3b2324!important}
      .trade-summary-chip.balance-negative strong{color:#ffb3aa!important}
      .trade-balance-warning{margin:10px 0 0;padding:10px 12px;border:1px solid #8e4c49;border-radius:9px;background:#3b2324;color:#ffd4cf;font-weight:700}
    `);

    function currentSilver() {
      try {
        const row = inventoryMap().get(itemKey('Silver'));
        if (row) return Math.max(0, Number(row.quantity || 0));
        const fallback = (fairgroundState.inventory || []).find(row => /^(silver|sil)$/i.test(String(row.name || row.key || '').trim()));
        return Math.max(0, Number(fallback?.quantity || 0));
      } catch (_) {
        return 0;
      }
    }

    if (typeof tradeSummaryHtml === 'function') {
      tradeSummaryHtml = function feedbackBalanceSummary() {
        const buying = resourceBuySpend();
        const selling = resourceSaleIncome();
        const net = selling - buying;
        const available = currentSilver();
        const projected = available + net;
        const warning = projected < 0
          ? `<div class="trade-balance-warning">Warning: planned Fair trades exceed current Silver by ${silver(Math.abs(projected))} Silver.</div>`
          : '';
        return `<div class="trade-summary-strip">
          <div class="trade-summary-chip"><span>Trades planned</span><strong>${selectedTradeCount()} / ${maxTrades()}</strong></div>
          <div class="trade-summary-chip"><span>Remaining</span><strong>${tradesRemaining()}</strong></div>
          <div class="trade-summary-chip"><span>Buying</span><strong>${silver(buying)} Silver</strong></div>
          <div class="trade-summary-chip"><span>Selling</span><strong>${silver(selling)} Silver</strong></div>
          <div class="trade-summary-chip"><span>Current Silver</span><strong>${silver(available)} Silver</strong></div>
          <div class="trade-summary-chip"><span>Net cash</span><strong>${net >= 0 ? '+' : ''}${silver(net)} Silver</strong></div>
          <div class="trade-summary-chip ${projected < 0 ? 'balance-negative' : ''}"><span>After Fair</span><strong>${silver(projected)} Silver</strong></div>
        </div>${warning}`;
      };
    }

    function skillNeedsLabel(row) {
      const grouped = new Map();
      for (const skill of Array.isArray(row?.missingSkills) ? row.missingSkills : []) {
        const name = String(skill.skill || '').trim();
        if (!name) continue;
        const current = Number(skill.current);
        const required = Number(skill.required);
        if (!Number.isFinite(current) || !Number.isFinite(required) || required <= current) continue;
        const prior = grouped.get(name);
        if (!prior) grouped.set(name, { current, required });
        else grouped.set(name, { current:Math.min(prior.current, current), required:Math.max(prior.required, required) });
      }
      return [...grouped.entries()]
        .map(([name, levels]) => `${name} ${number(levels.current)}→${number(levels.required)}`)
        .join(' · ');
    }

    function annotateWorkshopSkillNeeds() {
      const rows = new Map((fairgroundState.profitRows || []).map(row => [String(row.key), row]));
      document.querySelectorAll('#featureContent [data-craft-key]').forEach(card => {
        card.querySelector('.craft-skill-needs')?.remove();
        const row = rows.get(String(card.dataset.craftKey));
        const label = skillNeedsLabel(row);
        if (!label) return;
        const line = document.createElement('span');
        line.className = 'craft-skill-needs';
        line.textContent = `Skills to raise: ${label}`;
        const token = card.querySelector('.skill-token');
        if (token) token.insertAdjacentElement('beforebegin', line);
        else card.appendChild(line);
      });
    }

    if (typeof renderWorkshop === 'function') {
      const previousRenderWorkshop = renderWorkshop;
      renderWorkshop = function feedbackWorkshopWithSkillNames() {
        const result = previousRenderWorkshop.apply(this, arguments);
        annotateWorkshopSkillNeeds();
        return result;
      };
    }
  }
})();

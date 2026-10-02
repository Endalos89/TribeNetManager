(() => {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'compendium.html') return;

  const K = window.TribeNetItemKnowledge;
  const X = window.TribeNetCompendiumExpansion;
  if (!K || !X || typeof entities !== 'function') return;

  const localKey = value => {
    const raw = K.key ? K.key(value) : String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    return raw === 'ABSINTH' ? 'ABSINTHE' : raw;
  };
  const sameName = (a,b) => localKey(a) === localKey(b);
  const escText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const turnSort = value => {
    const match = String(value || '').match(/(\d+)\D+(\d+)/);
    return match ? Number(match[1]) * 100 + Number(match[2]) : 0;
  };

  function evidenceScore(entity) {
    let score = 0;
    if (entity.kind === 'ship' || entity.kind === 'facility' || entity.kind === 'Fair item') score += 10;
    if (entity.validGoods) score += 8;
    if (entity.isImplement) score += 8;
    for (const key of ['sections','notes','sourceSkills','uses','producers','consumers','researchTopics','implementUses']) {
      if (Array.isArray(entity[key]) && entity[key].length) score += 2;
    }
    if (entity.summary && !/^Trade Fair item|^Current Orders workbook/i.test(String(entity.summary))) score += 1;
    return score;
  }

  function mergeEntity(target, incoming) {
    const preferred = evidenceScore(incoming) > evidenceScore(target) ? incoming : target;
    const merged = { ...target, ...incoming, ...preferred };
    for (const field of ['sections','notes','sourceSkills','uses','producers','consumers','researchTopics','implementUses']) {
      const values = [...(target[field] || []), ...(incoming[field] || [])];
      const seen = new Set();
      merged[field] = values.filter(value => {
        const signature = typeof value === 'string' ? value : JSON.stringify(value);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    }
    if (localKey(target.name) === 'ABSINTHE' || localKey(incoming.name) === 'ABSINTHE') {
      merged.name = 'Absinthe';
      merged.key = 'ABSINTHE';
    }
    return merged;
  }

  function knownFacilityKeys() {
    const keys = new Set();
    for (const entity of compState?.catalog?.entities || []) {
      if (String(entity.kind || entity.type || '').toLowerCase() === 'facility') keys.add(localKey(entity.name || entity.key));
    }
    for (const topic of window.TribeNetResearchData?.topics || []) {
      const text = `${topic?.benefit || ''} ${topic?.recipe || ''}`;
      if (!/new\s+building\b/i.test(text)) continue;
      const match = text.match(/new\s+building\s*[-–—:]?\s*([^,.;]+)/i);
      if (match?.[1]) keys.add(localKey(match[1]));
      if (topic.name) keys.add(localKey(topic.name));
    }
    keys.add('AMPHITHEATRE');
    return keys;
  }

  const pollutedEntities = entities;
  entities = function round4Entities() {
    const source = pollutedEntities();
    const skillKeys = new Set((typeof skills === 'function' ? skills() : []).map(skill => localKey(skill.name)));
    const facilityKeys = knownFacilityKeys();
    const deduped = new Map();

    for (const original of source) {
      let entity = original;
      const key = localKey(entity.name || entity.key);
      if (!key) continue;
      if (facilityKeys.has(key) && entity.kind !== 'ship') entity = { ...entity, kind:'facility' };

      const iconOnlyGhost = entity.kind === 'item' && evidenceScore(entity) === 0;
      if (iconOnlyGhost && skillKeys.has(key)) continue;
      if (iconOnlyGhost && !window.TribeNetFairPriceBenchmark?.rows?.some(row => sameName(row?.[0], entity.name))) continue;

      const prior = deduped.get(key);
      deduped.set(key, prior ? mergeEntity(prior, entity) : entity);
    }

    return [...deduped.values()];
  };

  entityByName = function round4EntityByName(name) {
    const key = localKey(name);
    return entities().find(entity => localKey(entity.name) === key || localKey(entity.key) === key) || null;
  };

  function removeDemandFromOverview() {
    if (!/Compendium\s*›\s*Items/i.test(document.getElementById('compBreadcrumbs')?.textContent || '')) return;
    document.querySelectorAll('.comp-entity-card span,.comp-item-table-wrap td').forEach(node => {
      const original = node.textContent || '';
      const cleaned = original.replace(/\s*·?\s*[\d,.]+\s+demand\b/gi, '').replace(/\s{2,}/g, ' ').trim();
      if (cleaned !== original.trim()) node.textContent = cleaned;
    });
  }

  const priorShowCategory = showCategory;
  showCategory = function round4ShowCategory(key, push = true) {
    const result = priorShowCategory(key, push);
    if (key === 'items') requestAnimationFrame(removeDemandFromOverview);
    return result;
  };

  function addAstronomyEvidence() {
    const article = document.getElementById('compArticle');
    if (!article || article.querySelector('[data-astronomy-evidence]')) return;
    const title = article.querySelector('.comp-title-row');
    if (!title) return;
    const callout = document.createElement('div');
    callout.className = 'comp-callout';
    callout.dataset.astronomyEvidence = 'true';
    callout.innerHTML = '<strong>Source status:</strong> Astronomy is retained as a Group C skill because it is explicitly listed in the Orders workbook Valid Skills index as <strong>Astr</strong>, and the Research List has an Astronomy research chain that increases Navigation. No dedicated Mandate skill section is currently indexed, so this page does not invent additional skill rules.';
    title.insertAdjacentElement('afterend', callout);
  }

  const priorShowSkill = showSkill;
  showSkill = function round4ShowSkill(name, push = true) {
    const result = priorShowSkill(name, push);
    if (localKey(name) === 'ASTRONOMY') requestAnimationFrame(addAstronomyEvidence);
    return result;
  };

  function benchmarkSnapshot() {
    const benchmark = window.TribeNetFairPriceBenchmark;
    if (!benchmark) return null;
    return {
      turnKey:'903-10',
      sourceFile:benchmark.source?.workbook || 'Historical Fair benchmark',
      historical:true,
      items:(benchmark.rows || []).map(row => ({
        name:row[0], status:row[1], sellPrice:row[4], sellQuantityLimit:row[5], purchasePrice:row[7], purchaseQuantityLimit:null
      }))
    };
  }

  async function latestFairEntry(entity) {
    const snapshots = [];
    const historical = benchmarkSnapshot();
    if (historical) snapshots.push(historical);
    try {
      const summaries = await window.fairnet?.listSnapshots?.();
      const actual = (await Promise.all((summaries || []).map(summary => window.fairnet.getSnapshot(summary.turnKey)))).filter(Boolean);
      snapshots.push(...actual);
    } catch (_) {}
    const matches = [];
    for (const snapshot of snapshots) {
      for (const item of snapshot.items || []) {
        if (sameName(item.name, entity.name)) matches.push({ snapshot, item });
      }
    }
    matches.sort((a,b) => turnSort(b.snapshot.turnKey) - turnSort(a.snapshot.turnKey));
    return matches[0] || null;
  }

  function removeLegacyPriceSummary() {
    document.querySelectorAll('#compArticle .comp-price-summary').forEach(node => node.remove());
  }

  function accessText() {
    return 'Economics 5; or Economics 4 / Diplomacy 7 with Village and Trading Post (Mandate § 15.1).';
  }

  function appendCells(row, cells) {
    for (const value of cells) {
      const td = document.createElement('td');
      td.innerHTML = value;
      row.appendChild(td);
    }
  }

  async function refreshFairPresentation(entity) {
    const article = document.getElementById('compArticle');
    if (!article || !entity) return;
    removeLegacyPriceSummary();

    const acquisitionBody = article.querySelector('[data-item-acquisition] tbody');
    const usageBody = article.querySelector('[data-item-usage] tbody');
    if (!acquisitionBody || !usageBody) return;

    [...acquisitionBody.rows].forEach(row => {
      if ((row.cells[0]?.textContent || '').trim() === 'Fair') row.remove();
    });
    usageBody.querySelectorAll('tr[data-round4-fair-sale]').forEach(row => row.remove());

    const latest = await latestFairEntry(entity);
    if (!latest || !document.body.contains(article)) return;
    const { snapshot, item } = latest;
    const sourceLabel = `${escText(snapshot.turnKey)}<br>${escText(snapshot.sourceFile || 'Fair workbook')}`;
    const purchasePrice = Number(item.purchasePrice || 0);
    const purchaseLimit = item.purchaseQuantityLimit == null ? 'Not listed' : Number(item.purchaseQuantityLimit).toLocaleString();

    const buyRow = document.createElement('tr');
    buyRow.dataset.round4FairBuy = 'true';
    appendCells(buyRow, [
      'Fair',
      sourceLabel,
      escText(accessText()),
      purchasePrice > 0 ? `Buy: ${purchasePrice.toLocaleString()} silver each<br>Limit: ${purchaseLimit}` : 'Not available to buy at this Fair',
      `${snapshot.historical ? 'Historical Fair benchmark' : 'Latest imported Fair workbook'}${item.status ? `<br>${escText(item.status)}` : ''}`
    ]);
    acquisitionBody.appendChild(buyRow);

    const sellPrice = Number(item.sellPrice || 0);
    if (sellPrice > 0) {
      const sellLimit = item.sellQuantityLimit == null ? 'Not listed' : Number(item.sellQuantityLimit).toLocaleString();
      const sellRow = document.createElement('tr');
      sellRow.dataset.round4FairSale = 'true';
      appendCells(sellRow, [
        'Fair',
        'Economics 5 / Fair access',
        'Sell to Fair',
        `Fair pays: ${sellPrice.toLocaleString()} silver each<br>Demand limit: ${sellLimit}`,
        escText(accessText()),
        `${sourceLabel}<br>${snapshot.historical ? 'Historical Fair benchmark' : 'Latest imported Fair workbook'}`
      ]);
      usageBody.appendChild(sellRow);
    }
  }

  const priorShowEntity = showEntity;
  showEntity = function round4ShowEntity(name, push = true) {
    const result = priorShowEntity(name, push);
    const entity = entityByName(name);
    requestAnimationFrame(() => {
      removeLegacyPriceSummary();
      if (localKey(entity?.name) === 'ABSINTHE') {
        const heading = document.querySelector('#compArticle .comp-title-row h1');
        if (heading) heading.textContent = 'Absinthe';
      }
      refreshFairPresentation(entity).catch(console.error);
    });
    return result;
  };

  window.TribeNetCompendiumRound4 = { localKey, sameName, latestFairEntry };

  if (compState?.view?.type === 'category' && compState.view.key === 'items') showCategory('items', false);
})();

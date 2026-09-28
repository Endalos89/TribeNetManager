(() => {
  const existing = window.TRIBENET_MANDATE || {};
  const mandate = Object.assign(existing, {
    sourceDocument: 'TribeNet Mandate TN3 Revision N02.2',
    revision: 'N02.2',
    sourceDate: '2026-07-16',
    sections: existing.sections || [],
    batches: existing.batches || [],
    _bySection: existing._bySection || new Map(),
    _plainTextCache: existing._plainTextCache || new Map()
  });

  function canonicalSection(value) {
    return String(value || '').trim().replace(/^§\s*/, '').replace(/\.$/, '');
  }

  function plainText(section) {
    if (!section) return '';
    if (mandate._plainTextCache.has(section.section)) return mandate._plainTextCache.get(section.section);
    const parts = [section.title];
    for (const block of section.body || []) {
      if (block.type === 'paragraph') parts.push(block.text || '');
      if (block.type === 'table') {
        for (const row of block.rows || []) parts.push((row || []).join(' '));
      }
    }
    const result = parts.join('\n');
    mandate._plainTextCache.set(section.section, result);
    return result;
  }

  mandate.registerBatch = function registerBatch(batch) {
    if (!batch || !Array.isArray(batch.sections)) return;
    const known = new Set(mandate.sections.map(section => section.section));
    for (const section of batch.sections) {
      if (known.has(section.section)) continue;
      mandate.sections.push(section);
      mandate._bySection.set(section.section, section);
      known.add(section.section);
    }
    if (!mandate.batches.some(item => item.id === batch.id)) {
      mandate.batches.push({
        id: batch.id,
        title: batch.title,
        topSections: batch.topSections || [],
        sectionCount: batch.sections.length
      });
    }
  };

  mandate.getSection = function getSection(section) {
    const key = canonicalSection(section);
    return mandate._bySection.get(key) || mandate.sections.find(item => item.section === key) || null;
  };

  mandate.childrenOf = function childrenOf(section) {
    const key = canonicalSection(section);
    return mandate.sections.filter(item => item.parent === key);
  };

  mandate.topLevel = function topLevel() {
    return mandate.sections.filter(item => item.level === 1);
  };

  mandate.sectionsForBatch = function sectionsForBatch(id) {
    const batch = mandate.batches.find(item => item.id === String(id));
    if (!batch) return [];
    const tops = new Set(batch.topSections || []);
    return mandate.sections.filter(item => tops.has(item.topSection));
  };

  mandate.plainText = plainText;

  mandate.search = function search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return mandate.sections.filter(section =>
      String(section.section).toLowerCase().includes(q) ||
      plainText(section).toLowerCase().includes(q)
    );
  };

  window.TRIBENET_MANDATE = mandate;
})();

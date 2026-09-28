(() => {
  const existing = window.TRIBENET_MANDATE || {};
  const mandate = Object.assign(existing, {
    sourceDocument: 'TribeNet Mandate TN3 Revision N02.2',
    revision: 'N02.2',
    sourceDate: '2026-07-16',
    sections: existing.sections || [],
    batches: existing.batches || [],
    _bySection: existing._bySection || new Map(),
    _plainTextCache: existing._plainTextCache || new Map(),
    _pending: existing._pending || []
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

  function registerBatch(batch) {
    if (!batch || !Array.isArray(batch.sections)) return;
    const known = new Set(mandate.sections.map(section => section.section));
    for (const section of batch.sections) {
      if (known.has(section.section)) continue;
      mandate.sections.push(section);
      mandate._bySection.set(section.section, section);
      known.add(section.section);
    }
    const existingBatch = mandate.batches.find(item => item.id === String(batch.id));
    if (existingBatch) {
      existingBatch.title = batch.title || existingBatch.title;
      existingBatch.topSections = batch.topSections || existingBatch.topSections || [];
      existingBatch.sectionCount = batch.sections.length;
    } else {
      mandate.batches.push({
        id: String(batch.id),
        title: batch.title,
        topSections: batch.topSections || [],
        sectionCount: batch.sections.length
      });
    }
  }

  async function inflateBase64(data) {
    const binary = atob(String(data || ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Response(stream).text();
  }

  mandate.registerBatch = registerBatch;

  mandate.registerPackedBatch = function registerPackedBatch(batch) {
    if (!batch || !batch.data) return;
    const id = String(batch.id);
    if (!mandate.batches.some(item => item.id === id)) {
      mandate.batches.push({ id, title: batch.title, topSections: batch.topSections || [], sectionCount: null });
    }
    const pending = (async () => {
      if (batch.encoding && batch.encoding !== 'deflate-base64') throw new Error(`Unsupported Mandate encoding: ${batch.encoding}`);
      const text = await inflateBase64(batch.data);
      const decoded = JSON.parse(text);
      registerBatch(decoded);
    })();
    mandate._pending.push(pending);
    return pending;
  };

  mandate.whenReady = function whenReady() {
    return Promise.all(mandate._pending).then(() => {
      mandate.sections.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      mandate.batches.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return mandate;
    });
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

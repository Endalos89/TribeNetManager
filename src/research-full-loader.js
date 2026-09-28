(() => {
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  async function decodeResearch() {
    const parts = window.TribeNetResearchFullB64Parts || [];
    if (!parts.length) return null;
    const binary = atob(parts.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    const rows = JSON.parse(text);
    return rows.map((row,index) => ({
      ...row,
      key: slug(`${row.skill}-${row.name}`),
      benefit: row.summary || row.effect || row.description || '',
      affectedSkills: Array.isArray(row.affectedSkills) ? row.affectedSkills : [],
      fullResearch: true,
      sourceIndex: index
    }));
  }
  window.TribeNetResearchFullReady = (async () => {
    try {
      const topics = await decodeResearch();
      if (!topics?.length || !window.TribeNetResearchData) return false;
      window.TribeNetResearchData.topics = topics;
      window.TribeNetResearchData.fullResearch = true;
      window.TribeNetResearchData.topicCount = topics.length;
      return true;
    } catch (error) {
      console.error('Could not load full TribeNet Research List dataset', error);
      return false;
    }
  })();
})();

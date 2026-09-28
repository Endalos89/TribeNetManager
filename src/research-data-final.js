(() => {
  const raw = window.TribeNetResearchDataRaw;
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const topics = (raw.rows || []).map(([skill,name,dl,benefit,page]) => ({key:slug(`${skill}-${name}`),skill,name,dl,benefit,page}));
  window.TribeNetResearchData = {source:raw.source,extraSkills:raw.extraSkills,topics};
  delete window.TribeNetResearchDataRaw;
})();

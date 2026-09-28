(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const store = { batches: [], topics: [], entities: new Map(), skillNotes: [] };

  const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const clean = value => String(value == null ? '' : value).trim();
  const normalizeLink = value => {
    if (!value) return null;
    if (typeof value === 'string') return { label: value };
    return { ...value, label: clean(value.label || value.name || value.topic || value.skill || value.entity) };
  };

  function normalizeRecipe(recipe) {
    if (!recipe) return null;
    return {
      activity: clean(recipe.activity),
      output: recipe.output ? { item: clean(recipe.output.item), quantity: Number(recipe.output.quantity || 1) } : null,
      people: recipe.people == null ? null : Number(recipe.people),
      labour: clean(recipe.labour),
      skills: array(recipe.skills).map(s => ({ name: clean(s.name), level: Number(s.level || 0) })),
      inputs: array(recipe.inputs).map(i => ({ item: clean(i.item), quantity: Number(i.quantity || 0), note: clean(i.note) })),
      variants: array(recipe.variants).map(v => normalizeRecipe(v)).filter(Boolean),
      raw: clean(recipe.raw)
    };
  }

  function normalizeTopic(topic, batch) {
    const key = topic.key || slug(`${topic.skill}-${topic.name}`);
    return {
      key,
      skill: clean(topic.skill),
      name: clean(topic.name),
      dl: clean(topic.dl),
      page: Number(topic.page || 0),
      status: clean(topic.status || 'available'),
      summary: clean(topic.summary),
      description: clean(topic.description),
      effects: array(topic.effects).map(clean).filter(Boolean),
      prerequisites: array(topic.prerequisites).map(normalizeLink).filter(Boolean),
      leadsTo: array(topic.leadsTo).map(normalizeLink).filter(Boolean),
      recipe: normalizeRecipe(topic.recipe),
      requirements: array(topic.requirements).map(clean).filter(Boolean),
      restrictions: array(topic.restrictions).map(clean).filter(Boolean),
      notes: array(topic.notes).map(clean).filter(Boolean),
      sourceGaps: array(topic.sourceGaps).map(clean).filter(Boolean),
      sourceIssues: array(topic.sourceIssues).map(clean).filter(Boolean),
      affectsSkills: array(topic.affectsSkills).map(clean).filter(Boolean),
      relatedSkills: array(topic.relatedSkills).map(clean).filter(Boolean),
      creates: array(topic.creates).map(c => typeof c === 'string' ? { name: c, kind: 'item' } : { ...c, name: clean(c.name), kind: clean(c.kind || 'item') }),
      source: { title: batch.source.title, updated: batch.source.updated, pages: batch.pages, page: Number(topic.page || 0) },
      batchId: batch.id
    };
  }

  function mergeEntity(topic, created) {
    const key = canon(created.name);
    if (!key) return;
    const entity = store.entities.get(key) || { name: created.name, kind: created.kind || 'item', researchOnly: true, topics: [], effects: [], recipes: [], requirements: [], restrictions: [], notes: [] };
    entity.kind = created.kind || entity.kind;
    entity.researchOnly = created.researchOnly !== false;
    if (!entity.topics.includes(topic.key)) entity.topics.push(topic.key);
    for (const field of ['effects','requirements','restrictions','notes']) {
      for (const value of array(created[field])) if (value && !entity[field].includes(value)) entity[field].push(value);
    }
    if (created.recipe) entity.recipes.push(normalizeRecipe(created.recipe));
    else if (topic.recipe && topic.recipe.output && canon(topic.recipe.output.item) === key) entity.recipes.push(topic.recipe);
    store.entities.set(key, entity);
  }

  function registerBatch(batch) {
    if (!batch || !batch.id || !batch.source?.title) throw new Error('Research batch requires id and source title');
    if (store.batches.some(b => b.id === batch.id)) return;
    const skillNotes = array(batch.skillNotes).map(n => ({
      skill: clean(n.skill),
      page: Number(n.page || 0),
      status: clean(n.status || 'note'),
      note: clean(n.note),
      source: { title: clean(batch.source.title), updated: clean(batch.source.updated), pages: clean(batch.pages) },
      batchId: batch.id
    })).filter(n => n.skill && n.note && n.page);
    const normalizedBatch = { id: batch.id, title: clean(batch.title), pages: clean(batch.pages), source: { title: clean(batch.source.title), updated: clean(batch.source.updated) }, skills: array(batch.skills).map(clean).filter(Boolean), skillNotes };
    store.batches.push(normalizedBatch);
    store.skillNotes.push(...skillNotes);
    for (const rawTopic of array(batch.topics)) {
      const topic = normalizeTopic(rawTopic, normalizedBatch);
      if (!topic.skill || !topic.name || !topic.dl || !topic.page) throw new Error(`Incomplete research topic: ${topic.skill}/${topic.name}`);
      if (!topic.effects.length && !topic.description && !topic.sourceGaps.length) throw new Error(`Research topic has no rule content or documented source gap: ${topic.skill}/${topic.name}`);
      store.topics.push(topic);
      for (const created of topic.creates) mergeEntity(topic, created);
    }
  }

  const topicByKey = key => store.topics.find(t => t.key === key) || null;
  const topicsForSkill = skill => store.topics.filter(t => canon(t.skill) === canon(skill));
  const affectingSkill = skill => store.topics.filter(t => t.affectsSkills.some(s => canon(s) === canon(skill)) && canon(t.skill) !== canon(skill));
  const notesForSkill = skill => store.skillNotes.filter(n => canon(n.skill) === canon(skill));
  const entity = name => store.entities.get(canon(name)) || null;
  const topicsForEntity = name => { const e = entity(name); return e ? e.topics.map(topicByKey).filter(Boolean) : []; };

  root.TribeNetResearchV2 = { canon, slug, registerBatch, topicByKey, topicsForSkill, affectingSkill, notesForSkill, entity, topicsForEntity, get batches(){ return [...store.batches]; }, get topics(){ return [...store.topics]; }, get entities(){ return [...store.entities.values()]; }, get skillNotes(){ return [...store.skillNotes]; } };
})();

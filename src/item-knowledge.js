(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TribeNetItemKnowledge = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const canonical = (v) =>
    String(v || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  const aliases = {
    LOGS: "LOG",
    STONES: "STONE",
    SKINS: "SKIN",
    FURS: "FUR",
    PROVISIONS: "PROVS",
    NETS: "NET",
    HORSES: "HORSE",
    GOATS: "GOAT",
    BONES: "BONE",
    ARROWS: "ARROW",
    QUARRELS: "QUARREL",
    FRAMES: "FRAME",
    SHAFTS: "SHAFT",
    SHACKLES: "SHACKLE",
    "H BOW": "HORSE BOW",
    ABSINTH: "ABSINTHE",
  };
  const key = (v) => aliases[canonical(v)] || canonical(v);
  const same = (a, b) => key(a) === key(b);
  function recipesFor(entity, skills) {
    const result = [];
    const seen = new Set();
    for (const skill of skills || [])
      for (const recipe of skill.recipes || []) {
        const id = recipe.recipeKey || `${recipe.primarySkill}:${recipe.name}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const variants = recipe.alternatives?.length
          ? recipe.alternatives
          : [{ label: "Standard", inputs: recipe.inputs || [] }];
        const consumed = variants
          .map((v) => ({
            ...v,
            matched: (v.inputs || []).filter((i) => same(i.item, entity.name)),
          }))
          .filter((v) => v.matched.length);
        const facility = (recipe.facilities || []).some((f) =>
          same(f, entity.name),
        );
        if (same(recipe.outputItem, entity.name))
          result.push({ kind: "production", recipe });
        if (consumed.length || facility)
          result.push({
            kind: facility ? "facility" : "ingredient",
            recipe,
            variants: consumed,
          });
      }
    return result;
  }
  function fairRows(entity, snapshots) {
    return (snapshots || []).flatMap((s) =>
      (s.items || [])
        .filter((i) => same(i.name, entity.name))
        .map((item) => ({
          snapshot: s,
          item,
          purchasable:
            Number(item.purchasePrice) > 0 &&
            (item.purchaseQuantityLimit == null ||
              Number(item.purchaseQuantityLimit) > 0),
        })),
    );
  }
  function profilesFor(entity, profiles) {
    return Object.values(profiles || {}).flatMap((profile) =>
      (profile.outputs || [])
        .filter((o) => same(o.item, entity.name))
        .map((output) => ({ profile, output })),
    );
  }
  function profileRecipesFor(entity, profiles) {
    const rows = [];
    for (const profile of Object.values(profiles || {})) {
      for (const row of profile.directCrafts || []) {
        const variants = row.variants?.length
          ? row.variants
          : [{ inputs: row.inputs || [], people: row.people }];
        if (same(row.entity, entity.name))
          rows.push({ kind: "production", profile, row, variants });
        const matched = variants.filter((v) =>
          (v.inputs || []).some((i) => same(i.entity, entity.name)),
        );
        if (matched.length)
          rows.push({ kind: "ingredient", profile, row, variants: matched });
      }
      for (const row of profile.processRows || []) {
        if ((row.outputs || []).some((o) => same(o.entity, entity.name)))
          rows.push({ kind: "process-output", profile, row });
        if ((row.inputs || []).some((i) => same(i.entity, entity.name)))
          rows.push({ kind: "process-input", profile, row });
      }
    }
    return rows;
  }
  function researchRecipesFor(entity, topics) {
    const rows = [],
      seen = new Set();
    for (const topic of topics || [])
      for (const recipe of [
        topic.recipe,
        ...(topic.creates || []).map((x) => x.recipe),
      ].filter(Boolean)) {
        const signature = JSON.stringify([topic.key, recipe]);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const variants = recipe.variants?.length ? recipe.variants : [recipe];
        if (same(recipe.output?.item, entity.name))
          rows.push({ kind: "production", topic, recipe, variants });
        const matched = variants.filter((v) =>
          (v.inputs || recipe.inputs || []).some((i) =>
            same(i.item, entity.name),
          ),
        );
        if (matched.length)
          rows.push({ kind: "ingredient", topic, recipe, variants: matched });
      }
    return rows;
  }
  return {
    canonical,
    key,
    same,
    recipesFor,
    fairRows,
    profilesFor,
    profileRecipesFor,
    researchRecipesFor,
  };
});

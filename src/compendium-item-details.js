(() => {
  const K = window.TribeNetItemKnowledge;
  let snapshots = [],
    fairError = "";
  const source = (section) =>
    section
      ? `<a href="#" data-mandate-open="${esc(section)}">Mandate § ${esc(section)}</a>`
      : "Not documented";
  const profileLink = (p) => skillLink(p.name, p.name);
  const table = (headers, rows) =>
    `<div class="item-table-wrap"><table class="comp-recipe-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Not documented in the indexed sources.</td></tr>`}</tbody></table></div>`;
  function render(entity) {
    const profiles = window.TribeNetSkillOverhaul?.profiles || {};
    const links = K.recipesFor(entity, skills());
    const obtain = [];
    for (const { recipe: r } of links.filter((x) => x.kind === "production"))
      obtain.push([
        /fell|gather|mine|quarry|fish|hunt|forag|seek|strip/i.test(r.name)
          ? "Extraction / gathering"
          : "Crafting",
        `${esc(r.name)}<br>${fmtNum(r.outputQuantity ?? 1)} ${entityLink(entity.name)}`,
        `${skillLink(r.primarySkill)} ${fmtNum(r.skillLevel)}<br>${r.people == null ? "Labour not documented" : `${fmtNum(r.people)} people`}`,
        `${renderAlternatives(r)}<br>${renderRequirements(r)}${r.notes ? `<br>${esc(r.notes)}` : ""}`,
        source(r.section),
      ]);
    for (const { profile: p, output: o } of K.profilesFor(entity, profiles))
      obtain.push([
        "Extraction / activity",
        esc(o.label || o.item),
        profileLink(p),
        `${esc(o.rate || o.type || "Variable return")}<br>${esc(o.detail || "")}<br>${esc(p.workerRule || "")}`,
        source(o.source || p.primarySection),
      ]);
    for (const name of entity.sourceSkills || []) {
      if (/ ORE$/i.test(entity.name) && K.same(name, "Refining")) continue;
      if (obtain.some((row) => row[2].includes(`data-skill="${esc(name)}"`)))
        continue;
      const s = skillByName(name);
      obtain.push([
        "Source skill",
        entityLink(entity.name),
        skillLink(name),
        `${esc(entity.summary || "")}<br>${(s?.limitations || []).map(esc).join("<br>")}`,
        source(s?.section || (s?.sections || [])[0]),
      ]);
    }
    const benchmark = window.TribeNetFairPriceBenchmark;
    const historical = benchmark
      ? {
          turnKey: "903-10",
          sourceFile: benchmark.source.workbook,
          items: benchmark.rows.map(
            ([
              name,
              status,
              _base,
              _dynamic,
              sellPrice,
              sellQuantityLimit,
              _demand,
              purchasePrice,
            ]) => ({
              name,
              status,
              sellPrice,
              sellQuantityLimit,
              purchasePrice,
              purchaseQuantityLimit: null,
            }),
          ),
        }
      : null;
    const fairSnapshots =
      historical && !snapshots.some((s) => s.turnKey === "903-10")
        ? [historical, ...snapshots]
        : snapshots;
    for (const { snapshot: s, item: i, purchasable } of K.fairRows(
      entity,
      fairSnapshots,
    ))
      obtain.push([
        "Fair",
        `${esc(s.turnKey)}<br>${esc(s.sourceFile)}`,
        `${skillLink("Economics")} 5; or ${skillLink("Economics")} 4 / ${skillLink("Diplomacy")} 7 with Village and Trading Post. ${source("15.1")}`,
        purchasable
          ? `Buy: ${fmtNum(i.purchasePrice)} silver each<br>Limit: ${i.purchaseQuantityLimit == null ? "Not listed" : fmtNum(i.purchaseQuantityLimit)}`
          : "Listed, but unavailable to buy at this Fair",
        `Uploaded Fair workbook<br>${esc(i.status || "")}`,
      ]);
    const profileInputs = (inputs) =>
      (inputs || [])
        .map((i) =>
          entityLink(i.entity, i.label || `${i.quantity ?? ""} ${i.entity}`),
        )
        .join(", ") || "None documented";
    const profileRecipes = K.profileRecipesFor(entity, profiles);
    for (const { kind, profile: p, row: r, variants } of profileRecipes.filter(
      (x) => ["production", "process-output"].includes(x.kind),
    ))
      obtain.push([
        kind === "production" ? "Crafting" : "Processing",
        esc(r.label || r.activity || r.entity),
        `${profileLink(p)} ${r.level == null ? "(level not specified)" : esc(r.level)}<br>${esc(r.perWorker || p.workerRule || "")}`,
        kind === "production"
          ? (variants || [])
              .map(
                (v) =>
                  `${esc(v.label || "Standard")}: ${v.people ?? r.people ?? "Unspecified"} people; ${profileInputs(v.inputs || r.inputs)}`,
              )
              .join("<br>") + `<br>${esc(r.detail || "")}`
          : `${profileInputs(r.inputs)} → ${profileInputs(r.outputs)}<br>${esc(r.detail || "")}`,
        source(r.source || p.primarySection),
      ]);
    const research = K.researchRecipesFor(
      entity,
      window.TribeNetResearchV2?.topics || [],
    );
    const researchSource = (t) =>
      `Research: ${esc(t.skill)} / ${esc(t.name)}<br>Page ${esc(t.page || "not documented")}`;
    const researchRequirements = (t, r) =>
      `Research required: ${esc(t.name)} (DL ${esc(t.dl)})<br>${(r.skills || []).map((x) => `${skillLink(x.name)} ${esc(x.level)}`).join(", ")}<br>${(t.restrictions || []).map(esc).join("<br>")}`;
    for (const { topic: t, recipe: r, variants } of research.filter(
      (x) => x.kind === "production",
    ))
      obtain.push([
        "Research crafting",
        `${fmtNum(r.output?.quantity ?? 1)} ${esc(r.output?.item || entity.name)}`,
        `${skillLink(r.activity || t.skill)}<br>${r.people == null ? "Labour not specified" : `${fmtNum(r.people)} people`}`,
        (variants || [])
          .map((v) => renderInputList(v.inputs || r.inputs))
          .join("<br>") + `<br>${researchRequirements(t, r)}`,
        researchSource(t),
      ]);
    const createdTopics = (window.TribeNetResearchV2?.topics || []).flatMap(
      (topic) =>
        (topic.creates || [])
          .filter((created) => K.same(created.name, entity.name))
          .map((created) => ({ topic, created })),
    );
    for (const { topic: t, created: c } of createdTopics.filter(
      (x) => !x.created.recipe && !x.topic.recipe,
    ))
      obtain.push([
        "Research unlock / acquisition",
        esc(c.name),
        `${skillLink(t.skill)}; research ${esc(t.name)} (DL ${esc(t.dl)})`,
        [...(c.effects || []), ...(t.effects || []), ...(t.restrictions || [])]
          .map(esc)
          .join("<br>"),
        researchSource(t),
      ]);
    const uses = [];
    for (const { topic: t, created: c } of createdTopics)
      if ((c.effects || []).length)
        uses.push([
          esc(c.name),
          skillLink(t.skill),
          "Research-defined effect",
          (c.effects || []).map(esc).join("<br>"),
          [...(c.restrictions || []), ...(t.restrictions || [])]
            .map(esc)
            .join("<br>"),
          researchSource(t),
        ]);
    for (const { kind, profile: p, row: r, variants } of profileRecipes.filter(
      (x) => ["ingredient", "process-input"].includes(x.kind),
    ))
      uses.push([
        r.entity ? entityLink(r.entity, r.label) : esc(r.activity),
        `${profileLink(p)} ${r.level == null ? "(level not specified)" : esc(r.level)}`,
        kind === "ingredient" ? "Craft ingredient" : "Processing input",
        kind === "ingredient"
          ? variants
              .map(
                (v) =>
                  `${esc(v.label || "Standard")}: ${profileInputs(v.inputs || r.inputs)}`,
              )
              .join("<br>")
          : profileInputs(r.inputs),
        `${esc(r.detail || "")}<br>${esc(r.perWorker || p.workerRule || "")}`,
        source(r.source || p.primarySection),
      ]);
    for (const { topic: t, recipe: r, variants } of research.filter(
      (x) => x.kind === "ingredient",
    ))
      uses.push([
        entityLink(r.output?.item || t.name),
        skillLink(r.activity || t.skill),
        "Research ingredient",
        variants.map((v) => renderInputList(v.inputs || r.inputs)).join("<br>"),
        researchRequirements(t, r),
        researchSource(t),
      ]);
    for (const link of links.filter((x) => x.kind !== "production")) {
      const r = link.recipe;
      uses.push([
        entityLink(r.outputItem || r.name, r.name),
        `${skillLink(r.primarySkill)} ${fmtNum(r.skillLevel)}`,
        esc(link.kind),
        link.kind === "facility"
          ? "Required facility"
          : link.variants
              .map(
                (v) =>
                  `${esc(v.label || "Standard")}: ${v.matched.map((i) => `${fmtNum(i.quantity)} ${esc(i.item)}${i.optional ? " (optional)" : ""}`).join(", ")}<br>Full recipe: ${renderInputList(v.inputs)}`,
              )
              .join("<br>"),
        renderRequirements(r),
        source(r.section),
      ]);
    }
    const benefits =
      window.TribeNetSkillOverhaul?.itemBenefitsFor(entity.name) || [];
    const seen = new Set();
    for (const u of [...benefits, ...(entity.uses || [])]) {
      const signature = `${u.skill}:${u.value || u.text || u.detail}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      uses.push([
        skillLink(u.skill),
        u.level == null ? "Not specified" : esc(u.level),
        "Skill support / implement",
        `${esc(u.value || u.text || "")}<br>${esc(u.detail || "")}`,
        `${u.baseMax ? `${esc(u.baseMax)} per worker<br>` : ""}${esc(u.baseMaxBenefit || "")}`,
        u.source && u.source !== "Mandate" ? esc(u.source) : source(u.section),
      ]);
    }
    for (const u of entity.implementUses || []) {
      if (
        K.same(u.activity, "Fishing") &&
        (/ship|galley|fisher|merchant|coaster|boat|barge|trawler/i.test(
          entity.name,
        ) ||
          entity.kind === "ship")
      )
        continue;
      if (benefits.some((b) => K.same(b.skill, u.activity))) continue;
      uses.push([
        skillLink(u.activity),
        "Not specified",
        "Orders implement",
        `Supports ${esc(u.item || "activity")}`,
        "Listed in Orders; effect not documented here.",
        "Orders workbook Valid Implements",
      ]);
    }
    return `<section class="comp-section item-acquisition" data-item-acquisition><h2>Where to get this item</h2>${table(["Method", "Item / Fair", "Skill / labour", "Quantities, requirements & restrictions", "Source"], obtain)}<p class="comp-muted">Fair rows use imported workbooks for the named Fair. A historical price does not guarantee availability at a future Fair. Fairs occur in months 04 and 10; one Tribe per Clan may trade, using goods available at the start of the turn. See Mandate § 15.1 for post access and linked-unit restrictions.${fairError ? ` ${esc(fairError)}` : ""}</p></section><section class="comp-section item-usage" data-item-usage><h2>Recipes & supported skills</h2>${table(["Recipe / skill", "Required level", "Use", "Quantity / effect", "Requirements & restrictions", "Source"], uses)}</section>`;
  }
  // Source data is static after catalogue initialization. Rebuild only when the
  // catalogue is replaced or initialization adds skills/entities.
  let catalogueCache, catalogueSource, catalogueStamp, entityIndex = new Map();
  const tableCache = new Map();
  const previousEntities = entities;
  entities = function () {
    const stamp = `${compState.catalog?.entities?.length || 0}:${compState.catalog?.skills?.length || 0}`;
    if (catalogueCache && catalogueSource === compState.catalog && catalogueStamp === stamp)
      return catalogueCache;
    const list = previousEntities();
    const present = new Set(list.map((e) => K.key(e.name)));
    for (const { key, name } of window.TribeNetItemIconCatalogue || []) {
      if (present.has(key)) continue;
      list.push({
        key,
        name,
        kind: "item",
        sections: [],
        notes: [],
        sourceSkills: [],
        uses: [],
        producers: [],
        consumers: [],
      });
      present.add(key);
    }
    catalogueSource = compState.catalog;
    catalogueStamp = stamp;
    catalogueCache = list;
    entityIndex = new Map();
    for (const entity of list)
      for (const value of [entity.key, entity.name]) {
        const key = canon(value);
        if (!entityIndex.has(key)) entityIndex.set(key, entity);
      }
    tableCache.clear();
    return list;
  };
  entityByName = function (name) {
    entities();
    return entityIndex.get(canon(name)) || null;
  };
  function cachedTables(entity) {
    if (!tableCache.has(entity)) tableCache.set(entity, render(entity));
    return tableCache.get(entity);
  }
  const previousShowEntity = showEntity;
  showEntity = function (name, push = true) {
    const result = previousShowEntity(name, push);
    const entity = entityByName(name),
      article = $("compArticle");
    if (!entity || !article) return result;
    for (const section of [
      ...article.querySelectorAll(":scope > .comp-section"),
    ])
      if (
        [
          "How to obtain it",
          "Used in other skills",
          "Used to make / operate",
        ].includes(section.querySelector("h2")?.textContent)
      )
        section.remove();
    const title = article.querySelector(".comp-title-row");
    const icons = window.TribeNetItemIconManifest;
    const filename = icons?.[K.key(entity.name)];
    if (filename)
      title?.insertAdjacentHTML(
        "afterbegin",
        `<img class="item-pixel-icon" src="item-icons/${esc(filename)}" width="64" height="64" alt="${esc(entity.name)}">`,
      );
    const references = [
      ...article.querySelectorAll(":scope > .comp-section"),
    ].find((s) => s.querySelector("h2")?.textContent === "Mandate references");
    if (references)
      references.insertAdjacentHTML("beforebegin", cachedTables(entity));
    else article.insertAdjacentHTML("beforeend", cachedTables(entity));
    bindLinks(article);
    return result;
  };
  let refreshPromise, fairSignature = "";
  function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = refreshFair().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function refreshFair() {
    try {
      if (!window.fairnet) return;
      const summaries = await window.fairnet.listSnapshots();
      snapshots = (
        await Promise.all(
          summaries.map((s) => window.fairnet.getSnapshot(s.turnKey)),
        )
      ).filter(Boolean);
      fairError = "";
    } catch (error) {
      fairError = `Fair data could not be loaded: ${error.message || error}`;
    }
    const signature = JSON.stringify([snapshots, fairError]);
    if (signature === fairSignature) return;
    fairSignature = signature;
    tableCache.clear();
    if (compState.view?.type === "entity")
      showEntity(compState.view.key, false);
  }
  const decorated = new WeakSet();
  function decorateLinks(root) {
    const links = root.matches?.("[data-entity]") ? [root] : [];
    links.push(...(root.querySelectorAll?.("[data-entity]") || []));
    for (const el of links) {
      if (decorated.has(el)) continue;
      decorated.add(el);
      const e = entityByName(el.dataset.entity);
      const filename =
        window.TribeNetItemIconManifest?.[K.key(e?.name || el.dataset.entity)];
      if (!filename || el.querySelector(":scope > .item-inline-icon")) continue;
      el.insertAdjacentHTML(
        "afterbegin",
        `<img class="item-inline-icon" src="item-icons/${esc(filename)}" width="20" height="20" alt="" aria-hidden="true" loading="lazy" decoding="async">`,
      );
    }
  }
  new MutationObserver((records) => {
    // Visit added content only. Our own image insertions contain no item links.
    for (const record of records)
      for (const node of record.addedNodes)
        if (node.nodeType === 1) decorateLinks(node);
  }).observe($("compArticle"), { childList: true, subtree: true });
  decorateLinks($("compArticle"));
  refresh();
  window.addEventListener("focus", refresh);
})();

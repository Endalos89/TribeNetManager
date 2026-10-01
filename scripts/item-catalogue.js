const fs = require("fs"),
  vm = require("vm"),
  path = require("path");
const root = path.resolve(__dirname, "..");
const context = { window: {}, globalThis: {} };
vm.createContext(context);
const files = fs
  .readFileSync(path.join(root, "src/compendium.html"), "utf8")
  .matchAll(/<script src="([^"]+)"/g);
for (const [_, file] of files) {
  if (
    /^(orders-reference|research-(data|batch|v2)|skill-overhaul-(data|profile|category|woodwork|armour))/.test(
      file,
    ) ||
    file === "fair-price-data.js"
  )
    try {
      vm.runInContext(
        fs.readFileSync(path.join(root, "src", file), "utf8"),
        context,
      );
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
}
const { SKILLS, RECIPES, SOURCE_DOCUMENT } = require("../src/mandate-catalog");
const { completeMandateSkills } = require("../src/compendium-service");
const base = completeMandateSkills({
  sourceDocument: SOURCE_DOCUMENT,
  skills: SKILLS.map((s) => ({ ...s, skillGroup: s.group })),
  recipes: RECIPES,
});
const K = require("../src/item-knowledge");
const map = new Map();
function add(name) {
  if (!name) return;
  const key = K.key(name);
  if (!map.has(key))
    map.set(key, {
      key,
      name,
      filename: key.toLowerCase().replace(/ /g, "-") + ".png",
    });
}
for (const e of base.entities) add(e.name);
for (const g of context.window.TribeNetOrdersReference.goods)
  if (g.table !== "HUMANS") add(g.name);
for (const [name] of context.window.TribeNetFairPriceBenchmark.rows) add(name);
for (const p of Object.values(context.window.TribeNetSkillOverhaul.profiles)) {
  for (const o of p.outputs || []) add(o.item);
  for (const i of [...(p.implements || []), ...(p.modifiers || [])])
    add(i.name);
}
for (const t of context.window.TribeNetResearchV2.topics || [])
  for (const created of t.creates || []) add(created.name);
for (const p of Object.values(context.window.TribeNetSkillOverhaul.profiles)) {
  for (const r of p.directCrafts || []) {
    add(r.entity);
    for (const i of r.inputs || []) add(i.entity);
  }
  for (const r of p.processRows || [])
    for (const i of [...(r.inputs || []), ...(r.outputs || [])]) add(i.entity);
}
for (const name of [
  "Clay Mould",
  "Lantern",
  "Shearing Clippers",
  "Tomahawk",
  "Windlass",
  "Windsail",
  "Inter Spring Arts Festival Art",
  "Burner Improvements",
  "Inter Spring Arts Festival Music",
  "Terracotta Army removed",
  "Felucca Class I, Felucca Class II",
  "Courthouse",
])
  add(name);
const inventory = [...map.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
fs.writeFileSync(
  path.join(root, "src/item-icons/catalogue.json"),
  JSON.stringify(inventory, null, 2) + "\n",
);
const available = inventory.filter((row) =>
  fs.existsSync(path.join(root, "src/item-icons", row.filename)),
);
const pending = inventory.filter(
  (row) => !fs.existsSync(path.join(root, "src/item-icons", row.filename)),
);
fs.writeFileSync(
  path.join(root, "src/item-icons/pending.json"),
  JSON.stringify(pending, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(root, "src/item-icon-manifest.js"),
  "window.TribeNetItemIconCatalogue = " +
    JSON.stringify(
      inventory.map(({ key, name }) => ({ key, name })),
      null,
      2,
    ) +
    ";\n" +
    "window.TribeNetItemIconManifest = " +
    JSON.stringify(
      Object.fromEntries(available.map((row) => [row.key, row.filename])),
      null,
      2,
    ) +
    ";\n",
);
console.log(
  `${available.length}/${inventory.length} icons available; ${pending.length} pending.`,
);

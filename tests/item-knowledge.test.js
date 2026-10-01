const assert = require("assert");
const K = require("../src/item-knowledge");
const recipe = {
  recipeKey: "tool",
  name: "Tool",
  primarySkill: "Metalwork",
  skillLevel: 2,
  outputItem: "Pick",
  outputQuantity: 1,
  inputs: [{ item: "Iron", quantity: 2 }],
  alternatives: [
    { label: "Iron", inputs: [{ item: "Iron", quantity: 2 }] },
    { label: "Bronze", inputs: [{ item: "Bronze", quantity: 2 }] },
  ],
};
const skills = [{ recipes: [recipe, recipe] }];
assert.equal(K.recipesFor({ name: "Bronze" }, skills).length, 1);
assert.equal(
  K.recipesFor({ name: "Bronze" }, skills)[0].variants[0].matched[0].quantity,
  2,
);
assert.equal(K.recipesFor({ name: "Pick" }, skills)[0].kind, "production");
assert(K.same("Logs", "Log"));
assert(!K.same("Stone Axe", "Bone Axe"));
assert(!K.same("Shield Steel", "Shield"));
const rows = K.fairRows({ name: "Logs" }, [
  {
    turnKey: "906-04",
    items: [
      { name: "Log", purchasePrice: 4, purchaseQuantityLimit: 0 },
      { name: "Log", purchasePrice: 4, purchaseQuantityLimit: 20 },
    ],
  },
]);
assert(!rows[0].purchasable);
assert(rows[1].purchasable);
assert.equal(rows[1].snapshot.turnKey, "906-04");
assert.equal(
  K.profilesFor(
    { name: "Stone" },
    { quarry: { name: "Quarrying", outputs: [{ item: "Stones", rate: "4" }] } },
  ).length,
  1,
);
console.log(
  "Item source, alternative recipe, fair availability and alias tests passed.",
);
const profiles = {
  bone: {
    name: "Bonework",
    directCrafts: [
      {
        entity: "Bone Spear",
        level: 3,
        inputs: [{ entity: "Bones", quantity: 1 }],
        variants: [
          { label: "Bone", inputs: [{ entity: "Bones", quantity: 1 }] },
        ],
      },
    ],
  },
  cure: {
    name: "Curing",
    processRows: [
      {
        inputs: [{ entity: "Skins", label: "2 Skins" }],
        outputs: [{ entity: "Leather", label: "2 Leather" }],
      },
    ],
  },
};
assert.equal(
  K.profileRecipesFor({ name: "Bones" }, profiles)[0].kind,
  "ingredient",
);
assert.equal(
  K.profileRecipesFor({ name: "Leather" }, profiles)[0].kind,
  "process-output",
);
const research = [
  {
    key: "steel",
    name: "Steel Sword",
    recipe: {
      output: { item: "Sword Steel", quantity: 1 },
      inputs: [{ item: "Steel", quantity: 5 }],
    },
    creates: [
      {
        name: "Sword Steel",
        recipe: {
          output: { item: "Sword Steel", quantity: 1 },
          inputs: [{ item: "Steel", quantity: 5 }],
        },
      },
    ],
  },
];
assert.equal(
  K.researchRecipesFor({ name: "Steel" }, research).length,
  1,
  "Repeated creation and topic recipes are deduplicated",
);
assert.equal(
  K.researchRecipesFor({ name: "Sword" }, research).length,
  0,
  "Steel and normal weapons stay distinct",
);

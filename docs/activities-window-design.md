# TribeNet Manager — Activities Window & Skill-by-Skill Rollout

**Design version:** 0.1 — first draft  
**Updated:** 29 October 2026  
**Status:** Proposed design, not an implementation-complete claim  
**Related designs:** [Orders Workbook Lifecycle & Export Safety](orders-workbook-lifecycle-design.md), [Compendium](compendium.md), [Compendium Skill Dossier Baselines](skill-dossier-baselines.md).

## 1. Purpose

The Mapper's **Activities Window** is the interface for planning a selected unit's skill-linked activities and recipes. A player chooses a skill, sees only that skill's eligible activities/recipes, inspects their requirements, allocates workers, and saves the orders to the Mapper database for eventual workbook export.

The implementation is **incremental, one skill at a time**. Do not build every skill in one pass or expose a skill as fully supported simply because it appears in an existing catalogue. Each skill must be checked end-to-end before starting the next.

### Agreed principles

1. **Skill-driven scope:** Only activities linked to a skill and/or that skill's recipes are presented here. Other order types keep their appropriate specialist interfaces.
2. **Compendium consistency:** Each Compendium skill has a unique icon that is reused in Activities. The Compendium entry and rule data are reviewed and updated whenever activity support for that skill is added.
3. **Per-skill rules:** Level-zero availability, maximum workers, unit eligibility, resources, recipes and other conditions differ between skills. Hunting is an example of an activity available with level-zero Hunting.
4. **Multiple assignments:** A unit can perform several activities in the same turn, drawing from shared pools of workers and available goods, while observing individual skill/activity limits.
5. **Start-of-turn context:** Some skills depend on the unit's **location at the start of the turn** and the buildings/facilities in that area; use the required time snapshot, not automatically the unit's planned end position.
6. **Goods tribe:** A unit may use another unit's inventory when a goods tribe has been assigned by a **separate workflow**. Activity planning must honour that mapping for inventory lookup and reservations without introducing a second goods-tribe assignment UI here.
7. **Saved plan is authoritative:** The Mapper database owns the orders; export reads them but never clears them. A fresh blank Orders workbook is always used for each export.

## 2. Skill rollout contract — required for every new skill

A skill is considered ready only when all relevant items below are complete. Some rule categories can legitimately be 'not applicable', but this must be established for that skill rather than assumed.

| Area | Required per-skill work |
|---|---|
| Identity and assets | Canonical skill name/key, **unique skill icon**, full name, any aliases, matching Compendium article |
| Inputs and outputs | Identify all applicable consumed inputs and produced outputs; use their **existing item/goods icons** when available, adding icons when missing |
| Eligibility | Establish whether level 0 is allowed, which skill level applies (unit, tribe or mixed), prerequisite levels, research, unit type and other restrictions |
| Workforce | Maximum workers, cap grouping across recipes, workforce class, special exceptions, and actual available headcount |
| Geography and facilities | Whether the rule uses start-of-turn hex/terrain, buildings in the area, their capacity, season and other location restrictions |
| Inventory source | Which input inventory is authoritative: unit's own, assigned goods tribe's, or another explicitly verified skill-specific rule |
| Activity/recipes | Each supported variant, correct requirements, conversion/output rules, and workbook activity/item/distinction mappings |
| UI | Skill tile, hover name, Compendium eye link, skill-filtered recipe list, configuration popup, saved allocation summary |
| Compendium | Update the skill's article with the same eligibility, worker limits, recipes, inputs/outputs, modifiers and source links |
| Persistence and export | Save/edit/delete or source-derived order handling, reload after restart, re-export safety, no duplicates |
| Tests | Level-zero/boundary cases, cap, missing goods, buildings/start position, shared allocations, workbook output |

### Proposed implementation sequence

1. Select the **one skill** to implement and review its Mandate/Compendium rules and research unlocks.
2. Confirm the rule contract, including level-zero behaviour, skill owner, workers, starting location, buildings and inventory source. Where game documentation is ambiguous, flag the question before encoding a rule.
3. Add/reuse the shared **skill icon**; reconcile icons for its inputs and outputs with the item catalogue.
4. Update its Compendium dossier, linking relevant items, buildings, recipes, other skills, research and exact Mandate sections.
5. Implement the skill-specific activity/recipe definitions, calculations and eligibility checks behind a reusable validation interface.
6. Connect the activity UI, saved planning data and precise Orders workbook mappings.
7. Exercise its complete test matrix and regression-test already completed skills.
8. Only then classify that skill as **implemented and verified** and move to another skill.

This approach allows small releases and practical player testing of each skill rather than a large catalogue with inconsistent mechanics.

## 3. Activities Window — user interaction

### 3.1 Opening and context

Open **Activities** from the selected unit in Mapper. Display the active unit, canonical turn, relevant skill context and a summary of already allocated/available workforce. The window should remain tied to the selected unit/turn until deliberately changed; do not save into a different context by mistake.

A skill may use the unit's own skill level, its tribe's level, or a mixed rule. The window must identify the relevant source when presenting requirements.

### 3.2 Skill icons and Compendium navigation

- Every skill in the Compendium should eventually have its **own distinctive icon**, defined once in a shared skill-asset/identifier manifest. Do not maintain separate Compendium and Activities icon lists.
- Show the **skill icon and skill name** in the Activities Window. Hovering over the icon shows the full skill name.
- When hovering over a skill tile, reveal a **small eye icon at its top-right corner**. The eye is a separately clickable button that opens the Compendium **directly to that skill's entry** without selecting an activity.
- The eye also becomes available when the tile receives keyboard focus, so this feature is not hover-only. Provide accessible name and tooltip.
- Clicking the main skill tile **selects the skill** and displays **only matching activities/recipes**. The eye and tile must not share the same click action.
- Visually highlight the selected skill; selecting a different skill replaces the recipe list.
- An implemented skill can be eligible at level 0 when its rules say so. Do not automatically hide it because the unit lacks a positive skill level.
- A Compendium skill without an implemented assignable activity remains reference material; never present an editable generic order as if its rules were verified. A disabled/unimplemented state is acceptable if useful for discovery.

### 3.3 Skill-specific activities and recipes

After selection, show only activities and recipes belonging to the chosen skill. Each entry should show its name, optionally its output/recipe icon, existing allocation status and relevant availability explanation. Use the item catalogue's common icon for inputs/outputs whenever possible.

Preserve the initial sketch's optional filters:
- **Hide activities with insufficient skill.**
- **Hide activities with insufficient inputs.**

These are view-only filters within the selected skill. An entry can also be restricted by worker cap, facility, season, geography, missing research or unit type; show all applicable reasons before attempting to save. Viewing an unavailable recipe can still be useful to see its requirements. No filter may delete or alter saved orders.

For recipes requiring multiple skills, the recipe has a canonical primary activity/skill for grouping and workbook export, plus explicit secondary prerequisites. Whether to index the same recipe under more than one skill is a later presentation decision; never create duplicate orders because of alternate indexes.

### 3.4 Activity configuration popup

Clicking an activity/recipe opens a **draggable** popup, consistent with Mapper's other popups. It should provide:

- Skill icon, skill name, activity and chosen recipe/output variant.
- Relevant skill levels, their sources, minimum requirements, research unlocks and other modifiers.
- Start-of-turn location and required building/facility information **where relevant to this skill**, not a universal requirement.
- Inputs, consumption quantities, available goods source (own unit or assigned goods tribe), required non-consumed implements/tools and expected outputs.
- Where practical, **item icons** beside input and output goods.
- Worker allocation as a **slider and precise numeric input**, kept synchronized; show selected / free / maximum, and the reason for any lower limit.
- Estimated output and required input recomputed as the allocation changes, but only when verified formulas support the calculation. Label uncertain output appropriately.
- Existing saved quantities, Save, Cancel, and Edit/Remove when applicable. Closing or cancelling does not save a partial edit.
- Compendium navigation for the skill, with optional entity links for items and buildings.

**Save must revalidate** the allocation against current saved plan and constraints; a UI slider's limit alone is not sufficient protection. Do not silently reduce a user's requested worker number in order to make an invalid order pass.

### 3.5 Allocation overview

Provide an overview of all activities saved for the selected unit and turn, across the different skills: activity/recipe, assigned people, required resources, goods source and any validation problems. Display total workers committed and available workers remaining.

Where an activity is generated by a specialist planner (for example, scouting), show its reservation without allowing a duplicate manual activity to be created. Editing it should lead to its authoritative planner.

## 4. Rules and eligibility model

### 4.1 No one-size-fits-all skill rule

Every implemented skill declares:

- **levelSource:** unit / tribe / contextual mixed source;
- **minimumLevel or unlock rules:** including explicit level-zero access;
- **unitType / workforceClass:** who can perform it;
- **workerLimit:** none, per skill, shared across recipes, per recipe, facility-based or special rule;
- **locationRule:** whether to evaluate start-of-turn position, terrain, coastal access, season or other geography;
- **buildingRule:** facilities in the applicable area, required counts and capacity;
- **inventoryRule:** own unit / assigned goods tribe / special rule;
- **implements and inputs:** required, reserved versus consumed, and quantities;
- **output model:** yield or conversion with researched modifiers and uncertainty;
- **order mapping:** exact activity, item, distinction and supplemental workbook fields.

A missing rule must not default to a convenient permissive rule. A rule marked 'not applicable' should be an explicit determination.

**Hunting:** is a confirmed example that players may undertake with level 0. Higher skill can affect efficiency or output according to verified Hunting rules. Skill level zero must not be equated to unavailable.

**Worker limits:** Some skills have a cap; others do not, while others have a capacity determined by facilities. For shared caps, count workers already assigned to every relevant activity/recipe of that skill before accepting more. The current activity catalogue includes a 'shared per skill 10' mechanism for some skills, but its use must be verified individually; do not apply universally. Distinguish **maximum eligible workers** from **output per worker**.

### 4.2 Start-of-turn location and buildings

Some skills use the **unit's location at the start of the turn**, and the buildings/facilities present in that area, to determine whether an activity can take place and how productive it is.

- Store or reliably resolve the canonical **start-of-turn hex** for the unit and the appropriate turn's known area/building state.
- For those skills, evaluate conditions at that start hex even if a movement order later takes the unit elsewhere.
- A facility's presence is not automatically proof of free capacity: check the skill's relevant building quantity, capacity and any reservations.
- Distinguish a building's physical location from who owns it, and avoid assuming any unit may use it without a verified rule.
- If a newly created/split unit, transferred asset or building order changes the context, apply the actual effective timing specified by the relevant rule. Do not infer that a proposed end-of-turn structure can be used at turn start.
- If start location/building information is unknown or conflicting, show the uncertainty and block or warn according to the skill's verified requirements; do not silently use the selected screen's current hex.

Not every skill needs this check. Its inclusion is controlled per skill.

### 4.3 Goods tribe and inventory-source resolution

**Goods tribe** means a separately assigned source unit whose inventory another unit may use for activity requirements. **Assigning/managing that relationship is outside the Activities Window and will be designed separately**, but Activities must be compatible with it from the outset.

Required design:

1. Resolve the **effective goods tribe for the acting unit and turn** via the shared assignment data. In the absence of an assignment, use the acting unit's own inventory **unless that skill's verified rules say otherwise**. The default/fallback is a proposal to verify when the goods-tribe workflow is specified.
2. Display the resolved goods source in recipe details and saved allocation overview. Distinguish the **performing unit** (workers, skill and start location) from the **goods-source unit** (inventory).
3. Check inputs and required goods against the **goods source's effective inventory** for that turn and relevant order timing, subtracting any prior reservations/commitments by all units drawing from the same source.
4. Do not double count stock when multiple units use one goods tribe. Record reservations by canonical source unit, item, turn and timing; shared stock cannot be committed twice.
5. Treat consumables differently from required reusable implements, equipment and facility capacity. Item quantities, allocation and reuse must obey actual game rules.
6. A goods-tribe mapping grants a source for checks; it does **not by itself create a transfer**, move people, or change where an activity occurs. If the Mandate requires co-location/transfer/permission, enforce it as a separately verified condition.
7. Changes to goods-tribe assignment must cause affected activities to be rechecked; do not automatically delete planned orders or switch their source silently without showing the effect.
8. Keep the source mapping separate from the saved activity order, but save sufficient source identity/resolution metadata or revision references so the order can be audited and revalidated.
9. When mappings are invalid, missing, ambiguous or incompatible with the skill, explain the issue clearly and prevent invalid export. Preserve the user's saved draft for repair rather than erasing it.

**Illustrative case:** Unit A assigns workers to a recipe, but its assigned goods tribe is Unit B. The available ingredient stock comes from B, while skill level, eligible workforce, and relevant starting location come from the actual performing unit and/or its tribe as that skill prescribes. If Unit C also draws from B, A and C compete for B's remaining stock.

The future **goods-tribe assignment step** should provide a stable API and effective-turn semantics; this design must not invent a UI for it now.

## 5. Shared resources and validation

A single turn-level reservation/validation model covers all relevant activity allocations, including allocations originating outside this window.

- Track workers by unit, relevant workforce class and turn; account for existing saved activities and scouting/other planner reservations.
- Track consumable goods by actual inventory **source unit** (including assigned goods tribe), item and relevant timing.
- Track reusable tools/implements and capacity constraints separately rather than subtracting them like consumed goods.
- Track skill-specific worker limits, building capacity and any recipe-specific limits as separate restrictions.
- Account for planned same-turn transfers, splitting and unit creation according to their effective timing; do not allow stock/workers to be spent before becoming available.
- Every edit triggers revalidation of affected activities. Saving a different order must not erase a previously saved order that now conflicts; show a conflict and require resolution.
- Validate at presentation, save and export. Export cannot invent workers, goods or facility capacity to make an order fit.
- Use one canonical reservation source for a saved order to avoid double-counting any allocation that appears in several overviews.

## 6. Data and implementation integration

### 6.1 Existing structures to extend

The repository already includes **src/activity-catalog.js**, **src/activity-assignments.js**, Compendium skill profiles, item and Orders reference data, Mapper order management and the Orders workbook writer. These are starting points, **not evidence that all mechanics are complete**.

Prefer extending their reusable rules and catalogues rather than introducing a second, conflicting per-skill rules database in the Activities UI. Keep canonical keys for skill, activity, recipe/variant, performing unit, goods source, turn and saved assignment ID.

A skill's **implementation state** must be explicit: not yet reviewed / designed / implemented / verified. Compendium inclusion alone does not indicate an order planner is supported.

### 6.2 Persistence

- A saved assignment belongs to a canonical turn and performing unit, with activity/recipe identity, workforce allocation and other necessary order fields.
- Preserve distinct user-authored and source-derived records. Scouting remains derived from saved scouting parties; it must not be duplicated in the Activities Window.
- Keep legacy/manual activity orders readable and exportable during transition to skill-guided editing. Never delete them just because their skill is not yet implemented.
- Cancel/close without Save leaves the DB untouched.
- Reopening the window after navigation or app restart restores saved assignments.
- A changed goods source, starting-area snapshot or skill rule flags affected records for validation instead of silently rewriting them.

### 6.3 Orders workbook

Follow the separate **Orders Workbook Lifecycle & Export Safety** design without exception:

- Database = authoritative saved Mapper plan.
- Stored blank Orders workbook = turn-specific immutable template.
- Export = read-only consistent snapshot of that plan rendered onto a **fresh template copy**.
- Write the relevant **Tribes_Activities** rows using the exact validated worksheet mapping, including the required activity, item, distinction, people/workforce, implements and special fields when applicable. Any other applicable order sheet is handled by its dedicated planner.
- Re-export overwrites the **same** turn's file in **Exported Files/Orders_<turn>.xlsx** within the installation directory. Do not create numbered copies. Manual edits in the previous export are replaced, not imported.
- Export, scan, app restart and Results import must never clear activity allocations.

Scouting remains a special source-derived case: its activity is **PATROL** with **Item SCOUTING**, **Distinction NONE**, and any split-scout comment remains governed by the existing scouting design.

## 7. Compendium integration and assets

Each Compendium skill needs its own icon. Reuse that exact icon in the Activities Window, with the full name available as visible text and a hover tooltip. The eye action takes the player to the **matching skill article**, not just the Compendium home page.

As each skill is implemented, update its Compendium article to include:

- Core effect and whether it can be performed at **level zero**.
- Unit/tribe source of skill level, unlocks and prerequisites.
- Worker limits **separate from per-worker productivity**.
- Starting-hex, terrain, season and building requirements where applicable.
- Applicable inputs, outputs, implements and **their icons** (linked to the existing item catalogue).
- All supported recipes/variants; distinguish direct crafts from cases where the skill is only a secondary prerequisite.
- Research changes, exceptions, and source links to the current Mandate or research references.
- Links to relevant goods, buildings and other skills where Compendium entries exist.

The Compendium and activity logic should read the same verified structured rule definitions where feasible, while the article remains a readable explanation with citations. Do not parse article prose to compute game rules.

## 8. Per-skill acceptance checklist

For **every** newly added skill, demonstrate:

1. The Compendium and Activities Window show the **same unique skill icon**; applicable input and output goods have correctly matched icons.
2. Skill tile displays name; hover/focus reveals the eye; the eye opens the correct skill Compendium article without triggering selection.
3. Selecting the skill shows only its related activities/recipes.
4. A level-zero-allowed skill can be used at level 0; a restricted skill refuses ineligible levels with an understandable explanation.
5. The skill's maximum-worker rule is enforced, including across multiple recipes of the same skill where appropriate.
6. Multiple skills can be allocated together without exceeding the performing unit's shared workforce.
7. For location-dependent skills, availability and facility limits use the **unit's start-of-turn hex and area buildings**, not its planned end position.
8. For inventory-dependent skills, checks use the **assigned goods tribe's inventory** where applicable, and multiple units cannot reserve the same goods twice.
9. Required implements and consumable goods are handled according to their different rules.
10. Configuration calculations, saved records and Compendium description agree with the verified source.
11. Save, cancel, edit, remove, navigation and restart preserve correct plans without phantom/duplicate activity rows.
12. Orders export produces exact activity mappings, re-export replaces the same turn's file, and nothing about export changes the database plan.
13. Existing completed skills and specialist planners pass regression tests.

## 9. Implementation order and definition of done

Begin with the reusable **skill selector, shared icon registry, Compendium deep link, activity popup framework, validation interface and persistence adapter**. Complete the inventory-source abstraction and start-of-turn context abstraction early, even if first skills do not yet exercise every option. They must not be retrofitted separately into every subsequent recipe.

Then choose **one skill per implementation batch** (the precise sequence is a later decision). For each batch: agree its rules and icons, update its Compendium article, implement activities/recipes, wire DB and workbook export, test all boundaries, and verify existing activity functionality. The user can then test that specific skill before the next one.

## 10. Open design decisions

These are **not yet assumed rules**; resolve them while defining the affected workflow or skill:

- Which skill is first, and how many skills should appear as not-yet-supported tiles?
- Exact behaviour of the clear/no-skill selection state and whether multi-skill recipes appear under secondary skills.
- How a unit is assigned one or more goods tribes, effective-turn rules, authorization/ownership and what happens if the source changes. The assignment UI is a separate design.
- Whether a missing goods-tribe assignment always falls back to own inventory, or whether certain skills require an explicit goods-source setting.
- Which timing snapshot to use for resource quantities after transfers, newly made goods and other planned orders.
- For buildings: ownership/usage permissions, sharing of facility capacity and effect of planned building changes.
- What specific warnings should be non-blocking when the game outcome is intrinsically uncertain, versus hard validation failures.
- Per-skill handling for unit creation/splits, location-dependent activities and skill-ownership exceptions.

## 11. Existing code and gaps to verify

### Reusable foundation already present (not a completion claim)

- **src/activity-catalog.js:** Catalogue of activity codes, skill mapping, some level-zero flags and worker-limit types.
- **src/activity-assignments.js:** Normalization of manual activities and derived scouting reservations/comments.
- **src/compendium-*.js** and **docs/skill-dossier-baselines.md:** Skill articles/dossiers, rules descriptions and source references.
- **src/orders-workbook.js** and related export modules: Existing workbook creation and mapping flow.

### Bugs, missing features and verification still required

- A dedicated, skill-select-first Activities Window matching this design is **not yet established as complete**.
- Unique, shared skill-icon coverage and a verified Compendium eye/deep-link action need implementation/audit.
- Full per-skill recipe coverage and consistent input/output icons need phased implementation.
- Skill-specific **level-zero**, worker-cap and mixed tribe/unit-level validation must be checked for each new skill.
- Start-of-turn hex and area-building constraints need a reusable source, eligibility evaluator and tests.
- **Goods-tribe assignment** is a separate future step; source-resolution and **shared-stock reservation** in Activities must be implemented and verified against it.
- Cross-planner workforce/stock/facility reservation and conflict handling require end-to-end tests.
- Saved edit/cancel/reload and workbook export must be regression-tested for every added skill, including re-export safety and preservation of legacy orders.
- Existing skill dossier and activity-catalog rules may require reconciliation against the latest Mandate/research before being treated as authoritative.

---

**Design rule:** A skill is not 'done' merely because its icon appears. It is done only when its Compendium entry, icons, rule checks, start-location/building and goods-source behaviour (when applicable), worker/resource allocation, saved orders and workbook export agree and have been tested.

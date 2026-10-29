# TribeNet Manager — Activities Window & Skill-by-Skill Rollout

**Design version:** 0.3 — three-menu navigation clarified  
**Updated:** 29 October 2026  
**Status:** Proposed design, not an implementation-complete claim  
**Related designs:** [Orders Workbook Lifecycle & Export Safety](orders-workbook-lifecycle-design.md), [Compendium](compendium.md), [Compendium Skill Dossier Baselines](skill-dossier-baselines.md).

## 1. Purpose

The Mapper's **Activities Window** is a **three-menu workflow** for planning a selected unit's skill-linked activities and recipes. **Menu 1** lists skills; clicking one opens **Menu 2** with everything that skill can do; clicking an activity or recipe opens **Menu 3** for actual worker/goods allocation and saving to the Mapper database for workbook export.

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
| UI | **Three separate menus:** skill list (with icons, names and Compendium eye), selected skill's activities/recipes, final allocation editor; separate saved allocations overview |
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

## 3. Three-menu Activities workflow — user interaction

The Activities interface is a **three-step, hierarchical workflow**. Each menu has one responsibility. Do **not** combine the skill list and activity/recipe list in the initial menu.

```text
Selected unit → Activities
        │
        ▼
┌───────────────────────────────┐
│ MENU 1 — SKILLS               │
│ List of skills for this unit  │
│ [Skill icon + skill name] [👁]│
└───────────────┬───────────────┘
                │ click skill
                ▼
┌───────────────────────────────┐
│ MENU 2 — ACTIVITIES / RECIPES │
│ Everything supported by       │
│ the one selected skill        │
│ [activity] [recipe] [recipe]  │
└───────────────┬───────────────┘
                │ click activity / recipe
                ▼
┌───────────────────────────────┐
│ MENU 3 — ALLOCATION           │
│ Workers, goods, tools,        │
│ buildings, input and output   │
│ [Cancel] [Save]               │
└───────────────────────────────┘
```

The eye icon is a **shortcut from Menu 1 directly to the relevant Compendium article**, not a fourth allocation step. The separate saved-activities overview shows existing allocations across skills; it is an overview/shortcut, not an additional mandatory step.

### 3.1 Opening Activities / shared context

Selecting a unit and opening **Activities** always opens **Menu 1 — Skills**, not a preselected recipe list. Use the existing/established skill identification, ownership, eligibility and visibility logic, extending it only where per-skill verification requires. The active turn and performing unit remain associated with all subsequent menus.

Shared worker availability and effective inventory reservations remain current regardless of which menu is open. A skill may use unit-level, tribe-level or mixed proficiency depending on its verified rule.

### 3.2 Menu 1 — Skills list

**Purpose:** Choose **which skill** to work with.

- Display **only a list/grid of skills**, with each skill's shared icon and **visible full skill name**, following established skills logic. No recipes, activities, inputs/outputs or worker slider appear in this first menu.
- Hovering a skill icon shows its full name. On hover, reveal a **small eye button at the top-right of the skill tile/icon**, also accessible on keyboard focus. Clicking the eye opens **that skill's Compendium page directly** and **does not select the skill or open Menu 2**.
- Clicking anywhere else on a selectable skill opens **Menu 2 — Activities / Recipes**, scoped to that skill. The current skill is named in the second menu's title/breadcrumb.
- Skill availability is **per skill**, not automatically dependent on owning level > 0. A level-zero-eligible skill such as **Hunting** must remain available under its verified conditions.
- Skills with no completed allocation support must never imply fully functioning orders: they may be shown as clearly **Not implemented** or unavailable for selection, consistent with established visibility rules.
- Optional search/group navigation can reuse established skill-list logic rather than inventing an unrelated selection model. Preserve the direct skill/Compendium association.

### 3.3 Menu 2 — Selected skill's activities and recipes

**Purpose:** Browse **everything the selected skill can do**, including applicable individual activities, recipes, output variants and other verified skill actions.

- **Only the selected skill's activities/recipes** are shown. No other skill tiles are mixed into this menu.
- Show a clear title and breadcrumb such as **Skills → Forestry**, plus a **Back to Skills** control.
- Present activities/recipes as rows or cards with an output/activity icon, human-readable name, relevant requirements, current allocation status and any reason they are unavailable.
- This menu may show summarized worker limits, minimum level (including level-zero eligibility), required items and their **resolved goods tribe**, start-of-turn terrain/building rules and a status indicator. Detailed quantities are **configured only in Menu 3**.
- Maintain the planned **Hide activities with insufficient skill** and **Hide activities with insufficient inputs** visibility filters within this menu. Filters must never modify or remove saved orders. Other restrictions (worker cap, unit type, facilities, geography, research) remain explainable.
- **Clicking an activity or recipe opens Menu 3 — Allocation**, carrying its canonical skill, activity/recipe ID, selected performing unit and turn.
- An unimplemented recipe is visibly marked and does not offer unverified allocation. Viewing its known prerequisites for reference may still be useful.
- A recipe requiring several skills has a canonical order identity and a primary skill grouping with secondary prerequisites; never duplicate an order merely because a recipe is linked from more than one skill.

### 3.4 Menu 3 — Final activity allocation

**Purpose:** Configure the selected activity and save its actual order.

- Opens only after an activity/recipe is chosen from **Menu 2**, or when editing an existing saved order via its authoritative overview.
- Show **Skills → [Skill] → [Activity/recipe]** breadcrumb and **Back to Activities / Recipes**. Back preserves the selected skill and other saved plans; it does not save a partially edited allocation.
- Use a **draggable** popup or equivalent focused third-menu surface, consistent with Mapper popups.
- Show performing unit, turn, skill level/source and selected activity/recipe with any additional prerequisite levels.
- Where relevant, show the **performing unit's start-of-turn hex**, area terrain and available buildings/capacity. These checks are independent of planned end-of-turn movement.
- Show required consumable inputs, reusable implements/tools, available stock/reservations **from the effective goods tribe or own inventory**, plus all outputs and their correct item icons.
- Provide a worker **slider and precise numeric input** in sync, showing assigned workers, total pool remaining and skill/activity/facility caps. Some skills have **no skill-specific worker limit**; others have special rules.
- Recompute required inputs and predictable outputs when allocation changes using **verified per-skill formulas**, distinguishing estimated/variable from guaranteed results.
- Save, Cancel, Edit and Remove actions as applicable. **Save revalidates all constraints** against the latest plan before persisting. Cancel, Back or closing this menu never saves partial changes or clears other assignments.
- The Save action returns to **Menu 2 for the same selected skill** with updated allocation/status, allowing another recipe to be planned. The user can then go Back to Skills to choose another skill.
- When an order originates in a separate authoritative planner (e.g. scouting), edit via that planner rather than duplicating or overriding its derived reservation.

### 3.5 Back navigation and saved activities overview

**Expected navigation:**

| Action | Behaviour |
|---|---|
| Open Activities on a selected unit | Open **Menu 1 — Skills** for that unit/turn. |
| Click a skill (not the eye) | Open **Menu 2 — Activities/Recipes** for that skill. |
| Click an activity/recipe | Open **Menu 3 — Allocation** for that specific action. |
| Save from Menu 3 | Persist one validated activity order; return to **Menu 2**, keeping the selected skill. |
| Back/Cancel from Menu 3 | Return to **Menu 2** without saving in-progress edits. |
| Back from Menu 2 | Return to **Menu 1**; saved orders remain unchanged. |
| Click eye from Menu 1 | Open that skill's Compendium entry without changing activity selections. |
| Open saved-activities overview | View saved allocations **across all skills**; an Edit shortcut may open Menu 3 directly with the existing order loaded, while still exposing a path back to its skill's Menu 2. |

The separate saved-activities overview shows the unit's complete activity plan across multiple skills, including workers, required goods, source unit, validation state and any source-derived reservations. Totals count each worker and reservation once. Editing specialist-planner-derived activity rows navigates to their authoritative planner.

## 3A. Visual design — three distinct menus and tables

These **rendered wireframes** are design illustrations, not app screenshots. Names, recipes, worker caps, resource quantities and status examples are placeholders and **not authoritative game rules**. Each new skill is verified and implemented independently.

### 3A.1 Menu 1 — Skills only

![First Activities menu: list of skills with each unique icon and visible name; the eye shortcut opens the Compendium; no recipe table or allocation control is present.](assets/activities-window-wireframe.svg)

**Layout:** A dedicated selected-unit skills list, matching the established skills logic. Each row/tile includes the shared Compendium skill icon, full name, relevant availability/implementation indicator and the top-right hover/focus **eye** control. Clicking a skill opens the next menu. **This menu contains no activities, recipes, goods tables or allocation sliders.**

**Skills list table/tile fields:**

| Field | Design |
|---|---|
| Skill icon + name | Unique shared icon, full visible name and hover tooltip. |
| Level / accessibility | Follow existing skills logic and per-skill level-zero exceptions; do not equate level 0 to unavailable. |
| Implementation status | Distinguish supported selectable skills from future skills not yet ready to allocate. |
| Compendium eye | Small icon at the tile's top-right on hover/focus; **opens the matching skill article only**. |
| Main selection action | Clicking row/tile outside the eye **opens Menu 2 for that skill**. |

### 3A.2 Menu 2 — Activities and recipes for one skill

![Second Activities menu: Forestry activities and recipes only, requirements and available goods summaries, worker limits, status, and action to open Menu 3.](assets/activities-recipe-menu-wireframe.svg)

The selected skill occupies the title/breadcrumb; the entire content below belongs to that one skill. The recipe/activity list may combine cards and a comparison table, but **it is a separate menu from the skills list**.

**Activity/recipe table:**

| Column | Content |
|---|---|
| Activity / recipe | Name with output/activity icon; clicking the row opens **Menu 3**. |
| Requirements | Short level, research, unit, start-hex, building or other requirement summary; show restrictions clearly. |
| Inputs / goods source | Main inputs with item icons and the **resolved goods tribe** if applicable; a summary only (full inventory table is in Menu 3). |
| Worker limit | Skill/recipe/facility cap or “No skill cap” if verified; consider allocations already made to this skill. |
| Status | Available, Missing goods, Missing skill, Missing facility, Worker cap, Not implemented, Needs review or similar, with detail on inspection. |
| Open | Clear row action to open the **final allocation menu**; unavailable recipes may remain inspectable for requirements but cannot be saved invalidly. |

The two hide filters act only on **Menu 2's** activity/recipe list. They do not remove a skill from Menu 1 or change saved orders.

### 3A.3 Menu 3 — Final allocation popup

![Third Activities menu: worker slider, performing unit and start-of-turn building context, goods tribe inventory, input and implement table, output table, and Save or Cancel.](assets/activities-allocation-popup-wireframe.svg)

The third menu is the **only place where a new activity allocation is entered**. Its input/output tables stay focused on the **single chosen activity/recipe**.

**Inputs and implements table:**

| Column | Meaning |
|---|---|
| Item | Item icon and canonical goods/implement name; distinguish consumed inputs from reusable tools. |
| Goods source | Own inventory or **assigned goods tribe**, depending on the separately managed source assignment. |
| Stock | Quantity at the source at the relevant effective turn/timing. |
| Reserved | Quantity already committed by all activities and units using this source. |
| This order | Required quantity for the proposed worker allocation and recipe. |
| Remaining / rule | Consumable availability or reusable-equipment/capacity rule; show shortages, not a misleading zero. |

**Outputs table:**

| Column | Meaning |
|---|---|
| Output | Item icon and product name; support more than one output. |
| Estimated quantity | Verified per-skill yield calculation based on worker count, skill, equipment and relevant local modifiers. |
| Rule / certainty | Clearly distinguish guaranteed, expected/variable and not-calculable quantities. |

The header must distinguish **performing unit**, its **start-of-turn location/buildings** when relevant, and the **goods tribe** that supplies inventory. Goods tribe assignment is managed elsewhere and never silently changed here. The slider and numeric entry reflect the shared workforce and all applicable caps. Save must validate again against the saved turn snapshot.

### 3A.4 Saved activities overview — separate from the three menus

![Saved Activities overview: cross-skill rows showing performing unit, workers, goods source, inputs, output and status, including read-only derived scouting reservation.](assets/activities-overview-table-wireframe.svg)

This is a **cross-skill summary**, not Menu 1 or Menu 2; users can review allocations without having to traverse every skill.

| Column | Meaning |
|---|---|
| Skill / activity | Skill, activity/recipe and icon; denote manually saved vs derived orders. |
| Unit | Performing unit, not goods-source unit. |
| Workers | Allocated workers with workforce class where needed. |
| Goods source | Own unit, assigned goods tribe or not applicable. |
| Reserved inputs | Ingredient/item summary; inspect specifics in Menu 3. |
| Expected output | Verified estimate or an explicit uncertainty label. |
| State | Valid, Needs review, Blocked or derived/linked, plus reasons. |
| Action | Edit/Remove for manual orders; View in authoritative planner for derived orders. |

### 3A.5 Interaction and consistency

| Element | Required behaviour |
|---|---|
| Skill identity | Same unique icon in Compendium and Menu 1, always with visible skill name. |
| Menu separation | **Menu 1 = skills. Menu 2 = activities/recipes for one skill. Menu 3 = allocation for one activity.** |
| Hover/focus | Compendium eye available on hover and keyboard focus in **Menu 1** only; accessible and separate from row selection. |
| Status | Text plus icon/colour; distinguish skill, goods, location/building, worker capacity and implementation restrictions. |
| Numeric information | Right-align quantities, show units, preserve precision and display unknown data as unknown rather than 0. |
| Layout | Responsive and draggable as appropriate; long tables scroll with accessible headers rather than hiding essential columns. |
| Back/save | Back never creates an order; Save from Menu 3 returns to Menu 2 for the same skill. |
| Stored orders | Navigation and filters never clear saved allocations. Revalidate if the goods tribe, turn, location or other shared plans change. |

All three menus and the optional overview must use the same canonical IDs, verified rules, shared icon assets and saved Mapper orders. Implement each skill end-to-end before allowing its activity rows to save.

---

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
2. **Menu 1 lists skills only**, each with icon and name; hover/focus reveals the eye, which opens that skill's Compendium article without triggering selection.
3. Clicking a skill opens a **separate Menu 2** containing only that skill's activities/recipes; clicking one opens **Menu 3** to allocate workers and goods. Save returns to Menu 2 without losing other activities.
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

Begin with the reusable **three-menu navigation framework (skills → activities/recipes → allocation), shared icon registry, Compendium deep link, validation interface and persistence adapter**. Complete the inventory-source abstraction and start-of-turn context abstraction early, even if first skills do not yet exercise every option. They must not be retrofitted separately into every subsequent recipe.

Then choose **one skill per implementation batch** (the precise sequence is a later decision). For each batch: agree its rules and icons, update its Compendium article, implement activities/recipes, wire DB and workbook export, test all boundaries, and verify existing activity functionality. The user can then test that specific skill before the next one.

## 10. Open design decisions

These are **not yet assumed rules**; resolve them while defining the affected workflow or skill:

- Which skill is first, and how many skills should appear as not-yet-supported tiles?
- Exact empty states in Menu 1/2 and whether multi-skill recipes appear under secondary skills.
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

- A dedicated **three-menu** Activities interface (skill list → per-skill activities/recipes → final allocation) is **not yet established as complete**.
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

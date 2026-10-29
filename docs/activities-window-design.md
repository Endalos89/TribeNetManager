# TribeNet Manager — Activities Window & Skill-by-Skill Rollout

**Design version:** 0.4 — compact icon-grid browsing menus  
**Updated:** 29 October 2026  
**Status:** Proposed design, not an implementation-complete claim  
**Related designs:** [Orders Workbook Lifecycle & Export Safety](orders-workbook-lifecycle-design.md), [Compendium](compendium.md), [Compendium Skill Dossier Baselines](skill-dossier-baselines.md).

## 1. Purpose

The Mapper's **Activities Window** is a **three-menu workflow** for planning a selected unit's skill-linked activities and recipes. **Menu 1** is a compact multi-column grid of skill icons with names beneath; selecting a skill opens **Menu 2**, another compact icon grid of that skill's activities and recipes; selecting an activity opens **Menu 3** to allocate workers/goods and save to the Mapper database for workbook export. Recipe/rule browsing stays in the Compendium, not in a separate details panel.

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
| UI | **Three separate menus:** compact icon grid of skills (name below icon, Compendium eye), compact icon grid of selected skill's activities/recipes (name below icon), final detailed allocation editor; grey/red statuses and hide toggles; separate saved allocations overview |
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

## 3. Activities — three-menu navigation and compact icon views

The Activities workflow is **three distinct menus**, with no combined skill/recipe browser:

```text
Selected unit → Activities
  └─ MENU 1 — Skills icon grid
       └─ Click skill → MENU 2 — Selected skill's activities/recipes icon grid
            └─ Click activity or recipe → MENU 3 — Allocation editor
                 └─ Save → MENU 2 (same selected skill)

Compendium eye on a skill icon → That skill's Compendium entry
Back from Menu 3 → Menu 2; Back from Menu 2 → Menu 1
```

**Menus 1 and 2 use a compact File Explorer-style grid** (multiple columns and rows). Icons appear **above** their names, not alongside them in large list rows. **Menu 3** remains the detailed allocation view. A separate cross-skill saved-activities overview is a shortcut for managing existing orders, not a fourth required menu.

### 3.1 Shared context and icon-grid rules

Open Activities from the selected Mapper unit at **Menu 1**. Carry the same unit, canonical turn, existing saved orders and calculated reservations through all three menus.

**Common icon-grid design for Menus 1 and 2:**

- Compact, uniformly sized icon tiles arranged **left to right, wrapping into multiple columns and rows**, similar to File Explorer's medium/large icon view. Target approximately **six columns at the illustrated desktop width**, with responsive column count as the window changes size; avoid the former full-width rows and large cards.
- Each tile displays **one icon at the top and a readable name underneath**. There is no permanent paragraph of metadata or detailed information panel inside a tile.
- Long names should wrap to a sensible second line or truncate with the full name available on hover and keyboard focus. Grid tile spacing and keyboard navigation must remain consistent.
- **Normal icon:** available under the current rules. **Greyed-out icon/name:** lacks the required skill or required skill level. **Red-tinted/red icon/name:** lacks required input goods. Two independent checkboxes, **Hide lacking skill** and **Hide lacking inputs**, can hide those tiles **in either Menu 1 or Menu 2**.
- Colour is never the sole signal: each restricted tile has an accessible status name (and an unobtrusive indicator/tooltip). The filters operate on eligibility classification, not on colour alone.
- If **both** skill and input are missing for one option, classify it as **lacking skill (grey)** first; once the skill condition is met, show **missing input (red)** if it remains relevant. This prevents an unattainable recipe appearing merely as a stock shortage.
- A tile with **at least one currently usable activity** remains normal even if some of its other activities/recipes are blocked. In Menu 1, grey a skill only when no implemented activity is skill-eligible; red it only when at least one is skill-eligible but all otherwise-permitted activities require unavailable inputs. Do not turn an entire skill red solely because one of several recipes lacks goods.
- Other blockers (e.g. start-hex buildings, terrain, special worker limits, research or an unimplemented skill) are **not mislabelled** as a missing skill or missing goods. Use a discreet separate unavailable/planned indicator if required, with exact rules explained by the Compendium and save validation. Never allow an invalid assignment to be saved.
- For resources, determine missing inputs using the **actual effective inventory source** — the acting unit or its assigned goods tribe — with shared reservations accounted for. Do not infer a shortage from the acting unit's inventory when a goods tribe supplies that activity.
- **Level-zero exceptions are rule-driven**: e.g. Hunting at level 0 must not be greyed out merely because its skill level is zero.
- Changing a filter affects **display only**, never deletes, alters or unallocates saved orders. If filtering leaves no tiles, explain the empty state and allow filters to be cleared.

### 3.2 Menu 1 — Skills icon grid

**Purpose:** Select the skill. **Only skills appear here** — no activities, recipes, ingredient table or allocation controls.

- Populate the icons using **established skill-list/ownership/availability logic**, reconciled per skill. The implementation state is separate from the player's skill level.
- Every skill uses its **unique shared Compendium icon**, displayed above its full name. Hovering reveals its full name.
- A **small eye** appears in the top-right of the hovered/focused skill tile. Clicking it **opens that skill directly in the Compendium**, without selecting the skill or entering Menu 2. The eye is keyboard accessible with an explicit label.
- Clicking anywhere else on a skill tile opens **Menu 2**, scoped to that skill. Grey/red may communicate current inability to perform activities, but the tile can still be selected to see which activities exist; no invalid allocation can be saved. The eye remains accessible even on an unavailable skill.
- Both **Hide lacking skill** and **Hide lacking inputs** toggles are available above the grid. Skills hidden by either toggle may be restored by switching the filter off.
- A skill with no implemented activity should be clearly **Planned / Not implemented**, not deceptively shown as lacking player skill; it cannot create orders until verified.

### 3.3 Menu 2 — Activities and recipes icon grid

**Purpose:** Select **what to do with the chosen skill**.

- Show **only activities and recipes associated with the selected skill** in the same compact, multi-column icon grid as Menu 1. Use item/output icons when appropriate, with names **underneath**.
- Top navigation displays **Back to Skills**, the selected skill name, and both filter toggles.
- **Grey out** individual recipes/actions lacking a requisite skill or level; **show red** those whose required inputs are unavailable from the applicable own/goods-tribe inventory; normal styling for currently available items. Apply the same priority rules and level-zero exceptions as Menu 1.
- An available activity/recipe may have a small, unobtrusive **already allocated** marker, not a large row or status panel.
- **Do not display a comparison table, requirements sidebar, details pane, or hover information card here.** Browsing the detailed descriptions, mechanics, prerequisites and full recipes belongs in the **Compendium**. Keep concise tooltips to the icon's name/status; they do not replicate the Compendium article.
- Clicking an activity/recipe opens **Menu 3 — Allocation** for that specific choice. A blocked recipe may still be opened to inspect allocation constraints, but saving remains unavailable until requirements are met; full reference material stays in Compendium.
- Recipe identities and secondary skill prerequisites must be stable and deduplicated so an item listed under multiple related skills never creates duplicate orders.
- The two hide filters on Menu 2 affect only its grid. Filter states may be retained while navigating back/forward for convenience and must never alter saved orders.

### 3.4 Menu 3 — Final allocation editor

**Purpose:** Configure **one** chosen activity/recipe, then save an order.

Keep the detailed popup/table design. This is the place for **worker slider + precise numeric input**, required consumables, implements, stock available/reserved, expected outputs, effective goods tribe, and relevant start-of-turn hex/buildings. All detailed quantities and allocation calculations stay here rather than cluttering Menus 1 and 2.

- Header/breadcrumb: **Skills → [Skill] → [Activity/Recipe]**, with Back to the selected skill's Menu 2.
- Show performing unit, turn, relevant skill levels/ownership and source of goods. For applicable skills, check start-of-turn location and area facilities independently of the planned end location.
- Update worker constraints and relevant input/output calculations live from verified per-skill rules; do not present unverified or uncertain yields as guaranteed.
- **Save** revalidates against the database snapshot and all shared workforce, goods and capacity reservations; successful save returns to **Menu 2**, keeping the skill selected and its allocation marker current.
- **Back/Cancel/Close** discard unsaved edits only. They do not delete existing orders or change the goods tribe assignment. A derived order such as scouting must still be edited in its authoritative planner.

The Compendium remains the authoritative **browsing/reference surface** for explanatory information; Menu 3 contains only the information needed to **make and validate an actual allocation**, with a way to open the corresponding Compendium article when appropriate.

### 3.5 Navigation and saved activities overview

| User action | Result |
|---|---|
| Open Activities for a unit | Open **Menu 1 — Skills icon grid**. |
| Click a skill icon/name (not the eye) | Open **Menu 2 — compact grid of that skill's activities/recipes**. |
| Click the eye on a skill | Open **that skill's Compendium article**, without triggering Menu 2. |
| Click an activity/recipe icon | Open **Menu 3 — allocation editor** for that action. |
| Save from Menu 3 | Save validated allocation; return to **Menu 2** for the same skill. |
| Back/Cancel from Menu 3 | Return to Menu 2 **without saving** the unfinished edit. |
| Back from Menu 2 | Return to Menu 1, preserving saved orders. |
| Toggle either hide filter | Remove/show matching unavailable **tiles only**, without changing orders. |
| Open the separate saved-activities overview | Show allocations across all skills; Edit opens the appropriate allocation editor, or a specialist planner for derived orders. |

The separate saved-activities overview can remain a **detailed cross-skill table** of existing allocations, inputs and source units; it is not a browsing/recipe-details pane. Derived scouting workers and shared goods reservations count only once.

## 3A. Visual design — compact grids and allocation tables

These **rendered wireframes** are proposals rather than screenshots of app functionality. Named skills and example recipes show the intended layout but are **not assertions about actual available recipes, eligibility or output amounts**.

### 3A.1 Menu 1 — Skills, File Explorer-style icon view

![Compact six-column grid of skills, each with a distinctive icon above its name; Forestry shows the Compendium eye on hover. Some skill tiles are grey for missing skill, red for missing inputs, and two hide toggles are visible.](assets/activities-window-wireframe.svg)

- Multiple columns and rows with a compact, consistent tile footprint; no full-width skill rows.
- Every tile has the **shared skill icon above its name**, a status colour if needed, and an **eye in the top-right on hover/focus** for Compendium navigation.
- Both hide toggles are above the grid. For a skill with a mixture of recipe statuses, display normal styling if at least one implemented activity is usable, and show per-recipe limitations in Menu 2.

### 3A.2 Menu 2 — Activities/recipes, File Explorer-style icon view

![Compact six-column grid of activities and recipes for the one selected skill, with icon above name, grey and red unavailable examples, and no recipe detail table or sidebar.](assets/activities-recipe-menu-wireframe.svg)

- Same icon view as Menu 1: compact **icon on top, name below**, wrapping over multiple rows.
- Grid shows **only the selected skill's activities and recipes**. Grey means insufficient skill; red means lacking input goods; independent toggles can hide each.
- **No browsing comparison table, requirements panel or recipe description sidebar.** The Compendium owns full reference/browsing information.
- Clicking the icon opens Menu 3 to allocate workers and resources. Already-allocated items may have a tiny indicator.

### 3A.3 Menu 3 — Allocation popup and detailed tables

![Third menu: worker slider, performing unit and start-of-turn building context, goods tribe inventory, input and implement table, output table, and Save or Cancel.](assets/activities-allocation-popup-wireframe.svg)

**This is where detailed data belongs**, not in either icon grid.

**Inputs / required implements:**

| Column | Meaning |
|---|---|
| Item | Existing canonical item icon and name. Distinguish consumable goods and reusable implements. |
| Goods source | Acting unit or separately assigned **goods tribe**; assignment is managed in another workflow. |
| Stock | Effective inventory available at the source for this turn/timing. |
| Reserved | Quantity committed by every saved order using the same stock source. |
| This order | Required quantity for the current proposed allocation, recalculated with worker count. |
| Remaining / rule | Remaining consumables, or applicable reusable-equipment/capacity constraint; identify shortages. |

**Outputs:**

| Column | Meaning |
|---|---|
| Output | Canonical item icon and name, including multiple outputs when applicable. |
| Estimated quantity | Calculated from verified recipe/skill formula, workforce and applicable modifiers. |
| Rule / certainty | Guaranteed, estimated/variable or not calculable; state limitations clearly. |

The worker slider and precise input share a value and enforce skill-specific limits, total unit workers, facility capacity and other relevant rules. Show the **performing unit** separately from the **goods tribe** and the skill's **start-of-turn area/building** requirements.

### 3A.4 Saved activities overview — separate management table

![Saved Activities overview: cross-skill rows showing performing unit, workers, goods source, inputs, output and status, including read-only derived scouting reservation.](assets/activities-overview-table-wireframe.svg)

Unlike the two browsing menus, the saved-activities overview is a **management view** for reviewing existing allocations across skills. It can retain a traditional table.

| Column | Meaning |
|---|---|
| Skill / activity | Name and icon with manual/derived distinction. |
| Performing unit | Acting unit, not automatically the goods tribe. |
| Workers | Saved allocation, counted once per source. |
| Goods source | Own unit, assigned goods tribe or N/A. |
| Reserved inputs | Summary of planned material commitment. |
| Expected output | Supported estimate or a clear uncertainty label. |
| State | Valid, blocked, needs review or linked/derived, with reason available. |
| Action | Edit/Remove for manual orders, View for a specialist planner's derived order. |

### 3A.5 Icon view and status presentation

| Element | Visual/interaction contract |
|---|---|
| Tile layout | Uniform icon tiles in multiple columns/rows, with icon **above** the name; approximately 6 columns at desktop mockup width, responsive elsewhere. |
| Normal | Standard icon and text when at least one available action is possible (for Menu 1) or the selected action is available (Menu 2). |
| Insufficient skill | **Greyed-out** icon/text; hide with **Hide lacking skill**. Check actual per-skill level-zero eligibility first. |
| Insufficient input | **Red** icon/text; hide with **Hide lacking inputs**. Resolve stock from assigned goods tribe/own inventory first. |
| Both conditions | Grey (skill deficiency takes priority) until skill requirement is met; never double-label ambiguous availability. |
| Other blockers | Explicit distinct status, without falsely using skill-grey or input-red. Full rules remain in Compendium. |
| Compendium eye | Appears at top-right **of a skill tile on hover/focus**; separate click target from selecting that skill. |
| Browsing content | Menu 1 = skills only; Menu 2 = activities/recipes only; **neither uses a details table/sidebar**. |
| Allocation | Menu 3 alone presents detailed workers, inputs/outputs and validation. |
| Saved orders | Management overview may remain tabular; icon filters and navigation never change saved orders. |
| Accessibility | Tooltips/labels reveal full names and status, keyboard focus works, accessible controls do not rely solely on colour. |

These wireframes are the common layout. During each incremental skill implementation, verify the shared icon, individual recipe status, level-zero rule, worker limit, starting-area/building requirements, effective goods tribe, persistence and Orders workbook export.

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
2. **Menu 1 shows only skills in a compact multi-column icon grid**, each with icon above its name; hover/focus reveals the Compendium eye without triggering selection.
3. Clicking a skill opens a **separate Menu 2** showing that skill's activities/recipes as a matching compact icon grid, without a details table/sidebar; clicking one opens **Menu 3** to allocate workers and goods. Save returns to Menu 2 without losing other activities.
4. Both icon menus show **grey for insufficient skill** and **red for missing input goods**, with independent toggles to hide each; validate level-zero eligibility and assigned goods-tribe inventory first.
5. A level-zero-allowed skill can be used at level 0; a restricted skill refuses ineligible levels with an understandable explanation.
6. The skill's maximum-worker rule is enforced, including across multiple recipes of the same skill where appropriate.
7. Multiple skills can be allocated together without exceeding the performing unit's shared workforce.
8. For location-dependent skills, availability and facility limits use the **unit's start-of-turn hex and area buildings**, not its planned end position.
9. For inventory-dependent skills, checks use the **assigned goods tribe's inventory** where applicable, and multiple units cannot reserve the same goods twice.
10. Required implements and consumable goods are handled according to their different rules.
11. Configuration calculations, saved records and Compendium description agree with the verified source.
12. Save, cancel, edit, remove, navigation and restart preserve correct plans without phantom/duplicate activity rows.
13. Orders export produces exact activity mappings, re-export replaces the same turn's file, and nothing about export changes the database plan.
14. Existing completed skills and specialist planners pass regression tests.

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

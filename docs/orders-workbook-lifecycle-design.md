# TribeNet Manager — Orders Workbook & Turn Planning Lifecycle

**Design specification:** v1.0 (proposed; not implemented)  
**Date:** 27 October 2026  
**Repository:** Endalos89/TribeNetManager  
**Review basis:** code on main at the time of writing (release v0.1.757), earlier scouting/export requirements and observed data-loss reports.  
**Scope:** blank Orders retrieval; all Mapper / turn-planning inputs; persisted drafts; workbook export; completed Orders import; file-library reconciliation; Results hand-off; protection and recovery.

> **Non-negotiable invariant:** The database holds the user's intended orders. Export is a read-only projection of a consistent database snapshot onto a **fresh copy** of a stored blank Orders workbook. Exporting, opening, viewing, indexing, importing a reference workbook or scanning a folder must never delete or replace intended orders.

## 1. Purpose and the confirmed regression

The expected workflow is **Get blank Orders from Ravenpost → save immutable blank template for planning turn → create/edit orders in Mapper, committing each action to the database → Export Orders → copy the blank template and populate it from the database → open the generated workbook**. Repeat Export Orders at any time: every export starts from the *same blank template* and reflects the latest saved state, not changes present in a previously exported file.

### Confirmed destructive code path

There are two paths which read a Completed Orders workbook:

1. **Explicit import** in src/main.js (saveCompletedOrders): this path currently saves a parsed reference and was amended not to clear the Mapper draft.
2. **Automatic file-library scan** in src/turn-file-library-ipc.js (performSync): this path watches the Completed Orders directory, parses changed files and still calls clearDraftPlanning(turnManagerDatabase, parsed.turnKey). That helper deletes planned activities, unit splits and planned movement/scouting routes. It does not need a user-initiated import.

The file library scans on application ready and at approximately eight-second intervals while the launcher is displayed (src/turn-file-library-ui.js). The exporter writes a completed workbook into the scanned directory (src/orders-export-path.js). Therefore **Export → changed file detected by scanner → clearDraftPlanning → orders disappear** is a concrete, code-supported sequence. It may appear delayed or intermittent depending on UI location and scan timing. This is a confirmed unsafe path, not proof of every observed missing order; other issues require tests too.

**Urgent engineering priority:** remove all destructive effects from automatic Completed Orders discovery, isolate generated drafts from submissions, and add the export→scan→reopen no-loss test **before** trusting further exports. The present document defines the target; it does not claim the bug has been patched.

## 2. Definitions and sources of truth

| Concept | Meaning | Owner | May be modified by Export? |
|---|---|---|---|
| Results report | GM's actual past-turn outcome; evidence of units, terrain and resources | Immutable archived report + Results DB | **Never** |
| Start-of-turn baseline | Derived initial state of planning turn N from Results N−1, plus approved historical imports | Derived / rebuildable cache | **Never** |
| Blank Orders template | Original downloaded/uploaded workbook for turn N (sheets, formulas, validations, formats, macros) | Immutable, versioned file store | **Never** |
| Mapper orders / Draft plan | User's editable intentions for N: movement, scouting, activities, transfers, creations, studies, comments | **Authoritative plan database**, keyed by turn | **Never** |
| Export snapshot | Read-only immutable view of all saved draft orders at revision R | Temporary in-memory or persisted manifest | Read-only |
| Generated Orders workbook | Rendering of snapshot R into a new copy of blank template N | Export artefact (output only) | Create/replace atomically |
| Imported Completed Orders | A workbook from file import / submission / historical play; evidence, not automatic instruction to replace the draft | Immutable imported reference record | **Never** |
| Submitted/final Orders | Orders *explicitly* marked by the user as the actually sent version | Versioned reference + explicit state transition | No implicit changes |
| Reconciliation warning | Difference between draft, imported or submitted workbook | Derived report | **Never** |

**Single source of truth:** draft orders are the database, **not** the Excel workbook, DOM state, a turn overlay, the last completed import, or a file's presence in a watched folder. The blank template defines output shape only; it does not supply movement/scouting intent.

**Exported is not submitted.** Neither file creation nor opening in Excel changes the draft lifecycle.

## 3. Target architecture and data flow

1. **Acquire template:** Ravenpost/download or manual chooser → validate workbook and turn identity → store exact original bytes as immutable template version with SHA-256, filename, source and timestamp; keep prior versions.
2. **Edit orders:** Mapper UI / other planning screens → validate → one explicit save/update/delete command per user action → atomic database transaction → return saved ID, canonical turn and updated revision → reload from database.
3. **Build export snapshot:** resolve canonical planning turn → capture consistent revision R and all order types using **one shared TurnPlanService** → validate dependencies and inventory assumptions → build ordered worksheet rows.
4. **Preview and audit:** display per-sheet row counts, units and warnings. If a saved row cannot be mapped, **fail closed** with a named row/turn/worksheet. No silent fallback to Still for a saved movement.
5. **Render:** read only saved template bytes; write values into recognized input cells of an isolated temporary copy; preserve workbook structure and formulas; recalculate on Excel open.
6. **Verify:** reopen temporary workbook and compare every managed order's relevant cells with export snapshot R; compare expected/actual sheet schema, data validations, formulas, named ranges and macros as appropriate. Verify route counts **and field values**.
7. **Publish:** atomically place generated copy in the selected output location; maintain previous good file/version if validation or replacement fails. Return filename, revision, counts and checksum to UI.
8. **Open:** ask the OS to open published file. Opening failure is a separate warning, **not** a failed database save or a reason to regenerate data.
9. **File-library indexer:** detect and classify the artefact as exported draft / external imported / explicitly submitted. Index paths and hashes **without mutating the draft**.

### Data flow diagram

Results (N−1) → immutable start baseline (N)  
Ravenpost blank Orders (N) → immutable template store  
Mapper Movement / Scouting / Unit Creation / Transfers / Activities / Skill Attempts → **Turn N plan database**  
Turn N plan database → immutable snapshot (revision R) → validation → fresh template copy → generated Orders (R)  
Generated Orders (R) → file library **index only**; optional explicit Submit / Import as reference  
Submitted Orders + Results (N) → historical evidence; may inform planning N+1, **never overwrite N drafts without consent**.

The transfer of data is one-way unless an explicit, reviewed **Import as Editable Plan** feature is invoked; that is a different operation from reference import or export.

## 4. Canonical turn identity and database ownership

**Turn key:** TribeNet uses canonical keys such as **906-05** (normalized from 906_05 and 906-5); these are game turns, not calendar dates. Example: Results 906-04 provides the beginning of planning turn 906-05. The UI must display both source Results turn and active planning turn.

All saves, loads, imports, exports, activities, unit splits, transfers and studies MUST resolve to a canonical **planning turn key** through a single backend service. Eliminate split client-side heuristics and implicit fallback to the preceding Results key. Legacy records saved under alternate spellings or a preceding Results turn are migrated once, with an audit trail and collision/conflict report, **not continually merged** into every export.

**Proposed TurnPlan table:** turnKey (primary key), baselineResultTurnKey, draftRevision (monotonic integer), lifecycleStatus, createdAt, updatedAt. Own related records in normalized tables or one transactional aggregate:

- MovementOrder: id, turnKey, unitCode, origin, orderedCommands (max 40), optional parameters (follow target, GOTO hex, movement type), modifiedAt, revision.
- ScoutingOrder: stable id, turnKey, originating unit, scout slot, mission, scouts, horses, orderedCommands (max 9), equipment metadata, origin, conditional route metadata, modifiedAt. Root Tribe plus eligible units share maximum eight scouts.
- UnitCreationOrder: id, turnKey, parent, generated code, type (Tribe/Element/Fleet/Garrison/Courier), creation phase BM/AM, optional transferred skills, initial resources.
- TransferOrder: id, turnKey, from/to, item code, quantity, BM/AM, notes.
- ManualActivityOrder: id, turnKey, unit, workbook activity code, people, Item, Distinction, mining direction, notes.
- SkillAttemptOrder: id, turnKey, Tribe, attempt 1/2/3, exact workbook skill value, group, baseline level.
- ExplicitGmAction / ExplicitComment: id, turnKey, unit, text, order, source.
- OrderChangeLog: command ID, before/after or event, actor/source, timestamp and revision. Supports undo, troubleshooting and recovery.
- TemplateVersion / ExportRecord / ImportedReference: independent tables, each with original file checksum and no cascading delete into TurnPlan.

The current app splits storage across planned-routes.sqlite and turn-manager.sqlite. A **single logical snapshot boundary** or serialized write queue + revision checks is needed until consolidation. Never read movement from one revision and scouting from another. Export must not call save, update, delete, clear, import-as-draft or reprocess functions.

**Conflict handling:** preserve existing draft records if legacy turn keys conflict. Show a review screen for collisions; never decide which to delete based only on discovery order, code suffix or import time.

## 5. Activities and features feeding the Orders workbook

Each editable function is an independent order producer whose saved data is read by the same export snapshot. Calculator/preview features are not orders until a user explicitly commits a corresponding plan.

| Planner feature / producer | Persisted input | Output sheet / derived effect | Required behaviour |
|---|---|---|---|
| **Move Unit** | Unit ID, ordered directions, optional FOL/FOR and GOTO, movement type/target | Tribe_Movement; Valid Units | Up to 40 commands; no route → Still; saved movement → exact commands |
| **Send Out Scout** | Unit, party ID/slot, PATROL, scouts, horses, up to nine commands, route | Scout_Movement; Tribes_Activities | Up to 8 shared parties per root Tribe; worker reservations from saved parties |
| **Scouting Activities** | **Derived** from saved scouting parties, never a separately mutable duplicate | Tribes_Activities | Activity=SCOUTING; Item=SCOUTING; Distinction=NONE; People=sum assigned to source unit |
| **Split Off / Create Unit** | Parent/new unit, type, BM/AM, skills, initial state | GM Actions; Valid Units; Movement; transfer dependencies | Correct parent/new ID, timing, zero duplicate creation entries; include new unit where eligible |
| **Scouting by a new unit** | Derived from split + new unit's saved scouts | Tribes_Activities of original source; Comments | One Comment per new unit: "Allocated scouting for [OriginUnit] includes scouting performed by [NewUnit]." Ordinary scouting creates no scouting Comment |
| **Transfer items/people/provisions** | From/to, item, quantity, BM/AM, notes | Transfers | Correct timing and item codes, retain all line items; transfer allocation affects validation and scouting/movement state |
| **General planned activities** | Unit, activity type, workforce, item/target, distinction, mining direction, notes | Tribes_Activities; manual Comments if explicitly authored | Keep unit rows contiguous; preserve player-entered fields; no duplicate generated scouting activity |
| **Skill Attempts** | Tribe, slot order, selected skill, group and level | Skill_Attempts | 1–3 slots, exact workbook name mapping, valid Group A teacher restrictions, no silent remapping |
| **Explicit GM Actions** | User-authored instructions | GM Actions | Preserve player text; append derived new-unit/skill-transfer instructions without duplicates |
| **Explicit Comments** | User-authored unit notes | Comments (Unit; Message/Notes) | Retain manual notes; add only necessary derived split-scout comments |
| **Results/history and starting state** | Imported Results and start-state calculations | Valid Units / baseline validation; planning origins | Read-only context for unit list, inventory, skills, origin; does not overwrite draft orders |
| **Food gathering / Fishing / Hunting calculators** | Estimates and scenario inputs | **No direct export unless an Activity is committed** | Distinguish calculator preview from saved Activity order |
| **Provision / carrying capacity panels** | Calculated resource projections | **No direct export**; warnings for Moves/Transfers | Advisory validation; do not silently create transfer or activity rows |
| **Fair / Fairground** | Fair-specific orders and financial analysis | **Separate Fair workbook/workflow** | Not silently merged into main Orders workbook; explicit integration only if template/requirements later demand it |
| **Report playback, map fog, route overlays** | Derived UI and historical report data | **No direct export** | Visuals never act as implicit save or reset operations |

Sheet list is based on code-supported mappings. Real Ravenpost templates may include more sheets, formulas and helpers; preserve all unowned sheets unchanged and do not infer authority from a visible worksheet alone.

## 6. Workbook schema and field contracts

- **Tribe_Movement:** Unit code (TRIBE), MOVEMENT_1 through MOVEMENT_40, matching optional follow/GOTO/Hex/movement fields where explicitly supported. Non-moving existing units get Still. Do not replace saved directions with Still because of a missing query result; block export and show missing Unit/turn instead.
- **Scout_Movement:** TRIBE, No_of_Scouts, No_of_Horses, Mission (currently PATROL in Mapper), Movement1 through Movement9, Processed as required. Export count and verify *every value*, not only the number of rows. Conditional FOL/FOR appears as one workbook command; internal map expansion is not written as extra commands.
- **Tribes_Activities:** TRIBE, ACTIVITY, PEOPLE, ITEM, DISTINCTION, optional MINING_DIRECTION and processing columns. For derived scouting use SCOUTING / SCOUTING / NONE. Worker allocations reflect exact current saved scouting; removing a party removes its derived workforce. Keep all rows for a given unit contiguous.
- **Comments:** Unit and **Message/Notes** headings in the real workbook. Scout-generated text only for a newly created unit performing scouting; user-authored notes remain. Do not rely on substituting GM Actions for a known Comments sheet; optional compatibility mapping must be explicit and schema-tested.
- **GM Actions:** Unit and What does the GM need to do? Includes unit creation and skill reassignment instructions, plus explicit player instructions.
- **Transfers:** From, To, Item, Quantity, Transfer_Timing / template equivalents and notes, with BM/AM correctness. If this sheet exists but headers are unsupported, fail with visible headings; never silently drop planned transfers.
- **Skill_Attempts:** TRIBE, ORDER, TOPIC. Preserve exact skill workbook values and all intended slots.
- **Valid Units:** Every required Tribe, Element, Fleet, Garrison or other permitted unit and planned creation, without stale/duplicate entries.
- **All other sheets:** preserved byte/structure-equivalent except workbook metadata changes strictly required for recalculation.

Use a versioned **schema adapter** keyed to validated workbook headers (not presumed column positions). Unsupported template variants fail at *template acquisition* or preview, before export writes anything.

## 7. State transitions and command semantics

| Operation | Plan database | Template | Exported file | Historical reference |
|---|---|---|---|---|
| Get blank Orders from Ravenpost | No change | Create/version immutable blank | No change | No change |
| Save/Edit/Cancel movement/scout | Mutate only targeted order in transaction | No change | No automatic rewrite | No change |
| Save/Edit/Cancel split, transfer, activity, skill attempt | Mutate only targeted order/dependents after confirmation | No change | No automatic rewrite | No change |
| Preview Export | **Read only** | **Read only** | No change | No change |
| Export Orders | **Read only** | **Read only** | Create verified output from fresh copy | Record export metadata only |
| Open Excel | No change | No change | OS opens output | No change |
| Refresh / scan Turn File Library | **Read only** | No change | Index file only | Index/import reference read-only |
| Import Completed Orders (reference) | **Read only** | No change | Read external file | Store reference version / compare |
| Mark Submitted | Status change with explicit confirmation (not draft deletion) | No change | No forced rewrite | Freeze submitted copy and checksum |
| Import as Editable Plan (future explicit action) | User-reviewed merge/replace **after backup**, never implicit | No change | No change | Original import retained |
| Import/Reprocess Results | Preserve current plan; update historical result/cache, flag baseline conflicts | No change | No change | Update results history only |
| Restart / update application | **Exactly same saved orders** | Preserved | Preserved | Preserved |

**Cancel vs clear:** an explicitly requested Cancel/Delete must target a stable order ID; dependencies (for example child unit routes) require a confirmation listing affected records. Switching turns, refreshing the Mapper, export, a failed save or opening a dialog must never clear any orders.

**Editing generated workbook in Excel:** external changes are *not* silently imported to Mapper. Offer optional explicit **Compare Workbook to Saved Draft** and **Import Workbook Changes as Draft** with three-way diff, a backup and per-row approval.

## 8. Lifecycle status and file classification

Suggested statuses:

- **Planning Draft:** live editable DB revision R.
- **Exported Draft:** generated file linked to revision R; its existence does not lock or clear the plan.
- **Submitted:** user explicitly confirms which workbook was actually sent to the GM, stores immutable copy/hash/time and optionally locks editing or creates new revision.
- **Final Imported / Historical:** external submitted workbook is archived and compared with drafts.
- **Results Received:** GM report recorded, usable as next-turn baseline.

Store provenance sidecar or ExportRecord: exportId, turnKey, revision, templateVersion/checksum, saved-snapshot checksum, output filename/checksum, generatedAt, sheet row counts and author. An auto scanner should recognize exported drafts from those records and skip historical import. **Even when provenance is missing or the file is external, scanning may not mutate the plan**; the classification is for display and warnings, not for permission to delete.

**Folder layout suggestion:**
- private app-data / orders-templates / turn / template-version.xlsx (immutable);
- private app-data / orders-plan / DB and backups (authoritative);
- TribeNet Files / Completed Orders / draft-generated files (output only);
- TribeNet Files / Submitted Orders / frozen copies when explicitly submitted (optional);
- TribeNet Files / Results / archived GM reports.

Retain compatibility with current Completed Orders folder; do not relocate or delete existing user files silently.

## 9. Export algorithm and consistency contract

**Backend API shape (proposal):** ExportOrders(turnKey, outputOptions) → exportId, turnKey, revision, templateVersion, sourceCounts, outputPath, warnings.

1. Resolve/validate the *single* canonical planning turn. Show it before export. Compare with Mapper's active turn; block if ambiguous.
2. Acquire a read-consistent snapshot at revision R (all order types plus relevant unit baseline). Preserve the exact database row identities and hashes.
3. Check persisted count by type (moving routes, scouts, creations, transfers, activities, attempts, authored notes) and detect missing/duplicate/legacy-key records. User can review; never silently ignore records.
4. Build derived orders (SCOUTING activities, split-unit Comments, unit creation GM Actions/Valid Units) deterministically **without writing those derived rows back into manual activities**.
5. Validate field types, worker and horse limits, references, phased transfers, duplicate creation IDs, worksheet row capacities and command lengths.
6. Read saved, verified blank template. Populate all supported worksheets into a *new staging file* while preserving formulas, macros (when present), validation, styles, sheet order and hidden state.
7. Parse staged file; compare every managed cell with snapshot R. Check that unsupported sheets/formulas remain intact and that blank input slots hold no old generated orders.
8. Check revision again. If DB changed while generating, mark output stale or retry once from a new snapshot; never claim it is current.
9. Publish staging artefact atomically. If Windows/Excel locks old output, choose an obvious **new versioned filename**, keep old file, and report it.
10. Record export provenance and show a concise, copyable summary (e.g. "Turn 906-05 · revision 42 · 3 movements, 4 scouts, 6 activities, 2 transfers · validated"). Then open file if requested.
11. Zero mutations to Mapper orders across the entire call, including event listeners and background file scans.

**Zero-order safeguard:** an export with zero movement/scouting can be valid, but only if the snapshot confirms zero saved records for that turn. If a different turn has unsent routes, warn about likely turn mismatch; do not substitute or silently merge.

**Idempotence:** same template checksum + same snapshot R → logically same workbook cell values. Repeated export never imports its prior output as source data.

## 10. Import, reconciliation and recovery

### Blank Orders import
- Retrieve workbook from Ravenpost for explicit turn or select manually.
- Verify workbook is blank in managed player-input cells, verify heading compatibility, extract template version.
- Preserve raw bytes; replacement of a template requires explicit user acceptance if previous exports exist. Keep older versions for reproducibility.

### Completed Orders import
- Manual import or folder scan stores a copy and manifest (source filename, hash, turn, processedAt, status).
- **Reference-only by default**: parse to independent historical record and produce a comparison against Mapper draft. No automatic clear, replacement or conversion of drafts.
- Distinguish **our exported draft** (recognized by manifest/hash), **external workbook**, **actually submitted** (explicit user status). A workbook filename such as Orders Complete is not sufficient to mean submitted.
- Only an explicit "Adopt this workbook as the plan" command may replace draft values; require full diff, confirmation and backup. Preserve the original reference unchanged.

### Data-loss recovery
- Before any migration/repair, create dated zipped backups of *all* related SQLite DB files (with WAL checkpoint/consistent snapshot), template copies and order import manifests.
- Inventory current and legacy turn keys across planned-routes and turn-manager databases; report which routes/orders can be recovered. Search prior backups, prior draft exports and historical imported workbooks without auto-merging.
- Present a preview and restore only specifically selected records; preserve existing IDs / relationships where possible, never overwrite newer unrelated orders.
- Audit trail records recovered-from file/revision.
- If records were already deleted and there is no backup, state plainly that the design alone cannot reconstruct them.

## 11. Known gaps in current implementation (audit; not a patch)

| Area | Current behaviour / evidence | Required design change | Priority |
|---|---|---|---|
| **Auto file-library sync** | src/turn-file-library-ipc.js imports changed Completed Orders and calls clearDraftPlanning, deleting activities, splits and planned routes | Read-only scanner, distinguish draft exports and references, ban destructive calls | **P0 – data loss** |
| Two import paths | src/main.js explicit import preserves drafts; auto scanner still deletes | One central reference-import API with guaranteed read-only contract | **P0** |
| Output folder shares import watcher | src/orders-export-path.js writes to folder scanned by turn-file-library-ipc.js | Provenance-aware indexing; scans cannot mutate drafts | **P0** |
| Split stores | Routes and other orders in separate SQLite DBs | One revisioned export snapshot or coordinated consistent snapshot | **P0** |
| Legacy turn aliases | src/main.js merges current and previous Results route keys; same unit may have duplicates or legacy ghost data | One-time reviewed migration and conflict report | **P0** |
| Export post-check | Some rows validated; preserved structural integrity is not exhaustively asserted; code-supported sheets may vary | Full per-row/per-field + template-preservation validation | **P0** |
| Generated vs submitted | Export files named Completed Orders are treated as final evidence by scanner | Explicit lifecycle/provenance status | **P0** |
| Edit/cancel dependencies | Route updates can clear linked scouts when move destination changes | Preview impacted records and ask before deleting; non-destructive replan option | P1 |
| Activities architecture | Manual activities persisted; scouting derived dynamically from saved routes | Structured source-linked reservations and consistent cross-activity resources | P1 |
| Comments/GM actions | Some notes derived; blank template may have optional sheet variants | Versioned adapter; preserve manual notes and user text | P1 |
| More Workbook features | Nonowned sheets preserved rather than generated; calculators are advisory | Explicit feature ownership and opt-in coverage extensions | P2 |
| Recovery and auditability | Multiple DBs and file manifests; no user-facing full turn revision history | Backups, audit history, diff/restore actions | **P0/P1** |

The confirmed clear helper deletes movement/scouting, activities and splits; other planning rows such as transfers and Skill Attempts may persist independently, producing a **partially cleared turn**. The design must therefore check *every dataset* after export, not only scouting.

## 12. Acceptance tests / release gates

### Data integrity (mandatory P0)
- **OI-01:** Save a movement and two scouts; restart; they exist in SQLite, Mapper and export preview.
- **OI-02:** Export; let the Turn File Library auto-scan run (including its startup and eight-second refresh); restart; byte-level DB/order-set fingerprints for all plan tables are unchanged, except explicit ExportRecord metadata.
- **OI-03:** Export twice with no user edits: same saved order counts and workbook values; no duplicated or missing records.
- **OI-04:** Edit a movement and cancel one scout; next export reflects only those intentional changes, no stale rows, no accidental deletes of other units.
- **OI-05:** Import a Completed Orders workbook from file picker; retain every planned movement, scout, split, transfer, manual activity and Skill Attempt. Repeat via library scan.
- **OI-06:** Import a corrected Results report and rescan the folder while planning N; draft N remains unchanged (display baseline differences separately).
- **OI-07:** Export fails (bad header, invalid route, no capacity, disk full, Excel lock): draft and blank template unchanged; last valid output retained; error actionable.
- **OI-08:** Test 906-04 Results → planning 906-05 with aliases 906_05/906-5 and legacy Results-key routes; no silent omission or resurrection.
- **OI-09:** Save edit while export is taking its snapshot: output matches one revision only; marked stale if edited during render.
- **OI-10:** App auto-update/restart and Turn File Library rescan preserve all saved plan tables.

### Workbook correctness
- **OI-11:** 40 movement commands and Still fallback only for units with no saved movement; GOTO/FOL/FOR values preserved as defined.
- **OI-12:** Nine scout commands, mission, warriors, horses and unit ID verified per row; max-eight rule enforced across root Tribe.
- **OI-13:** SCOUTING derived Activity has ITEM=SCOUTING and DISTINCTION=NONE, People equals worker allocation; old parties removed after edit.
- **OI-14:** Split unit (BM and AM) creates proper GM Action, Valid Units row and correct source allocation. Exactly one Comment per *new* scouting unit, none for ordinary scouts.
- **OI-15:** Transfers preserved with exact item, quantity, direction and phase; both manual and split-creation transfers represented.
- **OI-16:** All saved manual activities, Skill Attempts, explicitly authored Comments/GM Actions retained with exact workbook code mapping.
- **OI-17:** Every managed worksheet validated against actual blank Ravenpost workbook with Unit / Message/Notes Comments; original formulas, validations, macros, names, layout and hidden sheets preserved.
- **OI-18:** Unsupported worksheet/header or missing input space causes a visible failure, never a silent partial export.

### Experience
- **OI-19:** UI shows source turn, planning turn, draft revision, last export revision, per-sheet counts and warnings; a mismatch is detectable before opening Excel.
- **OI-20:** Export success is distinct from OS-open failure. A successfully exported draft remains editable. A submitted workbook is never implied by saving a file.
- **OI-21:** Recovery dry-run enumerates available DB backups, exports, references and precise differences before restoring anything.
- **OI-22:** Each deletion (including dependent scouts on move changes) is explicit, confirmed and logged; automated actions never delete orders.

## 13. Delivery sequence

**Phase A — P0 containment (release before other enhancements):**
- Remove clearDraftPlanning from automatic file-library import; assert in tests that scan has no access to any delete/update of draft records.
- Refactor explicit import and scan through a shared read-only reference-import service.
- Add ExportRecord classification and safe folder-indexing, plus export→scan→restart persistence integration test using file-library IPC code.
- Add pre-fix backups and a turn inventory/recovery report; do not migrate or delete legacy orders silently.

**Phase B — P0 reliable export:**
- Unify canonical planning-turn resolution; inventory and migrate legacy keys with a preview and backup.
- Create TurnPlanSnapshot(revision) and cross-table consistency guard; fail closed for omitted rows.
- Implement versioned template adapters; full worksheet validation; file lock handling; export summary with worksheet counts and revision.

**Phase C — P1 planning integration:**
- Centralize movement/scouting/creation/transfer/manual activities/Skill Attempts in one TurnPlanService contract.
- Stabilize dependency-aware edits and reservations (workers, horses, equipment) with warnings or hard errors as rules require.
- Add export preview/diff and submitted/reference lifecycle actions.

**Phase D — P2 polish:**
- UI turn revision/history, restore/reconciliation interface; explicit integration for additional workbook features; expanded template compatibility and performance tests.

**Release gate:** no production release claiming this fixed until every P0 data-integrity test passes using **real SQLite, real template schema, actual file-library scan path and app restart**. Unit tests of the workbook-writing function alone cannot detect a folder scanner deleting orders later.

## 14. Decisions to confirm before implementation

1. **Recommended default:** Imported Completed Orders is read-only evidence; an explicit **Mark Submitted** operation is the only lifecycle transition. The draft remains editable even after export. Should a submitted turn become read-only, or remain editable as a new revision?
2. **Recommended default:** Automatically scanned files are indexed, not applied to editable plans. Any external Excel edits require explicit diff-and-import approval.
3. **Recommended default:** Use stable versioned filenames for exports and retain older copies rather than overwriting them invisibly; the app can still surface "latest exported" clearly.
4. **Recommended default:** Keep Fair workbooks separate from normal Orders until the user requests a specific transfer of fair activity into the Orders template.
5. **Recommended default:** Prefer no data deletion after unit movement changes; offer a dependent-scout replan/confirm workflow instead.

These choices do not block **Phase A**. The no-data-loss invariant and non-destructive scanner are already defined.

---

### Implementation reference index

- src/main.js — explicit import, export IPC, turn aggregation, source turn selection.
- src/turn-file-library-ipc.js — **destructive automatic scan** and directory inventory.
- src/turn-file-library-ui.js — library scan on startup/periodic launcher refresh.
- src/orders-export-path.js — output in scanned Completed Orders directory.
- src/orders-workbook.js — template import, XML writing, row normalization and validation.
- src/orders-export-data.js — assembly of movement, scouting, GM actions, skill attempts, transfers and activities.
- src/activity-assignments.js — derived SCOUTING workforce and split-unit Comments.
- src/planned-routes-database.js — SQLite movement/scouting persistence.
- src/turn-manager-database.js — manual activities, unit splits, transfers, skill attempts and start/final workbooks.
- src/turn-lifecycle.js; src/results-map.js — planning/actual turn state and overlay selection.
- src/launcher-imports.js — export invocation and user messages.
- src/turn-workflow.js — Results-to-start-state projection.
- docs/workbook-export-safety.md — earlier workbook structure-preservation contract.
- tests/mapper-orders-export-regression.test.js; tests/scouting-activity-export.test.js — existing export tests that must be supplemented by a **file-library scan and restart** integration test.

**Document status:** proposed implementation specification. The confirmed destructive scanner remains unpatched as part of this documentation-only change.

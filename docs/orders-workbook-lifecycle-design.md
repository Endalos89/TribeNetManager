# TribeNet Manager — Orders Workbook & Turn Planning Lifecycle

**Design specification:** v1.1 (proposed; not implemented)  
**Date:** 27 October 2026  
**Repository:** Endalos89/TribeNetManager  
**Review basis:** code on main at the time of writing (release v0.1.757), earlier scouting/export requirements and observed data-loss reports.  
**Workbook evidence:** three completed Orders workbooks for 0485 turns 906-03, 906-04 and 906-05, each marked workbook version 1.13.  
**Scope:** blank Orders acquisition by file import or email retrieval; editable Mapper overviews for workbook order sheets; persisted turn plans; reviewable workbook export; actual Results reconciliation; turn completion and recovery.

> **Non-negotiable invariant:** The database holds the user's saved Mapper plan. Export renders a consistent snapshot onto a **fresh copy** of the blank Orders workbook for that turn. Manual edits made in the exported workbook stay in that file and do not flow back into the Mapper plan. Importing a blank workbook for turn N+1 is the completion signal for turn N; no export, file scan, Results import or app restart resets or clears turn N before then.

## 1. Purpose and the turn workflow

For a planning turn N, the user imports a blank Orders workbook or the Mapper retrieves it from email. The Mapper validates and stores that workbook as the immutable template for N, then presents a saved, viewable and editable plan. The user edits orders in the Mapper, exports a workbook built from the saved plan, and reviews or manually adjusts that file before sending it.

Turn N remains active and editable after export. The arrival of a blank Orders workbook for turn N+1 closes N and starts the next planning turn. A Results report records what actually happened and provides evidence for reconciliation; it does not rewrite the saved plan. The Mapper keeps the previous plan and exported files available for review.

Every export uses the saved template for its own turn and the latest saved Mapper revision. Re-exporting creates a new versioned file, preserving earlier exports and manual edits made to them.

Three completed Orders files were supplied for turns 906-03, 906-04 and 906-05. They establish the observed sheet names and workbook layouts. They are examples for schema review, not blank templates for future exports.

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
| Hand-edited exported workbook | User's manual changes to a specific generated copy | Retained export file with its own checksum | Never syncs back into the Mapper plan |
| Reconciliation warning | Difference between draft, imported or submitted workbook | Derived report | **Never** |

**Single source of truth:** draft orders are the database, **not** the Excel workbook, DOM state, a turn overlay, the last completed import, or a file's presence in a watched folder. The blank template defines output shape only; it does not supply movement/scouting intent.

**Export does not change the turn lifecycle.** File creation, opening or manual editing in Excel leaves the Mapper plan unchanged.

## 3. Target architecture and data flow

1. **Acquire the blank template:** choose a workbook manually or retrieve it from email; identify its turn; validate the workbook; store its original bytes, hash, source and timestamp as an immutable template version.
2. **Open or resume the turn plan:** create the plan only when one does not already exist. Re-importing a template for an existing turn must preserve its draft and offer a version comparison if the template differs.
3. **Edit in the Mapper:** every editable workbook sheet has a corresponding Mapper overview. Each user action saves to the database before the UI reports success.
4. **Review the saved plan:** show current turn, saved revision, per-sheet order counts and validation messages. The Mapper remains viewable and editable throughout turn N.
5. **Export:** capture a consistent saved plan revision and render it onto a fresh copy of that turn's blank template.
6. **Review and adjust in Excel:** opening or editing the exported file does not mutate the Mapper plan. Re-export creates another versioned workbook and preserves the manually adjusted file.
7. **Close the turn:** when the blank workbook for N+1 is received, mark N complete, retain its plan and exports, and activate N+1. If N+1's actual Results are not yet available, show the baseline as pending.
8. **Record actual Results:** import the Results report as historical evidence for the turn it resolves. It may update the next turn's starting state but never clears or overwrites saved orders.

### Data flow

Blank Orders N (file or email) → immutable template N  
Mapper sheet overviews → editable Turn N plan database  
Turn N plan database → saved snapshot R → fresh copy of template N → exported workbook R  
Exported workbook R → user review and optional manual edits → sent workbook copy  
Blank Orders N+1 received → close and retain Turn N; start Turn N+1  
Results report for N → immutable actual-results record → reconciliation and next-turn baseline

An automatic email retrieval and a manual file import use the same template validation, turn-key resolution and storage path. A received template never replaces an existing plan. A completed workbook is not accepted as a blank template.

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

## 5. Mapper overviews and features feeding the Orders workbook

Each editable workbook sheet has a dedicated Mapper overview button. The overview reads and edits the saved plan for the active turn. The same saved data feeds the matching worksheet during export. Auto-GM is present in the supplied workbook examples, but Mapper support is deferred; its sheet is preserved in exports without Mapper-authored changes until that phase is designed.

| Mapper overview | Workbook sheet | Persisted input / export behaviour |
|---|---|---|
| Comments | Comments | Unit and message text. Keep manually written notes. Add the scouting allocation comment only when a newly created unit performs scouting. |
| GM Actions | GM Actions | Unit and instruction text. Include explicit player instructions and required unit-creation or skill-transfer instructions without duplicates. |
| Tribe Activities | Tribes_Activities | Activity, item, distinction, people and related activity fields. Saved scouting parties derive SCOUTING activities with ITEM=SCOUTING and DISTINCTION=NONE. |
| Transfers | Transfers | From, To, Item, Quantity, Transfer_Timing and Notes. Preserve every line and BM/AM timing. |
| Tribe Movement | Tribe_Movement | Unit, follow target, movement type, starting hex and ordered movement commands. |
| Scout | Scout_Movement | Scouting unit, scout and horse counts, mission and ordered commands. |
| Skill Attempts | Skill_Attempts | Tribe, attempt order and exact workbook skill value. Preserve any computed workbook display fields. |
| Research Attempts | Research_Attempts | Tribe and research topic. |
| Auto-GM (future) | Auto-GM | Deferred. Keep the worksheet and its template-owned contents intact in exported workbooks. |

The existing Units overview remains an additional unit-state / unit-creation view. It can support information that feeds GM Actions and Valid Units. It does not replace the GM Actions sheet overview.

Calculator previews, map overlays, provision projections and historical report playback are not orders until the user commits the related order in the Mapper. Fair/Fairground remains a separate workflow unless the user later requests a specific integration.

| Planner feature / producer | Persisted input | Output sheet / derived effect | Required behaviour |
|---|---|---|---|
| **Move Unit** | Unit ID, ordered directions, optional FOL/FOR and GOTO, movement type/target | Tribe_Movement; Valid Units | Up to 40 movement commands; no route → Still; saved movement → exact commands |
| **Send Out Scout** | Unit, party ID/slot, PATROL, scouts, horses, up to nine commands, route | Scout_Movement; Tribes_Activities | Up to 8 shared parties per root Tribe; worker reservations come from saved parties |
| **Scouting Activities** | Derived from saved scouting parties, never a separately mutable duplicate | Tribes_Activities | Activity=SCOUTING; Item=SCOUTING; Distinction=NONE; People equals the assigned workforce |
| **Split Off / Create Unit** | Parent/new unit, type, BM/AM, skills, initial state | GM Actions; Valid Units; Movement; transfer dependencies | Correct parent/new ID and timing; no duplicate creation entries; include new unit where eligible |
| **Scouting by a new unit** | Derived from split + new unit's saved scouts | Tribes_Activities of the originating unit; Comments | Add one comment per new scouting unit: "Allocated scouting for [OriginUnit] includes scouting performed by [NewUnit]." Ordinary scouting creates no scouting comment |
| **Transfer items/people/provisions** | From/to, item, quantity, BM/AM, notes | Transfers | Preserve exact timing and item codes; transfer allocations inform validation |
| **General planned activities** | Unit, activity type, workforce, item/target, distinction, mining direction, notes | Tribes_Activities; Comments only when authored | Keep a unit's rows together; preserve every saved field; do not duplicate derived scouting |
| **Skill Attempts** | Tribe, attempt slot, selected skill, group and level | Skill_Attempts | Preserve 1–3 slots and the exact workbook value; enforce valid group restrictions |
| **Research Attempts** | Tribe and selected research topic | Research_Attempts | Preserve each saved attempt and its order as required by the template |
| **Explicit GM Actions** | User-authored instructions | GM Actions | Preserve the user's text and ordering |
| **Explicit Comments** | User-authored unit notes | Comments (Unit; Message/Notes) | Retain alongside any required derived scouting comment |
| **Results/history and starting state** | Imported Results and start-state calculations | Valid Units / baseline validation; planning origins | Read-only context for order validation; it never overwrites a draft |
| **Food gathering / Fishing / Hunting calculators** | Estimates and scenario inputs | No direct export unless an Activity is committed | A preview remains separate from a saved Activity order |
| **Provision / carrying capacity panels** | Calculated resource projections | No direct export; warnings for Moves/Transfers | Advisory only; do not silently create a transfer or activity row |
| **Report playback, map fog, route overlays** | Derived UI and historical report data | No direct export | Visual state never acts as an implicit save or reset operation |

## 6. Workbook evidence and schema contracts

### Observed workbook structure

The three supplied completed workbooks have the same 20 worksheet names. Each is marked version 1.13 dated Oct 16, 2025. All contain the requested order sheets, including Auto-GM. The exact activity worksheet spelling in all three is **Tribes_Activities**.

The main order-sheet headers and fields observed in the samples are:

| Worksheet | Exact observed input headers / fields | Export contract |
|---|---|---|
| **Comments** | Unit, Message/Notes | Preserve user-authored notes and append only the required split-scout comment. |
| **GM Actions** | Unit, What does the GM need to do? | Preserve user-authored instruction text; add generated instructions only when required. |
| **Auto-GM** | Multi-section form with header/instruction cells and later input columns | Deferred Mapper support. Preserve its template contents and structure. |
| **Tribes_Activities** | UnitName, TRIBE, ACTIVITY, ITEM, DISTINCTION, PEOPLE, SLAVES, SPECIALISTS, JOINT, OWNING_TRIBE, Building, Implement_1 through Implement_20 with paired Imp_n_Number fields, WHALE_SIZE, MINING_DIRECTION, PROCESSED | Write only the fields owned by Mapper orders. Keep workbook formulas and untouched activity fields. Scouting is derived from saved scouting orders. |
| **Transfers** | From, To, Item, Quantity, Transfer_Timing, Notes, Processed, Description of Transfer units | Write order fields and preserve calculated/processed fields as template requires. |
| **Tribe_Movement** | UnitName, TRIBE, FOLLOW_TRIBE, MovementType, Hex, MOVEMENT_1 through MOVEMENT_40, Processed | Preserve unit, movement and optional follow/type/hex fields. A route row contains forty movement slots in these examples. |
| **Scout_Movement** | UnitName, TRIBE, No_of_Scouts, No_of_Horses, Mission, Movement1 through Movement9, Processed | Preserve party counts, mission and all nine movement slots. |
| **Skill_Attempts** | TRIBE, ORDER, TOPIC, Processed, Attempting | Mapper owns tribe, order and topic. Preserve Processed; preserve or recalculate Attempting through Excel formulas. |
| **Research_Attempts** | TRIBE, TOPIC, Processed | Mapper owns tribe and topic. Preserve Processed. |

The remaining worksheets in these examples provide instructions, clan state, valid values, research, goods and reference data. They belong to the template or other app workflows; keep them in their original order and retain formulas, validations, names, styles, hidden state and row capacity.

Auto-GM has 23 columns in the 906-03 and 906-04 examples and 27 columns in 906-05, where an additional Village Ownership section appears. The workbook version cell remains 1.13. Template compatibility must therefore be checked from the actual sheet/header structure, not only the displayed version number.

The schema adapter must identify columns by normalized, validated headers, then write by the resolved column map. It must recognize the exact sheet names and required columns above, preserve additional columns and formula-driven cells, and fail before output if required fields are missing or unsupported. The supplied completed workbooks establish names and layouts; each export must use the matching **blank** workbook for that turn as its template.

### Data ownership rules

- Mapper-owned order cells come from the saved turn plan.
- Template-owned formula, validation, reference and processed cells remain template-owned unless the workbook contract explicitly requires a value.
- Derived rows such as scouting activities and split-scout comments are rendered deterministically from saved source orders; they are not duplicated as independently editable records.
- An unsupported or newly added template field is preserved untouched and surfaced for review if it may affect an order the Mapper owns.
- All order-sheet row counts and important cell values are checked against the saved snapshot before publishing export.

## 7. State transitions and command semantics

| Operation | Plan database | Template | Exported file | Results / turn lifecycle |
|---|---|---|---|---|
| Import blank workbook for turn N, manually or from email | Create N plan only if one does not already exist; preserve an existing plan | Store/version exact original bytes | No change | N is the active planning turn when appropriate |
| Re-import a blank workbook for existing turn N | No plan changes | Store as a new template version if its hash/schema differs | No change | Show template-version difference; do not reset N |
| Save/edit/cancel a Mapper order | Mutate only the targeted saved order and approved dependencies | No change | No automatic rewrite | N remains active |
| Preview or export N | Read only | Read only | Create a new version from a fresh template copy | N remains active and editable |
| Manually edit the exported workbook | No change | No change | Changes stay in that specific exported file | Results received later establish actual outcomes |
| Import the following turn's blank workbook N+1 | Preserve all N orders, revisions and exports | Store the N+1 template | Preserve N's prior files | Mark N complete and activate N+1 |
| Import Results for turn N | Preserve the N plan and history | No change | No change | Store actual results and reconcile; use as baseline for N+1 |
| Refresh or scan the file library | Read only | No change | Index only | Never close a turn or clear a plan |
| Restart or update the application | Retain all saved plans | Preserve all templates | Preserve all exports | Preserve active-turn and completion state |

**Turn completion rule:** arrival of the blank Orders workbook for N+1 is the sole automatic signal that planning turn N is complete. Results arrival by itself does not clear N or move the active turn forward. Export, opening Excel, manually editing a workbook, scanning folders, importing the same turn's template and restarting the app never reset a plan.

On completion, archive N's last saved Mapper revision and available exports for inspection. Keep them in storage. Do not require a separate submission-confirmation step for turn completion because subsequent Results are the evidence of what actually took place. If an archived turn needs correction, make any reopening an explicit user action with the old plan intact.

**Manual workbook edits:** changes made after export are local to that workbook. The Mapper does not automatically read them back. A later export creates a new version from the saved Mapper plan and blank template, retaining earlier hand-edited files. The next Results report is used to understand actual outcomes.

**Cancel vs clear:** an explicit Cancel/Delete targets a stable order ID. If dependent orders would be affected, show them before removal. Switching turns, receiving a template, exporting, a failed save, or opening a dialog never clears orders.

## 8. Turn lifecycle and file classification

Recommended statuses:

- **Planning Draft:** the active turn's editable Mapper plan, saved at revision R.
- **Exported Copy:** a workbook rendered from revision R. It may be reviewed and manually edited in Excel.
- **Completed Turn:** the blank template for the following turn has arrived. The previous plan and its exports remain retained and inspectable.
- **Actual Results Recorded:** the Results report for a completed turn has been stored and reconciled with its saved plan.

Exporting does not mean the workbook was sent. The application does not need a user-facing submission confirmation for turn completion. The following-turn template closes the plan, and the subsequent Results report records actual outcomes.

Store export provenance: exportId, turnKey, saved revision, template version/checksum, saved-snapshot checksum, output filename/checksum, generatedAt, sheet row counts and author. Preserve every generated version so a hand-edited workbook remains available after a later export.

The file-library indexer classifies files and hashes only. It cannot mutate order plans, replace templates, mark turns complete or import results. A file's name or presence in a watched folder is not a lifecycle signal.

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

### Blank Orders acquisition

- Support manual selection and automatic retrieval from the configured email source. Both paths run identical turn-key resolution, workbook validation and template storage.
- Confirm the workbook's turn from workbook content and validated metadata. Use the filename as supporting evidence, not as the sole turn identity.
- Validate required editable sheet names and headers, including Tribes_Activities. Report the actual workbook version and observed schema.
- Save the original workbook bytes as an immutable template version with a checksum. A duplicate file with the same turn and checksum is idempotent.
- If a different workbook arrives for a turn that already has a template, preserve the current template and plan, store the new version and show a comparison. Do not silently replace the active template.
- Completed workbooks supplied as examples or from an earlier turn are reference files, not blank templates.

### Mapper planning and workbook review

- Each in-scope editable sheet has a dedicated overview button and a view/edit screen backed by the active turn's saved plan. Auto-GM remains deferred.
- Export reads one saved revision and renders it into a fresh copy of that turn's blank workbook. The Mapper remains editable after export.
- The user may make final manual changes in Excel. Those changes remain in the selected workbook and are not imported into the Mapper automatically.
- Each re-export uses the latest saved Mapper plan and the matching blank template, creates a new versioned filename, and retains previous files including hand-edited copies.
- A future compare/import feature is out of scope unless explicitly requested. Actual Results from the following turn are used to confirm what took place.

### Results import

- Import Results as immutable actual-turn evidence. Preserve the corresponding planned orders and exported workbooks.
- Results received before the following turn's blank template do not close the current plan.
- When the following blank template arrives, close the prior plan and start the next turn. Use the previous turn's Results for the new baseline when available; otherwise display that the baseline is pending.
- Reconciliation reports differences between intended Mapper orders and actual Results. It does not rewrite either record.

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
| Exported vs hand-edited | Export files in the Completed Orders folder may be mistaken for incoming evidence by the scanner | Provenance-aware indexing; scans never change the plan or mark a turn complete | **P0** |
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
- **OI-20:** Export success is distinct from OS-open failure. A successfully exported draft remains editable. Saving or sending a workbook does not change the Mapper plan or complete the turn.
- **OI-21:** Recovery dry-run enumerates available DB backups, exports, references and precise differences before restoring anything.
- **OI-22:** Each deletion (including dependent scouts on move changes) is explicit, confirmed and logged; automated actions never delete orders.
- **OI-23:** Save orders for turn N, export and manually edit the workbook, restart and scan. The saved Mapper plan is unchanged and the manual workbook remains intact. A re-export creates a separate fresh copy from the saved plan.
- **OI-24:** Import Results for N without the N+1 blank workbook. Turn N remains active and unchanged.
- **OI-25:** Import the N+1 blank workbook. Turn N is archived with all plan revisions and exports retained, and N+1 becomes active.
- **OI-26:** Exercise both manual template import and automatic email retrieval with the same template and confirm identical turn identity, validation and stored bytes.
- **OI-27:** Confirm each in-scope sheet overview opens the active turn's saved data, saves edits, and displays row counts matching export preview. Auto-GM remains preserved without Mapper changes.

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
- Add export preview with per-sheet row counts and turn-completion state. Manual workbook edits stay in the workbook; Results reconcile actual outcomes.

**Phase D — P2 polish:**
- UI turn revision/history, restore/reconciliation interface; explicit integration for additional workbook features; expanded template compatibility and performance tests.

**Release gate:** no production release claiming this fixed until every P0 data-integrity test passes using **real SQLite, real template schema, actual file-library scan path and app restart**. Unit tests of the workbook-writing function alone cannot detect a folder scanner deleting orders later.

## 14. Decisions captured for implementation

1. **Editable sheet names:** the three supplied workbooks confirm the exact activity sheet is Tribes_Activities.
2. **Mapper coverage:** dedicated overview buttons are required for Comments, GM Actions, Tribes_Activities, Transfers, Tribe_Movement, Scout_Movement, Skill_Attempts and Research_Attempts. Auto-GM support is deferred. The existing Units overview remains an additional unit-state / creation view.
3. **Excel review:** the user may edit exported workbooks manually. Those changes stay in the exported file; the Mapper does not import them back automatically.
4. **Actual outcomes:** Results from the following turn provide evidence of what took place. They are imported as actual history and used for reconciliation.
5. **Completion gate:** turn N stays active until a blank Orders workbook for turn N+1 is received. That receipt closes N, retains its data and activates N+1.
6. **Export files:** use versioned filenames and preserve earlier copies so a later export never overwrites a manually adjusted workbook.

The implementation must preserve these rules even when email retrieval, file-library scanning, app restart or export fails.

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

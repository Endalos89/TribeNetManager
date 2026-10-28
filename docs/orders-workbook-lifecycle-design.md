# TribeNet Manager — Orders Workbook Lifecycle & Export Safety

**Design specification:** v1.3 (proposed)  
**Updated:** 28 October 2026  
**Workbook evidence:** completed Orders workbooks for turns 906-03, 906-04 and 906-05, workbook version 1.13.

> **Core rule:** The saved Mapper plan is the source of truth. Export uses that turn's blank template and the latest saved plan. Each turn has one app-managed export in an `Exported Files` folder under the application installation directory. Re-export replaces that turn's existing export. Importing the next turn's blank workbook completes the current turn; no export, scan, Results import or restart may clear its plan.

## Workflow and turn lifecycle

1. Import a blank Orders workbook for turn N, or retrieve it from email. Validate it and store it as N's template.
2. View and edit N's saved plan through the Mapper's order overviews.
3. Export N's latest saved plan to the turn's existing export file. Review it in Excel and make any final manual edits.
4. Keep N active until the blank workbook for N+1 arrives. Then complete N, retain its plan and final export, and activate N+1.
5. Import Results as evidence of what actually happened. Results inform reconciliation and the next baseline; they do not complete a turn or rewrite a plan.

Re-importing a template for an existing turn must not reset its plan. If its contents differ, keep both template versions and show the difference for review. Manual workbook edits do not sync back to Mapper. A later export replaces the file, including any manual edits, using the saved Mapper plan and blank template.

## Sources of truth

| Data | Authority | Export may change it? |
|---|---|---|
| Mapper orders | Saved database plan for the canonical planning turn | No |
| Blank Orders workbook | Immutable, versioned template for that turn | No |
| Exported workbook | One replaceable output file per turn | Yes, by replacing that turn's file |
| Results report | Immutable record of actual outcomes | No |

The plan database, not a workbook, scan result, UI state or prior Results import, owns saved orders. Export takes one consistent plan snapshot and must not save, update, delete, clear or re-import plan data.

## Mapper overviews and workbook sheets

Each in-scope sheet has a corresponding view/edit overview. The exact sheet spellings below are from the supplied workbooks.

| Mapper overview | Exact worksheet | Coverage |
|---|---|---|
| Comments | `Comments` | Unit and message text; include the required split-scout note when applicable. |
| GM Actions | `GM Actions` | Player instructions and required unit-creation or skill-transfer instructions. |
| Tribe Activities | `Tribes_Activities` | Activities, items, distinction, workforce and related fields; scouting activities derive from saved scout orders. |
| Transfers | `Transfers` | From, To, Item, Quantity, Transfer_Timing and Notes. |
| Tribe Movement | `Tribe_Movement` | Unit, follow/type/hex fields and up to 40 ordered movement commands. |
| Scout | `Scout_Movement` | Unit, scouts, horses, mission and up to 9 movement commands. |
| Skill Attempts | `Skill_Attempts` | Tribe, attempt order and skill/topic values. |
| Research Attempts | `Research_Attempts` | Tribe and research topic. |
| Auto-GM (later) | `Auto-GM` | Preserve the template sheet; Mapper editing is deferred. |
| Units (existing) | — | Additional unit-state and creation overview; it does not replace GM Actions. |

## Workbook and export contract

The schema adapter must validate sheet names and required headers against the actual blank template, not only its displayed version. The supplied completed workbooks show these input fields:

| Worksheet | Observed headers / fields |
|---|---|
| `Comments` | Unit, Message/Notes |
| `GM Actions` | Unit, What does the GM need to do? |
| `Tribes_Activities` | UnitName, TRIBE, ACTIVITY, ITEM, DISTINCTION, PEOPLE, SLAVES, SPECIALISTS, JOINT, OWNING_TRIBE, Building, Implement_1–Implement_20 and paired Imp_n_Number fields, WHALE_SIZE, MINING_DIRECTION, PROCESSED |
| `Transfers` | From, To, Item, Quantity, Transfer_Timing, Notes, Processed, Description of Transfer units |
| `Tribe_Movement` | UnitName, TRIBE, FOLLOW_TRIBE, MovementType, Hex, MOVEMENT_1–MOVEMENT_40, Processed |
| `Scout_Movement` | UnitName, TRIBE, No_of_Scouts, No_of_Horses, Mission, Movement1–Movement9, Processed |
| `Skill_Attempts` | TRIBE, ORDER, TOPIC, Processed, Attempting |
| `Research_Attempts` | TRIBE, TOPIC, Processed |

Export requirements:

- Save to `<installation directory>/Exported Files/Orders_<turn>.xlsx`, using the canonical turn key (for example, `Orders_906-05.xlsx`). Keep one current export per turn; do not create numbered or timestamped alternatives.
- Build every export from that turn's stored blank template and latest saved Mapper revision, never from the prior export.
- Write to a staging file, validate it, then replace the existing export for that turn. If validation fails or the target is locked, leave the existing export intact and report the error; do not create another filename.
- Preserve sheet names/order, formulas, names, validations, formatting, macros, hidden state and untouched cells. Write only to validated Mapper input cells and existing row capacity; never shift rows or columns.
- Validate required headers, emitted order values/counts, template-owned content and snapshot revision before reporting success. Unsupported schemas or insufficient capacity must fail clearly, without a partial export.
- Opening or editing the output never changes the Mapper plan. Re-export intentionally replaces manual edits in that file.

## File scanning and the current data-loss bug

The current automatic scan in `src/turn-file-library-ipc.js` calls `clearDraftPlanning` when it detects a changed Completed Orders workbook. That helper deletes planned activities, unit splits and movement/scouting routes. Because exports and scanned files can be detected by the file library, this is a concrete unsafe path that conflicts with the core rule; it is a bug to remove, not intended lifecycle behavior.

Required fix: file discovery and import of completed/reference workbooks must be read-only with respect to the plan. The `Exported Files` folder must be separate from the watched Completed Orders folder. Scanning, export, Results import and app restart must never clear or complete a plan. Completion is driven only by receiving the following turn's blank workbook.

Relevant code: `src/turn-file-library-ipc.js` (scan), `src/turn-file-library-ui.js` (scan schedule), `src/orders-export-path.js` (export destination), `src/orders-workbook.js` (template writer/validation), `src/orders-export-data.js` (order assembly), `src/main.js` (import/export IPC), and the planning database modules.

## Acceptance criteria and delivery order

1. Import the same-turn blank template again; saved orders remain unchanged.
2. Export, allow automatic scans and restart the app; every saved order remains unchanged.
3. Export twice: the same per-turn file is replaced with the latest Mapper revision; no duplicate rows or alternate export file is created.
4. Manually edit the export and re-export: edits do not enter the Mapper plan, and the file is replaced from the blank template plus saved plan.
5. Lock the export in Excel or use an invalid template: the old file and plan remain intact and the app reports why replacement failed.
6. Import Results for N without the N+1 blank workbook; N remains active. Import N+1's blank workbook; N is completed and retained, and N+1 becomes active.
7. Verify all managed sheets against actual blank workbooks, including 40 movement slots, 9 scout slots, formulas, validations and untouched sheets. Auto-GM remains template-preserved.

**Implementation priority:** remove destructive scan behavior first; then implement the single-file-per-turn export path and full template/output validation. Do not claim the data-loss issue fixed until scan/export/restart persistence is verified against the real file-library path and database.

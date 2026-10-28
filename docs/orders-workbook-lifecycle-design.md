# TribeNet Manager — Orders Workbook Lifecycle & Export Safety

**Design specification:** v1.4 (proposed)  
**Updated:** 28 October 2026  
**Workbook evidence:** completed Orders workbooks for turns 906-03, 906-04 and 906-05 (version 1.13).

## Goal and workflow

The Mapper is where the user views and edits a turn's saved orders. A blank Orders workbook supplies that turn's template. The exported workbook is for review and manual adjustment before submission.

1. Import the blank workbook for turn N, or retrieve it from email. Validate it and save it as N's template.
2. View and edit N's saved plan through the Mapper overviews.
3. Export the latest saved plan into N's export file and review it in Excel.
4. Keep N active until the blank workbook for N+1 arrives. That receipt completes N, retains N's plan and export, and activates N+1.
5. Import Results as evidence of what happened. Results support reconciliation and the next baseline; they do not complete a turn or rewrite the saved plan.

Re-importing a template for a turn must not reset its plan. If a different template arrives for that turn, retain both and show the difference for review.

## Sources of truth and lifecycle

| Data | Authority | Effect of export |
|---|---|---|
| Mapper orders | Saved database plan for the canonical planning turn | Read only |
| Blank Orders workbook | Immutable template for that turn | Read only |
| Exported workbook | One replaceable output file per turn | Replaced on re-export |
| Results report | Immutable record of actual outcomes | Read only |

The plan database owns saved orders—not a workbook, scan result, UI state or Results import. Export uses a consistent snapshot of the latest saved revision and must not save, update, delete, clear or re-import plan data.

Turn N remains active after export and after importing its Results. Only receipt of the blank workbook for N+1 completes N. Export, file scans, Results import and app restarts never complete a turn or clear its plan.

## Mapper overviews and workbook sheets

Each in-scope sheet has a corresponding view/edit overview. These exact sheet names were checked against the supplied workbooks.

| Mapper overview | Exact worksheet | Coverage |
|---|---|---|
| Comments | `Comments` | Unit and message; include the required split-scout note when applicable. |
| GM Actions | `GM Actions` | Player instructions and required unit-creation or skill-transfer instructions. |
| Tribe Activities | `Tribes_Activities` | Activity fields and workforce; scouting activities derive from saved scout orders. |
| Transfers | `Transfers` | From, To, Item, Quantity, Transfer_Timing and Notes. |
| Tribe Movement | `Tribe_Movement` | Unit, follow/type/hex fields and up to 40 movement commands. |
| Scout | `Scout_Movement` | Unit, scouts, horses, mission and up to 9 movement commands. |
| Skill Attempts | `Skill_Attempts` | Tribe, attempt order and skill/topic values. |
| Research Attempts | `Research_Attempts` | Tribe and research topic. |
| Auto-GM (later) | `Auto-GM` | Preserve the template sheet; Mapper editing is deferred. |
| Units (existing) | — | Additional unit-state and creation overview; does not replace GM Actions. |

## Workbook and export contract

The schema adapter validates sheet names and headers against the actual blank workbook, not only its displayed version.

### Export location and replacement

- Save to `<installation directory>/Exported Files/Orders_<turn>.xlsx`, using the canonical turn key, for example `Orders_906-05.xlsx`.
- Keep one current export per turn. Re-export replaces that turn's existing file; do not create numbered or timestamped alternatives.
- Build from that turn's stored blank template and latest saved Mapper revision, never from the previous export.
- Stage and validate the new file before replacing the current one. If validation fails or the target file is locked, keep the old file and report the error; do not save under another name.
- Manual Excel edits do not flow back into the Mapper. A successful re-export replaces those edits with the latest saved plan.

### Preservation and validation

Preserve worksheet names and order, formulas, defined names, validations, formatting, macros, hidden state and untouched cells. Write only to validated Mapper input cells and existing row capacity; never shift rows or columns.

Before reporting success, validate the required headers, order values and counts, untouched template-owned content and snapshot revision. Unsupported schemas or insufficient capacity must fail clearly without publishing a partial export.

The observed fields in the supplied workbooks are:

| Worksheet | Observed headers / fields |
|---|---|
| `Comments` | Unit, Message/Notes |
| `GM Actions` | Unit, What does the GM need to do? |
| `Tribes_Activities` | UnitName, TRIBE, ACTIVITY, ITEM, DISTINCTION, PEOPLE, SLAVES, SPECIALISTS, JOINT, OWNING_TRIBE, Building, Implement_1–Implement_20 with paired Imp_n_Number fields, WHALE_SIZE, MINING_DIRECTION, PROCESSED |
| `Transfers` | From, To, Item, Quantity, Transfer_Timing, Notes, Processed, Description of Transfer units |
| `Tribe_Movement` | UnitName, TRIBE, FOLLOW_TRIBE, MovementType, Hex, MOVEMENT_1–MOVEMENT_40, Processed |
| `Scout_Movement` | UnitName, TRIBE, No_of_Scouts, No_of_Horses, Mission, Movement1–Movement9, Processed |
| `Skill_Attempts` | TRIBE, ORDER, TOPIC, Processed, Attempting |
| `Research_Attempts` | TRIBE, TOPIC, Processed |

The supplied workbook samples show Auto-GM changing from 23 to 27 columns while the displayed version remains 1.13. Validate the actual sheet structure and preserve template-owned fields.

## Acceptance criteria

1. Re-importing a template for N leaves N's saved orders unchanged.
2. Export, automatic file scans and app restart leave every saved order unchanged.
3. Re-export replaces the same per-turn file with the latest saved plan, with no duplicated rows or alternate file.
4. Manually edit the export and re-export: manual edits do not enter the Mapper and the file is rebuilt from the template and saved plan.
5. If the export is locked or the template is invalid, the existing export and plan remain intact and the app reports the failure.
6. Import Results for N without N+1's blank workbook: N stays active. Import N+1's blank workbook: N is completed and retained; N+1 becomes active.
7. Validate all managed sheets against real blank workbooks, including command limits, formulas, validations and untouched sheets. Auto-GM remains template-preserved.

## Bugs and areas still to implement

### Confirmed bug

The automatic scan in `src/turn-file-library-ipc.js` calls `clearDraftPlanning` when a changed Completed Orders workbook is detected. That helper deletes planned activities, unit splits and movement/scouting routes. The scan can therefore erase saved orders. This is a bug and violates the lifecycle rule above; it is not intended behavior.

### Still to implement

- Remove all plan-clearing or plan-mutating behavior from automatic scans and completed/reference workbook imports.
- Keep `Exported Files` under the application installation directory, separate from the watched Completed Orders directory.
- Implement the one-file-per-turn export path, replacing the existing file safely and preserving it if validation fails or it is locked.
- Validate every managed sheet and emitted field against the actual blank template; reject unsupported layouts and insufficient row capacity.
- Verify persistence through the real export → scan → restart path before considering the data-loss issue fixed.
- Add the remaining editable Mapper overviews for Comments, GM Actions, Tribes_Activities, Tribe_Movement, Research_Attempts and any other planned sheets not yet covered. Keep Auto-GM deferred.

**Relevant code:** `src/turn-file-library-ipc.js` (scan), `src/turn-file-library-ui.js` (scan schedule), `src/orders-export-path.js` (export destination), `src/orders-workbook.js` (template writer/validation), `src/orders-export-data.js` (order assembly), `src/main.js` (import/export IPC).

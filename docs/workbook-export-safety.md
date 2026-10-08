# Workbook export safety contract

The Movement view now exports a new Orders workbook from an imported blank template. The exporter patches the workbook XML directly instead of round-tripping it through a generic spreadsheet writer. This preserves the macro/format-driven workbook structure while writing Movement, Scouting, GM Actions and any newly created unit entries in `Valid Units`.

When implemented, export must:

1. Always create a new copy; never overwrite the imported source workbook by default.
2. Preserve sheet names, order, hidden state, formulas, defined names, data validation/dropdowns, formatting and VBA/macros for macro-enabled workbooks.
3. Write values only into cells/rows already designated as player input by the template.
4. Use dropdown-valid values exactly as present in the source template rather than inventing display labels.
5. Never insert/delete/reorder rows or columns. New unit values use existing empty `Valid Units` rows; Movement and Scouting use the template's existing input rows.
6. Validate the output workbook against the input workbook before offering it to the user, reporting any unexpected structural differences.
7. Retain the beginning and finalized source workbooks separately in Turn Manager history so the planner never needs to mutate its evidence source.

The current exporter is tested against the supplied blank and completed workbooks. It writes `Still` as `MOVEMENT_1` for units without a saved movement, uses `EMPTY` for remaining command cells, groups scouting rows by Tribe and linked units, and validates that every emitted unit code is present in `Valid Units`.

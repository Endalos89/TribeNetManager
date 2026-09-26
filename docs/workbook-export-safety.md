# Workbook export safety contract

Turn Manager does **not** write to an Orders workbook yet. The existing Orders workbook is macro/format driven, so export will only be enabled after round-trip tests against real beginning and finalized templates.

When implemented, export must:

1. Always create a new copy; never overwrite the imported source workbook by default.
2. Preserve sheet names, order, hidden state, formulas, defined names, data validation/dropdowns, formatting and VBA/macros for macro-enabled workbooks.
3. Write values only into cells/rows already designated as player input by the template.
4. Use dropdown-valid values exactly as present in the source template rather than inventing display labels.
5. Never insert/delete/reorder rows or columns unless a specific template version has been tested for it.
6. Validate the output workbook against the input workbook before offering it to the user, reporting any unexpected structural differences.
7. Retain the beginning and finalized source workbooks separately in Turn Manager history so the planner never needs to mutate its evidence source.

The first export milestone should target the Activities area only and be tested against a real current Orders workbook before expanding to Movement, Scouting, Transfers or GM Actions.

# Mandate production catalogue

The Turn Manager maintains a local SQLite catalogue seeded from **Mandate TN03 rev.N02.1 Feb 26 2026**.

The catalogue stores:
- Mandate skill names, groups and short forms from section 12.2.
- Fixed make/build recipes from the core activity tables, village production, refining, engineering and shipbuilding sections.
- Required skill levels, extra skill prerequisites, workers/AMs, resources, facilities and terrain/site conditions where stated.

## Turn Manager behavior

- Result short forms such as `For`, `Wd`, `ShB`, `ShW`, `Skn`, `Gut` and `Bon` are resolved through the Mandate skill dictionary and displayed using their full skill names.
- Clicking a skill in Turn Manager opens the associated Mandate production/build options in Draft Plan.
- Recipe cards show skill/resource shortfalls and other prerequisites, and can populate a Draft Plan activity.
- Shared worker limits now include activities that were previously absent from the catalogue, including Baking, Brick Making, Milling and Refining.
- Shipbuilding eligibility uses **Shipbuilding** while its shared worker limit uses **Shipwright**, matching sections 20.3–20.4.
- `SKIN&GUT&BONE` is treated as a compound activity. Workers are allocated as evenly as possible between Skinning, Gutting and Boning, reallocating workers when one component reaches its skill-derived maximum.

The seed version is kept in `src/mandate-catalog.js`. Increment `CATALOG_VERSION` whenever seed data changes so existing installations rebuild the SQLite catalogue on next launch.

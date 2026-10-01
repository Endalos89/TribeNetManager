# Item catalogue and artwork

Item pages show acquisition and usage tables built from the Mandate recipe index, current skill profiles, Research V2 creations and recipes, Orders implements, and imported Fair workbooks. Fair prices are attached to a specific Fair; the uploaded Year 903 workbook remains a historical fallback. Unknown rates, skill levels and methods are labelled rather than inferred. Fishing boats are excluded as Fishing implements.

Artwork uses a tribal/Viking inventory theme, preserving actual materials and species, with transparent 64×64 PNGs. The manifest contains only available files, so unfinished artwork does not cause broken image links. Canonical aliases share the same icon (for example Log/Logs); named material and research variants remain distinct.

126 of 569 icons are currently available. The remainder could not be generated after the image-generation service reached its daily usage limit. `src/item-icons/pending.json` records the remaining entries. Run `node scripts/item-catalogue.js` after adding more artwork to refresh the manifest and pending list.

Validation: the full project suite, item knowledge lookups (including alternative ingredients and research recipes), rendered DOM checks across ordinary/research/ship item pages, and all available icons' dimensions and alpha channels.

Visual review rejected incorrect depictions of Bakery (must be a facility), Barge (must be a transport barge), Coaster (must be a coastal ship), Chain/Chain Steel (must be mail armour), and CRobes (a finished good, not a crop). These entries remain in the pending list for source-led replacements.

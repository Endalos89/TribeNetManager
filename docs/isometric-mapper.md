# 3D Mapper

Open **3D Mapper** from the launcher and choose a submap or enter a coordinate. The original **Mapper** tile continues to open the top-down view. Both views use the existing local terrain data, selected Results turn, hex editor, history, movement planner, saved routes and unit overlays.

The new view uses software-rendered 3D terrain meshes under an north-up orthographic 3D projection. It requires no extra runtime dependency, CDN, image downloads or graphics service. Drag to pan, scroll to zoom, click to inspect, and use the Labels and Hex grid toggles as needed. Session restore remembers which projection was open.

## Terrain

- Forests, jungle, hills, mountains, snow, desert, swamp and open ground have terrain-specific geometry or details.
- Scenery is deterministically generated from the uppercase coordinate. Identical coordinates have identical details across installations running this renderer version.
- Neighbour-aware corners and shared edges connect the ground geometry. A world-space surface blends adjoining terrain and gives both owners of each shared vertex the same height and colour. Dry terrain never borrows the water colour.
- Oceans and lakes fill their entire hex. Coastal water and a bank extend into the adjacent land hex.
- Unknown terrain and unknown border regions are covered by opaque fog. Only terrain in the selected turn's cache contributes to transitions.
- Matching forests populate their shared boundaries to form continuous woodland. Hills use smooth, connected slopes rather than separate pyramid models.
- North is always vertically up. The 3D view zooms to 180; the original view retains its 68 limit. Selection tests the elevated surface.
- Geometry is culled to the viewport, scenery is simplified at low zoom, and an overscanned landscape buffer keeps normal panning responsive. Data/notes, zoom, viewport and display-density changes invalidate that buffer.

## Rivers

The current map data has no structured river-edge field. The hex editor therefore offers six River edges checkboxes, using the same map directions as movement commands. Choose edges and use **Save Hex**. Rivers follow shared edges and connect at corners; a mark on either bank is sufficient. Both banks must be known before a river is displayed across their border.

Edge annotations are stored in the existing notes field as `[Rivers: N, NE]`, preserving existing database backup/history support without a schema migration. Removing every edge removes the annotation. Existing notes are retained. Edges follow the existing editing permissions: historical Results knowledge remains read-only. Automatic extraction of river directions from report prose is not added by this change.

## Validation

- `node tests/isometric-mapper.test.js`: coordinate projection/inverse, deterministic variation, river annotations, physical shared endpoints across odd/even columns and submap boundaries, north-up orientation, continuous hill heights and dry/coastal colour boundaries.
- `node tests/isometric-browser.test.js`: optional Playwright browser fixture; launcher, terrain renderer, selection, river editing/save, zoom anchor, pan direction, classic view, shared notes, historical edit permissions, increased zoom limit, north-up projection, runtime errors. Requires a separately installed Playwright/browser. Electron IPC is represented by an in-memory fixture.
- Existing movement, fog, Results history/reprocessing, saved route, planned split and session restore regressions pass.
- The full `npm test` run is blocked by the pre-existing assertion `skill groups should filter the current skill table` in `tests/feedback-review-fixes.test.js`, invoked by the feedback annotations suite. The same assertion fails on the unmodified base commit.

Water is static in this first version. Windows/Electron installer testing remains separate from the browser verification.

## Unit gatherings and navigation

Units appear as small low-poly models standing on the sampled terrain, with a compact unit label. Each category independently uses digit counts: zero models for zero quantity, one for 1–9, two for 10–99, three for 100–999, and so on. Warriors carry shields and spears, actives carry tools, civilians wear hats, and horses and carts/wagons have their own models. Hover over a gathering for exact inventory counts. Planner hitboxes include the models and continue to open logistics.

The models use reported snapshots or planner movement-time inventory. People ride only when horses cover the entire population (including other reported people) and no carts/wagons are present. No composition is invented when data is missing. The position of each figure is seeded by its hex and unit code; each follows its ground height. Multiple units sharing a hex receive distinct group centres. Small clearings keep nearby trees out of gatherings.

Fog cover is drawn on the ground before scenery. Scenery bases in the concealed border are excluded, while visible crowns can project over fog naturally.

Pan/wheel input is coalesced to animation frames. During navigation the padded terrain image is translated/scaled and hit-testing uses the same transform. Detailed rendering resumes 150 ms after movement stops. Models are drawn with the current projection; no terrain rebuild is needed for their animation-free figures. Clearings are invalidated when unit locations change.

Validation covers logarithmic count boundaries, deterministic formations, mounted eligibility, ground elevations, exact-count hover, planner hitboxes, deferred landscape rebuild and existing mapper navigation/editing.

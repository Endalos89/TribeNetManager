# 3D Mapper

Open **3D Mapper** from the launcher and choose a submap or enter a coordinate. The original **Mapper** tile continues to open the top-down view. Both views use the existing local terrain data, selected Results turn, hex editor, history, movement planner, saved routes and unit overlays.

The new view uses software-rendered 3D terrain meshes under an north-up orthographic 3D projection. It requires no extra runtime dependency, CDN, image downloads or graphics service. Drag to pan, scroll to zoom, click to inspect, and use the Labels and Hex grid toggles as needed. Session restore remembers which projection was open.

## Terrain

- Forests, jungle, hills, mountains, snow, desert, swamp and open ground have terrain-specific geometry or details.
- Scenery is deterministically generated from the uppercase coordinate. Identical coordinates have identical details across installations running this renderer version.
- Neighbour-aware corners and shared edges connect the ground geometry. A world-space surface blends adjoining terrain and gives both owners of each shared vertex the same height and colour. Dry terrain never borrows the water colour.
- Oceans and lakes retain water at their reported hex centres. Shared edge/corner sections shape irregular coastlines while central hexes retain their own terrain; these visual contours do not change terrain codes, movement or selection ownership.
- Unknown cores are covered by opaque fog. Edge sections require both owners to be known; corner sections require all three. Only terrain in the selected turn's cache contributes.
- Matching forests populate their shared boundaries to form continuous woodland. Hills use broad, layered rises; mountains use taller, sharper connected ridges. Neither uses separate hill/mountain props.
- North is always vertically up. The 3D view zooms to 180; the original view retains its 68 limit. Selection tests the elevated surface.
- Geometry is culled to the viewport, scenery is simplified at low zoom, and an overscanned landscape buffer keeps normal panning responsive. Data/notes, zoom, viewport and display-density changes invalidate that buffer.

## Rivers

The current map data has no structured river-edge field. The hex editor therefore offers six River edges checkboxes, using the same map directions as movement commands. Choose edges and use **Save Hex**. Rivers follow shared edges and connect at corners; a mark on either bank is sufficient. Both banks must be known before a river is displayed across their border, and river segments in corner sections remain hidden until all three owners are known.

Edge annotations are stored in the existing notes field as `[Rivers: N, NE]`, preserving existing database backup/history support without a schema migration. Removing every edge removes the annotation. Existing notes are retained. Edges follow the existing editing permissions: historical Results knowledge remains read-only. Automatic extraction of river directions from report prose is not added by this change.

## Validation

- `node tests/isometric-mapper.test.js`: coordinate projection/inverse, deterministic variation, river annotations, physical shared endpoints across odd/even columns and submap boundaries, north-up orientation, continuous hill heights and dry/coastal colour boundaries.
- `node tests/isometric-browser.test.js`: optional Playwright browser fixture; launcher, terrain renderer, selection, river editing/save, zoom anchor, pan direction, classic view, shared notes, historical edit permissions, increased zoom limit, north-up projection, runtime errors. Requires a separately installed Playwright/browser. Electron IPC is represented by an in-memory fixture.
- Existing movement, fog, Results history/reprocessing, saved route, planned split and session restore regressions pass.
- `node tests/isometric-ground.test.js`: executes the renderer on a recording canvas to check the segmented detail mesh, deterministic geometry, hit testing, landscape caching, terrain edit invalidation and zoom. This test also runs through the isometric mapper suite.

Water is static in this first version. Windows/Electron installer testing remains separate from the browser verification.

## Unit gatherings and navigation

Units appear as small low-poly models standing on the sampled terrain, with a compact unit label. Each category independently uses digit counts: zero models for zero quantity, one for 1–9, two for 10–99, three for 100–999, and so on. Warriors carry shields and spears, actives carry tools, civilians wear hats, and horses and carts/wagons have their own models. Hover over a gathering for exact inventory counts. Planner hitboxes include the models and continue to open logistics.

The models use reported snapshots or planner movement-time inventory. People ride only when horses cover the entire population (including other reported people) and no carts/wagons are present. No composition is invented when data is missing. The position of each figure is seeded by its hex and unit code; each follows its ground height. Multiple units sharing a hex receive distinct group centres. Small clearings keep nearby trees out of gatherings.

Fog cover is drawn on the ground before scenery. Scenery bases in the concealed border are excluded, while visible crowns can project over fog naturally.

Pan/wheel input is coalesced to animation frames. During navigation the padded terrain image is translated/scaled and hit-testing uses the same transform. Detailed rendering resumes 150 ms after movement stops. Models are drawn with the current projection; no terrain rebuild is needed for their animation-free figures. Clearings are invalidated when unit locations change.

Validation covers logarithmic count boundaries, deterministic formations, mounted eligibility, ground elevations, exact-count hover, planner hitboxes, deferred landscape rebuild and existing mapper navigation/editing.

## Unit selection

In the 3D view, a simple click anywhere on an occupied hex selects the first unit (natural unit-code order). Repeated clicks select each remaining unit, then the land hex, then restart. Report and planned endpoint records are deduplicated by unit code. Clicking another hex, changing the turn/unit roster or reopening a mapper view restarts the cycle. Dragging does not advance it; active movement planning bypasses the cycle so route selection works normally.

Reported units open their selected-turn population/inventory and reported weight/capacities even without a planning workbook. Unknown logistics are shown as unavailable rather than inferred from another turn. Planned-only units retain movement-time logistics. The selected unit label is highlighted.

Wagons face diagonally with a raised bed and vertical wheel discs projected in the axle plane. Rear wheels render behind the bed, with the near wheels in front.

## Layered world terrain

The ground uses a voxel-inspired layered height surface (not a volumetric cube engine). Shared seeded noise defines broad hill rises and narrower mountain ridges; strata have bevelled transitions and patchy exposed stone. Hill boulder props and detached mountain scenery are removed. Hill stone is sparse; Low Mountains expose more rock and rise higher; HSM/ALPS have taller, sharper rocky/snowy profiles. The distinction is visual and does not alter the movement engine's passability or costs.

The detail mesh has eight subdivisions per wedge edge, or 384 base ground triangles per hex: four times the previous 96. Triangles are then clipped to the exact core/edge/corner boundaries, giving 522 visible/fog polygon fragments per detailed hex. Below scale 43 it uses four subdivisions; below 28 it uses two. A frame uses one resolution throughout to keep shared edges aligned. Ground shape generation is independent of zoom. The landscape buffer is still reused during navigation; terrain-cell caching avoids repeated report lookups per vertex.

The shared relief seed is deliberately advanced to `tribenet-world:relief-v2` for this replacement. The independent `tribenet-world:scenery-v1` seed is unchanged. Neither depends on installation, time, turn or discovery order. Same known terrain and renderer version produce the same landscape. Revealing neighbours unlocks shared sections; it does not reshape the already generated core.

## Segmented reveal and coasts

Each game hex has a smaller central hex (62% radius), six halves of shared quadrilateral edge sections, and six portions of shared triangular corner sections. A core generates from its own reported terrain as soon as that terrain is known. An edge section requires both owning hexes to be known; a corner requires all three. All-owner checks apply even if one owner's interpolation weight is zero. There is no inference from an unknown neighbour.

The core uses only its own terrain for colour, elevation and water identity, so later discoveries cannot regenerate it. Shared regions blend their two or three owners with continuous weights; world-space relief and the shared seed join their slopes. Coastlines, headlands and inlets are confined to shared regions. The whole central hex retains its terrain, including land/water identity. Exact polygon clipping prevents partially revealed edge/corner triangles. Fog keeps its existing opaque colour.

The previous straight hex-edge coastline strokes and separate hill rocks are removed. Shared coastal ground descends through layered slopes and beach material to level water. Selection and movement still use the original full game hexes; the segmentation is visual, with no new orders or database state. Rivers stop at unrevealed corner regions.

Stone patches are surface materials on exposed strata of hills and mountains. Trees remain restricted to wooded types D/DH/CH/JG/JH/LCM/LJM and avoid unrevealed sections, water, shoreline overhang, steep slopes, exposed elevations and rocky patches. Brush retains low shrubs.

Validation covers one/two/three-owner reveal progression, unchanged cores after neighbouring discoveries, core terrain purity, full-area coverage at every level of detail, deterministic installations, and the actual renderer's geometry, selection and caches.

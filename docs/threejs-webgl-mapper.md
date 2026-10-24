# Three.js / WebGL 3D Mapper (October 2026)

## Architectural contract

The previous mapper rasterised every software-defined 3D polygon into a Canvas 2D tile. The new primary 3D backend uses **Three.js r186 (0.186.1)**, bundled at build time with **esbuild**, with no network dependency. It retains the existing immutable world seed (\`1790425012\`), deterministic terrain samples, core/square/triangle discovery rules, turn history, movement/scouting orders, and original selectable gameplay hex coordinates.

**Layers (back to front):**

1. \`#terrainWebGL\` — opaque GPU canvas containing terrain, discovered/fog/water surfaces, dense instanced forests, and instanced tribe/scout miniatures.
2. \`#mapCanvas\` — transparent Canvas 2D for hex/unit selection, coordinates and labels, movement/scouting arrows, resource icons, river route annotations, overlays and hover popups.
3. DOM controls and dialogs — unchanged.

The classic 2D mapper is unaffected. A WebGL/context error sets the GPU backend to unavailable and falls back to the prior software renderer, with an explicit console diagnostic.

### Conversion

\`src/isometric-webgl.js\` is an ES module; \`npm run build:mapper\` bundles it and the pinned npm dependency into \`src/isometric-webgl.bundle.js\` (IIFE), loaded after existing geometry/unit modules. The generated bundle is deliberately **not fetched from a CDN**. It is created by \`prestart\`, \`pretest\`, \`pretest:mapper\` and \`predist\` to ensure development, testing and packaged installers all embed the same local implementation.

The existing \`IsoGeometry.regionMesh\` and \`IsoGeometry.surface\` remain the terrain sampling source of truth. Geometry polygons are triangulated into \`BufferGeometry\` with world-space vertex colours. No gameplay data is mutated by rendering.

### Projection

World coordinates map to Three.js as:

\[
(x,y,z)_\mathrm{TribeNet} \mapsto (1.5x,\ z,\ 1.5y)_\mathrm{Three}.
\]

The orthographic camera is oriented at \((0,0.62D,0.78D)\) relative to the chosen map centre, and its frustum is sized from \`state.scale\` and the actual canvas client dimensions. This reproduces the established 2D projection \`screenY = 0.62(1.5\,dy)-0.78\,z\`; screen X is \`1.5\,dx\`. Selection uses raycasting onto the same triangles, then \`IsoGeometry.regionAt\` to select the unchanged gameplay hex.

### Performance measures

- 4×4 game-hex **cached terrain chunks**, with complete chunk contents regardless of initial viewport clipping.
- Chunk keys include coordinates and LOD. A camera move reuses resident GPU buffers.
- At most **2 chunks generated per frame** (3 for the first frame); remaining chunks are scheduled via requestAnimationFrame.
- Bounded GPU chunk cache (90 chunk/LOD combinations). Geometry is disposed on eviction or terrain knowledge changes.
- Adaptive LOD: 2 at far zoom, 4, 8, 12 and up to user-selected close-up quality at high zoom.
- Trees use **shared cone and trunk geometry with InstancedMesh** (3 draw calls/chunk maximum, rather than separate CPU-painted polygons).
- Unit models use **GPU instancing** for body, head, horse and cart components. Their layout is computed by the existing die-spacing and shared-square movement logic.
- The previous eager background routine for *every discovered hex* is suspended when WebGL is available; GPU chunks are built progressively based on the visible viewport.
- Terrain Dev has local tree-size and density tuning controls. User overrides remain local and the fixed world seed is unchanged.

### Test gate

The Windows release workflow runs \`npm test\` (including static generation and route/unit regressions), then the **real Microsoft Edge WebGL smoke test**. This test requires \`IsoMapper.renderer === 'WebGL'\`, an actual mounted GPU canvas, non-flat rendered colour pixels, GPU draw calls, and chunk reuse while panning. Failed WebGL rendering must fail CI, rather than silently passing on Canvas 2D. The existing Windows installer upgrading test and publishing gate remain.

### Known limitations and follow-ups

- Browser machines without hardware WebGL can fall back to the old 2D rasteriser; this is intentionally separate from the primary 3D path.
- Some text and route effects remain 2D by design; these are interface information, not terrain geometry.
- Terrain generation itself still calls the existing JavaScript function when a **new** chunk is built. Further gains are possible by moving mesh generation into a Web Worker, introducing polygon-index buffers and using on-GPU heightfield deformation.
- New generation rules (plain/hill transition and water-level semantics) should be tuned separately from rendering migration to avoid changing existing revealed terrain unexpectedly.


## 24 October 2026: Smooth chunk streaming, lowland and water tuning

- The GPU chunk manager preloads a **one-chunk ring** beyond visible chunks. It prioritises a low-resolution visible mesh, then sharpens to the requested LOD and warms nearby cells. Generation occurs in short idle-time jobs so pan/wheel input stays responsive. An already resident LOD is retained while its replacement loads; chunks are never deliberately hidden merely because the requested zoom crosses a detail threshold. Returning from classic mode resumes outstanding tasks. LRU disposal caps the cache at 160 chunk/LOD records and preserves visible resident geometry first.
- The fixed seed and gameplay terrain codes are unchanged. The new \`waterHeight\` parameter sets the shared lake/ocean plane and the height of coastal intersections (default **0.10 terrain height units** versus PR base ~0.14). This is a *visual* offset and must not alter passability or introduce water into authoritative land cores.
- PR gains world-coherent, low-amplitude \`plainsRelief\` (default 0.055) and \`plainsTexture\` (default 0.22). These gently modulate height and colour, rather than adding mountain ridges to flat terrain.
- Ocean/lake colouring adds seeded depth/shallow-water variation. GPU wave crest lines are **static and batched by chunk**; they appear more frequently near the shoreline and are tuned with \`waveStrength\` (default 0.55). No continuous water-animation redraw is required.
- Every Terrain Dev parameter now provides a numeric input beside its slider. Inputs clamp to declared limits; sliders are throttled to avoid repeatedly throwing away the terrain caches mid-drag. Local preset JSON exports include the new values and preserve all prior settings. The immutable world seed is not user-editable.
- Browser regression tests must verify WebGL remains visible at zoom threshold transitions and that the numeric sea-height setting is actually applied and exported. Node tests cover the water plane, low-lying plains and fallback renderer.


## October 2026 — terrain polish, LOD and grounding

The on-screen 3D renderer now builds **2×2 world-hex GPU chunks** (rather than 4×4), making each synchronous mesh generation job substantially smaller at high zoom. A two-chunk prefetched ring covers the same physical margin as the previous four-hex ring, while up to 256 chunk/LOD meshes are retained. Current visible meshes remain on screen as detail is regenerated. The existing idle scheduler, turn-specific fog and global permanent seed are unchanged.

The **Terrain Dev** constraints were expanded: Hill height and Mountain height now permit zero (the sliders scale the whole landform including its prior minimum baseline), and Water level now permits up to 0.50. New **Foothill flat approach** (0–0.45, default 0.20), **Cliff rock exposure** (0–1, default 0.85), and **Coast geometry detail** (8–32, default 24) parameters are included in local presets and numeric editing. Land core terrain type and the permanently fixed `1790425012` seed are unaffected.

The PR-to-GH/HSM height blend is now **nonlinear**: low influence from adjoining hills produces a predominantly flat connector first, then foothills, then the full known hill or mountain core. This elevation curve does not alter biome ownership proportions or fog reveal conditions. Bare rock is assigned to steep rendered slopes, preventing green triangular cliff faces, and naturally appearing on sharper mountain slopes. Mixed land/water hexes are selectively tessellated at higher resolution to reduce angular coastline silhouettes. Coast height and water remain continuous on the same adjustable water plane.

Three.js unit grounding now samples the currently rendered mesh by a cached downwards raycast per figure, ensuring its model feet cannot sit below the actual GPU terrain triangles even if the analytic height field differs slightly from coarse LOD geometry. This lookup is cached and cleared when terrain meshes change.

Regression coverage requires water and terrain limits, seeded foothill behaviour, actual WebGL-rendered unit grounding, GPU zoom continuity, hex picking, and existing Windows installer upgrade tests.


## 24 October 2026 — fixed 8 subdivisions, approved preset, coastal corners, smaller grounded units

- **One mesh topology for all camera scales**: both WebGL and the software fallback use exactly **8 radial subdivisions per world hex**. GPU chunks are no longer keyed/generated at alternative LOD values, and zooming does not change the terrain shape. Existing world coordinates, discovery rules, seed and Orders logic remain unchanged. The *Coast geometry detail* setting is kept separate from this base terrain subdivision count.
- **Shoreline-only micro-refinement**: when a known tile borders known water, coastal faces are split *only where sampled water/land classification changes*, recursively into four smaller triangles up to the shoreline detail level. The approved shoreDetail=20 corresponds to two micro-refinement rounds on an eight-step base mesh (effective local sampling finer than the rest of the land). Three-owner corner regions use the same seeded world-coordinate classifier, so headlands and coves are not limited to a single long straight triangle edge. This micro-refinement is not tied to camera zoom.
- **Final user-approved production defaults**: hillAmplitude=0.20, mountainHeight=0.50, ruggedness=0.28, ridgeSharpness=4.7, coastWaterShare=0.35, coastRoughness=0.30, rockExposure=0.62, meshQuality=8, unitSpread=0.38, treeSize=0.65, treeDensity=4.75, waterHeight=0.50, plainsRelief=0.045, plainsTexture=0.50, waveStrength=0, foothillFlatness=0.21, cliffExposure=0.50, shoreDetail=20. All other original stored world/data are unchanged. These are the defaults for new installations and **Reset defaults**. Existing local customised presets are not overwritten.
- **GPU unit models 50% scale**: horses, carts, heads and bodies are all scaled equally to 0.5 of their prior 3D dimensions; all vertical anchor offsets scale too. The sole of each model is computed from a raycast against visible ground meshes in the surrounding 3×3 chunk neighbourhood, including shared squares/corners that span chunk boundaries; the model foot is placed a small positive distance above the actual rendered mesh. If no chunk is present yet, analytic ground height is used until the mesh arrives.
- **Regression gates**: approved defaults match the exported JSON; zoom never creates a non-eight-step GPU chunk; unit matrices are half-scale and soles are above the actual drawn geometry; world seed is immutable; original game hex selection and coastal discovery remain unchanged.


## 24 October 2026 — persistent submap cache, watertight shores, unit support

**Map knowledge is not GPU geometry.** Records for the current **30×21-hex submap and its eight adjacent submaps** remain within a 3×3 knowledge window. Zooming or panning within the window does not query the database again. Crossing a submap boundary loads only newly entered submaps while retaining overlapping submaps. Globally retained game history and discovered-hex knowledge are never discarded by renderer eviction.

The GPU maintains a separate bounded **520-chunk** cache (each chunk spans 2×2 gameplay hexes), reusing uploaded geometry at every zoom. Existing meshes and unfinished tasks survive camera changes; visible chunk requests take priority over nearby and background submap preloading. To avoid excessive GPU memory, geometry is warmed opportunistically within the current/adjacent submaps rather than generating all nine entire submaps in one batch. Chunks outside the new 3×3 window are evicted when the camera leaves the vicinity. IsoMapper tracks terrain type changes individually and invalidates only nearby geometry; Terrain Dev changes are explicit full invalidations.

The coastal triangle subdivision is **conforming**: every triangle in a coastal piece is refined at the same level, regardless of whether each triangle individually crosses water. The earlier local early-exit introduced T-junctions and black gaps along cliff and shoreline triangles. Coast ownership, seeded shape and terrain type remain unchanged.

**Unit grounding and actual feet:** Point-only grounding on sloped terrain could leave parts of a miniature behind or inside a neighbouring triangle. Nine points across each unit's footprint now establish the highest actual visible mesh support (with deterministic analytic fallback). The support value is cached by position and mesh revision; building an unrelated chunk does not disturb it. GPU figures have two visible legs, horses four legs, and carts wheel instances, all at the previously requested 50% scale. Unit gameplay coordinates and movement orders are unchanged.

Regression gates include no database reads during repeated zooms inside the same 3×3 knowledge window, retaining local GPU meshes after a distant terrain reveal, unit feet supported above the real mesh, and equal coastal triangle subdivision to avoid T-junctions.

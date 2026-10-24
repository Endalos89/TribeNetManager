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

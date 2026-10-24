# Persistent 3D terrain geometry cache

The mapper stores generated GPU geometry locally under Electron's per-user
\`app.getPath('userData')/terrain-mesh-cache-v1\` (on Windows, inside the
application's AppData directory). No hosting, account, or network access.

## Cache hierarchy

1. **Disk**: gzip-compressed JSON with Float32-compatible ground positions,
   vertex colours, coastal wave lines, and instanced tree transform matrices.
   Files are named by SHA-256 digest of their complete identity and written via
   a temporary file plus rename. No untrusted paths are accepted.
2. **RAM / GPU**: the existing chunk cache uploads the saved vertex arrays,
   with existing scene materials and shared forest geometries, without calling
   the terrain sampling or tree generation functions. Visible chunks retain
   priority; 2x2-hex chunk prefetch is unchanged.
3. **Generation**: a missing, invalid, or corrupt disk entry falls back to the
   deterministic world terrain generator and is saved for future visits.

Persistent cache keys include:
- fixed world seed \`1790425012\`;
- renderer topology / algorithm revision, **not the application version**;
- exact 2x2-hex chunk ID and fixed 8-subdivision mesh quality;
- canonical Terrain Dev generation settings;
- **current turn-visible** terrain or unknown state within a two-hex halo
  around the chunk, covering owners of shared squares and triangles.

The two-hex halo is essential. A core is immutable once discovered, but
border squares and corner triangles become known when their neighbours are
revealed. Newly known terrain changes only the fingerprints of nearby chunks
and generates new geometry; unchanged chunks remain valid. Historical playback
uses a different fingerprint whenever its known/unknown state differs, so
saved future discoveries cannot leak onto an earlier turn.

Tree positions are immutable world scenery and are no longer suppressed at the
positions of units from the current turn. Moving units and their models are
always rendered dynamically, never written into the disk terrain cache.

The app can evict a GPU chunk for performance without evicting the disk copy.
Disk files survive program upgrades. To avoid unlimited usage the local store
has a 512 MiB / 18,000-file budget, pruning old entries by last access; invalid
or corrupted entries are ignored and removed. A generator algorithm change
requires deliberately updating the generation revision, not clearing the
entire cache simply because the app version increases.

## Startup / lifecycle

The first time a discovered region is seen, a chunk is generated during idle
time, uploaded to the GPU, and saved asynchronously. Future launches read
existing compressed files asynchronously and reconstruct the Three.js buffers
without recalculating terrain. Neighbouring **submap records** are kept in memory, but GPU geometry generation
is deliberately restricted to visible 2x2-hex chunks and at most **96 offscreen
chunks** in a two-chunk ring surrounding the viewport. Once this finite set
has been generated or restored, a stationary camera must stop generating
terrain. Panning into a new area loads additional meshes from disk first, then
generates only genuinely new geometry. Unneeded 3x3-submap GPU pre-generation
was removed because it exceeded the 520-chunk GPU LRU and forced otherwise
useful meshes out of memory. There is no long blocking startup
operation and already discovered gameplay data remains in the existing DB.

Terrain Dev displays disk hits, misses, writes and generated chunk counts.
A new terrain tuning preset may cause an initial rebuild under its own cache
identity; using that preset again reuses those files.

Tests cover real compressed disk round trips across cache instances, key
isolation, corrupted cache recovery, pruning, and an actual Edge/WebGL test
that destroys GPU meshes and verifies they are reloaded without incrementing
the terrain generation count.


Terrain Dev reports resident GPU chunks, pending work, the offscreen prefetch target and eviction count, in addition to disk hits and mesh generations. The 3x3 data window is **not** a promise that all nine entire submaps are kept as GPU meshes.


## 24 October 2026 — prevent zoom-driven cache eviction

Camera movement caused by cursor-anchored wheel zoom can move the camera **centre** into a neighbouring submap even when the user is still viewing largely the same terrain. The earlier `dropDistantSubmaps()` implementation immediately disposed all GPU chunks outside the current 3×3 knowledge window, regardless of GPU usage. Consequently `evictions` increased despite only 168–177 chunks being resident under a 520-chunk limit, causing expensive disk restoration and mesh reconstruction on zoom-out.

**Retention invariant:** Submap transitions never evict already-uploaded GPU geometry while the cache remains below its memory limit. Crossing the boundary may cancel speculative *pending jobs*, but resident meshes are retained. `evictUnused()` alone performs LRU memory-pressure eviction when the resident count exceeds `MAX_CHUNKS`. Actual terrain knowledge changes and Terrain Dev adjustments still invalidate affected meshes as appropriate; disk copies persist.

**Interaction invariant:** While `IsoMapper.interacting` is true during wheel zoom or drag, scheduled idle geometry and disk loads pause. Rendering continues to reuse already-uploaded meshes. On the settled redraw (~150ms after interaction), missing visible meshes and the nearby prefetch margin are queued again. This avoids a burst of CPU triangulation or GPU buffer disposal interrupting zoom events.

A real WebGL browser test uses cursor-anchored zoom close to a 30-column submap boundary and verifies the boundary actually changes, the GPU cache remains below capacity, the number of evictions does not increase, and resident Three.js mesh geometries retain identical UUIDs. Tests must fail if boundary changes start destructively purging GPU chunks again.


## Fixed-size camera-centred geometry residency (October 2026)

The 3×3 **submap record** window continues loading underlying gameplay terrain data independently of zoom. The GPU geometry working set is now a separate, **fixed 13×13 square of 2×2-hex chunks** (169 chunks) around the world-space camera centre, with a three-chunk movement hysteresis. The centre and area are computed using world-hex coordinates, never current screen zoom or viewport size. As the camera genuinely pans away, a new fixed footprint is queued, but previously uploaded chunks are retained until the 520-chunk LRU limit is reached. Zooming in does not shrink this focus region and zooming out does not discard its contents; any visible chunks outside the focus square are added as on-demand geometry rather than leaving holes. The 8-subdivision geometry and per-turn fog keys are unchanged.

The *Terrain Dev* statistics have been separated: **memory evicted** counts only actual LRU capacity evictions, **terrain changed** counts geometry invalidated by newly known or corrected terrain data, and **cache resets** counts explicit full invalidations (e.g. changing a terrain-generation preset). Previously, all three events were lumped together under `evicted`, obscuring the reason. The HUD also shows the stable centre-area target so zoom culling cannot be confused with GPU unloading.

The full-browser regression waits for all 169 focus meshes to be cached and then zooms in and out repeatedly without changing the centre: the exact set of focus chunks, resident buffer count, number of mesh generations, disk restores, memory-pressure evictions and terrain invalidations must remain unchanged. This ensures new releases cannot accidentally reintroduce a zoom-dependent geometry preload footprint.


## 24 October 2026 — durable core geometry and hydrated submap knowledge

The mapper now distinguishes an **immutable inner-core buffer** from an independent
**shared border/corner GPU buffer**. Inside a 2×2-hex chunk each known inner core
is generated using the fixed 8-subdivision topology and held alongside shared
regions (which depend on adjacent known/unknown terrain state). The core's
GPU vertex buffer and seeded forest instances remain resident when a neighbour
is revealed: only the shared border/corner buffer is updated. Genuine changes
to the owner's own terrain still rebuild that owner's containing chunk.

Disk storage is versioned as **format 2**, storing separate position and colour
arrays for immutable core and transition triangles. A new generator fingerprint
(`terrain-fixed8-shore-components-20261024-r2`) ensures older combined files
are never misread; legacy files are left alone until ordinary disk budget
pruning. The first v2 render can regenerate chunks once; subsequent launches
load core+shared buffers from disk using the exact historical known-state key.

A 3×3 submap **knowledge hydration barrier** prevents any disk restoration or
geometry construction while records for one of the nine required neighbouring
submaps are still being fetched asynchronously. This avoids repeatedly building
fog geometry against temporarily missing known rows, then discarding it when
those rows arrive. Existing resident geometry is still rendered during an
outstanding request. Once all records have arrived the queued meshes resume.

A revisioned Map tracks terrain-code changes and river-note changes separately.
Zoom, pan, mouse interaction and frame redraws do not increment either revision;
unchanged revisions mean no full terrain snapshot scan and no invalidation.
Historical turn playback has its own visibility revision and baseline state, so
replay discoveries continue to update the appropriate shared regions.

**Terrain Dev** now shows core rebuilds, shared-border updates, awaiting
submaps, CPU milliseconds spent generating geometry and milliseconds spent
restoring cached geometry. The CPU metrics are cumulative and complement the
much smaller GPU submission time. Browser tests exercise real mouse-wheel
zoom while a database query is delayed, proving that no geometry can be built
against incomplete knowledge, and that a neighbour reveal preserves inner-core
GPU geometry and forest instances.

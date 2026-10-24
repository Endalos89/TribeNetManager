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

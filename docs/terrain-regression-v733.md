# Terrain regression: v0.1.717 to v0.1.733

## Causes

* v717 used the same piecewise-linear pair weights on squares and corner boundaries. v733 replaced only the square curve with Hermite interpolation. The corner's linear fan agreed at endpoints and midpoints but not between them. The corner now evaluates the identical Hermite boundary curve before interpolating towards its seeded centre.
* Coastal thresholds were calibrated per pair in squares but used a separate constant in corners. They now extend the same pair thresholds continuously into corners.
* Quantising shared elevation with a varying layer thickness produces contour-shaped risers. Blending already-quantised hill/plain surfaces still imports their strata. Shared slopes now use continuous relief with a small core residual that fades into the connector. The immutable core retains its existing strata and shape.
* Coastal refinement adds vertices along coarse core edges and along tile edges beside inland tiles. Resampling the nonlinear surface there produces T-junction height cracks. Those vertices now interpolate the existing coarse boundary, with a piecewise shoreline intersection where needed. There is no global subdivision increase.
* Culling a whole clipped polygon using only its first three vertices can discard a valid polygon whose first fan triangle is degenerate. Triangulation now precedes culling/shading. Float32 culling removes exactly collapsed projected triangles, not an arbitrary positive area.
* The previous cove mostly recoloured the unmodified cliff. Selected squares now contain a low shelf and some a continuous ascent profile. Compact lateral support ends before square sides; features cannot jump across corner pair-selection boundaries or alter cores. Beach material is retained in slope shading.

## Validation

* Cross-square/corner sampling across PR/GH/CH, mountain, ocean and lake combinations, all six directions. Maximum height difference across the two 0.00001 offsets: approximately 0.000204 (finite slope, not a jump).
* Actual uploaded Float32 edges in a mixed six-chunk fixture: 1,367 failing boundary segments in v733 versus zero after correction. Corrected fixture checks 5,048 unmatched coarse/fine edge segments, including T-junctions. The previous result included missing coverage as well as height mismatches.
* The fixture contains 138,903 triangles versus 138,814 before: 89 recovered triangles, not increased mesh density.
* 63 pure-core samples across terrain families and near/far world coordinates match recorded v733 heights to 1e-12.
* Landing tests measure above-water low shelves beside higher rocky flanks, in addition to deterministic rarity and core exclusion.
* Representative actual worker triangles were rendered before and after for visual inspection. CI additionally captures real Windows Three.js renders for mixed hill/mountain/coast terrain and a selected landing cove.

The user's local saved terrain database was not supplied. Render fixtures use deterministic representative terrain assignments, not a claim to reproduce the exact PK map. Existing loading, camera, residency, discovery workset and disk-cache policies are unchanged. The generator revision invalidates stale mesh geometry.

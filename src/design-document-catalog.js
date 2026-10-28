'use strict';

module.exports = [
  {
    id: 'isometric-mapper',
    filename: 'isometric-mapper.md',
    title: '3D Mapper',
    status: 'Partially built',
    summary: 'The 3D Mapper is in use. Terrain and coast presentation still has follow-up work.',
    built: [
      'Three.js/WebGL terrain rendering with a Canvas overlay for map controls, labels, routes and selection.',
      'Map inspection, results history, movement and scouting overlays, with the 2D view retained.'
    ],
    partial: [
      'Terrain transitions and coastal presentation continue to need visual refinement.'
    ],
    notBuilt: [
      'Some visual follow-ups in the design are still pending; see the terrain generation and WebGL documents.'
    ]
  },
  {
    id: 'hex-terrain-generation-design',
    filename: 'hex-terrain-generation-design.md',
    title: 'World Terrain Generation',
    status: 'Partially built',
    summary: 'The shared-region terrain system is implemented, while some coast and transition details remain under refinement.',
    built: [
      'Shared inner-hex, square and triangular terrain geometry with discovery based on known neighbours.',
      'Deterministic terrain generation, terrain developer controls and the 3D Mapper integration.'
    ],
    partial: [
      'Coast, cove, cliff and terrain-transition appearance still needs refinement against the design.'
    ],
    notBuilt: [
      'The requested final visual treatment for occasional beaches and ascent paths is not yet complete.'
    ]
  },
  {
    id: 'persistent-terrain-mesh-cache',
    filename: 'persistent-terrain-mesh-cache.md',
    title: 'Persistent Terrain Cache',
    status: 'Partially built',
    summary: 'Disk caching and camera-independent terrain residency are implemented; remaining work is regression validation.',
    built: [
      'Persistent local terrain geometry cache with hashed identities and safe file writes.',
      'Camera-independent resident terrain area, startup hydration and cache diagnostics.'
    ],
    partial: [
      'The latest zoom, pan and region-transition paths still need regression checks against reported visual gaps.'
    ],
    notBuilt: [
      'No separate unimplemented cache feature is listed; the open item is validating the cache during terrain transitions.'
    ]
  },
  {
    id: 'threejs-webgl-mapper',
    filename: 'threejs-webgl-mapper.md',
    title: 'Three.js / WebGL Mapper',
    status: 'Partially built',
    summary: 'The WebGL rendering architecture is live. Terrain continuity and visual polish remain active follow-ups.',
    built: [
      'Bundled Three.js/WebGL terrain rendering with instanced trees and units.',
      'Canvas overlay for selection, labels, routes, resource markers and interaction controls.'
    ],
    partial: [
      'Chunk streaming, terrain grounding and coast transitions have documented follow-ups and need ongoing validation.'
    ],
    notBuilt: [
      'Some known rendering limitations and visual follow-ups in the document remain open.'
    ]
  },
  {
    id: 'orders-workbook-lifecycle-design',
    filename: 'orders-workbook-lifecycle-design.md',
    title: 'Orders Workbook Lifecycle + Export Safety',
    status: 'Partially built',
    summary: 'Unified import, Mapper planning and turn completion design. Each turn has one export in the installation folder; re-export replaces it. Full sheet coverage and lifecycle safeguards remain planned.',
    built: [
      'Manual Orders template import and Ravenpost template retrieval.',
      'Workbook export from a fresh template copy for currently supported order data.',
      'Saved planning data for movement, scouting, activities, transfers, unit splits and skill attempts.'
    ],
    partial: [
      'Existing Mapper overviews cover only some order sheets, and related orders are stored across separate planning stores.',
      'Workbook validation and export coverage do not yet cover every editable sheet in the design.'
    ],
    notBuilt: [
      'Dedicated editable overviews for Comments, GM Actions, Tribes_Activities, Tribe_Movement and Research_Attempts.',
      'Automatic completion of turn N when the blank workbook for N+1 arrives, while retaining N and activating N+1.',
      'Read-only file scanning with no path that clears a saved plan.'
    ]
  },
];

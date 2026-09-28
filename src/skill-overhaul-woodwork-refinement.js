(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S) return;
  const woodwork = S.profile('Woodwork');
  if (!woodwork) return;

  woodwork.directCrafts = [
    { level:1, entity:'Club', label:'Clubs ×4', detail:'Makes four Clubs. In forest/jungle no Logs are needed; elsewhere one Log makes four Clubs.', source:'13.1.37' },
    { level:2, entity:'Paddle', label:'Paddle', detail:'Makes a Paddle.', source:'13.1.37' },
    { level:3, entity:'Rake', label:'Rake', detail:'Makes a Rake; a person with a Rake can plow 1 acre.', source:'13.1.37' },
    { level:3, entity:'Wagon', label:'Wagon', detail:'Makes a Wagon.', source:'13.1.37' },
    { level:3, entity:'Oar', label:'Oar', detail:'Makes an Oar.', source:'13.1.37' },
    { level:4, entity:'Frame', label:'Frames ×2', detail:'Makes two Frames from one Log. Frames are then used by Leatherwork recipes.', source:'13.1.37' },
    { level:4, entity:'Chair', label:'Chair', detail:'Makes a Chair.', source:'13.1.37' },
    { level:4, entity:'Bench', label:'Bench', detail:'Makes a Bench.', source:'13.1.37' },
    { level:4, entity:'Plank', label:'Planks ×2', detail:'Makes two Planks used for ship repair.', source:'13.1.37' },
    { level:5, entity:'Bed', label:'Bed', detail:'Makes a Bed.', source:'13.1.37' },
    { level:5, entity:'Podium', label:'Podium', detail:'Makes a Podium.', source:'13.1.37' },
    { level:5, entity:'Table', label:'Table', detail:'Makes a Table.', source:'13.1.37' }
  ];

  woodwork.requiredUses = [
    { level:3, entity:'Drum', label:'Drum', requirements:[{skill:'Music',level:1}], detail:'Musical instrument construction.', source:'13.1.23' },
    { level:3, entity:'Courthouse', label:'Courthouse', requirements:[{skill:'Engineering',level:7},{skill:'Stonework',level:4}], detail:'Building a Courthouse also requires 4000 Stones, 500 Logs, an oak or other exotic-timber Table and 6 Chairs.', source:'24' },
    { level:4, entity:'Flute', label:'Flute', requirements:[{skill:'Music',level:4}], detail:'Musical instrument construction.', source:'13.1.23' },
    { level:4, label:'Wood in stone buildings', requirementsText:'Normal requirements for the structure', detail:'Logs may replace up to 10% of Stones in eligible stone buildings and Stone Towers; each Log replaces 10 Stones. Wells and Stone Walls are excluded.', source:'14.2.2' },
    { level:4, entity:'Apiary', label:'Alternate Apiary construction', requirements:[{skill:'Engineering',level:6}], detail:'Alternate all-wood Apiary construction using 160 Logs plus 2 Cloth (or 20 Leather).', source:'14.3.3' },
    { level:5, entity:'Horn', label:'Horn', requirements:[{skill:'Music',level:3}], detail:'Musical instrument construction.', source:'13.1.23' },
    { level:5, entity:'Boat', label:'Boat (Lifeboat)', requirements:[{skill:'Shipbuilding',level:1}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:5, entity:'Ferry', label:'Ferry', requirements:[{skill:'Shipbuilding',level:2},{skill:'Metalwork',level:3}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:5, entity:'Barge', label:'Barge', requirements:[{skill:'Shipbuilding',level:3},{skill:'Metalwork',level:3}], detail:'Barge construction requires 32 AM; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:6, entity:'Fisher', label:'Fisher', requirements:[{skill:'Shipbuilding',level:2},{skill:'Metalwork',level:3}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:6, entity:'Coaster', label:'Coaster', requirements:[{skill:'Shipbuilding',level:3},{skill:'Metalwork',level:3}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:6, entity:'Harp', label:'Harp', requirements:[{skill:'Music',level:7}], detail:'Musical instrument construction.', source:'13.1.23' },
    { level:6, entity:'Onager', label:'Onager', requirements:[{skill:'Siege Equipment',level:8}], detail:'Siege Equipment 8 recipe that additionally requires Woodwork 6.', source:'13.1.29' },
    { level:7, entity:'Small Galley', label:'Small Galley', requirements:[{skill:'Shipbuilding',level:4},{skill:'Metalwork',level:5}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:7, entity:'Medium Galley', label:'Medium Galley', requirements:[{skill:'Shipbuilding',level:5},{skill:'Metalwork',level:5}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:7, entity:'Large Galley', label:'Large Galley', requirements:[{skill:'Shipbuilding',level:6},{skill:'Metalwork',level:5}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:7, entity:'Trader', label:'Trader', requirements:[{skill:'Shipbuilding',level:6},{skill:'Metalwork',level:4}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:8, entity:'Lute', label:'Lute', requirements:[{skill:'Music',level:8}], detail:'Musical instrument construction.', source:'13.1.23' },
    { level:8, entity:'Longship', label:'Longship', requirements:[{skill:'Shipbuilding',level:8},{skill:'Metalwork',level:4}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:8, entity:'Merchant', label:'Merchant', requirements:[{skill:'Shipbuilding',level:9},{skill:'Metalwork',level:7}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' },
    { level:8, entity:'Warship', label:'Warship', requirements:[{skill:'Shipbuilding',level:9},{skill:'Metalwork',level:7}], detail:'Ship construction; normal Shipwright and Shipyard capacity rules also apply.', source:'20.4' }
  ];

  // Keep the legacy combined list accurate for fallback renderers. Trumpet is intentionally absent:
  // in the Mandate Music table it uses Music 6 + Metalwork 6, with no Woodwork requirement.
  woodwork.levelUses = [
    ...woodwork.directCrafts.map(row => ({ level:row.level, item:row.entity, use:row.label, kind:'Woodwork craft', detail:row.detail, source:row.source })),
    ...woodwork.requiredUses.map(row => ({ level:row.level, item:row.entity, use:row.label, kind:'Woodwork prerequisite', detail:row.detail, source:row.source }))
  ];
  woodwork.additionalSections = [...new Set([...(woodwork.additionalSections || []), '20.4'])];
})();

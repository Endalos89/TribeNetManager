(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairgroundHotspots = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const HOTSPOTS = [
    {
      id:'scholar', label:"Scholar's Pavilion", shortLabel:'Scholar', icon:'📜',
      x:16, y:21, size:'medium', kind:'sheet', sheetKey:'researchSpecials',
      description:'Research, special opportunities and unusual Fair offers.'
    },
    {
      id:'fairmaster', label:"Fairmaster's Tent", shortLabel:'Fairmaster', icon:'🏳️',
      x:50, y:17, size:'large', kind:'embedded', sections:['availability','economics','history'],
      description:'Fair records, workbook status, access and administration.'
    },
    {
      id:'caravan', label:'Caravan Road', shortLabel:'Caravan', icon:'🐎',
      x:83, y:24, size:'medium', kind:'embedded', sections:['purchase-craft'],
      description:'Buy now, manufacture between Fairs and sell next time.'
    },
    {
      id:'market', label:'Market Stalls', shortLabel:'Market', icon:'🏪',
      x:19, y:48, size:'medium', kind:'embedded', sections:['market-movement'],
      description:'See what has risen and fallen since the previous Fair.'
    },
    {
      id:'workshop', label:"Craftsman's Workshop", shortLabel:'Workshop', icon:'⚒️',
      x:50, y:48, size:'hero', kind:'embedded', sections:['profit-calculator'],
      description:'Plan goods you can source and manufacture profitably for this Fair.'
    },
    {
      id:'pavilion', label:'Grand Pavilion', shortLabel:'Pavilion', icon:'🎪',
      x:81, y:49, size:'large', kind:'sheet', sheetKey:'culturalActivities',
      description:'Cultural performances and activities available at this Fair.'
    },
    {
      id:'storehouse', label:'Storehouse', shortLabel:'Storehouse', icon:'📦',
      x:23, y:76, size:'medium', kind:'embedded', sections:['holdings'],
      description:'See what your Tribes hold and what the Fair will pay for it.'
    },
    {
      id:'trading-wagon', label:'Trading Wagon', shortLabel:'Trading', icon:'🛒',
      x:77, y:76, size:'large', kind:'embedded', sections:['resource-buying','holdings'],
      description:'Plan purchases and review goods you can bring to the Fair.'
    }
  ];

  function getHotspot(id) { return HOTSPOTS.find(row => row.id === id) || null; }
  return { HOTSPOTS, getHotspot };
});

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairgroundHotspots = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const HOTSPOTS = [
    {
      id:'scholar', label:"Scholar's Pavilion", shortLabel:'Scholar', icon:'📜',
      x:16, y:21, size:'medium', sheetKey:'researchSpecials',
      description:'Browse research, special opportunities and unusual Fair offers as individual notices.'
    },
    {
      id:'fairmaster', label:"Fairmaster's Tent", shortLabel:'Fairmaster', icon:'🏳️',
      x:50, y:17, size:'large',
      description:'Review the shared Fair workbook, trade access, Results baseline and saved Fair history.'
    },
    {
      id:'caravan', label:'Caravan Road', shortLabel:'Caravan', icon:'🐎',
      x:83, y:24, size:'medium',
      description:'Explore buy-now, manufacture-between-Fairs and sell-next-Fair routes.'
    },
    {
      id:'market', label:'Market Stalls', shortLabel:'Market', icon:'🏪',
      x:19, y:48, size:'medium',
      description:'Walk the stalls to see what has risen and fallen since the previous Fair.'
    },
    {
      id:'workshop', label:"Craftsman's Workshop", shortLabel:'Workshop', icon:'⚒️',
      x:50, y:48, size:'hero',
      description:'Inspect source-based production projects and plan profitable Fair sales.'
    },
    {
      id:'pavilion', label:'Grand Pavilion', shortLabel:'Pavilion', icon:'🎪',
      x:81, y:49, size:'large', sheetKey:'culturalActivities',
      description:'Browse cultural performances and activities as Fair programmes and posters.'
    },
    {
      id:'storehouse', label:'Storehouse', shortLabel:'Storehouse', icon:'📦',
      x:23, y:76, size:'medium',
      description:'Open your combined stores, see where goods are held and plan stock sales.'
    },
    {
      id:'trading-wagon', label:'Trading Wagon', shortLabel:'Trading', icon:'🛒',
      x:77, y:76, size:'large',
      description:'Buy and sell through item cards, choose quantities and manage the ten Fair transactions.'
    }
  ];

  function getHotspot(id) { return HOTSPOTS.find(row => row.id === id) || null; }
  return { HOTSPOTS, getHotspot };
});

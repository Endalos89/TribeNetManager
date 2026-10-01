(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TribeNetFairItemIcons = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const rules = [
    [/wagon|cart/i,'🛒','transport'], [/horse|pony/i,'🐎','animals'], [/cattle|cow|bull|ox/i,'🐂','animals'], [/sheep|goat/i,'🐑','animals'], [/dog/i,'🐕','animals'],
    [/log|timber|wood/i,'🪵','wood'], [/charcoal|coal/i,'⚫','fuel'], [/bark/i,'🌳','wood'], [/reed|straw|hay/i,'🌾','plants'],
    [/iron|steel|bronze|copper|tin|lead|silver|gold|ore|metal/i,'⛓️','metal'], [/stone|flint|clay|brick/i,'🪨','stone'],
    [/axe|adze|hammer|saw|tool|pick/i,'🪓','tools'], [/sword|spear|bow|arrow|shield|weapon|arbalest|spetum|sling/i,'⚔️','weapons'],
    [/rope|net|cloth|linen|wool|textile|canvas/i,'🧶','textiles'], [/leather|hide|fur/i,'🦬','leather'],
    [/boat|ship|barge|canoe|longship|fisher/i,'⛵','boats'], [/fish/i,'🐟','food'], [/meat|beef|pork|venison/i,'🥩','food'], [/grain|wheat|barley|oat/i,'🌾','food'], [/bread/i,'🍞','food'], [/ale|beer|wine/i,'🍺','food'], [/salt/i,'🧂','food'],
    [/frame|plank|board/i,'🪚','wood'], [/backpack|bag|sack/i,'🎒','goods'], [/trap|snare/i,'🪤','tools'],
    [/pot|jar|ceramic/i,'🏺','goods'], [/jewel|gem/i,'💎','luxury'], [/coin|money/i,'🪙','luxury'], [/book|scroll/i,'📜','knowledge']
  ];

  function iconFor(name) {
    const text = String(name || '');
    for (const [pattern, icon] of rules) if (pattern.test(text)) return icon;
    return '📦';
  }

  function categoryFor(name) {
    const text = String(name || '');
    for (const [pattern, _icon, category] of rules) if (pattern.test(text)) return category;
    return 'goods';
  }

  return { iconFor, categoryFor };
});

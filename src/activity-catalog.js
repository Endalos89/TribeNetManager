const ACTIVITY_CATALOG = [
  { code: 'ARMOUR', name: 'Armour Making', skill: 'ARMOUR', section: '13.1.1', limitType: 'none' },
  { code: 'BONING', name: 'Boning', skill: 'BONING', section: '13.1.2', limitType: 'sharedPerSkill10' },
  { code: 'BONEWORK', name: 'Bonework', skill: 'BONEWORK', section: '13.1.3', limitType: 'none' },
  { code: 'COOKING', name: 'Cooking', skill: 'COOKING', section: '13.1.4', limitType: 'sharedPerSkill10' },
  { code: 'CURING', name: 'Curing', skill: 'CURING', section: '13.1.5', limitType: 'sharedPerSkill10' },
  { code: 'DRESSING', name: 'Dressing', skill: 'DRESSING', section: '13.1.6', limitType: 'sharedPerSkill10' },
  { code: 'FLETCHING', name: 'Fletching', skill: 'FLETCHING', section: '13.1.7', limitType: 'sharedPerSkill10' },
  { code: 'FORAGING', name: 'Foraging / Gathering / Digging / Oil Production', skill: null, section: '13.1.8', limitType: 'none', levelZeroAllowed: true },
  { code: 'FORESTRY', name: 'Forestry', skill: 'FORESTRY', section: '13.1.9', limitType: 'sharedPerSkill10' },
  { code: 'FURRIER', name: 'Furrier', skill: 'FURRIER', section: '13.1.10', limitType: 'none' },
  { code: 'GLASSWORK', name: 'Glasswork', skill: 'GLASSWORK', section: '13.1.11', limitType: 'none' },
  { code: 'GUTTING', name: 'Gutting', skill: 'GUTTING', section: '13.1.12', limitType: 'sharedPerSkill10' },
  { code: 'HEALING', name: 'Healing', skill: 'HEALING', section: '13.1.13', limitType: 'none', levelZeroAllowed: true },
  { code: 'HERDING', name: 'Herding', skill: 'HERDING', section: '13.1.14', limitType: 'special', levelZeroAllowed: true, note: 'Special manpower rule: 1 person per 10 Horses/Cattle/Dogs or 20 Goats; extra workers do not increase the effect.' },
  { code: 'HUNTING', name: 'Hunting', skill: 'HUNTING', section: '13.1.15', limitType: 'none', levelZeroAllowed: true },
  { code: 'INTELLIGENCE', name: 'Intelligence', skill: 'INTELLIGENCE', section: '13.1.16', limitType: 'special', note: 'Skill level controls the information that can be requested.' },
  { code: 'JEWELLERY', name: 'Jewellery', skill: 'JEWELLERY', section: '13.1.17', limitType: 'none' },
  { code: 'LEATHERWORK', name: 'Leatherwork', skill: 'LEATHERWORK', section: '13.1.18', limitType: 'none' },
  { code: 'MEETING_HOUSE', name: 'Meeting House Construction', skill: 'ENGINEERING', minimumSkill: 2, section: '13.1.19', limitType: 'none', note: 'Requires Engineering 2.' },
  { code: 'LODGING', name: 'Lodging', skill: 'ENGINEERING', minimumSkill: 2, section: '13.1.20', limitType: 'none', note: 'Requires Engineering 2.' },
  { code: 'METALWORK', name: 'Metalwork', skill: 'METALWORK', section: '13.1.21', limitType: 'none' },
  { code: 'MINING', name: 'Mining', skill: 'MINING', section: '13.1.22', limitType: 'none', levelZeroAllowed: true },
  { code: 'MUSIC', name: 'Music', skill: 'MUSIC', section: '13.1.23', limitType: 'none' },
  { code: 'POTTERY', name: 'Pottery', skill: 'POTTERY', section: '13.1.24', limitType: 'sharedPerSkill10' },
  { code: 'QUARRYING', name: 'Quarrying', skill: 'QUARRYING', section: '13.1.25', limitType: 'sharedPerSkill10' },
  { code: 'SEEKING', name: 'Seeking', skill: 'SEEKING', section: '13.1.26', limitType: 'seasonal', note: 'Springtide activity conducted by Warriors.' },
  { code: 'RICH_SEEKING', name: 'Rich Seeking', skill: 'SEEKING', section: '13.1.27', limitType: 'seasonal', note: 'Springtide activity in a Rich Seeking hex; occurs in addition to normal Seeking.' },
  { code: 'SEWING', name: 'Sewing', skill: 'SEWING', section: '13.1.28', limitType: 'none' },
  { code: 'SIEGE', name: 'Siege Equipment Making', skill: 'SIEGE', section: '13.1.29', limitType: 'none' },
  { code: 'SKINNING', name: 'Skinning', skill: 'SKINNING', section: '13.1.30', limitType: 'sharedPerSkill10' },
  { code: 'SLAVERY', name: 'Slavery', skill: 'SLAVERY', section: '13.1.31', limitType: 'special' },
  { code: 'STONEWORK', name: 'Stonework', skill: 'STONEWORK', section: '13.1.32', limitType: 'none' },
  { code: 'TANNING', name: 'Tanning', skill: 'TANNING', section: '13.1.33', limitType: 'sharedPerSkill10' },
  { code: 'WAXWORK', name: 'Waxwork', skill: 'WAXWORK', section: '13.1.34', limitType: 'none' },
  { code: 'WEAPON', name: 'Weapon Making', skill: 'WEAPON MAKING', aliases: ['WEAPON', 'WEAPONMAKING'], section: '13.1.35', limitType: 'none' },
  { code: 'WEAVING', name: 'Weaving', skill: 'WEAVING', section: '13.1.36', limitType: 'none' },
  { code: 'WOODWORK', name: 'Woodwork', skill: 'WOODWORK', section: '13.1.37', limitType: 'none' },
  { code: 'FISHING', name: 'Fishing', skill: 'FISHING', section: '22', limitType: 'none', levelZeroAllowed: true, note: 'Requires suitable access to ocean, river or lake.' },
  { code: 'SALTING', name: 'Salting', skill: 'SALTING', section: '22.2.1', limitType: 'sharedPerSkill10' },
  { code: 'FARMING', name: 'Farming / Agriculture', skill: 'AGRICULTURE', section: 'Agriculture', limitType: 'none', levelZeroAllowed: true },
  { code: 'SHIPBUILDING', name: 'Shipbuilding', skill: 'SHIPWRIGHT', section: '14.15 / Shipbuilding', limitType: 'sharedPerSkill10', note: 'Worker limit is controlled by Shipwright skill in the contributing Tribe.' },
  { code: 'ENGINEERING', name: 'Engineering / Construction', skill: 'ENGINEERING', section: '14', limitType: 'special' },
  { code: 'BOAT_MAINTENANCE', name: 'Boat Maintenance', skill: null, section: '8.7.6', limitType: 'special', note: 'Maintaining boats is an activity; crewing a vessel is not.' },
  { code: 'RESEARCH', name: 'Research', skill: null, section: '23', limitType: 'special', tribeOnly: true, note: 'Normally one research topic per Tribe per turn, subject to research rules and buildings.' },
  { code: 'CUSTOM', name: 'Custom / Uncoded / GM Activity', skill: null, section: 'Custom', limitType: 'custom', note: 'Use for research-derived, uncoded or GM-authorised activities.' }
];

function canonicalSkill(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function activityByCode(code) {
  return ACTIVITY_CATALOG.find(a => a.code === code) || ACTIVITY_CATALOG[ACTIVITY_CATALOG.length - 1];
}

function skillLevelFor(activity, skills) {
  if (!activity?.skill) return null;
  const wanted = new Set([canonicalSkill(activity.skill), ...(activity.aliases || []).map(canonicalSkill)]);
  for (const skill of skills || []) {
    const names = [skill.skill, skill.shortname].map(canonicalSkill);
    if (names.some(name => wanted.has(name))) return Number(skill.level || 0);
  }
  return 0;
}

function sharedWorkerLimit(activity, skillLevel) {
  if (!activity || activity.limitType !== 'sharedPerSkill10') return null;
  const level = Number(skillLevel || 0);
  if (level >= 10) return Infinity;
  return Math.max(0, level * 10);
}

module.exports = { ACTIVITY_CATALOG, activityByCode, canonicalSkill, skillLevelFor, sharedWorkerLimit };

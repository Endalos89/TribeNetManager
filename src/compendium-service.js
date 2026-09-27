const { buildCompendiumCatalog, detailForSkill, SOURCE_DOCUMENT } = require('./compendium-catalog');
const { enrichCompendiumCatalog } = require('./compendium-knowledge');

function completeMandateSkills(catalog) {
  const result = buildCompendiumCatalog(catalog);
  if (!result.skills.some(skill => String(skill.name).toUpperCase() === 'LEADERSHIP')) {
    const base = {
      id: null,
      name: 'Leadership',
      shortname: 'Ldr',
      skillGroup: 'B',
      section: '12.2',
      sourceDocument: result.sourceDocument || SOURCE_DOCUMENT,
      aliases: ['Leadership', 'Ldr']
    };
    result.skills.push({ ...base, ...detailForSkill(base), recipes: [], relatedRequirements: [] });
  }
  result.skills.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return enrichCompendiumCatalog(result);
}

module.exports = { completeMandateSkills };

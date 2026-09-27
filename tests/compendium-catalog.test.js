const assert = require('assert');
const { SKILLS, RECIPES, SOURCE_DOCUMENT } = require('../src/mandate-catalog');
const { TOPICS } = require('../src/compendium-catalog');
const { completeMandateSkills } = require('../src/compendium-service');

const base = {
  version: 1,
  sourceDocument: SOURCE_DOCUMENT,
  skills: SKILLS.map((skill, index) => ({ id:index+1, name:skill.name, shortname:skill.shortname, skillGroup:skill.group, section:skill.section, sourceDocument:SOURCE_DOCUMENT })),
  recipes: RECIPES.map((recipe, index) => ({ id:index+1, ...recipe, sourceDocument:SOURCE_DOCUMENT }))
};
const compendium = completeMandateSkills(base);

assert.strictEqual(compendium.sourceDocument, SOURCE_DOCUMENT);
assert(compendium.skills.length >= 83, 'Compendium should expose the complete Mandate skill list');
assert.deepStrictEqual([...new Set(compendium.skills.map(s => s.skillGroup))].sort(), ['A','B','C']);

const leadership = compendium.skills.find(s => s.name === 'Leadership');
assert(leadership, 'Leadership must be present because it is listed in Mandate skill Group B');
assert.strictEqual(leadership.shortname, 'Ldr');
assert(leadership.topics.includes('land-combat'));

const forestry = compendium.skills.find(s => s.name === 'Forestry');
assert(forestry, 'Forestry should be in the Compendium');
assert.strictEqual(forestry.workerLimited, true);
assert(forestry.sections.includes('13.1.9'));
assert(forestry.recipes.some(r => r.name === 'Fell Logs'));

const combat = compendium.skills.find(s => s.name === 'Combat');
assert(combat?.topics.includes('land-combat'));
const mariner = compendium.skills.find(s => s.name === 'Mariner');
assert(mariner?.topics.includes('naval-combat'));

const land = TOPICS.find(t => t.key === 'land-combat');
const naval = TOPICS.find(t => t.key === 'naval-combat');
assert(land && naval, 'Land and Naval Combat topic pages should exist');
assert(land.coreSkills.includes('Tactics'));
assert(naval.coreSkills.includes('Mariner'));
assert(naval.coreSkills.includes('Captaincy'));

console.log('Compendium catalogue regression tests passed.');

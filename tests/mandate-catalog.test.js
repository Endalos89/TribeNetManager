const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveSkillDefinition, resolveSkillKey, RECIPES } = require('../src/mandate-catalog');
const { ACTIVITY_CATALOG, activityFromOrderLabel, skillLevelFor } = require('../src/activity-catalog');
const { MandateCatalogDatabase } = require('../src/mandate-catalog-database');

assert.strictEqual(resolveSkillDefinition('For').name, 'Forestry');
assert.strictEqual(resolveSkillDefinition('ShB').name, 'Shipbuilding');
assert.strictEqual(resolveSkillDefinition('ShW').name, 'Shipwright');
assert.strictEqual(resolveSkillDefinition('Wpn').name, 'Weapons');
assert.strictEqual(resolveSkillKey('Woodworking'), resolveSkillKey('Woodwork'));

const forestry = ACTIVITY_CATALOG.find(row => row.code === 'FORESTRY');
assert.strictEqual(skillLevelFor(forestry, [{ skill: 'For', shortname: 'For', level: 4 }]), 4, 'Mandate shortform should resolve to full skill');

const shipbuilding = ACTIVITY_CATALOG.find(row => row.code === 'SHIPBUILDING');
assert.strictEqual(shipbuilding.skill, 'SHIPBUILDING');
assert.strictEqual(shipbuilding.limitSkill, 'SHIPWRIGHT');
assert.strictEqual(skillLevelFor(shipbuilding, [{ skill: 'ShB', level: 8 }]), 8);
assert.strictEqual(skillLevelFor(shipbuilding, [{ skill: 'ShW', level: 4 }], { limit: true }), 4);

const sgb = activityFromOrderLabel('SKIN&GUT&BONE');
assert(sgb && sgb.code === 'SKIN_GUT_BONE');
assert.deepStrictEqual(sgb.components, ['SKINNING', 'GUTTING', 'BONING']);
assert(activityFromOrderLabel('Refining')?.code === 'REFINING');
assert(activityFromOrderLabel('Brick Making')?.code === 'BRICK_MAKING');
assert(RECIPES.some(row => row.key === 'ship-longship'));
assert(RECIPES.some(row => row.key === 'wood-wagon'));

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribenet-mandate-'));
try {
  const db = new MandateCatalogDatabase(tempDir);
  const skill = db.resolveSkill('For');
  assert.strictEqual(skill.name, 'Forestry');
  const recipes = db.recipeRowsForSkill('Wd');
  assert(recipes.some(row => row.name === 'Wagon'));
  const wagon = recipes.find(row => row.name === 'Wagon');
  assert(wagon.inputs.some(row => row.item === 'Logs' && row.quantity === 6));
  const longships = db.recipeRowsForSkill('ShB');
  const longship = longships.find(row => row.name === 'Longship');
  assert(longship);
  assert(longship.requirements.some(row => row.skill === 'Woodwork' && row.level === 8));
  assert(longship.requirements.some(row => row.skill === 'Metalwork' && row.level === 4));
  db.close();
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('Mandate catalogue regression tests passed.');

const assert = require('assert');
const rules = require('../src/skill-attempts');
const { normalizeSkillAttemptRows } = require('../src/orders-workbook');

const sameGroup = rules.calculate([
  { order:1, skill:'Diplomacy', group:'B', baselineLevel:3 },
  { order:2, skill:'Influence', group:'B', baselineLevel:4 }
]);
assert.strictEqual(sameGroup[0].chance, 70);
assert.strictEqual(sameGroup[1].chance, 15);

const teacherPlan = [
  { order:1, skill:'Engineering', group:'C', baselineLevel:4 },
  { order:2, skill:'Diplomacy', group:'B', baselineLevel:3 },
  { order:3, skill:'Fishing', group:'A', baselineLevel:2 }
];
const teacher = rules.calculate(teacherPlan);
assert.strictEqual(rules.validationError(teacherPlan), '');
assert.strictEqual(teacher[2].chance, 40);
assert.strictEqual(teacher[2].cost, 900);

const promoted = rules.teacherPromote([
  { order:1, skill:'Fishing', group:'A', baselineLevel:2 },
  { order:2, skill:'Engineering', group:'C', baselineLevel:4 },
  { order:3, skill:'Diplomacy', group:'B', baselineLevel:3 }
]);
assert.deepStrictEqual(promoted.map(row => [row.skill, row.order]), [
  ['Engineering', 1], ['Diplomacy', 2], ['Fishing', 3]
]);

const invalidTeacher = [
  { order:1, skill:'Fishing', group:'A', baselineLevel:2 },
  { order:2, skill:'Diplomacy', group:'B', baselineLevel:3 },
  { order:3, skill:'Hunting', group:'A', baselineLevel:1 }
];
assert.match(rules.validationError(invalidTeacher), /both Group B or C/);

assert.strictEqual(rules.calculate([
  { order:1, skill:'Forestry', group:'A', baselineLevel:9 }
], [{ skill:'Forestry', failureCount:11 }])[0].chance, 100);
assert.deepStrictEqual(rules.swap(teacherPlan, 2, -1).map(row => row.order), [1, 2, 3]);
assert.strictEqual(normalizeSkillAttemptRows(teacherPlan.map(row => ({ ...row, tribe:'0485', topic:row.skill })), 10).length, 3);
assert.throws(() => normalizeSkillAttemptRows(invalidTeacher.map(row => ({ ...row, tribe:'0485', topic:row.skill })), 10), /attempts 1 and 2/);

console.log('Skill attempt rule tests passed.');

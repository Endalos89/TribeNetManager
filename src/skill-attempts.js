(function installSkillAttemptRules(root) {
  const key = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  function targetLevel(attempt) {
    return Math.max(1, Math.floor(Number(attempt?.baselineLevel || 0)) + 1);
  }
  function baseChance(attempt) {
    return Math.max(0, Math.min(100, (11 - targetLevel(attempt)) * 10));
  }
  function ordered(attempts) {
    return [...(attempts || [])].sort((a, b) => Number(a.order) - Number(b.order));
  }
  function validationError(attempts) {
    const rows = ordered(attempts);
    if (rows.length > 3) return 'A Tribe may make no more than three skill attempts in a turn.';
    if (rows.some((row, index) => Number(row.order) !== index + 1)) return 'Attempt order must be consecutive, starting with 1.';
    if (new Set(rows.map(row => key(row.skill))).size !== rows.length) return 'A Tribe cannot attempt the same skill more than once in a turn.';
    if (rows.length < 3) return '';
    const [first, second, third] = rows;
    if (String(third.group || '').toUpperCase() !== 'A') return 'The third attempt must be a Group A skill learned with a teacher.';
    if (Number(third.baselineLevel || 0) >= 7) return 'Teachers can only raise Group A skills that are below level 7.';
    if (['A'].includes(String(first.group || '').toUpperCase()) || ['A'].includes(String(second.group || '').toUpperCase())) {
      return 'A teacher is only available when attempts 1 and 2 are both Group B or C.';
    }
    return '';
  }
  function calculate(attempts, streaks = []) {
    const rows = ordered(attempts);
    const error = validationError(rows);
    const streakBySkill = new Map((streaks || []).map(row => [key(row.skill), Number(row.failureCount || 0)]));
    return rows.map((row, index) => {
      const order = Number(row.order);
      const target = targetLevel(row);
      const base = baseChance(row);
      let chance = null;
      if (order === 1) {
        chance = base;
        if (target === 10 && streakBySkill.get(key(row.skill)) >= 11) chance = 100;
      } else if (order === 2) {
        const sameGroup = String(rows[0]?.group || '').toUpperCase() === String(row.group || '').toUpperCase();
        chance = base * (sameGroup ? 0.25 : 0.5);
      } else if (!error) {
        chance = base * 0.5;
      }
      const teacher = order === 3 && String(row.group || '').toUpperCase() === 'A';
      return {
        ...row,
        order,
        targetLevel: target,
        baseChance: base,
        chance,
        teacher,
        cost: teacher ? target * 300 : 0,
        valid: !error || rows.length < 3 || order < 3,
        validationError: error
      };
    });
  }
  function swap(attempts, fromIndex, direction) {
    const rows = ordered(attempts);
    const toIndex = fromIndex + (direction < 0 ? -1 : 1);
    if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length) return rows;
    [rows[fromIndex], rows[toIndex]] = [rows[toIndex], rows[fromIndex]];
    return rows.map((row, index) => ({ ...row, order: index + 1 }));
  }
  function teacherPromote(attempts) {
    const rows = ordered(attempts);
    if (rows.length !== 3) return rows;
    const groupA = rows.filter(row => String(row.group || '').toUpperCase() === 'A');
    if (groupA.length !== 1) return rows;
    const teacher = groupA[0];
    if (Number(teacher.baselineLevel || 0) >= 7) return rows;
    const free = rows.filter(row => row !== teacher);
    if (free.every(row => ['B', 'C'].includes(String(row.group || '').toUpperCase()))) {
      return [...free, teacher].map((row, index) => ({ ...row, order: index + 1 }));
    }
    return rows;
  }
  const api = { key, targetLevel, baseChance, validationError, calculate, swap, teacherPromote };
  root.SkillAttemptRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

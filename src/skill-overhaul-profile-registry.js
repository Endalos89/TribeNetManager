(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.profiles || S.registerProfile) return;

  const originalProfile = S.profile.bind(S);
  const originalItemBenefitsFor = typeof S.itemBenefitsFor === 'function' ? S.itemBenefitsFor.bind(S) : (() => []);
  const canon = S.canon;
  const extraItemBenefits = new Map();

  function dynamicProfile(name) {
    const legacy = originalProfile(name);
    if (legacy) return legacy;
    const key = canon(name);
    if (S.profiles[key]) return S.profiles[key];
    return Object.values(S.profiles).find(profile => {
      const names = [profile?.name, ...(profile?.aliases || []), ...(profile?.researchAliases || [])].filter(Boolean);
      return names.some(value => canon(value) === key);
    }) || null;
  }

  S.profile = dynamicProfile;
  S.registerProfile = function(key, profile) {
    const storageKey = canon(key || profile?.name);
    if (!storageKey || !profile) return null;
    S.profiles[storageKey] = profile;
    return profile;
  };

  S.registerItemBenefit = function(name, benefit) {
    const key = canon(name);
    if (!key || !benefit) return benefit;
    const rows = extraItemBenefits.get(key) || [];
    const signature = `${canon(benefit.skill)}|${String(benefit.value || '')}|${String(benefit.section || benefit.research || '')}`;
    const existing = new Set(rows.map(row => `${canon(row.skill)}|${String(row.value || '')}|${String(row.section || row.research || '')}`));
    if (!existing.has(signature)) rows.push({ ...benefit });
    extraItemBenefits.set(key, rows);
    return benefit;
  };

  S.itemBenefitsFor = function(name) {
    return [
      ...originalItemBenefitsFor(name),
      ...(extraItemBenefits.get(canon(name)) || [])
    ];
  };
  S.itemBenefit = function(name) { return S.itemBenefitsFor(name)[0] || null; };
})();

(() => {
  const S = window.TribeNetSkillOverhaul;
  if (!S?.profiles || S.registerProfile) return;

  const originalProfile = S.profile.bind(S);
  const canon = S.canon;

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
})();

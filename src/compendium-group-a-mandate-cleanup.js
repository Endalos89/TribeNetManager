(async () => {
  const M = window.TRIBENET_MANDATE;
  const S = window.TribeNetSkillOverhaul;
  if (!M || !S?.profile) return;

  // compendium-mandate.js waits for the Mandate dataset before it installs its
  // showSkill wrapper. Skill dossier renderers are installed synchronously, so
  // that asynchronous wrapper can otherwise become outermost later and append
  // the legacy generic coverage/entity blocks after a dossier has rendered.
  // Keep the legacy filename for compatibility, but apply the cleanup to every
  // skill that has migrated to a structured dossier, regardless of skill group.
  await M.whenReady();

  const previousShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const result = previousShowSkill(name, push);
    const skill = typeof skillByName === 'function' ? skillByName(name) : null;
    if (!skill || !S.profile(skill.name)) return result;

    const article = typeof $ === 'function' ? $('compArticle') : null;
    if (!article) return result;

    article.querySelectorAll('.mandate-cross-links, .mandate-skill-entities').forEach(node => node.remove());
    return result;
  };
})();

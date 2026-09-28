(() => {
  const S = window.TribeNetSkillOverhaul;
  const M = window.TRIBENET_MANDATE;
  if (!S) return;
  const e = value => esc(value);
  const canonLocal = value => S.canon(value);

  // Courthouse is a Mandate structure rather than a normal Valid Goods row, so expose it as a
  // Compendium entity so Woodwork can link to it just like Clubs, Planks and other outputs.
  const previousEntities = entities;
  entities = function() {
    const list = previousEntities();
    if (!list.some(row => canonLocal(row.name) === 'COURTHOUSE' || canonLocal(row.key) === 'COURTHOUSE')) {
      list.push({
        key:'Courthouse',
        name:'Courthouse',
        kind:'facility',
        summary:'A Home City structure that halves Governing requirements.',
        sections:['24'],
        notes:['Requires Engineering 7, Woodwork 3, Stonework 4, 4000 Stones, 500 Logs, an oak or other exotic-timber Table and 6 Chairs.'],
        sourceSkills:['Engineering','Woodwork','Stonework'],
        uses:[], producers:[], consumers:[], researchTopics:[]
      });
    }
    return list;
  };

  function mandateLink(section) {
    const target = M?.getSection?.(section);
    if (!target) return `<span class="skill-source-chip">Mandate § ${e(section)}</span>`;
    return `<a class="skill-source-chip mandate" href="#${e(M.anchorId(target.section))}" data-mandate-open="${e(target.section)}">Mandate § ${e(target.section)}</a>`;
  }

  function entityLink(name, label = name) {
    const entity = typeof entityByName === 'function' ? entityByName(name) : null;
    return entity ? `<button class="comp-text-link" data-entity="${e(entity.key || entity.name)}">${e(label)}</button>` : e(label);
  }

  function skillRequirement(req) {
    const skill = typeof skillByName === 'function' ? skillByName(req.skill) : null;
    const name = skill?.name || req.skill;
    return skill
      ? `<button class="comp-text-link" data-skill="${e(name)}">${e(name)}</button> <strong>${e(req.level)}</strong>`
      : `${e(name)} <strong>${e(req.level)}</strong>`;
  }

  function sorted(rows) {
    return [...(rows || [])].sort((a,b) => Number(a.level) - Number(b.level) || String(a.label || '').localeCompare(String(b.label || '')));
  }

  function directCraftTable(profile) {
    return `<div class="skill-implement-table-wrap"><table class="skill-implement-table skill-woodwork-direct-table"><thead><tr><th>Woodwork</th><th>Can make with Woodwork alone</th><th>What it does / notes</th><th>Source</th></tr></thead><tbody>
      ${sorted(profile.directCrafts).map(row => `<tr><td><strong>${e(row.level)}</strong></td><td>${entityLink(row.entity, row.label)}</td><td>${e(row.detail)}</td><td>${mandateLink(row.source)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function requiredUseTable(profile) {
    return `<div class="skill-implement-table-wrap"><table class="skill-implement-table skill-woodwork-required-table"><thead><tr><th>Woodwork</th><th>Result / use</th><th>Other skills required</th><th>What Woodwork enables</th><th>Source</th></tr></thead><tbody>
      ${sorted(profile.requiredUses).map(row => {
        const requirements = row.requirements?.length ? row.requirements.map(skillRequirement).join('<br>') : e(row.requirementsText || '—');
        return `<tr><td><strong>${e(row.level)}</strong></td><td>${row.entity ? entityLink(row.entity, row.label) : e(row.label)}</td><td>${requirements}</td><td>${e(row.detail)}</td><td>${mandateLink(row.source)}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  function refineWoodworkPage(article, profile) {
    if (!article || !profile?.directCrafts || !profile?.requiredUses) return;
    const oldSection = [...article.querySelectorAll('.skill-dossier-section')].find(section => section.querySelector('h2')?.textContent?.trim() === 'What each level unlocks');
    if (!oldSection) return;
    oldSection.insertAdjacentHTML('beforebegin', `
      <section class="skill-dossier-section skill-woodwork-direct">
        <div class="skill-section-heading"><div><span>Direct Woodwork</span><h2>Things you can make with Woodwork alone</h2></div>${mandateLink(profile.primarySection)}</div>
        <div class="skill-callout"><strong>Direct recipes:</strong> These are the items listed directly in the Woodwork table. No second production skill is required to perform the Woodwork activity.</div>
        ${directCraftTable(profile)}
      </section>
      <section class="skill-dossier-section skill-woodwork-required">
        <div class="skill-section-heading"><div><span>Prerequisite uses</span><h2>Where Woodwork is required</h2></div></div>
        <div class="skill-callout"><strong>Combined requirements:</strong> Woodwork is only one requirement for these entries. The other skill requirements are shown alongside it.</div>
        ${requiredUseTable(profile)}
      </section>`);
    oldSection.remove();
    bindLinks(article);
  }

  const previousShowSkill = showSkill;
  showSkill = function(name, push = true) {
    const result = previousShowSkill(name, push);
    const profile = S.profile(name);
    if (profile && canonLocal(profile.name) === 'WOODWORK') refineWoodworkPage($('compArticle'), profile);
    return result;
  };
})();

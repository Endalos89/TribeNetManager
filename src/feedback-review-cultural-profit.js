(() => {
  'use strict';
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (page !== 'fairground.html' || typeof renderPavilion !== 'function' || typeof sheetRows !== 'function') return;

  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const numeric = value => {
    const parsed = Number(String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };

  function parseCulturalSheet() {
    const rows = sheetRows('culturalActivities').filter(row => row.some(cell => String(cell ?? '').trim()));
    const headerIndex = rows.findIndex(row => row.some(cell => /culture\s*activity|^activity$/i.test(String(cell || '').trim())) && row.some(cell => /skill/i.test(String(cell || ''))));
    if (headerIndex < 0) return null;

    let economics = 0;
    for (const row of rows.slice(0, headerIndex)) {
      const labelIndex = row.findIndex(cell => /economics\s*skill/i.test(String(cell || '')));
      if (labelIndex < 0) continue;
      const direct = numeric(row[labelIndex + 1]);
      const fallback = row.map(numeric).find(value => value != null);
      economics = direct ?? fallback ?? 0;
      break;
    }

    const headers = rows[headerIndex].map((cell,index) => String(cell || '').trim() || `Field ${index + 1}`);
    const activityIndex = headers.findIndex(header => /culture\s*activity|^activity$/i.test(header));
    const skillIndex = headers.findIndex(header => /skill\s*level|^skill$/i.test(header));
    const participantsIndex = headers.findIndex(header => /participant/i.test(header));
    const implementIndexes = headers.map((header,index) => /implement/i.test(header) ? index : -1).filter(index => index >= 0);
    const workbookReturnIndexes = headers.map((header,index) => /profit|silver|income|return|reward|total/i.test(header) ? index : -1).filter(index => index >= 0);

    const activities = rows.slice(headerIndex + 1).map(row => {
      const name = String(row[activityIndex >= 0 ? activityIndex : 0] || '').trim();
      if (!name) return null;
      const skill = Math.max(0, numeric(row[skillIndex]) ?? 0);
      const enteredParticipants = Math.max(0, numeric(row[participantsIndex]) ?? 0);
      const participants = Math.min(500, enteredParticipants);
      const baseSilver = participants * (8 + skill + economics) / 4;
      const implementsUsed = implementIndexes
        .map(index => ({ label:headers[index], value:String(row[index] ?? '').trim() }))
        .filter(field => field.value);
      const workbookReturns = workbookReturnIndexes
        .map(index => ({ label:headers[index], value:String(row[index] ?? '').trim(), amount:numeric(row[index]) }))
        .filter(field => field.value && field.amount != null);
      const otherFields = headers.map((header,index) => ({ header, value:String(row[index] ?? '').trim(), index }))
        .filter(field => field.value && field.index !== activityIndex && field.index !== skillIndex && field.index !== participantsIndex && !implementIndexes.includes(field.index) && !workbookReturnIndexes.includes(field.index));
      return { name, skill, enteredParticipants, participants, baseSilver, implementsUsed, workbookReturns, otherFields };
    }).filter(Boolean);

    return { economics, activities };
  }

  renderPavilion = function feedbackRuleAwarePavilion() {
    const parsed = parseCulturalSheet();
    if (!parsed?.activities?.length) {
      document.getElementById('featureContent').innerHTML = `${featureIntro('Grand Pavilion','Cultural activities are presented as programmes and performance notices rather than another spreadsheet.',`${meaningfulSheetRows('culturalActivities')} entries`)}${sheetCards('culturalActivities','🎪')}`;
      return;
    }

    const sections = parsed.activities.map(activity => {
      const implementHtml = activity.implementsUsed.length
        ? activity.implementsUsed.map(field => `<div class="cultural-activity-metric"><span>${html(field.label)}</span><strong>${html(field.value)}</strong></div>`).join('')
        : '<div class="cultural-activity-metric"><span>Implements</span><strong>None allocated</strong></div>';
      const extras = activity.otherFields.map(field => `<div class="cultural-activity-metric"><span>${html(field.header)}</span><strong>${html(field.value)}</strong></div>`).join('');
      const workbookReturn = activity.workbookReturns.length
        ? activity.workbookReturns.map(field => `<div><strong>${html(field.label)}: ${html(field.value)}</strong><small>Workbook value — used in preference to the base-rule estimate where it includes implement effects.</small></div>`).join('')
        : `<div><strong>${silver(activity.baseSilver)} Silver</strong><small>Base rule estimate: participants × (8 + Skill + Economics) / 4. Allocated implements are shown above, but no explicit implement-adjusted return was found in the workbook row.</small></div>`;
      const capWarning = activity.enteredParticipants > 500 ? `<div class="fair-warning">Participants capped at 500 for the base-rule estimate (entered ${number(activity.enteredParticipants)}).</div>` : '';
      return `<section class="cultural-activity-section">
        <h4>${html(activity.name)}</h4>
        <div class="cultural-activity-grid">
          <div class="cultural-activity-metric"><span>Skill level</span><strong>${number(activity.skill)}</strong></div>
          <div class="cultural-activity-metric"><span>Economics</span><strong>${number(parsed.economics)}</strong></div>
          <div class="cultural-activity-metric"><span>Participants</span><strong>${number(activity.enteredParticipants)}</strong></div>
          ${implementHtml}${extras}
        </div>
        ${capWarning}
        <div class="cultural-profit"><span>Potential Fair income</span>${workbookReturn}</div>
      </section>`;
    }).join('');

    document.getElementById('featureContent').innerHTML = `${featureIntro('Grand Pavilion','Each cultural activity has its own planning section. Base Silver uses the Mandate formula; if the Fair workbook supplies an explicit return, that workbook value is shown in preference because it can include implement effects.',`${parsed.activities.length} activities · Economics ${number(parsed.economics)}`)}<div class="cultural-activity-sections">${sections}</div>`;
  };
})();
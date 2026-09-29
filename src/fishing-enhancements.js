(function(root){
  const FISHING_IMPLEMENTS = [
    { name:'Boat', output:'PROVS', bonus:'Unknown' },
    { name:'Coaster', output:'PROVS', bonus:'Unknown' },
    { name:'Fisher', output:'PROVS', bonus:'Unknown' },
    { name:'Large Galley', output:'PROVS', bonus:'Unknown' },
    { name:'Longship', output:'PROVS', bonus:'Unknown' },
    { name:'Medium Galley', output:'PROVS', bonus:'Unknown' },
    { name:'Merchant', output:'PROVS', bonus:'Unknown' },
    { name:'Net', output:'PROVS', bonus:'+0.5 AM' },
    { name:'Small Galley', output:'PROVS', bonus:'Unknown' },
    { name:'Trader', output:'PROVS', bonus:'Unknown' },
    { name:'Trawler', output:'PROVS', bonus:'Unknown' },
    { name:'Trawling Nets', output:'PROVS', bonus:'Unknown' },
    { name:'Warship', output:'PROVS', bonus:'Unknown' }
  ];

  const SUPPORT_STORAGE_KEY = 'tribenet.compendium.foodGathering.supportTarget.v1';
  const LEGACY_STORAGE_KEY = 'tribenet.compendium.foodGathering.v1';

  function supportTargetFromLegacy(state){
    if (state && Number.isFinite(Number(state.supportTarget))) return Math.max(0, Number(state.supportTarget));
    if (state && Number.isFinite(Number(state.otherWorkers))) return Math.max(0, Number(state.otherWorkers));
    if (state && Number.isFinite(Number(state.eaters))) return Math.max(0, Number(state.eaters));
    return 80;
  }

  const api = { FISHING_IMPLEMENTS, SUPPORT_STORAGE_KEY, supportTargetFromLegacy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonLocal = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  function fishingEntity(name){
    try {
      const entity = typeof entityByName === 'function' ? entityByName(name) : null;
      if (entity) return `<button class="comp-text-link" data-entity="${escapeHtml(entity.key || entity.name)}">${escapeHtml(name)}</button>`;
    } catch (_) {}
    return escapeHtml(name);
  }

  function injectFishingImplements(){
    const article = root.document.getElementById('compArticle');
    if (!article || article.querySelector('[data-fishing-implements]')) return;
    const title = article.querySelector('h1')?.textContent?.trim();
    if (canonLocal(title) !== 'FISHING') return;

    const rows = FISHING_IMPLEMENTS.map(item => `<tr><td>${fishingEntity(item.name)}</td><td>${escapeHtml(item.output)}</td><td><strong>${escapeHtml(item.bonus)}</strong></td></tr>`).join('');
    const section = `<section class="comp-section" data-fishing-implements>
      <h2>Fishing implements</h2>
      <div class="comp-callout"><strong>Known Fishing bonus:</strong> a Net contributes <strong>+0.5 AM</strong> equivalent. “Unknown” means the item is confirmed as a Fishing implement, but its Fishing bonus has not yet been confirmed.</div>
      <div class="skill-implement-table-wrap"><table class="skill-implement-table"><thead><tr><th>Implement</th><th>Output</th><th>Fishing bonus</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
    const anchor = article.querySelector('.comp-info-list') || article.querySelector('.comp-lead') || article.querySelector('.comp-title-row');
    if (anchor) anchor.insertAdjacentHTML('afterend', section); else article.insertAdjacentHTML('beforeend', section);
    if (typeof bindLinks === 'function') bindLinks(article);
  }

  const S = root.TribeNetSkillOverhaul;
  if (S?.registerItemBenefit) {
    S.registerItemBenefit('Net', {
      skill:'Fishing',
      value:'+0.5 AM',
      detail:'For Fishing, each Net contributes +0.5 Active Month equivalent (a 50% productivity increment for one fisher).',
      source:'Community formula'
    });
  }

  if (typeof showSkill === 'function') {
    const previousShowSkill = showSkill;
    showSkill = function(name, push = true){
      const result = previousShowSkill(name, push);
      if (canonLocal(name) === 'FISHING') injectFishingImplements();
      return result;
    };
  }

  function loadSupportTarget(){
    try {
      const direct = root.localStorage.getItem(SUPPORT_STORAGE_KEY);
      if (direct !== null && Number.isFinite(Number(direct))) return Math.max(0, Number(direct));
      const legacy = JSON.parse(root.localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
      return supportTargetFromLegacy(legacy);
    } catch (_) {
      return 80;
    }
  }

  function currentNumber(id, fallback = 0){
    const value = Number(root.document.getElementById(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function saveSupportTarget(value){
    try { root.localStorage.setItem(SUPPORT_STORAGE_KEY, String(Math.max(0, Number(value) || 0))); } catch (_) {}
  }

  function renderSingleSupport(section){
    const calc = root.TribeNetFoodGathering;
    const output = root.document.getElementById('fgFishingPlanningOutput');
    const targetInput = root.document.getElementById('fgSupportTarget');
    if (!calc || !output || !targetInput) return;

    const target = Math.max(0, Number(targetInput.value) || 0);
    saveSupportTarget(target);
    const model = root.document.getElementById('fgModel')?.value || 'TN 3.0';
    const skill = Math.max(0, currentNumber('fgFishingSkill'));
    const nets = Math.max(0, currentNumber('fgNets'));
    const fmt = value => value == null ? '—' : Math.round(value).toLocaleString();

    output.innerHTML = `<div class="fg-table-wrap"><table class="fg-table compact"><thead><tr><th>Weather</th><th>Effective yield / fisher</th><th>Fishing AM required to support ${fmt(target)} AM</th></tr></thead><tbody>${calc.WEATHER_SCENARIOS.map(weather => {
      const eff = calc.fishingEffectiveYield(model, skill, weather.fishing);
      const required = calc.fishingAmToSupportWorkers({ otherWorkers:target, nets, effectiveYield:eff });
      return `<tr><td>${escapeHtml(weather.label)}</td><td>${eff.toFixed(2)}</td><td>${fmt(required)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function patchFoodGathering(){
    const output = root.document.getElementById('fgFishingPlanningOutput');
    if (!output) return;
    const section = output.closest('.comp-section');
    if (!section || section.dataset.singleSupportBound === '1') return;

    const heading = section.querySelector('h2');
    if (!heading || !/Fishing workforce planning/i.test(heading.textContent || '')) return;
    section.dataset.singleSupportBound = '1';

    const intro = section.querySelector('p');
    if (intro) intro.textContent = 'Enter one target workforce / population value. The result shows the Fishing AM needed to support that target while also sustaining the fishers themselves.';

    const oldGrid = section.querySelector('.fg-input-grid.two');
    const target = loadSupportTarget();
    if (oldGrid) {
      oldGrid.innerHTML = `<label><span>People / AM to support</span><input id="fgSupportTarget" type="number" min="0" step="1" value="${escapeHtml(target)}"><small>One shared target replaces the separate Eaters and Other AM fields.</small></label>`;
    }

    const rerender = () => renderSingleSupport(section);
    root.document.querySelectorAll('#fgCalculator input,#fgCalculator select').forEach(el => {
      if (el.dataset.singleSupportListener === '1') return;
      el.dataset.singleSupportListener = '1';
      el.addEventListener('input', rerender);
      el.addEventListener('change', rerender);
    });
    rerender();
  }

  patchFoodGathering();
  const observer = new MutationObserver(() => {
    injectFishingImplements();
    patchFoodGathering();
  });
  observer.observe(root.document.getElementById('compArticle') || root.document.body, { childList:true, subtree:true });
})(typeof window !== 'undefined' ? window : null);

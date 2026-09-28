(() => {
  const benchmark = window.TribeNetFairPriceBenchmark;
  if (!benchmark) return;

  const coreEntities = entities;
  entities = function() {
    const base = coreEntities();
    const keys = new Set(base.map(entity => canon(entity.key || entity.name)));
    const pricedOnly = benchmark.rows
      .filter(([name]) => !keys.has(canon(name)))
      .map(([name,status]) => ({
        key: canon(name), name, kind:'Fair item',
        summary:`Trade Fair item (${status}) with a Year ${benchmark.source.year} price benchmark.`,
        sections:[], notes:[], sourceSkills:[], uses:[], producers:[], consumers:[]
      }));
    return [...base, ...pricedOnly];
  };

  function fmtSilver(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function fmtQty(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString(undefined,{maximumFractionDigits:0});
  }

  function fmtPct(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  }

  function recipeByKey(key) {
    const target = String(key || '');
    for (const skill of skills()) {
      const found = (skill.recipes || []).find(recipe => String(recipe.recipeKey || recipe.key || '') === target);
      if (found) return found;
    }
    return null;
  }

  function profitClass(value) {
    if (value == null) return 'unknown';
    if (value > 0.01) return 'positive';
    if (value < -0.01) return 'negative';
    return 'neutral';
  }

  function renderRecipeEconomics(recipe) {
    if (!recipe) return '';
    const result = benchmark.evaluateRecipe(recipe);
    const variants = result.variants || [];
    if (!result.output && variants.every(row => row.inputValue == null)) return '';
    return `<div class="comp-economics">
      <div class="comp-economics-title">Base Fair value comparison</div>
      ${variants.map(row => {
        const missing = row.missingInputs?.length ? `<small>Missing benchmark: ${row.missingInputs.map(esc).join(', ')}</small>` : '';
        const inputText = row.complete ? `${fmtSilver(row.inputValue)} silver` : 'Incomplete';
        const outputText = row.outputValue == null ? 'No benchmark' : `${fmtSilver(row.outputValue)} silver`;
        const pctText = row.noPricedInputs ? 'n/a — no priced inputs' : fmtPct(row.uplift);
        return `<div class="comp-economics-row ${profitClass(row.uplift)}">
          <strong>${esc(row.label || 'Standard')}</strong>
          <span><b>Output</b> ${outputText}</span>
          <span><b>Inputs</b> ${inputText}</span>
          <span class="comp-uplift"><b>Value uplift</b> ${pctText}</span>
          ${missing}
        </div>`;
      }).join('')}
      <small class="comp-economics-note">Uses Year ${benchmark.source.year} Base Price values as a crafting benchmark. Labour/AM and current market demand are shown separately.</small>
    </div>`;
  }

  producerCard = function(row) {
    const recipe = recipeByKey(row.recipeKey);
    return `<div class="comp-method-card">
      <div><strong>${esc(row.name)}</strong><span>${skillLink(row.skill,row.skill)} ${fmtNum(row.skillLevel)} · ${fmtNum(row.people)} people</span></div>
      <div>${renderAlternatives(row)}</div>
      ${renderRecipeEconomics(recipe)}
      ${row.notes?`<small>${esc(row.notes)}</small>`:''}
      <small>Mandate § ${esc(row.section||'—')}</small>
    </div>`;
  };

  const coreShowEntity = showEntity;
  showEntity = function(name, push=true) {
    coreShowEntity(name, push);
    const entity = entityByName(name);
    if (!entity) return;
    const price = benchmark.lookup(entity.name);
    const title = $('compArticle')?.querySelector('.comp-title-row');
    if (!title) return;
    const html = price
      ? `<div class="comp-price-summary">
          <div><span>Base item value</span><strong>${fmtSilver(price.basePrice)} silver</strong></div>
          <div><span>Fair pays each</span><strong>${fmtSilver(price.marketBuyPrice)} silver</strong></div>
          <div><span>Quantity demand</span><strong>${fmtQty(price.marketBuyQuantity)}</strong></div>
          <div class="demand"><span>Total silver demand</span><strong>${fmtSilver(price.marketDemandSilver)} silver</strong></div>
          <div><span>Fair category</span><strong>${esc(price.status)}</strong></div>
          <div><span>Market snapshot</span><strong>Year ${benchmark.source.year}</strong></div>
          <small>${esc(benchmark.source.note)}</small>
        </div>`
      : `<div class="comp-price-summary unavailable"><div><span>Market benchmark</span><strong>No Fair price listed</strong></div><small>This item is not present as a priced entry in ${esc(benchmark.source.workbook)}.</small></div>`;
    title.insertAdjacentHTML('afterend', html);
  };
})();

(() => {
  if (typeof document === 'undefined') return;

  // fair.js previously used toolbar selects for sorting. Keep tiny hidden compatibility
  // controls so its existing rendering defaults continue to work while visible sorting
  // lives directly on the table headers.
  const compatibilitySorts = {
    priceSortField:'sellDeltaPct', priceSortDirection:'desc',
    inventorySortField:'potentialSale', inventorySortDirection:'desc',
    resourceBuySortField:'purchasePrice', resourceBuySortDirection:'asc',
    profitSortField:'totalProfit', profitSortDirection:'desc',
    purchaseSortField:'profitPerBatch', purchaseSortDirection:'desc'
  };
  for (const [id, value] of Object.entries(compatibilitySorts)) {
    if (document.getElementById(id)) continue;
    const select = document.createElement('select');
    select.id = id;
    select.hidden = true;
    const option = document.createElement('option');
    option.value = value; option.textContent = value; option.selected = true;
    select.appendChild(option);
    document.body.appendChild(select);
  }

  const sortState = new Map();
  const numericKeys = new Set([
    'sellPrice','oldSellPrice','sellDeltaPct','purchasePrice','oldPurchasePrice','purchaseDeltaPct',
    'quantity','limit','potentialSale','change','locationCount','purchaseQuantityLimit','plannedQuantity',
    'plannedSpend','skillUpsNeeded','sellQuantity','inputValue','profitEach','totalProfit','currentFairCost',
    'outputQuantity','nextSellPrice','profitPerBatch','roi','maxBatches','maxProfit','currentFairTradesNeeded'
  ]);

  function parseNumber(text) {
    const match = String(text || '').replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function cellValue(cell, key) {
    if (!cell) return { kind:'text', value:'' };
    const checkbox = cell.querySelector('input[type="checkbox"]');
    if (checkbox) return { kind:'number', value:checkbox.checked ? 1 : 0 };
    const numberInput = cell.querySelector('input[type="number"]');
    if (numberInput) return { kind:'number', value:Number(numberInput.value || 0) };
    const text = cell.textContent.trim();
    if (key === 'skillUpsNeeded') {
      if (/current skills/i.test(text)) return { kind:'number', value:0 };
      if (/unknown/i.test(text)) return { kind:'number', value:Number.POSITIVE_INFINITY };
      return { kind:'number', value:parseNumber(text) ?? Number.POSITIVE_INFINITY };
    }
    if (key === 'selectedTrade') return { kind:'number', value:/selected/i.test(text) ? 1 : 0 };
    if (numericKeys.has(key)) return { kind:'number', value:parseNumber(text) ?? Number.NEGATIVE_INFINITY };
    return { kind:'text', value:text.toLocaleLowerCase() };
  }

  function compareValues(a, b, direction) {
    const mult = direction === 'asc' ? 1 : -1;
    if (a.kind === 'number' && b.kind === 'number') return (a.value - b.value) * mult;
    return String(a.value).localeCompare(String(b.value), undefined, { numeric:true, sensitivity:'base' }) * mult;
  }

  function applySort(table) {
    const state = sortState.get(table.dataset.sortTable);
    if (!state) return;
    const headers = [...table.querySelectorAll('thead th.sortable-th')];
    const index = headers.findIndex(th => th.dataset.sortKey === state.key);
    if (index < 0) return;
    const body = table.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    if (rows.length < 2) return;
    const sorted = [...rows].sort((a,b) => compareValues(cellValue(a.cells[index], state.key), cellValue(b.cells[index], state.key), state.direction));
    if (sorted.every((row, i) => row === rows[i])) return;
    const fragment = document.createDocumentFragment();
    for (const row of sorted) fragment.appendChild(row);
    body.appendChild(fragment);
  }

  function refreshIndicators(table) {
    const state = sortState.get(table.dataset.sortTable);
    for (const th of table.querySelectorAll('thead th.sortable-th')) {
      th.classList.remove('sort-asc','sort-desc');
      th.setAttribute('aria-sort','none');
      if (state && th.dataset.sortKey === state.key) {
        th.classList.add(state.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        th.setAttribute('aria-sort', state.direction === 'asc' ? 'ascending' : 'descending');
      }
    }
  }

  function defaultDirection(key) {
    return numericKeys.has(key) || ['selected','included','selectedTrade','allSelected'].includes(key) ? 'desc' : 'asc';
  }

  function install() {
    for (const table of document.querySelectorAll('table[data-sort-table]')) {
      const tableKey = table.dataset.sortTable;
      for (const th of table.querySelectorAll('thead th.sortable-th')) {
        th.tabIndex = 0;
        th.title = 'Click to sort; click again to reverse';
        const activate = () => {
          const key = th.dataset.sortKey;
          const current = sortState.get(tableKey);
          const direction = current?.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : defaultDirection(key);
          sortState.set(tableKey, { key, direction });
          refreshIndicators(table);
          applySort(table);
        };
        th.addEventListener('click', activate);
        th.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
        });
      }
      const body = table.tBodies[0];
      if (body) new MutationObserver(() => { if (sortState.has(tableKey)) queueMicrotask(() => applySort(table)); }).observe(body, { childList:true, subtree:false });
      refreshIndicators(table);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();

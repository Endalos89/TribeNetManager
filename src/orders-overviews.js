(() => {
  const dialog = document.getElementById('ordersSheetOverviewDialog');
  const menu = document.getElementById('orderSheetMenu');
  const menuButton = document.getElementById('toggleOrderSheetMenu');
  const editor = document.getElementById('orderSheetOverviewEditor');
  const fieldsHost = document.getElementById('orderSheetOverviewFields');
  const status = document.getElementById('orderSheetOverviewStatus');
  const rowsHost = document.getElementById('orderSheetOverviewRows');
  const headHost = document.getElementById('orderSheetOverviewHead');
  const title = document.getElementById('orderSheetOverviewTitle');
  const turnLabel = document.getElementById('orderSheetOverviewTurn');
  const orderOverviewState = { kind:null, turnKey:null, rows:[], editing:null, catalog:[] };

  const configs = {
    comments: {
      title:'Comments', headers:['Unit','Message/Notes'], editable:true,
      fields:[{ key:'unit',label:'Unit',required:true },{ key:'message',label:'Message/Notes',type:'textarea',required:true }]
    },
    gmActions: {
      title:'GM Actions', headers:['Unit','What does the GM need to do?'], editable:true,
      fields:[{ key:'unit',label:'Unit',required:true },{ key:'message',label:'Instruction',type:'textarea',required:true }]
    },
    activities: {
      title:'Tribe Activities', headers:['Unit','Activity','People','Item','Distinction','Mining direction','Notes'], editable:true,
      fields:[{ key:'unit',label:'Unit',required:true },{ key:'activityCode',label:'Activity',type:'activity',required:true },{ key:'people',label:'People',type:'number',min:0,required:true },{ key:'target',label:'Item' },{ key:'distinction',label:'Distinction' },{ key:'miningDirection',label:'Mining direction' },{ key:'notes',label:'Notes',type:'textarea' }]
    },
    movement: { title:'Tribe Movement', headers:['Unit','Movement commands','Actions'], editable:false },
    skillAttempts: {
      title:'Skill Attempts', headers:['Tribe','Order','Skill / Topic','Group','Current level'], editable:true,
      fields:[{ key:'tribe',label:'Tribe',required:true,maxlength:4 },{ key:'order',label:'Attempt order',type:'select',options:['1','2','3'],required:true },{ key:'skill',label:'Skill',required:true },{ key:'group',label:'Group',type:'select',options:['A','B','C'] },{ key:'baselineLevel',label:'Current level',type:'number',min:0,max:10 }]
    },
    researchAttempts: {
      title:'Research Attempts', headers:['Tribe','Research topic'], editable:true,
      fields:[{ key:'tribe',label:'Tribe',required:true,maxlength:4 },{ key:'topic',label:'Research topic',required:true }]
    }
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function currentTurnKey() {
    return typeof savedMovementCurrentTurnKey === 'function'
      ? savedMovementCurrentTurnKey()
      : typeof lifecyclePlanningTurnKey === 'function' ? lifecyclePlanningTurnKey() : null;
  }

  function resetEditor() {
    orderOverviewState.editing = null;
    editor.reset();
    editor.hidden = !configs[orderOverviewState.kind]?.editable;
    document.getElementById('orderSheetOverviewSave').textContent = 'Add order';
    document.getElementById('orderSheetOverviewCancelEdit').hidden = true;
    status.textContent = '';
  }

  function inputMarkup(field) {
    const id = `orderSheetField_${field.key}`;
    const required = field.required ? ' required' : '';
    const length = field.maxlength ? ` maxlength="${field.maxlength}"` : '';
    if (field.type === 'textarea') return `<label>${esc(field.label)}<textarea id="${id}" name="${field.key}"${required}></textarea></label>`;
    if (field.type === 'select' || field.type === 'activity') {
      const options = field.type === 'activity'
        ? orderOverviewState.catalog.map(row => [row.code, row.name])
        : field.options.map(value => [value, value]);
      return `<label>${esc(field.label)}<select id="${id}" name="${field.key}"${required}>${options.map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select></label>`;
    }
    const type = field.type || 'text';
    const min = field.min != null ? ` min="${field.min}"` : '';
    const max = field.max != null ? ` max="${field.max}"` : '';
    return `<label>${esc(field.label)}<input id="${id}" name="${field.key}" type="${type}"${required}${length}${min}${max} /></label>`;
  }

  function renderEditor() {
    const config = configs[orderOverviewState.kind];
    fieldsHost.innerHTML = (config?.fields || []).map(inputMarkup).join('');
    editor.hidden = !config?.editable;
  }

  async function loadRows(kind, turnKey) {
    switch (kind) {
      case 'comments': return window.tribenet.listOrderText(turnKey, 'Comments');
      case 'gmActions': return window.tribenet.listOrderText(turnKey, 'GM Actions');
      case 'activities': return window.tribenet.listPlannedActivities(turnKey);
      case 'movement': return (await window.tribenet.listPlannedRoutes(turnKey)).filter(row => row.routeType === 'unit');
      case 'skillAttempts': return window.tribenet.getSkillAttempts(turnKey);
      case 'researchAttempts': return window.tribenet.listResearchAttempts(turnKey);
      default: return [];
    }
  }

  function cellsFor(kind, row) {
    switch (kind) {
      case 'comments':
      case 'gmActions': return [row.unit, row.message];
      case 'activities': return [row.unit, row.activityCode, Number(row.people || 0), row.target || '', row.distinction || '', row.miningDirection || '', row.notes || ''];
      case 'movement': return [row.unitCode, (row.directions || []).join(' → ') || 'Still'];
      case 'skillAttempts': return [row.tribe, row.order, row.skill, row.group || '', Number(row.baselineLevel || 0)];
      case 'researchAttempts': return [row.tribe, row.topic];
      default: return [];
    }
  }

  function rowKey(kind, row) {
    if (kind === 'skillAttempts') return `${row.tribe}:${row.order}`;
    return String(row.id);
  }

  function renderRows() {
    const config = configs[orderOverviewState.kind];
    headHost.innerHTML = `<tr>${config.headers.map(value => `<th>${esc(value)}</th>`).join('')}<th>Actions</th></tr>`;
    if (!orderOverviewState.rows.length) {
      rowsHost.innerHTML = `<tr><td class="transfer-overview-empty" colspan="${config.headers.length + 1}">No ${esc(config.title.toLowerCase())} saved for Turn ${esc(orderOverviewState.turnKey)}.</td></tr>`;
      return;
    }
    rowsHost.innerHTML = orderOverviewState.rows.map(row => {
      const cells = cellsFor(orderOverviewState.kind, row);
      const actions = orderOverviewState.kind === 'movement'
        ? `<button type="button" class="button tm-mini" data-action="edit" data-row="${esc(rowKey(orderOverviewState.kind,row))}">Edit on map</button><button type="button" class="button tm-mini danger" data-action="delete" data-row="${esc(rowKey(orderOverviewState.kind,row))}">Cancel</button>`
        : `<button type="button" class="button tm-mini" data-action="edit" data-row="${esc(rowKey(orderOverviewState.kind,row))}">Edit</button><button type="button" class="button tm-mini danger" data-action="delete" data-row="${esc(rowKey(orderOverviewState.kind,row))}">Remove</button>`;
      return `<tr>${cells.map(value => `<td>${esc(value)}</td>`).join('')}<td>${actions}</td></tr>`;
    }).join('');
  }

  async function refresh() {
    orderOverviewState.rows = await loadRows(orderOverviewState.kind, orderOverviewState.turnKey);
    orderOverviewState.rows.sort((a,b) => orderOverviewState.kind === 'movement'
      ? String(a.unitCode).localeCompare(String(b.unitCode), undefined, { numeric:true })
      : orderOverviewState.kind === 'activities'
        ? String(a.unit).localeCompare(String(b.unit), undefined, { numeric:true })
        : orderOverviewState.kind === 'skillAttempts'
          ? String(a.tribe).localeCompare(String(b.tribe)) || Number(a.order)-Number(b.order)
          : Number(a.id || 0)-Number(b.id || 0));
    turnLabel.textContent = `Turn ${orderOverviewState.turnKey} · ${orderOverviewState.rows.length} saved row${orderOverviewState.rows.length === 1 ? '' : 's'}`;
    renderRows();
  }

  async function open(kind) {
    const config = configs[kind];
    const turnKey = currentTurnKey();
    if (!config || !turnKey) return;
    orderOverviewState.kind = kind;
    orderOverviewState.turnKey = String(turnKey);
    title.textContent = config.title;
    status.textContent = '';
    resetEditor();
    renderEditor();
    try {
      if (kind === 'activities' && !orderOverviewState.catalog.length) orderOverviewState.catalog = await window.tribenet.getActivityCatalog();
      renderEditor();
      await refresh();
      if (!dialog.open) dialog.showModal();
      if (typeof turnActionsBindDialogDrag === 'function') turnActionsBindDialogDrag(dialog, 'orders-sheet-overview');
    } catch (error) {
      turnLabel.textContent = `Could not load ${config.title}: ${error.message || String(error)}`;
    }
  }

  function readForm() {
    const result = {};
    for (const field of configs[orderOverviewState.kind].fields) {
      const input = editor.elements.namedItem(field.key);
      result[field.key] = field.type === 'number' ? Number(input.value || 0) : String(input.value || '').trim();
    }
    return result;
  }

  async function saveTextOrder(sheet, row) {
    if (orderOverviewState.editing) return window.tribenet.updateOrderText(orderOverviewState.editing.id, row);
    return window.tribenet.addOrderText(orderOverviewState.turnKey, sheet, row);
  }

  async function saveSkillAttempt(attempt) {
    const old = orderOverviewState.editing;
    const tribeAttempts = await window.tribenet.getSkillAttempts(orderOverviewState.turnKey, attempt.tribe);
    const withoutOrder = tribeAttempts.filter(row => Number(row.order) !== Number(attempt.order));
    withoutOrder.push(attempt);
    const saved = await window.tribenet.saveSkillAttempts(orderOverviewState.turnKey, attempt.tribe, withoutOrder);
    if (old && old.tribe !== attempt.tribe) {
      const oldAttempts = await window.tribenet.getSkillAttempts(orderOverviewState.turnKey, old.tribe);
      await window.tribenet.saveSkillAttempts(orderOverviewState.turnKey, old.tribe, oldAttempts.filter(row => Number(row.order) !== Number(old.order)));
    }
    return saved;
  }

  editor.addEventListener('submit', async event => {
    event.preventDefault();
    const row = readForm();
    try {
      if (orderOverviewState.kind === 'comments') await saveTextOrder('Comments', row);
      else if (orderOverviewState.kind === 'gmActions') await saveTextOrder('GM Actions', row);
      else if (orderOverviewState.kind === 'activities') {
        if (orderOverviewState.editing) await window.tribenet.updatePlannedActivity(orderOverviewState.editing.id, row);
        else await window.tribenet.addPlannedActivity(orderOverviewState.turnKey, row);
      } else if (orderOverviewState.kind === 'skillAttempts') await saveSkillAttempt(row);
      else if (orderOverviewState.kind === 'researchAttempts') {
        if (orderOverviewState.editing) await window.tribenet.updateResearchAttempt(orderOverviewState.editing.id, row);
        else await window.tribenet.addResearchAttempt(orderOverviewState.turnKey, row);
      }
      resetEditor();
      await refresh();
      if (typeof savedMovementRefresh === 'function' && ['activities','skillAttempts'].includes(orderOverviewState.kind)) await savedMovementRefresh();
      if (typeof turnActionsRender === 'function') turnActionsRender();
    } catch (error) {
      status.textContent = error.message || String(error);
    }
  });

  function beginEdit(row) {
    if (!configs[orderOverviewState.kind]?.editable) return;
    orderOverviewState.editing = row;
    for (const field of configs[orderOverviewState.kind].fields) {
      const input = editor.elements.namedItem(field.key);
      const value = orderOverviewState.kind === 'comments' || orderOverviewState.kind === 'gmActions'
        ? field.key === 'message' ? row.message : row[field.key]
        : row[field.key];
      input.value = value ?? '';
    }
    document.getElementById('orderSheetOverviewSave').textContent = 'Save changes';
    document.getElementById('orderSheetOverviewCancelEdit').hidden = false;
    status.textContent = `Editing saved ${configs[orderOverviewState.kind].title} row.`;
  }

  async function removeRow(row) {
    if (!window.confirm(`Remove this ${configs[orderOverviewState.kind].title} order from Turn ${orderOverviewState.turnKey}?`)) return;
    switch (orderOverviewState.kind) {
      case 'comments':
      case 'gmActions': await window.tribenet.deleteOrderText(row.id); break;
      case 'activities': await window.tribenet.deletePlannedActivity(row.id); break;
      case 'movement': await window.tribenet.removePlannedRoute(row.id); break;
      case 'skillAttempts': {
        const attempts = await window.tribenet.getSkillAttempts(orderOverviewState.turnKey, row.tribe);
        await window.tribenet.saveSkillAttempts(orderOverviewState.turnKey, row.tribe, attempts.filter(item => Number(item.order) !== Number(row.order)));
        break;
      }
      case 'researchAttempts': await window.tribenet.deleteResearchAttempt(row.id); break;
    }
    await refresh();
    if (typeof savedMovementRefresh === 'function' && ['activities','skillAttempts','movement'].includes(orderOverviewState.kind)) await savedMovementRefresh();
    if (typeof turnActionsRender === 'function') turnActionsRender();
  }

  rowsHost.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = orderOverviewState.rows.find(item => rowKey(orderOverviewState.kind, item) === button.dataset.row);
    if (!row) return;
    if (button.dataset.action === 'delete') { await removeRow(row); return; }
    if (orderOverviewState.kind === 'movement') {
      dialog.close();
      state.selectedUnit = row.unitCode;
      state.selectedUnitHex = row.originHex || state.selectedUnitHex;
      savedMovementPlansState.selectedUnitCode = row.unitCode;
      state.selectedRouteId = typeof savedMovementRouteKey === 'function' ? savedMovementRouteKey(row) : null;
      if (typeof turnActionsRender === 'function') turnActionsRender();
      if (typeof draw === 'function') draw();
      if (typeof turnActionsStart === 'function') await turnActionsStart('unit', { route:row });
      return;
    }
    beginEdit(row);
  });

  menuButton?.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    menuButton.setAttribute('aria-expanded', String(open));
  });
  menu?.querySelectorAll('[data-order-sheet]').forEach(button => button.addEventListener('click', () => {
    menu.classList.add('hidden');
    menuButton?.setAttribute('aria-expanded', 'false');
    open(button.dataset.orderSheet);
  }));
  document.getElementById('orderSheetOverviewCancelEdit')?.addEventListener('click', resetEditor);
  document.getElementById('orderSheetOverviewClose')?.addEventListener('click', () => dialog.close());
  document.getElementById('orderSheetOverviewDone')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
})();

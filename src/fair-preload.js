const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fairnet', {
  importWorkbook:turnKey => ipcRenderer.invoke('fair:import', turnKey),
  listSnapshots:() => ipcRenderer.invoke('fair:list'),
  getSnapshot:turnKey => ipcRenderer.invoke('fair:get', turnKey),
  getCraftingCatalog:() => ipcRenderer.invoke('fair:recipes'),
  backup:() => ipcRenderer.invoke('fair:backup')
});

window.addEventListener('DOMContentLoaded', () => {
  const page = String(window.location.pathname || '').split('/').pop() || 'index.html';
  if (page !== 'index.html' || document.getElementById('openFairButton')) return;
  const grid = document.querySelector('.module-grid');
  if (!grid) return;
  const button = document.createElement('button');
  button.id = 'openFairButton';
  button.className = 'module-card enabled';
  button.innerHTML = `
    <div class="module-icon">¤</div>
    <div><h2>Fair</h2><p>Import Month 04/10 Fair workbooks, compare prices, value combined holdings and plan the best craft-and-trade opportunities.</p></div>
    <span class="module-status">Open</span>`;
  button.addEventListener('click', () => { window.location.href = 'fair.html'; });
  grid.appendChild(button);
});

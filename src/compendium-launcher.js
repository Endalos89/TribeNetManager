(() => {
  const grid = document.querySelector('.module-grid');
  if (!grid || document.getElementById('openCompendiumButton')) return;
  const button = document.createElement('button');
  button.id = 'openCompendiumButton';
  button.className = 'module-card enabled';
  button.innerHTML = '<div class="module-icon">▤</div><div><h2>Compendium</h2><p>Mandate-first reference for skills, crafting, limitations, land combat, naval combat and linked rules.</p></div><span class="module-status">Open</span>';
  button.addEventListener('click', () => { location.href = 'compendium.html'; });
  grid.appendChild(button);
})();

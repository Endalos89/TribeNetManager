(() => {
  const grid = document.querySelector('.module-grid');
  if (!grid || document.getElementById('openRavenpostButton')) return;

  const button = document.createElement('button');
  button.id = 'openRavenpostButton';
  button.className = 'module-card enabled';
  button.innerHTML = `
    <div class="module-icon">R</div>
    <div>
      <h2>Ravenpost</h2>
      <p>Read and reply to game mail, link senders to Clans / Tribes, and hear when a new raven arrives.</p>
    </div>
    <span class="module-status">Open</span>`;
  button.addEventListener('click', () => {
    location.href = 'ravenpost.html';
  });
  grid.appendChild(button);
})();

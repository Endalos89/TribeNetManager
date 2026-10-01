(() => {
  const button = document.getElementById('importFairButton');
  if (!button) return;

  function applyLauncherManagedState() {
    button.disabled = false;
    button.textContent = 'Manage Fair Files on Launcher';
    button.title = 'Fair workbooks are now imported once from the main Launcher and shared by both Fair views.';
    const note = document.getElementById('planningTurnNote');
    if (note && !note.querySelector('.launcher-managed-fair-note')) {
      const line = document.createElement('div');
      line.className = 'launcher-managed-fair-note';
      line.style.marginTop = '8px';
      line.style.color = '#b9cbd6';
      line.textContent = 'Fair workbooks are managed from the Launcher and shared with Fairground.';
      note.appendChild(line);
    }
  }

  document.addEventListener('click', event => {
    if (event.target?.id !== 'importFairButton') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = 'index.html';
  }, true);

  const observer = new MutationObserver(applyLauncherManagedState);
  observer.observe(button, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['disabled','title'] });
  document.getElementById('planningTurnNote') && observer.observe(document.getElementById('planningTurnNote'), { childList:true, subtree:true });
  applyLauncherManagedState();
})();

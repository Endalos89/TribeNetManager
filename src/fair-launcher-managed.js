(() => {
  const button = document.getElementById('importFairButton');
  if (!button) return;
  const desiredText = 'Manage Fair Files on Launcher';
  const desiredTitle = 'Fair workbooks are imported once from the main Launcher and shared by both Fair views.';

  function applyLauncherManagedState() {
    if (button.disabled) button.disabled = false;
    if (button.textContent !== desiredText) button.textContent = desiredText;
    if (button.title !== desiredTitle) button.title = desiredTitle;
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
  const note = document.getElementById('planningTurnNote');
  if (note) observer.observe(note, { childList:true, subtree:true });
  applyLauncherManagedState();
})();

(() => {
  const grid = document.querySelector('.module-grid');
  if (!grid || document.getElementById('openRavenpostButton')) return;

  const reportButton = document.createElement('button');
  reportButton.id = 'pickupRavenpostResultsButton';
  reportButton.className = 'module-card enabled ravenpost-report-card hidden';
  reportButton.innerHTML = `
    <div class="module-icon">↓</div>
    <div>
      <h2>Pick Up Results Report</h2>
      <p id="ravenpostResultsReportDescription">Check Ravenpost for the latest report.</p>
    </div>
    <span class="module-status">New report</span>`;
  reportButton.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('tribenet-pickup-ravenpost-report'));
  });

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
  grid.appendChild(reportButton);
  grid.appendChild(button);

  const description = reportButton.querySelector('#ravenpostResultsReportDescription');
  const refreshResultsReport = async () => {
    try {
      const report = await window.ravenpost?.findLatestResultsReport?.();
      if (!report || report.error) {
        reportButton.classList.add('hidden');
        return;
      }
      reportButton.classList.remove('hidden');
      const received = report.receivedAt ? new Date(report.receivedAt).toLocaleDateString() : '';
      description.textContent = [report.filename, received, report.subject].filter(Boolean).join(' · ');
    } catch (error) {
      reportButton.classList.add('hidden');
      console.warn('Could not check Ravenpost for a Results report:', error.message);
    }
  };
  refreshResultsReport();
  window.ravenpost?.onSyncStatus?.(payload => {
    if (payload?.state === 'complete') refreshResultsReport();
  });
  window.addEventListener('tribenet-ravenpost-report-imported', refreshResultsReport);
})();

(() => {
  const scripts = [
    'mandate-reference-batch-5-01.js',
    'mandate-reference-batch-5-02.js',
    'mandate-reference-batch-5-03.js',
    'compendium-mandate-batch5.js'
  ];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForBatch4Ui() {
    for (let attempt = 0; attempt < 400; attempt++) {
      const progress = document.querySelector('#compNav [data-view="mandate-home"] small');
      if (progress?.textContent?.trim() === '4/5') return;
      await sleep(25);
    }
    throw new Error('Timed out waiting for Mandate Batch 4 UI to finish loading');
  }

  (async () => {
    await waitForBatch4Ui();
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Unable to load ${src}`));
        document.body.appendChild(script);
      });
    }
  })().catch(error => console.error('Mandate Batch 5 loader failed', error));
})();

(() => {
  const scripts = [
    'mandate-reference-batch-4-01.js',
    'mandate-reference-batch-4-02.js',
    'mandate-reference-batch-4-03.js',
    'mandate-reference-batch-4-04.js',
    'mandate-reference-batch-4-05.js',
    'mandate-reference-batch-4-06.js',
    'mandate-reference-batch-4-07.js',
    'mandate-reference-batch-4-08.js',
    'compendium-mandate-batch4.js'
  ];

  (async () => {
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Unable to load ${src}`));
        document.body.appendChild(script);
      });
    }
  })().catch(error => console.error('Mandate Batch 4 loader failed', error));
})();

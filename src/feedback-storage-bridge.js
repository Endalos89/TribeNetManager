(() => {
  'use strict';

  function inject(src) {
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', resolve, { once: true });
      document.body.appendChild(script);
    });
  }

  async function start() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    await inject('feedback-round3.js');
    try { await window.TribeNetFeedbackRound3Ready; } catch (_) {}
    await inject('feedback.js');
    await inject('feedback-drag.js');
    await inject('feedback-review-fixes.js');
    await inject('feedback-review-cultural-profit.js');
    await inject('feedback-followup-fixes.js');
    if (page === 'index.html') await inject('mapper-food-gathering-followup.js');
    if (page === 'compendium.html') await inject('compendium-item-progressive.js');
    await inject('feedback-round5.js');
  }

  start();
})();

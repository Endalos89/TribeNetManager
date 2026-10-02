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
    await inject('feedback-round3.js');
    try { await window.TribeNetFeedbackRound3Ready; } catch (_) {}
    await inject('feedback.js');
    await inject('feedback-drag.js');
    await inject('feedback-review-fixes.js');
    await inject('feedback-review-cultural-profit.js');
    await inject('feedback-followup-fixes.js');
  }

  start();
})();

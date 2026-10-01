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
    await inject('feedback.js');
    await inject('feedback-drag.js');
  }

  start();
})();
(() => {
  'use strict';

  function start() {
    const script = document.createElement('script');
    script.src = 'feedback.js';
    script.async = false;
    document.body.appendChild(script);
  }

  start();
})();
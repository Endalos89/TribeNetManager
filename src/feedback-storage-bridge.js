(() => {
  'use strict';

  const STORAGE_KEY = 'tribenet.feedback.v1';

  async function start() {
    let sharedComments = [];
    try {
      if (window.tribenet && typeof window.tribenet.loadFeedbackComments === 'function') {
        sharedComments = await window.tribenet.loadFeedbackComments();
      }
    } catch (error) {
      console.error('Could not hydrate shared feedback comments', error);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(sharedComments) ? sharedComments : []));
    } catch (error) {
      console.error('Could not hydrate local feedback cache', error);
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this !== localStorage || key !== STORAGE_KEY) return;
      try {
        const parsed = JSON.parse(value || '[]');
        if (window.tribenet && typeof window.tribenet.saveFeedbackComments === 'function') {
          window.tribenet.saveFeedbackComments(Array.isArray(parsed) ? parsed : []);
        }
      } catch (error) {
        console.error('Could not persist shared feedback comments', error);
      }
    };

    const script = document.createElement('script');
    script.src = 'feedback.js';
    script.async = false;
    document.body.appendChild(script);
  }

  start();
})();

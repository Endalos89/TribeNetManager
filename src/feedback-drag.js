(() => {
  'use strict';

  const BOUND_ATTR = 'data-feedback-draggable-bound';
  const HANDLE_SELECTOR = '.feedback-dialog__head, .feedback-panel__head';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function bindSurface(surface) {
    if (!surface || surface.hasAttribute(BOUND_ATTR)) return;
    const handle = surface.querySelector(HANDLE_SELECTOR);
    if (!handle) return;

    surface.setAttribute(BOUND_ATTR, 'true');
    handle.title = 'Drag to move';
    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', event => {
      if (event.button !== 0) return;
      if (event.target.closest('button, input, select, textarea, a, label')) return;

      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      surface.style.position = 'fixed';
      surface.style.left = `${rect.left}px`;
      surface.style.top = `${rect.top}px`;
      surface.style.margin = '0';
      surface.style.width = `${rect.width}px`;
      handle.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const move = moveEvent => {
        const current = surface.getBoundingClientRect();
        const maxLeft = window.innerWidth - current.width - 8;
        const maxTop = window.innerHeight - Math.min(current.height, window.innerHeight - 16) - 8;
        surface.style.left = `${clamp(moveEvent.clientX - offsetX, 8, maxLeft)}px`;
        surface.style.top = `${clamp(moveEvent.clientY - offsetY, 8, maxTop)}px`;
      };

      const stop = () => {
        handle.style.cursor = 'grab';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('mouseup', stop, true);
      };

      window.addEventListener('mousemove', move, true);
      window.addEventListener('mouseup', stop, true);
    });
  }

  function scan(root = document) {
    root.querySelectorAll?.('.feedback-dialog, .feedback-panel').forEach(bindSurface);
    if (root.matches?.('.feedback-dialog, .feedback-panel')) bindSurface(root);
  }

  scan();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) scan(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
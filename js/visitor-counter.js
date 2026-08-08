(() => {
  'use strict';

  const root = document.querySelector('[data-ab-visitor-counter]');
  if (!root) return;

  const viewsEl = root.querySelector('[data-ab-page-views]');
  const uniqueEl = root.querySelector('[data-ab-unique-visitors]');
  const statusEl = root.querySelector('[data-ab-visitor-status]');

  const setStatus = (message, state = '') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.state = state;
  };

  function getVisitorKey() {
    const storageKey = 'adventure_builder_visitor_key_v1';
    try {
      let value = localStorage.getItem(storageKey);
      if (!value) {
        value = (crypto?.randomUUID?.() || `ab-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(storageKey, value);
      }
      return value;
    } catch (_) {
      return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  async function initialise() {
    const client = window.ADVENTURE_BUILDER_AUTH?.client;
    if (!client) {
      setStatus('Visitor totals will appear when the website service is connected.');
      return;
    }

    const path = location.pathname || '/';
    const visitorKey = getVisitorKey();
    const { data, error } = await client.rpc('record_website_visit', {
      p_path: path,
      p_visitor_key: visitorKey
    });

    if (error) {
      console.warn('[Adventure Builder] Visitor counter unavailable:', error.message);
      setStatus('Visitor totals are temporarily unavailable.');
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setStatus('Visitor totals are temporarily unavailable.');
      return;
    }

    if (viewsEl) viewsEl.textContent = Number(row.total_views || 0).toLocaleString('en-GB');
    if (uniqueEl) uniqueEl.textContent = Number(row.unique_visitors || 0).toLocaleString('en-GB');
    setStatus('Live website totals', 'ready');
  }

  initialise().catch(error => {
    console.warn('[Adventure Builder] Visitor counter failed:', error);
    setStatus('Visitor totals are temporarily unavailable.');
  });
})();

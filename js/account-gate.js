(() => {
  'use strict';

  const PROTECTED_PAGES = new Set([
    'accident-assistance.html',
    'adventure-finder.html',
    'adventures.html',
    'community.html',
    'explore.html',
    'gallery.html',
    'journal.html',
    'paddling.html',
    'passport.html',
    'studio.html',
    'trip-planner.html',
    'van-life.html',
    'walking-hiking.html',
    'outdoor-skills.html',
    'shop-admin.html'
  ]);

  const body = document.body;
  const pageRequiresAccount = body?.dataset?.accountRequired === 'true';
  let sessionResolved = false;
  let signedIn = false;

  function safeTarget(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return '';
      const file = url.pathname.split('/').pop() || 'index.html';
      return PROTECTED_PAGES.has(file) ? `${file}${url.search}${url.hash}` : '';
    } catch (_) {
      return '';
    }
  }

  function rememberTarget(target) {
    const safe = safeTarget(target);
    if (!safe) return;
    try { sessionStorage.setItem('ab_after_auth_target', safe); } catch (_) {}
  }

  function consumeTarget() {
    try {
      const target = safeTarget(sessionStorage.getItem('ab_after_auth_target') || '');
      if (target) sessionStorage.removeItem('ab_after_auth_target');
      return target;
    } catch (_) { return ''; }
  }

  function ensureGate() {
    if (!pageRequiresAccount || document.getElementById('ab-account-gate')) return;
    const gate = document.createElement('section');
    gate.className = 'ab-account-gate';
    gate.id = 'ab-account-gate';
    gate.setAttribute('aria-labelledby', 'ab-account-gate-title');
    gate.innerHTML = `
      <div class="ab-account-gate-card">
        <img class="ab-account-gate-logo" src="images/adventure-builder-logo.png" alt="Adventure Builder">
        <p class="eyebrow">Adventure Builder member facility</p>
        <h1 id="ab-account-gate-title">Sign in to continue</h1>
        <p>Create a free Adventure Builder account or log in to use this facility. Your saved trips, journals, Passport activity and other member data stay connected to your account.</p>
        <div class="ab-account-gate-actions">
          <button class="button button-primary" type="button" data-account-gate-action="login">Log in</button>
          <button class="button button-secondary" type="button" data-account-gate-action="register">Create account</button>
        </div>
        <small class="ab-account-gate-note">Browsing the main Adventure Builder website remains public. Using member facilities requires an account.</small>
      </div>`;
    const header = document.querySelector('.site-header');
    if (header) header.insertAdjacentElement('afterend', gate);
    else body.prepend(gate);

    gate.addEventListener('click', (event) => {
      const action = event.target.closest('[data-account-gate-action]')?.dataset.accountGateAction;
      if (!action) return;
      rememberTarget(window.location.href);
      window.ADVENTURE_BUILDER_AUTH?.open?.(action === 'register' ? 'register' : 'login');
    });
  }

  function renderGate() {
    if (!pageRequiresAccount) return;
    ensureGate();
    body.classList.toggle('ab-account-gated', !signedIn);
    const gate = document.getElementById('ab-account-gate');
    if (gate) gate.hidden = signedIn;
  }

  function onAuth(detail) {
    sessionResolved = true;
    signedIn = Boolean(detail?.session?.user || detail?.user);
    renderGate();

    if (signedIn && !pageRequiresAccount) {
      const target = consumeTarget();
      if (target) window.location.assign(target);
    } else if (signedIn && pageRequiresAccount) {
      // We are already at the requested facility; do not redirect elsewhere.
      try { sessionStorage.removeItem('ab_after_auth_target'); } catch (_) {}
    }
  }

  window.addEventListener('adventurebuilder:auth', (event) => onAuth(event.detail));

  // auth.js may already have initialised before this module executes.
  const existing = window.ADVENTURE_BUILDER_AUTH?.getSession?.();
  if (existing?.user) onAuth({ session: existing, user: existing.user });
  else if (pageRequiresAccount) renderGate();

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || event.defaultPrevented) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    let url;
    try { url = new URL(href, window.location.href); } catch (_) { return; }
    if (url.origin !== window.location.origin) return;
    const file = url.pathname.split('/').pop() || 'index.html';
    if (!PROTECTED_PAGES.has(file)) return;
    if (signedIn) return;

    event.preventDefault();
    rememberTarget(url.href);
    window.ADVENTURE_BUILDER_AUTH?.open?.('login');
  }, true);

  // Expose only small diagnostic helpers; no security decision relies on this object.
  window.ADVENTURE_BUILDER_ACCOUNT_GATE = {
    requiresAccount: pageRequiresAccount,
    isSignedIn: () => signedIn,
    isSessionResolved: () => sessionResolved
  };
})();

(() => {
  'use strict';

  const service = window.ADVENTURE_BUILDER_AUTH_SERVICE;
  const client = service?.client || null;
  const elements = {
    overlay: document.getElementById('auth-overlay'),
    close: document.getElementById('auth-close'),
    openLogin: document.getElementById('open-login'),
    openRegister: document.getElementById('open-register'),
    chip: document.getElementById('account-chip'),
    chipLabel: document.getElementById('account-label'),
    chipAvatar: document.getElementById('account-avatar'),
    signedOut: document.getElementById('auth-signed-out'),
    signedIn: document.getElementById('auth-signed-in'),
    loginTab: document.getElementById('login-tab'),
    registerTab: document.getElementById('register-tab'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    status: document.getElementById('auth-status'),
    panelName: document.getElementById('panel-name'),
    panelEmail: document.getElementById('panel-email'),
    panelAvatar: document.getElementById('panel-avatar'),
    continueWebsite: document.getElementById('continue-website'),
    accountSettings: document.getElementById('account-settings'),
    logout: document.getElementById('logout-button')
  };

  let currentSession = null;
  let busy = false;

  function setStatus(message = '', type = '') {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function setBusy(value) {
    busy = Boolean(value);
    [elements.loginForm, elements.registerForm].forEach((form) => {
      if (!form) return;
      form.setAttribute('aria-busy', String(busy));
      form.querySelectorAll('input,button').forEach((control) => { control.disabled = busy; });
    });
    if (elements.logout) elements.logout.disabled = busy;
  }

  function errorMessage(error, fallback) {
    console.error('Adventure Builder authentication error:', error);
    return service?.friendlyError?.(error, fallback) || fallback;
  }

  function displayName(user) {
    return user?.user_metadata?.name?.trim() || user?.email?.split('@')[0] || 'Adventurer';
  }

  function initial(name) {
    return (name?.trim()?.[0] || 'A').toUpperCase();
  }

  function setMode(mode) {
    const login = mode === 'login';
    if (elements.loginForm) elements.loginForm.hidden = !login;
    if (elements.registerForm) elements.registerForm.hidden = login;
    elements.loginTab?.classList.toggle('active', login);
    elements.registerTab?.classList.toggle('active', !login);
    elements.loginTab?.setAttribute('aria-selected', String(login));
    elements.registerTab?.setAttribute('aria-selected', String(!login));
    setStatus();
  }

  function openDialog(mode = 'login') {
    if (!elements.overlay) return;
    setMode(mode);
    elements.overlay.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => {
      const target = mode === 'register' ? document.getElementById('register-name') : document.getElementById('login-email');
      target?.focus();
    }, 0);
  }

  function closeDialog() {
    if (!elements.overlay || busy) return;
    elements.overlay.hidden = true;
    document.body.classList.remove('modal-open');
    setStatus();
  }

  function renderSession(session) {
    currentSession = session || null;
    window.dispatchEvent(new CustomEvent('adventurebuilder:auth', { detail: { session: currentSession, user: currentSession?.user || null, client } }));
    const user = session?.user || null;
    const signedIn = Boolean(user);

    if (elements.openLogin) elements.openLogin.hidden = signedIn;
    if (elements.openRegister) elements.openRegister.hidden = signedIn;
    if (elements.chip) {
      elements.chip.hidden = !signedIn;
      elements.chip.setAttribute('aria-hidden', String(!signedIn));
    }
    if (elements.signedOut) elements.signedOut.hidden = signedIn;
    if (elements.signedIn) elements.signedIn.hidden = !signedIn;

    if (!user) {
      window.AdventureProfile?.clearAccountContext?.();
      window.AdventureAccessibility?.clearAccount?.();
      if (elements.chipLabel) elements.chipLabel.textContent = 'My account';
      if (elements.chipAvatar) elements.chipAvatar.textContent = 'A';
      return;
    }

    const name = displayName(user);
    const avatar = initial(name);
    if (elements.chipLabel) elements.chipLabel.textContent = name;
    if (elements.chipAvatar) elements.chipAvatar.textContent = avatar;
    if (elements.panelAvatar) elements.panelAvatar.textContent = avatar;
    if (elements.panelName) elements.panelName.textContent = `Welcome, ${name}`;
    if (elements.panelEmail) elements.panelEmail.textContent = user.email || '';
    if (window.AdventureProfile) {
      window.AdventureProfile.loadAccount(client, user).then(() => window.AdventureProfile.consumePending(client, user)).catch(() => {});
    }
  }

  elements.openLogin?.addEventListener('click', () => openDialog('login'));
  elements.openRegister?.addEventListener('click', () => openDialog('register'));
  elements.chip?.addEventListener('click', () => openDialog('login'));
  elements.close?.addEventListener('click', closeDialog);
  elements.loginTab?.addEventListener('click', () => !busy && setMode('login'));
  elements.registerTab?.addEventListener('click', () => !busy && setMode('register'));
  elements.overlay?.addEventListener('click', (event) => {
    if (event.target === elements.overlay) closeDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.overlay && !elements.overlay.hidden) closeDialog();
  });

  elements.loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!service?.isConfigured) return setStatus('Account service is unavailable. Please reload the page and try again.', 'error');
    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    setBusy(true);
    setStatus('Logging in…');
    try {
      const { error } = await service.signIn(email, password);
      if (error) return setStatus(errorMessage(error, 'Unable to log in. Please check your details and try again.'), 'error');
      elements.loginForm.reset();
      setStatus('You are logged in.', 'success');
    } catch (error) {
      setStatus(errorMessage(error, 'Unable to log in right now. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  });

  elements.registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!service?.isConfigured) return setStatus('Account service is unavailable. Please reload the page and try again.', 'error');
    const name = document.getElementById('register-name')?.value.trim() || '';
    const email = document.getElementById('register-email')?.value.trim() || '';
    const password = document.getElementById('register-password')?.value || '';
    const confirm = document.getElementById('register-confirm')?.value || '';
    const terms = document.getElementById('register-terms');
    const pendingProfile = window.AdventureProfileRegistration?.read?.() || null;
    if (password !== confirm) return setStatus('The passwords do not match.', 'error');
    if (!terms?.checked) return setStatus('Please agree to the Terms & Conditions and Privacy Policy.', 'error');

    setBusy(true);
    setStatus('Creating your account…');
    try {
      const { data, error } = await service.signUp({
        name,
        email,
        password,
        emailRedirectTo: `${window.location.origin}/`
      });
      if (error) return setStatus(errorMessage(error, 'Unable to create your account. Please try again.'), 'error');
      if (pendingProfile) window.AdventureProfile?.stageRegistration?.(pendingProfile);
      elements.registerForm.reset();
      window.AdventureProfileRegistration?.reset?.();
      if (data?.session) {
        if (pendingProfile) window.AdventureProfile?.consumePending?.(client, data.session.user).catch(() => {});
        setStatus('Your account is ready and you are logged in.', 'success');
      } else {
        setMode('login');
        setStatus('Account created. Check your email to confirm it, then log in.', 'success');
      }
    } catch (error) {
      setStatus(errorMessage(error, 'Unable to create your account right now. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  });

  elements.continueWebsite?.addEventListener('click', () => {
    closeDialog();
    document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.accountSettings?.addEventListener('click', () => {
    closeDialog();
    if (window.AdventureProfileUI?.openSettings) window.AdventureProfileUI.openSettings();
    else setStatus('Adventure Profile settings are unavailable.', 'error');
  });

  elements.logout?.addEventListener('click', async () => {
    if (!service?.isConfigured) return;
    setBusy(true);
    setStatus('Logging out…');
    try {
      const { error } = await service.signOut();
      if (error) return setStatus(errorMessage(error, 'Unable to log out. Please try again.'), 'error');
      setStatus('You are logged out.', 'success');
    } catch (error) {
      setStatus(errorMessage(error, 'Unable to log out right now. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  });

  window.ADVENTURE_BUILDER_AUTH = { client, getSession: () => currentSession, open: openDialog };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-auth]');
    if (button) openDialog(button.dataset.openAuth || 'login');
  });

  renderSession(null);

  async function initialise() {
    if (!service?.isConfigured) {
      renderSession(null);
      console.error('Adventure Builder Supabase configuration or library is missing.');
      return;
    }
    try {
      const { data, error } = await service.getSession();
      if (error) console.error('Unable to restore Adventure Builder session:', error);
      renderSession(data?.session || null);
    } catch (error) {
      renderSession(null);
      console.error('Unable to restore Adventure Builder session:', error);
    }
    client.auth.onAuthStateChange((_event, session) => renderSession(session));
  }

  initialise().catch((error) => {
    renderSession(null);
    console.error('Adventure Builder authentication failed to initialise:', error);
  });
})();

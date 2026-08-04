(() => {
  'use strict';

  const config = window.ADVENTURE_BUILDER_CONFIG || {};
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

  const hasConfig = Boolean(window.supabase?.createClient && config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY);
  const client = hasConfig
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  function setStatus(message = '', type = '') {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function displayName(user) {
    return user?.user_metadata?.name?.trim() || user?.email?.split('@')[0] || 'Adventurer';
  }

  function initial(name) {
    return (name?.trim()?.[0] || 'A').toUpperCase();
  }

  function setMode(mode) {
    const login = mode === 'login';
    elements.loginForm.hidden = !login;
    elements.registerForm.hidden = login;
    elements.loginTab.classList.toggle('active', login);
    elements.registerTab.classList.toggle('active', !login);
    elements.loginTab.setAttribute('aria-selected', String(login));
    elements.registerTab.setAttribute('aria-selected', String(!login));
    setStatus();
  }

  function openDialog(mode = 'login') {
    setMode(mode);
    elements.overlay.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => {
      const target = mode === 'register' ? document.getElementById('register-name') : document.getElementById('login-email');
      target?.focus();
    }, 0);
  }

  function closeDialog() {
    elements.overlay.hidden = true;
    document.body.classList.remove('modal-open');
    setStatus();
  }

  function renderSession(session) {
    const user = session?.user || null;
    const signedIn = Boolean(user);

    // Signed out: Log in + Register only. Signed in: Account only.
    elements.openLogin.hidden = signedIn;
    elements.openRegister.hidden = signedIn;
    elements.chip.hidden = !signedIn;
    elements.chip.setAttribute('aria-hidden', String(!signedIn));
    elements.signedOut.hidden = signedIn;
    elements.signedIn.hidden = !signedIn;

    if (!user) {
      elements.chipLabel.textContent = 'My account';
      elements.chipAvatar.textContent = 'A';
      return;
    }
    const name = displayName(user);
    const avatar = initial(name);
    elements.chipLabel.textContent = name;
    elements.chipAvatar.textContent = avatar;
    elements.panelAvatar.textContent = avatar;
    elements.panelName.textContent = `Welcome, ${name}`;
    elements.panelEmail.textContent = user.email || '';
  }

  elements.openLogin?.addEventListener('click', () => openDialog('login'));
  elements.openRegister?.addEventListener('click', () => openDialog('register'));
  elements.chip?.addEventListener('click', () => openDialog('login'));
  elements.close?.addEventListener('click', closeDialog);
  elements.loginTab?.addEventListener('click', () => setMode('login'));
  elements.registerTab?.addEventListener('click', () => setMode('register'));
  elements.overlay?.addEventListener('click', (event) => {
    if (event.target === elements.overlay) closeDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.overlay.hidden) closeDialog();
  });

  elements.loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) return setStatus('Account service is not configured.', 'error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    setStatus('Logging in…');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return setStatus(error.message, 'error');
    elements.loginForm.reset();
    setStatus('You are logged in.', 'success');
  });

  elements.registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) return setStatus('Account service is not configured.', 'error');
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    if (password !== confirm) return setStatus('The passwords do not match.', 'error');
    setStatus('Creating your account…');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    if (error) return setStatus(error.message, 'error');
    elements.registerForm.reset();
    if (data.session) {
      setStatus('Your account is ready and you are logged in.', 'success');
    } else {
      setMode('login');
      setStatus('Account created. Check your email to confirm it, then log in.', 'success');
    }
  });

  elements.continueWebsite?.addEventListener('click', () => {
    closeDialog();
    document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.accountSettings?.addEventListener('click', () => {
    setStatus('Account settings will be added in the next account stage. You can continue using the website now.');
  });

  elements.logout?.addEventListener('click', async () => {
    if (!client) return;
    setStatus('Logging out…');
    const { error } = await client.auth.signOut();
    if (error) return setStatus(error.message, 'error');
    setStatus('You are logged out.', 'success');
  });

  renderSession(null);

  async function initialise() {
    if (!client) {
      renderSession(null);
      console.error('Adventure Builder Supabase configuration is missing.');
      return;
    }
    const { data, error } = await client.auth.getSession();
    if (error) console.error('Unable to restore Adventure Builder session:', error.message);
    renderSession(data?.session || null);
    client.auth.onAuthStateChange((_event, session) => renderSession(session));
  }

  initialise().catch((error) => {
    renderSession(null);
    console.error('Adventure Builder authentication failed to initialise:', error);
  });
})();

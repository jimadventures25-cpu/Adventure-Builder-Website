(() => {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 20000;
  const config = window.ADVENTURE_BUILDER_CONFIG || {};

  function createClient() {
    if (!window.supabase?.createClient || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) return null;
    return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function timeoutError() {
    const error = new Error('Authentication request timed out.');
    error.code = 'request_timeout';
    return error;
  }

  async function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = window.setTimeout(() => reject(timeoutError()), timeoutMs);
        })
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
    const code = error?.code || '';
    const messages = {
      invalid_credentials: 'The email address or password is incorrect.',
      email_not_confirmed: 'Please confirm your email address before logging in.',
      user_already_exists: 'An account already exists for this email address.',
      signup_disabled: 'New account registration is temporarily unavailable.',
      weak_password: 'Please choose a stronger password.',
      over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
      request_timeout: 'The account service took too long to respond. Check your connection and try again.',
      unexpected_failure: 'The account service is temporarily unavailable. Please try again.'
    };
    if (messages[code]) return messages[code];
    if (error instanceof TypeError || /fetch|network|failed to fetch/i.test(error?.message || '')) {
      return 'Unable to reach the account service. Check your connection and try again.';
    }
    return fallback;
  }

  const client = createClient();

  const service = {
    client,
    isConfigured: Boolean(client),
    friendlyError,
    async getSession() {
      if (!client) throw new Error('Account service is not configured.');
      return withTimeout(client.auth.getSession());
    },
    async signIn(email, password) {
      if (!client) throw new Error('Account service is not configured.');
      return withTimeout(client.auth.signInWithPassword({ email, password }));
    },
    async signUp({ name, email, password, emailRedirectTo }) {
      if (!client) throw new Error('Account service is not configured.');
      return withTimeout(client.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo }
      }));
    },
    async signOut() {
      if (!client) throw new Error('Account service is not configured.');
      return withTimeout(client.auth.signOut());
    }
  };

  window.ADVENTURE_BUILDER_AUTH_SERVICE = Object.freeze(service);
})();

(() => {
  'use strict';
  const KEY = 'adventure-builder-plans-v1';
  const EVENT = 'adventurebuilder:shared-plans-changed';
  let client = null;
  let syncing = null;

  const safeJson = (raw, fallback) => { try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } };
  const now = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `adv-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const readLocal = () => safeJson(localStorage.getItem(KEY), []);
  const normalise = (plan = {}) => ({
    id: String(plan.id || plan.plan_id || uid()),
    name: String(plan.name || plan.title || plan.destination || 'Adventure').trim().slice(0, 100),
    start: String(plan.start || plan.startName || '').trim().slice(0, 160),
    destination: String(plan.destination || plan.endName || plan.location || '').trim().slice(0, 160),
    tripType: String(plan.tripType || plan.type || 'Road Trip'),
    routeStyle: String(plan.routeStyle || 'fastest'),
    days: Math.max(1, Number(plan.days) || 1),
    date: String(plan.date || '').slice(0, 10),
    notes: String(plan.notes || ''),
    avoid: { motorways: !!plan.avoid?.motorways, tolls: !!plan.avoid?.tolls, ferries: !!plan.avoid?.ferries },
    stops: Array.isArray(plan.stops) ? plan.stops : [],
    status: plan.status === 'completed' ? 'completed' : 'planned',
    updatedAt: String(plan.updatedAt || plan.updated_at || now()),
    schemaVersion: Math.max(1, Number(plan.schemaVersion) || 1)
  });
  const sortPlans = rows => rows.map(normalise).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  function logicalSignature(raw = {}) {
    const p = normalise(raw);
    const stops = (p.stops || []).map(s => ({ name:String(s?.name || '').trim().toLowerCase(), type:String(s?.type || 'Stop').trim().toLowerCase() }));
    return JSON.stringify({ name:p.name.trim().toLowerCase(), start:p.start.trim().toLowerCase(), destination:p.destination.trim().toLowerCase(), tripType:p.tripType, routeStyle:p.routeStyle, days:p.days, date:p.date, notes:p.notes.trim(), avoid:p.avoid, stops, status:p.status });
  }
  function dedupeExact(rows = []) {
    const keep = new Map(); const duplicates = [];
    sortPlans(rows).forEach(p => { const sig = logicalSignature(p); if (!keep.has(sig)) keep.set(sig,p); else duplicates.push(p.id); });
    return { plans:sortPlans([...keep.values()]), duplicateIds:duplicates };
  }
  function writeLocal(rows, source='local') {
    const plans = sortPlans(rows);
    localStorage.setItem(KEY, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { source, plans } }));
    return plans;
  }
  function merge(localRows, cloudRows) { return dedupeExact([...(localRows || []), ...(cloudRows || [])]).plans; }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function getClient() {
    if (client) return client;
    // Prefer the product-wide authenticated client when it is ready.
    for (let i=0;i<12;i++) {
      if (window.ADVENTURE_BUILDER_AUTH?.client) return (client = window.ADVENTURE_BUILDER_AUTH.client);
      if (window.COASTAL_CLOUD) return (client = window.COASTAL_CLOUD);
      if (i < 3) await wait(100);
      else break;
    }
    const cfg = window.ADVENTURE_BUILDER_CONFIG || window.COASTAL_CONFIG;
    if (!window.supabase?.createClient || !cfg?.SUPABASE_URL || !cfg?.SUPABASE_PUBLISHABLE_KEY) return null;
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
    );
    return client;
  }
  async function currentUser(c) {
    const { data: sessionData, error: sessionError } = await c.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData?.session?.user) return sessionData.session.user;
    const { data: userData, error: userError } = await c.auth.getUser();
    if (userError) throw userError;
    return userData?.user || null;
  }
  function status(ok, message, code='') {
    window.dispatchEvent(new CustomEvent('adventurebuilder:shared-sync-status', { detail:{ ok, message, code } }));
  }
  async function syncPlans() {
    if (syncing) return syncing;
    syncing = (async () => {
      const local = dedupeExact(readLocal()).plans;
      const c = await getClient();
      if (!c) { status(false, 'Cloud connection is not ready. Your plans on this device are safe.', 'no-client'); return writeLocal(local, 'local-only'); }
      let user;
      try { user = await currentUser(c); } catch (e) { status(false, `Account check failed: ${e.message || 'please sign in again.'}`, 'auth-error'); return writeLocal(local, 'auth-error'); }
      if (!user) { status(false, 'Sign in to the same Adventure Builder account to sync website and app plans.', 'signed-out'); return writeLocal(local, 'signed-out'); }

      // Pull only this signed-in user's rows. RLS still protects the table as a second layer.
      const { data, error } = await c.from('adventure_plans')
        .select('user_id,plan_id,title,plan_data,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending:false });
      if (error) { status(false, `Plan sync failed: ${error.message}`, 'select-error'); return writeLocal(local, 'cloud-error'); }

      const cloud = (data || []).map(row => normalise({ ...row.plan_data, id:row.plan_id, name:row.title || row.plan_data?.name, updatedAt:row.updated_at }));
      const combined = merge(local, cloud);
      writeLocal(combined, 'cloud-merge');
      if (combined.length) {
        const payload = combined.map(p => ({ id:p.id, user_id:user.id, plan_id:p.id, title:p.name, plan_data:p, updated_at:p.updatedAt }));
        const { error: upsertError } = await c.from('adventure_plans').upsert(payload, { onConflict:'plan_id' });
        if (upsertError) { status(false, `Plans loaded, but cloud update failed: ${upsertError.message}`, 'upsert-error'); return combined; }
      }
      const keepBySignature = new Map(combined.map(p => [logicalSignature(p), p.id]));
      const duplicateCloudIds = cloud.filter(p => keepBySignature.get(logicalSignature(p)) !== p.id).map(p => p.id);
      if (duplicateCloudIds.length) {
        const { error: cleanupError } = await c.from('adventure_plans').delete().eq('user_id', user.id).in('plan_id', duplicateCloudIds);
        if (cleanupError) { status(false, `Plans synced, but duplicate cleanup failed: ${cleanupError.message}`, 'dedupe-error'); return combined; }
      }
      status(true, `${combined.length} shared adventure plan${combined.length===1?'':'s'} synced${duplicateCloudIds.length ? `; ${duplicateCloudIds.length} exact duplicate${duplicateCloudIds.length===1?'':'s'} cleaned` : ''}.`, 'ok');
      return combined;
    })().finally(() => { syncing = null; });
    return syncing;
  }
  async function savePlan(raw) {
    const draft = normalise({ ...raw, updatedAt: now() });
    const existing = dedupeExact(readLocal()).plans.find(x => logicalSignature(x) === logicalSignature(draft));
    const p = normalise({ ...draft, id: existing?.id || draft.id, updatedAt: now() });
    const rows = dedupeExact(readLocal().filter(x => String(x.id) !== p.id)).plans;
    writeLocal([...rows, p], 'save');
    const c = await getClient(); if (!c) return p;
    const { data: authData } = await c.auth.getUser(); const user = authData?.user; if (!user) return p;
    const { error } = await c.from('adventure_plans').upsert({ id:p.id, user_id:user.id, plan_id:p.id, title:p.name, plan_data:p, updated_at:p.updatedAt }, { onConflict:'plan_id' });
    if (error) throw error; return p;
  }
  async function deletePlan(id) {
    id = String(id);
    writeLocal(readLocal().filter(x => String(x.id) !== id), 'delete');
    const c = await getClient();
    if (!c) return;
    const { data: authData } = await c.auth.getUser();
    const user = authData?.user;
    if (user) await c.from('adventure_plans').delete().eq('user_id', user.id).eq('plan_id', id);
  }

  window.AdventureBuilderSharedAdventures = {
    version: '1.5.0', key: KEY, event: EVENT,
    getPlans: () => dedupeExact(readLocal()).plans, normalise, logicalSignature, dedupeExact, writeLocal, syncPlans, savePlan, deletePlan
  };

  window.addEventListener('adventurebuilder:auth', e => {
    if (e.detail?.client) client = e.detail.client;
    if (e.detail?.user) syncPlans().catch(() => writeLocal(readLocal(), 'auth-sync-failed'));
  });
  window.addEventListener('storage', e => { if (e.key === KEY) window.dispatchEvent(new CustomEvent(EVENT, { detail:{ source:'storage', plans:sortPlans(readLocal()) } })); });
  const start = () => syncPlans().catch(() => writeLocal(readLocal(), 'sync-failed'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();

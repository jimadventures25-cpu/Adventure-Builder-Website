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
  function writeLocal(rows, source='local') {
    const plans = sortPlans(rows);
    localStorage.setItem(KEY, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { source, plans } }));
    return plans;
  }
  function merge(localRows, cloudRows) {
    const map = new Map();
    [...localRows, ...cloudRows].forEach(raw => {
      const p = normalise(raw);
      const old = map.get(p.id);
      if (!old || String(p.updatedAt) >= String(old.updatedAt)) map.set(p.id, p);
    });
    return sortPlans([...map.values()]);
  }
  async function getClient() {
    if (client) return client;
    if (window.COASTAL_CLOUD) return (client = window.COASTAL_CLOUD);
    if (!window.supabase?.createClient || !window.COASTAL_CONFIG?.SUPABASE_URL) return null;
    client = window.supabase.createClient(
      window.COASTAL_CONFIG.SUPABASE_URL,
      window.COASTAL_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
    return client;
  }
  async function syncPlans() {
    if (syncing) return syncing;
    syncing = (async () => {
      const local = sortPlans(readLocal());
      const c = await getClient();
      if (!c) return writeLocal(local, 'local-only');
      const { data: authData } = await c.auth.getUser();
      const user = authData?.user;
      if (!user) return writeLocal(local, 'signed-out');
      const { data, error } = await c.from('adventure_plans').select('plan_id,title,plan_data,updated_at').order('updated_at', { ascending: false });
      if (error) {
        window.dispatchEvent(new CustomEvent('adventurebuilder:shared-sync-status', { detail: { ok:false, message:error.message } }));
        return writeLocal(local, 'cloud-error');
      }
      const cloud = (data || []).map(row => normalise({ ...row.plan_data, id: row.plan_id, name: row.title || row.plan_data?.name, updatedAt: row.updated_at }));
      const combined = merge(local, cloud);
      writeLocal(combined, 'cloud-merge');
      if (combined.length) {
        const payload = combined.map(p => ({ user_id:user.id, plan_id:p.id, title:p.name, plan_data:p, updated_at:p.updatedAt }));
        const { error: upsertError } = await c.from('adventure_plans').upsert(payload, { onConflict:'user_id,plan_id' });
        if (upsertError) window.dispatchEvent(new CustomEvent('adventurebuilder:shared-sync-status', { detail:{ ok:false, message:upsertError.message } }));
      }
      window.dispatchEvent(new CustomEvent('adventurebuilder:shared-sync-status', { detail:{ ok:true, message:`${combined.length} adventure plan${combined.length===1?'':'s'} available on this device.` } }));
      return combined;
    })().finally(() => { syncing = null; });
    return syncing;
  }
  async function savePlan(raw) {
    const p = normalise({ ...raw, updatedAt: now() });
    const rows = readLocal().filter(x => String(x.id) !== p.id);
    writeLocal([...rows, p], 'save');
    const c = await getClient();
    if (!c) return p;
    const { data: authData } = await c.auth.getUser();
    const user = authData?.user;
    if (!user) return p;
    const { error } = await c.from('adventure_plans').upsert({ user_id:user.id, plan_id:p.id, title:p.name, plan_data:p, updated_at:p.updatedAt }, { onConflict:'user_id,plan_id' });
    if (error) throw error;
    return p;
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
    version: '1.0.0', key: KEY, event: EVENT,
    getPlans: () => sortPlans(readLocal()), normalise, writeLocal, syncPlans, savePlan, deletePlan
  };

  window.addEventListener('storage', e => { if (e.key === KEY) window.dispatchEvent(new CustomEvent(EVENT, { detail:{ source:'storage', plans:sortPlans(readLocal()) } })); });
  const start = () => syncPlans().catch(() => writeLocal(readLocal(), 'sync-failed'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();

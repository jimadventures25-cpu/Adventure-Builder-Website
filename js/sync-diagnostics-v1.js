(()=>{
'use strict';
const KEY='adventure-builder-plans-v1';
const $=s=>document.querySelector(s);
const out=$('#diag-output');
const status=$('#diag-status');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localPlans(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function redactId(id){if(!id)return '(none)';const s=String(id);return s.length>12?s.slice(0,8)+'…'+s.slice(-4):s;}
function reportLine(label,value,kind=''){return `<div class="row ${kind}"><b>${esc(label)}</b><span>${esc(value)}</span></div>`}
async function client(){
  if(window.ADVENTURE_BUILDER_AUTH?.client) return window.ADVENTURE_BUILDER_AUTH.client;
  if(window.ADVENTURE_BUILDER_AUTH_SERVICE?.client) return window.ADVENTURE_BUILDER_AUTH_SERVICE.client;
  const cfg=window.ADVENTURE_BUILDER_CONFIG||window.COASTAL_CONFIG||{};
  if(!window.supabase?.createClient) throw new Error('Supabase library did not load.');
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY) throw new Error('Adventure Builder Supabase config is missing URL or publishable key.');
  return window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
}
async function run(){
  status.textContent='Running read-only checks…'; out.innerHTML='';
  const locals=localPlans();
  const lakeLocal=locals.filter(p=>String(p?.name||p?.title||'').toLowerCase().includes('lake district'));
  let html='';
  html+=reportLine('Page / origin',location.origin+location.pathname);
  html+=reportLine('Local trip key',KEY);
  html+=reportLine('Local saved plans',String(locals.length),locals.length?'ok':'warn');
  html+=reportLine('Local Lake District matches',String(lakeLocal.length),lakeLocal.length?'ok':'warn');
  if(lakeLocal[0]) html+=reportLine('Local Lake District plan ID',String(lakeLocal[0].id||'(missing)'));
  try{
    const c=await client();
    const {data:sessionData,error:sessionError}=await c.auth.getSession();
    if(sessionError) throw sessionError;
    const session=sessionData?.session||null;
    html+=reportLine('Saved auth session',session?'YES':'NO',session?'ok':'bad');
    let user=session?.user||null;
    if(!user){
      const r=await c.auth.getUser();
      if(r.error && !String(r.error.message||'').toLowerCase().includes('session')) throw r.error;
      user=r.data?.user||null;
    }
    html+=reportLine('Signed-in user',user?'YES':'NO',user?'ok':'bad');
    html+=reportLine('User ID',redactId(user?.id));
    html+=reportLine('User email',user?.email||'(not signed in)');
    if(!user){
      html+=reportLine('Cloud test','STOPPED — sign in first','bad');
    }else{
      const q=await c.from('adventure_plans').select('user_id,plan_id,title,plan_data,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false});
      if(q.error){
        html+=reportLine('Cloud query','FAILED','bad');
        html+=reportLine('Supabase error code',q.error.code||'(none)');
        html+=reportLine('Supabase error',q.error.message||String(q.error));
        if(q.error.details) html+=reportLine('Error details',q.error.details);
        if(q.error.hint) html+=reportLine('Error hint',q.error.hint);
      }else{
        const rows=Array.isArray(q.data)?q.data:[];
        const lake=rows.filter(r=>String(r.title||r.plan_data?.name||'').toLowerCase().includes('lake district'));
        html+=reportLine('Cloud adventure_plans rows',String(rows.length),rows.length?'ok':'warn');
        html+=reportLine('Cloud Lake District matches',String(lake.length),lake.length?'ok':'bad');
        if(lake[0]){
          html+=reportLine('Cloud Lake District plan ID',lake[0].plan_id||'(missing)','ok');
          html+=reportLine('Cloud title',lake[0].title||lake[0].plan_data?.name||'(missing)','ok');
          html+=reportLine('Cloud route',`${lake[0].plan_data?.start||'?'} → ${lake[0].plan_data?.destination||'?'}`,'ok');
          html+=reportLine('Cloud updated',lake[0].updated_at||'(missing)');
        }
      }
    }
  }catch(err){
    html+=reportLine('Diagnostic exception',err?.message||String(err),'bad');
  }
  out.innerHTML=html;
  status.textContent='Finished. This diagnostic does not change or upload any trip data.';
}
function plain(){return [...out.querySelectorAll('.row')].map(r=>`${r.querySelector('b')?.textContent}: ${r.querySelector('span')?.textContent}`).join('\n')}
$('#run-diag')?.addEventListener('click',run);
$('#copy-diag')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(plain());status.textContent='Report copied.'}catch{status.textContent='Copy failed — send a screenshot instead.'}});
run();
})();

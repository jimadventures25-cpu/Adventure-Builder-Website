
(()=>{'use strict';
const root=document.querySelector('[data-ab-accident-core]');if(!root)return;
const KEY='adventure-builder-accident-records-v1';
const $=s=>root.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let editingId=null,client=null;
const uid=()=>crypto.randomUUID?crypto.randomUUID():'acc-'+Date.now()+'-'+Math.random().toString(16).slice(2);
function records(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function write(rows){localStorage.setItem(KEY,JSON.stringify(rows))}
function field(name){return root.querySelector(`[data-acc-field="${name}"]`)}
function value(name){const el=field(name);return el?.type==='checkbox'?!!el.checked:(el?.value||'').trim()}
function setv(name,v){const el=field(name);if(!el)return;if(el.type==='checkbox')el.checked=!!v;else el.value=v??''}
function refFor(id){const d=new Date(),stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;return `AB-${stamp}-${String(id).replace(/[^a-z0-9]/gi,'').slice(-6).toUpperCase()}`}
function payload(){const id=editingId||uid();return{
 id,reference:field('reference')?.value||refFor(id),status:'draft',
 accidentDate:value('accidentDate'),accidentTime:value('accidentTime'),location:value('location'),
 latitude:value('latitude'),longitude:value('longitude'),weatherRoad:value('weatherRoad'),
 policeAttended:value('policeAttended'),policeReference:value('policeReference'),
 yourDriver:value('yourDriver'),yourVehicle:value('yourVehicle'),yourRegistration:value('yourRegistration'),
 yourInsurer:value('yourInsurer'),yourPolicy:value('yourPolicy'),
 otherDriver:value('otherDriver'),otherVehicle:value('otherVehicle'),otherRegistration:value('otherRegistration'),
 otherInsurer:value('otherInsurer'),otherPolicy:value('otherPolicy'),
 witnessName:value('witnessName'),witnessContact:value('witnessContact'),witnessStatement:value('witnessStatement'),
 account:value('account'),yourDamage:value('yourDamage'),otherDamage:value('otherDamage'),
 driveable:value('driveable'),additionalNotes:value('additionalNotes'),
 updatedAt:new Date().toISOString(),schemaVersion:1
}}
function fill(r){editingId=r.id;Object.entries(r).forEach(([k,v])=>setv(k,v));setv('reference',r.reference||refFor(r.id));renderPreview(r);status('Record opened. Changes will update this draft.');root.scrollIntoView({behavior:'smooth',block:'start'})}
function reset(){editingId=null;root.querySelector('form')?.reset();const now=new Date();setv('accidentDate',now.toISOString().slice(0,10));setv('accidentTime',now.toTimeString().slice(0,5));const id=uid();editingId=id;setv('reference',refFor(id));renderPreview(payload());status('New private accident record ready.')}
function status(msg){const e=$('[data-acc-status]');if(e)e.textContent=msg}
async function cloud(){if(client)return client;if(window.ADVENTURE_BUILDER_AUTH?.client)return client=window.ADVENTURE_BUILDER_AUTH.client;if(window.COASTAL_CLOUD)return client=window.COASTAL_CLOUD;if(window.supabase?.createClient){const cfg=window.ADVENTURE_BUILDER_CONFIG||window.COASTAL_CONFIG;if(cfg?.SUPABASE_URL&&cfg?.SUPABASE_PUBLISHABLE_KEY)return client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true}})}return null}
async function saveCloud(r){const c=await cloud();if(!c)return false;const {data:{user}}=await c.auth.getUser();if(!user)return false;const {error}=await c.from('accident_records').upsert({user_id:user.id,record_id:r.id,record_ref:r.reference,record_data:r,updated_at:r.updatedAt},{onConflict:'user_id,record_id'});if(error)throw error;return true}
async function deleteCloud(id){const c=await cloud();if(!c)return;const {data:{user}}=await c.auth.getUser();if(user)await c.from('accident_records').delete().eq('user_id',user.id).eq('record_id',id)}
async function syncCloud(){const c=await cloud();if(!c)return renderList();const {data:{user}}=await c.auth.getUser();if(!user)return renderList();const {data,error}=await c.from('accident_records').select('record_id,record_ref,record_data,updated_at').order('updated_at',{ascending:false});if(error)return renderList();const m=new Map(records().map(r=>[r.id,r]));(data||[]).forEach(row=>{const r={...row.record_data,id:row.record_id,reference:row.record_ref||row.record_data?.reference,updatedAt:row.updated_at};const old=m.get(r.id);if(!old||String(r.updatedAt)>String(old.updatedAt))m.set(r.id,r)});write([...m.values()]);renderList()}
async function save(){const r=payload();if(!r.accidentDate||!r.accidentTime||!r.location){status('Add the accident date, time and location first.');return}const rows=records().filter(x=>x.id!==r.id);rows.unshift(r);write(rows);editingId=r.id;renderList();renderPreview(r);status('Saving private draft…');try{const synced=await saveCloud(r);status(synced?'Private accident record saved and synced.':'Saved on this device. Sign in / reconnect to sync it.')}catch(e){status('Saved on this device. Cloud sync is waiting for the Accident Assistance database setup.')}}
function renderList(){const box=$('[data-acc-list]'),rows=records().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));if(!box)return;box.innerHTML=rows.length?rows.map(r=>`<article class="abacc-saved"><strong>${esc(r.reference||'Accident record')}</strong><small>${esc(r.accidentDate||'No date')} · ${esc(r.location||'Location not added')}</small><div class="abacc-saved-actions"><button type="button" data-acc-open="${esc(r.id)}">Open</button><button type="button" data-acc-print="${esc(r.id)}">Print draft</button><button type="button" data-acc-delete="${esc(r.id)}">Delete</button></div></article>`).join(''):'<p>No accident records saved yet.</p>'}
function cell(label,val){return `<tr><th>${esc(label)}</th><td>${esc(val||'Not recorded')}</td></tr>`}
function renderPreview(r=payload()){const p=$('[data-acc-preview]');if(!p)return;const logo=root.dataset.logo||'';p.innerHTML=`<div class="abacc-doc-header"><div class="abacc-doc-brand">${logo?`<img src="${esc(logo)}" alt="Adventure Builder logo">`:''}<div><strong>ADVENTURE BUILDER</strong><small>VEHICLE ACCIDENT RECORD</small></div></div><small>${esc(r.reference||'Draft record')}</small></div>
<h4>Accident Summary</h4><table class="abacc-doc-table">${cell('Date and time',`${r.accidentDate||''} ${r.accidentTime||''}`.trim())}${cell('Location',r.location)}${cell('GPS coordinates',r.latitude&&r.longitude?`${r.latitude}, ${r.longitude}`:'')}${cell('Weather / road',r.weatherRoad)}${cell('Police attended',r.policeAttended)}${cell('Police reference',r.policeReference)}</table>
<h4>Your Driver and Vehicle</h4><table class="abacc-doc-table">${cell('Driver',r.yourDriver)}${cell('Vehicle',r.yourVehicle)}${cell('Registration',r.yourRegistration)}${cell('Insurer',r.yourInsurer)}${cell('Policy reference',r.yourPolicy)}</table>
<h4>Other Driver and Vehicle</h4><table class="abacc-doc-table">${cell('Driver',r.otherDriver)}${cell('Vehicle',r.otherVehicle)}${cell('Registration',r.otherRegistration)}${cell('Insurer',r.otherInsurer)}${cell('Policy reference',r.otherPolicy)}</table>
<h4>Your Account of What Happened</h4><p>${esc(r.account||'Not recorded')}</p>
<h4>Witness</h4><table class="abacc-doc-table">${cell('Name',r.witnessName)}${cell('Contact details',r.witnessContact)}${cell('Statement',r.witnessStatement)}</table>
<h4>Damage Record</h4><table class="abacc-doc-table">${cell('Your vehicle',r.yourDamage)}${cell('Other vehicle',r.otherDamage)}${cell('Vehicle driveable',r.driveable)}</table>
<h4>Additional Notes</h4><p>${esc(r.additionalNotes||'None')}</p>
<p class="abacc-doc-note"><b>Important:</b> This document organises information supplied by the user. Adventure Builder does not determine fault, liability, legal responsibility or insurance coverage. Check all details before sharing.</p>`}
function locate(){if(!navigator.geolocation){status('Location is not available on this device.');return}status('Getting accident location…');navigator.geolocation.getCurrentPosition(pos=>{setv('latitude',pos.coords.latitude.toFixed(6));setv('longitude',pos.coords.longitude.toFixed(6));if(!value('location'))setv('location',`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);renderPreview();status('GPS coordinates added. You can type the road/place name as well.')},()=>status('Location permission was not available.'),{enableHighAccuracy:true,timeout:10000,maximumAge:0})}
root.addEventListener('input',()=>renderPreview());root.addEventListener('change',()=>renderPreview());
$('[data-acc-save]')?.addEventListener('click',save);$('[data-acc-new]')?.addEventListener('click',reset);$('[data-acc-locate]')?.addEventListener('click',locate);$('[data-acc-print-current]')?.addEventListener('click',()=>window.print());$('[data-acc-refresh]')?.addEventListener('click',()=>syncCloud());
$('[data-acc-list]')?.addEventListener('click',e=>{const o=e.target.closest('[data-acc-open]'),d=e.target.closest('[data-acc-delete]'),p=e.target.closest('[data-acc-print]');if(o){const r=records().find(x=>x.id===o.dataset.accOpen);if(r)fill(r)}if(p){const r=records().find(x=>x.id===p.dataset.accPrint);if(r){renderPreview(r);setTimeout(()=>window.print(),50)}}if(d&&confirm('Delete this private accident record?')){const id=d.dataset.accDelete;write(records().filter(x=>x.id!==id));deleteCloud(id).catch(()=>{});renderList();if(editingId===id)reset();status('Accident record deleted.')}})
renderList();reset();syncCloud().catch(()=>{});
})();

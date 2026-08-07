
(() => {
'use strict';
const ROOT_KEY='ab-adventure-hub-v1', PADDLE_KEY='ab-paddle-plans-v1';
const roots=[...document.querySelectorAll('[data-ab-adventure-hub]')]; if(!roots.length) return;
const safeRead=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
const safeWrite=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true}catch{return false}};
let data=safeRead(ROOT_KEY,{adventures:[],score:0});
const points={hike:12,cycle:10,road:8,camp:10,paddle:14,kayak:14,photo:6,explore:8,dog:6,fishing:8};

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmt(n,d=1){return Number(n||0).toFixed(d).replace(/\.0$/,'');}
function save(){data.score=Math.min(9999,data.adventures.reduce((sum,a)=>sum+(points[a.type]||5)+(a.newPlace?5:0)+(a.photos?2:0),0));safeWrite(ROOT_KEY,data);renderAll();}
function stats(){
 return data.adventures.reduce((s,a)=>{s.count++;s.distance+=Number(a.distance)||0;s.photos+=Number(a.photos)||0;if(a.type==='camp')s.camps++;if(a.type==='paddle'||a.type==='kayak')s.water++;return s},{count:0,distance:0,photos:0,camps:0,water:0});
}
function icon(t){return ({hike:'🥾',cycle:'🚴',road:'🚐',camp:'🏕️',paddle:'🏄',kayak:'🛶',photo:'📸',explore:'🧭',dog:'🐕',fishing:'🎣'})[t]||'🌍';}
function label(t){return ({hike:'Hike',cycle:'Cycle',road:'Road Trip',camp:'Camping',paddle:'Paddleboard',kayak:'Kayak',photo:'Photography',explore:'Explore',dog:'Dog Walk',fishing:'Fishing'})[t]||'Adventure';}
function renderAll(){roots.forEach(render);}
function render(root){
 const s=stats();
 root.querySelectorAll('[data-ab-stat="adventures"]').forEach(x=>x.textContent=s.count);
 root.querySelectorAll('[data-ab-stat="distance"]').forEach(x=>x.textContent=`${fmt(s.distance)} km`);
 root.querySelectorAll('[data-ab-stat="photos"]').forEach(x=>x.textContent=s.photos);
 root.querySelectorAll('[data-ab-stat="water"]').forEach(x=>x.textContent=s.water);
 root.querySelectorAll('[data-ab-score]').forEach(x=>x.textContent=data.score);
 root.querySelectorAll('[data-ab-score-ring]').forEach(x=>x.style.setProperty('--score',Math.min(100,data.score%101)));
 const feed=root.querySelector('[data-ab-feed]');
 if(feed){
  if(!data.adventures.length) feed.innerHTML='<div class="abx-empty">Your completed adventures will appear here. Add one below to start building your Adventure Story.</div>';
  else feed.innerHTML=[...data.adventures].reverse().slice(0,8).map(a=>`<article class="abx-feed-card"><div class="abx-feed-cover">${icon(a.type)}</div><div class="abx-feed-body"><h4>${esc(a.title||label(a.type))}</h4><small>${esc(a.date||'')} · ${label(a.type)}</small><div class="abx-feed-meta"><span class="abx-chip">📍 ${fmt(a.distance)} km</span>${a.photos?`<span class="abx-chip">📸 ${a.photos} photos</span>`:''}${a.newPlace?'<span class="abx-chip">✨ New place</span>':''}</div><div class="abx-feed-actions"><button class="abx-btn" type="button" data-ab-story-open="${a.id}">Relive</button><button class="abx-btn" type="button" data-ab-remove="${a.id}">Remove</button></div></div></article>`).join('');
 }
 const story=root.querySelector('[data-ab-story]');
 if(story){
  const a=data.adventures[data.adventures.length-1];
  story.innerHTML=a?`<div class="abx-story-item"><b>🚀 Adventure started</b><small>${esc(a.date)} · ${label(a.type)}</small></div><div class="abx-story-item"><b>📍 ${esc(a.title)}</b><small>${fmt(a.distance)} km explored</small></div>${a.photos?`<div class="abx-story-item"><b>📸 Memories captured</b><small>${a.photos} photos added</small></div>`:''}<div class="abx-story-item"><b>🏅 Adventure complete</b><small>Explorer points added to your passport</small></div>`:'<div class="abx-empty">Complete an adventure to build your first Adventure Story.</div>';
 }
 const passport=root.querySelector('[data-ab-passport]');
 if(passport){
  const cats={hike:0,road:0,camp:0,paddle:0,kayak:0,explore:0,photo:0};
  data.adventures.forEach(a=>{if(a.type in cats)cats[a.type]++});
  passport.innerHTML=Object.entries(cats).map(([k,v])=>`<div class="abx-collection"><span>${icon(k)}</span><strong>${label(k)}</strong><small>${v} ${v===1?'adventure':'adventures'}</small></div>`).join('');
 }
 const progress=root.querySelector('[data-ab-level-progress]'); if(progress) progress.style.width=`${Math.min(100,(data.score%100))}%`;
}
function bind(root){
 root.querySelectorAll('[data-ab-tab]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.abTab;root.querySelectorAll('[data-ab-tab]').forEach(x=>x.classList.toggle('is-active',x===b));root.querySelectorAll('[data-ab-view]').forEach(v=>v.hidden=v.dataset.abView!==name);}));
 const form=root.querySelector('[data-ab-add-form]');
 form?.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);const type=fd.get('type');data.adventures.push({id:Date.now().toString(36),type,title:String(fd.get('title')||label(type)).trim(),date:String(fd.get('date')||new Date().toISOString().slice(0,10)),distance:Number(fd.get('distance')||0),photos:Number(fd.get('photos')||0),newPlace:fd.get('newPlace')==='on'});form.reset();save();root.querySelector('[data-ab-form-status]').textContent='Adventure added to your Adventure Hub.';});
 root.addEventListener('click',e=>{const rem=e.target.dataset.abRemove, relive=e.target.dataset.abStoryOpen;if(rem){data.adventures=data.adventures.filter(a=>a.id!==rem);save();}if(relive){const a=data.adventures.find(x=>x.id===relive);const story=root.querySelector('[data-ab-story]');if(a&&story){story.innerHTML=`<div class="abx-story-item"><b>🚀 Adventure started</b><small>${esc(a.date)} · ${label(a.type)}</small></div><div class="abx-story-item"><b>📍 ${esc(a.title)}</b><small>${fmt(a.distance)} km explored</small></div>${a.photos?`<div class="abx-story-item"><b>📸 ${a.photos} memories</b><small>Ready for Photo Studio / Adventure Movie</small></div>`:''}<div class="abx-story-item"><b>🏅 Adventure complete</b><small>Explorer points earned</small></div>`;root.querySelector('[data-ab-tab="story"]')?.click();}}});
 const wind=root.querySelector('[data-paddle-wind]'), gust=root.querySelector('[data-paddle-gust]'), offshore=root.querySelector('[data-paddle-offshore]'), status=root.querySelector('[data-paddle-status]');
 const assess=()=>{if(!status||!wind)return;const w=Number(wind.value)||0,g=Number(gust?.value)||w,off=offshore?.checked;status.classList.remove('good','caution','avoid');let cls='good',title='Lower-risk conditions entered',copy='Keep checking local conditions and your own ability before launching.';if(w>=12||g>=18||off){cls='caution';title='Use extra caution';copy='Wind, gusts or an offshore direction can make returning difficult. Reconsider the route, stay close to shore and use local guidance.';}if(w>=20||g>=25){cls='avoid';title='High wind entered';copy='These inputs suggest demanding conditions for many recreational paddlers. Consider postponing and check an authoritative local forecast.';}status.classList.add(cls);status.querySelector('strong').textContent=title;status.querySelector('p').textContent=copy;};
 [wind,gust,offshore].forEach(x=>x?.addEventListener('input',assess)); assess();
 const fp=root.querySelector('[data-float-form]'), preview=root.querySelector('[data-float-preview]');
 fp?.addEventListener('input',()=>{const fd=new FormData(fp);const text=`PADDLE FLOAT PLAN\nName: ${fd.get('name')||'—'}\nWater / route: ${fd.get('route')||'—'}\nLaunch: ${fd.get('launch')||'—'}\nExpected back: ${fd.get('back')||'—'}\nCraft: ${fd.get('craft')||'—'}\nEmergency contact: ${fd.get('contact')||'—'}\nNotes: ${fd.get('notes')||'—'}`;if(preview)preview.textContent=text;});
 root.querySelector('[data-save-float]')?.addEventListener('click',()=>{if(!fp)return;const fd=Object.fromEntries(new FormData(fp));const plans=safeRead(PADDLE_KEY,[]);plans.push({...fd,saved:new Date().toISOString()});safeWrite(PADDLE_KEY,plans);root.querySelector('[data-float-status]').textContent='Float plan saved on this device.';});
}
roots.forEach(bind);renderAll();
})();

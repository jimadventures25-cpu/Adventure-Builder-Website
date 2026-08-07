
(() => {
'use strict';
const roots=[...document.querySelectorAll('[data-ab-vanlife]')]; if(!roots.length)return;
const KEY='ab-vanlife-profile-v1', TRIPS='ab-vanlife-trips-v1';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const demoStops=[
 {name:'Lakeside Van Base',type:'Permitted Overnight Stop · DEMO',score:96,tags:['🐕 Dog friendly','🌅 Sunset','🚻 Toilets nearby','🥾 Walks','🛶 Paddle']},
 {name:'Quiet Moorland Aire',type:'Aire · DEMO',score:89,tags:['🤫 Quiet','🚰 Water','🌄 Views','🚐 Large-van friendly']},
 {name:'Forest Edge Camper Stop',type:'Campervan Site · DEMO',score:84,tags:['🌲 Forest','🐕 Dog friendly','☕ Café','🚿 Shower']},
];
function bind(root){
  root.querySelectorAll('[data-av-tab]').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('[data-av-tab]').forEach(x=>x.classList.toggle('is-active',x===b));root.querySelectorAll('[data-av-view]').forEach(v=>v.hidden=v.dataset.avView!==b.dataset.avTab)}));
  const profileForm=root.querySelector('[data-av-profile]');
  const profile=read(KEY,{});
  if(profileForm){Object.entries(profile).forEach(([k,v])=>{const el=profileForm.elements[k];if(el)el.value=v});profileForm.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(profileForm).entries());write(KEY,d);root.querySelector('[data-av-profile-status]').textContent='Van profile saved on this device.';renderStats(root,d)})}
  root.querySelectorAll('[data-av-choice]').forEach(b=>b.addEventListener('click',()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'))));
  root.querySelector('[data-av-tonight-search]')?.addEventListener('click',()=>{const selected=[...root.querySelectorAll('[data-av-choice][aria-pressed="true"]')].map(b=>b.textContent.trim());const res=root.querySelector('[data-av-tonight-results]');res.innerHTML=demoStops.map(s=>`<article class="av-result"><div class="av-result-top"><div><small>${s.type}</small><h4>${s.name}</h4></div><div class="av-score">${s.score}%</div></div><div class="av-tags">${s.tags.map(t=>`<span class="av-tag">${t}</span>`).join('')}</div><small>${selected.length?'Filtered for: '+selected.join(', '):'General demo match'}</small></article>`).join('');root.querySelector('[data-av-tonight-status]').textContent='Prototype results shown. Live stage will use verified real stops and routing.'});
  root.querySelector('[data-av-trip-form]')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f).entries()),arr=read(TRIPS,[]);arr.push({...d,id:Date.now().toString(36)});write(TRIPS,arr);f.reset();root.querySelector('[data-av-trip-status]').textContent='Vanlife trip saved on this device.';renderTrips(root)});
  renderStats(root,profile);renderTrips(root);
}
function renderStats(root,p){root.querySelectorAll('[data-av-stat="height"]').forEach(x=>x.textContent=p.height?`${p.height} m`:'—');root.querySelectorAll('[data-av-stat="water"]').forEach(x=>x.textContent=p.water?`${p.water} L`:'—');root.querySelectorAll('[data-av-stat="battery"]').forEach(x=>x.textContent=p.battery?`${p.battery} Ah`:'—');root.querySelectorAll('[data-av-stat="people"]').forEach(x=>x.textContent=p.people||'—')}
function renderTrips(root){const arr=read(TRIPS,[]),box=root.querySelector('[data-av-trips]');if(!box)return;box.innerHTML=arr.length?arr.slice().reverse().map(t=>`<div class="av-result"><h4>${t.name||'Vanlife Trip'}</h4><small>${t.area||'Adventure'} · ${t.nights||0} nights</small></div>`).join(''):'<div class="av-note">Your saved vanlife trips will appear here.</div>'}
roots.forEach(bind);
})();

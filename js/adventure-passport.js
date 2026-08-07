
(() => {
'use strict';
const roots=[...document.querySelectorAll('[data-ab-passport]')]; if(!roots.length)return;

const PROFILE='ab-passport-profile-v1';
const STAMPS='ab-passport-stamps-v1';
const CHALLENGES='ab-passport-challenges-v1';
const COLLECTIONS='ab-passport-collections-v1';

const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const passportNo=()=>{let p=read(PROFILE,{});if(!p.number){p.number='AB-'+Math.random().toString(36).slice(2,8).toUpperCase()+'-'+Date.now().toString(36).slice(-4).toUpperCase();write(PROFILE,p)}return p.number};

const defaultChallenges=[
 {id:'c1',name:'10 Waterfalls',goal:10,progress:0,icon:'💦'},
 {id:'c2',name:'5 Coastal Walks',goal:5,progress:0,icon:'🌊'},
 {id:'c3',name:'25 Sunrises',goal:25,progress:0,icon:'🌄'},
 {id:'c4',name:'20 Castles',goal:20,progress:0,icon:'🏰'}
];

function bindTabs(root){
 root.querySelectorAll('[data-ap-tab]').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('[data-ap-tab]').forEach(x=>x.classList.toggle('is-active',x===b));root.querySelectorAll('[data-ap-view]').forEach(v=>v.hidden=v.dataset.apView!==b.dataset.apTab)}));
}
function profile(root){
 const p=read(PROFILE,{});
 root.querySelector('[data-ap-passport-no]').textContent=passportNo();
 root.querySelector('[data-ap-name]').textContent=p.name||'Adventure Explorer';
 root.querySelector('[data-ap-member-since]').textContent=p.memberSince||new Date().getFullYear();
 const stamps=read(STAMPS,[]);
 const adventures=new Set(stamps.map(x=>x.adventureId||x.id)).size;
 root.querySelector('[data-ap-stamps-count]').textContent=stamps.length;
 root.querySelector('[data-ap-adventures-count]').textContent=adventures;
 root.querySelector('[data-ap-regions-count]').textContent=new Set(stamps.map(x=>x.region).filter(Boolean)).size;
 const level=Math.max(1,Math.floor(stamps.length/5)+1);
 root.querySelector('[data-ap-level]').textContent=`Level ${level}`;
 root.querySelector('[data-ap-progress-bar]').style.width=`${Math.min(100,(stamps.length%5)*20)}%`;
}
function renderStamps(root){
 const box=root.querySelector('[data-ap-stamps]');if(!box)return;
 const arr=read(STAMPS,[]);
 const slots=[...arr.slice(-6)];
 while(slots.length<6)slots.push(null);
 box.innerHTML=slots.map(x=>x?`<div class="ap-stamp"><div>${esc(x.icon||'🛂')}<br><strong>${esc(x.name)}</strong><small>${esc(x.region||'Adventure')}<br>${esc(x.date||'')}</small></div></div>`:'<div class="ap-empty">Blank passport space</div>').join('');
}
function renderLogbook(root){
 const box=root.querySelector('[data-ap-logbook-list]');if(!box)return;
 const arr=read(STAMPS,[]);
 box.innerHTML=arr.length?arr.slice().reverse().map(x=>`<article class="ap-log"><small>${esc(x.date||'')}</small><h4>${esc(x.name)}</h4><div class="ap-chip">${esc(x.type||'Adventure')}</div> <div class="ap-chip">${esc(x.region||'')}</div><p>${esc(x.notes||'')}</p></article>`).join(''):'<div class="ap-safety">Your completed adventures will build a lifetime logbook here.</div>';
}
function renderCollections(root){
 const defs=[
  ['Lake District','🏞️',['Waterfall','Viewpoint','Trail','Campsite']],
  ['Vanlife','🚐',['Vanlife Stop','Campsite','Scenic Drive']],
  ['Water Adventures','🛶',['Paddle','Kayak','Beach','Lake']],
  ['Historic Explorer','🏰',['Castle','Historic Site']],
  ['National Parks','⛰️',['National Park']],
  ['Sunrise & Sunset','🌅',['Sunrise','Sunset']]
 ];
 const stamps=read(STAMPS,[]);
 root.querySelector('[data-ap-collections]').innerHTML=defs.map(([name,icon,types])=>{
   const progress=stamps.filter(s=>types.some(t=>String(s.type).toLowerCase().includes(String(t).toLowerCase()))).length;
   return `<article class="ap-collection"><span>${icon}</span><strong>${name}</strong><small>${progress} collected item${progress===1?'':'s'}</small></article>`;
 }).join('');
}
function renderChallenges(root){
 let arr=read(CHALLENGES,null);if(!arr){arr=defaultChallenges;write(CHALLENGES,arr)}
 root.querySelector('[data-ap-challenges]').innerHTML=arr.map(c=>`<article class="ap-challenge"><div class="ap-challenge-top"><div><span>${c.icon}</span> <strong>${esc(c.name)}</strong></div><span>${c.progress}/${c.goal}</span></div><div class="ap-progress" style="margin-top:8px"><span style="width:${Math.min(100,c.progress/c.goal*100)}%"></span></div><button class="ap-btn" data-ap-join="${c.id}" type="button" style="margin-top:8px">Join / Track</button></article>`).join('');
}
function bindForms(root){
 const pf=root.querySelector('[data-ap-profile-form]');
 const p=read(PROFILE,{});
 if(pf){['name','homeRegion'].forEach(k=>{if(p[k]&&pf.elements[k])pf.elements[k].value=p[k]});pf.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(pf).entries());write(PROFILE,{...read(PROFILE,{}),...d,memberSince:read(PROFILE,{}).memberSince||new Date().getFullYear()});root.querySelector('[data-ap-profile-status]').textContent='Passport profile saved on this device.';profile(root)})}
 const sf=root.querySelector('[data-ap-stamp-form]');
 sf?.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(sf).entries()),arr=read(STAMPS,[]);arr.push({id:'stamp-'+Date.now().toString(36),...d,date:d.date||new Date().toISOString().slice(0,10),icon:d.icon||'🛂',verified:d.verified==='yes',createdAt:new Date().toISOString()});write(STAMPS,arr);sf.reset();root.querySelector('[data-ap-stamp-status]').textContent='Passport stamp saved locally.';renderAll(root)});
}
function bindQR(root){
 root.querySelector('[data-ap-qr-demo]')?.addEventListener('click',()=>{
   const code=root.querySelector('[data-ap-qr-code]').value.trim();
   const status=root.querySelector('[data-ap-qr-status]');
   if(!code){status.textContent='Paste an Adventure Builder QR payload first.';return}
   if(!code.startsWith('ABP1:ABP-')){status.textContent='Not recognised as an Adventure Builder Passport QR format.';return}
   status.textContent='QR format recognised. Server activation + GPS verification will be required before a real public stamp is awarded.';
 });
}
function renderAll(root){profile(root);renderStamps(root);renderLogbook(root);renderCollections(root);renderChallenges(root)}
roots.forEach(root=>{bindTabs(root);bindForms(root);bindQR(root);renderAll(root)});
})();

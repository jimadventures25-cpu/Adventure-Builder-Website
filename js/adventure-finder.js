
(() => {
'use strict';
const roots=[...document.querySelectorAll('[data-adventure-finder]')]; if(!roots.length)return;
const VAN_KEY='ab-vanlife-profile-v1', FINDER_KEY='ab-adventure-finder-v1';

const places=[
 {id:'af1',name:'Rydal Explorer Base',region:'Lake District',type:'Campsite',traits:['dog','tent','van','family','showers','toilets','water'],pois:['waterfall','sunset','hiking','lake','cafe'],vehicle:{maxHeight:3.4,maxLength:7.5,maxWeight:3500},distance:{waterfall:2.2,sunset:1.1,hiking:.3,lake:.8,cafe:1.6},desc:'Demo campsite profile built to show experience-first and van-aware matching.'},
 {id:'af2',name:'Borrowdale Adventure Stop',region:'Lake District',type:'Campervan Site',traits:['dog','van','toilets','water','quiet'],pois:['waterfall','hiking','mountain','sunrise','pub'],vehicle:{maxHeight:3.1,maxLength:6.8,maxWeight:3500},distance:{waterfall:1.0,hiking:.2,mountain:1.8,sunrise:1.3,pub:1.1},desc:'Demo campervan base close to mountain-style adventures.'},
 {id:'af3',name:'Coniston Water Base',region:'Lake District',type:'Campsite',traits:['dog','tent','van','showers','toilets','water','electric'],pois:['paddle','sunset','lake','hiking','cafe'],vehicle:{maxHeight:3.6,maxLength:8.0,maxWeight:4250},distance:{paddle:.7,sunset:.9,lake:.4,hiking:.5,cafe:1.2},desc:'Demo base aimed at paddling, lakeside walks and sunset experiences.'},
 {id:'af4',name:'Peak Edge Explorer Camp',region:'Peak District',type:'Campsite',traits:['dog','tent','family','showers','toilets'],pois:['hiking','sunset','cave','pub','photo'],vehicle:{maxHeight:2.9,maxLength:6.2,maxWeight:3500},distance:{hiking:.2,sunset:1.4,cave:3.1,pub:.8,photo:.6},desc:'Demo Peak District adventure base.'},
 {id:'af5',name:'Dales Quiet Van Haven',region:'Yorkshire Dales',type:'Permitted Overnight Stop',traits:['dog','van','quiet','toilets'],pois:['waterfall','hiking','sunset','pub','photo'],vehicle:{maxHeight:3.3,maxLength:7.2,maxWeight:3500},distance:{waterfall:2.6,hiking:.4,sunset:.8,pub:1.7,photo:.9},desc:'Demo permitted-overnight profile for vanlife matching.'},
 {id:'af6',name:'Highland Loch Explorer',region:'Scottish Highlands',type:'Campsite',traits:['dog','tent','van','showers','toilets','water'],pois:['paddle','lake','mountain','wildlife','sunset'],vehicle:{maxHeight:3.8,maxLength:8.5,maxWeight:5000},distance:{paddle:.5,lake:.1,mountain:3.4,wildlife:1.3,sunset:.5},desc:'Demo Highland base for water, mountain and wildlife adventures.'},
 {id:'af7',name:'Cornish Coast Adventure Park',region:'Cornwall',type:'Campsite',traits:['dog','tent','van','family','showers','toilets','electric'],pois:['beach','sunset','paddle','cafe','hiking'],vehicle:{maxHeight:3.2,maxLength:7.0,maxWeight:3500},distance:{beach:.7,sunset:.4,paddle:1.0,cafe:.9,hiking:.3},desc:'Demo coastal base for beach and paddling adventures.'},
 {id:'af8',name:'New Forest Quiet Base',region:'New Forest',type:'Campervan Site',traits:['dog','van','quiet','toilets','water'],pois:['forest','wildlife','cycling','cafe','hiking'],vehicle:{maxHeight:3.0,maxLength:6.5,maxWeight:3500},distance:{forest:.1,wildlife:.6,cycling:.2,cafe:1.4,hiking:.2},desc:'Demo woodland adventure base.'}
];

const labels={dog:'🐕 Dog friendly',tent:'⛺ Tent',van:'🚐 Van friendly',family:'👨‍👩‍👧 Family',showers:'🚿 Showers',toilets:'🚻 Toilets',water:'🚰 Water',electric:'⚡ Electric',quiet:'🤫 Quiet',waterfall:'💦 Waterfall',sunset:'🌅 Sunset viewpoint',sunrise:'🌄 Sunrise',hiking:'🥾 Hiking',lake:'🏞️ Lake',cafe:'☕ Café',pub:'🍺 Pub',paddle:'🛶 Paddle',mountain:'🏔️ Mountains',beach:'🌊 Beach',cave:'🪨 Caves',photo:'📸 Photography',wildlife:'🐦 Wildlife',forest:'🌲 Forest',cycling:'🚴 Cycling'};
const read=(k,f={})=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

function vanProfile(){return read(VAN_KEY,{})}
function prefs(root){
  return {
    area:root.querySelector('[data-af-area]').value.trim(),
    stay:root.querySelector('[data-af-stay]').value,
    drive:root.querySelector('[data-af-drive]').value,
    useVan:root.querySelector('[data-af-use-van]')?.checked||false,
    selected:[...root.querySelectorAll('[data-af-choice][aria-pressed="true"]')].map(b=>b.dataset.afChoice)
  }
}
function vehicleFit(place,profile){
  const h=Number(profile.height)||0,l=Number(profile.length)||0,w=Number(profile.weight)||0;
  const reasons=[];
  if(h && place.vehicle?.maxHeight && h>place.vehicle.maxHeight) reasons.push(`height ${h}m > ${place.vehicle.maxHeight}m`);
  if(l && place.vehicle?.maxLength && l>place.vehicle.maxLength) reasons.push(`length ${l}m > ${place.vehicle.maxLength}m`);
  if(w && place.vehicle?.maxWeight && w>place.vehicle.maxWeight) reasons.push(`weight ${w}kg > ${place.vehicle.maxWeight}kg`);
  return {fit:reasons.length===0,reasons};
}
function match(place,x){
  const a=(x.area||'').toLowerCase();
  if(a&&a!=='anywhere'&&!place.region.toLowerCase().includes(a)&&!a.includes(place.region.toLowerCase())) return null;
  if(x.stay&&x.stay!=='Any stay'&&place.type!==x.stay) return null;
  const all=new Set([...place.traits,...place.pois]), matched=[], missing=[];
  x.selected.forEach(k=>(all.has(k)?matched:missing).push(k));
  let score=x.selected.length?Math.round((matched.length/x.selected.length)*70+20):75;
  let vanFit={fit:true,reasons:[]}, vanBonus=0;
  if(x.useVan){
    const profile=vanProfile();
    vanFit=vehicleFit(place,profile);
    if(place.traits.includes('van')) vanBonus+=8;
    if(vanFit.fit) vanBonus+=7; else score-=35;
  }
  score=Math.max(0,Math.min(100,score+vanBonus));
  return {...place,matched,missing,score,vanFit};
}
function renderVanSummary(root){
  const box=root.querySelector('[data-af-van-summary]'); if(!box)return;
  const p=vanProfile();
  if(!Object.keys(p).length){box.innerHTML='<strong>No van profile saved yet.</strong><br>Create one in Adventure Builder Vanlife → My Van to filter Adventure Finder by your vehicle.';return;}
  box.innerHTML=`<strong>${p.name||'My Van'}${p.model?' · '+p.model:''}</strong><br>${p.height?`Height ${p.height}m · `:''}${p.length?`Length ${p.length}m · `:''}${p.weight?`Weight ${p.weight}kg · `:''}${p.people?`${p.people} traveller${Number(p.people)===1?'':'s'}`:''}`;
}
function render(root){
  const x=prefs(root),rs=places.map(p=>match(p,x)).filter(Boolean).sort((a,b)=>b.score-a.score);
  root.querySelector('[data-af-count]').textContent=`${rs.length} demo match${rs.length===1?'':'es'}`;
  root.querySelector('[data-af-summary]').textContent=`${x.area||'Anywhere'}${x.selected.length?' · '+x.selected.map(k=>labels[k]||k).join(' · '):' · Choose what you want nearby'}${x.useVan?' · Van profile ON':''}`;
  root.querySelectorAll('.af-pin').forEach((p,i)=>p.hidden=i>=Math.min(4,rs.length));
  const list=root.querySelector('[data-af-results]');
  if(!rs.length){list.innerHTML='<div class="af-empty"><strong>No demo matches for that combination.</strong>Try changing the area, stay type or one of your preferences.</div>';return;}
  list.innerHTML=rs.map(r=>{
    const cls=r.score>=85?'high':r.score>=65?'mid':'low';
    const tags=r.matched.map(k=>`<span class="af-tag match">${labels[k]||k}</span>`).join('');
    const nearby=r.matched.filter(k=>r.distance[k]!=null).map(k=>`<span class="af-tag poi">${labels[k]||k} · ${r.distance[k]} km</span>`).join('');
    const v=x.useVan ? (r.vanFit.fit ? '<span class="af-tag match">🚐 Fits saved van profile</span>' : `<span class="af-tag" style="border-color:#87514b;color:#ffc4bc">⚠ Van profile mismatch: ${r.vanFit.reasons.join(', ')}</span>`) : '';
    const dims=x.useVan&&r.vehicle?`<div class="af-why"><strong>Vehicle limits (DEMO):</strong> max height ${r.vehicle.maxHeight}m · max length ${r.vehicle.maxLength}m · max weight ${r.vehicle.maxWeight}kg</div>`:'';
    return `<article class="af-result"><div class="af-result-top"><div><small>${r.type} · ${r.region} · DEMO</small><h4>${r.name}</h4><small>${r.desc}</small></div><div class="af-match ${cls}">${r.score}%</div></div><div class="af-tags">${v}${tags}${nearby}</div><div class="af-why"><strong>Why it matched:</strong> ${r.matched.length?r.matched.map(k=>labels[k]||k).join(', '):'General match in your selected area.'}</div>${dims}<div class="af-result-actions"><button class="af-btn" type="button" data-af-save="${r.id}">♡ Save idea</button><button class="af-btn" type="button" data-af-plan="${r.id}">🧭 Build adventure</button></div></article>`;
  }).join('');
}
function bind(root){
  const s=read(FINDER_KEY,{});
  if(s.area)root.querySelector('[data-af-area]').value=s.area;
  if(s.stay)root.querySelector('[data-af-stay]').value=s.stay;
  if(s.drive)root.querySelector('[data-af-drive]').value=s.drive;
  if(root.querySelector('[data-af-use-van]')) root.querySelector('[data-af-use-van]').checked=!!s.useVan;
  if(Array.isArray(s.selected))root.querySelectorAll('[data-af-choice]').forEach(b=>b.setAttribute('aria-pressed',String(s.selected.includes(b.dataset.afChoice))));
  root.querySelectorAll('[data-af-choice]').forEach(b=>b.addEventListener('click',()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'))));
  root.querySelector('[data-af-use-van]')?.addEventListener('change',()=>{renderVanSummary(root);render(root)});
  root.querySelector('[data-af-search]').addEventListener('click',()=>{write(FINDER_KEY,prefs(root));render(root);root.querySelector('[data-af-results-heading]').scrollIntoView({behavior:'smooth',block:'start'})});
  root.querySelector('[data-af-clear]').addEventListener('click',()=>{root.querySelector('[data-af-area]').value='Anywhere';root.querySelector('[data-af-stay]').value='Any stay';root.querySelector('[data-af-drive]').value='No limit';if(root.querySelector('[data-af-use-van]'))root.querySelector('[data-af-use-van]').checked=false;root.querySelectorAll('[data-af-choice]').forEach(b=>b.setAttribute('aria-pressed','false'));write(FINDER_KEY,{});render(root)});
  root.addEventListener('click',e=>{
    const id=e.target.dataset.afSave||e.target.dataset.afPlan;if(!id)return;
    const p=places.find(x=>x.id===id),msg=root.querySelector('[data-af-status]');
    if(e.target.dataset.afSave){try{const k='ab-adventure-finder-saved-v1',arr=JSON.parse(localStorage.getItem(k)||'[]');if(!arr.includes(id))arr.push(id);localStorage.setItem(k,JSON.stringify(arr));msg.textContent=`${p.name} saved as an adventure idea on this device.`}catch{msg.textContent='Could not save on this device.'}}
    else {
      const handoff={placeId:p.id,placeName:p.name,region:p.region,source:'adventure-finder',vanProfile:prefs(root).useVan?vanProfile():null,preferences:prefs(root),createdAt:new Date().toISOString()};
      write('ab-trip-planner-handoff-v1',handoff);
      msg.textContent=`Adventure idea started for ${p.name}. Van profile and preferences are ready for the Trip Planner hand-off.`;
    }
  });
  renderVanSummary(root);render(root);
}
roots.forEach(bind);
})();

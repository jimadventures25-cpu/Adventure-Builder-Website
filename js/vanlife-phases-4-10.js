
(() => {
'use strict';

const roots=[...document.querySelectorAll('[data-ab-vanlife]')];
if(!roots.length) return;

const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const SERVICE_CACHE='ab-vanlife-services-cache-v1';
const BASECAMP_KEY='ab-vanlife-basecamp-v1';
const COMMUNITY_KEY='ab-vanlife-community-v1';
const TRIPS_KEY='ab-vanlife-trips-v1';
const BUDGET_KEY='ab-vanlife-budget-v1';
const PARTNERS_KEY='ab-vanlife-partners-v1';
const NETWORK_KEY='ab-vanlife-network-v1';

const serviceDefs={
  water:{label:'Fresh water',icon:'🚰',query:'["amenity"="drinking_water"]'},
  waste:{label:'Waste disposal',icon:'🚽',query:'["amenity"="sanitary_dump_station"]'},
  fuel:{label:'Fuel',icon:'⛽',query:'["amenity"="fuel"]'},
  lpg:{label:'LPG',icon:'🔥',query:'["fuel:lpg"="yes"]'},
  shower:{label:'Showers',icon:'🚿',query:'["amenity"="shower"]'},
  laundry:{label:'Laundry',icon:'🧺',query:'["shop"="laundry"]'},
  toilets:{label:'Toilets',icon:'🚻',query:'["amenity"="toilets"]'},
  supermarket:{label:'Supermarket',icon:'🛒',query:'["shop"="supermarket"]'},
  ev:{label:'EV charging',icon:'🔌',query:'["amenity"="charging_station"]'},
  cafe:{label:'Café',icon:'☕',query:'["amenity"="cafe"]'},
  pub:{label:'Pub',icon:'🍺',query:'["amenity"="pub"]'},
  pharmacy:{label:'Pharmacy',icon:'💊',query:'["amenity"="pharmacy"]'},
  viewpoint:{label:'Viewpoint',icon:'🌄',query:'["tourism"="viewpoint"]'},
  attraction:{label:'Attraction',icon:'🏰',query:'["tourism"="attraction"]'}
};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const rad=x=>x*Math.PI/180;
function dist(a,b,c,d){const R=6371,dl=rad(c-a),dn=rad(d-b),q=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
function coords(el){const lat=Number(el.lat??el.center?.lat),lon=Number(el.lon??el.center?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null}
function currentPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('Geolocation unavailable'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,label:'Current location'}),()=>reject(new Error('Location permission unavailable')),{enableHighAccuracy:true,timeout:12000,maximumAge:60000})})}
async function fetchOverpass(query){
  let last;
  for(const url of OVERPASS){
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(e){last=e}
  }
  throw last||new Error('Map service unavailable');
}
function buildMultiQuery(lat,lon,radius,keys){
  const body=keys.map(k=>`nwr(around:${radius},${lat},${lon})${serviceDefs[k].query};`).join('\n');
  return `[out:json][timeout:25];(${body});out center tags;`;
}
function renderServiceResults(root,origin,json,keys,targetSel){
  const target=root.querySelector(targetSel);
  const wanted=new Set(keys);
  const items=(json.elements||[]).map(el=>({el,c:coords(el)})).filter(x=>x.c).map(x=>({...x,d:dist(origin.lat,origin.lon,x.c.lat,x.c.lon)})).sort((a,b)=>a.d-b.d).slice(0,60);
  if(!items.length){target.innerHTML='<div class="av-note">No mapped results returned for those layers in this area.</div>';return}
  target.innerHTML=items.map(({el,c,d})=>{
    const t=el.tags||{};
    let kind='Place',icon='📍';
    for(const [k,def] of Object.entries(serviceDefs)){
      const q=def.query;
      if((k==='water'&&t.amenity==='drinking_water')||(k==='waste'&&t.amenity==='sanitary_dump_station')||(k==='fuel'&&t.amenity==='fuel')||(k==='lpg'&&String(t['fuel:lpg']).toLowerCase()==='yes')||(k==='shower'&&t.amenity==='shower')||(k==='laundry'&&t.shop==='laundry')||(k==='toilets'&&t.amenity==='toilets')||(k==='supermarket'&&t.shop==='supermarket')||(k==='ev'&&t.amenity==='charging_station')||(k==='cafe'&&t.amenity==='cafe')||(k==='pub'&&t.amenity==='pub')||(k==='pharmacy'&&t.amenity==='pharmacy')||(k==='viewpoint'&&t.tourism==='viewpoint')||(k==='attraction'&&t.tourism==='attraction')){kind=def.label;icon=def.icon;break}
    }
    const name=t.name||t.operator||kind;
    const map=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(c.lat)}&mlon=${encodeURIComponent(c.lon)}#map=16/${encodeURIComponent(c.lat)}/${encodeURIComponent(c.lon)}`;
    return `<article class="av-item"><div class="av-item-top"><div><small>${icon} ${esc(kind)}</small><h4>${esc(name)}</h4></div><div class="av-distance">${d.toFixed(1)} km</div></div><div class="av-item-tags">${t.opening_hours?'<span class="av-item-tag">🕒 Hours mapped</span>':''}${t.fee?`<span class="av-item-tag">💷 ${esc(t.fee)}</span>`:''}${t.website?'<span class="av-item-tag">🌐 Website</span>':''}</div><div class="av-item-actions"><a class="av-btn" href="${map}" target="_blank" rel="noopener">🗺 Map</a>${t.website?`<a class="av-btn" href="${esc(t.website)}" target="_blank" rel="noopener">Website</a>`:''}</div></article>`;
  }).join('');
}
async function runServiceSearch(root,targetSel,keys,origin,radiusKm=15){
  const target=root.querySelector(targetSel);target.innerHTML='<div class="av-note">Loading live map data…</div>';
  try{
    const query=buildMultiQuery(origin.lat,origin.lon,Math.round(radiusKm*1000),keys);
    const json=await fetchOverpass(query);
    renderServiceResults(root,origin,json,keys,targetSel);
  }catch(e){target.innerHTML='<div class="av-note">Live map data could not be loaded. No fictional replacements were inserted.</div>'}
}
function selectedBasecamp(){return read(BASECAMP_KEY,null)}
function setBasecamp(stop){
  write(BASECAMP_KEY,stop);
  roots.forEach(renderBasecampSummary);
}
function renderBasecampSummary(root){
  const box=root.querySelector('[data-av-basecamp-summary]');if(!box)return;
  const b=selectedBasecamp();
  box.innerHTML=b?`<strong>${esc(b.name||'Basecamp')}</strong><br><small>${Number(b.lat).toFixed(5)}, ${Number(b.lon).toFixed(5)}</small>`:'<strong>No Basecamp selected</strong><br><small>Save a Tonight stop or use your current location.</small>';
}
function bindPhase4(root){
  const serviceButtons=[...root.querySelectorAll('[data-av-service]')];
  serviceButtons.forEach(b=>b.addEventListener('click',()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'))));
  root.querySelector('[data-av-services-nearby]')?.addEventListener('click',async()=>{
    const selected=serviceButtons.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.avService);
    if(!selected.length){root.querySelector('[data-av-service-results]').innerHTML='<div class="av-note">Choose at least one map layer.</div>';return}
    try{const o=await currentPosition();await runServiceSearch(root,'[data-av-service-results]',selected,o,15)}catch(e){root.querySelector('[data-av-service-results]').innerHTML='<div class="av-note">Current location is unavailable.</div>'}
  });
}
function bindPhase5(root){
  root.querySelector('[data-av-base-current]')?.addEventListener('click',async()=>{
    try{const o=await currentPosition();setBasecamp({name:'Current Basecamp',lat:o.lat,lon:o.lon,source:'gps',savedAt:new Date().toISOString()})}catch(e){}
  });
  root.querySelector('[data-av-base-explore]')?.addEventListener('click',async()=>{
    const b=selectedBasecamp();const target=root.querySelector('[data-av-base-results]');
    if(!b){target.innerHTML='<div class="av-note">Choose a Basecamp first.</div>';return}
    await runServiceSearch(root,'[data-av-base-results]',['cafe','pub','supermarket','viewpoint','attraction','water','toilets'],b,12);
  });
  renderBasecampSummary(root);
}
function renderCommunity(root){
  const box=root.querySelector('[data-av-community-list]');if(!box)return;
  const items=read(COMMUNITY_KEY,[]);
  box.innerHTML=items.length?items.slice().reverse().map(x=>`<article class="av-item"><div class="av-item-top"><div><small>${esc(x.type)}</small><h4>${esc(x.name)}</h4></div><span class="av-moderation ${x.status==='approved'?'approved':''}">${esc(x.status||'pending review')}</span></div><small>${esc(x.notes||'')}</small></article>`).join(''):'<div class="av-note">No community submissions saved on this device yet.</div>';
}
function bindPhase6(root){
  const form=root.querySelector('[data-av-community-form]');
  form?.addEventListener('submit',e=>{
    e.preventDefault();const d=Object.fromEntries(new FormData(form).entries());const arr=read(COMMUNITY_KEY,[]);
    arr.push({...d,id:Date.now().toString(36),status:'pending review',createdAt:new Date().toISOString()});write(COMMUNITY_KEY,arr);form.reset();renderCommunity(root);root.querySelector('[data-av-community-status]').textContent='Submission saved as pending review on this device.';
  });
  renderCommunity(root);
}
function renderBudget(root){
  const box=root.querySelector('[data-av-budget-list]');if(!box)return;
  const rows=read(BUDGET_KEY,[]);
  const total=rows.reduce((s,x)=>s+(Number(x.amount)||0),0);
  root.querySelector('[data-av-budget-total]').textContent=`£${total.toFixed(2)}`;
  box.innerHTML=rows.length?rows.map(x=>`<div class="av-item"><strong>${esc(x.item)}</strong> <small>£${Number(x.amount).toFixed(2)}</small></div>`).join(''):'<div class="av-note">No trip costs saved yet.</div>';
}
function bindPhase7(root){
  root.querySelector('[data-av-budget-add]')?.addEventListener('click',()=>{
    const item=root.querySelector('[data-av-budget-item]').value.trim(),amount=Number(root.querySelector('[data-av-budget-amount]').value);
    if(!item||!Number.isFinite(amount))return;
    const rows=read(BUDGET_KEY,[]);rows.push({item,amount});write(BUDGET_KEY,rows);
    root.querySelector('[data-av-budget-item]').value='';root.querySelector('[data-av-budget-amount]').value='';renderBudget(root);
  });
  renderBudget(root);
}
function bindPhase8(root){
  root.querySelector('[data-av-assistant-run]')?.addEventListener('click',()=>{
    const nights=Number(root.querySelector('[data-av-assistant-nights]').value)||1;
    const style=root.querySelector('[data-av-assistant-style]').value;
    const dog=root.querySelector('[data-av-assistant-dog]').checked;
    const paddle=root.querySelector('[data-av-assistant-paddle]').checked;
    const quiet=root.querySelector('[data-av-assistant-quiet]').checked;
    const base=selectedBasecamp();
    const lines=[
      `Adventure Builder Vanlife suggestion`,
      `Trip length: ${nights} night${nights===1?'':'s'}`,
      `Style: ${style}`,
      dog?'Bring dog-friendly filters into Adventure Finder.':null,
      paddle?'Prioritise paddle launches, water access and weather checks.':null,
      quiet?'Prioritise quiet/low-disturbance stops and avoid busy central locations.':null,
      base?`Basecamp: ${base.name}`:'Basecamp: choose a Tonight stop first',
      '',
      'Suggested flow:',
      '1. Use Adventure Finder with My Van enabled.',
      '2. Choose a verified/permission-aware stop for tonight.',
      '3. Check water, waste, fuel and toilets before arrival.',
      '4. Set the stop as Basecamp.',
      '5. Explore nearby walks, viewpoints, cafés and attractions.',
      '6. Save costs and memories into the Vanlife Trip.'
    ].filter(Boolean);
    root.querySelector('[data-av-assistant-output]').textContent=lines.join('\n');
  });
}
function renderPartners(root){
  const box=root.querySelector('[data-av-partner-list]');if(!box)return;
  const items=read(PARTNERS_KEY,[]);
  box.innerHTML=items.length?items.map(x=>`<article class="av-item"><small>${esc(x.type)}</small><h4>${esc(x.name)}</h4><small>${esc(x.notes||'')}</small></article>`).join(''):'<div class="av-note">No local partner records saved yet.</div>';
}
function bindPhase9(root){
  root.querySelector('[data-av-partner-form]')?.addEventListener('submit',e=>{
    e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f).entries()),arr=read(PARTNERS_KEY,[]);arr.push({...d,id:Date.now().toString(36)});write(PARTNERS_KEY,arr);f.reset();renderPartners(root);root.querySelector('[data-av-partner-status]').textContent='Partner prospect saved locally.';
  });
  renderPartners(root);
}
function renderNetwork(root){
  const trips=read(TRIPS_KEY,[]),community=read(COMMUNITY_KEY,[]),partners=read(PARTNERS_KEY,[]),budget=read(BUDGET_KEY,[]);
  const stops=read('ab-vanlife-saved-live-stops-v1',[]);
  const metrics={trips:trips.length,stops:stops.length,community:community.length,partners:partners.length,cost:budget.reduce((s,x)=>s+(Number(x.amount)||0),0)};
  root.querySelector('[data-av-net-trips]').textContent=metrics.trips;
  root.querySelector('[data-av-net-stops]').textContent=metrics.stops;
  root.querySelector('[data-av-net-community]').textContent=metrics.community;
  root.querySelector('[data-av-net-partners]').textContent=metrics.partners;
  root.querySelector('[data-av-net-cost]').textContent=`£${metrics.cost.toFixed(2)}`;
}
function bindPhase10(root){renderNetwork(root);root.querySelector('[data-av-network-refresh]')?.addEventListener('click',()=>renderNetwork(root))}
roots.forEach(root=>{bindPhase4(root);bindPhase5(root);bindPhase6(root);bindPhase7(root);bindPhase8(root);bindPhase9(root);bindPhase10(root)});
})();

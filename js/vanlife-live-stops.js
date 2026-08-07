
(() => {
'use strict';

const roots=[...document.querySelectorAll('[data-ab-vanlife]')];
if(!roots.length) return;

const OVERPASS_ENDPOINTS=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const NOMINATIM='https://nominatim.openstreetmap.org/search';
const CACHE_KEY='ab-vanlife-live-stops-cache-v1';
const CACHE_MS=10*60*1000;

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY))||{}}catch{return{}}}
function writeCache(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v))}catch{}}
function haversine(a,b,c,d){
  const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(c-a),dLon=toRad(d-b);
  const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function coords(el){
  const lat=Number(el.lat??el.center?.lat),lon=Number(el.lon??el.center?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
}
function tagYes(tags,key){return ['yes','designated','permissive'].includes(String(tags?.[key]||'').toLowerCase())}
function facilityTags(tags){
  const out=[];
  if(tagYes(tags,'toilets')||tags?.amenity==='toilets') out.push('🚻 Toilets');
  if(tagYes(tags,'shower')||tagYes(tags,'showers')) out.push('🚿 Shower');
  if(tagYes(tags,'drinking_water')) out.push('🚰 Drinking water');
  if(tagYes(tags,'sanitary_dump_station')) out.push('🚽 Waste disposal');
  if(tags?.power_supply && String(tags.power_supply).toLowerCase()!=='no') out.push('⚡ Power');
  if(tagYes(tags,'dog')) out.push('🐕 Dogs tagged yes');
  if(tags?.fee) out.push(`💷 Fee: ${tags.fee}`);
  if(tags?.opening_hours) out.push('🕒 Opening hours mapped');
  return out;
}
function evidence(el){
  const t=el.tags||{};
  if(t.amenity==='parking' && String(t.motorhome_stopover).toLowerCase()==='yes'){
    return {label:'OSM-tagged motorhome stopover',cls:'strong',detail:'Parking is specifically tagged motorhome_stopover=yes in OpenStreetMap.'};
  }
  if(t.tourism==='caravan_site'){
    return {label:'Mapped caravan / motorhome site',cls:'strong',detail:'OpenStreetMap tourism=caravan_site indicates an overnight caravan/motorhome site.'};
  }
  if(t.tourism==='camp_site' && String(t.motorhome).toLowerCase()==='yes'){
    return {label:'Mapped campsite · motorhome=yes',cls:'strong',detail:'The campsite is explicitly tagged motorhome=yes in OpenStreetMap.'};
  }
  if(t.tourism==='camp_site' && String(t.caravans).toLowerCase()==='yes'){
    return {label:'Mapped campsite · caravans=yes',cls:'medium',detail:'Vehicle camping is tagged, but campervan/motorhome acceptance should still be confirmed.'};
  }
  return {label:'Mapped overnight facility',cls:'info',detail:'Mapped as an overnight accommodation type; confirm current access and rules.'};
}
function buildQuery(lat,lon,radius){
  return `[out:json][timeout:25];
(
  nwr(around:${radius},${lat},${lon})["tourism"="caravan_site"];
  nwr(around:${radius},${lat},${lon})["tourism"="camp_site"]["motorhome"="yes"];
  nwr(around:${radius},${lat},${lon})["tourism"="camp_site"]["caravans"="yes"];
  nwr(around:${radius},${lat},${lon})["amenity"="parking"]["motorhome_stopover"="yes"];
);
out center tags;`;
}
async function fetchOverpass(query){
  let lastError;
  for(const url of OVERPASS_ENDPOINTS){
    try{
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }catch(err){lastError=err;}
  }
  throw lastError||new Error('Overpass unavailable');
}
async function geocode(name){
  const url=`${NOMINATIM}?format=jsonv2&limit=1&countrycodes=gb,ie&q=${encodeURIComponent(name)}`;
  const res=await fetch(url,{headers:{'Accept':'application/json'}});
  if(!res.ok) throw new Error(`Location search HTTP ${res.status}`);
  const data=await res.json();
  if(!data.length) throw new Error('Location not found');
  return {lat:Number(data[0].lat),lon:Number(data[0].lon),label:data[0].display_name};
}
function getCurrentPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,label:'Current location'}),
      ()=>reject(new Error('Location permission was not granted or a GPS position was not available.')),
      {enableHighAccuracy:true,timeout:12000,maximumAge:60000}
    );
  });
}
function render(root,origin,json,label){
  const list=root.querySelector('[data-av-live-results]');
  const stamp=root.querySelector('[data-av-live-stamp]');
  const elements=(json.elements||[])
    .map(el=>({el,c:coords(el)}))
    .filter(x=>x.c)
    .filter(x=>{
      const access=String(x.el.tags?.access||'').toLowerCase();
      return access!=='no' && access!=='private';
    })
    .map(x=>({...x,d:haversine(origin.lat,origin.lon,x.c.lat,x.c.lon)}))
    .sort((a,b)=>a.d-b.d)
    .slice(0,40);

  if(!elements.length){
    list.innerHTML='<div class="av-live-empty">No mapped caravan sites, motorhome-tagged campsites or motorhome stopovers were returned in this search area. Try a larger radius or another place.</div>';
  } else {
    list.innerHTML=elements.map(({el,c,d})=>{
      const t=el.tags||{},e=evidence(el),name=t.name||t.operator||'Unnamed mapped stop';
      const facilities=facilityTags(t);
      const website=t.website||t['contact:website']||'';
      const phone=t.phone||t['contact:phone']||'';
      const osm=`https://www.openstreetmap.org/${el.type}/${el.id}`;
      const map=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(c.lat)}&mlon=${encodeURIComponent(c.lon)}#map=16/${encodeURIComponent(c.lat)}/${encodeURIComponent(c.lon)}`;
      return `<article class="av-live-card">
        <div class="av-live-top">
          <div><small>${esc(t.tourism==='caravan_site'?'Caravan site':t.tourism==='camp_site'?'Campsite':'Motorhome stopover')}</small><h4>${esc(name)}</h4><span class="av-live-status ${e.cls}">${esc(e.label)}</span></div>
          <div class="av-live-distance">${d.toFixed(1)} km</div>
        </div>
        <div class="av-live-tags">${facilities.length?facilities.map(x=>`<span class="av-live-tag">${esc(x)}</span>`).join(''):'<span class="av-live-tag">Facilities not fully mapped</span>'}</div>
        <div class="av-live-source">${esc(e.detail)} ${t.operator?`Operator: ${esc(t.operator)}. `:''}${t.maxstay?`Max stay mapped: ${esc(t.maxstay)}. `:''}</div>
        <div class="av-live-actions">
          <a class="av-btn" href="${map}" target="_blank" rel="noopener">🗺 View map</a>
          <a class="av-btn" href="${osm}" target="_blank" rel="noopener">ⓘ OSM record</a>
          ${website?`<a class="av-btn" href="${esc(website)}" target="_blank" rel="noopener">🌐 Listed website</a>`:''}
          ${phone?`<a class="av-btn" href="tel:${esc(phone)}">📞 Call</a>`:''}
          <button class="av-btn" type="button" data-av-live-save='${JSON.stringify({id:`${el.type}/${el.id}`,name,lat:c.lat,lon:c.lon,website,evidence:e.label}).replace(/'/g,"&#39;")}'>♡ Save stop</button>
        </div>
      </article>`;
    }).join('');
  }
  const osmDate=json.osm3s?.timestamp_osm_base?new Date(json.osm3s.timestamp_osm_base).toLocaleString('en-GB'):'unknown';
  stamp.textContent=`${elements.length} live mapped results around ${label}. OSM base timestamp: ${osmDate}.`;
}
async function run(root,mode){
  const status=root.querySelector('[data-av-live-status]');
  const list=root.querySelector('[data-av-live-results]');
  const radiusKm=Number(root.querySelector('[data-av-live-radius]').value)||25;
  status.textContent='Finding location…'; list.innerHTML='';
  try{
    let origin;
    if(mode==='nearby') origin=await getCurrentPosition();
    else{
      const q=root.querySelector('[data-av-live-place]').value.trim();
      if(!q) throw new Error('Enter a town, area or postcode.');
      origin=await geocode(q);
    }
    status.textContent='Searching live OpenStreetMap data…';
    const cacheKey=`${origin.lat.toFixed(3)},${origin.lon.toFixed(3)},${radiusKm}`;
    const cache=readCache();
    let json;
    if(cache[cacheKey] && Date.now()-cache[cacheKey].savedAt<CACHE_MS){
      json=cache[cacheKey].data;
      status.textContent='Showing recently cached live map data.';
    } else {
      json=await fetchOverpass(buildQuery(origin.lat,origin.lon,Math.round(radiusKm*1000)));
      cache[cacheKey]={savedAt:Date.now(),data:json};
      writeCache(cache);
      status.textContent='Live map data loaded.';
    }
    render(root,origin,json,origin.label||'your search');
  }catch(err){
    console.error('Adventure Builder live Tonight search:',err);
    status.textContent=err.message||'Live stop search failed.';
    list.innerHTML='<div class="av-live-empty">Live data could not be loaded right now. No unverified fallback locations have been substituted.</div>';
  }
}
roots.forEach(root=>{
  root.querySelector('[data-av-live-search]')?.addEventListener('click',()=>run(root,'place'));
  root.querySelector('[data-av-live-nearby]')?.addEventListener('click',()=>run(root,'nearby'));
  root.querySelector('[data-av-live-results]')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-av-live-save]'); if(!btn)return;
    try{
      const item=JSON.parse(btn.dataset.avLiveSave);
      const key='ab-vanlife-saved-live-stops-v1',arr=JSON.parse(localStorage.getItem(key)||'[]');
      if(!arr.some(x=>x.id===item.id)) arr.push({...item,savedAt:new Date().toISOString()});
      localStorage.setItem(key,JSON.stringify(arr));
      root.querySelector('[data-av-live-status]').textContent=`${item.name} saved on this device.`;
    }catch{root.querySelector('[data-av-live-status]').textContent='Could not save this stop.'}
  });
});
})();

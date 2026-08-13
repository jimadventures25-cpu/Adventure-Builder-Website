(() => {
'use strict';
const KEY='ab-adventure-hub-v2', LEGACY='ab-adventure-hub-v1';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const id=()=>crypto.randomUUID?.()||`adv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const typeMap=v=>{const s=String(v||'').toLowerCase();if(s.includes('kayak'))return'kayak';if(s.includes('paddle'))return'paddle';if(s.includes('cycl'))return'cycle';if(s.includes('walk')||s.includes('hik')||s.includes('jog'))return'hike';if(s.includes('camp'))return'camp';if(s.includes('photo'))return'photo';if(s.includes('fish'))return'fishing';if(s.includes('dog'))return'dog';if(s.includes('road')||s.includes('motor')||s.includes('camper')||s.includes('day trip'))return'road';return'explore'};
const clean=a=>({id:String(a.id||id()),type:typeMap(a.type),title:String(a.title||a.name||'Adventure').trim().slice(0,80),date:String(a.date||a.visitedDate||a.createdAt||new Date().toISOString()).slice(0,10),location:String(a.location||a.destination||a.launchPoint||'').trim().slice(0,140),distanceKm:Math.max(0,num(a.distanceKm??a.distance)),photos:Math.max(0,Math.round(num(a.photos))),newPlace:!!a.newPlace,notes:String(a.notes||a.text||'').trim().slice(0,1500),lat:num(a.lat??a.destinationLat)||null,lon:num(a.lon??a.destinationLon)||null,durationMinutes:Math.max(0,Math.round(num(a.durationMinutes))),elevationM:Math.max(0,num(a.elevationM)),days:Math.max(0,Math.round(num(a.days))),nights:Math.max(0,Math.round(num(a.nights))),waterType:String(a.waterType||''),launchPoint:String(a.launchPoint||''),species:String(a.species||''),source:String(a.source||'manual'),sourceId:String(a.sourceId||''),createdAt:String(a.createdAt||new Date().toISOString())});
function migrate(){let state=read(KEY,null);if(state?.adventures)return state;const old=read(LEGACY,{adventures:[]});state={version:2,adventures:(old.adventures||[]).map(x=>clean({...x,distanceKm:x.distance,source:'legacy-hub',sourceId:x.id}))};write(KEY,state);return state}
let state=migrate();
const save=()=>write(KEY,state);
function all(){return state.adventures.slice().sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)))}
function add(a){const item=clean(a);state.adventures=state.adventures.filter(x=>x.id!==item.id);state.adventures.push(item);save();return item}
function remove(itemId){state.adventures=state.adventures.filter(x=>x.id!==itemId);save()}
function already(source,sourceId){return !!sourceId&&state.adventures.some(x=>x.source===source&&x.sourceId===String(sourceId))}
function trailCandidates(){return read('adventureBuilderSavedTrails',[]).map(t=>{const p=(t.points||[])[0]||{};return clean({type:typeMap(t.activity||t.transport||'hike'),title:t.name||'Saved walking trail',date:t.createdAt,distanceKm:num(t.distance)/1000,durationMinutes:num(t.duration)/60,lat:p.lat,lon:p.lon,location:p.poi?.name||'',source:'walking',sourceId:t.id})})}
function tripCandidates(){return read('adventure-builder-plans-v1',[]).map(t=>clean({type:typeMap(t.tripType),title:t.name||t.destination||'Saved trip',date:t.date||t.updatedAt,location:t.destination||'',days:t.days,notes:t.notes,source:'trip-planner',sourceId:t.id}))}
function paddleCandidates(){return read('ab-paddle-plans-v2',[]).map(t=>clean({type:typeMap(t.activity),title:t.title||'Water adventure',date:t.date||t.savedAt,location:t.launchPoint||'',distanceKm:t.distance,lat:t.launchLat,lon:t.launchLon,waterType:t.waterType,launchPoint:t.launchPoint,notes:t.routeNotes,source:'paddle',sourceId:t.id}))}
function journalCandidates(){return read('adventure-builder-journal-v3',[]).filter(x=>x.entryStatus!=='draft').map(j=>{let d=0;const raw=j.stats?.distance;if(raw!=null){const m=String(raw).match(/[\d.]+/);if(m)d=num(m[0])}return clean({type:typeMap(j.category),title:j.title||'Journal memory',date:j.visitedDate||j.updatedAt,location:j.location,distanceKm:d,photos:(j.media||[]).filter(m=>String(m.type||'').startsWith('image/')).length,newPlace:false,notes:j.memories?.best||j.text,lat:j.destinationLat,lon:j.destinationLon,source:'journal',sourceId:j.id})})}
function imports(){return [...trailCandidates(),...tripCandidates(),...paddleCandidates(),...journalCandidates()].filter(x=>!already(x.source,x.sourceId)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
function importOne(source,sourceId){const item=imports().find(x=>x.source===source&&x.sourceId===sourceId);return item?add(item):null}
function stats(){return state.adventures.reduce((s,a)=>{s.count++;s.distance+=num(a.distanceKm);s.photos+=num(a.photos);if(a.newPlace)s.places++;if(a.lat&&a.lon)s.mapped++;return s},{count:0,distance:0,photos:0,places:0,mapped:0})}
function milestones(){const s=stats(),types=new Set(state.adventures.map(x=>x.type));return[
 {icon:'🧭',name:'First Adventure',done:s.count>=1,copy:s.count?'Recorded':'Record your first adventure'},
 {icon:'✨',name:'New Explorer',done:s.places>=3,copy:`${s.places}/3 new places`},
 {icon:'🥾',name:'Trail Regular',done:state.adventures.filter(x=>x.type==='hike').length>=5,copy:`${state.adventures.filter(x=>x.type==='hike').length}/5 walks`},
 {icon:'🌍',name:'Mix It Up',done:types.size>=4,copy:`${types.size}/4 activity types`},
 {icon:'📍',name:'Map Maker',done:s.mapped>=5,copy:`${s.mapped}/5 mapped adventures`},
 {icon:'🏁',name:'100 km Club',done:s.distance>=100,copy:`${Math.round(s.distance)}/100 km recorded`}
]}
window.AdventureHubStore={all,add,remove,imports,importOne,stats,milestones,clean,typeMap,_read:read};
})();

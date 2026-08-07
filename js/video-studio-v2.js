
(() => {
'use strict';
const root=document.querySelector('.ab-video-studio'); if(!root) return;
const file=document.getElementById('ab-video-file'), video=document.getElementById('ab-video-preview'), empty=document.getElementById('ab-video-empty');
const timeline=document.getElementById('ab-video-timeline'), status=document.getElementById('ab-video-status'), time=document.getElementById('ab-video-time');
const start=document.getElementById('ab-video-start'), end=document.getElementById('ab-video-end'), speed=document.getElementById('ab-video-speed'), volume=document.getElementById('ab-video-volume');
const title=document.getElementById('ab-video-title'), titleOverlay=document.getElementById('ab-video-overlay-title'), frame=document.getElementById('ab-video-frame');
const routeCard=document.getElementById('ab-video-route-card'), stamp=document.getElementById('ab-video-stamp'), chapters=document.getElementById('ab-video-chapters');
let clips=[], selected='', previewSequence=false, sequenceIndex=0;

function msg(s){status.textContent=s;}
function clock(sec){sec=Math.max(0,Number(sec)||0);const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,'0')}`;}
function selectedClip(){return clips.find(c=>c.id===selected);}
function duration(c){return Math.max(0,(c.end??c.duration)-(c.start??0))/(c.speed||1);}
function readDuration(url){return new Promise(res=>{const p=document.createElement('video');p.preload='metadata';p.onloadedmetadata=()=>res(Number.isFinite(p.duration)?p.duration:1);p.onerror=()=>res(1);p.src=url;});}
async function addFiles(list){
  for(const f of list){
    if(!f.type.startsWith('video/')) continue;
    const url=URL.createObjectURL(f),d=await readDuration(url);
    clips.push({id:`abv-${Date.now()}-${Math.random().toString(16).slice(2)}`,name:f.name,url,duration:d,start:0,end:d,speed:1,volume:1,style:'original'});
  }
  if(!selected&&clips[0]) selected=clips[0].id;
  if(selected) select(selected); renderTimeline(); updateChapters(); msg(`${clips.length} video clip${clips.length===1?'':'s'} ready. Select a clip to edit.`);
}
function select(id){
  selected=id; const c=selectedClip(); if(!c)return;
  video.src=c.url; video.playbackRate=c.speed; video.volume=c.volume; video.hidden=false; empty.hidden=true;
  start.max=c.duration;end.max=c.duration;start.value=c.start;end.value=c.end;speed.value=String(c.speed);volume.value=Math.round(c.volume*100);
  applyStyle(c.style); renderTimeline();
}
function renderTimeline(){
  const total=clips.reduce((a,c)=>a+duration(c),0);
  document.getElementById('ab-video-summary').textContent=clips.length?`${clips.length} clips · ${clock(total)} edited`:'No clips added';
  timeline.innerHTML=clips.length?clips.map((c,i)=>`<article class="ab-video-clip${c.id===selected?' is-selected':''}" data-video-select="${c.id}"><strong>${i+1}. ${escapeHtml(c.name)}</strong><small>${clock(c.start)}–${clock(c.end)} · ${c.speed}× · ${Math.round(c.volume*100)}% sound</small><div class="ab-video-clip-actions"><button class="ab-video-btn" data-video-left="${c.id}" type="button">←</button><button class="ab-video-btn" data-video-right="${c.id}" type="button">→</button><button class="ab-video-btn" data-video-remove="${c.id}" type="button">Delete</button></div></article>`).join(''):'<p class="ab-video-status">Add video clips to create your adventure film.</p>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function move(id,dir){const i=clips.findIndex(c=>c.id===id),j=i+dir;if(i<0||j<0||j>=clips.length)return;[clips[i],clips[j]]=[clips[j],clips[i]];renderTimeline();updateChapters();}
function remove(id){const c=clips.find(x=>x.id===id);if(c)URL.revokeObjectURL(c.url);clips=clips.filter(x=>x.id!==id);if(selected===id)selected=clips[0]?.id||'';if(selected)select(selected);else{video.removeAttribute('src');video.hidden=true;empty.hidden=false;renderTimeline();}updateChapters();}
function split(){
 const c=selectedClip();if(!c){msg('Select a clip first.');return;}const p=video.currentTime;
 if(p<=c.start+.2||p>=c.end-.2){msg('Move the playhead inside the selected trim range, then press Split.');return;}
 const copy={...c,id:`abv-${Date.now()}-${Math.random().toString(16).slice(2)}`,start:p};c.end=p;const i=clips.indexOf(c);clips.splice(i+1,0,copy);renderTimeline();updateChapters();msg('Clip split into two parts.');
}
function duplicate(){const c=selectedClip();if(!c){msg('Select a clip first.');return;}const copy={...c,id:`abv-${Date.now()}-${Math.random().toString(16).slice(2)}`};clips.splice(clips.indexOf(c)+1,0,copy);renderTimeline();updateChapters();msg('Clip duplicated.');}
function applyStyle(name){
 const map={original:'',adventure:'saturate(1.22) contrast(1.08)',cinematic:'saturate(.82) contrast(1.18)',sunset:'saturate(1.28) sepia(.16) contrast(1.05)',forest:'saturate(1.12) hue-rotate(-7deg) contrast(1.08)',bw:'grayscale(1) contrast(1.12)',memory:'sepia(.22) saturate(.88)'};
 video.style.filter=map[name]||'';
}
function updateChapters(){
 const labels=['Start Journey','Scenic Stop','Adventure Moment','Reached Destination','Back to Camp'];
 let t=0;chapters.innerHTML='';
 clips.slice(0,5).forEach((c,i)=>{const div=document.createElement('div');div.className='ab-video-chapter';div.innerHTML=`<b>${clock(t)}</b><span>${labels[i]||`Chapter ${i+1}`}</span>`;chapters.appendChild(div);t+=duration(c);});
 if(!clips.length)chapters.innerHTML='<p class="ab-video-status">Chapters appear as clips are added.</p>';
}
function playSequence(i=0){
 if(!previewSequence||!clips[i]){previewSequence=false;msg('Adventure preview finished.');return;}
 sequenceIndex=i;select(clips[i].id);const c=clips[i];
 const begin=()=>{video.currentTime=c.start;video.playbackRate=c.speed;video.volume=c.volume;video.play().catch(()=>{});};
 const advance=()=>{if(!previewSequence)return;if(video.currentTime>=c.end||video.ended){video.removeEventListener('timeupdate',advance);video.pause();playSequence(i+1);}};
 video.addEventListener('timeupdate',advance);if(video.readyState>=1)begin();else video.addEventListener('loadedmetadata',begin,{once:true});
}
function exportPlan(){
 if(!clips.length){msg('Add at least one clip before exporting a project plan.');return;}
 const data={format:document.getElementById('ab-video-format').value,title:title.value,routeOverlay:routeCard.classList.contains('is-on'),adventureStamp:stamp.classList.contains('is-on'),clips:clips.map(({name,duration,start,end,speed,volume,style})=>({name,duration,start,end,speed,volume,style})),created:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='adventure-builder-video-project.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);msg('Project plan exported. Final rendered-video export is a later encoding module.');
}
file?.addEventListener('change',()=>{if(file.files?.length)addFiles([...file.files]);file.value='';});
timeline?.addEventListener('click',e=>{const t=e.target.closest('[data-video-select]');const del=e.target.dataset.videoRemove,left=e.target.dataset.videoLeft,right=e.target.dataset.videoRight;if(del){e.stopPropagation();remove(del);return;}if(left){e.stopPropagation();move(left,-1);return;}if(right){e.stopPropagation();move(right,1);return;}if(t)select(t.dataset.videoSelect);});
start?.addEventListener('input',()=>{const c=selectedClip();if(!c)return;let v=Number(start.value);if(v>=c.end)v=Math.max(0,c.end-.25);c.start=v;start.value=v;video.currentTime=v;renderTimeline();updateChapters();});
end?.addEventListener('input',()=>{const c=selectedClip();if(!c)return;let v=Number(end.value);if(v<=c.start)v=Math.min(c.duration,c.start+.25);c.end=v;end.value=v;video.currentTime=v;renderTimeline();updateChapters();});
speed?.addEventListener('change',()=>{const c=selectedClip();if(!c)return;c.speed=Number(speed.value);video.playbackRate=c.speed;renderTimeline();updateChapters();});
volume?.addEventListener('input',()=>{const c=selectedClip();if(!c)return;c.volume=Number(volume.value)/100;video.volume=c.volume;renderTimeline();});
title?.addEventListener('input',()=>titleOverlay.textContent=title.value);
document.getElementById('ab-video-style')?.addEventListener('change',e=>{const c=selectedClip();if(c)c.style=e.target.value;applyStyle(e.target.value);});
document.getElementById('ab-video-format')?.addEventListener('change',e=>{frame.classList.toggle('is-portrait',e.target.value==='portrait');frame.classList.toggle('is-square',e.target.value==='square');});
document.getElementById('ab-video-play')?.addEventListener('click',()=>video.paused?video.play():video.pause());
document.getElementById('ab-video-back')?.addEventListener('click',()=>video.currentTime=Math.max(0,video.currentTime-5));
document.getElementById('ab-video-forward')?.addEventListener('click',()=>video.currentTime=Math.min(video.duration||0,video.currentTime+5));
document.getElementById('ab-video-split')?.addEventListener('click',split);
document.getElementById('ab-video-duplicate')?.addEventListener('click',duplicate);
document.getElementById('ab-video-mute')?.addEventListener('click',()=>{const c=selectedClip();if(!c)return;c.volume=c.volume?0:1;video.volume=c.volume;volume.value=Math.round(c.volume*100);renderTimeline();});
document.getElementById('ab-video-auto')?.addEventListener('click',()=>{if(!clips.length){msg('Add some clips first.');return;}previewSequence=true;playSequence(0);msg('Playing your automatic Adventure Movie preview…');});
document.getElementById('ab-video-route-toggle')?.addEventListener('click',e=>{routeCard.classList.toggle('is-on');e.currentTarget.classList.toggle('is-active',routeCard.classList.contains('is-on'));});
document.getElementById('ab-video-stamp-toggle')?.addEventListener('click',e=>{stamp.classList.toggle('is-on');e.currentTarget.classList.toggle('is-active',stamp.classList.contains('is-on'));});
document.getElementById('ab-video-export')?.addEventListener('click',exportPlan);
video?.addEventListener('timeupdate',()=>time.textContent=`${clock(video.currentTime)} / ${clock(video.duration||0)}`);
video?.addEventListener('ended',()=>{if(previewSequence)playSequence(sequenceIndex+1);});
updateChapters();renderTimeline();
})();

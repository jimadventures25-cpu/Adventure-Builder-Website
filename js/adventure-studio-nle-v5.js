(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clock=n=>{n=Number.isFinite(n)?n:0;return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function init(){
 const root=$('.ab-video-w61'); if(!root)return;
 const input=$('#ab-media-file'), grid=$('#ab-media-grid'), count=$('#ab-media-count'), status=$('#ab-video-status');
 const sourceV=$('#ab-source-video'),sourceI=$('#ab-source-image'),sourceE=$('#ab-source-empty'),sourceN=$('#ab-source-name');
 const programV=$('#ab-program-video'),programI=$('#ab-program-image'),programE=$('#ab-program-empty'),multi=$('#ab-video-multitracks');
 let media=[], timeline=[], texts=[], selectedMedia=null,selectedClip=null,filter='all',zoom=100,history=[],future=[],markIn=0,markOut=null;
 const say=t=>{if(status)status.textContent=t};
 const snapshot=()=>{history.push(JSON.stringify({timeline,texts}));if(history.length>60)history.shift();future=[]};
 const asset=id=>media.find(x=>x.id===id), clip=()=>timeline.find(x=>x.id===selectedClip);
 function revoke(){media.forEach(m=>URL.revokeObjectURL(m.url))}
 window.addEventListener('beforeunload',revoke,{once:true});
 function renderMedia(){
  count.textContent=`${media.length} item${media.length===1?'':'s'}`;
  const list=media.filter(m=>filter==='all'||m.kind===filter);
  if(!list.length){grid.innerHTML='<p class="ab-media-empty">Import photos and videos. They stay in the Media Bin until you add them to the timeline.</p>';return}
  grid.innerHTML=list.map(m=>`<button class="ab-media-card${m.id===selectedMedia?' is-selected':''}" data-media-id="${m.id}" type="button"><span class="ab-media-type">${m.kind==='video'?'VIDEO':'PHOTO'}</span><span class="ab-media-thumb">${m.kind==='image'?`<img src="${m.url}" alt="">`:`<video src="${m.url}" muted preload="metadata"></video>`}</span><span class="ab-media-meta"><strong>${esc(m.name)}</strong><span>${m.kind==='video'?clock(m.duration):'Still image'}</span></span><span class="ab-media-add" data-add-media="${m.id}" title="Append to timeline">＋</span></button>`).join('');
 }
 function showSource(id){
  const m=asset(id);if(!m)return;selectedMedia=id;sourceN.textContent=m.name;sourceE.hidden=true;sourceV.pause();sourceV.hidden=true;sourceI.hidden=true;markIn=0;markOut=m.kind==='video'?m.duration:5;
  if(m.kind==='video'){sourceV.src=m.url;sourceV.hidden=false;sourceV.currentTime=0}else{sourceI.src=m.url;sourceI.hidden=false}
  renderMedia();updateSourceTime();
 }
 function updateSourceTime(){const m=asset(selectedMedia);$('#ab-source-time').textContent=m?.kind==='video'?`${clock(sourceV.currentTime)} / ${clock(m.duration)}`:m?'Photo · 5s':'0:00 / 0:00'}
 function addFiles(files){
  const valid=files.filter(f=>f.type.startsWith('video/')||f.type.startsWith('image/')); if(!valid.length)return say('Choose photo or video files.');
  valid.forEach(f=>{const m={id:'m'+crypto.randomUUID(),name:f.name,kind:f.type.startsWith('video/')?'video':'image',type:f.type,url:URL.createObjectURL(f),duration:5};media.push(m);if(m.kind==='video'){const v=document.createElement('video');v.preload='metadata';v.src=m.url;v.onloadedmetadata=()=>{m.duration=Number.isFinite(v.duration)?v.duration:5;renderMedia();if(selectedMedia===m.id){markOut=m.duration;updateSourceTime()}}}});
  renderMedia();showSource(valid.length?media[media.length-valid.length].id:media[0]?.id);say(`${valid.length} media item${valid.length===1?'':'s'} added to Project Media.`)
 }
 function addToTimeline(mode='append',id=selectedMedia){
  const m=asset(id);if(!m)return say('Select media from Project Media first.'); snapshot();
  const target=$('#ab-w61-track').value;const c={id:'c'+crypto.randomUUID(),mediaId:m.id,kind:m.kind,track:mode==='overlay'?'overlay':target,start:m.kind==='video'?markIn:0,end:m.kind==='video'?(markOut??m.duration):5,speed:1,volume:1,transition:$('#ab-w61-transition').value,effects:{brightness:100,contrast:100,saturation:100}};
  if(mode==='replace'&&selectedClip){const i=timeline.findIndex(x=>x.id===selectedClip);if(i>=0)timeline.splice(i,1,c);else timeline.push(c)}else if(mode==='overwrite'&&selectedClip){const i=timeline.findIndex(x=>x.id===selectedClip);timeline.splice(Math.max(0,i),1,c)}else if(mode==='insert'&&selectedClip){const i=timeline.findIndex(x=>x.id===selectedClip);timeline.splice(Math.max(0,i),0,c)}else timeline.push(c);
  selectedClip=c.id;renderTimeline();showProgram(c);say(`${m.name} ${mode==='append'?'added at end':mode+'d'} on ${c.track}.`)
 }
 const cdur=c=>Math.max(.1,(c.end-c.start)/(c.speed||1));
 function renderTimeline(){
  const tracks=[['video-1','🎬 Video 1'],['video-2','🎥 Video 2'],['overlay','🖼 Overlay']];
  multi.innerHTML=tracks.map(([key,label])=>`<div class="ab-video-mtrack"><div class="ab-video-mtrack-label">${label}</div><div class="ab-video-mtrack-lane">${timeline.filter(c=>c.track===key).map(c=>{const m=asset(c.mediaId);return `<button class="ab-video-mclip${c.id===selectedClip?' is-selected':''}" data-clip-id="${c.id}" data-kind="${c.kind}" style="width:${Math.max(72,cdur(c)*12*zoom/100)}px" type="button">${m?.kind==='image'?`<img src="${m.url}" alt="">`:''}<span>${esc(m?.name||'Media')}</span><small>${clock(cdur(c))}</small></button>`}).join('')}</div></div>`).join('')+`<div class="ab-video-mtrack"><div class="ab-video-mtrack-label">🔤 Text</div><div class="ab-video-mtrack-lane">${texts.map(t=>`<span class="ab-video-text-block">${esc(t.value)}</span>`).join('')}</div></div>`;
  $('#ab-video-summary').textContent=timeline.length?`${timeline.length} timeline item${timeline.length===1?'':'s'}`:'No timeline media';
 }
 function showProgram(c){
  const m=asset(c.mediaId);if(!m)return;programV.pause();programV.hidden=true;programI.hidden=true;programE.hidden=true;
  if(m.kind==='video'){programV.src=m.url;programV.hidden=false;programV.playbackRate=c.speed||1;programV.volume=c.volume??1;programV.currentTime=c.start||0;applyEffects(c,programV)}else{programI.src=m.url;programI.hidden=false;applyEffects(c,programI)}updateProgramTime();
 }
 function applyEffects(c,el){const e=c.effects||{};el.style.filter=`brightness(${e.brightness||100}%) contrast(${e.contrast||100}%) saturate(${e.saturation||100}%)`}
 function updateProgramTime(){const c=clip();$('#ab-program-time').textContent=c?.kind==='video'?`${clock(programV.currentTime)} / ${clock(c.end)}`:c?'Photo · '+clock(cdur(c)):'0:00 / 0:00'}
 function selectClip(id){selectedClip=id;const c=clip();if(!c)return;showProgram(c);$('#ab-w61-track').value=c.track;$('#ab-w61-speed').value=c.speed;$('#ab-w61-volume').value=Math.round(c.volume*100);$('#ab-w61-transition').value=c.transition;for(const k of ['brightness','contrast','saturation'])$('#ab-w61-'+k).value=c.effects[k];renderTimeline()}
 function undo(){if(!history.length)return;snapshotFuture();const x=JSON.parse(history.pop());timeline=x.timeline;texts=x.texts;selectedClip=null;renderTimeline();programV.hidden=true;programI.hidden=true;programE.hidden=false}
 function snapshotFuture(){future.push(JSON.stringify({timeline,texts}))}
 function redo(){if(!future.length)return;history.push(JSON.stringify({timeline,texts}));const x=JSON.parse(future.pop());timeline=x.timeline;texts=x.texts;renderTimeline()}
 input.addEventListener('change',()=>{addFiles([...input.files]);input.value='' });
 grid.addEventListener('click',e=>{const add=e.target.closest('[data-add-media]');const card=e.target.closest('[data-media-id]');if(add){e.preventDefault();e.stopPropagation();showSource(add.dataset.addMedia);addToTimeline('append',add.dataset.addMedia)}else if(card)showSource(card.dataset.mediaId)});
 $$('.ab-media-filter button').forEach(b=>b.addEventListener('click',()=>{$$('.ab-media-filter button').forEach(x=>x.classList.toggle('is-active',x===b));filter=b.dataset.mediaFilter;renderMedia()}));
 $$('[data-insert-mode]').forEach(b=>b.addEventListener('click',()=>addToTimeline(b.dataset.insertMode)));
 multi.addEventListener('click',e=>{const b=e.target.closest('[data-clip-id]');if(b)selectClip(b.dataset.clipId)});
 $('#ab-source-play').addEventListener('click',()=>{const m=asset(selectedMedia);if(m?.kind!=='video')return;sourceV.paused?sourceV.play():sourceV.pause()});sourceV.addEventListener('timeupdate',updateSourceTime);
 $('#ab-source-mark-in').addEventListener('click',()=>{if(asset(selectedMedia)?.kind==='video'){markIn=Math.min(sourceV.currentTime,(markOut??Infinity)-.1);say(`In point ${clock(markIn)}`)}});$('#ab-source-mark-out').addEventListener('click',()=>{const m=asset(selectedMedia);if(m?.kind==='video'){markOut=Math.max(sourceV.currentTime,markIn+.1);say(`Out point ${clock(markOut)}`)}});
 $('#ab-program-play').addEventListener('click',()=>{if(clip()?.kind==='video')programV.paused?programV.play():programV.pause()});$('#ab-program-back').addEventListener('click',()=>programV.currentTime=Math.max(clip()?.start||0,programV.currentTime-5));$('#ab-program-forward').addEventListener('click',()=>programV.currentTime=Math.min(clip()?.end||programV.duration||0,programV.currentTime+5));programV.addEventListener('timeupdate',()=>{const c=clip();if(c&&programV.currentTime>=c.end)programV.pause();updateProgramTime()});
 $('#ab-viewer-toggle').addEventListener('click',e=>{const dual=$('#ab-dual-viewers');dual.classList.toggle('is-single');e.currentTarget.textContent=dual.classList.contains('is-single')?'Dual Viewer':'Single Viewer'});
 $('#ab-w61-speed').addEventListener('change',e=>{const c=clip();if(c){snapshot();c.speed=+e.target.value;programV.playbackRate=c.speed;renderTimeline()}});$('#ab-w61-volume').addEventListener('input',e=>{const c=clip();if(c){c.volume=+e.target.value/100;programV.volume=c.volume}});$('#ab-w61-track').addEventListener('change',e=>{const c=clip();if(c){snapshot();c.track=e.target.value;renderTimeline()}});$('#ab-w61-transition').addEventListener('change',e=>{const c=clip();if(c){snapshot();c.transition=e.target.value}});
 for(const k of ['brightness','contrast','saturation'])$('#ab-w61-'+k).addEventListener('input',e=>{const c=clip();if(c){c.effects[k]=+e.target.value;applyEffects(c,c.kind==='video'?programV:programI)}});
 $('#ab-w61-duplicate').addEventListener('click',()=>{const c=clip();if(!c)return;snapshot();const n={...c,id:'c'+crypto.randomUUID(),effects:{...c.effects}};timeline.splice(timeline.indexOf(c)+1,0,n);selectedClip=n.id;renderTimeline()});
 $('#ab-w61-split').addEventListener('click',()=>{const c=clip();if(!c||c.kind!=='video')return say('Select a video clip to split.');const at=programV.currentTime;if(at<=c.start+.1||at>=c.end-.1)return say('Move the programme playhead inside the clip.');snapshot();const n={...c,id:'c'+crypto.randomUUID(),start:at,effects:{...c.effects}};c.end=at;timeline.splice(timeline.indexOf(c)+1,0,n);renderTimeline()});
 $('#ab-w61-add-text').addEventListener('click',()=>{const i=$('#ab-w61-text'),v=i.value.trim();if(!v)return;snapshot();texts.push({id:'t'+crypto.randomUUID(),value:v});i.value='';renderTimeline()});$('#ab-w61-zoom').addEventListener('input',e=>{zoom=+e.target.value;renderTimeline()});$('#ab-w61-fit').addEventListener('click',()=>{$('#ab-w61-zoom').value=100;zoom=100;renderTimeline()});$('#ab-w61-undo').addEventListener('click',undo);$('#ab-w61-redo').addEventListener('click',redo);
 $('#ab-video-export').addEventListener('click',()=>{const project={version:'W61',media:media.map(({url,...m})=>m),timeline,texts,created:new Date().toISOString()};const u=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='adventure-studio-project-w61.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
 document.addEventListener('dragover',e=>{if(document.body.classList.contains('ab-studio-editor-open'))e.preventDefault()});document.addEventListener('drop',e=>{if(!document.body.classList.contains('ab-studio-editor-open'))return;const fs=[...(e.dataTransfer?.files||[])];if(fs.some(f=>f.type.startsWith('video/')||f.type.startsWith('image/'))){e.preventDefault();addFiles(fs)}});
 renderMedia();renderTimeline();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

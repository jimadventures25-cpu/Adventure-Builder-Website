
(() => {
'use strict';
const roots=[...document.querySelectorAll('[data-ab-gallery]')]; if(!roots.length)return;

const MEDIA_KEY='ab-gallery-media-v1';
const REPORT_KEY='ab-gallery-reports-v1';
const MOD_KEY='ab-gallery-moderation-v1';
const TRUST_KEY='ab-gallery-trust-v1';
const STORY_KEY='ab-gallery-stories-v1';

const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function bindTabs(root){
  root.querySelectorAll('[data-ag-tab]').forEach(b=>b.addEventListener('click',()=>{
    root.querySelectorAll('[data-ag-tab]').forEach(x=>x.classList.toggle('is-active',x===b));
    root.querySelectorAll('[data-ag-view]').forEach(v=>v.hidden=v.dataset.agView!==b.dataset.agTab);
  }));
}
function currentPrivacy(root){return root.querySelector('[data-ag-privacy].is-active')?.dataset.agPrivacy||'private'}
function bindPrivacy(root){
  root.querySelectorAll('[data-ag-privacy]').forEach(b=>b.addEventListener('click',()=>{
    root.querySelectorAll('[data-ag-privacy]').forEach(x=>x.classList.toggle('is-active',x===b));
  }));
}
function safetyScan(d){
  const flags=[];
  if(d.locationMode==='exact') flags.push('Exact location will be public');
  if(d.child==='yes') flags.push('Child/family privacy review needed');
  if(d.plate==='yes') flags.push('Vehicle plate may be visible');
  if(d.address==='yes') flags.push('Address/house number may be visible');
  if(d.wildlife==='yes') flags.push('Sensitive wildlife location');
  if(d.hazard==='yes') flags.push('Potential hazardous location');
  return flags;
}
function renderGallery(root){
  const box=root.querySelector('[data-ag-gallery-grid]'); if(!box)return;
  const items=read(MEDIA_KEY,[]);
  box.innerHTML=items.length?items.slice().reverse().map(x=>{
    const privacy=x.privacy==='private'?'🔒 Private':x.privacy==='friends'?'👥 Friends':'🌍 Community';
    const flags=x.flags||[];
    return `<article class="ag-item"><div class="ag-thumb">${x.type.startsWith('video')?'🎥':'📸'}</div><div class="ag-item-body"><small>${esc(x.album||'Gallery')}</small><h4>${esc(x.title||x.name||'Adventure memory')}</h4><div class="ag-meta"><span class="ag-tag safe">${privacy}</span><span class="ag-tag">${esc(x.locationMode||'hidden location')}</span>${flags.map(f=>`<span class="ag-tag warn">⚠ ${esc(f)}</span>`).join('')}</div><div class="ag-actions"><button class="ag-btn" data-ag-report="${x.id}" type="button">Report</button><button class="ag-btn" data-ag-story="${x.id}" type="button">Add to Story</button></div></div></article>`;
  }).join(''):'<div class="ag-safety">No gallery items yet. Add a photo or video to start your Adventure Memories.</div>';
}
function bindUpload(root){
  const input=root.querySelector('[data-ag-file]'),form=root.querySelector('[data-ag-upload-form]');
  input?.addEventListener('change',()=>root.querySelector('[data-ag-file-count]').textContent=`${input.files?.length||0} file(s) selected`);
  form?.addEventListener('submit',e=>{
    e.preventDefault();
    const files=[...(input?.files||[])];
    if(!files.length){root.querySelector('[data-ag-upload-status]').textContent='Choose at least one photo or video.';return}
    const fd=new FormData(form),base=Object.fromEntries(fd.entries());
    base.privacy=currentPrivacy(root);
    const flags=safetyScan(base);
    const media=read(MEDIA_KEY,[]);
    files.forEach(f=>media.push({
      id:`agm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name:f.name,type:f.type||'image/*',title:base.title||f.name,album:base.album||'Adventure Memories',
      privacy:base.privacy,locationMode:base.locationMode||'hidden',
      flags,createdAt:new Date().toISOString(),
      note:'Prototype stores metadata only; media bytes remain on device in this stage.'
    }));
    write(MEDIA_KEY,media);
    root.querySelector('[data-ag-upload-status]').textContent=flags.length?`Saved with ${flags.length} safety warning(s). Review before community publishing.`:'Saved to Gallery metadata on this device.';
    form.reset(); if(input)input.value='';root.querySelector('[data-ag-file-count]').textContent='No files selected';
    renderGallery(root);
  });
}
function renderReports(root){
  const box=root.querySelector('[data-ag-report-list]');if(!box)return;
  const arr=read(REPORT_KEY,[]);
  box.innerHTML=arr.length?arr.slice().reverse().map(r=>`<article class="ag-mod"><div class="ag-mod-top"><div><small>${esc(r.reason)}</small><h4>${esc(r.target||'Gallery item')}</h4></div><span class="ag-state">${esc(r.status)}</span></div><small>${esc(r.notes||'')}</small></article>`).join(''):'<div class="ag-safety">No reports saved on this device.</div>';
}
function renderModeration(root){
  const box=root.querySelector('[data-ag-moderation-list]');if(!box)return;
  const media=read(MEDIA_KEY,[]);
  box.innerHTML=media.length?media.slice().reverse().map(m=>`<article class="ag-mod"><div class="ag-mod-top"><div><small>${esc(m.type)}</small><h4>${esc(m.title)}</h4></div><span class="ag-state">${m.flags?.length?'needs review':'clear'}</span></div><div class="ag-meta">${(m.flags||[]).map(f=>`<span class="ag-tag warn">${esc(f)}</span>`).join('')||'<span class="ag-tag safe">No manual safety flags</span>'}</div><div class="ag-actions"><button class="ag-btn" data-ag-approve="${m.id}" type="button">Approve</button><button class="ag-btn" data-ag-reject="${m.id}" type="button">Reject</button></div></article>`).join(''):'<div class="ag-safety">No media waiting for review.</div>';
}
function bindReports(root){
  root.addEventListener('click',e=>{
    const report=e.target.dataset.agReport;
    if(report){
      const media=read(MEDIA_KEY,[]),m=media.find(x=>x.id===report),arr=read(REPORT_KEY,[]);
      arr.push({id:`agr-${Date.now()}`,target:m?.title||report,reason:'User report',notes:'Prototype report created from Gallery.',status:'pending review',createdAt:new Date().toISOString()});
      write(REPORT_KEY,arr);renderReports(root);
    }
    const approve=e.target.dataset.agApprove,reject=e.target.dataset.agReject;
    if(approve||reject){
      const id=approve||reject,arr=read(MOD_KEY,[]);arr.push({id,target:id,status:approve?'approved':'rejected',createdAt:new Date().toISOString()});write(MOD_KEY,arr);
      e.target.closest('.ag-mod')?.querySelector('.ag-state')?.classList.toggle('approved',!!approve);
      e.target.closest('.ag-mod')?.querySelector('.ag-state')?.classList.toggle('rejected',!!reject);
      e.target.closest('.ag-mod')?.querySelector('.ag-state') && (e.target.closest('.ag-mod').querySelector('.ag-state').textContent=approve?'approved':'rejected');
    }
    const story=e.target.dataset.agStory;
    if(story){
      const media=read(MEDIA_KEY,[]),m=media.find(x=>x.id===story),arr=read(STORY_KEY,[]);
      if(m&&!arr.some(x=>x.id===m.id))arr.push(m);write(STORY_KEY,arr);renderStories(root);
    }
  });
  renderReports(root);renderModeration(root);
}
function bindSafetyCheck(root){
  root.querySelector('[data-ag-safety-run]')?.addEventListener('click',()=>{
    const checks=[...root.querySelectorAll('[data-ag-safety-check]')].filter(x=>x.checked).map(x=>x.value);
    const out=root.querySelector('[data-ag-safety-output]');
    out.innerHTML=checks.length?`<div class="ag-warning"><strong>Review before publishing:</strong><br>${checks.map(x=>'• '+esc(x)).join('<br>')}</div>`:'<div class="ag-safety"><strong>No manual safety concerns selected.</strong><br>This does not replace automated image analysis or location-policy checks, which are future integrations.</div>';
  });
}
function bindTrust(root){
  root.querySelector('[data-ag-trust-save]')?.addEventListener('click',()=>{
    const role=root.querySelector('[data-ag-trust-role]').value;
    write(TRUST_KEY,{role,verified:false,savedAt:new Date().toISOString()});
    root.querySelector('[data-ag-trust-status]').textContent=`${role} selected. Verification remains pending until a real account/admin process is connected.`;
  });
}
function renderStories(root){
  const box=root.querySelector('[data-ag-story-list]');if(!box)return;
  const arr=read(STORY_KEY,[]);
  box.innerHTML=arr.length?arr.map(x=>`<article class="ag-mod"><small>${esc(x.album||'Adventure')}</small><h4>${esc(x.title)}</h4><span class="ag-state approved">story item</span></article>`).join(''):'<div class="ag-safety">No gallery memories linked to a story yet.</div>';
}
function bindMap(root){
  root.querySelector('[data-ag-map-filter]')?.addEventListener('change',e=>{root.querySelector('[data-ag-map-status]').textContent=`Map filter: ${e.target.value}. This stage uses a privacy-safe illustrative map; live public memory pins require backend publishing and moderation.`});
}
roots.forEach(root=>{bindTabs(root);bindPrivacy(root);bindUpload(root);bindReports(root);bindSafetyCheck(root);bindTrust(root);bindMap(root);renderGallery(root);renderStories(root)});
})();

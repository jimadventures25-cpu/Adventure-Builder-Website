
(() => {
'use strict';
const root=document.querySelector('.ab-photo-studio'); if(!root) return;
const canvas=document.getElementById('ab-photo-canvas'),ctx=canvas.getContext('2d',{alpha:false});
const input=document.getElementById('ab-photo-file'),empty=document.getElementById('ab-photo-empty'),status=document.getElementById('ab-photo-status');
const out={brightness:document.querySelector('[data-photo-output="brightness"]'),contrast:document.querySelector('[data-photo-output="contrast"]'),saturate:document.querySelector('[data-photo-output="saturate"]'),warmth:document.querySelector('[data-photo-output="warmth"]'),blur:document.querySelector('[data-photo-output="blur"]')};
const controls=[...document.querySelectorAll('[data-photo-adjust]')];
let image=null, objectUrl='', rotation=0, flipX=1, flipY=1, crop='original', originalName='adventure-photo';
const state={brightness:100,contrast:100,saturate:100,warmth:0,blur:0,filter:'none',text:'',sticker:'',stamp:false};

function setStatus(msg){if(status) status.textContent=msg;}
function fitSize(w,h,max=2200){const s=Math.min(1,max/Math.max(w,h));return [Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s))];}
function cropRect(w,h){
  let ratio=0;
  if(crop==='square') ratio=1;
  if(crop==='landscape') ratio=16/9;
  if(crop==='portrait') ratio=9/16;
  if(!ratio) return {sx:0,sy:0,sw:w,sh:h};
  const current=w/h;
  if(current>ratio){const sw=h*ratio;return {sx:(w-sw)/2,sy:0,sw,sh:h};}
  const sh=w/ratio;return {sx:0,sy:(h-sh)/2,sw:w,sh};
}
function filterString(){
  let sep=state.warmth;
  if(state.filter==='coastal') return `brightness(${state.brightness+5}%) contrast(${state.contrast+4}%) saturate(${state.saturate+18}%) sepia(${sep}%) blur(${state.blur}px)`;
  if(state.filter==='sunset') return `brightness(${state.brightness+2}%) contrast(${state.contrast+5}%) saturate(${state.saturate+22}%) sepia(${Math.min(45,sep+18)}%) blur(${state.blur}px)`;
  if(state.filter==='forest') return `brightness(${state.brightness}%) contrast(${state.contrast+8}%) saturate(${state.saturate+12}%) hue-rotate(-7deg) sepia(${sep}%) blur(${state.blur}px)`;
  if(state.filter==='bw') return `brightness(${state.brightness}%) contrast(${state.contrast+12}%) saturate(0%) sepia(0%) blur(${state.blur}px)`;
  if(state.filter==='vintage') return `brightness(${state.brightness}%) contrast(${state.contrast-4}%) saturate(${Math.max(0,state.saturate-18)}%) sepia(${Math.min(55,sep+28)}%) blur(${state.blur}px)`;
  return `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturate}%) sepia(${sep}%) blur(${state.blur}px)`;
}
function drawOverlay(w,h){
  ctx.save();ctx.filter='none';
  const pad=Math.max(18,Math.round(w*.025));
  if(state.text){
    const fs=Math.max(24,Math.round(w*.045));ctx.font=`800 ${fs}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.lineWidth=Math.max(4,fs*.12);ctx.strokeStyle='rgba(0,0,0,.58)';ctx.strokeText(state.text,w/2,h-pad);
    ctx.fillStyle='#fff';ctx.fillText(state.text,w/2,h-pad);
  }
  if(state.sticker){const fs=Math.max(42,Math.round(w*.09));ctx.font=`${fs}px sans-serif`;ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(state.sticker,w-pad,pad);}
  if(state.stamp){
    const boxW=Math.min(w*.48,520),boxH=Math.max(70,h*.10),x=pad,y=h-boxH-pad;
    ctx.fillStyle='rgba(12,20,22,.78)';ctx.fillRect(x,y,boxW,boxH);
    ctx.strokeStyle='#f08a35';ctx.lineWidth=Math.max(3,w*.003);ctx.strokeRect(x,y,boxW,boxH);
    ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='top';ctx.font=`800 ${Math.max(18,w*.025)}px system-ui,sans-serif`;ctx.fillText('ADVENTURE BUILDER',x+18,y+13);
    ctx.fillStyle='#ffd0a5';ctx.font=`600 ${Math.max(14,w*.017)}px system-ui,sans-serif`;ctx.fillText(new Date().toLocaleDateString('en-GB'),x+18,y+Math.max(42,boxH*.55));
  }
  ctx.restore();
}
function render(){
  if(!image) return;
  const r=cropRect(image.naturalWidth,image.naturalHeight);
  let [w,h]=fitSize(r.sw,r.sh);
  const turns=((rotation%360)+360)%360,swap=turns===90||turns===270;
  canvas.width=swap?h:w;canvas.height=swap?w:h;
  ctx.save();ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.scale(flipX,flipY);ctx.filter=filterString();
  ctx.drawImage(image,r.sx,r.sy,r.sw,r.sh,-w/2,-h/2,w,h);ctx.restore();
  drawOverlay(canvas.width,canvas.height);
}
function loadFile(file){
  if(!file||!file.type.startsWith('image/')){setStatus('Choose a JPG, PNG or WebP photograph.');return;}
  if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl=URL.createObjectURL(file); originalName=(file.name||'adventure-photo').replace(/\.[^.]+$/,'');
  const im=new Image(); im.onload=()=>{image=im;empty.hidden=true;reset(false);render();setStatus(`${file.name} loaded · edits stay on this device until you export.`);}; im.onerror=()=>setStatus('This image could not be opened.'); im.src=objectUrl;
}
function reset(doRender=true){
  Object.assign(state,{brightness:100,contrast:100,saturate:100,warmth:0,blur:0,filter:'none',text:'',sticker:'',stamp:false});rotation=0;flipX=1;flipY=1;crop='original';
  controls.forEach(c=>{const k=c.dataset.photoAdjust;c.value=({brightness:100,contrast:100,saturate:100,warmth:0,blur:0})[k]}); 
  Object.entries(out).forEach(([k,o])=>{if(o)o.value=(k==='blur'?'0 px':(k==='warmth'?'0%':'100%'));});
  const text=document.getElementById('ab-photo-text');if(text)text.value='';
  document.querySelectorAll('[data-photo-preset]').forEach(b=>b.classList.toggle('is-active',b.dataset.photoPreset==='none'));
  document.querySelectorAll('[data-photo-crop]').forEach(b=>b.classList.toggle('is-active',b.dataset.photoCrop==='original'));
  const stamp=document.getElementById('ab-photo-stamp');if(stamp)stamp.checked=false;
  if(doRender)render();
}
input?.addEventListener('change',()=>loadFile(input.files?.[0]));
controls.forEach(c=>c.addEventListener('input',()=>{const k=c.dataset.photoAdjust;state[k]=Number(c.value);if(out[k])out[k].value=k==='blur'?`${state[k]} px`:`${state[k]}%`;render();}));
document.querySelectorAll('[data-photo-preset]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.photoPreset;document.querySelectorAll('[data-photo-preset]').forEach(x=>x.classList.toggle('is-active',x===b));render();}));
document.querySelectorAll('[data-photo-crop]').forEach(b=>b.addEventListener('click',()=>{crop=b.dataset.photoCrop;document.querySelectorAll('[data-photo-crop]').forEach(x=>x.classList.toggle('is-active',x===b));render();}));
document.querySelector('[data-photo-rotate-left]')?.addEventListener('click',()=>{rotation-=90;render();});
document.querySelector('[data-photo-rotate-right]')?.addEventListener('click',()=>{rotation+=90;render();});
document.querySelector('[data-photo-flip-x]')?.addEventListener('click',()=>{flipX*=-1;render();});
document.querySelector('[data-photo-flip-y]')?.addEventListener('click',()=>{flipY*=-1;render();});
document.getElementById('ab-photo-text')?.addEventListener('input',e=>{state.text=e.target.value.trim();render();});
document.getElementById('ab-photo-sticker')?.addEventListener('change',e=>{state.sticker=e.target.value;render();});
document.getElementById('ab-photo-stamp')?.addEventListener('change',e=>{state.stamp=e.target.checked;render();});
document.getElementById('ab-photo-reset')?.addEventListener('click',()=>{reset();setStatus('Edits reset to the original photograph.');});
document.getElementById('ab-photo-before')?.addEventListener('pointerdown',()=>{if(!image)return;const old={...state};Object.assign(state,{brightness:100,contrast:100,saturate:100,warmth:0,blur:0,filter:'none',text:'',sticker:'',stamp:false});render();root.dataset.beforeState=JSON.stringify(old);});
function restoreBefore(){if(!root.dataset.beforeState)return;Object.assign(state,JSON.parse(root.dataset.beforeState));delete root.dataset.beforeState;render();}
document.getElementById('ab-photo-before')?.addEventListener('pointerup',restoreBefore);document.getElementById('ab-photo-before')?.addEventListener('pointerleave',restoreBefore);
document.getElementById('ab-photo-export')?.addEventListener('click',()=>{if(!image){setStatus('Add a photograph before exporting.');return;}render();canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`${originalName}-adventure-builder.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus('Edited photo exported as PNG.');},'image/png',.94);});
})();

(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let recorder=null,chunks=[],voiceUrl=null;
const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function layers(){
 const dock=$("#ab-video-layer-dock");if(!dock)return;
 const defs=[["Video 1","🎬"],["Video 2 / B-roll","🎞"],["Photo / overlay","▧"],["Text & captions","T"],["Music","♫"],["Voice-over","🎙"]];
 dock.innerHTML=defs.map(([n,i])=>`<div class="ab-w62-layer"><span>${i}</span><strong>${n}</strong><button type="button" data-layer-eye title="Show/hide">◉</button><button type="button" data-layer-lock title="Lock">◇</button></div>`).join("");
 dock.addEventListener("click",e=>{const row=e.target.closest(".ab-w62-layer");if(!row)return;if(e.target.matches("[data-layer-eye]"))row.classList.toggle("is-hidden");if(e.target.matches("[data-layer-lock]"))row.classList.toggle("is-locked")});
}
function captions(){
 const add=$("#ab-video-caption-add"),input=$("#ab-video-caption-text"),stage=$("#ab-video-overlay-stage");if(!add||!input||!stage)return;
 add.addEventListener("click",()=>{const t=input.value.trim();if(!t)return;let c=$(".ab-w62-caption-chip",stage);if(!c){c=document.createElement("div");c.className="ab-w62-caption-chip";stage.append(c)}c.textContent=t;$("#ab-video-caption-status").textContent="Caption added to the current edit. You can change the text and add it again.";});
 $("#ab-video-caption-auto")?.addEventListener("click",()=>{$("#ab-video-caption-status").textContent="AI transcript module is ready for Whisper integration. Manual captions remain available without downloading an AI model.";});
}
function typography(){
 const title=$("#ab-video-overlay-title"),stage=$("#ab-video-overlay-stage");if(!title)return;
 const apply=()=>{const font=$("#ab-video-font")?.value,size=$("#ab-video-font-size")?.value,col=$("#ab-video-font-color")?.value;[title,...$$(".ab-w62-caption-chip",stage)].forEach(n=>{if(font)n.style.fontFamily=font;if(size)n.style.fontSize=size+"px";if(col)n.style.color=col})};
 ["ab-video-font","ab-video-font-size","ab-video-font-color"].forEach(id=>$("#"+id)?.addEventListener("input",apply));
 $("#ab-video-font-bold")?.addEventListener("click",e=>{e.currentTarget.classList.toggle("is-on");title.style.fontWeight=e.currentTarget.classList.contains("is-on")?"900":"700"});
 $("#ab-video-font-shadow")?.addEventListener("click",e=>{e.currentTarget.classList.toggle("is-on");title.style.textShadow=e.currentTarget.classList.contains("is-on")?"0 3px 12px #000":"none"});
}
async function voice(){
 const rec=$("#ab-video-voice-record"),stop=$("#ab-video-voice-stop"),status=$("#ab-video-voice-status");if(!rec||!stop)return;
 rec.addEventListener("click",async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});if(voiceUrl)URL.revokeObjectURL(voiceUrl);voiceUrl=URL.createObjectURL(blob);status.innerHTML=`Voice-over recorded · ${(blob.size/1024).toFixed(0)} KB <audio controls src="${voiceUrl}"></audio>`;stream.getTracks().forEach(t=>t.stop())};recorder.start();rec.classList.add("is-recording");rec.disabled=true;stop.disabled=false;status.textContent="Recording voice-over…";}catch(err){status.textContent="Microphone permission is required to record a voice-over."}});
 stop.addEventListener("click",()=>{if(recorder&&recorder.state!=="inactive")recorder.stop();rec.classList.remove("is-recording");rec.disabled=false;stop.disabled=true});
}
function audio(){
 const input=$("#ab-video-audio-file"),status=$("#ab-video-voice-status");if(!input)return;
 input.addEventListener("change",()=>{const files=[...input.files];if(!files.length)return;const box=document.createElement("div");box.innerHTML=files.map(f=>`<div class="ab-w62-audio-item">♫ ${esc(f.name)} · ${(f.size/1048576).toFixed(1)} MB</div>`).join("");status.after(box)});
}
function autoEdit(){
 const btn=$("#ab-video-ai-build"),status=$("#ab-video-ai-status");if(!btn)return;
 btn.addEventListener("click",()=>{
   const clips=$$(".ab-video-mclip"),style=$("#ab-video-ai-style")?.value||"adventure",len=$("#ab-video-ai-length")?.value||"60";
   if(!clips.length){status.textContent="Add media to the timeline first. Auto Edit will use those clips to build the draft.";return}
   const count=Math.min(clips.length,Math.max(3,Math.round((len==="full"?90:+len)/8)));
   const chosen=clips.slice(0,count);chosen.forEach((c,i)=>{c.classList.toggle("is-selected",i<count)});
   status.innerHTML=`Editable ${esc(style)} first-cut plan created from ${count} clip${count===1?"":"s"}. Review the timeline, then trim, reorder or replace anything you want.<div class="ab-w62-ai-plan">${chosen.map((c,i)=>`<div>${i+1}. ${esc(c.textContent.trim()||"Selected clip")} · suggested ${i===0?"opening":i===chosen.length-1?"ending":"story beat"}</div>`).join("")}</div>`;
 });
}
function init(){layers();captions();typography();voice();audio();autoEdit()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
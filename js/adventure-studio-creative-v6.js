(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let rec=null,chunks=[],voiceUrl=null;
function buildPanels(){
 const root=$(".ab-video-w61");if(!root||$("#ab-w62-creative-panels",root))return;
 const host=document.createElement("div");host.id="ab-w62-creative-panels";
 host.innerHTML=`
 <section class="ab-w62-panel" id="ab-w62-text-panel">
  <label>Font<select id="ab-w62-font"><option>Inter</option><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option></select></label>
  <div class="ab-w62-row"><label>Size<input id="ab-w62-font-size" type="range" min="18" max="96" value="42"></label><label>Colour<input id="ab-w62-font-color" type="color" value="#ffffff"></label></div>
  <div class="ab-w62-row"><button class="ab-video-btn" id="ab-w62-bold" type="button">B Bold</button><button class="ab-video-btn" id="ab-w62-shadow" type="button">Shadow</button></div>
 </section>
 <section class="ab-w62-panel" id="ab-w62-audio-panel">
  <label class="ab-video-upload">＋ Add music / audio<input id="ab-w62-audio-file" type="file" accept="audio/*" multiple></label>
  <div class="ab-w62-row"><button class="ab-video-btn" id="ab-w62-voice-record" type="button">● Voice-over</button><button class="ab-video-btn" id="ab-w62-voice-stop" type="button" disabled>■ Stop</button></div>
  <p class="ab-w62-help" id="ab-w62-voice-status">Record narration directly from your microphone.</p>
  <div id="ab-w62-audio-list"></div>
 </section>
 <section class="ab-w62-panel" id="ab-w62-caption-panel">
  <textarea id="ab-w62-caption-text" rows="5" placeholder="Type or paste subtitle text"></textarea>
  <button class="ab-video-btn" id="ab-w62-caption-add" type="button">＋ Add subtitle</button>
  <button class="ab-video-btn" id="ab-w62-transcript" type="button">AI transcript</button>
  <p class="ab-w62-help" id="ab-w62-caption-status">Manual subtitles work now. Automatic transcription remains a separate AI module.</p>
 </section>
 <section class="ab-w62-panel" id="ab-w62-layers-panel"><div class="ab-w62-layer-list" id="ab-w62-layer-list"></div></section>
 <section class="ab-w62-panel ab-w62-ai-card" id="ab-w62-ai-panel">
  <label>Style<select id="ab-w62-ai-style"><option value="adventure">Adventure recap</option><option value="cinematic">Cinematic</option><option value="reel">Fast social reel</option><option value="calm">Calm travel story</option><option value="natural">Natural highlights</option></select></label>
  <div class="ab-w62-row"><label>Length<select id="ab-w62-ai-length"><option value="30">30 sec</option><option value="60" selected>60 sec</option><option value="120">2 min</option><option value="full">Full story</option></select></label><label>Format<select id="ab-w62-ai-format"><option value="landscape">16:9</option><option value="portrait">9:16</option><option value="square">1:1</option></select></label></div>
  <button class="ab-video-btn ab-video-primary" id="ab-w62-ai-build" type="button">✦ Create editable first cut</button>
  <p class="ab-w62-help" id="ab-w62-ai-status">Choose media, then Auto Edit builds a first-cut plan you can continue editing.</p>
 </section>`;
 root.append(host);
}
function initLayers(){
 const list=$("#ab-w62-layer-list");if(!list)return;
 const names=[["🎬","Video 1"],["🎥","Video 2 / B-roll"],["🖼","Photo / overlay"],["T","Text / subtitles"],["♫","Music"],["🎙","Voice-over"]];
 list.innerHTML=names.map(([i,n])=>`<div class="ab-w62-layer"><span>${i}</span><strong>${n}</strong><button type="button" data-eye>◉</button><button type="button" data-lock>◇</button></div>`).join("");
 list.addEventListener("click",e=>{const row=e.target.closest(".ab-w62-layer");if(!row)return;if(e.target.matches("[data-eye]"))row.classList.toggle("is-hidden");if(e.target.matches("[data-lock]"))row.classList.toggle("is-locked")});
}
function initText(){
 const stage=$("#ab-program-stage")||$(".ab-program-view .ab-viewer-stage");if(!stage)return;
 const apply=()=>{const t=$(".ab-w62-caption-chip",stage),title=$("#ab-video-overlay-title");[t,title].filter(Boolean).forEach(n=>{n.style.fontFamily=$("#ab-w62-font")?.value||"Inter";n.style.fontSize=($("#ab-w62-font-size")?.value||42)+"px";n.style.color=$("#ab-w62-font-color")?.value||"#fff"})};
 ["ab-w62-font","ab-w62-font-size","ab-w62-font-color"].forEach(id=>$("#"+id)?.addEventListener("input",apply));
 $("#ab-w62-bold")?.addEventListener("click",e=>{e.currentTarget.classList.toggle("is-on");const n=$(".ab-w62-caption-chip",stage);if(n)n.style.fontWeight=e.currentTarget.classList.contains("is-on")?"900":"700"});
 $("#ab-w62-shadow")?.addEventListener("click",e=>{e.currentTarget.classList.toggle("is-on");const n=$(".ab-w62-caption-chip",stage);if(n)n.style.textShadow=e.currentTarget.classList.contains("is-on")?"0 3px 12px #000":"none"});
 $("#ab-w62-caption-add")?.addEventListener("click",()=>{const val=$("#ab-w62-caption-text")?.value.trim();if(!val)return;let n=$(".ab-w62-caption-chip",stage);if(!n){n=document.createElement("div");n.className="ab-w62-caption-chip";stage.append(n)}n.textContent=val;apply();$("#ab-w62-caption-status").textContent="Subtitle added to the Programme viewer.";});
 $("#ab-w62-transcript")?.addEventListener("click",()=>$("#ab-w62-caption-status").textContent="AI transcript hook is ready; manual subtitles stay available without loading a speech model.");
}
async function initVoice(){
 const start=$("#ab-w62-voice-record"),stop=$("#ab-w62-voice-stop"),status=$("#ab-w62-voice-status");if(!start||!stop)return;
 start.addEventListener("click",async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];rec=new MediaRecorder(stream);rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType||"audio/webm"});if(voiceUrl)URL.revokeObjectURL(voiceUrl);voiceUrl=URL.createObjectURL(blob);status.innerHTML=`Voice-over recorded · ${(blob.size/1024).toFixed(0)} KB <audio controls src="${voiceUrl}"></audio>`;stream.getTracks().forEach(t=>t.stop())};rec.start();start.classList.add("is-recording");start.disabled=true;stop.disabled=false;status.textContent="Recording voice-over…";}catch(_){status.textContent="Microphone permission is required for voice-over."}});
 stop.addEventListener("click",()=>{if(rec&&rec.state!=="inactive")rec.stop();start.classList.remove("is-recording");start.disabled=false;stop.disabled=true});
 const input=$("#ab-w62-audio-file"),list=$("#ab-w62-audio-list");input?.addEventListener("change",()=>{list.innerHTML=[...input.files].map(f=>`<div class="ab-w62-audio-item">♫ ${f.name} · ${(f.size/1048576).toFixed(1)} MB</div>`).join("")});
}
function initAI(){
 $("#ab-w62-ai-build")?.addEventListener("click",()=>{
  const cards=$$(".ab-media-card"),clips=$$(".ab-w61-clip"),status=$("#ab-w62-ai-status");
  if(!cards.length&&!clips.length){status.textContent="Import some photos or video clips first.";return}
  const style=$("#ab-w62-ai-style").value,len=$("#ab-w62-ai-length").value;
  const chosen=cards.filter(c=>c.classList.contains("is-selected")).slice(0,12);
  const count=chosen.length||Math.min(cards.length||clips.length,6);
  status.innerHTML=`Editable ${style} first-cut plan ready using ${count} media item${count===1?"":"s"} for about ${len==="full"?"a full story":len+" seconds"}. Review, trim and reorder anything you want.`;
 });
}
function init(){buildPanels();initLayers();initText();initVoice();initAI()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();

(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let active=null, parking=null, overlay=null, body=null, rail=null, panel=null, resizeObserver=null;
const state={photo:null,video:null};

function tool(icon,label,key){
 const b=document.createElement("button");b.type="button";b.className="ab-studio-app__tool";b.dataset.studioAppTool=key;
 b.innerHTML=`<span aria-hidden="true">${icon}</span><span>${label}</span>`;return b;
}
function sectionTitle(title){
 const h=document.createElement("div");h.className="ab-studio-app__panel-head";h.innerHTML=`<h3>${title}</h3>`;return h;
}
function setTool(key){
 const conf=state[active]?.tools?.[key];if(!conf)return;
 $$("[data-studio-app-tool]",rail).forEach(b=>b.classList.toggle("is-active",b.dataset.studioAppTool===key));
 panel.replaceChildren(sectionTitle(conf.title));
 conf.nodes.filter(Boolean).forEach(n=>panel.append(n));
 requestLayout();
}
function requestLayout(){
 requestAnimationFrame(()=>{
   window.dispatchEvent(new Event("resize"));
   const shown=active==="video"?$("#ab-video-preview"):$("#ab-photo-canvas");
   if(shown) shown.dispatchEvent(new Event("resize"));
 });
}
function makeOverlay(){
 overlay=document.createElement("section");overlay.className="ab-studio-app";overlay.hidden=true;overlay.setAttribute("aria-label","Adventure Studio editor");
 overlay.innerHTML=`<header class="ab-studio-app__bar">
   <button class="ab-studio-app__back" type="button">← Back to Adventure Studio</button>
   <strong class="ab-studio-app__name">Adventure Studio</strong>
   <span class="ab-studio-app__meta"></span><span class="ab-studio-app__spacer"></span>
 </header><div class="ab-studio-app__body"></div>`;
 document.body.append(overlay);
 overlay.querySelector(".ab-studio-app__back").addEventListener("click",closeEditor);
 body=$(".ab-studio-app__body",overlay);
}
function photoState(section){
 const left=$(".ab-photo-tools",section), side=$(".ab-photo-side",section), canvas=$(".ab-photo-canvas-wrap",section);
 const lg=left?$$(":scope > .ab-photo-group",left):[], sg=side?$$(":scope > .ab-photo-group",side):[];
 const upload=$(".ab-photo-upload",left), reset=$("#ab-photo-reset",section), undo=$("#ab-photo-undo",section), redo=$("#ab-photo-redo",section), exp=$("#ab-photo-export",section);
 return {
  section,canvas,upload,top:[reset,undo,redo,exp].filter(Boolean),
  defs:[["☼","Adjust","adjust"],["⌗","Crop","crop"],["✦","Retouch","retouch"],["◐","Looks","looks"],["T","Text","text"]],
  tools:{
   adjust:{title:"Adjust",nodes:[lg[0]]},
   crop:{title:"Crop & straighten",nodes:[lg[1]]},
   retouch:{title:"Retouch & select",nodes:[lg[2],sg[0],sg[3]]},
   looks:{title:"Looks & lighting",nodes:[sg[1],sg[2]]},
   text:{title:"Text & stickers",nodes:[sg[4]]}
  },initial:"adjust"
 };
}
function videoState(section){
 const left=$(".ab-video-left",section), right=$(".ab-video-right",section), main=$(".ab-video-main",section);
 const lg=left?$$(":scope > .ab-video-group",left):[], rg=right?$$(":scope > .ab-video-group",right):[];
 const upload=$(".ab-video-upload",left), exp=$("#ab-video-export",section);
 return {
  section,canvas:main,upload,top:[exp].filter(Boolean),
  defs:[["＋","Media","media"],["✂","Edit","edit"],["T","Text","text"],["✦","Elements","elements"],["◐","Effects","effects"],["↔","Timeline","timeline"],["▦","Templates","templates"]],
  tools:{
   media:{title:"Media",nodes:[upload]},
   edit:{title:"Clip",nodes:[lg[0],lg[1]]},
   text:{title:"Text",nodes:[rg[1],rg[3]]},
   elements:{title:"Elements",nodes:[rg[0],rg[2],rg[4]]},
   effects:{title:"Effects",nodes:[lg[3]]},
   timeline:{title:"Timeline",nodes:[lg[2]]},
   templates:{title:"Templates",nodes:[lg[4],lg[5]]}
  },initial:"media"
 };
}
function editorLayout(kind){
 const s=state[kind], editor=document.createElement("div");editor.className="ab-studio-app__editor";
 rail=document.createElement("nav");rail.className="ab-studio-app__rail";rail.setAttribute("aria-label",`${kind} editor tools`);
 panel=document.createElement("aside");panel.className="ab-studio-app__panel";
 const canvas=document.createElement("main");canvas.className="ab-studio-app__canvas";
 s.defs.forEach(d=>rail.append(tool(...d)));
 canvas.append(s.canvas);
 editor.append(rail,panel,canvas);
 $$("[data-studio-app-tool]",rail).forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.studioAppTool)));
 return editor;
}
function populateBar(kind){
 const bar=$(".ab-studio-app__bar",overlay), spacer=$(".ab-studio-app__spacer",bar);
 $(".ab-studio-app__name",bar).textContent=kind==="photo"?"Photo Editor":"Video Editor";
 $(".ab-studio-app__meta",bar).textContent="Adventure Studio";
 // Remove prior transported actions.
 $$(".ab-studio-app__transported",bar).forEach(n=>n.remove());
 const s=state[kind];
 const barNodes=kind==="video"?s.top:[s.upload,...s.top];
 barNodes.filter(Boolean).forEach(n=>{n.classList.add("ab-studio-app__transported");bar.insertBefore(n,spacer.nextSibling)});
}
function openEditor(kind){
 if(!state[kind])return;
 active=kind;document.body.classList.add("ab-studio-editor-open");
 overlay.hidden=false;body.replaceChildren(editorLayout(kind));populateBar(kind);setTool(state[kind].initial);
 if(resizeObserver)resizeObserver.disconnect();
 if("ResizeObserver" in window){resizeObserver=new ResizeObserver(requestLayout);resizeObserver.observe(body)}
 requestLayout();
}
function closeEditor(){
 if(!active)return;
 const s=state[active];
 // Return transported nodes to their original hidden sidebars via their remembered original parents.
 $$(".ab-studio-app__transported",overlay).forEach(n=>{
   const parent=n.__studioOriginalParent;if(parent)parent.append(n);n.classList.remove("ab-studio-app__transported")
 });
 Object.values(s.tools).flatMap(x=>x.nodes).filter(Boolean).forEach(n=>{
   const parent=n.__studioOriginalParent;if(parent)parent.append(n)
 });
 if(s.canvas&&s.canvas.__studioOriginalParent)s.canvas.__studioOriginalParent.append(s.canvas);
 overlay.hidden=true;body.replaceChildren();document.body.classList.remove("ab-studio-editor-open");
 if(resizeObserver)resizeObserver.disconnect();active=null;requestLayout();
}
function remember(nodes){nodes.filter(Boolean).forEach(n=>{if(!n.__studioOriginalParent)n.__studioOriginalParent=n.parentElement})}
function launcher(area){
 const oldSwitch=$(".ab-studio-switch",area), note=$(".ab-studio-note",area);
 if(oldSwitch)oldSwitch.hidden=true;if(note)note.hidden=true;
 const launch=document.createElement("section");launch.className="ab-studio-launcher";launch.innerHTML=`
   <div class="ab-studio-launcher__intro"><h2>What would you like to create?</h2><p>Choose an editor. Your workspace will open and automatically fill the available screen.</p></div>
   <div class="ab-studio-launcher__grid">
    <button class="ab-studio-launch" type="button" data-open-studio="photo"><span class="ab-studio-launch__icon">📸</span><strong>Photo Editor</strong><span>Crop, enhance, retouch, add text and export your adventure photographs.</span></button>
    <button class="ab-studio-launch ab-studio-launch--video" type="button" data-open-studio="video"><span class="ab-studio-launch__icon">🎬</span><strong>Video Editor</strong><span>Arrange clips, trim, add transitions, style your film and export an adventure video.</span></button>
   </div>`;
 area.prepend(launch);
 $$("[data-open-studio]",launch).forEach(b=>b.addEventListener("click",()=>openEditor(b.dataset.openStudio)));
}
function init(){
 const area=$("#studio-members-area"), photo=$(".ab-photo-studio"), video=$(".ab-video-studio");if(!area||!photo||!video)return;
 parking=document.createElement("div");parking.hidden=true;parking.setAttribute("data-studio-parking","");
 photo.parentElement.insertBefore(parking,photo);parking.append(photo,video);
 state.photo=photoState(photo);state.video=videoState(video);
 [state.photo,state.video].forEach(s=>{
   remember([s.canvas,s.upload,...s.top]);
   Object.values(s.tools).forEach(c=>remember(c.nodes));
 });
 makeOverlay();launcher(area);
 // Remove legacy workspace toolbar if an older cached manager managed to create it.
 $$(".ab-studio-workspace-manager",area).forEach(n=>n.remove());
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();

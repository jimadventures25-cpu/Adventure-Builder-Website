
(()=>{"use strict";
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
function btn(icon,label,key){const b=document.createElement("button");b.type="button";b.className="ab-studio-v2-tool";b.dataset.studioTool=key;b.innerHTML=`<span aria-hidden="true">${icon}</span>${label}`;return b}
function topbar(kind,upload,undo,redo,exportBtn){
 const bar=document.createElement("div");bar.className="ab-studio-v2-topbar";
 bar.innerHTML=`<div><div class="ab-studio-v2-title">${kind==="photo"?"Photo Editor":"Video Editor"}</div><div class="ab-studio-v2-sub">${kind==="photo"?"Edit the image, then export when it feels right.":"Build the film, then preview and export."}</div></div>`;
 [upload,undo,redo,exportBtn].filter(Boolean).forEach(el=>bar.append(el));
 return bar;
}
function activate(rail,panel,key,map){
 qa("[data-studio-tool]",rail).forEach(b=>b.classList.toggle("is-active",b.dataset.studioTool===key));
 panel.innerHTML="";
 const head=document.createElement("div");head.className="ab-studio-v2-panel-head";head.innerHTML=`<h3>${map[key]?.title||"Tools"}</h3>`;
 panel.append(head);
 (map[key]?.nodes||[]).forEach(n=>panel.append(n));
}
function photo(){
 const studio=q(".ab-photo-studio"); if(!studio||studio.dataset.v2Ready)return; studio.dataset.v2Ready="1";studio.classList.add("is-v2");
 const shell=q(".ab-photo-shell",studio), left=q(".ab-photo-tools",studio), side=q(".ab-photo-side",studio), canvas=q(".ab-photo-canvas-wrap",studio);
 if(!shell||!left||!side||!canvas)return;
 const leftGroups=qa(":scope > .ab-photo-group",left), sideGroups=qa(":scope > .ab-photo-group",side);
 const upload=q(".ab-photo-upload",left), undo=q("#ab-photo-undo",studio), redo=q("#ab-photo-redo",studio), exp=q("#ab-photo-export",studio);
 const bar=topbar("photo",upload,undo,redo,exp); studio.insertBefore(bar,shell);
 const work=document.createElement("div");work.className="ab-studio-v2-workspace";
 const rail=document.createElement("nav");rail.className="ab-studio-v2-rail";rail.setAttribute("aria-label","Photo editing tools");
 const panel=document.createElement("aside");panel.className="ab-studio-v2-panel";
 const canvasArea=document.createElement("section");canvasArea.className="ab-studio-v2-canvas";canvasArea.append(canvas);
 const map={
  adjust:{title:"Adjust",nodes:[leftGroups[0]].filter(Boolean)},
  crop:{title:"Crop & straighten",nodes:[leftGroups[1]].filter(Boolean)},
  retouch:{title:"Retouch",nodes:[leftGroups[2],sideGroups[0],sideGroups[3]].filter(Boolean)},
  looks:{title:"Looks & light",nodes:[sideGroups[1],sideGroups[2]].filter(Boolean)},
  text:{title:"Text & stickers",nodes:[sideGroups[4]].filter(Boolean)}
 };
 [["☼","Adjust","adjust"],["⌗","Crop","crop"],["✦","Retouch","retouch"],["◐","Looks","looks"],["T","Text","text"]].forEach(x=>rail.append(btn(...x)));
 work.append(rail,panel,canvasArea);shell.replaceWith(work);
 qa("[data-studio-tool]",rail).forEach(b=>b.addEventListener("click",()=>activate(rail,panel,b.dataset.studioTool,map)));
 activate(rail,panel,"adjust",map);
 // Empty state stays simple; existing upload event still owns image loading.
 const empty=q("#ab-photo-empty",studio);
 if(empty){empty.innerHTML=`<div class="ab-studio-v2-empty-cta"><strong>Add a photograph to start</strong><p>Upload a JPG, PNG or WebP. Your photo stays on this device while you edit.</p></div>`}
}
function video(){
 const studio=q(".ab-video-studio"); if(!studio||studio.dataset.v2Ready)return;studio.dataset.v2Ready="1";studio.classList.add("is-v2");
 const layout=q(".ab-video-layout",studio), left=q(".ab-video-left",studio), main=q(".ab-video-main",studio); if(!layout||!left||!main)return;
 const groups=qa(":scope > .ab-video-group",left), upload=q(".ab-video-upload",left);
 const bar=topbar("video",upload,null,null,q("#ab-video-export",studio));studio.insertBefore(bar,layout);
 const rail=document.createElement("nav");rail.className="ab-studio-v2-rail";rail.setAttribute("aria-label","Video editing tools");
 const panel=document.createElement("aside");panel.className="ab-studio-v2-panel";
 const map={
  clips:{title:"Clips",nodes:[groups[0]].filter(Boolean)},
  format:{title:"Format & title",nodes:[groups[1]].filter(Boolean)},
  timeline:{title:"Timeline & transitions",nodes:[groups[2]].filter(Boolean)},
  effects:{title:"Effects",nodes:[groups[3]].filter(Boolean)},
  templates:{title:"Templates",nodes:[groups[4],groups[5]].filter(Boolean)}
 };
 [["▤","Clips","clips"],["▣","Format","format"],["↔","Timeline","timeline"],["✦","Effects","effects"],["▦","Templates","templates"]].forEach(x=>rail.append(btn(...x)));
 layout.prepend(panel);layout.prepend(rail);
 qa("[data-studio-tool]",rail).forEach(b=>b.addEventListener("click",()=>activate(rail,panel,b.dataset.studioTool,map)));
 activate(rail,panel,"clips",map);
}
function init(){photo();video()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();

(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function init(){const wrap=$(".ab-video-timeline-wrap"),head=$(".ab-video-timeline-head"),multi=$("#ab-video-multitracks");if(!wrap||!head||!multi)return;
const sync=()=>{const has=!!multi.querySelector(".ab-video-mclip,.ab-video-overlay-block");wrap.classList.toggle("is-empty",!has);if(!has)wrap.classList.remove("is-expanded")};
head.setAttribute("role","button");head.tabIndex=0;head.title="Expand or collapse timeline";const toggle=()=>{if(!wrap.classList.contains("is-empty"))wrap.classList.toggle("is-expanded")};
head.addEventListener("click",toggle);head.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle()}});new MutationObserver(sync).observe(multi,{childList:true,subtree:true});sync();
document.addEventListener("keydown",e=>{if(!document.body.classList.contains("ab-studio-editor-open"))return;const tag=document.activeElement?.tagName;if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;
if(e.code==="Space"){e.preventDefault();$("#ab-video-play")?.click()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();(e.shiftKey?$("#ab-video-redo"):$("#ab-video-undo"))?.click()}if(e.key.toLowerCase()==="s"&&!e.ctrlKey&&!e.metaKey)$("#ab-video-split")?.click();if(e.altKey&&e.key==="ArrowLeft")$("#ab-video-back")?.click();if(e.altKey&&e.key==="ArrowRight")$("#ab-video-forward")?.click()})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
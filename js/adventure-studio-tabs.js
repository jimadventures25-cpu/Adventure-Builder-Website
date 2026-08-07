
(() => {
  const root=document.querySelector('[data-ab-adventure-studio]');
  if(!root)return;
  const buttons=[...root.querySelectorAll('[data-ab-studio-tab]')];
  const panels=[...root.querySelectorAll('[data-ab-studio-panel]')];
  function show(name){
    buttons.forEach(b=>{
      const on=b.dataset.abStudioTab===name;
      b.classList.toggle('is-active',on);
      b.setAttribute('aria-selected',String(on));
    });
    panels.forEach(p=>p.hidden=p.dataset.abStudioPanel!==name);
  }
  buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.abStudioTab)));
  show('photo');
})();

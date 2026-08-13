(() => {
  'use strict';

  const A = window.AdventureAccessibility;
  if (!A || document.querySelector('[data-ab-accessibility-dialog]')) return;

  const groups = {};
  Object.entries(A.requirements).forEach(([key,item]) => (groups[item.group] ||= []).push([key,item]));

  const button = document.createElement('button');
  button.type='button';
  button.className='ab-accessibility-button';
  button.setAttribute('data-ab-accessibility-button','');
  button.setAttribute('aria-haspopup','dialog');
  button.innerHTML='<span aria-hidden="true">♿</span><span data-ab-accessibility-button-label>Accessibility</span>';

  const accountActions=document.querySelector('.site-header .account-actions');
  if (accountActions) accountActions.prepend(button);
  else document.body.append(button);

  const dialog=document.createElement('dialog');
  dialog.className='ab-accessibility-dialog';
  dialog.setAttribute('data-ab-accessibility-dialog','');
  dialog.setAttribute('aria-labelledby','ab-accessibility-title');
  dialog.innerHTML=`
    <form method="dialog" class="ab-accessibility-sheet" data-ab-accessibility-form>
      <header class="ab-accessibility-head">
        <div><p class="ab-accessibility-kicker">Accessibility</p><h2 id="ab-accessibility-title">What do you need for your adventure?</h2><p>Choose the access requirements that matter to you. Adventure Builder will use needs, not diagnoses, when filtering and explaining adventures.</p></div>
        <button class="ab-accessibility-close" value="cancel" type="submit" aria-label="Close accessibility settings">×</button>
      </header>
      <div class="ab-accessibility-notice"><strong>Access information is evidence-based.</strong><span>If a route, place or facility has not been confirmed, Adventure Builder will show it as not verified rather than guessing.</span></div>
      <div class="ab-accessibility-groups">
        ${Object.entries(groups).map(([group,items])=>`<fieldset><legend>${group}</legend>${items.map(([key,item])=>`<label><input type="checkbox" value="${key}" data-ab-accessibility-choice><span>${item.label}</span></label>`).join('')}</fieldset>`).join('')}
      </div>
      <label class="ab-accessibility-remember"><input type="checkbox" data-ab-accessibility-remember><span><strong>Remember these needs on this device</strong><small>Leave this off to keep them for this browser session only.</small></span></label>
      <footer class="ab-accessibility-actions"><button type="button" class="ab-accessibility-clear" data-ab-accessibility-clear>Clear</button><button type="button" class="ab-accessibility-save" data-ab-accessibility-save>Use these needs</button></footer>
      <p class="ab-accessibility-privacy">Stage A keeps accessibility preferences on this device. They are not sent to your Adventure Builder account or Supabase.</p>
    </form>`;
  document.body.append(dialog);

  const choices=[...dialog.querySelectorAll('[data-ab-accessibility-choice]')];
  const remember=dialog.querySelector('[data-ab-accessibility-remember]');
  const labelNode=button.querySelector('[data-ab-accessibility-button-label]');

  function syncButton(profile=A.get()) {
    const n=A.activeCount(profile);
    button.classList.toggle('is-active',n>0);
    labelNode.textContent=n?`Accessibility · ${n}`:'Accessibility';
    document.querySelectorAll('[data-accessibility-summary]').forEach(node=>node.textContent=n?`${n} access need${n===1?'':'s'} active`:'Accessibility off');
  }
  function populate() {
    const p=A.get();
    choices.forEach(c=>c.checked=p.selected.includes(c.value));
    remember.checked=!!p.remember;
  }
  function open() { populate(); if(typeof dialog.showModal==='function') dialog.showModal(); else dialog.setAttribute('open',''); }
  function close() { if(typeof dialog.close==='function') dialog.close(); else dialog.removeAttribute('open'); }

  button.addEventListener('click',open);
  document.addEventListener('click',event=>{ if(event.target.closest('[data-accessibility-open]')) { event.preventDefault(); open(); } });
  dialog.querySelector('[data-ab-accessibility-save]').addEventListener('click',()=>{
    const selected=choices.filter(c=>c.checked).map(c=>c.value);
    A.save({enabled:selected.length>0,selected,remember:remember.checked});
    close();
  });
  dialog.querySelector('[data-ab-accessibility-clear]').addEventListener('click',()=>{A.clear();populate();close();});
  dialog.addEventListener('click',event=>{ if(event.target===dialog) close(); });
  window.addEventListener(A.events.change,event=>syncButton(event.detail?.profile));
  syncButton();
})();

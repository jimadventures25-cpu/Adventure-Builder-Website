
(() => {
'use strict';
document.querySelectorAll('[data-ab-partner-form]').forEach(form=>{
  const status=form.querySelector('[data-ab-partner-status]');
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    try{
      const key='ab-partnership-enquiry-drafts-v1';
      const drafts=JSON.parse(localStorage.getItem(key)||'[]');
      drafts.push({...data,savedAt:new Date().toISOString()});
      localStorage.setItem(key,JSON.stringify(drafts));
      status.textContent='Enquiry draft saved on this device. Sending to Adventure Builder will be connected in a later stage.';
      form.reset();
    }catch{
      status.textContent='This browser could not save the draft.';
    }
  });
});
})();

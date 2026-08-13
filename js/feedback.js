(() => {
  'use strict';
  if(document.querySelector('[data-ab-feedback-dialog]')) return;
  const button=document.createElement('button');
  button.type='button';button.className='ab-feedback-button';button.setAttribute('data-ab-feedback-button','');button.innerHTML='<span aria-hidden="true">✦</span><span>Feedback</span>';
  document.body.append(button);
  const dialog=document.createElement('dialog');dialog.className='ab-feedback-dialog';dialog.setAttribute('data-ab-feedback-dialog','');
  dialog.innerHTML=`<form class="ab-feedback-sheet" data-feedback-form><header><div><p class="eyebrow">Help improve Adventure Builder</p><h2>Send feedback</h2><p>Found a bug, have an idea, or spotted an accessibility problem? Tell us here.</p></div><button type="button" data-feedback-close aria-label="Close feedback">×</button></header>
    <label>Feedback type<select data-feedback-category><option value="bug">Bug</option><option value="idea">Idea</option><option value="accessibility">Accessibility</option><option value="general">General feedback</option></select></label>
    <label>Your feedback<textarea data-feedback-message maxlength="3000" rows="6" required placeholder="Tell us what happened or what you would like to see…"></textarea></label>
    <label class="ab-feedback-contact"><input type="checkbox" data-feedback-contact><span>I'm happy for Adventure Builder to contact me about this feedback.</span></label>
    <label data-feedback-email-wrap hidden>Email for a reply<input type="email" data-feedback-email autocomplete="email" maxlength="254"></label>
    <input type="text" tabindex="-1" autocomplete="off" data-feedback-honeypot class="ab-feedback-honeypot" aria-hidden="true">
    <small class="ab-feedback-context">Page: <span data-feedback-page></span></small>
    <footer><button type="button" class="button button-secondary" data-feedback-close>Cancel</button><button type="submit" class="button button-primary">Send feedback</button></footer><p data-feedback-status aria-live="polite"></p></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('[data-feedback-form]'), status=dialog.querySelector('[data-feedback-status]'), contact=dialog.querySelector('[data-feedback-contact]'), emailWrap=dialog.querySelector('[data-feedback-email-wrap]');
  dialog.querySelector('[data-feedback-page]').textContent=document.body.dataset.page||location.pathname;
  const close=()=>typeof dialog.close==='function'?dialog.close():dialog.removeAttribute('open');
  button.addEventListener('click',()=>{status.textContent='';typeof dialog.showModal==='function'?dialog.showModal():dialog.setAttribute('open','');});
  dialog.querySelectorAll('[data-feedback-close]').forEach(x=>x.addEventListener('click',close));
  contact.addEventListener('change',()=>{emailWrap.hidden=!contact.checked;if(!contact.checked)emailWrap.querySelector('input').value='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(dialog.querySelector('[data-feedback-honeypot]').value) return close();
    const message=dialog.querySelector('[data-feedback-message]').value.trim();
    if(message.length<5){status.textContent='Please add a little more detail.';return;}
    const client=window.ADVENTURE_BUILDER_AUTH?.client;
    if(!client){status.textContent='Feedback service is not configured.';return;}
    status.textContent='Sending…';
    const replyEmail=contact.checked?dialog.querySelector('[data-feedback-email]').value.trim():'';
    const {error}=await client.rpc('submit_adventure_feedback',{
      p_category:dialog.querySelector('[data-feedback-category]').value,
      p_message:message,
      p_page:document.body.dataset.page||location.pathname,
      p_url:location.href.slice(0,500),
      p_reply_email:replyEmail||null
    });
    if(error){status.textContent=error.message?.includes('submit_adventure_feedback')?'Feedback database setup is required. Run the W56 Supabase SQL first.':'Feedback could not be sent right now.';return;}
    form.reset();emailWrap.hidden=true;status.textContent='Thank you — your feedback has been sent.';
  });
})();

(() => {
  'use strict';
  const P=window.AdventureProfile;
  if(!P) return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=list=>list.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
  const interestChecks=Object.entries(P.interests).map(([k,v])=>`<label class="ab-profile-choice"><input type="checkbox" value="${k}" data-profile-interest><span>${v}</span></label>`).join('');

  const register=document.getElementById('register-form');
  const submit=register?.querySelector('button[type="submit"]');
  if(register && submit && !register.querySelector('[data-profile-registration]')){
    const section=document.createElement('details');
    section.className='ab-profile-registration';
    section.setAttribute('data-profile-registration','');
    section.innerHTML=`<summary>Accessibility &amp; adventure preferences <small>optional</small></summary>
      <div class="ab-profile-registration-body">
        <p class="ab-profile-help">Make Adventure Builder work better for you from the start. Everything in this section is optional and can be changed later in My Account.</p>
        <div class="ab-profile-access ab-profile-access-primary">
          <div><strong>Accessibility &amp; support preferences</strong><small data-profile-access-summary>No accessibility needs selected.</small></div>
          <button type="button" class="button button-secondary" data-accessibility-open>Choose what I need</button>
        </div>
        <label class="ab-profile-consent"><input type="checkbox" data-profile-access-sync><span><strong>Save these accessibility preferences to my Adventure Builder account</strong><small>Optional. Only enable this if you want these preferences to follow you between the website and app. You can change or remove them later.</small></span></label>
        <div class="ab-profile-preferences-divider"><span>Optional adventure preferences</span></div>
        <p class="ab-profile-help">These choices help Adventure Builder recommend places and adventures that suit you. You can leave them blank.</p>
        <div class="ab-profile-grid two">
          <label>Age group <span>optional</span><select data-profile-age>${options(P.ageBands)}</select></label>
          <label>Adventure atmosphere <span>optional</span><select data-profile-atmosphere>${options(P.atmosphere)}</select></label>
          <label>Preferred pace <span>optional</span><select data-profile-pace>${options(P.pace)}</select></label>
          <label>Usually adventuring <span>optional</span><select data-profile-company>${options(P.company)}</select></label>
        </div>
        <fieldset class="ab-profile-fieldset"><legend>Things you enjoy <span>optional</span></legend><div class="ab-profile-choices">${interestChecks}</div></fieldset>
        <p class="ab-profile-youth" data-profile-youth-note hidden>For under-18 accounts, Adventure Builder will use age-appropriate privacy and recommendation safeguards. Age-restricted places and activities can be filtered where reliable age rules are available.</p>
      </div>`;
    const legalRow=register.querySelector('#register-terms')?.closest('label');
    register.insertBefore(section,legalRow||submit);
    const age=section.querySelector('[data-profile-age]');
    age.addEventListener('change',()=>section.querySelector('[data-profile-youth-note]').hidden=age.value!=='under18');
  }

  function registrationData(){
    const root=document.querySelector('[data-profile-registration]');
    if(!root) return P.normalise({});
    const access=window.AdventureAccessibility?.get()||{};
    const sync=Boolean(root.querySelector('[data-profile-access-sync]')?.checked);
    return P.normalise({
      ageBand:root.querySelector('[data-profile-age]')?.value||'',
      atmosphere:root.querySelector('[data-profile-atmosphere]')?.value||'',
      pace:root.querySelector('[data-profile-pace]')?.value||'',
      company:root.querySelector('[data-profile-company]')?.value||'',
      interests:[...root.querySelectorAll('[data-profile-interest]:checked')].map(x=>x.value),
      personalisationEnabled:true,
      accessibilitySyncEnabled:sync,
      accessibilityConsentAt:sync?new Date().toISOString():null,
      accessibility:sync?access:{}
    });
  }
  function resetRegistration(){
    const root=document.querySelector('[data-profile-registration]');
    if(!root)return;
    root.querySelectorAll('select').forEach(x=>x.value='');
    root.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=false);
    root.open=false;
    updateAccessSummaries();
  }
  window.AdventureProfileRegistration=Object.freeze({read:registrationData,reset:resetRegistration});

  const dialog=document.createElement('dialog');
  dialog.className='ab-profile-dialog';
  dialog.setAttribute('data-profile-dialog','');
  dialog.innerHTML=`<form method="dialog" class="ab-profile-sheet">
    <header><div><p class="eyebrow">Adventure Profile</p><h2>Personalise Adventure Builder</h2><p>Tell us what works for you. These settings guide recommendations; they do not limit what you can choose.</p></div><button type="submit" value="cancel" aria-label="Close account settings">×</button></header>
    <div class="ab-profile-grid two">
      <label>Age group <span>optional</span><select data-settings-age>${options(P.ageBands)}</select></label>
      <label>Adventure atmosphere <span>optional</span><select data-settings-atmosphere>${options(P.atmosphere)}</select></label>
      <label>Preferred pace <span>optional</span><select data-settings-pace>${options(P.pace)}</select></label>
      <label>Usually adventuring <span>optional</span><select data-settings-company>${options(P.company)}</select></label>
    </div>
    <fieldset class="ab-profile-fieldset"><legend>Things you enjoy <span>optional</span></legend><div class="ab-profile-choices">${interestChecks.replaceAll('data-profile-interest','data-settings-interest')}</div></fieldset>
    <div class="ab-profile-access settings"><div><strong>Accessibility</strong><small data-profile-access-summary></small></div><button type="button" class="button button-secondary" data-accessibility-open>Review access needs</button></div>
    <label class="ab-profile-consent"><input type="checkbox" data-settings-access-sync><span><strong>Sync accessibility needs with my account</strong><small>This is optional and requires your explicit consent because access requirements can be sensitive information.</small></span></label>
    <label class="ab-profile-consent simple"><input type="checkbox" data-settings-personalisation checked><span><strong>Use my Adventure Profile for recommendations</strong><small>Turn this off to keep the information but stop using lifestyle preferences for ranking.</small></span></label>
    <p class="ab-profile-youth" data-settings-youth-note hidden>Under-18 profile: age-appropriate privacy and recommendation safeguards apply.</p>
    <footer><button type="button" class="button button-secondary" data-settings-device>Save on this device only</button><button type="button" class="button button-primary" data-settings-save>Save to my account</button></footer>
    <p class="ab-profile-status" data-profile-status aria-live="polite"></p>
  </form>`;
  document.body.append(dialog);

  const status=dialog.querySelector('[data-profile-status]');
  const setStatus=(m,t='')=>{status.textContent=m;status.dataset.state=t;};
  function fill(profile=P.get()){
    const p=P.normalise(profile);
    dialog.querySelector('[data-settings-age]').value=p.ageBand;
    dialog.querySelector('[data-settings-atmosphere]').value=p.atmosphere;
    dialog.querySelector('[data-settings-pace]').value=p.pace;
    dialog.querySelector('[data-settings-company]').value=p.company;
    dialog.querySelectorAll('[data-settings-interest]').forEach(x=>x.checked=p.interests.includes(x.value));
    dialog.querySelector('[data-settings-access-sync]').checked=p.accessibilitySyncEnabled;
    dialog.querySelector('[data-settings-personalisation]').checked=p.personalisationEnabled;
    dialog.querySelector('[data-settings-youth-note]').hidden=p.ageBand!=='under18';
    updateAccessSummaries();
  }
  function readSettings(){
    const sync=dialog.querySelector('[data-settings-access-sync]').checked;
    return P.normalise({
      ageBand:dialog.querySelector('[data-settings-age]').value,
      atmosphere:dialog.querySelector('[data-settings-atmosphere]').value,
      pace:dialog.querySelector('[data-settings-pace]').value,
      company:dialog.querySelector('[data-settings-company]').value,
      interests:[...dialog.querySelectorAll('[data-settings-interest]:checked')].map(x=>x.value),
      personalisationEnabled:dialog.querySelector('[data-settings-personalisation]').checked,
      accessibilitySyncEnabled:sync,
      accessibilityConsentAt:sync?(P.get().accessibilityConsentAt||new Date().toISOString()):null,
      accessibility:sync?(window.AdventureAccessibility?.get()||{}):{}
    });
  }
  function openSettings(){ fill(); setStatus(''); if(typeof dialog.showModal==='function')dialog.showModal(); else dialog.setAttribute('open',''); }
  dialog.querySelector('[data-settings-age]').addEventListener('change',e=>dialog.querySelector('[data-settings-youth-note]').hidden=e.target.value!=='under18');
  dialog.querySelector('[data-settings-device]').addEventListener('click',()=>{P.saveDevice(readSettings(),true);setStatus('Saved on this device.','success');});
  dialog.querySelector('[data-settings-save]').addEventListener('click',async()=>{
    const client=window.ADVENTURE_BUILDER_AUTH?.client;
    const user=window.ADVENTURE_BUILDER_AUTH?.getSession()?.user;
    if(!user){setStatus('Log in to sync this profile with your Adventure Builder account.','error');return;}
    setStatus('Saving…');
    try{await P.saveAccount(client,user,readSettings());setStatus('Adventure Profile saved to your account.','success');}
    catch(error){setStatus(error?.message?.includes('adventure_profiles')?'Profile database setup is required. Run the W56 Supabase SQL, then try again.':(error.message||'Could not save the profile.'),'error');}
  });

  function updateAccessSummaries(){
    const a=window.AdventureAccessibility;
    const n=a?.activeCount?.()||0;
    document.querySelectorAll('[data-profile-access-summary]').forEach(node=>node.textContent=n?`${n} access need${n===1?'':'s'} selected.`:'No accessibility needs selected.');
  }
  window.addEventListener(window.AdventureAccessibility?.events?.change||'adventurebuilder:accessibilitychange',updateAccessSummaries);
  window.addEventListener(P.events.change,e=>{if(dialog.open)fill(e.detail?.profile);});
  updateAccessSummaries();

  window.AdventureProfileUI=Object.freeze({openSettings,fill});
})();

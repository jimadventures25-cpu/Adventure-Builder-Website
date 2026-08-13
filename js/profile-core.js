(() => {
  'use strict';

  const PROFILE_VERSION = 1;
  const TABLE = 'adventure_profiles';
  const LOCAL_KEY = 'ab-adventure-profile-device-v1';
  const SESSION_KEY = 'ab-adventure-profile-session-v1';
  const PENDING_KEY = 'ab-adventure-profile-pending-registration-v1';
  const EVENT_CHANGE = 'adventurebuilder:profilechange';
  const EVENT_READY = 'adventurebuilder:profileready';

  const ageBands = Object.freeze([
    {value:'', label:'Prefer not to say'},
    {value:'under18', label:'Under 18'},
    {value:'18-24', label:'18–24'},
    {value:'25-39', label:'25–39'},
    {value:'40-54', label:'40–54'},
    {value:'55-69', label:'55–69'},
    {value:'70plus', label:'70+'}
  ]);
  const atmosphere = Object.freeze([
    {value:'',label:'No preference'},
    {value:'quiet',label:'Quiet & peaceful'},
    {value:'balanced',label:'A bit of both'},
    {value:'lively',label:'Social & lively'}
  ]);
  const pace = Object.freeze([
    {value:'',label:'No preference'},
    {value:'relaxed',label:'Relaxed / easy-going'},
    {value:'balanced',label:'Balanced'},
    {value:'active',label:'Active'},
    {value:'challenging',label:'Challenging'}
  ]);
  const company = Object.freeze([
    {value:'',label:'No preference'},
    {value:'solo',label:'Solo'},
    {value:'couple',label:'Couple'},
    {value:'family',label:'Family'},
    {value:'friends',label:'Friends / group'}
  ]);
  const interests = Object.freeze({
    camping:'Camping', hiking:'Walking & hiking', cycling:'Cycling', paddling:'Paddle & kayak', roadtrip:'Road trips', vanlife:'Vanlife', wildlife:'Wildlife', photography:'Photography'
  });

  const safeParse = (store,key) => { try { return JSON.parse(store.getItem(key)||'null'); } catch { return null; } };
  const safeWrite = (store,key,val) => { try { store.setItem(key,JSON.stringify(val)); return true; } catch { return false; } };
  const allowed = (value, list) => list.some(item=>item.value===value) ? value : '';
  const uniqueInterests = values => [...new Set((Array.isArray(values)?values:[]).map(String).filter(k=>interests[k]))];

  function normalise(input={}) {
    return {
      version: PROFILE_VERSION,
      ageBand: allowed(String(input.ageBand||''), ageBands),
      atmosphere: allowed(String(input.atmosphere||''), atmosphere),
      pace: allowed(String(input.pace||''), pace),
      company: allowed(String(input.company||''), company),
      interests: uniqueInterests(input.interests),
      personalisationEnabled: input.personalisationEnabled !== false,
      accessibilitySyncEnabled: Boolean(input.accessibilitySyncEnabled),
      accessibilityConsentAt: input.accessibilitySyncEnabled && typeof input.accessibilityConsentAt==='string' ? input.accessibilityConsentAt : null,
      accessibility: input.accessibilitySyncEnabled ? (window.AdventureAccessibility?.normalise(input.accessibility||{}) || input.accessibility || {}) : {},
      updatedAt: typeof input.updatedAt==='string' ? input.updatedAt : null,
      source: typeof input.source==='string' ? input.source : 'device'
    };
  }

  function loadDevice() {
    return normalise(safeParse(sessionStorage,SESSION_KEY) || safeParse(localStorage,LOCAL_KEY) || {});
  }
  let current = loadDevice();
  let currentUserId = null;
  let remoteAvailable = null;

  function get(){ return normalise(current); }
  function emit(source='device') {
    current = normalise({...current, source});
    window.dispatchEvent(new CustomEvent(EVENT_CHANGE,{detail:{profile:get(),source}}));
    return get();
  }
  function saveDevice(input, remember=true) {
    current = normalise({...input,updatedAt:new Date().toISOString(),source:'device'});
    safeWrite(remember?localStorage:sessionStorage, remember?LOCAL_KEY:SESSION_KEY, current);
    try { (remember?sessionStorage:localStorage).removeItem(remember?SESSION_KEY:LOCAL_KEY); } catch {}
    return emit('device');
  }

  function toRow(userId, profile) {
    const p=normalise(profile);
    const access = p.accessibilitySyncEnabled ? (window.AdventureAccessibility?.get() || p.accessibility || {}) : {};
    return {
      user_id:userId,
      profile_version:PROFILE_VERSION,
      age_band:p.ageBand || null,
      atmosphere:p.atmosphere || null,
      pace:p.pace || null,
      company:p.company || null,
      interests:p.interests,
      personalisation_enabled:p.personalisationEnabled,
      accessibility_sync_enabled:p.accessibilitySyncEnabled,
      accessibility_consent_at:p.accessibilitySyncEnabled ? (p.accessibilityConsentAt || new Date().toISOString()) : null,
      accessibility_profile:p.accessibilitySyncEnabled ? access : {},
      updated_at:new Date().toISOString()
    };
  }
  function fromRow(row={}) {
    return normalise({
      ageBand:row.age_band, atmosphere:row.atmosphere, pace:row.pace, company:row.company,
      interests:row.interests, personalisationEnabled:row.personalisation_enabled,
      accessibilitySyncEnabled:row.accessibility_sync_enabled,
      accessibilityConsentAt:row.accessibility_consent_at,
      accessibility:row.accessibility_profile,
      updatedAt:row.updated_at, source:'account'
    });
  }

  async function loadAccount(client,user) {
    if(!client || !user?.id) return {profile:get(),remote:false};
    currentUserId=user.id;
    const {data,error}=await client.from(TABLE).select('*').eq('user_id',user.id).maybeSingle();
    if(error){ remoteAvailable=false; return {profile:get(),remote:false,error}; }
    remoteAvailable=true;
    if(data){
      current=fromRow(data);
      if(current.accessibilitySyncEnabled && window.AdventureAccessibility?.applyAccount){
        window.AdventureAccessibility.applyAccount(current.accessibility || {});
      } else if(window.AdventureAccessibility?.clearAccount){
        window.AdventureAccessibility.clearAccount();
      }
      emit('account');
    }
    return {profile:get(),remote:true};
  }

  async function saveAccount(client,user,input) {
    if(!client || !user?.id) throw new Error('Sign in to save your Adventure Profile.');
    const p=normalise(input);
    if(p.accessibilitySyncEnabled && !p.accessibilityConsentAt) p.accessibilityConsentAt=new Date().toISOString();
    if(!p.accessibilitySyncEnabled){ p.accessibility={}; p.accessibilityConsentAt=null; }
    const row=toRow(user.id,p);
    const {data,error}=await client.from(TABLE).upsert(row,{onConflict:'user_id'}).select('*').single();
    if(error){ remoteAvailable=false; throw error; }
    remoteAvailable=true;
    current=fromRow(data);
    emit('account');
    return get();
  }

  function stageRegistration(input){ safeWrite(sessionStorage,PENDING_KEY,normalise(input)); }
  function peekPending(){ return normalise(safeParse(sessionStorage,PENDING_KEY)||{}); }
  async function consumePending(client,user){
    const raw=safeParse(sessionStorage,PENDING_KEY);
    if(!raw || !user?.id) return null;
    const p=normalise(raw);
    try {
      const saved=await saveAccount(client,user,p);
      sessionStorage.removeItem(PENDING_KEY);
      return saved;
    } catch(error){ return {error}; }
  }
  function clearPending(){ try{sessionStorage.removeItem(PENDING_KEY);}catch{} }
  function clearAccountContext(){ currentUserId=null; current=loadDevice(); emit('device'); }

  function recommendationContext(profile=current){
    const p=normalise(profile);
    return Object.freeze({
      ageBand:p.ageBand,
      youth:p.ageBand==='under18',
      atmosphere:p.personalisationEnabled?p.atmosphere:'',
      pace:p.personalisationEnabled?p.pace:'',
      company:p.personalisationEnabled?p.company:'',
      interests:p.personalisationEnabled?[...p.interests]:[],
      accessibility:p.accessibilitySyncEnabled ? (window.AdventureAccessibility?.get()||p.accessibility) : (window.AdventureAccessibility?.get()||{}),
      accessibilitySynced:p.accessibilitySyncEnabled
    });
  }

  window.AdventureProfile = Object.freeze({
    ageBands,atmosphere,pace,company,interests,normalise,get,saveDevice,loadAccount,saveAccount,
    stageRegistration,peekPending,consumePending,clearPending,clearAccountContext,recommendationContext,
    remoteAvailable:()=>remoteAvailable,currentUserId:()=>currentUserId,
    events:Object.freeze({change:EVENT_CHANGE,ready:EVENT_READY})
  });
  window.dispatchEvent(new CustomEvent(EVENT_READY,{detail:{profile:get()}}));
})();

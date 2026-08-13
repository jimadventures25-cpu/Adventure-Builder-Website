(() => {
  'use strict';

  const LOCAL_KEY = 'ab-accessibility-profile-v1';
  const SESSION_KEY = 'ab-accessibility-session-v1';
  const EVENT_CHANGE = 'adventurebuilder:accessibilitychange';
  const EVENT_READY = 'adventurebuilder:accessibilityready';

  const requirements = Object.freeze({
    stepFree: {label:'Step-free access', group:'Mobility & routes'},
    wheelchair: {label:'Wheelchair suitable', group:'Mobility & routes'},
    mobilityScooter: {label:'Mobility scooter suitable', group:'Mobility & routes'},
    firmSurface: {label:'Firm or smooth surface', group:'Mobility & routes'},
    lowGradient: {label:'Gentler gradients', group:'Mobility & routes'},
    shortDistance: {label:'Shorter distances', group:'Mobility & routes'},
    restPoints: {label:'Regular rest points or seating', group:'Mobility & routes'},
    accessibleParking: {label:'Accessible parking', group:'Facilities'},
    accessibleToilet: {label:'Accessible toilet', group:'Facilities'},
    changingPlaces: {label:'Changing Places toilet', group:'Facilities'},
    assistanceDog: {label:'Assistance dog access', group:'Support'},
    companion: {label:'Companion or carer support', group:'Support'},
    adaptiveEquipment: {label:'Adaptive equipment or assistance', group:'Support'},
    quietSensory: {label:'Quieter / sensory-friendly setting', group:'Sensory & information'},
    visualInfo: {label:'Clear visual information', group:'Sensory & information'},
    hearingSupport: {label:'Hearing support / non-audio information', group:'Sensory & information'}
  });

  const factStatuses = Object.freeze({
    verified: {label:'Verified', rank:4},
    source: {label:'Source information', rank:3},
    reported: {label:'Reported', rank:2},
    sample: {label:'Stage 1 sample', rank:1},
    unknown: {label:'Not verified', rank:0}
  });

  const safeParse = (store,key) => {
    try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; }
  };
  const safeWrite = (store,key,value) => {
    try { store.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
  };
  const unique = values => [...new Set((Array.isArray(values)?values:[]).map(String).filter(k=>requirements[k]))];

  function normalise(input={}) {
    const selected = unique(input.selected);
    return {
      enabled: Boolean(input.enabled && selected.length),
      selected,
      remember: Boolean(input.remember),
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null
    };
  }

  function load() {
    const persistent = safeParse(localStorage,LOCAL_KEY);
    const session = safeParse(sessionStorage,SESSION_KEY);
    return normalise(session || persistent || {});
  }

  let current = load();

  function persist(profile) {
    const clean = normalise(profile);
    clean.updatedAt = new Date().toISOString();
    if (clean.remember) {
      safeWrite(localStorage,LOCAL_KEY,clean);
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    } else {
      safeWrite(sessionStorage,SESSION_KEY,clean);
      try { localStorage.removeItem(LOCAL_KEY); } catch {}
    }
    current = clean;
    window.dispatchEvent(new CustomEvent(EVENT_CHANGE,{detail:{profile:get()}}));
    return get();
  }

  function get() { return normalise(current); }
  function save(input={}) { return persist({...input,enabled:Boolean(input.enabled ?? true)}); }
  function clear() {
    try { localStorage.removeItem(LOCAL_KEY); } catch {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    current = normalise({});
    window.dispatchEvent(new CustomEvent(EVENT_CHANGE,{detail:{profile:get()}}));
    return get();
  }
  function label(key) { return requirements[key]?.label || key; }
  function statusLabel(status) { return factStatuses[status]?.label || factStatuses.unknown.label; }
  function statusRank(status) { return factStatuses[status]?.rank ?? 0; }
  function activeCount(profile=current) { const p=normalise(profile); return p.enabled?p.selected.length:0; }

  window.AdventureAccessibility = Object.freeze({
    requirements,factStatuses,normalise,get,save,clear,label,statusLabel,statusRank,activeCount,
    events:Object.freeze({change:EVENT_CHANGE,ready:EVENT_READY})
  });
  window.dispatchEvent(new CustomEvent(EVENT_READY,{detail:{profile:get()}}));
})();

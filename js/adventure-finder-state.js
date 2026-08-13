(() => {
  'use strict';
  const KEY='ab-adventure-finder-v2';
  const SAVED_KEY='ab-adventure-finder-saved-v1';
  const VAN_KEY='ab-vanlife-profile-v1';

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};

  function normalise(input={}){
    return {
      area:String(input.area || 'Anywhere'),
      stay:String(input.stay || 'Any stay'),
      drive:String(input.drive || 'No limit'),
      useVan:Boolean(input.useVan),
      selected:Array.isArray(input.selected)?[...new Set(input.selected.map(String))]:[]
    };
  }

  function load(){return normalise(read(KEY,{}));}
  function save(value){return write(KEY,normalise(value));}
  function clear(){try{localStorage.removeItem(KEY)}catch{} return normalise({});}
  function getVan(){return read(VAN_KEY,{});}
  function saveIdea(id){const ids=read(SAVED_KEY,[]); if(!ids.includes(id)) ids.push(id); return write(SAVED_KEY,ids);}
  function createTripHandoff(place,prefs){
    return write('ab-trip-planner-handoff-v1',{
      placeId:place.id, placeName:place.name, region:place.region, source:'adventure-finder',
      coordinates:place.coords, vanProfile:prefs.useVan?getVan():null, preferences:normalise(prefs),
      accessibility:window.AdventureAccessibility?.get?.() || null,
      createdAt:new Date().toISOString()
    });
  }

  window.AdventureFinderState = Object.freeze({normalise,load,save,clear,getVan,saveIdea,createTripHandoff});
})();

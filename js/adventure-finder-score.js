(() => {
  'use strict';

  function vehicleFit(place, profile={}){
    const h=Number(profile.height)||0,l=Number(profile.length)||0,w=Number(profile.weight)||0;
    const issues=[];
    if(h && place.vehicle?.maxHeight && h>place.vehicle.maxHeight) issues.push(`vehicle height exceeds ${place.vehicle.maxHeight} m`);
    if(l && place.vehicle?.maxLength && l>place.vehicle.maxLength) issues.push(`vehicle length exceeds ${place.vehicle.maxLength} m`);
    if(w && place.vehicle?.maxWeight && w>place.vehicle.maxWeight) issues.push(`vehicle weight exceeds ${place.vehicle.maxWeight} kg`);
    return {fit:issues.length===0,issues};
  }

  function band(score,matched,total){
    if(total===0) return 'Good fit';
    const ratio=matched/Math.max(total,1);
    if(score>=80 && ratio>=.75) return 'Excellent match';
    if(score>=58 && ratio>=.5) return 'Good match';
    return 'Possible match';
  }

  function evaluate(place,prefs,vanProfile={}){
    const area=(prefs.area||'Anywhere').toLowerCase().trim();
    if(area && area!=='anywhere' && !place.region.toLowerCase().includes(area) && !area.includes(place.region.toLowerCase())) return null;
    if(prefs.stay && prefs.stay!=='Any stay' && place.type!==prefs.stay) return null;

    const all=new Set([...(place.traits||[]),...(place.pois||[])]);
    const requested=prefs.selected||[];
    const matched=requested.filter(k=>all.has(k));
    const missing=requested.filter(k=>!all.has(k));
    const proximity=matched.filter(k=>place.distance?.[k]!=null).sort((a,b)=>place.distance[a]-place.distance[b]);

    let score=40;
    if(requested.length) score += (matched.length/requested.length)*45;
    else score += 25;
    if(place.region.toLowerCase()===area) score+=8;
    if(prefs.stay && prefs.stay!=='Any stay' && place.type===prefs.stay) score+=7;

    let van={fit:true,issues:[]};
    if(prefs.useVan){
      van=vehicleFit(place,vanProfile);
      if(place.traits.includes('van')) score+=8;
      if(van.fit) score+=5; else score-=45;
    }
    score=Math.max(0,Math.min(100,Math.round(score)));

    return {...place,matched,missing,proximity,score,matchLabel:band(score,matched.length,requested.length),van};
  }

  function rank(places,prefs,vanProfile={}){
    return places.map(p=>evaluate(p,prefs,vanProfile)).filter(Boolean).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
  }

  window.AdventureFinderScore = Object.freeze({vehicleFit,evaluate,rank,band});
})();

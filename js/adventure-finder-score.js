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

  function accessibilityEvidence(place,profile={}){
    const A=window.AdventureAccessibility;
    const p=A?.normalise ? A.normalise(profile) : {enabled:false,selected:[]};
    const selected=p.enabled?p.selected:[];
    const matched=[],unknown=[],conflicts=[],facts=[];
    for(const key of selected){
      const fact=place.accessibility?.[key];
      const status=fact?.status || 'unknown';
      const value=fact?.value;
      const item={key,value,status,note:fact?.note||''};
      facts.push(item);
      if(status==='unknown' || typeof value!=='boolean') unknown.push(item);
      else if(value===false) conflicts.push(item);
      else matched.push(item);
    }
    const confirmed=matched.filter(x=>['verified','source'].includes(x.status));
    const lowerConfidence=matched.filter(x=>!['verified','source'].includes(x.status));
    let label='Accessibility off';
    if(selected.length){
      if(conflicts.length) label='Does not meet access needs';
      else if(unknown.length) label=matched.length?'Accessibility partly verified':'Accessibility not verified';
      else if(confirmed.length===selected.length) label='Accessibility verified';
      else label='Accessibility sample match';
    }
    return {enabled:selected.length>0,selected,matched,confirmed,lowerConfidence,unknown,conflicts,label};
  }

  function evaluate(place,prefs,vanProfile={},accessProfile={}){
    const area=(prefs.area||'Anywhere').toLowerCase().trim();
    if(area && area!=='anywhere' && !place.region.toLowerCase().includes(area) && !area.includes(place.region.toLowerCase())) return null;
    if(prefs.stay && prefs.stay!=='Any stay' && place.type!==prefs.stay) return null;

    const access=accessibilityEvidence(place,accessProfile);
    // An explicit conflict is treated as a hard mismatch for a selected access need.
    if(access.conflicts.length) return null;

    const all=new Set([...(place.traits||[]),...(place.pois||[])]);
    const requested=prefs.selected||[];
    const matched=requested.filter(k=>all.has(k));
    const missing=requested.filter(k=>!all.has(k));
    const proximity=matched.filter(k=>place.distance?.[k]!=null).sort((a,b)=>place.distance[a]-place.distance[b]);

    let score=40;
    if(requested.length) score += (matched.length/requested.length)*35;
    else score += 22;
    if(place.region.toLowerCase()===area) score+=8;
    if(prefs.stay && prefs.stay!=='Any stay' && place.type===prefs.stay) score+=7;

    if(access.enabled){
      const total=access.selected.length;
      score += (access.confirmed.length/Math.max(total,1))*24;
      score += (access.lowerConfidence.length/Math.max(total,1))*12;
      score -= (access.unknown.length/Math.max(total,1))*8;
    }

    let van={fit:true,issues:[]};
    if(prefs.useVan){
      van=vehicleFit(place,vanProfile);
      if(place.traits.includes('van')) score+=8;
      if(van.fit) score+=5; else score-=45;
    }
    score=Math.max(0,Math.min(100,Math.round(score)));

    return {...place,matched,missing,proximity,score,matchLabel:band(score,matched.length,requested.length),van,access};
  }

  function rank(places,prefs,vanProfile={},accessProfile={}){
    return places.map(p=>evaluate(p,prefs,vanProfile,accessProfile)).filter(Boolean).sort((a,b)=>{
      const au=(a.access?.unknown?.length||0),bu=(b.access?.unknown?.length||0);
      if(au!==bu) return au-bu;
      return b.score-a.score || a.name.localeCompare(b.name);
    });
  }

  window.AdventureFinderScore = Object.freeze({vehicleFit,accessibilityEvidence,evaluate,rank,band});
})();

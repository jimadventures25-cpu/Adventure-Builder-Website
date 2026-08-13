(() => {
  'use strict';
  const Data=window.AdventureFinderData, State=window.AdventureFinderState, Score=window.AdventureFinderScore, MapUI=window.AdventureFinderMap;
  if(!Data||!State||!Score)return;

  const roots=[...document.querySelectorAll('[data-adventure-finder]')];
  const icon={Campsite:'⛺','Campervan Site':'🚐','Permitted Overnight Stop':'🌙'};
  const label=k=>Data.labels[k]||k;

  function getPrefs(root){
    return State.normalise({
      area:root.querySelector('[data-af-area]')?.value,
      stay:root.querySelector('[data-af-stay]')?.value,
      drive:root.querySelector('[data-af-drive]')?.value,
      useVan:root.querySelector('[data-af-use-van]')?.checked,
      selected:[...root.querySelectorAll('[data-af-choice][aria-pressed="true"]')].map(b=>b.dataset.afChoice)
    });
  }

  function setPrefs(root,prefs){
    root.querySelector('[data-af-area]').value=prefs.area;
    root.querySelector('[data-af-stay]').value=prefs.stay;
    root.querySelector('[data-af-drive]').value=prefs.drive;
    const van=root.querySelector('[data-af-use-van]'); if(van)van.checked=!!prefs.useVan;
    root.querySelectorAll('[data-af-choice]').forEach(b=>b.setAttribute('aria-pressed',String(prefs.selected.includes(b.dataset.afChoice))));
  }

  function selectedSummary(prefs){
    const parts=[];
    if(prefs.area && prefs.area!=='Anywhere') parts.push(prefs.area);
    if(prefs.stay && prefs.stay!=='Any stay') parts.push(prefs.stay);
    if(prefs.selected.length) parts.push(`${prefs.selected.length} preference${prefs.selected.length===1?'':'s'}`);
    if(prefs.useVan) parts.push('My Van');
    return parts.length?parts.join(' · '):'Anywhere · no extra preferences';
  }

  function renderVan(root){
    const box=root.querySelector('[data-af-van-summary]'); if(!box)return;
    const p=State.getVan();
    if(!Object.keys(p).length){box.textContent='No van profile saved yet. You can still search normally.';return;}
    box.textContent=`${p.name||'My Van'}${p.model?' · '+p.model:''}${p.height?` · ${p.height} m high`:''}${p.length?` · ${p.length} m long`:''}`;
  }

  function resultCard(r,prefs){
    const reasons=r.matched.slice(0,4).map(k=>`<li><span>✓</span>${label(k)}${r.distance?.[k]!=null?` <small>${r.distance[k]} km away</small>`:''}</li>`).join('');
    const general=!reasons?`<li><span>✓</span>${r.region}</li><li><span>✓</span>${r.type}</li>`:'';
    const van=prefs.useVan?(r.van.fit?'<li><span>✓</span>Fits your saved van profile</li>':`<li class="warn"><span>!</span>${r.van.issues.join(' · ')}</li>`):'';
    const A=window.AdventureAccessibility;
    const accessMatched=(r.access?.matched||[]).slice(0,4).map(f=>`<li class="access"><span>♿</span>${A?.label?.(f.key)||f.key} <small>${A?.statusLabel?.(f.status)||'Not verified'}</small></li>`).join('');
    const accessUnknown=(r.access?.unknown||[]).slice(0,4).map(f=>A?.label?.(f.key)||f.key);
    const accessBadge=r.access?.enabled?`<strong class="af-access-label ${r.access.unknown.length?'needs-check':'meets'}">${r.access.label}</strong>`:'';
    return `<article class="af-result" data-af-card="${r.id}">
      <div class="af-result-visual tone-${r.imageTone||'default'}"><span>${icon[r.type]||'📍'}</span><small>Stage 1 sample</small></div>
      <div class="af-result-copy">
        <div class="af-result-heading"><div><p>${r.type} · ${r.region}</p><h3>${r.name}</h3></div><div class="af-result-badges"><strong class="af-match-label">${r.matchLabel}</strong>${accessBadge}</div></div>
        <p class="af-result-summary">${r.summary}</p>
        <ul class="af-reasons">${van}${accessMatched}${reasons||general}</ul>
        ${accessUnknown.length?`<p class="af-access-unknown"><strong>Accessibility to verify:</strong> ${accessUnknown.join(', ')}.</p>`:''}
        ${r.missing.length?`<details class="af-missing"><summary>Also check</summary><p>This sample does not list: ${r.missing.slice(0,4).map(label).join(', ')}.</p></details>`:''}
        <div class="af-result-actions"><button type="button" class="af-link" data-af-map-focus="${r.id}">Show on map</button><span></span><button type="button" class="af-btn secondary" data-af-save="${r.id}">Save idea</button><button type="button" class="af-btn primary" data-af-plan="${r.id}">Build adventure</button></div>
      </div>
    </article>`;
  }

  function render(root,{scroll=false,prefs=null}={}){
    const committed=State.normalise(prefs || root._afCommitted || getPrefs(root));
    root._afCommitted=committed;
    const accessProfile=window.AdventureAccessibility?.get?.() || {};
    const results=Score.rank(Data.places,committed,State.getVan(),accessProfile);
    root._afResults=results;
    root.querySelector('[data-af-count]').textContent=`${results.length} place${results.length===1?'':'s'}`;
    root.querySelector('[data-af-summary]').textContent=selectedSummary(committed)+(window.AdventureAccessibility?.activeCount?.(accessProfile)?` · Accessibility ${window.AdventureAccessibility.activeCount(accessProfile)} need${window.AdventureAccessibility.activeCount(accessProfile)===1?'':'s'}`:'');
    const list=root.querySelector('[data-af-results]');
    list.innerHTML=results.length?results.map(r=>resultCard(r,committed)).join(''):`<div class="af-empty"><p class="af-kicker">No matches yet</p><h3>Try opening the search a little.</h3><p>Change the area, base type or one of your selected priorities.</p><button type="button" class="af-btn secondary" data-af-reset-results>Reset filters</button></div>`;
    root.querySelector('[data-af-stage-note]').textContent='Stage 1 uses sample places so we can prove the search, ranking, map and accessibility architecture before connecting live place data.';
    const explainer=root.querySelector('[data-af-accessibility-explainer]');
    if(explainer){const n=window.AdventureAccessibility?.activeCount?.(accessProfile)||0;explainer.hidden=!n;explainer.textContent=n?`Accessibility is active with ${n} need${n===1?'':'s'}. Results with a known conflict are excluded; unknown access facts are shown as not verified.`:'';}
    if(MapUI) MapUI.render(root,results,results[0]?.id||null);
    if(scroll) root.querySelector('[data-af-results-heading]')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function clear(root){const clean=State.clear();root._afCommitted=clean;setPrefs(root,clean);renderVan(root);root.querySelector('[data-af-live-selection]').textContent=selectedSummary(clean);render(root,{prefs:clean});}

  function bind(root){
    const loaded=State.load(); root._afCommitted=loaded; setPrefs(root,loaded); renderVan(root);
    root.querySelectorAll('[data-af-choice]').forEach(b=>b.addEventListener('click',()=>{
      b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));
      root.querySelector('[data-af-live-selection]').textContent=selectedSummary(getPrefs(root));
    }));
    root.querySelector('[data-af-search]').addEventListener('click',()=>{const p=getPrefs(root);State.save(p);root._afCommitted=p;render(root,{scroll:true,prefs:p});});
    root.querySelector('[data-af-clear]').addEventListener('click',()=>clear(root));
    root.querySelector('[data-af-use-van]')?.addEventListener('change',()=>{renderVan(root);root.querySelector('[data-af-live-selection]').textContent=selectedSummary(getPrefs(root));});
    ['[data-af-area]','[data-af-stay]','[data-af-drive]'].forEach(selector=>root.querySelector(selector)?.addEventListener('change',()=>{root.querySelector('[data-af-live-selection]').textContent=selectedSummary(getPrefs(root));}));
    root.querySelector('[data-af-filter-toggle]')?.addEventListener('click',()=>root.querySelector('[data-af-filters]')?.classList.toggle('is-open'));
    root.addEventListener('af:select',e=>{
      const id=e.detail?.id; const card=root.querySelector(`[data-af-card="${CSS.escape(id)}"]`); if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
    });
    root.addEventListener('click',e=>{
      const focus=e.target.closest('[data-af-map-focus]'); if(focus){const r=root._afResults?.find(x=>x.id===focus.dataset.afMapFocus);MapUI?.focus(root,r);return;}
      const reset=e.target.closest('[data-af-reset-results]'); if(reset){clear(root);return;}
      const save=e.target.closest('[data-af-save]'); if(save){const r=Data.places.find(x=>x.id===save.dataset.afSave);const ok=State.saveIdea(r.id);root.querySelector('[data-af-status]').textContent=ok?`${r.name} saved as an idea on this device.`:'Could not save on this device.';return;}
      const plan=e.target.closest('[data-af-plan]'); if(plan){const r=Data.places.find(x=>x.id===plan.dataset.afPlan);const ok=State.createTripHandoff(r,root._afCommitted || getPrefs(root));root.querySelector('[data-af-status]').textContent=ok?`${r.name} is ready for Trip Planner.`:'Could not prepare the Trip Planner hand-off.';}
    });
    root.querySelector('[data-af-live-selection]').textContent=selectedSummary(getPrefs(root));
    const refreshAccess=()=>render(root,{prefs:root._afCommitted || loaded});
    if(window.AdventureAccessibility?.events?.change) window.addEventListener(window.AdventureAccessibility.events.change,refreshAccess);
    else window.addEventListener('adventurebuilder:accessibilityready',refreshAccess,{once:true});
    render(root,{prefs:loaded});
  }

  roots.forEach(bind);
})();

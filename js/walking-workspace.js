(() => {
  'use strict';
  const planner = document.getElementById('walk-planner');
  const collapse = document.getElementById('walk-collapse-planner');
  const openPlanner = document.getElementById('walk-open-planner');
  const drawer = document.getElementById('walk-poi-drawer');
  const poiToggles = [document.getElementById('walk-toggle-pois'), document.getElementById('walk-open-pois'), document.getElementById('walk-route-places')].filter(Boolean);
  const closePois = document.getElementById('walk-close-pois');

  const setPlanner = (open) => {
    if (!planner) return;
    planner.classList.toggle('is-collapsed', !open);
    collapse?.setAttribute('aria-expanded', String(open));
    openPlanner?.setAttribute('aria-expanded', String(open));
    collapse?.setAttribute('aria-label', open ? 'Collapse route planner' : 'Open route planner');
  };
  const setPois = (open) => {
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    poiToggles.forEach((button) => button.setAttribute('aria-expanded', String(open)));
  };

  collapse?.addEventListener('click', () => setPlanner(planner.classList.contains('is-collapsed')));
  openPlanner?.addEventListener('click', () => setPlanner(planner.classList.contains('is-collapsed')));
  poiToggles.forEach((button) => button.addEventListener('click', () => setPois(!drawer.classList.contains('is-open'))));
  closePois?.addEventListener('click', () => setPois(false));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setPois(false); });

  if (window.matchMedia('(max-width: 900px)').matches) setPlanner(false);
})();

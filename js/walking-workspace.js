(() => {
  'use strict';
  const planner = document.getElementById('walk-planner');
  const collapse = document.getElementById('walk-collapse-planner');
  const openPlanner = document.getElementById('walk-open-planner');
  const drawer = document.getElementById('walk-poi-drawer');
  const poiToggles = [document.getElementById('walk-toggle-pois'), document.getElementById('walk-open-pois'), document.getElementById('walk-route-places')].filter(Boolean);
  const closePois = document.getElementById('walk-close-pois');
  const siteMenuToggle = document.getElementById('walk-site-menu-toggle');
  const siteSidebar = document.querySelector('.ab-site-sidebar');


  // Walking is a map-first workspace. Keep the main website navigation out of
  // the way until the user asks for it, then show it as an overlay drawer.
  let siteNavBackdrop = null;
  const ensureSiteNavBackdrop = () => {
    if (siteNavBackdrop) return siteNavBackdrop;
    siteNavBackdrop = document.createElement('button');
    siteNavBackdrop.type = 'button';
    siteNavBackdrop.className = 'walk-site-nav-backdrop';
    siteNavBackdrop.setAttribute('aria-label', 'Close Adventure Builder menu');
    document.body.appendChild(siteNavBackdrop);
    siteNavBackdrop.addEventListener('click', () => setSiteNav(false));
    return siteNavBackdrop;
  };
  const setSiteNav = (open) => {
    if (!siteSidebar || window.matchMedia('(max-width: 900px)').matches) return;
    ensureSiteNavBackdrop();
    document.body.classList.toggle('walk-site-nav-open', open);
    siteMenuToggle?.setAttribute('aria-expanded', String(open));
  };

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
  siteMenuToggle?.addEventListener('click', () => setSiteNav(!document.body.classList.contains('walk-site-nav-open')));
  siteSidebar?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setSiteNav(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setPois(false);
    setSiteNav(false);
  });

  if (window.matchMedia('(max-width: 900px)').matches) setPlanner(false);
})();

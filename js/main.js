(() => {
  'use strict';

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.site-nav');
  const navLinks = [...(nav?.querySelectorAll('a') ?? [])];

  menuButton?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open') ?? false;
    menuButton.setAttribute('aria-expanded', String(open));
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      nav?.classList.remove('open');
      menuButton?.setAttribute('aria-expanded', 'false');
    });
  });

  const page = document.body.dataset.page || 'index';
  const pageFiles = {
    index: 'index.html', explore: 'explore.html', camping: 'camping.html',
    'walking-hiking': 'walking-hiking.html', 'van-life': 'van-life.html',
    'trip-planner': 'trip-planner.html', gallery: 'gallery.html',
    journal: 'journal.html', passport: 'passport.html', community: 'community.html'
  };
  navLinks.forEach((link) => {
    const target = link.getAttribute('href')?.split('#')[0] || 'index.html';
    link.classList.toggle('active', target === pageFiles[page]);
  });

  const toast = document.createElement('div');
  toast.className = 'category-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer;

  document.querySelectorAll('.design-button').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.category || 'This';
      toast.textContent = `${category} area is ready. Its account-connected creation tools will be added here as that app feature is built.`;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

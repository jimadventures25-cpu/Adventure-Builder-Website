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

  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.05, 0.25, 0.6] });
    observedSections.forEach((section) => observer.observe(section));
  }

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

(() => {
  'use strict';

  const routes = [
    ['index.html','Home','home','#ff7900'],
    ['adventure-finder.html','Adventure Finder','search','#54d65a'],
    ['adventures.html','My Adventure World','map','#00bde8'],
    ['trip-planner.html','Trip Planner','route','#22a7f0'],
    ['walking-hiking.html','Walking & Hiking','walk','#93dc00'],
    ['outdoor-skills.html','Survival & Foraging','leaf','#ff8b18'],
    ['paddling.html','Paddle & Kayak','paddle','#00c9d7'],
    ['van-life.html','Vanlife','van','#9a52e8'],
    ['passport.html','Adventure Passport','passport','#e73fa8'],
    ['gallery.html','Gallery','image','#ffd21f'],
    ['journal.html','Journal','book','#ffb31a'],
    ['accident-assistance.html','Accident Assistance','alert','#f04444'],
    ['studio.html','Adventure Studio','studio','#7766ff'],
    ['community.html','Community','users','#ff5a4f'],
    ['partners.html','Partners','handshake','#b3bbc1']
  ];

  const icons = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
    map:'<path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2z"/><path d="M8 4v13M16 7v13"/>',
    route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h-1"/>',
    walk:'<circle cx="13" cy="4" r="2"/><path d="m10 22 2-7-3-3 2-5 4 2 3 4"/><path d="m7 14-3 5M14 15l5 6"/>',
    leaf:'<path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z"/><path d="M5 20c3-5 7-8 12-11"/>',
    paddle:'<path d="M5 4 19 20M19 4 5 20"/><path d="m3 2 4 4-2 2-4-4zM21 2l-4 4 2 2 4-4z"/>',
    van:'<path d="M3 7h13l4 5v6H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M16 8v5h4"/>',
    passport:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M9 11h6M12 8v6"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m5 17 5-5 3 3 2-2 4 4"/>',
    book:'<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23z"/>',
    studio:'<path d="M4 20 16 8"/><path d="m14 6 4-4 4 4-4 4z"/><path d="M5 4v5M2.5 6.5h5M19 15v6M16 18h6"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v4M12 17h.01"/>',
    users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5"/>',
    handshake:'<path d="m9 12 3 3a2 2 0 0 0 3-3l-4-4 2-2a3 3 0 0 1 4 0l4 4"/><path d="m3 9 5-5 4 4-6 6zM21 9l-4-4"/><path d="m7 15 2 2m1-1 2 2m1-1 2 2"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };

  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.more}</svg>`;
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isActive = href => file === href;
  const link = ([href,label,icon,color], extra='') => `<a class="ab-sidebar-link${isActive(href)?' active':''} ${extra}" href="${href}" style="--tab-color:${color || '#ff7900'}"${isActive(href)?' aria-current="page"':''}>${svg(icon)}<span>${label}</span></a>`;

  const sidebar = document.createElement('aside');
  sidebar.className = 'ab-site-sidebar';
  sidebar.setAttribute('aria-label','Website navigation');
  sidebar.innerHTML = `
    <div class="ab-sidebar-brand">
      <a href="index.html" aria-label="Adventure Builder home"><img src="images/adventure-builder-logo.png" alt="Adventure Builder logo"></a>
      <a href="index.html"><strong>Adventure<br>Builder</strong></a>
      <button class="ab-sidebar-collapse" type="button" aria-label="Collapse navigation" title="Collapse navigation">‹</button>
    </div>
    <nav class="ab-sidebar-links" aria-label="Adventure Builder sections">
      ${routes.map(r => link(r)).join('')}
    </nav>
    <div class="ab-sidebar-footer">
      <a class="ab-sidebar-link" href="index.html#download">${svg('more')}<span>Get the App</span></a>
    </div>`;
  document.body.prepend(sidebar);

  const collapse = sidebar.querySelector('.ab-sidebar-collapse');
  collapse?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const collapsed = document.body.classList.toggle('ab-sidebar-collapsed');
    collapse.textContent = collapsed ? '›' : '‹';
    collapse.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  });

  const mobile = document.createElement('nav');
  mobile.className = 'ab-mobile-nav';
  mobile.setAttribute('aria-label','Mobile navigation');
  const mobilePrimary = ['index.html','adventure-finder.html','trip-planner.html','community.html'].map(href => routes.find(r => r[0] === href)).filter(Boolean);
  const moreIsActive = !mobilePrimary.some(([href]) => isActive(href));
  mobile.innerHTML = mobilePrimary.map(([href,label,icon,color]) => `<a href="${href}" style="--tab-color:${color || '#ff7900'}" class="${isActive(href)?'active':''}"${isActive(href)?' aria-current="page"':''}>${svg(icon)}<span>${label === 'Adventure Finder' ? 'Finder' : label === 'Trip Planner' ? 'Plan' : label}</span></a>`).join('') + `<button type="button" data-ab-more class="${moreIsActive?'active':''}" aria-expanded="false">${svg('more')}<span>More</span></button>`;
  document.body.appendChild(mobile);

  const backdrop = document.createElement('div');
  backdrop.className = 'ab-mobile-more-backdrop';
  const sheet = document.createElement('section');
  sheet.className = 'ab-mobile-more';
  sheet.setAttribute('aria-label','More website sections');
  sheet.innerHTML = `<div class="ab-mobile-more-head"><div><strong>Explore Adventure Builder</strong><small>All website sections</small></div><button class="ab-mobile-more-close" type="button" aria-label="Close navigation">×</button></div><nav class="ab-mobile-more-grid">${routes.slice(2).map(([href,label,icon,color])=>`<a href="${href}" style="--tab-color:${color || '#ff7900'}" class="${isActive(href)?'active':''}"${isActive(href)?' aria-current="page"':''}>${svg(icon)}<span>${label}</span></a>`).join('')}</nav>`;
  document.body.append(backdrop, sheet);

  const moreButton = mobile.querySelector('[data-ab-more]');
  const close = () => {
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
    moreButton?.setAttribute('aria-expanded','false');
    document.body.classList.remove('ab-mobile-menu-open');
  };
  const open = () => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
    moreButton?.setAttribute('aria-expanded','true');
    document.body.classList.add('ab-mobile-menu-open');
  };
  moreButton?.addEventListener('click', () => sheet.classList.contains('open') ? close() : open());
  sheet.querySelector('.ab-mobile-more-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
})();

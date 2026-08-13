(() => {
  'use strict';

  const planner = window.AdventureBuilderTrailPlanner;
  if (!planner) return;

  const findButton = document.getElementById('walk-find-nearby-route');
  const makeButton = document.getElementById('walk-make-route');
  const makePanel = document.getElementById('walk-make-route-panel');
  const nearbyPanel = document.getElementById('walk-nearby-routes');
  const distanceInput = document.getElementById('walk-route-distance');
  const distanceOutput = document.getElementById('walk-route-distance-output');
  const styleSelect = document.getElementById('walk-route-style');
  const generateButton = document.getElementById('walk-generate-route');
  const regenerateButton = document.getElementById('walk-regenerate-route');
  const activityButtons = [...document.querySelectorAll('[data-walk-activity]')];

  const METRES_PER_MILE = 1609.344;
  const ACTIVITY = {
    walk: { label: 'walking', transport: 'walking', findLabel: 'walking/hiking routes' },
    jog: { label: 'jogging', transport: 'walking', findLabel: 'running/walking routes' },
    cycle: { label: 'cycling', transport: 'bicycle', findLabel: 'cycle routes' }
  };

  let generating = false;
  let seedCounter = 0;
  let activity = 'walk';

  const setStatus = (message, kind = '') => planner.setStatus(message, kind);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function setActivity(next) {
    if (!ACTIVITY[next]) return;
    activity = next;
    activityButtons.forEach((button) => {
      const selected = button.dataset.walkActivity === activity;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const cfg = ACTIVITY[activity];
    if (findButton) findButton.querySelector('small').textContent = activity === 'cycle' ? 'Nearby mapped cycle routes' : (activity === 'jog' ? 'Nearby routes suitable for a run' : 'Nearby established walks');
    if (makeButton) makeButton.querySelector('small').textContent = `Create a new ${cfg.label} loop from here`;
    nearbyPanel.hidden = true;
  }

  function ensureEstablishedRouteLayer() {
    const map = planner.map;
    if (!map.getSource('established-route-preview')) {
      map.addSource('established-route-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'established-route-preview-casing', type: 'line', source: 'established-route-preview',
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 }
      });
      map.addLayer({
        id: 'established-route-preview-line', type: 'line', source: 'established-route-preview',
        paint: { 'line-color': '#e36a00', 'line-width': 4, 'line-opacity': 0.95, 'line-dasharray': [1.5, 1] }
      });
    }
  }

  async function previewEstablishedRoute(route) {
    setStatus(`Loading ${route.name}…`);
    const response = await fetch('/.netlify/functions/nearby-walking-routes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationId: route.osmRelationId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.geometry?.coordinates?.length) throw new Error(payload.error || 'That route could not be previewed.');
    ensureEstablishedRouteLayer();
    planner.map.getSource('established-route-preview').setData({ type: 'Feature', properties: { name: route.name }, geometry: payload.geometry });
    const all = payload.geometry.coordinates.flat();
    if (all.length) {
      const bounds = all.reduce((box, coordinate) => box.extend(coordinate), new maplibregl.LngLatBounds(all[0], all[0]));
      planner.map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 750 });
    }
    setStatus(`${route.name} highlighted from OpenStreetMap. Check access, conditions and local restrictions before setting off.`, 'success');
  }


  function captureMapView() {
    const map = planner?.map;
    if (!map || typeof map.getCenter !== 'function') return null;
    const center = map.getCenter();
    return {
      center: [Number(center.lng), Number(center.lat)],
      zoom: typeof map.getZoom === 'function' ? map.getZoom() : undefined,
      bearing: typeof map.getBearing === 'function' ? map.getBearing() : undefined,
      pitch: typeof map.getPitch === 'function' ? map.getPitch() : undefined
    };
  }

  function restoreMapView(view) {
    const map = planner?.map;
    if (!view || !map || typeof map.easeTo !== 'function') return;
    const options = { center: view.center, duration: 500, essential: true };
    if (Number.isFinite(view.zoom)) options.zoom = view.zoom;
    if (Number.isFinite(view.bearing)) options.bearing = view.bearing;
    if (Number.isFinite(view.pitch)) options.pitch = view.pitch;
    map.easeTo(options);
  }

  async function makeRoute() {
    if (generating) return;
    generating = true;
    if (generateButton) generateButton.disabled = true;
    if (regenerateButton) regenerateButton.disabled = true;
    let originalView = null;

    try {
      const miles = clamp(Number(distanceInput?.value || 3), 1, 10);
      const targetMetres = miles * METRES_PER_MILE;
      const style = styleSelect?.value || 'balanced';
      const cfg = ACTIVITY[activity];
      originalView = captureMapView();
      setStatus(`Creating a ${miles} mile ${cfg.label} loop near you…`);

      const start = await planner.getCurrentLocation();
      const seed = (Date.now() ^ (++seedCounter * 2654435761)) >>> 0;
      const response = await fetch('/.netlify/functions/trail-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, targetMetres, style, activity, seed })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const stage = payload?.diagnostic?.stage ? ` [${payload.diagnostic.stage}]` : '';
        throw new Error(`${payload.error || 'The automatic route could not be generated.'}${stage}`);
      }
      if (!payload.route?.geometry?.coordinates?.length || !Array.isArray(payload.planningPoints)) {
        throw new Error('The route service returned an incomplete loop.');
      }

      const actualMiles = payload.route.distance / METRES_PER_MILE;
      planner.applyRoute(
        payload.route,
        payload.planningPoints,
        `Made a ${actualMiles.toFixed(1)} mile ${cfg.label} loop. Use “Try a different route” for another one.`
      );
      const trailName = document.getElementById('trail-name');
      if (trailName && !trailName.value.trim()) trailName.value = `Adventure Builder ${miles} mile ${cfg.label} loop`;
      regenerateButton.hidden = false;
    } catch (error) {
      restoreMapView(originalView);
      setStatus(error.message || 'A route could not be generated.', 'error');
    } finally {
      generating = false;
      if (generateButton) generateButton.disabled = false;
      if (regenerateButton) regenerateButton.disabled = false;
    }
  }

  function routeDistanceLabel(metres) {
    if (!Number.isFinite(metres)) return '';
    const miles = metres / METRES_PER_MILE;
    return miles < 0.1 ? `${Math.round(metres)} m away` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi away`;
  }

  async function findNearbyRoutes() {
    findButton.disabled = true;
    makePanel.hidden = true;
    nearbyPanel.hidden = false;
    const cfg = ACTIVITY[activity];
    nearbyPanel.innerHTML = `<p class="walk-smart-loading">Finding nearby ${escapeHtml(cfg.findLabel)}…</p>`;
    setStatus(`Looking for nearby ${cfg.findLabel}…`);
    try {
      const start = await planner.getCurrentLocation();
      const response = await fetch('/.netlify/functions/nearby-walking-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: start.lat, lon: start.lon, radius: 12000, activity })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Nearby routes could not be loaded.');
      const routes = payload.routes || [];
      if (!routes.length) {
        nearbyPanel.innerHTML = `<p class="walk-smart-loading">No mapped ${escapeHtml(cfg.findLabel)} were found nearby. Try “Make me a route” instead.</p>`;
        setStatus('No established routes were found nearby. You can still generate a new loop.', 'warning');
        return;
      }
      nearbyPanel.innerHTML = routes.slice(0, 8).map((route, index) => `
        <button class="walk-nearby-route-item" type="button" data-nearby-index="${index}">
          <span><strong>${escapeHtml(route.name)}</strong><small>${escapeHtml(route.networkLabel || 'Mapped route')}${route.ref ? ` · ${escapeHtml(route.ref)}` : ''}</small></span>
          <em>${routeDistanceLabel(route.distanceFromUser)}</em>
        </button>`).join('');
      nearbyPanel.onclick = (event) => {
        const button = event.target.closest('[data-nearby-index]');
        if (!button) return;
        const route = routes[Number(button.dataset.nearbyIndex)];
        if (!route) return;
        previewEstablishedRoute(route).catch((error) => {
          planner.map.flyTo({ center: [route.lon, route.lat], zoom: 13.5, duration: 750, essential: true });
          setStatus(error.message || `${route.name} is near the centre of the map.`, 'warning');
        });
      };
      setStatus(`Found ${routes.length} mapped route${routes.length === 1 ? '' : 's'} nearby.`, 'success');
    } catch (error) {
      nearbyPanel.innerHTML = `<p class="walk-smart-loading">${escapeHtml(error.message || 'Nearby routes could not be loaded.')}</p>`;
      setStatus(error.message || 'Nearby routes could not be loaded.', 'error');
    } finally {
      findButton.disabled = false;
    }
  }

  activityButtons.forEach((button) => button.addEventListener('click', () => setActivity(button.dataset.walkActivity)));
  distanceInput?.addEventListener('input', () => { distanceOutput.textContent = `${distanceInput.value} mile${distanceInput.value === '1' ? '' : 's'}`; });
  makeButton?.addEventListener('click', () => { nearbyPanel.hidden = true; makePanel.hidden = !makePanel.hidden; });
  findButton?.addEventListener('click', findNearbyRoutes);
  generateButton?.addEventListener('click', makeRoute);
  regenerateButton?.addEventListener('click', makeRoute);
  setActivity('walk');
})();

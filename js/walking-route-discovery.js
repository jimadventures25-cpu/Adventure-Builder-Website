(() => {
  'use strict';

  const planner = window.AdventureBuilderTrailPlanner;
  const loopEngine = window.AdventureBuilderWalkingLoopEngine;
  if (!planner || !loopEngine) return;

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
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

  async function routePoints(points, mode) {
    const response = await fetch('/.netlify/functions/trail-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, activity: mode })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The route could not be calculated.');
    const route = payload.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('No routable route was returned.');
    return route;
  }

  function captureMapView() {
    const center = planner.map.getCenter();
    return { center: [center.lng, center.lat], zoom: planner.map.getZoom(), bearing: planner.map.getBearing(), pitch: planner.map.getPitch() };
  }

  function restoreMapView(view) {
    if (!view) return;
    planner.map.easeTo({ ...view, duration: 500, essential: true });
  }

  async function makeRoute() {
    if (generating) return;
    generating = true;
    generateButton.disabled = true;
    regenerateButton.disabled = true;
    const miles = clamp(Number(distanceInput.value || 3), 1, 10);
    const targetMetres = miles * METRES_PER_MILE;
    const style = styleSelect.value;
    const cfg = ACTIVITY[activity];
    const originalView = captureMapView();
    setStatus(`Creating a ${miles} mile ${cfg.label} loop near you…`);

    try {
      const start = await planner.getCurrentLocation();
      const baseSeed = Math.floor((start.lat + 90) * 1e5) ^ Math.floor((start.lon + 180) * 1e5) ^ Date.now() ^ (++seedCounter * 2654435761);
      const plan = loopEngine.makePlan({ start, targetMetres, style, activity, seed: baseSeed >>> 0 });
      const successes = [];

      for (const pass of plan) {
        // Small batches keep route generation responsive without hammering the backend.
        for (let offset = 0; offset < pass.candidates.length; offset += 2) {
          const batch = pass.candidates.slice(offset, offset + 2);
          const results = await Promise.all(batch.map(async (points) => {
            try {
              const route = await routePoints(points, activity);
              const score = loopEngine.quality(route, targetMetres);
              return Number.isFinite(score) ? { route, points, score } : null;
            } catch (_) {
              return null;
            }
          }));
          successes.push(...results.filter(Boolean));
          if (successes.some((item) => item.score <= pass.tolerance)) break;
          await sleep(60);
        }
        if (successes.some((item) => item.score <= pass.tolerance)) break;
      }

      if (!successes.length) {
        restoreMapView(originalView);
        throw new Error(`I couldn't make a ${cfg.label} loop here after trying several nearby directions. Try a different mileage or start point.`);
      }

      successes.sort((a, b) => a.score - b.score);
      const best = successes[0];
      const actualMiles = best.route.distance / METRES_PER_MILE;
      planner.applyRoute(best.route, best.points, `Made a ${actualMiles.toFixed(1)} mile ${cfg.label} loop. Use “Try a different route” for another one.`);
      const trailName = document.getElementById('trail-name');
      if (trailName && !trailName.value.trim()) trailName.value = `Adventure Builder ${miles} mile ${cfg.label} loop`;
      regenerateButton.hidden = false;
    } catch (error) {
      setStatus(error.message || 'A route could not be generated.', 'error');
    } finally {
      generating = false;
      generateButton.disabled = false;
      regenerateButton.disabled = false;
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

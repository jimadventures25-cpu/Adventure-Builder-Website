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

  const METRES_PER_MILE = 1609.344;
  let generating = false;
  let lastGenerationKey = '';
  let seedCounter = 0;

  const setStatus = (message, kind = '') => planner.setStatus(message, kind);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    setStatus(`${route.name} highlighted from OpenStreetMap. Check access, conditions and waymarking before setting off.`, 'success');
  }

  function destinationPoint(lat, lon, distanceMetres, bearingDegrees) {
    const R = 6371000;
    const bearing = bearingDegrees * Math.PI / 180;
    const phi1 = lat * Math.PI / 180;
    const lambda1 = lon * Math.PI / 180;
    const delta = distanceMetres / R;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing));
    const lambda2 = lambda1 + Math.atan2(Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
    return { lat: phi2 * 180 / Math.PI, lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180 };
  }

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildCandidatePoints(start, targetMetres, style, random) {
    // A routed triangle usually grows beyond its straight-line perimeter.
    // Adjust the radius by style, then let Valhalla decide the real walkable path.
    const styleFactor = style === 'gentle' ? 0.17 : style === 'adventurous' ? 0.23 : 0.20;
    const radius = Math.max(350, targetMetres * styleFactor * (0.86 + random() * 0.28));
    const direction = random() * 360;
    const spread = style === 'gentle' ? 105 : style === 'adventurous' ? 145 : 125;
    const p1 = destinationPoint(start.lat, start.lon, radius, direction);
    const p2 = destinationPoint(start.lat, start.lon, radius * (0.88 + random() * 0.25), direction + spread + (random() - 0.5) * 22);
    return [start, p1, p2, { ...start }];
  }

  async function routePoints(points) {
    const response = await fetch('/.netlify/functions/trail-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The route could not be calculated.');
    const route = payload.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('No walkable route was returned.');
    return route;
  }

  async function makeRoute() {
    if (generating) return;
    generating = true;
    generateButton.disabled = true;
    regenerateButton.disabled = true;
    const miles = Number(distanceInput.value || 3);
    const targetMetres = miles * METRES_PER_MILE;
    const style = styleSelect.value;
    setStatus(`Creating a ${miles} mile walking loop near you…`);

    try {
      const start = await planner.getCurrentLocation();
      const baseSeed = Math.floor((start.lat + 90) * 1e5) ^ Math.floor((start.lon + 180) * 1e5) ^ Date.now() ^ (++seedCounter * 2654435761);
      const random = mulberry32(baseSeed >>> 0);
      const attempts = [];

      // Try several genuinely different directions. Pick the closest result to
      // the requested distance rather than claiming exact mileage before routing.
      for (let i = 0; i < 5; i += 1) {
        const points = buildCandidatePoints(start, targetMetres, style, random);
        try {
          const route = await routePoints(points);
          const score = Math.abs(route.distance - targetMetres) / targetMetres;
          attempts.push({ route, points, score });
          if (score <= 0.12) break;
        } catch (_) {
          // A candidate may fall in water, private/unconnected data, etc. Try a
          // different bearing rather than failing the whole feature.
        }
        await sleep(90);
      }

      if (!attempts.length) throw new Error('I could not build a suitable loop from this location. Try another distance or move the map to a nearby area.');
      attempts.sort((a, b) => a.score - b.score);
      const best = attempts[0];
      const actualMiles = best.route.distance / METRES_PER_MILE;
      planner.applyRoute(best.route, best.points, `Made a ${actualMiles.toFixed(1)} mile loop. Use “Try a different route” for another one.`);
      const trailName = document.getElementById('trail-name');
      if (trailName && !trailName.value.trim()) trailName.value = `Adventure Builder ${miles} mile loop`;
      regenerateButton.hidden = false;
      lastGenerationKey = `${miles}:${style}`;
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
    nearbyPanel.innerHTML = '<p class="walk-smart-loading">Finding established walking routes near you…</p>';
    setStatus('Looking for nearby established walking routes…');
    try {
      const start = await planner.getCurrentLocation();
      const response = await fetch('/.netlify/functions/nearby-walking-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: start.lat, lon: start.lon, radius: 12000 })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Nearby routes could not be loaded.');
      const routes = payload.routes || [];
      if (!routes.length) {
        nearbyPanel.innerHTML = '<p class="walk-smart-loading">No mapped hiking routes were found nearby. Try “Make me a route” instead.</p>';
        setStatus('No established routes were found nearby. You can still generate a new loop.', 'warning');
        return;
      }
      nearbyPanel.innerHTML = routes.slice(0, 8).map((route, index) => `
        <button class="walk-nearby-route-item" type="button" data-nearby-index="${index}">
          <span><strong>${escapeHtml(route.name)}</strong><small>${escapeHtml(route.networkLabel || 'Walking route')}${route.ref ? ` · ${escapeHtml(route.ref)}` : ''}</small></span>
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
      setStatus(`Found ${routes.length} established walking route${routes.length === 1 ? '' : 's'} nearby.`, 'success');
    } catch (error) {
      nearbyPanel.innerHTML = `<p class="walk-smart-loading">${escapeHtml(error.message || 'Nearby routes could not be loaded.')}</p>`;
      setStatus(error.message || 'Nearby routes could not be loaded.', 'error');
    } finally {
      findButton.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  distanceInput?.addEventListener('input', () => {
    distanceOutput.textContent = `${distanceInput.value} mile${distanceInput.value === '1' ? '' : 's'}`;
  });
  makeButton?.addEventListener('click', () => {
    nearbyPanel.hidden = true;
    makePanel.hidden = !makePanel.hidden;
  });
  findButton?.addEventListener('click', findNearbyRoutes);
  generateButton?.addEventListener('click', makeRoute);
  regenerateButton?.addEventListener('click', makeRoute);
})();

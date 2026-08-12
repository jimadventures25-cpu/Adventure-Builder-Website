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
    walk: { label: 'walking', routeType: 'walking', speedMph: 3.0 },
    jog: { label: 'jogging', routeType: 'jogging', speedMph: 5.5 },
    cycle: { label: 'cycling', routeType: 'cycling', speedMph: 11.0 }
  };

  let generating = false;
  let seedCounter = 0;
  let selectedActivity = 'walk';

  const setStatus = (message, kind = '') => planner.setStatus(message, kind);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function setActivity(activity) {
    if (!ACTIVITY[activity]) return;
    selectedActivity = activity;
    activityButtons.forEach((button) => {
      const active = button.dataset.walkActivity === activity;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const label = ACTIVITY[activity].label;
    if (findButton) findButton.querySelector('small').textContent = activity === 'cycle' ? 'Nearby mapped cycle routes' : `Nearby established ${label} routes`;
    if (makeButton) makeButton.querySelector('small').textContent = `Create a new ${label} loop from here`;
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
    setStatus(`${route.name} highlighted. Check current access, surface, closures and conditions before setting off.`, 'success');
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

  function buildLoopPoints(start, targetMetres, style, random, shapeIndex, scale = 1) {
    const activityRadius = selectedActivity === 'cycle' ? 0.22 : selectedActivity === 'jog' ? 0.19 : 0.18;
    const styleFactor = style === 'gentle' ? 0.88 : style === 'adventurous' ? 1.12 : 1;
    const radius = Math.max(selectedActivity === 'cycle' ? 500 : 300, targetMetres * activityRadius * styleFactor * scale * (0.82 + random() * 0.34));
    const direction = random() * 360;
    const jitter = () => (random() - 0.5) * 20;

    // Rotate through several geometries. Valhalla snaps each intermediate point
    // to its legal/routable network, so failures do not poison the next attempt.
    if (shapeIndex % 3 === 0) {
      const spread = style === 'gentle' ? 100 : style === 'adventurous' ? 150 : 125;
      return [
        start,
        destinationPoint(start.lat, start.lon, radius, direction + jitter()),
        destinationPoint(start.lat, start.lon, radius * (0.9 + random() * 0.24), direction + spread + jitter()),
        { ...start }
      ];
    }
    if (shapeIndex % 3 === 1) {
      return [
        start,
        destinationPoint(start.lat, start.lon, radius, direction + jitter()),
        destinationPoint(start.lat, start.lon, radius * (0.95 + random() * 0.18), direction + 95 + jitter()),
        destinationPoint(start.lat, start.lon, radius * (0.82 + random() * 0.22), direction + 195 + jitter()),
        { ...start }
      ];
    }
    return [
      start,
      destinationPoint(start.lat, start.lon, radius * 0.85, direction + jitter()),
      destinationPoint(start.lat, start.lon, radius * 1.08, direction + 70 + jitter()),
      destinationPoint(start.lat, start.lon, radius * 0.9, direction + 175 + jitter()),
      destinationPoint(start.lat, start.lon, radius * 0.7, direction + 255 + jitter()),
      { ...start }
    ];
  }

  async function routePoints(points) {
    const response = await fetch('/.netlify/functions/trail-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, activity: selectedActivity, generatedLoop: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The route could not be calculated.');
    const route = payload.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('No suitable route was returned.');
    return route;
  }

  function routeQuality(route, targetMetres) {
    const distanceError = Math.abs(route.distance - targetMetres) / targetMetres;
    const coordinates = route.geometry?.coordinates || [];
    const routeLength = coordinates.length;
    // Penalise suspiciously tiny geometry results but otherwise let Valhalla's
    // legal network and actual routed distance determine the winner.
    const geometryPenalty = routeLength < 8 ? 0.35 : 0;
    return distanceError + geometryPenalty;
  }

  function adjustDurationForActivity(route) {
    if (selectedActivity !== 'jog') return route;
    const seconds = Math.max(60, (route.distance / METRES_PER_MILE) / ACTIVITY.jog.speedMph * 3600);
    return { ...route, duration: seconds };
  }

  async function makeRoute() {
    if (generating) return;
    generating = true;
    generateButton.disabled = true;
    regenerateButton.disabled = true;

    const miles = Number(distanceInput.value || 3);
    const targetMetres = miles * METRES_PER_MILE;
    const style = styleSelect.value;
    const activity = ACTIVITY[selectedActivity];
    const oldCenter = planner.map.getCenter();
    const oldZoom = planner.map.getZoom();
    setStatus(`Creating a ${miles} mile ${activity.label} loop near you…`);

    try {
      const start = await planner.getCurrentLocation();
      const baseSeed = Math.floor((start.lat + 90) * 1e5) ^ Math.floor((start.lon + 180) * 1e5) ^ Date.now() ^ (++seedCounter * 2654435761);
      const random = mulberry32(baseSeed >>> 0);
      const candidates = [];

      // Stage 1 aims for a tight match. Stage 2/3 progressively widen candidate
      // radii before we give up, which makes urban, coastal and fragmented
      // path networks much more likely to produce a useful loop.
      const stages = [
        { attempts: 7, scales: [0.82, 0.94, 1.04], accept: 0.13 },
        { attempts: 7, scales: [0.7, 1.16, 1.3], accept: 0.20 },
        { attempts: 6, scales: [0.6, 1.45], accept: 0.30 }
      ];

      let attemptIndex = 0;
      outer: for (const stage of stages) {
        for (let i = 0; i < stage.attempts; i += 1) {
          const scale = stage.scales[i % stage.scales.length];
          const points = buildLoopPoints(start, targetMetres, style, random, attemptIndex++, scale);
          try {
            const route = adjustDurationForActivity(await routePoints(points));
            const score = routeQuality(route, targetMetres);
            candidates.push({ route, points, score });
            if (score <= stage.accept) break outer;
          } catch (_) {
            // A candidate can land across water, a disconnected estate, or a
            // path that is not legal for this activity. Keep rotating/scaling.
          }
          await sleep(55);
        }
      }

      if (!candidates.length) {
        planner.map.easeTo({ center: oldCenter, zoom: oldZoom, duration: 450 });
        throw new Error(`No ${activity.label} loop could be connected from this exact position. Try a shorter distance or move the start marker a little.`);
      }

      candidates.sort((a, b) => a.score - b.score);
      const best = candidates[0];
      const actualMiles = best.route.distance / METRES_PER_MILE;
      const difference = Math.abs(actualMiles - miles);
      const note = difference <= 0.35 ? '' : ` (closest available to ${miles} mi)`;
      planner.applyRoute(best.route, best.points, `Made a ${actualMiles.toFixed(1)} mile ${activity.label} loop${note}. Use “Try a different route” for another one.`);

      const trailName = document.getElementById('trail-name');
      if (trailName && !trailName.value.trim()) trailName.value = `Adventure Builder ${miles} mile ${activity.label} loop`;
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
    const activity = ACTIVITY[selectedActivity];
    nearbyPanel.innerHTML = `<p class="walk-smart-loading">Finding mapped ${activity.label} routes near you…</p>`;
    setStatus(`Looking for nearby ${activity.label} routes…`);

    try {
      const start = await planner.getCurrentLocation();
      const response = await fetch('/.netlify/functions/nearby-walking-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: start.lat, lon: start.lon, radius: selectedActivity === 'cycle' ? 18000 : 12000, activity: selectedActivity })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Nearby routes could not be loaded.');
      const routes = payload.routes || [];
      if (!routes.length) {
        nearbyPanel.innerHTML = `<p class="walk-smart-loading">No mapped ${activity.label} routes were found nearby. Try “Make me a route” instead.</p>`;
        setStatus(`No established ${activity.label} routes were found nearby. You can still generate a new loop.`, 'warning');
        return;
      }

      nearbyPanel.innerHTML = routes.slice(0, 8).map((route, index) => `
        <button class="walk-nearby-route-item" type="button" data-nearby-index="${index}">
          <span><strong>${escapeHtml(route.name)}</strong><small>${escapeHtml(route.networkLabel || `${activity.label} route`)}${route.ref ? ` · ${escapeHtml(route.ref)}` : ''}</small></span>
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
      setStatus(`Found ${routes.length} established ${activity.label} route${routes.length === 1 ? '' : 's'} nearby.`, 'success');
    } catch (error) {
      nearbyPanel.innerHTML = `<p class="walk-smart-loading">${escapeHtml(error.message || 'Nearby routes could not be loaded.')}</p>`;
      setStatus(error.message || 'Nearby routes could not be loaded.', 'error');
    } finally {
      findButton.disabled = false;
    }
  }

  activityButtons.forEach((button) => button.addEventListener('click', () => setActivity(button.dataset.walkActivity)));
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

  setActivity('walk');
})();

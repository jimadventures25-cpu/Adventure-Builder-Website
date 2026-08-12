(() => {
  'use strict';

  const mapElement = document.getElementById('trail-map');
  if (!mapElement || typeof maplibregl === 'undefined') return;

  const status = document.getElementById('trail-status');
  const routeButton = document.getElementById('trail-build-route');
  const clearButton = document.getElementById('trail-clear-route');
  const locateButton = document.getElementById('trail-use-location');
  const saveButton = document.getElementById('trail-save-route');
  const appButton = document.getElementById('trail-open-app');
  const distanceOutput = document.getElementById('trail-distance');
  const timeOutput = document.getElementById('trail-time');
  const pointsOutput = document.getElementById('trail-points');
  const routeNameInput = document.getElementById('trail-name');
  const poiButton = document.getElementById('trail-find-pois');
  const poiStatus = document.getElementById('trail-poi-status');
  const poiResults = document.getElementById('trail-poi-results');

  const state = {
    points: [],
    markers: [],
    route: null,
    userLocationMarker: null
  };

  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  };

  const rasterStyle = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  };

  const map = new maplibregl.Map({
    container: mapElement,
    style: rasterStyle,
    center: [-2.6, 54.5],
    zoom: 5.3,
    minZoom: 4,
    maxZoom: 18
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }));

  function updateSummary() {
    pointsOutput.textContent = String(state.points.length);
    const ready = state.points.length >= 2;
    routeButton.disabled = !ready;
    if (poiButton) poiButton.disabled = !state.route;
    saveButton.disabled = !state.route;
    appButton.classList.toggle('is-disabled', !state.route);
    appButton.setAttribute('aria-disabled', state.route ? 'false' : 'true');
  }

  function markerLabel(index) {
    if (index === 0) return 'A';
    if (index === state.points.length - 1) return 'B';
    return String(index);
  }

  function redrawMarkers() {
    state.markers.forEach((marker) => marker.remove());
    state.markers = state.points.map((point, index) => {
      const element = document.createElement('div');
      element.className = `trail-marker ${index === 0 ? 'trail-marker-start' : index === state.points.length - 1 ? 'trail-marker-end' : 'trail-marker-waypoint'}`;
      element.textContent = markerLabel(index);
      element.title = index === 0 ? 'Trail start' : index === state.points.length - 1 ? 'Trail finish' : `Waypoint ${index}`;
      return new maplibregl.Marker({ element, draggable: true })
        .setLngLat([point.lon, point.lat])
        .addTo(map)
        .on('dragend', (event) => {
          const position = event.target.getLngLat();
          state.points[index] = { lat: position.lat, lon: position.lng };
          clearRouteLine();
          setStatus('Point moved. Build the trail again to update the route.');
        });
    });
    updateSummary();
  }

  function clearRouteLine() {
    state.route = null;
    distanceOutput.textContent = '—';
    timeOutput.textContent = '—';
    if (map.getSource('trail-route')) {
      map.getSource('trail-route').setData({ type: 'FeatureCollection', features: [] });
    }
    updateSummary();
  }

  function applyRoute(route, points = state.points, message = 'Trail ready. Save it or open the same plan in the app.') {
    if (!route?.geometry?.coordinates?.length) throw new Error('No walkable route was returned.');
    state.points = points.map((point) => ({ ...point }));
    state.route = route;
    redrawMarkers();
    const geojson = { type: 'Feature', properties: {}, geometry: route.geometry };
    map.getSource('trail-route')?.setData(geojson);
    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (box, coordinate) => box.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    distanceOutput.textContent = `${(route.distance / 1609.344).toFixed(1)} miles`;
    const minutes = Math.max(1, Math.round(route.duration / 60));
    timeOutput.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
    setStatus(message, 'success');
    updateSummary();
  }

  function addPoint(lat, lon) {
    if (state.points.length >= 8) {
      setStatus('A trail can contain up to eight planning points in this beta.', 'warning');
      return;
    }
    state.points.push({ lat, lon });
    clearRouteLine();
    redrawMarkers();
    setStatus(state.points.length === 1 ? 'Start added. Choose the finish point.' : 'Point added. Build the trail when ready.');
  }

  map.on('click', (event) => addPoint(event.lngLat.lat, event.lngLat.lng));

  function showUserLocation(coords) {
    const lngLat = [coords.longitude, coords.latitude];
    if (!state.userLocationMarker) {
      const element = document.createElement('div');
      element.className = 'trail-user-location-marker';
      element.innerHTML = '<span></span>';
      element.setAttribute('aria-label', 'Your location');
      state.userLocationMarker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(map);
    } else {
      state.userLocationMarker.setLngLat(lngLat);
    }
    map.flyTo({ center: lngLat, zoom: 14.5, duration: 900, essential: true });
  }

  function locateUser({ addAsStart = false, quietFailure = false } = {}) {
    if (!navigator.geolocation) {
      if (!quietFailure) setStatus('Location is not available in this browser.', 'error');
      return;
    }
    if (!quietFailure) setStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        showUserLocation(coords);
        if (addAsStart) {
          addPoint(coords.latitude, coords.longitude);
          setStatus('Your location has been added as the trail start.', 'success');
        } else {
          setStatus('Map centred on your location. Tap the map to choose your trail start.', 'success');
        }
      },
      () => {
        if (!quietFailure) setStatus('Your location could not be found. Check the browser location permission.', 'error');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  }

  map.on('load', () => {
    map.addSource('trail-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: 'trail-route-casing',
      type: 'line',
      source: 'trail-route',
      paint: {
        'line-color': '#111315',
        'line-width': 9,
        'line-opacity': 0.88
      }
    });
    map.addLayer({
      id: 'trail-route-line',
      type: 'line',
      source: 'trail-route',
      paint: {
        'line-color': '#ff8a1f',
        'line-width': 5,
        'line-opacity': 0.98
      }
    });
    setStatus('Tap the map to place the trail start, finish and optional waypoints.');
    // Start local, not UK-wide. The browser owns the permission prompt. If the
    // visitor declines, the normal UK overview remains available.
    window.setTimeout(() => locateUser({ addAsStart: false, quietFailure: true }), 350);
  });

  locateButton?.addEventListener('click', () => locateUser({ addAsStart: true }));

  clearButton?.addEventListener('click', () => {
    state.points = [];
    state.markers.forEach((marker) => marker.remove());
    state.markers = [];
    clearRouteLine();
    setStatus('Trail cleared. Tap the map to begin again.');
  });

  routeButton?.addEventListener('click', async () => {
    if (state.points.length < 2) return;
    routeButton.disabled = true;
    setStatus('Building a walking route with Valhalla…');
    try {
      const response = await fetch('/.netlify/functions/trail-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: state.points })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The trail could not be calculated.');
      const route = payload.routes?.[0];
      applyRoute(route, state.points);
    } catch (error) {
      setStatus(error.message || 'The trail could not be calculated.', 'error');
    } finally {
      updateSummary();
    }
  });

  saveButton?.addEventListener('click', () => {
    if (!state.route) return;
    const saved = {
      id: `trail-${Date.now()}`,
      name: routeNameInput?.value.trim() || 'My hiking trail',
      createdAt: new Date().toISOString(),
      points: state.points,
      distance: state.route.distance,
      duration: state.route.duration
    };
    const trails = JSON.parse(localStorage.getItem('adventureBuilderSavedTrails') || '[]');
    trails.unshift(saved);
    localStorage.setItem('adventureBuilderSavedTrails', JSON.stringify(trails.slice(0, 25)));
    setStatus('Trail saved in this browser. Account cloud sync will use the same saved trail format.', 'success');
  });

  appButton?.addEventListener('click', (event) => {
    if (!state.route) {
      event.preventDefault();
      setStatus('Build the trail before opening it in the app.', 'warning');
      return;
    }
    const appBase = window.ADVENTURE_BUILDER_CONFIG?.APP_URL || 'https://app.adventurebuilder.co.uk';
    const transfer = {
      name: routeNameInput?.value.trim() || 'Website hiking trail',
      transport: 'walking',
      points: state.points
    };
    appButton.href = `${appBase}/?trail=${encodeURIComponent(JSON.stringify(transfer))}`;
  });

  poiButton?.addEventListener('click', async () => {
    if (!state.route) return;
    poiButton.disabled = true; poiStatus.textContent = 'Finding interesting and useful places near your trail…'; poiResults.innerHTML = '';
    const categories=[...document.querySelectorAll('#trail-poi-filters input:checked')].map(x=>x.value);
    try{
      const response=await fetch('/.netlify/functions/trail-pois',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({coordinates:state.route.geometry.coordinates,categories})});
      const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Suggestions could not be loaded.');
      const places=payload.places||[]; poiStatus.textContent=`Found ${places.length} suggestion${places.length===1?'':'s'} along this trail.`;
      poiResults.innerHTML=places.length?places.map((p,i)=>`<article class="trail-poi-card"><span>${p.icon}</span><div><small>${p.category}</small><h3>${p.name}</h3><p>${p.description||'Near your planned trail'}</p></div><button type="button" data-poi-index="${i}">Add to Trail</button></article>`).join(''):'<div class="empty-feature-state"><span>🗺️</span><h3>No suggestions found</h3><p>Try another category or a longer trail.</p></div>';
      poiResults.onclick=(event)=>{const b=event.target.closest('[data-poi-index]');if(!b)return;const p=places[Number(b.dataset.poiIndex)];if(state.points.length>=8){poiStatus.textContent='The beta trail limit is eight planning points.';return;}state.points.splice(Math.max(1,state.points.length-1),0,{lat:p.lat,lon:p.lon,poi:{id:p.id,name:p.name,category:p.category}});clearRouteLine();redrawMarkers();b.textContent='Added';b.disabled=true;poiStatus.textContent=`${p.name} added as a waypoint. Build the trail again.`;};
    }catch(error){poiStatus.textContent=error.message||'Suggestions could not be loaded.';}finally{poiButton.disabled=!state.route;}
  });

  window.AdventureBuilderTrailPlanner = Object.freeze({
    map,
    getState: () => ({
      points: state.points.map((point) => ({ ...point })),
      route: state.route,
      userLocation: state.userLocationMarker ? state.userLocationMarker.getLngLat() : null
    }),
    setStatus,
    applyRoute,
    clear: () => {
      state.points = [];
      state.markers.forEach((marker) => marker.remove());
      state.markers = [];
      clearRouteLine();
    },
    getCurrentLocation: () => new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          showUserLocation(coords);
          resolve({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy });
        },
        () => reject(new Error('Your location could not be found. Check the browser location permission.')),
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
      );
    })
  });

  updateSummary();
})();

import { costingFor, normaliseValhalla } from './lib/valhalla-connector.mjs';
import { getRoutingConfig, valhallaHeaders } from './lib/routing-config.mjs';

const EARTH_RADIUS_METRES = 6371000;
const METRES_PER_MILE = 1609.344;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function destinationPoint(start, distanceMetres, bearingDegrees) {
  const bearing = bearingDegrees * Math.PI / 180;
  const phi1 = start.lat * Math.PI / 180;
  const lambda1 = start.lon * Math.PI / 180;
  const delta = distanceMetres / EARTH_RADIUS_METRES;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing)
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  );
  return {
    lat: phi2 * 180 / Math.PI,
    lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180
  };
}

function seededAngle(seed = 0) {
  const value = Math.abs(Number(seed) || 0) >>> 0;
  return (value * 137.50776405003785) % 360;
}

function activityConfig(activity) {
  if (activity === 'cycle') {
    return { transport: 'bicycle', label: 'cycling', locateRadius: 450, routeRadius: 180, speed: 18 };
  }
  if (activity === 'jog') {
    return { transport: 'walking', label: 'jogging', locateRadius: 350, routeRadius: 140, speed: 9 };
  }
  return { transport: 'walking', label: 'walking', locateRadius: 350, routeRadius: 140, speed: 5.1 };
}

function styleRadiusMultiplier(style) {
  if (style === 'gentle') return 0.94;
  if (style === 'adventurous') return 1.06;
  return 1;
}

function correlatedPoint(item) {
  const edge = Array.isArray(item?.edges) ? item.edges.find((entry) =>
    Number.isFinite(Number(entry?.correlated_lat)) && Number.isFinite(Number(entry?.correlated_lon))) : null;
  if (edge) return { lat: Number(edge.correlated_lat), lon: Number(edge.correlated_lon) };
  const node = Array.isArray(item?.nodes) ? item.nodes.find((entry) =>
    Number.isFinite(Number(entry?.lat)) && Number.isFinite(Number(entry?.lon))) : null;
  if (node) return { lat: Number(node.lat), lon: Number(node.lon) };
  return null;
}

async function upstreamJson(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error || body?.error_message || body?.trip?.status_message || `Routing service returned HTTP ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      error.code = body?.error_code || body?.code || null;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function locateRing({ config, headers, start, targetMetres, costing, activity, style, scale, seed }) {
  const cfg = activityConfig(activity);
  // The ring is deliberately based on loop perimeter rather than straight-line
  // distance. 0.23-0.31 of target gives useful 3- and 4-sided loops after
  // real street/path detours are taken into account.
  const radius = Math.max(
    activity === 'cycle' ? 650 : 380,
    targetMetres * scale * styleRadiusMultiplier(style)
  );
  const rotation = seededAngle(seed) + (scale * 113.7);
  const rawPoints = Array.from({ length: 8 }, (_, index) =>
    destinationPoint(start, radius, rotation + index * 45));

  const locations = [start, ...rawPoints].map((point, index) => ({
    lat: point.lat,
    lon: point.lon,
    radius: index === 0 ? Math.min(180, cfg.locateRadius) : cfg.locateRadius,
    // Lower than Valhalla's default 50 so footpaths/cycle links on the edge of
    // estates and parks are not discarded as tiny islands before correlation.
    minimum_reachability: index === 0 ? 10 : 5
  }));

  const payload = await upstreamJson(`${config.baseUrl}/locate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ locations, costing, verbose: false })
  }, 9000);

  if (!Array.isArray(payload) || payload.length < locations.length) {
    throw new Error('Valhalla Locate did not return all candidate points.');
  }

  const snapped = payload.map(correlatedPoint);
  if (!snapped[0]) throw new Error('Your current position could not be snapped to the routing network.');
  return { start: snapped[0], ring: snapped.slice(1), rawPoints };
}

function uniqueCandidateKey(points) {
  return points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join('|');
}

function buildCandidates(snapped) {
  const candidates = [];
  const { start, ring } = snapped;
  const add = (indices) => {
    const via = indices.map((index) => ring[(index + ring.length) % ring.length]).filter(Boolean);
    if (via.length !== indices.length) return;
    const points = [start, ...via, { ...start }];
    candidates.push(points);
  };

  // Two-waypoint triangular loops: 90° and 135° separation.
  for (let i = 0; i < 8; i += 1) {
    add([i, i + 2]);
    add([i, i + 3]);
  }
  // Three-waypoint loops give the router more shape control in grid-like areas.
  for (let i = 0; i < 8; i += 2) add([i, i + 2, i + 4]);

  const seen = new Set();
  return candidates.filter((points) => {
    const key = uniqueCandidateKey(points);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function routeRequest(points, costing, activity, style) {
  const cfg = activityConfig(activity);
  const locations = points.map((point, index) => {
    const endpoint = index === 0 || index === points.length - 1;
    return {
      lat: Number(point.lat),
      lon: Number(point.lon),
      // break_through on generated intermediate locations prevents a cheap
      // U-turn at the snapped waypoint while still giving us separate legs.
      type: endpoint ? 'break' : 'break_through',
      radius: endpoint ? Math.min(120, cfg.routeRadius) : cfg.routeRadius,
      minimum_reachability: endpoint ? 10 : 5
    };
  });

  const request = {
    locations,
    costing,
    units: 'miles',
    language: 'en-GB',
    directions_type: 'instructions',
    alternates: 0
  };

  if (costing === 'pedestrian') {
    request.costing_options = {
      pedestrian: {
        walking_speed: cfg.speed,
        use_tracks: style === 'adventurous' ? 0.72 : (style === 'gentle' ? 0.35 : 0.55),
        use_hills: style === 'gentle' ? 0.25 : (style === 'adventurous' ? 0.7 : 0.5),
        max_hiking_difficulty: style === 'adventurous' ? 3 : 1
      }
    };
  } else if (costing === 'bicycle') {
    request.costing_options = {
      bicycle: {
        bicycle_type: style === 'adventurous' ? 'cross' : 'hybrid',
        use_roads: style === 'gentle' ? 0.18 : 0.28,
        use_hills: style === 'gentle' ? 0.2 : (style === 'adventurous' ? 0.65 : 0.4)
      }
    };
  }
  return request;
}

function routeScore(route, targetMetres) {
  const distance = Number(route?.distance);
  const coordinates = route?.geometry?.coordinates || [];
  if (!Number.isFinite(distance) || distance <= 0 || coordinates.length < 5) return Infinity;
  const distanceError = Math.abs(distance - targetMetres) / targetMetres;

  // Reject pathological routes that are far outside the requested distance.
  if (distance < targetMetres * 0.5 || distance > targetMetres * 1.7) return Infinity;
  return distanceError;
}

async function routeCandidate({ config, headers, points, costing, activity, style, targetMetres }) {
  const body = await upstreamJson(`${config.baseUrl}/route`, {
    method: 'POST',
    headers,
    body: JSON.stringify(routeRequest(points, costing, activity, style))
  }, 12000);
  const normalised = normaliseValhalla(body);
  const route = normalised.routes?.[0];
  return { route, score: routeScore(route, targetMetres), points };
}

async function firstSuccessfulBatch(items, worker, concurrency = 3) {
  const results = [];
  const errors = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const settled = await Promise.all(batch.map(async (item) => {
      try { return await worker(item); }
      catch (error) { errors.push(error); return null; }
    }));
    results.push(...settled.filter((item) => item && Number.isFinite(item.score)));
    if (results.some((item) => item.score <= 0.18)) break;
  }
  return { results, errors };
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const input = await request.json();
    const start = { lat: Number(input?.start?.lat), lon: Number(input?.start?.lon) };
    if (!Number.isFinite(start.lat) || !Number.isFinite(start.lon)) {
      return json({ error: 'A valid current position is required.' }, 400);
    }

    const activity = ['walk', 'jog', 'cycle'].includes(input?.activity) ? input.activity : 'walk';
    const style = ['balanced', 'gentle', 'adventurous'].includes(input?.style) ? input.style : 'balanced';
    const targetMetres = clamp(Number(input?.targetMetres) || (3 * METRES_PER_MILE), 0.75 * METRES_PER_MILE, 20 * METRES_PER_MILE);
    const seed = Number(input?.seed) || Date.now();
    const cfg = activityConfig(activity);
    const costing = costingFor(cfg.transport);
    const config = getRoutingConfig();

    if (!config.valhallaConfigured) {
      return json({
        error: 'Walking route generation needs VALHALLA_BASE_URL in the website Netlify environment. Copy the same Valhalla URL used by the Adventure Builder app.'
      }, 503);
    }

    const headers = valhallaHeaders(config);
    const ringScales = activity === 'cycle' ? [0.24, 0.30] : [0.23, 0.29];
    const allCandidates = [];
    const locateErrors = [];

    for (let index = 0; index < ringScales.length; index += 1) {
      try {
        const snapped = await locateRing({
          config, headers, start, targetMetres, costing, activity, style,
          scale: ringScales[index], seed: seed + index * 7919
        });
        allCandidates.push(...buildCandidates(snapped));
      } catch (error) {
        locateErrors.push(error);
      }
    }

    if (!allCandidates.length) {
      const detail = locateErrors[0]?.message || 'No nearby routable points could be found.';
      return json({ error: `I could not connect your position to nearby ${cfg.label} paths: ${detail}` }, 422);
    }

    const { results, errors } = await firstSuccessfulBatch(
      allCandidates.slice(0, 28),
      (points) => routeCandidate({ config, headers, points, costing, activity, style, targetMetres }),
      3
    );

    if (!results.length) {
      const detail = errors[0]?.message || 'Valhalla could not connect the snapped loop points.';
      return json({ error: `No ${cfg.label} loop could be connected from this position. ${detail}` }, 422);
    }

    results.sort((a, b) => a.score - b.score);
    const best = results[0];
    return json({
      route: best.route,
      planningPoints: best.points,
      requestedDistance: targetMetres,
      distanceError: best.score,
      gbca_feature: 'website-trail-loop-v2',
      gbca_activity: activity,
      gbca_provider: 'valhalla'
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Walking route generation timed out. Please try again.'
      : (error?.message || 'Walking route generation failed.');
    return json({ error: message }, 500);
  }
};

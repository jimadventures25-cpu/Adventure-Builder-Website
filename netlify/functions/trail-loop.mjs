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
  if (activity === 'cycle') return { transport: 'bicycle', label: 'cycling', speed: 18 };
  if (activity === 'jog') return { transport: 'walking', label: 'jogging', speed: 9 };
  return { transport: 'walking', label: 'walking', speed: 5.1 };
}

function styleRadiusMultiplier(style) {
  if (style === 'gentle') return 0.94;
  if (style === 'adventurous') return 1.06;
  return 1;
}

function uniqueCandidateKey(points) {
  return points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join('|');
}

// Generate several compact loop shapes around the user's position. These are
// deliberately *hints*, not pre-snapped graph locations. Valhalla's Route API
// performs its own correlation and is the only endpoint required by this path.
function buildDirectCandidates({ start, targetMetres, activity, style, seed }) {
  const baseAngle = seededAngle(seed);
  const styleScale = styleRadiusMultiplier(style);
  const minimumRadius = activity === 'cycle' ? 520 : 320;
  const scales = activity === 'cycle' ? [0.20, 0.24, 0.28] : [0.19, 0.23, 0.27];
  const candidates = [];

  const add = (points) => candidates.push([start, ...points, { ...start }]);

  scales.forEach((scale, scaleIndex) => {
    const radius = Math.max(minimumRadius, targetMetres * scale * styleScale);
    // Rotate each scale so retries do not keep probing the same streets/paths.
    const rotation = baseAngle + scaleIndex * 37;
    for (let i = 0; i < 4; i += 1) {
      const angle = rotation + i * 90;
      // Triangle: two broad via points. This is the most tolerant shape and is
      // attempted first because it asks the graph for the least constrained loop.
      add([
        destinationPoint(start, radius, angle),
        destinationPoint(start, radius, angle + 125)
      ]);
      // Rounded rectangle: better distance control in grid-like areas.
      add([
        destinationPoint(start, radius * 0.82, angle),
        destinationPoint(start, radius * 1.03, angle + 82),
        destinationPoint(start, radius * 0.82, angle + 168)
      ]);
    }
  });

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
    // Via points influence the path without forcing separate route legs. More
    // importantly, we intentionally omit radius/search_cutoff so Valhalla can
    // use its normal graph correlation instead of W41's overly strict snapping.
    return {
      lat: Number(point.lat),
      lon: Number(point.lon),
      type: endpoint ? 'break' : 'via'
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

async function upstreamJson(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    if (!response.ok) {
      const message = body?.error || body?.error_message || body?.trip?.status_message || raw?.slice(0, 240) || `Routing service returned HTTP ${response.status}.`;
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

function routeScore(route, targetMetres) {
  const distance = Number(route?.distance);
  const coordinates = route?.geometry?.coordinates || [];
  if (!Number.isFinite(distance) || distance <= 0 || coordinates.length < 5) return Infinity;
  if (distance < targetMetres * 0.42 || distance > targetMetres * 1.9) return Infinity;
  return Math.abs(distance - targetMetres) / targetMetres;
}

async function routeCandidate({ config, headers, points, costing, activity, style, targetMetres }) {
  const body = await upstreamJson(`${config.baseUrl}/route`, {
    method: 'POST',
    headers,
    body: JSON.stringify(routeRequest(points, costing, activity, style))
  });
  const normalised = normaliseValhalla(body);
  const route = normalised.routes?.[0];
  return { route, score: routeScore(route, targetMetres), points };
}

async function routeBatches(items, worker, concurrency = 3) {
  const results = [];
  const errors = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const settled = await Promise.all(batch.map(async (item) => {
      try { return await worker(item); }
      catch (error) { errors.push(error); return null; }
    }));
    results.push(...settled.filter((item) => item && Number.isFinite(item.score)));
    if (results.some((item) => item.score <= 0.20)) break;
  }
  return { results, errors };
}

function conciseError(error) {
  if (!error) return '';
  const status = Number(error.status);
  const prefix = Number.isFinite(status) ? `HTTP ${status}: ` : '';
  return `${prefix}${error.message || 'Unknown routing error'}`.slice(0, 300);
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
    const candidates = buildDirectCandidates({ start, targetMetres, activity, style, seed });
    const { results, errors } = await routeBatches(
      candidates.slice(0, 24),
      (points) => routeCandidate({ config, headers, points, costing, activity, style, targetMetres }),
      3
    );

    if (!results.length) {
      const first = errors[0];
      const detail = conciseError(first) || 'Valhalla returned no usable route candidates.';
      return json({
        error: `No ${cfg.label} loop could be generated from this position. ${detail}`,
        diagnostic: {
          stage: 'route-candidates',
          attempts: Math.min(candidates.length, 24),
          upstreamError: detail
        }
      }, 422);
    }

    results.sort((a, b) => a.score - b.score);
    const best = results[0];
    return json({
      route: best.route,
      planningPoints: best.points,
      requestedDistance: targetMetres,
      distanceError: best.score,
      gbca_feature: 'website-trail-loop-v3',
      gbca_activity: activity,
      gbca_provider: 'valhalla',
      gbca_strategy: 'route-api-direct-correlation'
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Walking route generation timed out. Please try again.'
      : (error?.message || 'Walking route generation failed.');
    return json({ error: message, diagnostic: { stage: 'function', upstreamError: conciseError(error) } }, 500);
  }
};

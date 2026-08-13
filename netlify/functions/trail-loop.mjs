import { costingFor } from './lib/valhalla-connector.mjs';
import { getRoutingConfig } from './lib/routing-config.mjs';
import { requestNormalisedRoute } from './lib/trail-routing-provider.mjs';
import { scoreTrailRoute, acceptableTrailRoute } from './lib/trail-quality-engine.mjs';

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
function buildDirectCandidates({ start, targetMetres, activity, style, seed, variation = 0 }) {
  const baseAngle = (seededAngle(seed) + (Number(variation) || 0) * 45) % 360;
  const styleScale = styleRadiusMultiplier(style);
  const minimumRadius = activity === 'cycle' ? 260 : 300;
  const scales = activity === 'cycle' ? [0.105, 0.125, 0.145, 0.17] : [0.12, 0.15, 0.18, 0.21];
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


function scaleCandidate(points, start, factor) {
  const safeFactor = clamp(Number(factor) || 1, 0.65, 1.30);
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return { ...start };
    return {
      lat: start.lat + (Number(point.lat) - start.lat) * safeFactor,
      lon: start.lon + (Number(point.lon) - start.lon) * safeFactor
    };
  });
}

function distanceTolerance(activity) {
  if (activity === 'cycle') return 0.12;
  if (activity === 'jog') return 0.15;
  return 0.18;
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
        max_hiking_difficulty: style === 'adventurous' ? 3 : 1,
        walkway_factor: activity === 'jog' ? 0.82 : 0.92,
        sidewalk_factor: activity === 'jog' ? 0.88 : 0.95,
        step_penalty: activity === 'jog' ? 45 : 20
      }
    };
  } else if (costing === 'bicycle') {
    request.costing_options = {
      bicycle: {
        bicycle_type: style === 'adventurous' ? 'cross' : 'hybrid',
        use_roads: style === 'gentle' ? 0.18 : 0.28,
        use_hills: style === 'gentle' ? 0.2 : (style === 'adventurous' ? 0.65 : 0.4),
        avoid_bad_surfaces: style === 'adventurous' ? 0.2 : 0.55
      }
    };
  }
  return request;
}

function routeScore(route, targetMetres, activity) {
  return scoreTrailRoute(route, targetMetres, activity);
}

async function routeCandidate({ config, points, costing, activity, style, targetMetres }) {
  const cfg = activityConfig(activity);
  const directValhallaBody = routeRequest(points, costing, activity, style);
  const { payload, provider } = await requestNormalisedRoute({
    config, points, transport: cfg.transport, style, directValhallaBody
  });
  const route = payload.routes?.[0];
  const quality = routeScore(route, targetMetres, activity);
  return { route, ...quality, points, provider };
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
    const variation = Math.abs(Number(input?.variation) || 0) % 8;
    const cfg = activityConfig(activity);
    const costing = costingFor(cfg.transport);
    const config = getRoutingConfig();

    if (!config.valhallaConfigured && !config.appGatewayConfigured) {
      return json({ error: 'No Adventure Builder routing provider is configured.' }, 503);
    }

    const candidates = buildDirectCandidates({ start, targetMetres, activity, style, seed, variation });
    // W48: progressively score a very small number of candidates. This preserves
    // the W46 rate-limit fix while allowing Adventure Builder to reject obviously
    // poor distance matches and mechanical/repetitive loop shapes.
    const results = [];
    const errors = [];
    const baseIndex = (Math.abs(Number(seed) || 0) + variation * 11) % candidates.length;
    const candidateBudget = 3;
    let selected = candidates[baseIndex] || candidates[0];
    let previous = null;
    for (let attempt = 0; attempt < candidateBudget; attempt += 1) {
      if (attempt > 0 && previous?.route?.distance && String(previous.provider || '').includes('valhalla')) {
        const correction = targetMetres / Number(previous.route.distance);
        selected = scaleCandidate(previous.points, start, correction);
      } else if (attempt > 0) {
        const index = (baseIndex + attempt * 13) % candidates.length;
        selected = candidates[index] || candidates[0];
      }
      try {
        const candidate = await routeCandidate({ config, points: selected, costing, activity, style, targetMetres });
        previous = candidate;
        if (candidate?.route?.geometry?.coordinates?.length >= 5 && Number.isFinite(candidate.score)) {
          results.push(candidate);
          if (acceptableTrailRoute(candidate, activity) && candidate.quality >= 78) break;
          if (!String(candidate.provider || '').includes('valhalla')) break;
          if (Number(candidate.metrics?.distanceError) <= distanceTolerance(activity) * 0.75) break;
        }
      } catch (error) {
        errors.push(error);
        if (Number(error?.status) === 429 || Number(error?.status) === 504) break;
      }
    }

    if (!results.length) {
      const first = errors[0];
      const detail = conciseError(first) || 'Valhalla returned no usable route candidates.';
      return json({
        error: `No ${cfg.label} loop could be generated from this position. ${detail}`,
        diagnostic: {
          stage: 'route-candidates',
          attempts: Math.min(candidateBudget, results.length + errors.length),
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
      distanceError: best.metrics.distanceError,
      routeQuality: { score: best.quality, grade: best.grade, metrics: best.metrics },
      gbca_feature: 'website-trail-loop-v5-final-polish',
      gbca_activity: activity,
      gbca_provider: best.provider || (config.valhallaConfigured ? 'valhalla-direct' : 'adventure-app-routing-gateway'),
      gbca_strategy: 'adaptive-distance-quality-routing'
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Walking route generation timed out. Please try again.'
      : (error?.message || 'Walking route generation failed.');
    return json({ error: message, diagnostic: { stage: 'function', upstreamError: conciseError(error) } }, 500);
  }
};

import { buildValhallaRequest, normaliseValhalla } from './lib/valhalla-connector.mjs';
import { getRoutingConfig, valhallaHeaders } from './lib/routing-config.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function activityTransport(activity) {
  if (activity === 'cycle') return 'bicycle';
  // Jogging deliberately uses the pedestrian network. Its displayed duration
  // is adjusted client-side; access rules remain pedestrian rules.
  return 'walking';
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const input = await request.json();
    const points = Array.isArray(input?.points) ? input.points.slice(0, 8) : [];
    const activity = ['walk', 'jog', 'cycle'].includes(input?.activity) ? input.activity : 'walk';
    const config = getRoutingConfig();
    if (!config.valhallaConfigured) return json({ error: 'Trail routing is not configured yet.' }, 503);

    const valhallaRequest = buildValhallaRequest({ points, transport: activityTransport(activity) });

    // Generated loops use synthetic intermediate points. Give Valhalla room to
    // snap those points onto the legal activity network instead of failing
    // because a random coordinate lands just off a pavement/path/cycleway.
    if (input?.generatedLoop) {
      valhallaRequest.locations = valhallaRequest.locations.map((location, index) => ({
        ...location,
        radius: index === 0 || index === valhallaRequest.locations.length - 1 ? 80 : (activity === 'cycle' ? 450 : 320),
        search_cutoff: index === 0 || index === valhallaRequest.locations.length - 1 ? 350 : (activity === 'cycle' ? 1800 : 1400)
      }));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input?.generatedLoop ? 22000 : 18000);
    try {
      const upstream = await fetch(`${config.baseUrl}/route`, {
        method: 'POST',
        headers: valhallaHeaders(config),
        body: JSON.stringify(valhallaRequest),
        signal: controller.signal
      });
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) throw new Error(body?.error || body?.trip?.status_message || 'Valhalla rejected the trail.');
      return json({ ...normaliseValhalla(body), gbca_feature: 'website-trail-planner', gbca_activity: activity });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Trail routing timed out. Please try again.' : (error?.message || 'Trail routing failed.');
    return json({ error: message }, 500);
  }
};

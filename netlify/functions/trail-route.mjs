import { buildValhallaRequest } from './lib/valhalla-connector.mjs';
import { getRoutingConfig } from './lib/routing-config.mjs';
import { requestNormalisedRoute } from './lib/trail-routing-provider.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const input = await request.json();
    const points = Array.isArray(input?.points) ? input.points.slice(0, 8) : [];
    const activity = ['walk', 'jog', 'cycle'].includes(input?.activity) ? input.activity : 'walk';
    const transport = activity === 'cycle' ? 'bicycle' : 'walking';
    if (points.length < 2) return json({ error: 'At least two route points are required.' }, 400);

    const config = getRoutingConfig();
    const directValhallaBody = buildValhallaRequest({ points, transport });
    directValhallaBody.locations = directValhallaBody.locations.map((location, index) => ({
      ...location,
      radius: index === 0 || index === directValhallaBody.locations.length - 1 ? 90 : (activity === 'cycle' ? 240 : 180),
      minimum_reachability: index === 0 || index === directValhallaBody.locations.length - 1 ? 10 : 5
    }));

    const { payload, provider } = await requestNormalisedRoute({
      config,
      points,
      transport,
      style: 'balanced',
      directValhallaBody
    });
    return json({ ...payload, gbca_feature: 'website-trail-planner', gbca_activity: activity, gbca_provider: provider });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Trail routing timed out. Please try again.' : (error?.message || 'Trail routing failed.');
    return json({ error: message }, 500);
  }
};

import { buildValhallaRequest } from './lib/valhalla-connector.mjs';
import { getRoutingConfig } from './lib/routing-config.mjs';
import { requestNormalisedRoute } from './lib/trail-routing-provider.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

const point = (value) => ({ lat: Number(value?.lat), lon: Number(value?.lon) });
const valid = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon);

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const input = await request.json();
    const from = point(input?.from);
    const to = point(input?.to);
    if (!valid(from) || !valid(to)) return json({ error: 'A valid start and destination are required.' }, 400);

    const points = [from, to];
    const config = getRoutingConfig();
    const directValhallaBody = buildValhallaRequest({
      points,
      transport: 'auto',
      routeStyle: input?.routeStyle === 'scenic' ? 'scenic' : 'balanced',
      avoidTolls: true
    });

    const { payload, provider } = await requestNormalisedRoute({
      config,
      points,
      transport: 'auto',
      style: input?.routeStyle === 'scenic' ? 'scenic' : 'balanced',
      directValhallaBody
    });
    const route = payload?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('Valhalla returned no usable route.');
    return json({ route, provider, gbca_feature: 'adventure-finder' });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Adventure Finder routing timed out.' : (error?.message || 'Adventure Finder routing failed.');
    return json({ error: message }, 500);
  }
};

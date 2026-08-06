import { buildValhallaRequest, normaliseValhalla } from './lib/valhalla-connector.mjs';
import { getRoutingConfig, valhallaHeaders } from './lib/routing-config.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const input = await request.json();
    const points = Array.isArray(input?.points) ? input.points.slice(0, 8) : [];
    const config = getRoutingConfig();
    if (!config.valhallaConfigured) return json({ error: 'Trail routing is not configured yet.' }, 503);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const upstream = await fetch(`${config.baseUrl}/route`, {
        method: 'POST',
        headers: valhallaHeaders(config),
        body: JSON.stringify(buildValhallaRequest({ points, transport: 'walking' })),
        signal: controller.signal
      });
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) throw new Error(body?.error || body?.trip?.status_message || 'Valhalla rejected the trail.');
      return json({ ...normaliseValhalla(body), gbca_feature: 'website-trail-planner' });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Trail routing timed out. Please try again.' : (error?.message || 'Trail routing failed.');
    return json({ error: message }, 500);
  }
};

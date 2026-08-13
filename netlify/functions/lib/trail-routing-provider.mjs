import { normaliseValhalla } from './valhalla-connector.mjs';
import { valhallaHeaders } from './routing-config.mjs';

async function readJsonResponse(response) {
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
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function gatewayPayload({ points, transport, style }) {
  return {
    points: points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
    transport,
    routeStyle: style === 'adventurous' ? 'scenic' : 'balanced',
    avoidMotorways: transport === 'walking' || transport === 'bicycle',
    avoidTolls: true,
    avoidFerries: false
  };
}

async function requestNormalisedRoute({ config, points, transport, style = 'balanced', directValhallaBody = null }) {
  if (config.valhallaConfigured) {
    const response = await fetchWithTimeout(`${config.baseUrl}/route`, {
      method: 'POST',
      headers: valhallaHeaders(config),
      body: JSON.stringify(directValhallaBody)
    });
    const body = await readJsonResponse(response);
    return { payload: normaliseValhalla(body), provider: 'valhalla-direct' };
  }

  if (!config.appGatewayConfigured) throw new Error('No walking routing provider is configured.');
  const response = await fetchWithTimeout(config.appRoutingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(gatewayPayload({ points, transport, style }))
  });
  const body = await readJsonResponse(response);
  if (!Array.isArray(body?.routes) || !body.routes.length) throw new Error(body?.error || 'Adventure Builder routing gateway returned no route.');
  return { payload: body, provider: body.gbca_provider || 'adventure-app-routing-gateway' };
}

export { requestNormalisedRoute, gatewayPayload };

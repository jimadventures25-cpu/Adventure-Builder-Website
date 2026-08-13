const VALID_MODES = new Set(['auto', 'valhalla', 'fallback']);
const DEFAULT_APP_ROUTING_URL = 'https://app.adventurebuilder.co.uk/api/navigation-route';

function readEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (typeof netlifyValue === 'string' && netlifyValue.trim()) return netlifyValue.trim();
  const processValue = globalThis.process?.env?.[name];
  return typeof processValue === 'string' ? processValue.trim() : '';
}

function normaliseUrl(value, label) {
  if (!value) return '';
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error(`${label} must be a valid URL.`); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(`${label} must use HTTP or HTTPS.`);
  if (parsed.pathname !== '/' && parsed.pathname !== '') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

function getRoutingConfig() {
  const requestedMode = (readEnv('ROUTING_MODE') || 'auto').toLowerCase();
  if (!VALID_MODES.has(requestedMode)) throw new Error('ROUTING_MODE must be auto, valhalla, or fallback.');

  const baseUrl = normaliseUrl(readEnv('VALHALLA_BASE_URL'), 'VALHALLA_BASE_URL');
  const appRoutingUrl = normaliseUrl(readEnv('ADVENTURE_APP_ROUTING_URL') || DEFAULT_APP_ROUTING_URL, 'ADVENTURE_APP_ROUTING_URL');
  const apiKey = readEnv('VALHALLA_API_KEY');
  const apiKeyHeader = readEnv('VALHALLA_API_KEY_HEADER') || 'X-Adventure-Builder-Key';

  return {
    mode: requestedMode,
    baseUrl,
    appRoutingUrl,
    apiKey,
    apiKeyHeader,
    valhallaConfigured: Boolean(baseUrl),
    appGatewayConfigured: Boolean(appRoutingUrl),
    fallbackAllowed: requestedMode !== 'valhalla',
    graphHopperApiKey: readEnv('GRAPH_HOPPER_API_KEY')
  };
}

function valhallaHeaders(config) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.apiKey) headers[config.apiKeyHeader] = config.apiKey;
  return headers;
}

export { getRoutingConfig, valhallaHeaders, DEFAULT_APP_ROUTING_URL };

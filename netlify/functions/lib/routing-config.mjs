const VALID_MODES = new Set(['auto', 'valhalla', 'fallback']);

function readEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (typeof netlifyValue === 'string' && netlifyValue.trim()) return netlifyValue.trim();
  const processValue = globalThis.process?.env?.[name];
  return typeof processValue === 'string' ? processValue.trim() : '';
}

function normaliseBaseUrl(value) {
  if (!value) return '';
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error('VALHALLA_BASE_URL must be a valid URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('VALHALLA_BASE_URL must use HTTP or HTTPS.');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString().replace(/\/$/, '');
}

function getRoutingConfig() {
  const requestedMode = (readEnv('ROUTING_MODE') || 'auto').toLowerCase();
  if (!VALID_MODES.has(requestedMode)) {
    throw new Error('ROUTING_MODE must be auto, valhalla, or fallback.');
  }

  const baseUrl = normaliseBaseUrl(readEnv('VALHALLA_BASE_URL'));
  const apiKey = readEnv('VALHALLA_API_KEY');
  const apiKeyHeader = readEnv('VALHALLA_API_KEY_HEADER') || 'X-Adventure-Builder-Key';

  if (requestedMode === 'valhalla' && !baseUrl) {
    throw new Error('ROUTING_MODE is valhalla, but VALHALLA_BASE_URL is not configured.');
  }

  return {
    mode: requestedMode,
    baseUrl,
    apiKey,
    apiKeyHeader,
    valhallaConfigured: Boolean(baseUrl),
    fallbackAllowed: requestedMode !== 'valhalla',
    graphHopperApiKey: readEnv('GRAPH_HOPPER_API_KEY')
  };
}

function valhallaHeaders(config) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.apiKey) headers[config.apiKeyHeader] = config.apiKey;
  return headers;
}

export { getRoutingConfig, valhallaHeaders };

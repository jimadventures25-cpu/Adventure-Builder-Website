const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=120' },
  body: JSON.stringify(body)
});

const haversine = (aLat, aLon, bLat, bLon) => {
  const R = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const networkLabel = (network) => ({
  iwn: 'International walking route', nwn: 'National walking route', rwn: 'Regional walking route', lwn: 'Local walking route'
}[network] || 'Walking route');

const geometryFromRelation = (relation) => {
  const lines = [];
  for (const member of relation?.members || []) {
    if (member.type !== 'way' || !Array.isArray(member.geometry) || member.geometry.length < 2) continue;
    lines.push(member.geometry.map((point) => [point.lon, point.lat]));
  }
  return lines.length ? { type: 'MultiLineString', coordinates: lines } : null;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const input = JSON.parse(event.body || '{}');
    const relationId = Number(input.relationId);
    if (Number.isInteger(relationId) && relationId > 0) {
      const detailQuery = `[out:json][timeout:18];relation(${relationId});out body geom;`;
      const detailResponse = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': 'AdventureBuilder/1.0' },
        body: new URLSearchParams({ data: detailQuery }).toString(),
        signal: AbortSignal.timeout(20000)
      });
      if (!detailResponse.ok) throw new Error(`OpenStreetMap route detail returned ${detailResponse.status}.`);
      const detail = await detailResponse.json();
      const relation = (detail.elements || []).find((item) => item.type === 'relation' && item.id === relationId);
      const geometry = geometryFromRelation(relation);
      if (!geometry) return json(404, { error: 'Route geometry is not available for this mapped route.' });
      return json(200, { geometry, source: 'OpenStreetMap route relation' });
    }

    const lat = Number(input.lat);
    const lon = Number(input.lon);
    const radius = Math.min(20000, Math.max(1000, Number(input.radius) || 12000));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json(400, { error: 'A valid location is required.' });
    }

    const query = `[out:json][timeout:18];\n(\n relation(around:${Math.round(radius)},${lat},${lon})[route~"^(hiking|foot)$"][name];\n);\nout center tags;`;
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': 'AdventureBuilder/1.0' },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`OpenStreetMap route lookup returned ${response.status}.`);
    const payload = await response.json();
    const seen = new Set();
    const routes = (payload.elements || []).map((item) => {
      const cLat = Number(item.center?.lat);
      const cLon = Number(item.center?.lon);
      const name = item.tags?.name;
      if (!name || !Number.isFinite(cLat) || !Number.isFinite(cLon)) return null;
      const key = `${name}|${item.tags?.ref || ''}`.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: `osm-relation-${item.id}`,
        osmRelationId: item.id,
        name,
        ref: item.tags?.ref || '',
        network: item.tags?.network || '',
        networkLabel: networkLabel(item.tags?.network),
        operator: item.tags?.operator || '',
        lat: cLat,
        lon: cLon,
        distanceFromUser: haversine(lat, lon, cLat, cLon)
      };
    }).filter(Boolean).sort((a, b) => a.distanceFromUser - b.distanceFromUser).slice(0, 20);

    return json(200, { routes, source: 'OpenStreetMap route relations' });
  } catch (error) {
    console.error('nearby-walking-routes', error);
    return json(502, { error: 'Nearby walking routes could not be loaded right now.' });
  }
};

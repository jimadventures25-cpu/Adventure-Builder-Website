const EARTH_RADIUS_METRES = 6371000;

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

function haversine(a, b) {
  const p1 = Number(a?.[1]) * Math.PI / 180;
  const p2 = Number(b?.[1]) * Math.PI / 180;
  const dp = (Number(b?.[1]) - Number(a?.[1])) * Math.PI / 180;
  const dl = (Number(b?.[0]) - Number(a?.[0])) * Math.PI / 180;
  if (![p1, p2, dp, dl].every(Number.isFinite)) return 0;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function quantisePoint(point, decimals = 4) {
  const lon = Number(point?.[0]);
  const lat = Number(point?.[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '';
  return `${lon.toFixed(decimals)},${lat.toFixed(decimals)}`;
}

function repetitionRatio(coordinates = []) {
  if (coordinates.length < 3) return 1;
  const seen = new Set();
  let duplicate = 0;
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const a = quantisePoint(coordinates[i - 1]);
    const b = quantisePoint(coordinates[i]);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    total += 1;
    if (seen.has(key)) duplicate += 1;
    seen.add(key);
  }
  return total ? duplicate / total : 1;
}

function sharpTurnRatio(coordinates = []) {
  if (coordinates.length < 5) return 0;
  const step = Math.max(1, Math.floor(coordinates.length / 120));
  let sharp = 0;
  let measured = 0;
  for (let i = step; i < coordinates.length - step; i += step) {
    const a = coordinates[i - step];
    const b = coordinates[i];
    const c = coordinates[i + step];
    const v1 = [Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1])];
    const v2 = [Number(c[0]) - Number(b[0]), Number(c[1]) - Number(b[1])];
    const m1 = Math.hypot(v1[0], v1[1]);
    const m2 = Math.hypot(v2[0], v2[1]);
    if (!m1 || !m2) continue;
    const cosine = Math.min(1, Math.max(-1, (v1[0] * v2[0] + v1[1] * v2[1]) / (m1 * m2)));
    const angle = Math.acos(cosine) * 180 / Math.PI;
    measured += 1;
    if (angle < 55) sharp += 1;
  }
  return measured ? sharp / measured : 0;
}

function selfIntersectionPenalty(coordinates = []) {
  if (coordinates.length < 12) return 0;
  const stride = Math.max(1, Math.floor(coordinates.length / 80));
  const pts = coordinates.filter((_, index) => index % stride === 0);
  if (pts[pts.length - 1] !== coordinates[coordinates.length - 1]) pts.push(coordinates[coordinates.length - 1]);
  const orient = (a, b, c) => (Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(a[1])) - (Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(a[0]));
  let intersections = 0;
  let tests = 0;
  for (let i = 1; i < pts.length; i += 1) {
    for (let j = i + 3; j < pts.length; j += 1) {
      if (i === 1 && j === pts.length - 1) continue;
      tests += 1;
      const a = pts[i - 1], b = pts[i], c = pts[j - 1], d = pts[j];
      const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
      if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) intersections += 1;
    }
  }
  if (!tests) return 0;
  return clamp01(intersections / 3);
}

function scoreTrailRoute(route, targetMetres, activity = 'walk') {
  const distance = Number(route?.distance);
  const coordinates = route?.geometry?.coordinates || [];
  if (!Number.isFinite(distance) || distance <= 0 || coordinates.length < 5 || !Number.isFinite(targetMetres) || targetMetres <= 0) {
    return { score: Infinity, quality: 0, grade: 'poor', metrics: {} };
  }
  const distanceError = Math.abs(distance - targetMetres) / targetMetres;
  const closureMetres = haversine(coordinates[0], coordinates[coordinates.length - 1]);
  const closurePenalty = clamp01(closureMetres / Math.max(80, targetMetres * 0.03));
  const repetition = repetitionRatio(coordinates);
  const sharpTurns = sharpTurnRatio(coordinates);
  const crossings = selfIntersectionPenalty(coordinates);

  const weights = activity === 'jog'
    ? { distance: 0.50, repetition: 0.20, turns: 0.18, crossings: 0.08, closure: 0.04 }
    : activity === 'cycle'
      ? { distance: 0.52, repetition: 0.19, turns: 0.13, crossings: 0.11, closure: 0.05 }
      : { distance: 0.55, repetition: 0.20, turns: 0.10, crossings: 0.10, closure: 0.05 };

  const distanceScale = activity === 'cycle' ? 0.24 : (activity === 'jog' ? 0.30 : 0.34);
  const distancePenalty = clamp01(distanceError / distanceScale);
  const penalty = distancePenalty * weights.distance + repetition * weights.repetition + sharpTurns * weights.turns + crossings * weights.crossings + closurePenalty * weights.closure;
  const quality = Math.round((1 - clamp01(penalty)) * 100);
  const score = penalty;
  const grade = quality >= 82 ? 'excellent' : quality >= 68 ? 'good' : quality >= 52 ? 'fair' : 'poor';
  return {
    score,
    quality,
    grade,
    metrics: { distanceError, closureMetres, repetition, sharpTurns, crossings }
  };
}

function acceptableTrailRoute(result, activity = 'walk') {
  const error = Number(result?.metrics?.distanceError);
  const tolerance = activity === 'cycle' ? 0.12 : (activity === 'jog' ? 0.15 : 0.18);
  return Number.isFinite(error) && error <= tolerance && Number(result?.quality) >= 60;
}

export { scoreTrailRoute, acceptableTrailRoute, repetitionRatio, sharpTurnRatio, selfIntersectionPenalty };

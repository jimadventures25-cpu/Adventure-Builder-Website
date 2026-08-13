(() => {
  'use strict';

  const EARTH_RADIUS_METRES = 6371000;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function destinationPoint(start, distanceMetres, bearingDegrees) {
    const bearing = bearingDegrees * Math.PI / 180;
    const phi1 = start.lat * Math.PI / 180;
    const lambda1 = start.lon * Math.PI / 180;
    const delta = distanceMetres / EARTH_RADIUS_METRES;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing));
    const lambda2 = lambda1 + Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );
    return { lat: phi2 * 180 / Math.PI, lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180 };
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      let t = value += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function radiusFactor(style, activity) {
    const base = style === 'gentle' ? 0.155 : style === 'adventurous' ? 0.235 : 0.195;
    if (activity === 'cycle') return base * 1.04;
    if (activity === 'jog') return base * 0.96;
    return base;
  }

  function buildCandidate(start, targetMetres, style, activity, random, candidateIndex, scale = 1) {
    const minimumRadius = activity === 'cycle' ? 500 : 300;
    const radius = Math.max(minimumRadius, targetMetres * radiusFactor(style, activity) * scale * (0.90 + random() * 0.20));
    const direction = random() * 360;
    const jitter = () => (random() - 0.5) * 16;
    const shape = candidateIndex % 4;

    if (shape === 0) {
      return [
        start,
        destinationPoint(start, radius, direction + jitter()),
        destinationPoint(start, radius * (0.92 + random() * 0.16), direction + 120 + jitter()),
        { ...start }
      ];
    }
    if (shape === 1) {
      return [
        start,
        destinationPoint(start, radius * 0.82, direction + jitter()),
        destinationPoint(start, radius * 1.08, direction + 88 + jitter()),
        destinationPoint(start, radius * 0.82, direction + 180 + jitter()),
        { ...start }
      ];
    }
    if (shape === 2) {
      return [
        start,
        destinationPoint(start, radius * 0.72, direction - 34 + jitter()),
        destinationPoint(start, radius * 1.18, direction + jitter()),
        destinationPoint(start, radius * 0.72, direction + 34 + jitter()),
        { ...start }
      ];
    }
    return [
      start,
      destinationPoint(start, radius * 0.75, direction + jitter()),
      destinationPoint(start, radius * 1.05, direction + 72 + jitter()),
      destinationPoint(start, radius * 0.70, direction + 155 + jitter()),
      { ...start }
    ];
  }

  function quality(route, targetMetres) {
    const distance = Number(route?.distance);
    const coords = route?.geometry?.coordinates || [];
    if (!Number.isFinite(distance) || distance <= 0 || coords.length < 5) return Infinity;
    if (distance < targetMetres * 0.45 || distance > targetMetres * 1.80) return Infinity;
    return Math.abs(distance - targetMetres) / targetMetres;
  }

  function makePlan({ start, targetMetres, style = 'balanced', activity = 'walk', seed = Date.now() }) {
    if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lon)) throw new Error('A valid start point is required.');
    const target = clamp(Number(targetMetres), 800, 50000);
    const random = mulberry32(seed >>> 0);
    const passes = [
      { scale: 1.00, tolerance: 0.12, count: 5 },
      { scale: 0.86, tolerance: 0.20, count: 5 },
      { scale: 1.16, tolerance: 0.30, count: 6 }
    ];
    let index = 0;
    return passes.map((pass) => ({
      tolerance: pass.tolerance,
      candidates: Array.from({ length: pass.count }, () => buildCandidate(start, target, style, activity, random, index++, pass.scale))
    }));
  }

  window.AdventureBuilderWalkingLoopEngine = Object.freeze({ destinationPoint, buildCandidate, quality, makePlan });
})();

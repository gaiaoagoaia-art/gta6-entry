// Small seeded random helpers so the city is the same city on every visit.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) { return min + rng() * (max - min); }
export function rangeInt(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
export function pick(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }
export function chance(rng, p) { return rng() < p; }

export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

// Shortest signed angle from a to b, in radians.
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(angle, target, maxStep) {
  const d = angleDelta(angle, target);
  return angle + clamp(d, -maxStep, maxStep);
}

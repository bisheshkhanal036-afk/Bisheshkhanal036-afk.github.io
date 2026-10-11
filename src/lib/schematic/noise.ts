/**
 * Deterministic generators for schematic figures. Every synthetic dataset on the site
 * comes from here with a fixed seed, so builds are reproducible and nothing is hand-drawn
 * to look like a result.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 2D value noise in [0, 1], lattice spacing 1. */
export function valueNoise2D(seed: number) {
  const rnd = mulberry32(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const vals = Array.from({ length: 256 }, () => rnd());
  const h = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 255]];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/** Fractal sum of value noise, normalised to about [0, 1]. */
export function fbm(seed: number, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => valueNoise2D(seed + i * 101));
  return (x: number, y: number) => {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (const n of layers) {
      sum += amp * n(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

/** A closed, wobbly outline around (cx, cy): a stand-in catchment boundary. */
export function blobOutline(seed: number, cx: number, cy: number, rx: number, ry: number, n = 72, wobble = 0.22) {
  const noise = valueNoise2D(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + wobble * (noise(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5) - 0.5) * 2;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r] as [number, number];
  });
}

export function pointInPolygon([x, y]: [number, number], poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const pathFrom = (pts: [number, number][], close = false) =>
  'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');

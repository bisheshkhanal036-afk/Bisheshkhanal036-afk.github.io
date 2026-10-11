/**
 * Synthetic FloodHUB stand-in for Fig. 6: five 64x64 criterion layers and their default
 * weighted-overlay risk surface. Runs at build time only (uses node:zlib via png.ts).
 */
import { fbm, valueNoise2D } from './noise';
import { pngDataUri } from './png';

export function buildLayers() {
  const N = 64, SEED = 6060;
  const base = fbm(SEED, 4);
  const jitter = valueNoise2D(SEED + 9);
  const riverX = (y: number) => 30 + 7 * Math.sin(y / 9) + 4 * (jitter(y / 12, 2) - 0.5);
  const city: [number, number] = [38, 24];

  const elev: number[] = [], dRiv: number[] = [], pop: number[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.abs(x - riverX(y));
    dRiv.push(d);
    elev.push(Math.min(1, 0.35 * base(x / 14, y / 14) + 0.65 * Math.min(1, d / 30)));
    pop.push(Math.min(1, Math.max(0, Math.exp(-((x - city[0]) ** 2 + (y - city[1]) ** 2) / (2 * 11 ** 2)) + 0.25 * (base(x / 6 + 9, y / 6) - 0.5))));
  }
  const at = (a: number[], x: number, y: number) => a[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
  const slope = elev.map((_, i) => {
    const x = i % N, y = Math.floor(i / N);
    return Math.hypot(at(elev, x + 1, y) - at(elev, x - 1, y), at(elev, x, y + 1) - at(elev, x, y - 1));
  });
  const sMax = Math.max(...slope);
  const cover = elev.map((e, i) => (pop[i] > 0.45 && e < 0.55 ? 1 : e > 0.62 ? 0.15 : 0.55)); // urban, forest, cropland

  // Criterion scores in [0, 1], 1 = more flood-prone.
  const layers = [
    { id: 'elev', label: 'Elevation', note: 'low ground scores high', w: 25, r: elev.map((e) => 1 - e) },
    { id: 'slope', label: 'Slope', note: 'flat ground scores high', w: 15, r: slope.map((s) => 1 - s / sMax) },
    { id: 'cover', label: 'Land cover', note: 'built-up scores high', w: 15, r: cover },
    { id: 'river', label: 'Distance to river', note: 'near the channel scores high', w: 30, r: dRiv.map((d) => 1 - Math.min(1, d / 22)) },
    { id: 'pop', label: 'Population', note: 'dense areas score high', w: 15, r: pop },
  ];

  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const ramp = (stops: number[][]) => (t: number) => {
    const s = Math.min(stops.length - 1.0001, Math.max(0, t) * (stops.length - 1));
    const i = Math.floor(s);
    return lerp(stops[i], stops[i + 1], s - i);
  };
  const criterionRamp = ramp([[236, 231, 220], [143, 175, 178], [47, 89, 102]]);
  const riskRamp = ramp([[240, 233, 218], [219, 160, 74], [135, 86, 15], [58, 38, 12]]);
  const toPng = (vals: number[], r: (t: number) => number[]) => {
    const px = new Uint8Array(N * N * 4);
    vals.forEach((v, i) => { px.set([...r(v), 255], i * 4); });
    return pngDataUri(N, N, px);
  };
  const wSum = layers.reduce((a, l) => a + l.w, 0);
  const risk = elev.map((_, i) => layers.reduce((a, l) => a + l.w * l.r[i], 0) / wSum);
  const lo = Math.min(...risk), hi = Math.max(...risk);
  const riskPng = toPng(risk.map((v) => (v - lo) / (hi - lo)), riskRamp);
  const layerPngs = layers.map((l) => toPng(l.r, criterionRamp));
  const payload = JSON.stringify({
    n: N,
    layers: layers.map((l) => Buffer.from(Uint8Array.from(l.r.map((v) => Math.round(v * 255)))).toString('base64')),
    ramp: Array.from({ length: 256 }, (_, i) => riskRamp(i / 255)),
  });

  return { N, layers, riskPng, layerPngs, payload };
}

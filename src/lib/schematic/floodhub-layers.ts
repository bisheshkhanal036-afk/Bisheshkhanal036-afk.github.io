/**
 * Real FloodHUB data for Fig. 6 (build time only; uses node:zlib via png.ts).
 * - src/data/floodhub/layers.json  criteria, weights, risk (scripts/data/floodhub_cache_to_json.py)
 * - src/data/floodhub/steps.json   hazard classes, report, validation, METEOR, shelters
 *                                  (scripts/data/floodhub_steps_to_json.py)
 * Criterion values are block-mean classes (1-5) scaled to 1..255, 0 = outside the basin.
 * Risk follows FloodHUB's formula: R_norm = (sum(w_i * class_i) - 1) / 4.
 */
import data from '../../data/floodhub/layers.json';
import steps from '../../data/floodhub/steps.json';
import { pngDataUri } from './png';

const decode = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ramp = (stops: number[][]) => (t: number) => {
  const s = Math.min(stops.length - 1.0001, Math.max(0, t) * (stops.length - 1));
  const i = Math.floor(s);
  return lerp(stops[i], stops[i + 1], s - i);
};
export const criterionRamp = ramp([[236, 231, 220], [143, 175, 178], [47, 89, 102]]);
export const riskRamp = ramp([[240, 233, 218], [219, 160, 74], [135, 86, 15], [58, 38, 12]]);
const exposureRamp = ramp([[236, 231, 220], [196, 146, 120], [126, 52, 40]]);
/** Hazard class colours, 1 Very Low .. 5 Very High (same family as the risk ramp). */
export const HAZARD_RGB: Record<number, number[]> = {
  1: [240, 233, 218], 2: [229, 205, 150], 3: [208, 146, 62], 4: [135, 86, 15], 5: [58, 38, 12],
};

/** Trace the outer boundary of a cell mask into closed loops (grid units). Longest first. */
function traceOutline(inside: (x: number, y: number) => boolean, W: number, H: number): string[] {
  // Directed boundary edges, clockwise around each inside cell.
  const next = new Map<string, [number, number][]>();
  const add = (a: [number, number], b: [number, number]) => {
    const k = `${a[0]},${a[1]}`;
    (next.get(k) ?? next.set(k, []).get(k)!).push(b);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x, y - 1)) add([x, y], [x + 1, y]);
    if (!inside(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!inside(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!inside(x - 1, y)) add([x, y + 1], [x, y]);
  }
  const loops: [number, number][][] = [];
  for (const [k, outs] of next) {
    while (outs.length) {
      const start = k.split(',').map(Number) as [number, number];
      const loop: [number, number][] = [start];
      let cur = outs.pop()!;
      while (`${cur[0]},${cur[1]}` !== k) {
        loop.push(cur);
        const o = next.get(`${cur[0]},${cur[1]}`)!;
        cur = o.pop()!;
      }
      loops.push(loop);
    }
  }
  return loops
    .sort((a, b) => b.length - a.length)
    .map((l) => 'M' + l.map(([x, y]) => `${x},${y}`).join('L') + 'Z');
}

export function buildLayers() {
  const { w: W, h: H } = data.grid;
  const criteria = [...data.criteria].sort((a, b) => b.weight - a.weight).map((c) => ({ ...c, bytes: decode(c.values) }));

  const png = (vals: Uint8Array, color: (v: number) => number[] | null) => {
    const px = new Uint8Array(W * H * 4);
    vals.forEach((v, i) => {
      const c = color(v);
      if (c) px.set([...c, 255], i * 4);
    });
    return pngDataUri(W, H, px);
  };
  const scaled = (r: (t: number) => number[]) => (v: number) => (v === 0 ? null : r((v - 1) / 254));

  const riskBytes = decode(data.risk.values);
  const hazardBytes = decode(steps.hazard.classes);
  const exposureBytes = decode(steps.report.highShareGrid);
  const meteorBytes = decode(steps.meteor.shareGrid);
  const inBasin = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && riskBytes[y * W + x] !== 0;
  const outline = traceOutline(inBasin, W, H);
  const presentClasses = [1, 2, 3, 4, 5].filter((k) => hazardBytes.includes(k));
  const bipadCells = (steps.validation[0]?.cells ?? []).filter(([r, c]) => inBasin(c, r));

  return {
    W,
    H,
    criteria: criteria.map(({ id, label, weight }) => ({ id, label, weight })),
    riskPng: png(riskBytes, scaled(riskRamp)),
    hazardPng: png(hazardBytes, (v) => HAZARD_RGB[v] ?? null),
    /** One image per hazard class present, so classes can appear one after another. */
    classPngs: presentClasses.map((k) => ({ k, src: png(hazardBytes, (v) => (v === k ? HAZARD_RGB[k] : null)) })),
    exposurePng: png(exposureBytes, (v) => (v === 0 ? null : exposureRamp((v - 1) / 254))),
    outline,
    bipadCells,
    /** For the client: same order as `criteria`. Layer PNGs are added by the JSON endpoint. */
    payload: {
      w: W,
      h: H,
      weights: criteria.map((c) => c.weight),
      layers: criteria.map((c) => c.values),
      meteor: steps.meteor.shareGrid,
      ramp: Array.from({ length: 256 }, (_, i) => riskRamp(i / 255)),
    },
    layerPngs: criteria.map((c) => png(c.bytes, scaled(criterionRamp))),
    meta: data,
    steps,
  };
}

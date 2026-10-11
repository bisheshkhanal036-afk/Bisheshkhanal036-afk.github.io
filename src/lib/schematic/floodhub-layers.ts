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

  return {
    W,
    H,
    criteria: criteria.map(({ id, label, weight }) => ({ id, label, weight })),
    layerPngs: criteria.map((c) => png(c.bytes, scaled(criterionRamp))),
    riskPng: png(riskBytes, scaled(riskRamp)),
    maskPng: png(riskBytes, (v) => (v === 0 ? null : [222, 214, 196])),
    hazardPng: png(hazardBytes, (v) => HAZARD_RGB[v] ?? null),
    exposurePng: png(exposureBytes, (v) => (v === 0 ? null : exposureRamp((v - 1) / 254))),
    /** For the client: same order as `criteria`. */
    payload: {
      w: W,
      h: H,
      weights: criteria.map((c) => c.weight),
      layers: criteria.map((c) => c.values),
      ramp: Array.from({ length: 256 }, (_, i) => riskRamp(i / 255)),
    },
    meta: data,
    steps,
  };
}

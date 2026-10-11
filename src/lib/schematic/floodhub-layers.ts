/**
 * Real FloodHUB layers for Fig. 6 (build time only; uses node:zlib via png.ts).
 * Input: src/data/floodhub/layers.json, exported from a cached FloodHUB run by
 * scripts/data/floodhub_cache_to_json.py. Criterion values are block-mean classes (1-5)
 * scaled to 1..255, 0 = outside the basin. Risk follows FloodHUB's own formula:
 *   R_norm = (sum(w_i * class_i) - 1) / 4
 */
import data from '../../data/floodhub/layers.json';
import { pngDataUri } from './png';

const decode = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));
/** Scaled byte (1..255) back to a class value (1..5); 0 stays 0 (outside). */
export const toClass = (v: number) => (v === 0 ? 0 : 1 + (4 * (v - 1)) / 254);

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ramp = (stops: number[][]) => (t: number) => {
  const s = Math.min(stops.length - 1.0001, Math.max(0, t) * (stops.length - 1));
  const i = Math.floor(s);
  return lerp(stops[i], stops[i + 1], s - i);
};
export const criterionRamp = ramp([[236, 231, 220], [143, 175, 178], [47, 89, 102]]);
export const riskRamp = ramp([[240, 233, 218], [219, 160, 74], [135, 86, 15], [58, 38, 12]]);

export function buildLayers() {
  const { w: W, h: H } = data.grid;
  // Heaviest criterion on top of the stack.
  const criteria = [...data.criteria].sort((a, b) => b.weight - a.weight).map((c) => ({ ...c, bytes: decode(c.values) }));

  const toPng = (vals: Uint8Array, r: (t: number) => number[]) => {
    const px = new Uint8Array(W * H * 4);
    vals.forEach((v, i) => {
      if (v === 0) return; // transparent outside the basin
      px.set([...r((v - 1) / 254), 255], i * 4);
    });
    return pngDataUri(W, H, px);
  };

  const riskBytes = decode(data.risk.values);
  return {
    W,
    H,
    criteria: criteria.map(({ id, label, weight }) => ({ id, label, weight })),
    layerPngs: criteria.map((c) => toPng(c.bytes, criterionRamp)),
    riskPng: toPng(riskBytes, riskRamp),
    /** For the client: same order as `criteria`. */
    payload: {
      w: W,
      h: H,
      weights: criteria.map((c) => c.weight),
      layers: criteria.map((c) => c.values),
      ramp: Array.from({ length: 256 }, (_, i) => riskRamp(i / 255)),
    },
    meta: data,
  };
}

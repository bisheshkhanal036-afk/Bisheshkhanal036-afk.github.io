/**
 * Synthetic stand-in for the Bagmati figures (Fig. 3 and 4). Runs at build time.
 *
 * A wobbly catchment with a north–south main channel is tiled with hexagons. Each hex has
 * a flood threshold (height above the channel plus noise) and may hold buildings (a
 * density field, never individual points). A schematic hydrograph raises a stage; a hex
 * floods while stage > threshold. At each step, breadth-first search from the shelters
 * through dry hexes decides which building hexes can still reach a shelter.
 *
 * Nothing here is Bagmati data. It shows how the analysis works, not what it found.
 */
import { blobOutline, fbm, pathFrom, pointInPolygon } from './noise';
import { runoff } from '../hydro/scs';

const SEED = 4417;
export const W = 640, H = 440;
const R = 10.5; // hex radius
const HW = Math.sqrt(3) * R; // hex width (pointy-top)
const STAGE_MAX = 0.3; // stage at peak flow, in threshold units

export interface Hex { id: number; q: number; r: number; x: number; y: number; thr: number; building: boolean }

export function buildWorld() {
  const outline = blobOutline(SEED, W / 2, H / 2, 285, 196, 90, 0.18);
  const noise = fbm(SEED + 11, 4);
  const river: [number, number][] = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    return [W / 2 - 20 + 40 * t + 46 * (noise(t * 2.5, 4.2) - 0.5) + 24 * Math.sin(t * 7), 34 + t * (H - 60)];
  });
  // Two tributaries join the main channel; the wedges between channels are where
  // building areas can be cut off from shelters outside them.
  const join = (k: number) => river[k];
  const trib = (from: [number, number], k: number, bend: number): [number, number][] =>
    Array.from({ length: 30 }, (_, i) => {
      const t = i / 29, [jx, jy] = join(k);
      return [from[0] + (jx - from[0]) * t, from[1] + (jy - from[1]) * t + bend * Math.sin(t * Math.PI)];
    });
  const tribW = trib([70, 150], 30, -26);
  const tribE = trib([590, 110], 22, 22);
  const network = [...river, ...tribW, ...tribE];
  const dRiver = (x: number, y: number) => Math.min(...network.map(([a, b]) => Math.hypot(a - x, b - y)));
  // Town centre (stand-in) in the wedge between the main channel and the east tributary.
  const city: [number, number] = [W / 2 + 70, H * 0.3];

  const hexes: Hex[] = [];
  const index = new Map<string, number>();
  for (let r = 0; r * R * 1.5 < H + R; r++) {
    for (let q = 0; q * HW < W + HW; q++) {
      const x = q * HW + (r % 2 ? HW / 2 : 0) + 6, y = r * R * 1.5 + 8;
      if (!pointInPolygon([x, y], outline)) continue;
      const d = dRiver(x, y);
      const thr = d / 150 + 0.18 * (noise(x / 70, y / 70) - 0.5) + 0.02;
      const dens = Math.exp(-((x - city[0]) ** 2 + (y - city[1]) ** 2) / (2 * 130 ** 2)) + 0.35 * (noise(x / 30 + 3, y / 30) - 0.5);
      const id = hexes.length;
      hexes.push({ id, q, r, x, y, thr, building: dens > 0.42 });
      index.set(`${q},${r}`, id);
    }
  }
  // Odd-r offset neighbours.
  const nbrs = hexes.map((h) => {
    const odd = h.r % 2;
    const dirs = odd
      ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
      : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
    return dirs.map(([dq, dr]) => index.get(`${h.q + dq},${h.r + dr}`)).filter((v): v is number => v !== undefined);
  });

  // Shelters: high ground near three sites outside the town wedge.
  const shelters = ([[120, 290], [520, 330], [250, 395]] as [number, number][]).map(([sx, sy]) => {
    const cand = hexes.filter((h) => h.thr > STAGE_MAX + 0.12 && Math.hypot(h.x - sx, h.y - sy) < 70);
    return cand.sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy))[0].id;
  });

  // Schematic hydrograph drives the stage.
  const rain = [0, 2, 5, 9, 15, 22, 18, 12, 7, 4, 2, 1, 0, 0, 0, 0];
  const hyd = runoff(rain, 1, { areaKm2: 600, curveNumber: 78, tcHours: 6 });
  const qPeak = hyd.peakFlow;
  const STEPS = 18;
  const tEnd = hyd.flow.length;
  const stepTimes = Array.from({ length: STEPS }, (_, k) => (k / (STEPS - 1)) * tEnd);
  const qAt = (t: number) => {
    const i = Math.min(hyd.flow.length - 1, Math.max(0, Math.round(t) - 1));
    return t <= 0 ? 0 : hyd.flow[i];
  };
  const peakStep = stepTimes.reduce((best, t, k) => (qAt(t) > qAt(stepTimes[best]) ? k : best), 0);

  const HOPS = 10; // service area: reachable within this many hex steps
  const steps = stepTimes.map((t) => {
    const stage = STAGE_MAX * (qAt(t) / qPeak);
    const flooded = hexes.map((h) => h.thr < stage);
    const dist = new Array(hexes.length).fill(Infinity);
    const prev = new Array(hexes.length).fill(-1);
    const queue: number[] = [];
    for (const s of shelters) if (!flooded[s]) { dist[s] = 0; queue.push(s); }
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of nbrs[u]) {
        if (flooded[v] || dist[v] !== Infinity) continue;
        dist[v] = dist[u] + 1;
        prev[v] = u;
        queue.push(v);
      }
    }
    // f flooded, i isolated building, r reachable building, d dry other
    const code = hexes.map((h, i) => (flooded[i] ? 'f' : h.building ? (dist[i] === Infinity ? 'i' : 'r') : 'd')).join('');
    const service = hexes.map((_, i) => dist[i] <= HOPS);
    return { t, q: qAt(t), code, service, prev, dist };
  });

  // Service-area outline: hex edges between inside and outside.
  const corner = (h: Hex, k: number): [number, number] => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return [h.x + R * Math.cos(a), h.y + R * Math.sin(a)];
  };
  const hexPath = (h: Hex) => pathFrom(Array.from({ length: 6 }, (_, k) => corner(h, k)), true);
  const outlineOf = (inside: boolean[]) => {
    let d = '';
    hexes.forEach((h, i) => {
      if (!inside[i]) return;
      for (let k = 0; k < 6; k++) {
        const a = corner(h, k), b = corner(h, (k + 1) % 6);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const nx = h.x + (mx - h.x) * 2, ny = h.y + (my - h.y) * 2;
        const n = hexes.findIndex((o) => Math.abs(o.x - nx) < 2 && Math.abs(o.y - ny) < 2);
        if (n === -1 || !inside[n]) d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      }
    });
    return d;
  };

  // Two example routes from outlying building hexes to their nearest reachable shelter.
  // Origins picked from the computed result: one building hex that is cut off at the
  // peak, and the dry one whose route to safety lengthens most.
  const base = steps[0], pk = steps[peakStep];
  const dryBuildings = hexes.filter((h) => h.building && pk.code[h.id] !== 'f' && base.dist[h.id] !== Infinity);
  const cutOff = dryBuildings
    .filter((h) => pk.code[h.id] === 'i')
    .sort((a, b) => base.dist[a.id] - base.dist[b.id])[0];
  const detour = dryBuildings
    .filter((h) => pk.code[h.id] === 'r')
    .sort((a, b) => (pk.dist[b.id] - base.dist[b.id]) - (pk.dist[a.id] - base.dist[a.id]))[0];
  const routeOrigins = [cutOff, detour].filter(Boolean).map((h) => h.id);
  const routes = steps.map((s) =>
    routeOrigins.map((o) => {
      if (s.dist[o] === Infinity) return '';
      const pts: [number, number][] = [];
      for (let u = o; u !== -1; u = s.prev[u]) pts.push([hexes[u].x, hexes[u].y]);
      return pathFrom(pts);
    }),
  );

  // Satellite stand-in for Fig. 4: the peak extent, with its edge perturbed.
  const peakFlooded = steps[peakStep].code.split('').map((c) => c === 'f');
  const stagePeak = STAGE_MAX * (steps[peakStep].q / qPeak);
  const sat = hexes.map((h, i) => {
    const margin = h.thr - stagePeak;
    const wob = 0.09 * (noise(h.x / 22 + 40, h.y / 22) - 0.5) * 2;
    return Math.abs(margin) < 0.09 ? margin + wob < 0 : peakFlooded[i];
  });

  return {
    outline: pathFrom(outline, true),
    river: [river, tribW, tribE].map((r) => pathFrom(r)).join(''),
    hexes: hexes.map((h) => ({ ...h, d: hexPath(h) })),
    shelters,
    routeOrigins,
    steps: steps.map((s, k) => ({ t: s.t, q: s.q, code: s.code, service: outlineOf(s.service), routes: routes[k] })),
    peakStep,
    hydro: { flow: hyd.flow, dt: 1, peak: qPeak },
    validation: { model: peakFlooded, sat },
  };
}

/**
 * Stand-in world for the Bagmati figures (Fig. 3 and 4). Runs at build time.
 *
 * Geography is real, from FloodHUB's cache (src/data/floodhub/world.json, exported by
 * scripts/data/floodhub_world_to_json.py): the basin around the Kathmandu Valley, OSM rivers
 * and long road segments, a GLO-30 hillshade, and per-hex FloodHUB risk, High-hazard share,
 * METEOR flooded share and aggregated building counts.
 *
 * The flood is a proxy: as a schematic hydrograph rises, hexes flood in order of their
 * High-hazard share, reaching the High-hazard zones at the peak. Breadth-first search from
 * a few low-risk shelter hexes through dry hexes then marks which building hexes keep a way
 * out. This shows how the analysis works; it is not the manuscript's HEC-RAS result.
 */
import world from '../../data/floodhub/world.json';
import { pathFrom } from './noise';
import { runoff } from '../hydro/scs';

export const W = world.size.w;
export const H = world.size.h;
const R = world.hexRadius;

interface RawHex { x: number; y: number; risk: number; high: number; meteor: number; elev: number; b: number }
export interface Hex extends RawHex { id: number; building: boolean; d: string }

export interface WorldOptions { near?: number; elevPct?: number; highCut?: number; shelters?: number; reach?: number; minRoad?: number; offRoad?: number; minRiver?: number }

export function buildWorld(opt: WorldOptions = {}) {
  const raw = world.hexes as RawHex[];
  const corner = (x: number, y: number, k: number): [number, number] => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return [x + R * Math.cos(a), y + R * Math.sin(a)];
  };
  const hexes: Hex[] = raw.map((h, id) => ({
    ...h, id, building: h.b > 0,
    d: pathFrom(Array.from({ length: 6 }, (_, k) => corner(h.x, h.y, k)), true),
  }));

  // Neighbours: centres one hex-width apart.
  const step = Math.sqrt(3) * R;
  const bucket = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.round(x / step)},${Math.round(y / step)}`;
  hexes.forEach((h) => { const k = key(h.x, h.y); (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(h.id); });
  const nbrs = hexes.map((h) => {
    const out: number[] = [];
    const bx = Math.round(h.x / step), by = Math.round(h.y / step);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of bucket.get(`${bx + dx},${by + dy}`) ?? []) {
        if (j === h.id) continue;
        const d = Math.hypot(hexes[j].x - h.x, hexes[j].y - h.y);
        if (d < step * 1.15) out.push(j);
      }
    }
    return out;
  });

  // Distance from each hex to the nearest OSM waterway (figure units).
  // Main rivers: the longer waterway segments, densified.
  const MIN_RIVER = opt.minRiver ?? 40; // figure units (about 5 km)
  const rv: [number, number][] = [];
  const mainRivers: string[] = [];
  for (const sub of world.rivers.split('M').filter(Boolean)) {
    const pts = [...sub.matchAll(/(-?[0-9.]+),(-?[0-9.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    if (len < MIN_RIVER) continue;
    mainRivers.push('M' + sub);
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
      for (let j = 0; j <= n; j++) rv.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    }
  }
  const rb = new Map<string, [number, number][]>();
  const rk = (x: number, y: number) => `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
  rv.forEach((pt) => { const k = rk(pt[0], pt[1]); (rb.get(k) ?? rb.set(k, []).get(k)!).push(pt); });
  const riverDist = hexes.map((h) => {
    let best = Infinity;
    const bx = Math.floor(h.x / 20), by = Math.floor(h.y / 20);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      for (const [x, y] of rb.get(`${bx + dx},${by + dy}`) ?? []) best = Math.min(best, Math.hypot(x - h.x, y - h.y));
    }
    return best;
  });

  // Floodplain proxy: valley-floor hexes near the main rivers, plus the strongest
  // High-hazard zones. Flood order: highest score first.
  // Valley floor: the lower part of the basin by elevation.
  const sortedElev = hexes.map((h) => h.elev).sort((a, b) => a - b);
  const floorElev = sortedElev[Math.floor(sortedElev.length * (opt.elevPct ?? 0.45))];
  const NEAR = R * (opt.near ?? 0.8);
  const score = hexes.map((h, i) => {
    // Continuous corridor along main rivers across the valley floor (no risk filter inside it).
    const near = riverDist[i] <= NEAR && h.elev <= floorElev ? 1 - riverDist[i] / NEAR : 0;
    return Math.max(h.high >= (opt.highCut ?? 0.7) ? 0.4 + 0.6 * h.high : 0, near > 0 ? 0.25 + 0.75 * near : 0) + 0.02 * h.risk;
  });

  // Road network: hexes crossed by an OSM road (long segments). Evacuation moves along these.
  // Keep the longer segments as the arterial network (the cache has no road classes).
  const MIN_ROAD = opt.minRoad ?? 40; // figure units (about 80 m each)
  const arterial: string[] = [];
  const rdPts: [number, number][] = [];
  for (const sub of world.roads.split('M').filter(Boolean)) {
    const pts = [...sub.matchAll(/(-?[0-9.]+),(-?[0-9.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    if (len < MIN_ROAD) continue;
    arterial.push('M' + sub);
    // Densify so short hexes along long straight segments still register.
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
      for (let j = 0; j <= n; j++) rdPts.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    }
  }
  const rdB = new Map<string, [number, number][]>();
  rdPts.forEach((pt) => { const k = rk(pt[0], pt[1]); (rdB.get(k) ?? rdB.set(k, []).get(k)!).push(pt); });
  const roadHex = hexes.map((h) => {
    const bx = Math.floor(h.x / 20), by = Math.floor(h.y / 20);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const [x, y] of rdB.get(`${bx + dx},${by + dy}`) ?? []) if (Math.hypot(x - h.x, y - h.y) <= R * 0.9) return true;
    }
    return false;
  });
  // Travel cost between neighbouring hexes: 1 along an arterial, OFF_ROAD otherwise.
  const OFF_ROAD = opt.offRoad ?? 3;
  const edgeCost = (u: number, v: number) => (roadHex[u] && roadHex[v] ? 1 : OFF_ROAD);

  // Shelters (illustrative, not FloodHUB's shortlist): low-risk road hexes with buildings,
  // away from the river corridors, chosen greedily to cover the most buildings by road.
  const REACH = opt.reach ?? 28; // travel-cost budget: 24 arterial hexes (~27 km) or 8 off-road hexes
  const risks = [...hexes].map((h) => h.risk).sort((a, b) => a - b);
  const lowRisk = risks[Math.floor(risks.length * 0.45)];
  const cand = hexes.filter((h, i) => roadHex[i] && h.b >= 20 && h.risk <= lowRisk && h.high === 0 && riverDist[i] > NEAR * 1.5);
  // Dijkstra with small integer costs (bucket queue), never entering flooded hexes.
  const roadBfs = (sources: number[], blocked: boolean[] = []) => {
    const d = new Array(hexes.length).fill(Infinity);
    const prev = new Array(hexes.length).fill(-1);
    const buckets: number[][] = [[]];
    for (const s0 of sources) if (!blocked[s0]) { d[s0] = 0; buckets[0].push(s0); }
    for (let c = 0; c < buckets.length; c++) {
      for (const u of buckets[c] ?? []) {
        if (d[u] !== c) continue;
        for (const v of nbrs[u]) {
          if (blocked[v]) continue;
          const nd = c + edgeCost(u, v);
          if (nd < d[v]) { d[v] = nd; prev[v] = u; (buckets[nd] ??= []).push(v); }
        }
      }
    }
    return { d, prev };
  };
  const hexReach = (d: number[]) => d;
  const reachOf = new Map(cand.map((c) => [c.id, hexReach(roadBfs([c.id]).d)]));
  const totalB = hexes.reduce((a, h) => a + h.b, 0);
  const covered = new Array(hexes.length).fill(false);
  const shelters: number[] = [];
  let coveredB = 0;
  while (coveredB < 0.95 * totalB && shelters.length < (opt.shelters ?? 7)) {
    let best = -1, gain = 0;
    for (const c of cand) {
      if (shelters.includes(c.id)) continue;
      const d = reachOf.get(c.id)!;
      let g = 0;
      for (let k = 0; k < hexes.length; k++) if (!covered[k] && d[k] <= REACH) g += hexes[k].b;
      if (g > gain) { gain = g; best = c.id; }
    }
    if (best < 0) break;
    shelters.push(best);
    const d = reachOf.get(best)!;
    for (let k = 0; k < hexes.length; k++) if (!covered[k] && d[k] <= REACH) { covered[k] = true; coveredB += hexes[k].b; }
  }

  // Schematic hydrograph drives the stage.
  const rain = [0, 2, 5, 9, 15, 22, 18, 12, 7, 4, 2, 1, 0, 0, 0, 0];
  const hyd = runoff(rain, 1, { areaKm2: 600, curveNumber: 78, tcHours: 6 });
  const qPeak = hyd.peakFlow;
  const STEPS = 18;
  const tEnd = hyd.flow.length;
  const stepTimes = Array.from({ length: STEPS }, (_, k) => (k / (STEPS - 1)) * tEnd);
  const qAt = (t: number) => (t <= 0 ? 0 : hyd.flow[Math.min(hyd.flow.length - 1, Math.max(0, Math.round(t) - 1))]);
  const peakStep = stepTimes.reduce((best, t, k) => (qAt(t) > qAt(stepTimes[best]) ? k : best), 0);

  // A building hex is cut off when floodwater leaves no dry road path to a shelter within
  // REACH road hexes. "Out of reach" hexes had no such path even before the flood.
  const HOPS = REACH;
  const baseDist = hexReach(roadBfs(shelters).d);
  const steps = stepTimes.map((t) => {
    const s = qAt(t) / qPeak; // 0..1
    const cut = 1.02 - 0.77 * s; // reaches 0.25 at the peak
    const flooded = hexes.map((_, i) => s > 0.02 && score[i] > 0 && score[i] >= cut);
    const { d: rdist, prev } = roadBfs(shelters, flooded);
    const dist = hexReach(rdist);
    // f flooded · i cut off by the flood · o out of reach even before it · r in reach · d no buildings
    const code = hexes.map((h, i) => (flooded[i] ? 'f' : !h.building ? 'd' : baseDist[i] > HOPS ? 'o' : dist[i] > HOPS ? 'i' : 'r')).join('');
    return { t, q: qAt(t), code, service: hexes.map((_, i) => dist[i] <= HOPS), prev, dist, rdist };
  });

  // Service-area outline: edges between inside and outside hexes.
  const outlineOf = (inside: boolean[]) => {
    let d = '';
    hexes.forEach((h, i) => {
      if (!inside[i]) return;
      for (let k = 0; k < 6; k++) {
        const a = corner(h.x, h.y, k), b = corner(h.x, h.y, (k + 1) % 6);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const nx = h.x + (mx - h.x) * 2, ny = h.y + (my - h.y) * 2;
        const n = nbrs[i].find((j) => Math.abs(hexes[j].x - nx) < 1.5 && Math.abs(hexes[j].y - ny) < 1.5);
        if (n === undefined || !inside[n]) d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      }
    });
    return d;
  };

  // Route origins from the computed result: a building hex cut off at the peak (largest),
  // and the reachable one whose way out lengthens most.
  const base = steps[0], pk = steps[peakStep];
  const dry = hexes.filter((h) => h.building && pk.code[h.id] !== 'f' && base.dist[h.id] !== Infinity);
  // Cut-off origin: the most built-up hex that had a shelter in reach before the flood and lost it.
  const cutOff = dry.filter((h) => pk.code[h.id] === 'i' && base.dist[h.id] <= HOPS).sort((a, b) => b.b - a.b)[0];
  const detour = dry
    .filter((h) => pk.code[h.id] === 'r')
    .sort((a, b) => (pk.dist[b.id] - base.dist[b.id]) - (pk.dist[a.id] - base.dist[a.id]))[0];
  const routeOrigins = [cutOff, detour].filter(Boolean).map((h) => h.id);
  const routes = steps.map((s) => routeOrigins.map((o) => {
    if (s.dist[o] > HOPS) return '';
    const pts: [number, number][] = [];
    for (let u = o; u !== -1; u = s.prev[u]) pts.push([hexes[u].x, hexes[u].y]);
    return pathFrom(pts);
  }));

  const peakFlooded = pk.code.split('').map((c) => c === 'f');
  const meteorFlooded = hexes.map((h) => h.meteor >= 0.3);
  const maxB = Math.max(...hexes.map((h) => h.b));

  return {
    size: { w: W, h: H },
    outline: world.outline,
    river: world.rivers,
    mainRivers: mainRivers.join(''),
    roads: arterial.join(''),
    hexes,
    /** 0..1 building density per hex, log-scaled, for shading */
    density: hexes.map((h) => (h.b > 0 ? Math.log10(h.b) / Math.log10(maxB) : 0)),
    shelters,
    routeOrigins,
    steps: steps.map((s, k) => ({ t: s.t, q: s.q, code: s.code, service: outlineOf(s.service), routes: routes[k] })),
    peakStep,
    hydro: { flow: hyd.flow, dt: 1, peak: qPeak },
    validation: { model: peakFlooded, sat: meteorFlooded },
    stats: {
      flooded: peakFlooded.filter(Boolean).length,
      isolated: pk.code.split('').filter((c) => c === 'i').length,
      buildingHexes: hexes.filter((h) => h.building).length,
      roadHexes: roadHex.filter(Boolean).length,
    },
  };
}

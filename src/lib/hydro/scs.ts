/**
 * SCS (NRCS) rainfall-runoff in SI units: curve-number losses and the
 * dimensionless unit hydrograph, combined by discrete convolution.
 * Same method family as HEC-HMS "SCS Curve Number" loss + "SCS Unit Hydrograph" transform.
 *
 * Reference: USDA NRCS, National Engineering Handbook Part 630, Ch. 10 (runoff) and Ch. 16 (hydrographs).
 */

/** NEH 630 Ch. 16, Table 16-1: dimensionless unit hydrograph, t/Tp → q/qp. */
const DUH: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.1, 0.03], [0.2, 0.1], [0.3, 0.19], [0.4, 0.31], [0.5, 0.47], [0.6, 0.66],
  [0.7, 0.82], [0.8, 0.93], [0.9, 0.99], [1.0, 1.0], [1.1, 0.99], [1.2, 0.93], [1.3, 0.86],
  [1.4, 0.78], [1.5, 0.68], [1.6, 0.56], [1.7, 0.46], [1.8, 0.39], [1.9, 0.33], [2.0, 0.28],
  [2.2, 0.207], [2.4, 0.147], [2.6, 0.107], [2.8, 0.077], [3.0, 0.055], [3.2, 0.04],
  [3.4, 0.029], [3.6, 0.021], [3.8, 0.015], [4.0, 0.011], [4.5, 0.005], [5.0, 0],
];

/** SI peak-rate factor: qp [m³/s] = 0.208 · A [km²] · Q [mm] / Tp [h]. */
const PEAK_FACTOR_SI = 0.208;

function duh(tRatio: number): number {
  if (tRatio <= 0 || tRatio >= 5) return 0;
  let i = 1;
  while (DUH[i][0] < tRatio) i++;
  const [t0, q0] = DUH[i - 1];
  const [t1, q1] = DUH[i];
  return q0 + ((q1 - q0) * (tRatio - t0)) / (t1 - t0);
}

export interface Catchment {
  areaKm2: number;
  curveNumber: number;
  /** Time of concentration, hours. */
  tcHours: number;
}

/** Incremental excess rainfall (mm per step) from incremental rainfall, SCS CN method, Ia = 0.2 S. */
export function excessRainfall(rainMm: number[], curveNumber: number): number[] {
  const S = 25400 / curveNumber - 254;
  const Ia = 0.2 * S;
  let cumP = 0;
  let prevPe = 0;
  return rainMm.map((p) => {
    cumP += p;
    const pe = cumP > Ia ? (cumP - Ia) ** 2 / (cumP - Ia + S) : 0;
    const inc = pe - prevPe;
    prevPe = pe;
    return inc;
  });
}

/** Unit hydrograph ordinates (m³/s per mm of excess) at spacing dtHours. */
export function unitHydrograph(c: Catchment, dtHours: number): { ordinates: number[]; tpHours: number; lagHours: number } {
  const lagHours = 0.6 * c.tcHours;
  const tpHours = dtHours / 2 + lagHours;
  const qp = (PEAK_FACTOR_SI * c.areaKm2 * 1) / tpHours;
  const n = Math.ceil((5 * tpHours) / dtHours) + 1;
  const ordinates = Array.from({ length: n }, (_, k) => qp * duh((k * dtHours) / tpHours));
  return { ordinates, tpHours, lagHours };
}

/** Discrete convolution: Q[n] = Σ_m Pe[m] · U[n − m]. Length = len(Pe) + len(U) − 1. */
export function convolve(excess: number[], uh: number[]): number[] {
  const out = new Array(excess.length + uh.length - 1).fill(0);
  excess.forEach((pe, m) => {
    if (pe === 0) return;
    uh.forEach((u, k) => {
      out[m + k] += pe * u;
    });
  });
  return out;
}

export interface Hydrograph {
  dtHours: number;
  rain: number[];
  excess: number[];
  flow: number[];
  peakFlow: number;
  peakTimeHours: number;
  /** Centroid of excess rainfall to time of peak flow, hours. */
  lagHours: number;
  totalRainMm: number;
  totalExcessMm: number;
}

export function runoff(rainMm: number[], dtHours: number, c: Catchment): Hydrograph {
  const excess = excessRainfall(rainMm, c.curveNumber);
  const { ordinates } = unitHydrograph(c, dtHours);
  const flow = convolve(excess, ordinates);
  let iPeak = 0;
  flow.forEach((q, i) => {
    if (q > flow[iPeak]) iPeak = i;
  });
  const totalExcessMm = excess.reduce((a, b) => a + b, 0);
  // Rainfall bars are stepped: step m covers [m·dt, (m+1)·dt], centre at (m + 0.5)·dt.
  const centroid = excess.reduce((a, pe, m) => a + pe * (m + 0.5) * dtHours, 0) / (totalExcessMm || 1);
  // Flow ordinate n is the end of step n.
  const peakTimeHours = (iPeak + 1) * dtHours;
  return {
    dtHours,
    rain: rainMm,
    excess,
    flow,
    peakFlow: flow[iPeak],
    peakTimeHours,
    lagHours: peakTimeHours - centroid,
    totalRainMm: rainMm.reduce((a, b) => a + b, 0),
    totalExcessMm,
  };
}

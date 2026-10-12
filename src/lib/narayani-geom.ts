/** Fig. 7 geometry shared by the build (narayani.ts) and the client script; no data imports. */
/** Map radius for a depth in mm: area grows with depth. */
export const rOf = (mm: number) => 1.6 + 0.95 * Math.sqrt(Math.max(0, mm));

// Strip chart geometry (shared with the client script).
export const STRIP = { w: 640, h: 342, x0: 52, x1: 628, top: 34, base: 240, yMax: 500 };
export const yOf = (mm: number) => STRIP.base - (Math.min(mm, STRIP.yMax) / STRIP.yMax) * (STRIP.base - STRIP.top);


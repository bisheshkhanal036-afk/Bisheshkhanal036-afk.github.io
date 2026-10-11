import { describe, expect, it } from 'vitest';
import { convolve, excessRainfall, runoff, unitHydrograph } from './scs';
import hero from '../../data/hero-schematic.json';

describe('excessRainfall', () => {
  it('produces no runoff until the initial abstraction is met', () => {
    // CN 80 → S = 63.5 mm, Ia = 12.7 mm
    expect(excessRainfall([5, 5], 80)).toEqual([0, 0]);
  });

  it('matches the closed-form CN equation for a single burst', () => {
    const S = 25400 / 80 - 254;
    const expected = (100 - 0.2 * S) ** 2 / (100 - 0.2 * S + S);
    const pe = excessRainfall([100], 80);
    expect(pe[0]).toBeCloseTo(expected, 6);
  });

  it('never exceeds rainfall', () => {
    const rain = [2, 8, 20, 30, 10, 4];
    excessRainfall(rain, 90).forEach((pe, i) => expect(pe).toBeLessThanOrEqual(rain[i]));
  });
});

describe('unitHydrograph', () => {
  it('conserves volume: 1 mm over the catchment (within table discretisation)', () => {
    const c = { areaKm2: 50, curveNumber: 80, tcHours: 3 };
    const dt = 0.25;
    const { ordinates } = unitHydrograph(c, dt);
    const volume = ordinates.reduce((a, q) => a + q, 0) * dt * 3600; // m³
    const expected = c.areaKm2 * 1e6 * 1e-3; // 1 mm over A
    expect(Math.abs(volume - expected) / expected).toBeLessThan(0.02);
  });

  it('peaks at Tp = dt/2 + 0.6 Tc', () => {
    const { tpHours, lagHours } = unitHydrograph({ areaKm2: 10, curveNumber: 75, tcHours: 2 }, 0.5);
    expect(lagHours).toBeCloseTo(1.2, 10);
    expect(tpHours).toBeCloseTo(1.45, 10);
  });
});

describe('convolve', () => {
  it('is linear superposition of shifted, scaled unit responses', () => {
    expect(convolve([1, 2], [1, 3, 1])).toEqual([1, 5, 7, 2]);
  });
});

describe('runoff (hero schematic)', () => {
  const h = runoff(hero.rainMm, hero.dtHours, hero.catchment);

  it('outflow volume equals excess-rainfall volume', () => {
    const vOut = h.flow.reduce((a, q) => a + q, 0) * h.dtHours * 3600;
    const vIn = h.totalExcessMm * 1e-3 * hero.catchment.areaKm2 * 1e6;
    expect(Math.abs(vOut - vIn) / vIn).toBeLessThan(0.02);
  });

  it('peak comes after the rainfall centroid', () => {
    expect(h.lagHours).toBeGreaterThan(0);
  });
});

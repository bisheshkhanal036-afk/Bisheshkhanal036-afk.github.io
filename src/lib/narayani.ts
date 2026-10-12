/**
 * Fig. 7, Narayani: build-time layout for "What a district mean hides".
 * Observed DHM gauge rainfall through the July 2003 storm (scripts/data/narayani_to_json.py),
 * district means computed here the way the paper's district panel does (mean of the
 * district's reporting gauges). No manuscript result statistics are used or shown.
 */
import storm from '../data/narayani/storm.json';

export const W = storm.size.w;
export const H = storm.size.h;

import { STRIP, yOf, rOf } from './narayani-geom';
export { STRIP, yOf, rOf };

const fmt = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function buildNarayani() {
  // Animate the storm's build-up: from the first day to the wettest day at any gauge.
  const peakAll = storm.days.map((_, k) => Math.max(...storm.gauges.map((g) => g.rain[k] ?? 0)));
  const peak = peakAll.indexOf(Math.max(...peakAll));
  const days = storm.days.slice(0, peak + 1);

  const districts = [...storm.districts].sort((a, b) => a.cx - b.cx);
  const col = (i: number) => STRIP.x0 + ((i + 0.5) / districts.length) * (STRIP.x1 - STRIP.x0);
  const dIndex = new Map(districts.map((d, i) => [d.name, i]));

  const gauges = storm.gauges.map((g) => ({
    ...g,
    rain: g.rain.slice(0, peak + 1).map((v) => (v == null ? null : v)),
    di: dIndex.get(g.district)!,
  }));

  // Spread a district's gauges across its column so they do not stack.
  const byD = districts.map((_, i) => gauges.filter((g) => g.di === i));
  const sx = new Map<number, number>();
  byD.forEach((list, i) => {
    const span = Math.min(18, 4 * (list.length - 1));
    [...list].sort((a, b) => a.x - b.x).forEach((g, j) => {
      sx.set(g.id, col(i) + (list.length > 1 ? -span / 2 + (span * j) / (list.length - 1) : 0));
    });
  });

  // District means per day.
  const means = days.map((_, k) =>
    byD.map((list) => {
      const v = list.map((g) => g.rain[k]).filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    }),
  );
  const peakMeans = means[peak];
  const maxMean = Math.max(...peakMeans);
  const wettest = gauges.reduce((a, b) => ((b.rain[peak] ?? 0) > (a.rain[peak] ?? 0) ? b : a));

  return {
    outline: storm.outline,
    hill: storm.hillshade.box,
    districts: districts.map((d, i) => ({ ...d, col: col(i), mean: peakMeans[i], fill: 0.06 + 0.6 * (peakMeans[i] / maxMean) })),
    gauges: gauges.map((g) => ({ ...g, sx: sx.get(g.id)! })),
    days,
    labels: days.map(fmt),
    peak,
    means,
    maxMean,
    wettest,
    shadow: districts.filter((d) => d.name === 'Mustang' || d.name === 'Manang'),
  };
}

/** What the client needs, kept small: per-gauge series and positions, per-district means. */
export function clientPayload(n: ReturnType<typeof buildNarayani>) {
  return {
    peak: n.peak,
    labels: n.labels,
    maxMean: n.maxMean,
    gauges: n.gauges.map((g) => ({ x: g.x, y: g.y, sx: g.sx, di: g.di, rain: g.rain })),
    districts: n.districts.map((d) => ({ cx: d.cx, cy: d.cy, col: d.col })),
    means: n.means.map((m) => m.map((v) => Math.round(v * 10) / 10)),
  };
}

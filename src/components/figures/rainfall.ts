import { mountScrub } from '../../lib/motion/scrub';
import { rOf, yOf } from '../../lib/narayani-geom';

interface Payload {
  peak: number; labels: string[]; maxMean: number;
  gauges: { x: number; y: number; sx: number; di: number; rain: (number | null)[] }[];
  districts: { cx: number; cy: number; col: number }[];
  means: number[][];
}

// Timeline: the storm builds (0..DAYS), holds on the wettest day, then averages (AVG..1).
const DAYS = 0.6, AVG = 0.7;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export async function mountRainfall(fig: HTMLElement) {
  const map = fig.querySelector<SVGSVGElement>('[data-nr-map]')!;
  const d: Payload = JSON.parse(map.dataset.payload!);
  const gs = [...fig.querySelectorAll<SVGCircleElement>('[data-nr-gauges] circle')];
  const ss = [...fig.querySelectorAll<SVGCircleElement>('[data-nr-sdots] circle')];
  const ghosts = fig.querySelector<SVGGElement>('[data-nr-ghosts]')!;
  const sghosts = fig.querySelector<SVGGElement>('[data-nr-sghosts]')!;
  const fills = [...fig.querySelectorAll<SVGPathElement>('[data-nr-dist] path')];
  const fill0 = fills.map((f) => Number(f.style.opacity));
  const means = [...fig.querySelectorAll<SVGLineElement>('[data-nr-mean]')];
  const gaps = [...fig.querySelectorAll<SVGLineElement>('[data-nr-gap]')];
  const callout = fig.querySelector<SVGGElement>('.nr-callout')!;
  const P = d.peak;
  const peakMean = d.means[P];

  const rainAt = (r: (number | null)[], f: number) => {
    const k = Math.min(Math.floor(f), P), t = f - k;
    const a = r[k] ?? 0, b = r[Math.min(k + 1, P)] ?? 0;
    return lerp(a, b, t);
  };
  const meanAt = (i: number, f: number) => {
    const k = Math.min(Math.floor(f), P), t = f - k;
    return lerp(d.means[k][i], d.means[Math.min(k + 1, P)][i], t);
  };

  function render(p: number) {
    const f = p < DAYS ? (p / DAYS) * P : P;
    const a = p <= AVG ? 0 : ease((p - AVG) / (1 - AVG));
    const top = new Array(d.districts.length).fill(0);
    d.gauges.forEach((g, j) => {
      const v = rainAt(g.rain, f);
      top[g.di] = Math.max(top[g.di], v);
      const c = d.districts[g.di];
      const x = lerp(g.x, c.cx, a), y = lerp(g.y, c.cy, a);
      const r = lerp(rOf(v), rOf(peakMean[g.di]), a);
      gs[j].setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${r.toFixed(2)})`);
      ss[j].setAttribute('transform', `translate(${lerp(g.sx, c.col, a).toFixed(1)} ${lerp(yOf(v), yOf(peakMean[g.di]), a).toFixed(1)})`);
    });
    d.districts.forEach((_, i) => {
      const m = yOf(meanAt(i, f)).toFixed(1);
      means[i].setAttribute('y1', m);
      means[i].setAttribute('y2', m);
      means[i].style.opacity = String(0.25 + 0.75 * a);
      gaps[i].setAttribute('y1', m);
      gaps[i].setAttribute('y2', yOf(top[i]).toFixed(1));
      gaps[i].style.opacity = String(a);
      fills[i].style.opacity = (fill0[i] * a).toFixed(3);
    });
    ghosts.style.opacity = String(a);
    sghosts.style.opacity = String(a);
    callout.style.opacity = String(p >= DAYS ? 1 : 0);
  }

  await mountScrub({
    fig,
    playSeconds: 10,
    start: 'top 70%',
    end: 'bottom 40%',
    clock: (p) => (p <= AVG ? d.labels[Math.min(P, Math.round(p < DAYS ? (p / DAYS) * P : P))] : `${d.labels[P]}, district mean`),
    render,
  });
}

import { mountScrub } from '../../lib/motion/scrub';

interface Section {
  name: string; qRef: number[]; qPred: number[]; nse: number; kge: number;
  peakErrPct: number; timeErrH: number; thresholds: Record<'watch' | 'warning' | 'danger', number>;
}
interface Data { leadHours: number; sections: Section[] }

const W = 640, x0 = 52, x1 = W - 16, top = 34, base = 252;

export async function mountSurrogate(fig: HTMLElement) {
  const data: Data = await (await fetch('/figures/hanumante-surrogate.json')).json();
  const secs = data.sections;
  const n = secs[0].qRef.length;
  const yMax = Math.ceil((Math.max(...secs.flatMap((s) => [...s.qRef, ...s.qPred, s.thresholds.danger])) * 1.04) / 20) * 20;
  const X = (t: number) => x0 + (t / (n - 1)) * (x1 - x0);
  const Y = (q: number) => base - (q / yMax) * (base - top);
  const path = (s: number[]) => 'M' + s.map((q, t) => `${X(t).toFixed(1)},${Y(q).toFixed(1)}`).join('L');
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);

  const ref = fig.querySelector<SVGPathElement>('[data-sg-ref]')!;
  const pred = fig.querySelector<SVGPathElement>('[data-sg-pred]')!;
  const clip = fig.querySelector<SVGRectElement>('[data-sg-clip]')!;
  const name = fig.querySelector<HTMLElement>('[data-sg-name]')!;
  const stats = fig.querySelector<HTMLElement>('[data-sg-stats]')!;
  const levels = [...fig.querySelectorAll<SVGGElement>('[data-level]')];
  const bars = [...fig.querySelectorAll<HTMLButtonElement>('[data-sec]')];

  function select(i: number) {
    const s = secs[i];
    ref.setAttribute('d', path(s.qRef));
    pred.setAttribute('d', path(s.qPred));
    levels.forEach((g) => {
      const key = g.dataset.level as keyof Section['thresholds'];
      g.setAttribute('transform', `translate(0 ${Y(s.thresholds[key]).toFixed(1)})`);
    });
    name.textContent = s.name;
    stats.textContent = `NSE ${s.nse.toFixed(3)} · KGE ${s.kge.toFixed(3)} · peak ${sign(s.peakErrPct)}% · timing ${sign(s.timeErrH)} h`;
    bars.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  }
  bars.forEach((b, i) => b.addEventListener('click', () => select(i)));

  await mountScrub({
    fig,
    playSeconds: 7,
    start: 'top 70%',
    end: 'bottom 45%',
    clock: (p) => `t = ${String(Math.round(p * (n - 1))).padStart(2, '0')} h`,
    render: (p) => { clip.style.transform = `scaleX(${p.toFixed(4)})`; },
  });
}

import { mountScrub, seg } from '../../lib/motion/scrub';

const RUN_MINUTES = 65; // illustrative: the real run takes over an hour

export function mountRace(fig: HTMLElement) {
  const cells = [...fig.querySelectorAll<SVGRectElement>('.race-cell')].map((el) => ({ el, at: Number(el.dataset.at), on: false }));
  const xs = [...fig.querySelectorAll<SVGGElement>('[data-xs]')];
  const xsDots = xs.map((g) => g.querySelector<SVGCircleElement>('.race-xs-dot')!);
  const physClock = fig.querySelector<HTMLElement>('[data-phys-clock]')!;
  const physBar = fig.querySelector<HTMLElement>('[data-phys-bar]')!;
  const surClock = fig.querySelector<HTMLElement>('[data-sur-clock]')!;
  const hclip = fig.querySelector<SVGRectElement>('[data-hclip]')!;
  let hits = 0;

  const fmt = (min: number) => {
    const s = Math.round(min * 60);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  mountScrub({
    fig,
    playSeconds: 10,
    start: 'top 75%',
    end: 'bottom 35%',
    clock: (p) => fmt(p * RUN_MINUTES),
    render: (p) => {
      // Physical model: cells appear as the solver reaches them.
      for (const c of cells) {
        const on = p >= c.at;
        if (on !== c.on) { c.el.style.opacity = on ? '1' : '0'; c.on = on; }
      }
      physClock.textContent = fmt(p * RUN_MINUTES);
      physBar.style.transform = `scaleX(${p.toFixed(4)})`;

      // Surrogate: all 21 sections answer in the first instant of the run.
      const n = Math.round(seg(p, 0, 0.012) * xs.length);
      if (n !== hits) {
        xs.forEach((g, i) => {
          const lit = i < n;
          xsDots[i].style.opacity = lit ? '1' : '0.25';
          if (lit && i >= hits) { g.classList.remove('is-hit'); void g.getBoundingClientRect(); g.classList.add('is-hit'); }
        });
        hits = n;
      }
      surClock.textContent = n === xs.length ? 'done in seconds' : n ? `${n} of 21` : 'waiting';

      hclip.style.transform = `scaleX(${p.toFixed(4)})`;
    },
  });
}

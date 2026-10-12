import { mountScrub } from '../../lib/motion/scrub';

interface Data { codes: string[]; service: string[]; routes: string[][]; t: number[]; T: number; peak: number }
const CLS: Record<string, string> = { f: 'iso-f', i: 'iso-i', r: 'iso-r', d: 'iso-d', o: 'iso-o' };

export async function mountIsolation(fig: HTMLElement) {
  const data: Data = await (await fetch('/figures/bagmati-isolation.json')).json();
  const hexes = [...fig.querySelectorAll<SVGPathElement>('[data-hexes] path')];
  const service = fig.querySelector<SVGPathElement>('[data-service]')!;
  const routes = [...fig.querySelectorAll<SVGPathElement>('[data-route]')];
  const cursor = fig.querySelector<SVGLineElement>('[data-cursor]')!;
  const x0 = 52, x1 = 640 - 16;
  const cursorBase = Number(cursor.getAttribute('x1'));
  const n = data.codes.length;
  let shown = -1;
  let current = data.codes[data.peak];

  function show(k: number) {
    if (k === shown) return;
    const next = data.codes[k];
    for (let i = 0; i < hexes.length; i++) {
      if (next[i] !== current[i]) hexes[i].setAttribute('class', CLS[next[i]]);
    }
    current = next;
    service.setAttribute('d', data.service[k]);
    routes.forEach((r, j) => r.setAttribute('d', data.routes[k][j] || 'M0,0'));
    shown = k;
  }

  mountScrub({
    fig,
    playSeconds: 9,
    restP: data.peak / (n - 1),
    start: 'top 70%',
    end: 'bottom 40%',
    clock: (p) => {
      const k = Math.round(p * (n - 1));
      return k === data.peak ? 'peak' : k < data.peak ? 'rising' : 'falling';
    },
    render: (p) => {
      show(Math.round(p * (n - 1)));
      const x = x0 + (p * data.t[n - 1] / data.T) * (x1 - x0);
      cursor.style.transform = `translateX(${(x - cursorBase).toFixed(1)}px)`;
    },
  });
}

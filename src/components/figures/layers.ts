import { mountScrub, seg } from '../../lib/motion/scrub';

interface Data { n: number; layers: string[]; ramp: number[][]; pngs: string[] }
const GAP = 46; // px between layers when exploded

export async function mountLayers(fig: HTMLElement) {
  // Layer images and values live in a static JSON file so the page HTML stays small.
  const data: Data = await (await fetch('/figures/floodhub-layers.json')).json();
  fig.querySelectorAll<HTMLImageElement>('[data-ly-layer]').forEach((img, i) => { img.src = data.pngs[i]; });
  const crit = data.layers.map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const canvas = fig.querySelector<HTMLCanvasElement>('[data-ly-canvas]')!;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(data.n, data.n);
  const stack = fig.querySelector<HTMLElement>('[data-ly-stack]')!;
  const layerEls = [...fig.querySelectorAll<HTMLElement>('[data-ly-layer]')];
  const labels = [...fig.querySelectorAll<HTMLElement>('[data-ly-label]')];
  const inputs = [...fig.querySelectorAll<HTMLInputElement>('[data-ly-w]')];
  const outs = [...fig.querySelectorAll<HTMLOutputElement>('[data-ly-wout]')];

  function recompute() {
    const w = inputs.map((i) => Number(i.value));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    outs.forEach((o, i) => { o.value = `${Math.round((w[i] / sum) * 100)}%`; });
    const cells = data.n * data.n;
    const risk = new Float32Array(cells);
    let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < cells; c++) {
      let v = 0;
      for (let k = 0; k < crit.length; k++) v += w[k] * crit[k][c];
      v /= sum * 255;
      risk[c] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = hi - lo || 1;
    for (let c = 0; c < cells; c++) {
      const [r, g, b] = data.ramp[Math.round(((risk[c] - lo) / span) * 255)];
      img.data[c * 4] = r; img.data[c * 4 + 1] = g; img.data[c * 4 + 2] = b; img.data[c * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  let raf = 0;
  inputs.forEach((i) => i.addEventListener('input', () => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; recompute(); });
  }));
  recompute();

  mountScrub({
    fig,
    playSeconds: 5,
    start: 'top 70%',
    end: 'center 40%',
    clock: (p) => (p < 0.98 ? 'layers' : 'combined'),
    render: (p) => {
      const collapse = seg(p, 0.1, 0.8);
      stack.style.setProperty('--gap', `${(GAP * (1 - collapse)).toFixed(1)}px`);
      const fade = seg(p, 0.65, 0.95);
      layerEls.forEach((el) => { el.style.opacity = String(1 - fade); });
      labels.forEach((el) => { el.style.opacity = String(1 - 0.6 * fade); });
      fig.style.setProperty('--risk-o', String(fade));
    },
  });
}

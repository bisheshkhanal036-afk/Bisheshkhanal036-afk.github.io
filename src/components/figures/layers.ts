/**
 * Runtime for Fig. 6: FloodHUB's eight steps on one map stage.
 * Progress p (0..1) maps to step = floor(p * 8); within a step, local progress drives the
 * transition (transform/opacity only; canvas redraws for the live risk surface).
 */
import { mountScrub, seg } from '../../lib/motion/scrub';

interface Data { w: number; h: number; weights: number[]; layers: string[]; ramp: number[][]; pngs: string[] }
const N = 8;
const GAP = 18; // px between fanned-out layers

export async function mountLayers(fig: HTMLElement) {
  const data: Data = await (await fetch('/figures/floodhub-layers.json')).json();
  const $ = <T extends Element>(s: string) => fig.querySelector<T>(s)!;
  const $$ = <T extends Element>(s: string) => [...fig.querySelectorAll<T>(s)];

  const layerEls = $$<HTMLImageElement>('[data-ly-layer]');
  layerEls.forEach((img, i) => { img.src = data.pngs[i]; });
  const crit = data.layers.map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const canvas = $<HTMLCanvasElement>('[data-ly-canvas]');
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(data.w, data.h);
  const stack = $<HTMLElement>('[data-ly-stack]');
  const mask = $<HTMLElement>('[data-ly-mask]');
  const risk = $<HTMLElement>('[data-ly-risk]');
  const hazard = $<HTMLElement>('[data-ly-hazard]');
  const expo = $<HTMLElement>('[data-ly-expo]');
  const key = $<HTMLElement>('[data-ly-key]');
  const expoKey = $<HTMLElement>('[data-ly-expokey]');
  const panels = $$<HTMLElement>('[data-ly-panel]');
  const rail = $$<HTMLButtonElement>('[data-ly-go]');
  const inputs = $$<HTMLInputElement>('[data-ly-w]');
  const outs = $$<HTMLOutputElement>('[data-ly-wout]');
  const cells = data.w * data.h;

  // FloodHUB: R_norm = (sum(w_i * class_i) - 1) / 4, weights normalised to sum to 1.
  function recompute() {
    const w = inputs.map((i) => Number(i.value));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    outs.forEach((o, i) => { o.value = `${((w[i] / sum) * 100).toFixed(1)}%`; });
    const r = new Float32Array(cells);
    let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < cells; c++) {
      if (crit[0][c] === 0) { r[c] = NaN; continue; }
      let v = 0;
      for (let k = 0; k < crit.length; k++) v += (w[k] / sum) * (1 + (4 * (crit[k][c] - 1)) / 254);
      r[c] = (v - 1) / 4;
      if (r[c] < lo) lo = r[c];
      if (r[c] > hi) hi = r[c];
    }
    const span = hi - lo || 1;
    for (let c = 0; c < cells; c++) {
      if (Number.isNaN(r[c])) { img.data[c * 4 + 3] = 0; continue; }
      const [R, G, B] = data.ramp[Math.round(((r[c] - lo) / span) * 255)];
      img.data[c * 4] = R; img.data[c * 4 + 1] = G; img.data[c * 4 + 2] = B; img.data[c * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  let raf = 0;
  inputs.forEach((i) => i.addEventListener('input', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; recompute(); }); }));
  $<HTMLButtonElement>('[data-ly-reset]').addEventListener('click', () => {
    inputs.forEach((i, k) => { i.value = String(Math.round(data.weights[k] * 1000)); });
    recompute();
  });
  recompute();

  const op = (el: HTMLElement, v: number) => { el.style.opacity = v.toFixed(3); };
  let shown = -1;

  function render(p: number) {
    const step = Math.min(N - 1, Math.floor(p * N));
    const t = p * N - step; // local progress within the step

    if (step !== shown) {
      panels.forEach((el, i) => el.classList.toggle('is-on', i === step));
      rail.forEach((b, i) => {
        b.classList.toggle('is-done', i < step);
        if (i === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      shown = step;
    }

    // Tilt: flat at step 1, tilted for the stack (2-4), flat again from step 5.
    const tilt = step === 0 ? seg(t, 0.5, 1) : step <= 3 ? 1 : step === 4 ? 1 - seg(t, 0, 0.5) : 0;
    stack.style.setProperty('--rx', `${(56 * tilt).toFixed(2)}deg`);
    stack.style.setProperty('--rz', `${(-38 * tilt).toFixed(2)}deg`);

    // Layers fan out at step 2, hold through 3, collapse during 4.
    const fan = step === 1 ? seg(t, 0, 0.7) : step === 2 ? 1 : step === 3 ? 1 - seg(t, 0, 0.6) : 0;
    stack.style.setProperty('--gap', `${(GAP * fan).toFixed(1)}px`);
    const layersOn = step === 1 ? seg(t, 0, 0.4) : step === 2 ? 1 : step === 3 ? 1 - seg(t, 0.5, 0.9) : 0;
    layerEls.forEach((el, i) => op(el, step === 1 ? seg(t, i * 0.04, 0.3 + i * 0.04) : layersOn));
    op(mask, step <= 1 ? 1 : 1 - layersOn);

    // Live risk surface appears as the stack collapses; hazard classes replace it at step 5.
    const riskOn = step === 3 ? seg(t, 0.4, 0.9) : step === 4 ? 1 - seg(t, 0.3, 0.8) : 0;
    op(canvas, riskOn);
    op(risk, 0);
    const hazOn = step === 4 ? seg(t, 0.3, 0.8) : step >= 5 ? (step === 7 ? 1 - seg(t, 0, 0.5) : 1) : 0;
    op(hazard, hazOn);
    op(key, hazOn);
    const expoOn = step === 7 ? seg(t, 0, 0.5) : 0;
    op(expo, expoOn);
    op(expoKey, expoOn);
  }

  const desktop = matchMedia('(min-width: 1024px)').matches;
  const pin = $<HTMLElement>('[data-ly-pin]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (desktop && !reduce) pin.classList.add('is-pinned');

  const { goTo } = await mountScrub({
    fig,
    render,
    playSeconds: 16,
    restP: (N - 0.5) / N,
    scroll: desktop,
    trigger: pin,
    start: 'top top',
    end: 'bottom bottom',
    clock: (p) => `step ${Math.min(N, Math.floor(p * N) + 1)} of ${N}`,
  });
  rail.forEach((b, i) => b.addEventListener('click', () => goTo((i + 0.55) / N)));
}

/**
 * Runtime for Fig. 6: FloodHUB's eight steps on one map stage.
 * Progress p (0..1) maps to step = floor(p * 8) and local progress t within the step.
 * Every visual is a pure function of (step, t), so scrubbing backwards is exact.
 * Animates transform and opacity; canvases redraw only for the live risk surface and
 * the METEOR spread; SVG strokes draw via dash offset.
 */
import { mountScrub, seg } from '../../lib/motion/scrub';

interface Data { w: number; h: number; weights: number[]; layers: string[]; meteor: string; ramp: number[][]; pngs: string[] }
const N = 8;
const ease = (x: number) => 1 - (1 - x) ** 3; // out-cubic
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export async function mountLayers(fig: HTMLElement) {
  const data: Data = await (await fetch('/figures/floodhub-layers.json')).json();
  const $ = <T extends Element>(s: string) => fig.querySelector<T>(s)!;
  const $$ = <T extends Element>(s: string) => [...fig.querySelectorAll<T>(s)];
  const dec = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // Elements
  const layerEls = $$<HTMLImageElement>('[data-ly-layer]');
  layerEls.forEach((img, i) => { img.src = data.pngs[i]; });
  const L = layerEls.length;
  const stack = $<HTMLElement>('[data-ly-stack]');
  const riskCanvas = $<HTMLCanvasElement>('[data-ly-canvas]');
  const hazardAll = $<HTMLElement>('[data-ly-hazard-all]');
  const classEls = $$<HTMLElement>('[data-ly-class]');
  const meteorCanvas = $<HTMLCanvasElement>('[data-ly-meteor]');
  const expo = $<HTMLElement>('[data-ly-expo]');
  const outline = $<SVGPathElement>('[data-ly-outline]');
  const fill = $<SVGPathElement>('[data-ly-fill-basin]');
  const scan = $<SVGLineElement>('[data-ly-scan]');
  const pts = $$<SVGGElement>('[data-ly-bipad] .ly-pt');
  const deal = $<HTMLElement>('[data-ly-deal]');
  const keyHaz = $<HTMLElement>('[data-ly-key]');
  const keyBipad = $<HTMLElement>('[data-ly-key-bipad]');
  const keyMeteor = $<HTMLElement>('[data-ly-key-meteor]');
  const keyExpo = $<HTMLElement>('[data-ly-expokey]');
  const keyRisk = $<HTMLElement>('[data-ly-riskkey]');
  const panels = $$<HTMLElement>('[data-ly-panel]');
  const rail = $$<HTMLButtonElement>('[data-ly-go]');
  const railFill = $$<HTMLElement>('[data-ly-fill]');
  const critItems = $$<HTMLElement>('[data-ly-crit]');
  const dealt = $<HTMLElement>('[data-ly-dealt]');
  const wbars = $$<HTMLElement>('[data-ly-wbar]');
  const mbars = $$<HTMLElement>('[data-ly-mbar]');
  const frows = $$<HTMLElement>('[data-ly-frow]');
  const curves = panels.map((p) => [...p.querySelectorAll<SVGPathElement>('.fc-line')]);
  const counters = panels.map((p) => [...p.querySelectorAll<HTMLElement>('[data-count]')].map((el) => ({
    el, v: Number(el.dataset.count), fmt: el.dataset.fmt,
  })));
  const labels = $$<HTMLElement>('[data-ly-label] .ly-wname').map((e) => e.textContent ?? '');
  const inputs = $$<HTMLInputElement>('[data-ly-w]');
  const outs = $$<HTMLOutputElement>('[data-ly-wout]');

  // Live risk surface (FloodHUB: R = (sum(w_i * class_i) - 1) / 4, weights normalised)
  const crit = data.layers.map(dec);
  const cells = data.w * data.h;
  const rctx = riskCanvas.getContext('2d')!;
  const rimg = rctx.createImageData(data.w, data.h);
  let weights = [...data.weights];
  function recompute() {
    const w = inputs.map((i) => Number(i.value));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    weights = w.map((v) => v / sum);
    outs.forEach((o, i) => { o.value = `${(weights[i] * 100).toFixed(1)}%`; });
    const wmax = Math.max(...weights) || 1;
    wbars.forEach((b, i) => { b.style.width = `${((weights[i] / wmax) * 100).toFixed(1)}%`; });
    const r = new Float32Array(cells);
    let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < cells; c++) {
      if (crit[0][c] === 0) { r[c] = NaN; continue; }
      let v = 0;
      for (let k = 0; k < crit.length; k++) v += weights[k] * (1 + (4 * (crit[k][c] - 1)) / 254);
      r[c] = (v - 1) / 4;
      if (r[c] < lo) lo = r[c];
      if (r[c] > hi) hi = r[c];
    }
    const span = hi - lo || 1;
    for (let c = 0; c < cells; c++) {
      if (Number.isNaN(r[c])) { rimg.data[c * 4 + 3] = 0; continue; }
      const [R, G, B] = data.ramp[Math.round(((r[c] - lo) / span) * 255)];
      rimg.data[c * 4] = R; rimg.data[c * 4 + 1] = G; rimg.data[c * 4 + 2] = B; rimg.data[c * 4 + 3] = 255;
    }
    rctx.putImageData(rimg, 0, 0);
  }
  let raf = 0;
  inputs.forEach((i) => i.addEventListener('input', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; recompute(); render(state.p); }); }));
  $<HTMLButtonElement>('[data-ly-reset]').addEventListener('click', () => {
    inputs.forEach((i, k) => { i.value = String(Math.round(data.weights[k] * 1000)); });
    recompute();
    render(state.p);
  });
  recompute();

  // METEOR flooded share, revealed by a falling threshold (deepest-flooded cells first)
  const met = dec(data.meteor);
  const mctx = meteorCanvas.getContext('2d')!;
  const mimg = mctx.createImageData(data.w, data.h);
  let lastThr = -1;
  function drawMeteor(thr: number) {
    const q = Math.round(thr * 50);
    if (q === lastThr) return;
    lastThr = q;
    const cut = (q / 50) * 255;
    for (let c = 0; c < cells; c++) {
      const on = met[c] > 0 && met[c] >= cut;
      mimg.data[c * 4] = 47; mimg.data[c * 4 + 1] = 89; mimg.data[c * 4 + 2] = 102;
      mimg.data[c * 4 + 3] = on ? 70 + Math.round((met[c] / 255) * 150) : 0;
    }
    mctx.putImageData(mimg, 0, 0);
  }

  // Stack geometry
  const EVEN = 16; // px between layers when dealt
  const ZW = 230;  // px spread for the full weight sum in step 3
  const evenZ = (i: number) => (L - 1 - i) * EVEN;
  const weightZ = (i: number) => weights.slice(i + 1).reduce((a, b) => a + b, 0) * ZW;
  const wmax = () => Math.max(...weights) || 1;

  const op = (el: Element, v: number) => { (el as HTMLElement).style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); };
  const fmt = (v: number, f?: string) => (f === '2' ? v.toFixed(2) : Math.round(v).toLocaleString('en-GB'));
  const state = { p: 0 };
  let shown = -1;

  function render(p: number) {
    state.p = p;
    const step = Math.min(N - 1, Math.floor(p * N));
    const t = Math.min(1, p * N - step);
    const at = (k: number) => (step > k ? 1 : step < k ? 0 : t); // progress of step k

    // Rail, panels
    railFill.forEach((f, i) => { f.style.transform = `scaleX(${at(i).toFixed(3)})`; });
    if (step !== shown) {
      panels.forEach((el, i) => el.classList.toggle('is-on', i === step));
      rail.forEach((b, i) => (i === step ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
      shown = step;
    }
    counters.forEach((list, k) => {
      if (k !== step) return;
      const e = ease(seg(t, 0.05, k === 4 ? 0.9 : 0.7));
      list.forEach((c) => { c.el.textContent = fmt(c.v * e, c.fmt); });
    });

    // 1 Area: outline draws, then the basin fills
    const s0 = at(0);
    outline.style.strokeDashoffset = (1 - ease(seg(s0, 0, 0.65))).toFixed(4);
    op(outline, step <= 0 ? 1 : step <= 3 ? 0.5 : 0.8);
    // The base fill sits above the canvases in the stack; clear it as the risk surface develops.
    op(fill, step === 0 ? seg(t, 0.55, 0.95) : step <= 2 ? 1 : step === 3 ? 1 - seg(t, 0.3, 0.42) : 0);

    // Tilt: up during step 2, flat again during step 5
    const tilt = ease(seg(at(1), 0, 0.25)) * (1 - ease(seg(at(4), 0, 0.35)));
    stack.style.setProperty('--rx', `${(55 * tilt).toFixed(2)}deg`);
    stack.style.setProperty('--rz', `${(-40 * tilt).toFixed(2)}deg`);

    // 2 Criteria: deal layers one by one from above. 3 Weighting: gaps by weight.
    // 4 Compute: drop together and fade into the risk surface.
    const s1 = at(1), s2 = at(2), s3 = at(3);
    const spread = ease(seg(s2, 0, 0.6));
    const drop = ease(seg(s3, 0, 0.45));
    let latest = -1;
    layerEls.forEach((el, i) => {
      const t0 = 0.18 + (i / L) * 0.62;
      const land = ease(seg(s1, t0, t0 + 0.08));
      if (s1 >= t0) latest = i;
      const z = lerp(evenZ(i), weightZ(i), spread) * (1 - drop) + (1 - land) * 90;
      el.style.setProperty('--z', `${z.toFixed(1)}px`);
      const weightOp = lerp(1, 0.25 + 0.75 * (weights[i] / wmax()), spread);
      op(el, land * weightOp * (1 - seg(s3, 0.45, 0.7)));
    });
    if (step === 1) {
      deal.textContent = latest >= 0 ? `+ ${labels[latest]}` : '';
      dealt.textContent = String(latest + 1);
      critItems.forEach((c, i) => c.classList.toggle('is-now', i === latest));
    } else {
      deal.textContent = step === 2 ? 'Gap above each layer ∝ its weight' : step === 3 ? 'Σ wᵢ · classᵢ' : '';
      dealt.textContent = '11';
      critItems.forEach((c) => c.classList.remove('is-now'));
    }
    wbars.forEach((b, i) => { b.style.transform = `scaleX(${ease(seg(s2, 0.05 + i * 0.03, 0.4 + i * 0.03)).toFixed(3)})`; });

    // Risk surface develops under a scan line
    const dev = seg(s3, 0.4, 0.92);
    riskCanvas.style.clipPath = `inset(0 0 ${((1 - dev) * 100).toFixed(2)}% 0)`;
    const s4 = at(4);
    op(riskCanvas, (step >= 3 ? 1 : 0) * (1 - seg(s4, 0.35, 0.6)));
    scan.setAttribute('transform', `translate(0 ${(dev * data.h).toFixed(2)})`);
    op(scan, step === 3 && dev > 0 && dev < 1 ? 1 : 0);
    op(keyRisk, step === 3 ? seg(t, 0.5, 0.8) : 0);

    // 5 Report: hazard classes appear one after another, lowest first
    op(hazardAll, 0);
    const classDim = step === 5 ? lerp(1, 0.55, ease(seg(t, 0, 0.3))) : step === 6 ? 0.85 : 1;
    const classOut = 1 - ease(seg(at(7), 0, 0.4));
    classEls.forEach((el, j) => {
      const a = 0.3 + j * 0.11;
      op(el, ease(seg(s4, a, a + 0.12)) * classDim * classOut);
    });
    op(keyHaz, step >= 4 && step <= 6 ? ease(seg(s4, 0.35, 0.6)) : 0);

    // 6 Validate: incident cells pop in, curve draws
    const s5 = at(5);
    pts.forEach((g, j) => {
      const a = 0.08 + (j / pts.length) * 0.55;
      const k = seg(s5, a, a + 0.08);
      op(g, step === 5 || step === 6 ? (step === 6 ? 0.35 : ease(k)) : 0);
      const ring = g.firstElementChild as SVGElement;
      ring.style.transform = `scale(${(1 + (1 - k) * 1.4).toFixed(3)})`;
      ring.style.transformBox = 'fill-box';
      ring.style.transformOrigin = 'center';
    });
    op(keyBipad, step === 5 ? 1 : 0);
    curves[5]?.forEach((c) => { c.style.strokeDashoffset = (1 - ease(seg(s5, 0.25, 0.9))).toFixed(4); });

    // 7 METEOR: flooded area spreads from the deepest-flooded cells; bars grow
    const s6 = at(6);
    if (step === 6) drawMeteor(1 - ease(seg(t, 0.05, 0.7)));
    op(meteorCanvas, step === 6 ? 1 : 0);
    op(keyMeteor, step === 6 ? 1 : 0);
    mbars.forEach((b, i) => { b.style.transform = `scaleX(${ease(seg(s6, 0.1 + i * 0.1, 0.4 + i * 0.1)).toFixed(3)})`; });
    curves[6]?.forEach((c) => { c.style.strokeDashoffset = (1 - ease(seg(s6, 0.35, 0.95))).toFixed(4); });

    // 8 Shelters: exposure grid; funnel narrows row by row
    const s7 = at(7);
    op(expo, ease(seg(s7, 0, 0.4)));
    op(keyExpo, step === 7 ? ease(seg(t, 0.2, 0.5)) : 0);
    frows.forEach((r, i) => {
      const a = 0.12 + i * 0.15;
      const k = ease(seg(s7, a, a + 0.15));
      op(r, step === 7 ? 0.25 + 0.75 * k : 1);
      const bar = r.querySelector<HTMLElement>('.ly-fbar span')!;
      bar.style.transform = `scaleX(${k.toFixed(3)})`;
      const v = r.querySelector<HTMLElement>('[data-count]')!;
      if (step === 7) v.textContent = fmt(Number(v.dataset.count) * k);
    });
  }

  // Wiring: desktop pins and scrubs with scroll; elsewhere play, scrubber and step buttons.
  const desktop = matchMedia('(min-width: 1024px)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pin = $<HTMLElement>('[data-ly-pin]');
  if (desktop && !reduce) pin.classList.add('is-pinned');
  fig.classList.add('is-js');

  const { set, goTo, gsap } = await mountScrub({
    fig,
    render,
    playSeconds: 34,
    restP: 0.999,
    scroll: desktop,
    trigger: pin,
    start: 'top top',
    end: 'bottom bottom',
    clock: (p) => `step ${Math.min(N, Math.floor(p * N) + 1)} of ${N}`,
  });

  let tween: gsap.core.Tween | null = null;
  rail.forEach((b, i) => b.addEventListener('click', () => {
    if (desktop && !reduce) return goTo((i + 0.9) / N);
    tween?.kill();
    if (reduce) return set((i + 0.999) / N);
    const s = { p: i / N };
    tween = gsap.to(s, { p: (i + 0.999) / N, duration: 3.2, ease: 'none', onUpdate: () => set(s.p) });
  }));
}

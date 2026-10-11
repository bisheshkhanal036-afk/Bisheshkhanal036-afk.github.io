/**
 * Runtime for Fig. 1. Reveals the build-time final frame over a simulation clock.
 * Animates transform and opacity only. GSAP is loaded on demand (code-split).
 *
 * Clock sources, last input wins: page scroll (ScrollTrigger scrub), the range input,
 * and the play button. Under prefers-reduced-motion there is no scroll linkage and the
 * figure stays on its final frame until the reader scrubs.
 */
import { onTeardown } from '../../lib/motion/lifecycle';

declare global {
  interface Window { __figuresReady?: boolean }
}

const DESKTOP = '(min-width: 1024px)';
const MOBILE = '(max-width: 1023px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

export async function mountRainRiver(fig: HTMLElement) {
  const svg = fig.querySelector<SVGSVGElement>('[data-rr]')!;
  const T = Number(svg.dataset.total);
  const dt = Number(svg.dataset.dt);
  const bars = [...svg.querySelectorAll<SVGGElement>('[data-bar]')].map((el) => ({ el, t: Number(el.dataset.t) }));
  const clip = svg.querySelector<SVGRectElement>('[data-clip]')!;
  const annots = [...svg.querySelectorAll<SVGGElement>('[data-at]')].map((el) => ({ el, t: Number(el.dataset.at) }));
  const cursor = svg.querySelector<SVGLineElement>('[data-cursor]')!;
  const plotW = Number(clip.getAttribute('width'));

  const controls = fig.querySelector<HTMLElement>('[data-controls]')!;
  const playBtn = fig.querySelector<HTMLButtonElement>('[data-play]')!;
  const playLabel = fig.querySelector<HTMLElement>('[data-play-label]')!;
  const scrub = fig.querySelector<HTMLInputElement>('[data-scrub]')!;
  const clockOut = fig.querySelector<HTMLOutputElement>('[data-clock-out]')!;
  const scroller = fig.closest<HTMLElement>('[data-hero-scroll]');

  const state = { clock: T };
  const FALL = 1.0; // hours of simulation clock for one bar to land

  function render() {
    const t = state.clock;
    for (const b of bars) {
      const k = Math.min(1, Math.max(0, (t - b.t) / FALL));
      // Bars grow down from the top axis as the rain step falls.
      b.el.style.opacity = k > 0 ? '1' : '0';
      b.el.style.transform = `scaleY(${k.toFixed(3)})`;
    }
    clip.style.transform = `scaleX(${(t / T).toFixed(4)})`;
    for (const a of annots) a.el.style.opacity = t >= a.t ? '1' : '0';
    cursor.style.transform = `translateX(${((t / T) * plotW).toFixed(1)}px)`;
    clockOut.value = `t = ${t.toFixed(1).padStart(4, '0')} h`;
    scrub.value = String(Math.round((t / T) * 1000));
  }

  function setClock(t: number) {
    state.clock = Math.min(T, Math.max(0, t));
    render();
  }

  // Controls exist only once this script runs.
  controls.hidden = false;
  svg.classList.add('is-live');
  window.__figuresReady = true;

  const reduce = matchMedia(REDUCE).matches;
  if (reduce) {
    setClock(T);
  }

  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);

  let tween: gsap.core.Tween | null = null;
  const stopPlay = () => {
    tween?.kill();
    tween = null;
    playBtn.setAttribute('aria-pressed', 'false');
    playLabel.textContent = 'Play';
  };

  playBtn.addEventListener('click', () => {
    if (tween) return stopPlay();
    const from = state.clock >= T - dt ? 0 : state.clock;
    playBtn.setAttribute('aria-pressed', 'true');
    playLabel.textContent = 'Pause';
    tween = gsap.fromTo(state, { clock: from }, {
      clock: T,
      duration: ((T - from) / T) * 7,
      ease: 'none',
      onUpdate: render,
      onComplete: stopPlay,
    });
  });

  scrub.addEventListener('input', () => {
    stopPlay();
    setClock((Number(scrub.value) / 1000) * T);
  });

  const mm = gsap.matchMedia();
  // The callback runs when any condition matches, so every viewport must match one.
  mm.add({ desktop: DESKTOP, mobile: MOBILE, reduce: REDUCE }, (ctx) => {
    const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
    if (reduce) return;
    setClock(0);
    const st = desktop && scroller
      ? (scroller.classList.add('is-scrub'),
        ScrollTrigger.create({ trigger: scroller, start: 'top top', end: 'bottom bottom', scrub: 0.4,
          onUpdate: (self) => { stopPlay(); setClock(self.progress * T); } }))
      : ScrollTrigger.create({ trigger: svg, start: 'clamp(top 85%)', end: 'clamp(bottom 35%)', scrub: 0.4,
          onUpdate: (self) => { stopPlay(); setClock(self.progress * T); } });
    return () => {
      st.kill();
      scroller?.classList.remove('is-scrub');
    };
  });

  // Layout shifts once web fonts arrive; recompute trigger positions.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  // Pause playback when off-screen.
  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) stopPlay(); });
  io.observe(fig);

  onTeardown(() => {
    stopPlay();
    mm.revert();
    io.disconnect();
  });
}

/**
 * Shared runtime for scroll-scrubbed figures inside FigureShell.
 * Wires: play/pause, range scrubber, clock readout, ScrollTrigger scrub, reduced motion
 * (final frame, no scroll link), off-screen pause and page-change teardown.
 * `render(p)` receives progress 0..1 and must only touch transform/opacity (or swap
 * classes at discrete steps).
 */
import { onTeardown } from './lifecycle';

declare global {
  interface Window { __figuresReady?: boolean }
}

export interface ScrubOptions {
  fig: HTMLElement;
  render: (p: number) => void;
  clock?: (p: number) => string;
  /** Seconds for a full play-through. */
  playSeconds?: number;
  /** ScrollTrigger start/end relative to the figure. */
  start?: string;
  end?: string;
  /** Element whose position drives the scrub; defaults to the figure graphic. */
  trigger?: Element;
  /** Frame shown under reduced motion (and by the build-time fallback). Default 1. */
  restP?: number;
}

export async function mountScrub(o: ScrubOptions) {
  const { fig, render } = o;
  const controls = fig.querySelector<HTMLElement>('[data-controls]')!;
  const playBtn = fig.querySelector<HTMLButtonElement>('[data-play]')!;
  const playLabel = fig.querySelector<HTMLElement>('[data-play-label]')!;
  const scrub = fig.querySelector<HTMLInputElement>('[data-scrub]')!;
  const out = fig.querySelector<HTMLOutputElement>('[data-clock-out]')!;
  const state = { p: 1 };

  const draw = () => {
    render(state.p);
    if (o.clock) out.value = o.clock(state.p);
    scrub.value = String(Math.round(state.p * 1000));
  };
  const set = (p: number) => { state.p = Math.min(1, Math.max(0, p)); draw(); };

  controls.hidden = false;
  fig.classList.add('is-live');
  window.__figuresReady = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  set(reduce ? (o.restP ?? 1) : 0);

  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);

  let tween: gsap.core.Tween | null = null;
  const stop = () => {
    tween?.kill();
    tween = null;
    playBtn.setAttribute('aria-pressed', 'false');
    playLabel.textContent = 'Play';
  };
  playBtn.addEventListener('click', () => {
    if (tween) return stop();
    const from = state.p >= 0.995 ? 0 : state.p;
    playBtn.setAttribute('aria-pressed', 'true');
    playLabel.textContent = 'Pause';
    tween = gsap.fromTo(state, { p: from }, {
      p: 1,
      duration: (1 - from) * (o.playSeconds ?? 8),
      ease: 'none',
      onUpdate: draw,
      onComplete: stop,
    });
  });
  scrub.addEventListener('input', () => { stop(); set(Number(scrub.value) / 1000); });

  let st: ScrollTrigger | null = null;
  if (!reduce) {
    st = ScrollTrigger.create({
      trigger: o.trigger ?? fig.querySelector('.fig-graphic') ?? fig,
      // clamp(): a figure already on screen at load starts at frame 0, not part-way.
      start: `clamp(${o.start ?? 'top 80%'})`,
      end: `clamp(${o.end ?? 'bottom 30%'})`,
      scrub: 0.4,
      onUpdate: (self) => { stop(); set(self.progress); },
    });
  }
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) stop(); });
  io.observe(fig);

  onTeardown(() => { stop(); st?.kill(); io.disconnect(); });
  return { set, gsap };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Local progress of p within [a, b]. */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

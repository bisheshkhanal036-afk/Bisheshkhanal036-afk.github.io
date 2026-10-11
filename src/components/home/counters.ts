/**
 * Count-up for [data-countup] numbers on the home page. The final value is already in the
 * HTML; when a number scrolls into view it animates from 0 once. Skipped under reduced motion.
 */
export function mountCounters(root: ParentNode = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const els = [...root.querySelectorAll<HTMLElement>('[data-countup]')].filter((el) => el.getBoundingClientRect().top > innerHeight);
  const fmt = (v: number) => Math.round(v).toLocaleString('en-GB');
  els.forEach((el) => { el.textContent = '0'; });
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      const target = Number(el.dataset.countup);
      const t0 = performance.now();
      const dur = 1400;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(target * (1 - (1 - k) ** 4));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

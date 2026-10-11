/**
 * Teardown registry for client-side navigation. Figures register cleanup (kill
 * ScrollTriggers, cancel rAF loops, revert SplitText); all of it runs before the
 * next page is swapped in.
 */
const tasks = new Set<() => void>();

export function onTeardown(fn: () => void) {
  tasks.add(fn);
}

document.addEventListener('astro:before-swap', () => {
  for (const fn of tasks) {
    try { fn(); } catch (err) { console.warn('teardown failed', err); }
  }
  tasks.clear();
});

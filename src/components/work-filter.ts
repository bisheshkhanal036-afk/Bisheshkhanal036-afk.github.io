/**
 * Work index filter. Choosing an interest moves matching projects to the top and hides
 * the rest, animated with GSAP Flip. The choice is kept in ?interest= so the Research
 * page can link straight to a filtered view. Without JS, every project is listed.
 */
import { onTeardown } from '../lib/motion/lifecycle';

export async function mountWorkFilter(list: HTMLElement) {
  const bar = document.querySelector<HTMLElement>('[data-filters]');
  if (!bar) return;
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const status = bar.querySelector<HTMLElement>('[data-filter-status]')!;
  const rows = [...list.querySelectorAll<HTMLElement>('[data-project]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { gsap } = await import('gsap');
  const { Flip } = await import('gsap/Flip');
  gsap.registerPlugin(Flip);

  let flip: gsap.core.Timeline | null = null;

  function apply(id: string, animate: boolean) {
    const state = animate ? Flip.getState(rows) : null;
    const match = (r: HTMLElement) => !id || (r.dataset.interests ?? '').split(' ').includes(id);
    // Matching rows first, original order kept within each group.
    [...rows.filter(match), ...rows.filter((r) => !match(r))].forEach((r) => list.append(r));
    rows.forEach((r) => { r.hidden = !match(r); });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === id)));

    const shown = rows.filter(match).length;
    const label = buttons.find((b) => b.dataset.filter === id)?.textContent?.trim();
    status.textContent = id ? `${shown} of ${rows.length} projects: ${label}` : '';

    if (state) {
      flip?.kill();
      flip = Flip.from(state, {
        duration: 0.45,
        ease: 'power2.inOut',
        absolute: true,
        simple: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.15 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.2 }),
      });
    }
  }

  const fromUrl = new URLSearchParams(location.search).get('interest') ?? '';
  if (buttons.some((b) => b.dataset.filter === fromUrl)) apply(fromUrl, false);

  const onClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!b) return;
    const id = b.dataset.filter ?? '';
    apply(id, !reduce);
    const url = new URL(location.href);
    if (id) url.searchParams.set('interest', id); else url.searchParams.delete('interest');
    history.replaceState(history.state, '', url);
  };
  bar.addEventListener('click', onClick);

  onTeardown(() => {
    flip?.kill();
    bar.removeEventListener('click', onClick);
  });
}

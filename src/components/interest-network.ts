/**
 * Interest-to-project network on the Research page. Nodes are ordinary buttons and links
 * laid out in two columns; this script draws the connecting curves (decorative SVG) and
 * highlights an interest's projects on hover, focus or press. A project highlights its
 * interests the same way. Curves are drawn only when the columns sit side by side.
 */
import { onTeardown } from '../lib/motion/lifecycle';

const SVG = 'http://www.w3.org/2000/svg';

export function mountNetwork(net: HTMLElement) {
  const svg = net.querySelector<SVGSVGElement>('[data-edges]')!;
  const iNodes = [...net.querySelectorAll<HTMLButtonElement>('[data-interest]')];
  const pNodes = [...net.querySelectorAll<HTMLAnchorElement>('[data-project]')];
  const edges: { i: string; p: string; path: SVGPathElement }[] = [];

  for (const p of pNodes) {
    for (const i of (p.dataset.interests ?? '').split(' ').filter(Boolean)) {
      const path = document.createElementNS(SVG, 'path');
      svg.append(path);
      edges.push({ i, p: p.dataset.project!, path });
    }
  }

  function layout() {
    const side = matchMedia('(min-width: 900px)').matches;
    svg.style.display = side ? '' : 'none';
    if (!side) return;
    const box = net.getBoundingClientRect();
    const byI = new Map(iNodes.map((n) => [n.dataset.interest!, n.getBoundingClientRect()]));
    const byP = new Map(pNodes.map((n) => [n.dataset.project!, n.getBoundingClientRect()]));
    for (const e of edges) {
      const a = byI.get(e.i), b = byP.get(e.p);
      if (!a || !b) continue;
      const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top;
      const x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
      const mx = (x1 + x2) / 2;
      e.path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    }
  }

  let pinned: string | null = null;

  function highlight(kind: 'i' | 'p' | null, id: string | null) {
    net.classList.toggle('is-focus', !!kind);
    const onI = new Set<string>(), onP = new Set<string>();
    if (kind === 'i' && id) { onI.add(id); edges.filter((e) => e.i === id).forEach((e) => onP.add(e.p)); }
    if (kind === 'p' && id) { onP.add(id); edges.filter((e) => e.p === id).forEach((e) => onI.add(e.i)); }
    iNodes.forEach((n) => n.classList.toggle('is-on', onI.has(n.dataset.interest!)));
    pNodes.forEach((n) => n.classList.toggle('is-on', onP.has(n.dataset.project!)));
    edges.forEach((e) => e.path.classList.toggle('is-on', onI.has(e.i) && onP.has(e.p)));
  }
  const restore = () => highlight(pinned ? 'i' : null, pinned);

  const ac = new AbortController();
  const opt = { signal: ac.signal };
  for (const n of iNodes) {
    const id = n.dataset.interest!;
    n.addEventListener('pointerenter', () => highlight('i', id), opt);
    n.addEventListener('focus', () => highlight('i', id), opt);
    n.addEventListener('pointerleave', restore, opt);
    n.addEventListener('blur', restore, opt);
    n.addEventListener('click', () => {
      pinned = pinned === id ? null : id;
      iNodes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.interest === pinned)));
      restore();
    }, opt);
  }
  for (const n of pNodes) {
    const id = n.dataset.project!;
    n.addEventListener('pointerenter', () => highlight('p', id), opt);
    n.addEventListener('focus', () => highlight('p', id), opt);
    n.addEventListener('pointerleave', restore, opt);
    n.addEventListener('blur', restore, opt);
  }
  net.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pinned) {
      pinned = null;
      iNodes.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      restore();
    }
  }, opt);

  const ro = new ResizeObserver(layout);
  ro.observe(net);
  document.fonts?.ready.then(layout);
  layout();

  onTeardown(() => {
    ac.abort();
    ro.disconnect();
  });
}

#!/usr/bin/env node
// Captures Fig. 6 at each of its eight steps (desktop: scroll through the pinned section;
// mobile: press each rail button), plus reduced motion. Usage: node scripts/verify/steps.mjs [base]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const base = process.argv[2] ?? 'http://localhost:4321';
const out = join('reports', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '-steps');
mkdirSync(out, { recursive: true });
const errors = [];
const b = await chromium.launch();
for (const [w, h] of [[1280, 900], [375, 812]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(base + '/work/floodhub/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const pinned = await p.evaluate(() => document.querySelector('[data-ly-pin]').classList.contains('is-pinned'));
  for (let i = 0; i < 8; i++) {
    if (pinned) {
      await p.evaluate((i) => {
        const el = document.querySelector('[data-ly-pin]');
        const top = el.getBoundingClientRect().top + scrollY;
        scrollTo(0, top + ((i + 0.6) / 8) * (el.offsetHeight - innerHeight));
      }, i);
    } else {
      await p.locator(`[data-ly-go="${i}"]`).click();
      await p.locator('#fig-layers .ly-grid').scrollIntoViewIfNeeded();
    }
    await p.waitForTimeout(900);
    await p.screenshot({ path: join(out, `step${i + 1}-${w}.png`) });
  }
  console.log(w, 'pinned:', pinned, 'current:', await p.locator('[aria-current="step"]').textContent());
  await p.close();
}
const r = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await r.goto(base + '/work/floodhub/', { waitUntil: 'networkidle' });
await r.locator('#fig-layers').screenshot({ path: join(out, 'reduced-1280.png') });
await b.close();
console.log(`screenshots in ${out}`);
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'console errors: none');

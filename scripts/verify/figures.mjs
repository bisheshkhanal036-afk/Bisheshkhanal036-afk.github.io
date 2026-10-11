#!/usr/bin/env node
// Captures every figure on the case-study pages at three scroll positions (early, middle,
// late in its scrub range), plus its reduced-motion render. Element screenshots only.
// Usage: node scripts/verify/figures.mjs [baseUrl] [width]

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const width = Number(process.argv[3] ?? 1280);
const pages = ['/work/hanumante-ews/', '/work/bagmati-evacuation/', '/work/kaligandaki-preprint/', '/work/floodhub/'];
const out = join('reports', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + `-fig${width}`);
mkdirSync(out, { recursive: true });
const errors = [];
const browser = await chromium.launch();

for (const reduced of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const figs = await page.locator('figure[data-figure]').all();
    for (const fig of figs) {
      const id = await fig.getAttribute('id');
      const box = await fig.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + scrollY, h: r.height };
      });
      const vh = 900;
      const fracs = reduced ? [1] : [0.15, 0.5, 0.95];
      for (const [i, f] of fracs.entries()) {
        const y = reduced ? box.top - 40 : Math.max(0, box.top - vh * 0.75) + f * (box.h + vh * 0.35);
        await page.evaluate((y) => scrollTo(0, y), y);
        await page.waitForTimeout(650);
        // Viewport capture: an element screenshot would scroll the page and move the scrub.
        const file = join(out, `${id}-${reduced ? 'reduced' : `scroll${i + 1}`}.png`);
        if (reduced) await fig.screenshot({ path: file });
        else await page.screenshot({ path: file });
      }
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`figure screenshots in ${out}`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
process.exit(errors.length ? 1 : 0);

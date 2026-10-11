#!/usr/bin/env node
// Verification run against a preview server (default http://localhost:4321).
// - screenshots at 375/768/1280/1920 for each page
// - hero figure at three scroll positions (desktop) + reduced-motion render
// - aria snapshot per page, console errors, keyboard tab order (first 25 stops)
// Output: reports/<run>/ (gitignored). Exits 1 on console errors.
//
// Usage: node scripts/verify/shots.mjs [baseUrl] [page ...]

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const pages = process.argv.length > 3 ? process.argv.slice(3) : ['/', '/cv/', '/contact/', '/404'];
const widths = [375, 768, 1280, 1920];
const out = join('reports', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
mkdirSync(out, { recursive: true });

const slug = (p) => (p === '/' ? 'home' : p.replace(/\//g, '')) || 'home';
const errors = [];
const browser = await chromium.launch();

async function open(width, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${path} @${width}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${path} @${width}: ${e.message}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

for (const path of pages) {
  for (const w of widths) {
    const { ctx, page } = await open(w, path);
    await page.screenshot({ path: join(out, `${slug(path)}-${w}.png`), fullPage: true });
    if (w === 1280) {
      writeFileSync(join(out, `${slug(path)}-aria.yml`), await page.locator('body').ariaSnapshot());
      const stops = [];
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        stops.push(await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return '(body)';
          const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName;
          const cs = getComputedStyle(el);
          const visible = cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
          return `${el.tagName.toLowerCase()} "${label}"${visible ? '' : '  [NO VISIBLE FOCUS]'}`;
        }));
      }
      writeFileSync(join(out, `${slug(path)}-tab-order.txt`), stops.join('\n'));
    }
    await ctx.close();
  }
}

// Hero figure: three scroll positions on desktop, plus mobile mid-scrub
if (pages.includes('/')) {
  for (const w of [1280, 375]) {
    const { ctx, page } = await open(w, '/');
    const fig = page.locator('#fig-rain-river');
    const max = await page.evaluate(() => {
      const s = document.querySelector('[data-hero-scroll]');
      return s.classList.contains('is-scrub') ? s.offsetHeight - innerHeight : null;
    });
    const figTop = await fig.evaluate((el) => el.getBoundingClientRect().top + scrollY);
    const positions = max != null ? [0.08, 0.35, 0.95].map((f) => f * max) : [figTop - 700, figTop - 400, figTop];
    for (const [i, y] of positions.entries()) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(out, `hero-${w}-scroll${i + 1}.png`) });
    }
    await ctx.close();
  }
  const { ctx, page } = await open(1280, '/', { reducedMotion: 'reduce' });
  await page.screenshot({ path: join(out, 'hero-1280-reduced-motion.png') });
  await ctx.close();
  // No-JS render
  const nojs = await open(1280, '/', { javaScriptEnabled: false });
  await nojs.page.screenshot({ path: join(out, 'hero-1280-nojs.png') });
  await nojs.ctx.close();
}

await browser.close();
writeFileSync(join(out, 'console-errors.txt'), errors.join('\n') || 'none');
console.log(`screenshots in ${out}`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
process.exit(errors.length ? 1 : 0);

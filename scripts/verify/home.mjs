#!/usr/bin/env node
// Home page: viewport captures while scrolling (scroll-driven reveals need real scroll positions).
// Usage: node scripts/verify/home.mjs [base] [width]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const base = process.argv[2] ?? 'http://localhost:4321';
const w = Number(process.argv[3] ?? 1280);
const out = join('reports', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + `-home${w}`);
mkdirSync(out, { recursive: true });
const errors = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: w, height: w < 768 ? 812 : 900 } });
p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const ids = ['.stats', '.pipe', '#work', '#work .work-row:nth-child(3)', '#pubs-title', '#int-title', '.cta'];
for (const [i, sel] of ids.entries()) {
  await p.evaluate((sel) => { const el = document.querySelector(sel); scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.25); }, sel);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: join(out, `${String(i + 1).padStart(2, '0')}-${sel.replace(/[^a-z0-9]+/gi, '_')}.png`) });
}
await b.close();
console.log(`screenshots in ${out}`);
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'console errors: none');

#!/usr/bin/env node
// Captures interactive states: Work filter (Flip) mid-animation and settled, Research
// network highlight via keyboard focus, and a pinned interest. Output in reports/<run>-ix/.
// Usage: node scripts/verify/interactions.mjs [baseUrl]

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const out = join('reports', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '-ix');
mkdirSync(out, { recursive: true });
const errors = [];
const browser = await chromium.launch();

async function open(path, width = 1280, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${path}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

// Work filter
{
  const { ctx, page } = await open('/work/');
  await page.screenshot({ path: join(out, 'work-all.png'), fullPage: true });
  await page.getByRole('button', { name: 'Hazard-based exposure, isolation and evacuation planning' }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: join(out, 'work-filter-mid.png') });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, 'work-filter-done.png'), fullPage: true });
  console.log('work: url after filter', page.url(), '| status:', await page.locator('[data-filter-status]').textContent());
  await ctx.close();
}
// Deep link from Research
{
  const { ctx, page } = await open('/work/?interest=rainfall-extremes', 375);
  await page.screenshot({ path: join(out, 'work-deeplink-375.png'), fullPage: true });
  await ctx.close();
}
// Research network: keyboard focus on an interest, then pin another
{
  const { ctx, page } = await open('/research/');
  await page.getByRole('button', { name: /Surrogate modelling/ }).focus();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'research-focus.png') });
  await page.getByRole('button', { name: /Hazard-based exposure/ }).press('Enter');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'research-pinned.png') });
  await ctx.close();
}
{
  const { ctx, page } = await open('/research/', 375);
  await page.screenshot({ path: join(out, 'research-375.png'), fullPage: true });
  await ctx.close();
}
// Reduced motion: filter applies instantly
{
  const { ctx, page } = await open('/work/', 1280, { reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Rainfall extremes and trends in Nepal' }).click();
  await page.waitForTimeout(50);
  await page.screenshot({ path: join(out, 'work-filter-reduced.png') });
  await ctx.close();
}

await browser.close();
console.log(`screenshots in ${out}`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
process.exit(errors.length ? 1 : 0);

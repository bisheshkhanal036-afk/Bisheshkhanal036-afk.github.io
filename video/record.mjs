#!/usr/bin/env node
/**
 * Records a real session of the Khola / FloodHUB app (running locally via Docker) with
 * Playwright, and logs when each workflow step starts so the editor can cut waits out.
 *
 * Kept off screen on purpose: the landing-page credits (teammates' emails and photos) and
 * step 8 Shelters (it marks individual buildings). The map stays at basin scale so single
 * building footprints are never legible.
 *
 * Usage: node video/record.mjs   ->  video/raw/session.webm + video/raw/marks.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const RAW = join('video', process.argv[2] ?? 'raw');
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
const W = 1600, H = 1000;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: RAW, size: { width: W, height: H } },
});
await ctx.addInitScript(() => {
  try { localStorage.setItem('flood-risk-tour-seen', '1'); } catch {}
  // Visible cursor and click ripple (headless recordings have no pointer).
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform 60ms linear;';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 17 L7 13 L10 20 L13 19 L10 12 L16 12 Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:2px solid #3dd6c6;z-index:2147483646;pointer-events:none;transition:transform 450ms ease-out,opacity 450ms ease-out;`;
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  });
});

const p = await ctx.newPage();
const t0 = Date.now();
const marks = [];
const mark = (id, label) => { marks.push({ id, label, t: (Date.now() - t0) / 1000 }); console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${id}`); };
const pause = (ms) => p.waitForTimeout(ms);
let mx = W / 2, my = H / 2;
async function moveTo(x, y, steps = 28) { await p.mouse.move(x, y, { steps }); mx = x; my = y; }
async function clickEl(loc, opts = {}) {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  await moveTo(box.x + box.width / 2, box.y + box.height / 2);
  await pause(250);
  await loc.click(opts);
}
const side = p.locator('aside').first();
async function scrollSide(dy) {
  const box = await side.boundingBox();
  await moveTo(box.x + box.width * 0.7, box.y + box.height * 0.5, 12);
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, dy / 10); await pause(30); }
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await moveTo(W * 0.55, H * 0.45, 1);
mark('landing', 'Landing');
await pause(2600);
await clickEl(p.getByRole('button', { name: /Launch tool/ }).first());
await pause(1400);
await clickEl(p.getByText('Build a model'));
await pause(2500);

// 1 Area of interest
mark('aoi', 'Area of interest');
await clickEl(p.getByRole('button', { name: 'Select basin' }));
mark('basins-loading', 'Loading basins');
await p.getByText('Loading basins').waitFor({ state: 'detached', timeout: 180000 }).catch(() => {});
mark('basins-ready', 'Basins loaded');
await pause(1200);
await moveTo(1050, 520);
await pause(500);
await p.mouse.click(1050, 520);
await p.getByText('AOI set').waitFor({ timeout: 60000 });
mark('aoi-set', 'Basin selected');
await pause(2500);

// 2 Criteria
mark('criteria', 'Criteria');
const CRIT = ['Elevation', 'Slope', 'Topographic Wetness Index', 'Rainfall (satellite)', 'Distance to River', 'Drainage Density', 'Land Cover', 'Vegetation (NDVI)', 'Distance to Road', 'Building Density', 'Population Density'];
for (const c of CRIT) {
  const box = p.locator('label').filter({ hasText: c }).locator('input[type=checkbox]').first();
  await clickEl(box);
  await pause(350);
}
mark('criteria-done', 'Eleven criteria');
await pause(1200);

// 3 Weighting
mark('weighting', 'Weighting');
const wbtn = p.locator('button', { hasText: 'Weighting' }).first();
await clickEl(wbtn);
await pause(3500);
await scrollSide(300);
await pause(2500);

// 4 Compute
mark('compute', 'Compute');
await clickEl(p.getByRole('button', { name: 'Compute risk map' }));
await p.getByRole('button', { name: /Generate report/i }).waitFor({ timeout: 600000 });
mark('computed', 'Risk surface');
await pause(1500);
await moveTo(1100, 560);
await pause(3500);

// 5 Vulnerability report
mark('report', 'Vulnerability report');
await clickEl(p.getByRole('button', { name: /Generate report/i }));
await p.getByText(/Generating report/i).waitFor({ state: 'detached', timeout: 900000 }).catch(() => {});
mark('report-done', 'Report ready');
await pause(6500);
// Close the report overlay so the map stays visible for validation and METEOR.
// The overlay's close control sits at its top-right corner.
await moveTo(1550, 44);
await pause(300);
await p.mouse.click(1550, 44);
await pause(2000);
await scrollSide(500);
await pause(2000);

// 6 Validate against BIPAD flood incidents
mark('validate', 'Validate');
const vbtn = p.locator('button', { hasText: /^Validate$/ });
const evSel = p.locator('aside select').filter({ hasText: 'BIPAD' }).first();
await evSel.scrollIntoViewIfNeeded();
await clickEl(evSel);
await evSel.selectOption({ label: 'Nepal flood incidents, 2011-2026 (BIPAD Portal, point inventory)' });
await pause(800);
await clickEl(vbtn.last());
await p.getByText(/AUC/i).first().waitFor({ timeout: 600000 }).catch(() => {});
mark('validate-done', 'Validation result');
await pause(4000);
await scrollSide(400);
await pause(3000);

// 7 Compare to METEOR
mark('meteor', 'Compare to METEOR');
await clickEl(p.getByRole('button', { name: /^Compare to METEOR$/ }).last());
await p.waitForTimeout(1000);
await p.getByText(/AUC/i).nth(1).waitFor({ timeout: 600000 }).catch(() => {});
mark('meteor-done', 'METEOR result');
await pause(4000);
await scrollSide(400);
await pause(3000);
mark('end', 'End');

await ctx.close();
await browser.close();
const vid = readdirSync(RAW).find((f) => f.endsWith('.webm'));
renameSync(join(RAW, vid), join(RAW, 'session.webm'));
writeFileSync(join(RAW, 'marks.json'), JSON.stringify({ fps: 25, width: W, height: H, marks }, null, 2));
console.log('saved video/raw/session.webm');

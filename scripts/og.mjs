#!/usr/bin/env node
// Renders public/og.png (1200×630) and the PNG favicons from inline HTML with Playwright.
// Fonts come from the built site, so run after `npm run build:preview` with the preview
// server up: node scripts/og.mjs [baseUrl]

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4321';
const css = await (await fetch(base + '/')).text().then((html) => {
  // Astro hashes font-family names; copy its @font-face rules and --font-* variables as-is.
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).filter((c) => c.includes('@font-face'));
  return styles.join('\n').replaceAll('url("/', `url("${base}/`);
});

const og = `<!doctype html><html><head><style>${css}
  body{margin:0;width:1200px;height:630px;background:#f3efe6;color:#1c2023;font-family:var(--font-newsreader);position:relative;overflow:hidden}
  .wrap{position:absolute;left:84px;top:96px;right:300px}
  .eyebrow{font-weight:500;font-size:22px;font-family:var(--font-jbmono);letter-spacing:.1em;color:#4f555a;text-transform:uppercase}
  h1{font-weight:430;font-size:104px;line-height:1.02;letter-spacing:-.02em;margin:28px 0 0}
  p{font-size:36px;line-height:1.3;color:#4f555a;margin:28px 0 0}
  .gauge{position:absolute;right:120px;top:90px;bottom:90px;width:4px;background:#cdc4b1}
  .fill{position:absolute;left:0;right:0;bottom:0;height:46%;background:#b2741c}
  .t{position:absolute;right:4px;height:2px;background:#4f555a}
  .url{position:absolute;left:84px;bottom:72px;font-size:22px;font-family:var(--font-jbmono);color:#87560f}
</style></head><body>
  <div class="wrap"><div class="eyebrow">Kathmandu, Nepal</div><h1>Bishesh Khanal</h1>
  <p>Flood modelling, hydrology and machine learning for early warning.</p></div>
  <div class="gauge"><div class="fill"></div>${Array.from({ length: 21 }, (_, i) => `<div class="t" style="bottom:${i * 5}%;width:${i % 4 === 0 ? 28 : 14}px"></div>`).join('')}</div>
  <div class="url">bisheshkhanal036-afk.github.io</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// Same origin as the preview server, so the self-hosted fonts load without CORS.
await page.goto(base + '/robots.txt');
await page.setContent(og, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });

const svg = readFileSync('public/favicon.svg', 'utf8');
for (const [size, file] of [[32, 'public/favicon-32.png'], [180, 'public/apple-touch-icon.png']]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: file, omitBackground: true });
}
await browser.close();
console.log('wrote public/og.png, public/favicon-32.png, public/apple-touch-icon.png');

#!/usr/bin/env node
// Checks every internal href/src in dist/*.html resolves to a built file, and every
// #fragment exists on its target page. Run after a build. Exits 1 on any broken link.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const pages = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) pages.push(p);
  }
})(dist);

const ids = new Map();
const html = new Map();
for (const p of pages) {
  const s = readFileSync(p, 'utf8');
  html.set(p, s);
  ids.set(p, new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

function resolve(path) {
  const clean = decodeURIComponent(path.split('?')[0]);
  const candidates = [join(dist, clean), join(dist, clean, 'index.html'), join(dist, `${clean}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

const broken = [];
for (const [page, s] of html) {
  for (const m of s.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|tel:)/.test(url)) continue;
    const [path, frag] = url.split('#');
    const target = path ? resolve(path) : page;
    if (!target) { broken.push(`${page}: ${url}`); continue; }
    if (frag && target.endsWith('.html') && !ids.get(target)?.has(frag)) broken.push(`${page}: ${url} (no #${frag})`);
  }
}

console.log(`links: ${pages.length} pages checked, ${broken.length} broken`);
if (broken.length) { console.log(broken.join('\n')); process.exit(1); }

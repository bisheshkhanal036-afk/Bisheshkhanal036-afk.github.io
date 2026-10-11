#!/usr/bin/env node
// Fetch a DOI's metadata from Crossref and store it in src/data/crossref/.
// Usage: npm run verify-doi -- 10.31223/X55N3N
// Prints the record so it can be compared with what the site claims.

import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dois = process.argv.slice(2);
if (!dois.length) {
  console.error('usage: npm run verify-doi -- <doi> [<doi> ...]');
  process.exit(1);
}

let failed = false;
for (const doi of dois) {
  const api = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(api);
  if (!res.ok) {
    console.error(`${doi}: Crossref returned ${res.status}. Not stored.`);
    failed = true;
    continue;
  }
  const m = (await res.json()).message;
  const record = {
    doi: m.DOI.toLowerCase(),
    title: m.title?.[0] ?? '',
    authors: (m.author ?? []).map((a) => ({ given: a.given ?? '', family: a.family ?? '' })),
    posted: (m.posted ?? m.issued)?.['date-parts']?.[0] ?? null,
    publisher: m.publisher ?? null,
    container: m['container-title']?.[0] ?? null,
    type: m.type ?? null,
    subtype: m.subtype ?? null,
    url: m.URL,
    retrieved: new Date().toISOString().slice(0, 10),
    source: api,
  };
  const out = join(root, 'src/data/crossref', `${record.doi.replaceAll('/', '_')}.json`);
  writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 2));
}
process.exit(failed ? 1 : 0);

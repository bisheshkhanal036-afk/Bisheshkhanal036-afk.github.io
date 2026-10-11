# Bishesh Khanal: research website

Static Astro site deployed to GitHub Pages at https://bisheshkhanal036-afk.github.io (user site, no base path).
Owner: Bishesh Khanal (civil engineer; flood modelling, hydrology, ML for early warning; Kathmandu).

## Stack
- Astro 7 (static output), TypeScript strict, content collections with zod (`astro/zod`, Zod 4: use `z.email()`, `z.url()`).
- Tailwind CSS v4 via `@tailwindcss/vite` (configured in `astro.config.mjs`). Tokens in `src/styles/global.css`.
- Figures: one island per figure, `client:visible`, code-split. GSAP (ScrollTrigger, Flip, SplitText, DrawSVG) only inside islands. D3 modules only (d3-scale, d3-shape, d3-geo, d3-interpolate) + topojson-client. Canvas 2D for raster fills, SVG for lines and markers. No map library for static figures.
- Not used, by decision: Lenis (native scroll), Three.js (v1).
- Docs: no Context7 here. Before using any Astro, Tailwind, GSAP, D3 or GitHub Pages API, WebFetch the official docs page. Do not code from memory.
- Dev server: `npx astro dev --background`; manage with `astro dev stop|status|logs`.

## Commands
| | |
|---|---|
| `npm run dev` | dev server (placeholders visible as badges) |
| `npm run check` | integrity check + `astro check`. **Fails while any placeholder remains** |
| `npm run check:dev` | same, but placeholders only reported |
| `npm run build` | `check` then `astro build`. Production build: blocked by placeholders |
| `npm run build:preview` | build allowing placeholders (local verification only) |
| `npm run verify-doi -- <doi>` | fetch Crossref record into `src/data/crossref/` |

## Content model (`src/content.config.ts`)
- `profile` (`src/content/profile.json`), `cv` (`src/content/cv/*.json`, one file per section), `publications` (`src/content/publications/*.json`), `projects` (`src/content/projects/*.md`), `interests` (`src/content/interests.json`).
- Projects reference interests (`interests: [id]`). Publications may reference a project.
- `visibility`: `public` (full page + figure), `minimal` (title, authors/status only, no methods, no figure), `hidden` (not rendered).
- Raw material lives in `content/source/` (**gitignored**: contains the full CV with phone number). Only processed files under `src/data/` are committed.

## Data-integrity rules (strict)
1. Never invent a publication, DOI, citation, co-author, affiliation, metric, date or result. Sources allowed: `content/source/cv.pdf`, facts Bishesh stated (brief/messages, cite date), files in `content/source/`, Crossref records.
2. Every number/claim in content carries a `source` (`"cv.pdf p.N"`, `"brief YYYY-MM-DD"`, `"crossref:<doi>"`). Unknown → `"PLACEHOLDER"`; unsigned-off text → contains `TODO: confirm`. `npm run check` regenerates `PLACEHOLDERS.md` and fails while any remain.
3. Publication `status` ∈ preprint | under review | in preparation | accepted. Never "published".
4. A DOI is shown only with a stored Crossref record whose title and author list match (enforced by `scripts/check.mjs`). Report mismatches to Bishesh; do not "fix" silently.
5. Every figure caption: "Fig. N. What it shows. Data: source. Status: observed | simulated | schematic." Never present schematic or simulated data as observed.
6. AGU 2026 abstract numbers appear only in the AGU entry, verbatim. Hanumante numbers are labelled "current results". Never mix them.
7. Decisions log: see "Open decisions" below. Do not resolve an open decision by guessing.

## Privacy (public repo, public site)
Never include: phone, home address, grades/percentages/GPA, exam scores (IELTS), graduate-application details or target schools, funding/financial details, immigration or health info, personal photos other than the provided headshot, referee contact details. Email only as an obfuscated mailto. Building data only aggregated (hex bins/grid cells), never individual building points. Data scripts must enforce aggregation.

## Design tokens (`src/styles/global.css`)
- Direction: field notebook × instrument panel. Paper `#f3efe6` / ink ground `#13181b` in dark. One accent, sediment ochre.
- Text colours: `ink`, `ink-2` (secondary). Accent text uses `accent-text` (5.4:1 light). `accent` itself is for graphics and large text only.
- Charts use only `--chart-*` variables. Chart labels use `--chart-label` (= ink-2). Never use `--chart-schematic` for small text on paper-2.
- Type: Newsreader (serif, reading + display), JetBrains Mono (data labels, gauge ticks, metadata). Scale ratio 1.25.
- Radii 2–4px. No cards-in-a-grid, no gradients, no glassmorphism, no water-droplet or wave clip art.

## Motion rules
- Eases: `--ease-out` (entrances), `--ease-in-out` (state changes, scrubs), `--ease-gauge` (needle settle). Durations: fast 160ms, base 320ms, slow 720ms. GSAP timelines read these from CSS.
- Animate transform and opacity only (canvas redraws for rasters). Remove `will-change` after use.
- Every figure: scrubber or play/pause, text description, static final-frame fallback rendered at build time.
- `prefers-reduced-motion`: final frame + caption, no smooth scroll, no looping motion.
- On page change (`astro:before-swap`): kill ScrollTriggers, cancel rAF loops, revert SplitText. Pause off-screen canvases (IntersectionObserver).
- Content never depends on JS. Rasuwa figure: slow, quiet, no alarm red, no shaking, no particles.

## Copy rules
Bishesh's voice: concise, plain statements. At most two em dashes on the whole site. Banned words: delve, tapestry, boundaries, testament, intricate, vibrant, unwavering, profound, resonate, elevate, underscore. No "not just X but Y", no tricolons, no stacked adjectives, no announced takeaways. Missing copy is drafted and tagged `TODO: confirm`.

## Verification loop (after every milestone)
1. `npm run check:dev`, `npm run build:preview && npm run preview`.
2. Playwright (`@playwright/test`, no MCP here): aria snapshots; screenshots at 375/768/1280/1920; per figure 3 scroll positions + reduced-motion render; zero console errors; keyboard tab walk.
3. Lighthouse mobile: LCP < 2.5s, CLS < 0.1, TBT (INP proxy) low. Home initial JS < 100 KB gz. Case-study page < 1.5 MB transferred.
4. Contrast: body ≥ 4.5:1, large text and chart labels ≥ 3:1 (token script).
5. Manual critique/polish pass (no /impeccable skill here): hierarchy, rhythm, contrast, motion, copy rules.
6. SEO: title, description, canonical, OG image, favicons, sitemap, robots.txt, lang, JSON-LD Person (home) and ScholarlyArticle (only verified DOI/link items), 404, public CV PDF (no phone/grades/referees).

## Git
- Conventional commits after each working milestone. **Do not push, change Pages settings or create repos without Bishesh's confirmation.**
- The live site is still the legacy single page (deployed from branch). Pushing Astro source to `main` before switching Pages to "GitHub Actions" would break the live site.

## Decisions (2026-10-11)
Bishesh: "this can all be found in the CV". Check his own documents before asking. Sources beyond cv.pdf: `content/source/research-statement.docx` (11 Oct 2026).
- B1 no headshot (none supplied). B2 LinkedIn (CV) and GitHub links shown.
- C1 Bagmati venue: Environmental Development (Elsevier), under review, first author (CV + statement).
- C3 final year project = Bagmati = Sept 2024 thesis: one page (bagmati-evacuation), thesis as origin, UNOSAT swipe as validation panel.
- C4 AGU abstract (Kathmandu Valley GRU surrogate) is the earlier work; Hanumante applies the approach (statement). Numbers stay separate. No role claim on Hanumante.
- C5 8th-semester surveys folded into hanumante-ews as "Field work" + CV line.
- C6 Kaligandaki author order: Crossref (Roka, Khanal).
- D1 Bagmati service area: omit (not in CV or statement). D5 FloodHUB repo is public (github.com/bisheshkhanal036-afk/FloodHUBnepal): link it; teammates not named.
- Rasuwa letter removed from the site (Bishesh, 2026-10-11). No rasuwa-cascade project page either, unless he asks.

- C2 Narayani: same paper as the CV entry, under review at Journal of Water and Climate Change, first author. Visibility stays minimal (no methods, figure or repo link) until Bishesh says otherwise.
- Author lists: not shown anywhere. Each publication shows Bishesh's role (first author / co-author).
- Bagmati result numbers (buildings, % isolated, route lengthening, service area): never shown while under review.

## Still open
- Duplicate Coursera credential URL for two certifications (CV p.2).

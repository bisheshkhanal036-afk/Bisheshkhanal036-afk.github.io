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
| `npm test` | vitest (hydrology maths in `src/lib/hydro/`) |
| `npm run cv:pdf` | compile `cv/cv-public.tex` → `public/cv.pdf` (public CV; never the private one) |
| `node scripts/verify/links.mjs` | internal links and #fragments in `dist/` |
| `node scripts/verify/interactions.mjs [base]` | Work filter (Flip) and Research network states → `reports/` |
| `node scripts/og.mjs` | render `public/og.png` + PNG favicons (needs `npm run preview` running) |
| `node scripts/verify/shots.mjs <base> [paths]` | screenshots, aria snapshots, tab order, console errors → `reports/` (Git Bash: prefix `MSYS_NO_PATHCONV=1` when passing `/` paths) |

Lighthouse: `CHROME_PATH=<playwright chromium> npx lighthouse@12 <url> --form-factor=mobile`.

## Figures
- `src/components/figures/FigureShell.astro`: caption, controls, description. Every figure uses it.
- Final frame is rendered at build time in the `.astro` file; a `.ts` runtime only reveals it over a clock. CSS under `.js` sets frame 0; `window.__figuresReady` cancels the 4 s fallback in `Base.astro`.
- `gsap.matchMedia` with a conditions object runs only when some condition matches: always include a condition for every viewport.
- Cleanup goes through `onTeardown()` in `src/lib/motion/lifecycle.ts`.
- Fig. 1 (home, "Rain becomes river"): `src/lib/hydro/scs.ts` + `src/data/hero-schematic.json`. Schematic.
- Scroll-scrubbed figures use `mountScrub()` (`src/lib/motion/scrub.ts`); ScrollTrigger start/end are wrapped in `clamp()` so figures on screen at load start at frame 0.
- Real data wherever it exists; synthetic stand-ins only for projects without real data (Bishesh, 2026-10-11: "add synthetic figures for the ones with no real figures").
  - Synthetic: Fig. 3 Isolation + Fig. 4 Swipe (bagmati-evacuation), Fig. 5 Two models (kaligandaki-preprint). Generators in `src/lib/schematic/`. Each carries `synthetic` in FigureShell ("Synthetic stand-in, not project results"), "Status: schematic", and an `awaiting:` note that `check.mjs` lists in PLACEHOLDERS.md (non-blocking). Never label a synthetic series "observed"; never show skill metrics or Bagmati counts on synthetic data. When real data arrives, replace the figure and delete its `awaiting:` note.
  - Fig. 7 Narayani "What a district mean hides" (observed): `scripts/data/narayani_to_json.py` (in the FloodHUB container; copies of the paper's processed station CSVs and SRTM mosaic in /tmp/nar) → `src/data/narayani/storm.json`: HydroBASINS L8 units upstream of Triveni, COD-AB districts clipped to the basin, hillshade, 66 gauges with daily rain 26 Jul–5 Aug 2003. `src/lib/narayani.ts` builds it (client helpers in `narayani-geom.ts`, no data import); hillshade at `/figures/narayani-hillshade.png`. Gauges grow day by day to 31 Jul 2003, then merge into district means; dashed rings and the strip keep the gauge readings. The manuscript says 78 gauges; the processed dataset has 66, so the page states no count.
  - Bagmati world (Figs. 3–4): real geography from FloodHUB (`scripts/data/floodhub_world_to_json.py` → `src/data/floodhub/world.json`: basin HydroBASINS L8 4080848980, hillshade, OSM rivers/roads, 650 m hexes with building counts ≥ 5). `src/lib/schematic/catchment-world.ts` builds a proxy flood (valley-floor river corridors + High-hazard ≥ 0.7) and travel-cost isolation (Dijkstra, cost 1 on arterial roads, 3 off; cut off = route cost > reach at the step, ≤ reach before the flood; `o` = out of reach before the flood). Tuned to ~20% of hexes flooded at peak and ~13% of building hexes cut off. Served via `/figures/bagmati-isolation.json` and `/figures/bagmati-hillshade.png`. Fig. 4 compares the proxy with METEOR 1-in-100 (real). Both carry a `syntheticLabel` stand-in tag; never show counts.
- Fig. 6 (floodhub, "Eight steps, one basin"): REAL. FloodHUB's eight sidebar steps on a cached run for HydroBASINS L8 basin 4080848980 (run of 2026-08-25). Data: `src/data/floodhub/layers.json` (`scripts/data/floodhub_cache_to_json.py`) and `steps.json` (`scripts/data/floodhub_steps_to_json.py`), both run inside the FloodHUB backend container and read-only on its cache. Weights recovered exactly from the cached surface (FloodHUB formula R_norm = (Σ wᵢ·classᵢ − 1)/4, residual 1e-7). Steps 6–8 call FloodHUB's own validate/compare/shelter functions with `compute_overlay` swapped in-process for the cached result. Buildings and shelters appear only as counts and per-cell shares (cells under 5 buildings dropped), never as points. METEOR layer is FD = fluvial defended, 1-in-100. BIPAD validation counts grid cells holding incidents, not incidents. Keep the data credits visible. Client data from `/figures/floodhub-layers.json`.
- FloodHUB lives in `D:\important documents\AcademicCV_Bishesh` (repo FloodHUBnepal, has uncommitted work: never modify it). Docker Desktop is at `C:\Users\bishe\AppData\Local\Programs\DockerDesktop` (docker.exe under `resources\bin`).
- Fig. 2 (hanumante-ews, "Surrogate against the 2D model"): `src/data/hanumante/surrogate.json`, made by `scripts/data/surrogate_csv_to_json.py` from `C:\HEC_RAS\GRU_surrogate_leadtime3_12864\csv_outputs` (approved by Bishesh). Test event 160, chosen by rule (median event-mean NSE of 49 held-out events). `Q_obs` in those CSVs is HEC-RAS 2D output: label it "HEC-RAS 2D (reference)", status "simulated", never "observed". Client data fetched from `/figures/hanumante-surrogate.json`.
- Verify figures with `node scripts/verify/figures.mjs [base] [width]` (viewport captures; element screenshots scroll the page and move the scrub).

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
- Draft statements of aim wait in `drafts/aims.json` (not built). To publish: move approved entries into `src/data/aims.json` (Aim, Pipeline and case studies render only what is there).
- Live since 2026-10-11. Pages source is "GitHub Actions" (`build_type: workflow`); every push to `main` deploys via `.github/workflows/deploy.yml`. Pushing is deploying, so still confirm with Bishesh first.
- `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` (not on Git Bash PATH) and logged in as bisheshkhanal036-afk.

## Decisions (2026-10-11)
Bishesh: "this can all be found in the CV". Check his own documents before asking. Sources beyond cv.pdf: `content/source/research-statement.docx` (11 Oct 2026).
- B1 headshot: `src/assets/headshot.jpg`, Bishesh's photo from the FloodHUB credits (`frontend/src/assets/team/team-bishesh.jpg`), added at his request 2026-10-11. The only personal photo allowed on the site. B2 LinkedIn (CV) and GitHub links shown.
- C1 Bagmati venue: Environmental Development (Elsevier), under review, first author (CV + statement).
- C3 final year project = Bagmati = Sept 2024 thesis: one page (bagmati-evacuation), thesis as origin, UNOSAT swipe as validation panel.
- C4 AGU abstract (Kathmandu Valley GRU surrogate) is the earlier work; Hanumante applies the approach (statement). Numbers stay separate. No role claim on Hanumante.
- C5 8th-semester surveys folded into hanumante-ews as "Field work" + CV line.
- C6 Kaligandaki author order: Crossref (Roka, Khanal).
- D1 Bagmati service area: omit (not in CV or statement). D5 FloodHUB repo is public (github.com/bisheshkhanal036-afk/FloodHUBnepal): link it; teammates not named.
- Rasuwa letter removed from the site (Bishesh, 2026-10-11). No rasuwa-cascade project page either, unless he asks.

- C2 Narayani: same paper as the CV entry, under review at Journal of Water and Climate Change, first author. 2026-10-12 Bishesh asked for an animation from C:/NewNarayaniPaper: page now public with Fig. 7 (RainfallFigure), methods only. Still no repo link, no result numbers (accuracy, AUROC, damping %, trend counts).
- Author lists: not shown anywhere. Each publication shows Bishesh's role (first author / co-author).
- Bagmati result numbers (buildings, % isolated, route lengthening, service area): never shown while under review.

## Still open
- Nothing open.

## Home video (FloodHUB tour)
- `public/video/tour.{webm,mp4}` + `tour-poster.jpg` + `tour.vtt`, shown by `src/components/home/TourVideo.astro` (click to play, `preload="none"`).
- Made from a real screen recording of the Khola/FloodHUB app (Docker, localhost:5173): `node video/record.mjs <folder>` (Playwright; logs step times to marks.json). Kept off screen: landing credits (teammates' emails/photos) and step 8 Shelters (individual buildings).
- Edited in Remotion (`video/`, its own package.json): `remotion/timeline.ts` is the edit list built from marks.json; speed-ups and skipped waiting are stated on screen. Render: `cd video && npx remotion render remotion/index.ts Tour out/tour.mp4 --codec h264 --crf 26`, then ffmpeg to 1280×800 MP4/WebM; `node vtt.mjs` writes captions.
- No generative video: footage must stay real. The session uses equal weights; the end card repeats the app's own caveat (illustrative, not validated).

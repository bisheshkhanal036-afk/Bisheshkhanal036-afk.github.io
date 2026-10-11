# bisheshkhanal036-afk.github.io

Research website of Bishesh Khanal: flood modelling, hydrology and machine learning for early
warning in Nepal. Static Astro site on GitHub Pages: https://bisheshkhanal036-afk.github.io

## Stack
- [Astro 7](https://docs.astro.build), static output, TypeScript, content collections (zod schemas in `src/content.config.ts`)
- Tailwind CSS v4 via `@tailwindcss/vite`; design tokens in `src/styles/global.css` (see `DESIGN.md`)
- GSAP (ScrollTrigger, Flip) loaded on demand inside figures; no JS framework
- Fonts self-hosted through the Astro Fonts API (Newsreader, JetBrains Mono)
- Vitest for the hydrology maths, Playwright and Lighthouse for verification

## Run locally
Requires Node 22.12+ (24 recommended).

```sh
npm ci
npm run dev            # http://localhost:4321
npm test               # unit tests
npm run check          # integrity check + type check (fails on open placeholders)
npm run build          # production build into dist/ (runs check first)
npm run preview        # serve dist/
```

## Update content
All text and numbers live in `src/content/`. Every value carries a `source`.

| What | Where |
|---|---|
| Name, email, links, home statement | `src/content/profile.json` |
| CV sections | `src/content/cv/*.json` (one file per section) |
| Publications | `src/content/publications/*.json` |
| Projects (case studies) | `src/content/projects/*.md` (frontmatter + body) |
| Research interests | `src/content/interests.json` |
| Downloadable CV | edit `cv/cv-public.tex`, then `npm run cv:pdf` (writes `public/cv.pdf`) |

Rules (enforced by `scripts/check.mjs`, details in `CLAUDE.md`):
- Unknown values are written as `PLACEHOLDER`; unconfirmed text contains `TODO: confirm`. Both block `npm run build`.
- Publication status is one of `preprint`, `under review`, `in preparation`, `accepted`. Never "published".
- A DOI needs a Crossref record: `npm run verify-doi -- 10.xxxx/yyyy` stores it in `src/data/crossref/`; the check compares title and authors.
- Nothing private on the public site: no phone, grades, test scores, referee contacts, individual building locations.

## Add a project
1. Create `src/content/projects/<slug>.md` with the frontmatter fields in `src/content.config.ts` (`title`, `status`, `summary`, `period`, `facts[]` with `source`, `interests[]`, `visibility`, `order`, `source`).
2. `visibility: minimal` shows only title, status and role; `hidden` removes the page.
3. To link a manuscript, set `"project": "<slug>"` in its publication JSON.
4. For a figure, add a component in `src/components/figures/` built on `FigureShell.astro`, register it in the `figures` enum in `src/content.config.ts` and the map in `src/pages/work/[slug].astro`, then list it under `figures:` in the project.

## Figures from real data
Fig. 2 (Hanumante) uses real model output. Figs. 3–6 (Bagmati, Kaligandaki, FloodHUB) are synthetic stand-ins, tagged as such on the page and listed in PLACEHOLDERS.md with the data each awaits. Fig. 2 is built from the surrogate run outputs:
```sh
python scripts/data/surrogate_csv_to_json.py "C:/HEC_RAS/GRU_surrogate_leadtime3_12864/csv_outputs" \
    src/data/hanumante/surrogate.json --lead 3 --model GRU
```
To replace a stand-in, or add a new figure: convert the raw files with the templates in `scripts/data/` (see `scripts/data/README.md`) into `src/data/<slug>/`, build a component on `FigureShell.astro`, and give it a caption with the real data source and status (`observed` or `simulated`).

## Verify
With `npm run preview` running:
```sh
node scripts/verify/links.mjs                         # internal links (after a build)
node scripts/verify/shots.mjs http://localhost:4321   # screenshots, aria snapshots, tab order, console errors
node scripts/verify/figures.mjs http://localhost:4321 # every figure at three scroll positions + reduced motion
node scripts/verify/interactions.mjs                  # Work filter and Research network states
node scripts/og.mjs                                   # regenerate og.png and PNG favicons
```
Output goes to `reports/` (gitignored). On Git Bash, prefix commands that pass `/` paths with `MSYS_NO_PATHCONV=1`.

## Deploy
`.github/workflows/deploy.yml` builds with `withastro/action` and publishes with `actions/deploy-pages` on every push to `main`.
One-time setup: repository Settings → Pages → Source: **GitHub Actions**. A build with open placeholders fails in CI and the live site stays as it was.

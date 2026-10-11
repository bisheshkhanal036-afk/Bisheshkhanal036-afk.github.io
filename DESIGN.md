# Design record

Decisions behind the site, so later changes stay consistent. Tokens live in
`src/styles/global.css`; this file explains them.

## Direction
Three directions were considered:
1. **Field notebook × instrument panel**: warm paper ground, deep ink in dark mode, one signal accent, serif for reading, mono for data, contour and gauge ticks as motif.
2. Survey sheet: cartographic grid, marginalia, topographic greens.
3. Journal plate: near-monochrome, typographic only.

**Chosen: 1.** It reads like a lab notebook, and its instrument vocabulary (gauges, ticks, readouts) is the same vocabulary the figures use, so pages and figures look like one document. The scroll indicator is a river-stage gauge for the same reason.

Avoided on purpose: blue gradients and waves, water-drop icons, glass effects, stock hydrology photos, purple-gradient "AI" styling, grids of identical cards.

## Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| `--c-paper` | `#f3efe6` | `#13181b` | page ground |
| `--c-paper-2` | `#ebe5d7` | `#1a2125` | panels, map land |
| `--c-ink` | `#1c2023` | `#e9e3d6` | text, observed/reference series |
| `--c-ink-2` | `#4f555a` | `#a9a395` | secondary text, chart labels (6.6:1 / 7.1:1) |
| `--c-accent` | `#b2741c` | `#dba04a` | the one signal colour: gauge fill, model series, focus ring. Graphics and large text only in light mode (3.4:1) |
| `--c-accent-text` | `#87560f` | `#e3ae5f` | accent as small text (5.4:1 / 8.9:1) |
| `--chart-water-lo/hi` | | | depth and rainfall ramps |
| `--chart-model-2` | `#3f6e7d` | `#8fb9c4` | second model or second source |

Rules: one accent per view; water is slate-blue, never saturated blue; no alarm red anywhere. Contrast was computed from the tokens, not estimated.

## Type
- **Newsreader** (serif, static 400/500/600, self-hosted): headings and body. Optical sizing on.
- **JetBrains Mono**: data labels, axis ticks, metadata, navigation, captions' "Fig. N." and "Data:" lines.
- Scale ratio 1.25 from 17px (`--text-base` 1.0625rem). Headings 430–500 weight, tight negative tracking at display sizes.
- Uppercase is used only for small mono labels (eyebrows, section labels), with `--tracking-label`.

## Layout
- Page container 76rem with 16px (mobile) / 32px gutters. Long text capped near 38rem.
- Lists of work use a three-column row (index · title and status · summary) instead of cards.
- CV and publications use a label column (dates or status) and a content column.
- Rules (1px lines) separate sections; a full-ink rule marks the start of a list.

## Figures
Every figure is one paper's figure:
- Built on `FigureShell.astro`: a "Fig. N." caption with **Data:** and **Status:** (observed, simulated or schematic), play/pause and scrubber, and a written description.
- SVG for lines and markers, canvas only for raster recompute (Fig. 6). Shared `.chart-*` classes for axes, grid and labels.
- Final frame rendered at build time: the page reads correctly without JS and under reduced motion.
- Real data where it exists (Figs. 2 and 6); synthetic stand-ins (Figs. 3–5) carry a dashed "Synthetic stand-in, not project results" tag and "Status: schematic". Model output is labelled as such (Fig. 2 compares HEC-RAS 2D with the GRU; both are "simulated"). An illustrative figure is marked "schematic" (Fig. 1).

## Motion
- Three eases: `--ease-out` (entrances), `--ease-in-out` (state changes), `--ease-gauge` (needle settle). Three durations: 160, 320, 720 ms.
- Animate transform and opacity; discrete class swaps for state maps (Fig. 3). Never layout properties.
- Scroll scrubbing is tied to reading position (ScrollTrigger, `clamp()`ed starts), never scroll-jacking. Lenis was not used.
- Reduced motion: final frames, no scroll linkage, no loops; filters apply instantly.

## Components
- `StageGauge`: reading progress as a stage gauge from 1400px wide; a thin accent line below that.
- `Email`: address assembled by script from reversed parts; readable "name [at] domain" without JS.
- Work filter (GSAP Flip) and Research network share the interest taxonomy in `src/content/interests.json`.

## Performance decisions
- Variable Newsreader (129 KB) replaced by three static weights (≈23 KB each) to bring mobile LCP under 2.5 s.
- Italic dropped (144 KB) for the same reason; emphasis uses colour and weight.
- Figure data for interaction (Fig. 2, all 21 sections) is fetched as static JSON instead of being inlined in HTML.

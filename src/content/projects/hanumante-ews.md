---
title: Flood early warning for the Hanumante River
status: In progress
summary: A HEC-RAS 2D rain-on-grid model of the Hanumante basin, paired with GRU and Bi-GRU surrogates that return discharge at 21 cross-sections in seconds. The physical model takes over an hour.
period: Ongoing
stack: [HEC-RAS 2D (rain on grid), GRU, Bi-GRU, Gaussian copula, GEV]
facts:
  - { label: Basin area, value: "~60", unit: km², source: brief 2026-10-11 }
  - { label: Gauge, value: Jagati, source: brief 2026-10-11 }
  - { label: Cross-sections predicted, value: 21, source: brief 2026-10-11 }
  - { label: Training events, value: "250 synthetic + 10 observed", source: brief 2026-10-11 }
  - { label: Physical model runtime, value: "over 1", unit: h, source: brief 2026-10-11 }
  - { label: Surrogate skill (mean NSE), value: "> 0.9", qualifier: current results, source: brief 2026-10-11 }
interests: [surrogate-modelling, early-warning]
visibility: public
featured: true
order: 1
source: brief 2026-10-11; research-statement.docx
---

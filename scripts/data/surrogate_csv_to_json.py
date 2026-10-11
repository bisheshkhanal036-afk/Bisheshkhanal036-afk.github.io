"""Hanumante surrogate run outputs -> src/data/hanumante/surrogate.json (Fig. 2).

Reads one run folder written by the surrogate training code:
  C01_combined_section_timeseries.csv  test-set series: event_id, section, t, Q_obs, Q_pred, ...
  C02_performance_metrics_detailed.csv per event and section: NSE_Q, KGE_Q, PeakErr_pct, TimeErr_h, ...
  C05_ews_thresholds.csv               per section: Watch_P75, Warning_P90, Danger_P97
  C07_model_overall_summary.csv        run summary (counts)

Q_obs in these files is HEC-RAS 2D output (the surrogate's training target), not gauge data,
so the output is labelled "simulated". The event shown is chosen without looking at the plot:
the held-out test event whose mean NSE over all sections is closest to the median.

Standard library only. Usage:
  python scripts/data/surrogate_csv_to_json.py "C:/HEC_RAS/GRU_surrogate_leadtime3_12864/csv_outputs" \
      src/data/hanumante/surrogate.json --lead 3 --model GRU
"""
import argparse
import csv
import datetime as dt
import json
import statistics as st
from collections import defaultdict
from pathlib import Path


def rows(path: Path):
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", type=Path, help="folder with the C0*.csv files")
    ap.add_argument("out", type=Path)
    ap.add_argument("--lead", type=int, required=True, help="forecast lead time in hours")
    ap.add_argument("--model", required=True)
    ap.add_argument("--event", help="force an event id instead of the median rule")
    a = ap.parse_args()

    series = defaultdict(lambda: defaultdict(list))
    for r in rows(a.run / "C01_combined_section_timeseries.csv"):
        series[r["event_id"]][r["section"]].append((int(r["t"]), float(r["Q_obs"]), float(r["Q_pred"])))

    metrics = defaultdict(dict)
    for r in rows(a.run / "C02_performance_metrics_detailed.csv"):
        metrics[r["event_id"]][r["section"]] = r

    thresholds = {r["section"]: r for r in rows(a.run / "C05_ews_thresholds.csv")}
    summary = rows(a.run / "C07_model_overall_summary.csv")[0]

    event_mean = {e: st.mean(float(m["NSE_Q"]) for m in secs.values()) for e, secs in metrics.items()}
    median = st.median(event_mean.values())
    event = a.event or min(event_mean, key=lambda e: abs(event_mean[e] - median))

    def order(name: str) -> int:
        return int(name.rsplit(" ", 1)[-1])

    sections = []
    for name in sorted(series[event], key=order):
        pts = sorted(series[event][name])
        m = metrics[event][name]
        th = thresholds[name]
        sections.append({
            "name": name,
            "qRef": [round(q, 2) for _, q, _ in pts],
            "qPred": [round(p, 2) for _, _, p in pts],
            "nse": round(float(m["NSE_Q"]), 3),
            "kge": round(float(m["KGE_Q"]), 3),
            "peakErrPct": round(float(m["PeakErr_pct"]), 1),
            "timeErrH": round(float(m["TimeErr_h"]), 1),
            "thresholds": {
                "watch": float(th["Watch_P75"]),
                "warning": float(th["Warning_P90"]),
                "danger": float(th["Danger_P97"]),
            },
        })

    out = {
        "source": f"{a.run.as_posix()} (C01, C02, C05, C07), processed {dt.date.today().isoformat()}",
        "status": "simulated",
        "reference": "HEC-RAS 2D",
        "model": a.model,
        "leadHours": a.lead,
        "stepHours": 1,
        "run": {"events": int(summary["n_events"]), "test": int(summary["n_test"])},
        "event": {
            "id": event,
            "rule": "held-out test event whose mean NSE across sections is closest to the median of all test events",
            "meanNse": round(event_mean[event], 3),
            "medianOfTestEvents": round(median, 3),
            "rangeOfTestEvents": [round(min(event_mean.values()), 3), round(max(event_mean.values()), 3)],
        },
        "sections": sections,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {a.out} ({a.out.stat().st_size / 1024:.1f} KB): event {event}, {len(sections)} sections")


if __name__ == "__main__":
    main()

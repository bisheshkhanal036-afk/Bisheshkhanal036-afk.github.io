"""Event CSV -> compact JSON for the Hanumante hydrograph (Fig. 2).

Input CSV columns: time (ISO or hours), rainfall_mm, q_obs, then one or more q_pred_<xs> columns.
Template: not yet run on real data. Do not run on content/source/ without permission.

Usage:
  python scripts/data/events_csv_to_json.py content/source/data/hanumante/event.csv \
      src/data/hanumante/event.json --xs 12
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--xs", help="cross-section id to keep (column q_pred_<xs>); default: all")
    ap.add_argument("--decimals", type=int, default=2)
    a = ap.parse_args()

    df = pd.read_csv(a.csv)
    if not pd.api.types.is_numeric_dtype(df["time"]):
        t = pd.to_datetime(df["time"])
        df["time"] = (t - t.iloc[0]).dt.total_seconds() / 3600.0

    pred_cols = [c for c in df.columns if c.startswith("q_pred_")]
    if a.xs:
        pred_cols = [f"q_pred_{a.xs}"]

    out = {
        "source": f"{a.csv.name}, processed {dt.date.today().isoformat()}",
        "status": "observed and simulated",  # q_obs is observed; q_pred_* are surrogate output
        "timeHours": df["time"].round(3).tolist(),
        "rainMm": df["rainfall_mm"].round(a.decimals).tolist(),
        "qObs": df["q_obs"].round(a.decimals).tolist(),
        "qPred": {c.removeprefix("q_pred_"): df[c].round(a.decimals).tolist() for c in pred_cols},
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {a.out} ({a.out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

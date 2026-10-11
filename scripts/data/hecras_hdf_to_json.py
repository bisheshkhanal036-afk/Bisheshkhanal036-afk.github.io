"""HEC-RAS 2D plan HDF -> coarse depth-class grid per timestep (Figs. 2 and 3).

Reads cell centres and depths from the 2D flow area, bins them onto a regular grid
(default 32 x 24), and stores a depth class (0 dry .. 3 deep) per cell per kept timestep.
HDF paths follow HEC-RAS 6.x; adjust --area and the paths below for other versions.
Template: not yet run on real data. Do not run on content/source/ without permission.

Usage:
  python scripts/data/hecras_hdf_to_json.py content/source/data/hanumante/model.p01.hdf \
      src/data/hanumante/depth_steps.json --area "Hanumante" --steps 12
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import h5py
import numpy as np

BASE = "Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas"
GEOM = "Geometry/2D Flow Areas"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("hdf", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--area", required=True, help="2D flow area name")
    ap.add_argument("--cols", type=int, default=32)
    ap.add_argument("--rows", type=int, default=24)
    ap.add_argument("--steps", type=int, default=12, help="timesteps to keep, evenly spaced")
    ap.add_argument("--breaks", default="0.05,0.5,1.5", help="depth class breaks in metres")
    a = ap.parse_args()

    with h5py.File(a.hdf, "r") as f:
        xy = f[f"{GEOM}/{a.area}/Cells Center Coordinate"][:]
        depth = f[f"{BASE}/{a.area}/Depth"][:]  # (time, cells)
        times = f["Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/Time"][:]

    n_cells = xy.shape[0]
    depth = depth[:, :n_cells]
    keep = np.linspace(0, depth.shape[0] - 1, a.steps).round().astype(int)
    x0, y0 = xy.min(axis=0)
    x1, y1 = xy.max(axis=0)
    ci = np.clip(((xy[:, 0] - x0) / (x1 - x0) * a.cols).astype(int), 0, a.cols - 1)
    ri = np.clip(((y1 - xy[:, 1]) / (y1 - y0) * a.rows).astype(int), 0, a.rows - 1)
    breaks = np.array([float(b) for b in a.breaks.split(",")])

    grids = []
    for k in keep:
        g = np.zeros((a.rows, a.cols))
        np.maximum.at(g, (ri, ci), depth[k])  # deepest cell in each bin
        grids.append(np.digitize(g, breaks).astype(int).tolist())  # 0 dry .. 3 deep

    out = {
        "source": f"{a.hdf.name} ({a.area}), processed {dt.date.today().isoformat()}",
        "status": "simulated",
        "grid": {"cols": a.cols, "rows": a.rows},
        "depthBreaksM": breaks.tolist(),
        "timeHours": [round(float(times[k]) * 24, 3) for k in keep],
        "classes": grids,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {a.out} ({a.out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

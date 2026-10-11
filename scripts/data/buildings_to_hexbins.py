"""Building footprints -> hex-bin counts per class (Fig. 3). Never emits points.

Each footprint is reduced to its centroid, assigned a class (from a column such as hazard
class H1..H6 or isolated/reachable), and counted into flat-topped hexagons of --size metres.
Hexes with fewer than --min-count buildings are dropped so no individual building can be
located. Output holds hex centres (in the same figure frame as vector_to_topojson.py) and
counts only.
Template: not yet run on real data. Do not run on content/source/ without permission.

Usage:
  python scripts/data/buildings_to_hexbins.py content/source/data/bagmati/buildings.shp \
      src/data/bagmati/hexbins.json --class-col hazard --frame content/source/data/bagmati/catchment.shp
"""
import argparse
import datetime as dt
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import geopandas as gpd


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--class-col", required=True)
    ap.add_argument("--frame", type=Path, required=True, help="catchment layer defining the figure frame")
    ap.add_argument("--crs", default="EPSG:32645")
    ap.add_argument("--size", type=float, default=500.0, help="hex radius in metres")
    ap.add_argument("--min-count", type=int, default=5)
    ap.add_argument("--width", type=float, default=640)
    ap.add_argument("--height", type=float, default=440)
    a = ap.parse_args()

    b = gpd.read_file(a.src).to_crs(a.crs)
    pts = b.geometry.centroid
    r = a.size
    bins: dict[tuple[int, int], Counter] = defaultdict(Counter)
    for p, cls in zip(pts, b[a.class_col].astype(str)):
        # axial coordinates for flat-topped hexes, rounded to the nearest hex
        q = (2 / 3 * p.x) / r
        rr = (-1 / 3 * p.x + math.sqrt(3) / 3 * p.y) / r
        x, z = q, rr
        y = -x - z
        rx, ry, rz = round(x), round(y), round(z)
        dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
        if dx > dy and dx > dz:
            rx = -ry - rz
        elif dy > dz:
            ry = -rx - rz
        else:
            rz = -rx - ry
        bins[(rx, rz)][cls] += 1

    frame = gpd.read_file(a.frame).to_crs(a.crs)
    minx, miny, maxx, maxy = frame.total_bounds
    s = min((a.width - 20) / (maxx - minx), (a.height - 20) / (maxy - miny))
    ox = (a.width - s * (maxx - minx)) / 2 - s * minx
    oy = (a.height + s * (maxy - miny)) / 2 + s * miny

    hexes = []
    for (q, rr), counts in bins.items():
        total = sum(counts.values())
        if total < a.min_count:
            continue  # privacy: too few buildings to show
        cx, cy = r * 3 / 2 * q, r * math.sqrt(3) * (rr + q / 2)
        hexes.append({"x": round(s * cx + ox, 1), "y": round(-s * cy + oy, 1), "n": total, "byClass": dict(counts)})

    out = {
        "source": f"{a.src.name}, hex radius {a.size:.0f} m, min {a.min_count} per hex, processed {dt.date.today().isoformat()}",
        "hexRadius": round(r * s, 2),
        "hexes": hexes,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {a.out}: {len(hexes)} hexes ({a.out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

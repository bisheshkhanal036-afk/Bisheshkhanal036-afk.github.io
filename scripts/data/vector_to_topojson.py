"""Shapefile / GeoJSON -> simplified GeoJSON in figure coordinates (Figs. 2-4).

Reprojects to a metric CRS, simplifies, then maps coordinates into a W x H box (default
640 x 440, matching the figures' SVG viewBox) and rounds to 0.1 units. Several layers can
share one frame with --frame (e.g. catchment boundary) so they line up.
Template: not yet run on real data. Do not run on content/source/ without permission.

Usage:
  python scripts/data/vector_to_topojson.py content/source/data/bagmati/catchment.shp \
      src/data/bagmati/catchment.json --frame content/source/data/bagmati/catchment.shp
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import geopandas as gpd
from shapely.affinity import affine_transform


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--frame", type=Path, help="layer whose bounds define the figure frame (default: src)")
    ap.add_argument("--crs", default="EPSG:32645", help="metric CRS (UTM 45N covers Kathmandu)")
    ap.add_argument("--tolerance", type=float, default=50.0, help="simplify tolerance in metres")
    ap.add_argument("--width", type=float, default=640)
    ap.add_argument("--height", type=float, default=440)
    ap.add_argument("--keep", default="", help="comma-separated attribute columns to keep")
    a = ap.parse_args()

    gdf = gpd.read_file(a.src).to_crs(a.crs)
    frame = gpd.read_file(a.frame).to_crs(a.crs) if a.frame else gdf
    minx, miny, maxx, maxy = frame.total_bounds
    s = min((a.width - 20) / (maxx - minx), (a.height - 20) / (maxy - miny))
    ox = (a.width - s * (maxx - minx)) / 2 - s * minx
    oy = (a.height + s * (maxy - miny)) / 2 + s * miny  # flip y: SVG grows downward

    gdf["geometry"] = gdf.geometry.simplify(a.tolerance, preserve_topology=True).apply(
        lambda g: affine_transform(g, [s, 0, 0, -s, ox, oy])
    )
    keep = [c for c in a.keep.split(",") if c]
    gdf = gdf[keep + ["geometry"]]
    data = json.loads(gdf.to_json(drop_id=True))

    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 1), round(c[1], 1)]

    for feat in data["features"]:
        feat["geometry"]["coordinates"] = rnd(feat["geometry"]["coordinates"])
    data["source"] = f"{a.src.name}, simplified {a.tolerance} m, processed {dt.date.today().isoformat()}"
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(data, separators=(",", ":")))
    size = a.out.stat().st_size / 1024
    print(f"wrote {a.out} ({size:.1f} KB)")
    if size > 200:
        raise SystemExit("output over 200 KB: raise --tolerance")


if __name__ == "__main__":
    main()

"""GeoTIFF -> small 8-bit PNG (+ JSON with value range) for Figs. 2 and 6.

Resamples to at most --max px on the long side (block mean), scales values to 0-255 between
the given or 2nd/98th-percentile limits, and writes a grayscale PNG. Figures apply their own
colour ramp in the browser. For FloodHUB criterion layers use --invert where low values mean
higher flood risk (e.g. elevation, slope, distance to river).
Template: not yet run on real data. Do not run on content/source/ without permission.

Usage:
  python scripts/data/raster_to_png.py content/source/data/floodhub/dem.tif src/data/floodhub/elev.png --max 64 --invert
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--max", type=int, default=64)
    ap.add_argument("--lo", type=float)
    ap.add_argument("--hi", type=float)
    ap.add_argument("--invert", action="store_true")
    a = ap.parse_args()

    img = Image.open(a.src)  # GeoTIFF single band; use rasterio instead if PIL cannot read it
    arr = np.asarray(img, dtype="float64")
    arr[arr < -1e30] = np.nan  # common nodata values
    h, w = arr.shape
    f = max(1, int(np.ceil(max(h, w) / a.max)))
    arr = arr[: h - h % f, : w - w % f].reshape(h // f, f, w // f, f)
    arr = np.nanmean(arr, axis=(1, 3))

    lo = a.lo if a.lo is not None else float(np.nanpercentile(arr, 2))
    hi = a.hi if a.hi is not None else float(np.nanpercentile(arr, 98))
    scaled = np.clip((arr - lo) / (hi - lo), 0, 1)
    if a.invert:
        scaled = 1 - scaled
    out8 = np.nan_to_num(scaled * 255).astype("uint8")

    a.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out8, mode="L").save(a.out, optimize=True)
    meta = {
        "source": f"{a.src.name}, block mean x{f}, processed {dt.date.today().isoformat()}",
        "range": [lo, hi],
        "inverted": a.invert,
        "size": list(out8.shape[::-1]),
    }
    a.out.with_suffix(".json").write_text(json.dumps(meta))
    print(f"wrote {a.out} {out8.shape[1]}x{out8.shape[0]} ({a.out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

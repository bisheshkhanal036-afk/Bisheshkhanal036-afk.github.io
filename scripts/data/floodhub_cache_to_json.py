"""FloodHUB cached AHP run -> src/data/floodhub/layers.json (Fig. 6).

Runs INSIDE the FloodHUB backend container (it has numpy/rasterio and sees the cache at
/app/data). Reads one cached risk surface and its reclassified criterion rasters
(classes 1-5, 0 = outside the AOI), and writes JSON to stdout:

- every criterion block-averaged to a coarse grid (blocks with < 50% valid cells masked),
- the risk surface block-averaged the same way,
- the AHP weights of that run, recovered by least squares from 4 R_norm + 1 = sum(w_i * class_i)
  (the cache stores the surface but not the weights); the fit residual is reported.

Read-only on the cache. Usage (from the website repo, FloodHUB running):
  docker exec -i academiccv_bishesh-backend-1 python - 2e9c3f4b02 56 \
      < scripts/data/floodhub_cache_to_json.py > src/data/floodhub/layers.json
"""
import base64
import datetime as dt
import glob
import json
import os
import pickle
import sys

import numpy as np
import rasterio
from rasterio.warp import transform_bounds

AOI = sys.argv[1]           # AOI hash prefix in the cache
BLOCK = int(sys.argv[2])    # block size in cells (10 m each)
CACHE = "/app/data/cache/processed"
LABELS = {
    "dem_elevation": "Elevation", "dem_slope": "Slope", "twi": "Topographic Wetness Index",
    "precipitation_chirps": "Rainfall (CHIRPS)", "dist_to_river": "Distance to river",
    "drainage_density": "Drainage density", "worldcover_land_cover": "Land cover",
    "ndvi": "Vegetation (NDVI)", "dist_to_road": "Distance to road",
    "building_density": "Building density", "population_density": "Population density",
}

pkl = glob.glob(f"{CACHE}/risk_surface/*{AOI}*.pkl")[0]
rs, attribution, _, crits = pickle.load(open(pkl, "rb"))
R = rs.risk_surface.astype("float64")
valid = R != rs.nodata
ids = [c.criterion_id for c in crits]
C = np.stack([c.reclassified for c in crits]).astype("float64")  # (k, h, w)

# Recover weights: least squares on a sample of valid cells (exact linear model).
rng = np.random.default_rng(0)
yy, xx = np.nonzero(valid)
pick = rng.choice(len(yy), size=min(200_000, len(yy)), replace=False)
A = C[:, yy[pick], xx[pick]].T
# FloodHUB stores R_norm = (sum(w_i * class_i) - 1) / 4 (overlay/compute.py), so fit 4 R + 1.
b = 4 * R[yy[pick], xx[pick]] + 1
w, *_ = np.linalg.lstsq(A, b, rcond=None)
resid = float(np.max(np.abs(A @ w - b)))

# Block-average onto a coarse grid.
h, wd = R.shape
H, W = h // BLOCK, wd // BLOCK
def blocks(a, m):
    a = a[: H * BLOCK, : W * BLOCK].reshape(H, BLOCK, W, BLOCK)
    m = m[: H * BLOCK, : W * BLOCK].reshape(H, BLOCK, W, BLOCK)
    s = (a * m).sum(axis=(1, 3))
    n = m.sum(axis=(1, 3))
    out = np.where(n >= 0.5 * BLOCK * BLOCK, s / np.maximum(n, 1), np.nan)
    return out
mask = blocks(np.ones_like(R), valid.astype("float64"))
keep = ~np.isnan(mask)

def enc(arr, lo, hi):
    """Scale to 1..255 (0 = outside AOI), base64."""
    q = np.where(keep, np.clip(np.round(1 + 254 * (arr - lo) / (hi - lo)), 1, 255), 0).astype("uint8")
    return base64.b64encode(q.tobytes()).decode()

risk = blocks(R, valid.astype("float64"))
rlo, rhi = float(np.nanmin(risk)), float(np.nanmax(risk))
grid = crits[0].grid
with rasterio.open(glob.glob(f"{CACHE}/criterion_rasters/{AOI}*_dem_elevation.tif")[0]) as src:
    lonlat = [round(v, 4) for v in transform_bounds(src.crs, "EPSG:4326", *src.bounds)]

out = {
    "source": f"FloodHUB cache {os.path.basename(pkl)[:16]}... (AOI {AOI}), cached {dt.date.fromtimestamp(os.path.getmtime(pkl)).isoformat()}, exported {dt.date.today().isoformat()}",
    "status": "computed",
    "aoi": {"hybasId": 4080848980, "level": 8, "lonlat": lonlat, "crs": grid.crs, "resolutionM": grid.resolution_m * BLOCK},
    "grid": {"w": W, "h": H, "blockCells": BLOCK, "nativeResolutionM": grid.resolution_m},
    "classScale": "criterion values are block means of classes 1-5 scaled to 1-255; 0 = outside the basin",
    "weightsRecovery": {"method": "least squares on 200k cells, 4 R_norm + 1 = sum(w_i * class_i) (FloodHUB overlay/compute.py)", "maxAbsResidual": resid},
    "criteria": [
        {"id": i, "label": LABELS.get(i, i), "weight": round(float(wi), 4), "values": enc(blocks(C[k], valid.astype("float64")), 1, 5)}
        for k, (i, wi) in enumerate(zip(ids, w))
    ],
    "risk": {"values": enc(risk, rlo, rhi), "range": [round(rlo, 3), round(rhi, 3)]},
    "attribution": attribution,
}
json.dump(out, sys.stdout, separators=(",", ":"))

"""FloodHUB cached run -> src/data/floodhub/steps.json (Fig. 6, steps 5-8).

Runs INSIDE the FloodHUB backend container. Uses FloodHUB's own functions on the cached
risk surface of one run (compute_overlay is replaced in-process by the cached result, so
nothing is recomputed and FloodHUB's code is not modified):

  5 Vulnerability report  hazard classes (block majority on the web grid), per-class area,
                          population and building counts (FloodHUB zonal stats), and a grid
                          of High-class building counts. Buildings never leave as points:
                          cells with fewer than MIN_BUILDINGS buildings are dropped.
  6 Validate              success-rate curve, AUC and frequency ratio against each
                          validation event that overlaps the basin.
  7 Compare to METEOR     the same against METEOR's modelled flood hazard.
  8 Shelters              the screening funnel (counts only, no locations).

Read-only on the cache. Usage (from the website repo, FloodHUB running):
  docker exec -i -w /app academiccv_bishesh-backend-1 python - 2e9c3f4b02 4080848980 56 \
      < scripts/data/floodhub_steps_to_json.py > src/data/floodhub/steps.json
"""
import base64
import dataclasses
import datetime as dt
import glob
import json
import pickle
import sys

import numpy as np
from shapely.geometry import shape  # noqa: F401  (geometry objects come from the pickle)

from app.data import config
from app.data.basins import basin_to_aoi
from app.overlay import meteor_comparison, shelters, validate
from app.overlay.hazard_classes import risk_surface_to_hazard_classes
from app.overlay.service import OverlayResult

AOI_KEY, HYBAS, BLOCK = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
MIN_BUILDINGS = 5
C = "/app/data/cache/processed"

rs, attribution, warnings, crits = pickle.load(open(glob.glob(f"{C}/risk_surface/*{AOI_KEY}*.pkl")[0], "rb"))
cached = OverlayResult(cache_key=AOI_KEY, risk_surface=rs, data_url="", attribution=attribution,
                       source_warnings=warnings, criterion_rasters=crits)
for m in (validate, meteor_comparison, shelters):
    m.compute_overlay = lambda *a, **k: cached  # reuse the cached run; never recompute
aoi = basin_to_aoi(HYBAS, 8)

# Hazard classes on the native grid, then block majority on the web grid.
classes = risk_surface_to_hazard_classes(rs.risk_surface, rs.nodata)
h, w = classes.shape
H, W = h // BLOCK, w // BLOCK
cb = classes[: H * BLOCK, : W * BLOCK].reshape(H, BLOCK, W, BLOCK).transpose(0, 2, 1, 3).reshape(H, W, -1)
major = np.zeros((H, W), dtype="uint8")
for k in range(1, 6):
    cnt = (cb == k).sum(axis=2)
    best = (cb == major[..., None]).sum(axis=2) if k > 1 else np.zeros((H, W))
    major = np.where(cnt > best, k, major)
major = np.where((cb > 0).sum(axis=2) >= 0.5 * BLOCK * BLOCK, major, 0).astype("uint8")

# Report core: zonal stats + buildings classified by hazard class.
core = pickle.load(open(glob.glob(f"{C}/vulnerability_report_core/*{AOI_KEY}*.pkl")[0], "rb"))
zonal = [{"class": z.hazard_class, "label": z.hazard_label, "areaKm2": round(z.area_km2, 2),
          "population": round(z.population), "buildings": z.building_count} for z in core.zonal_stats]

# Building exposure grid (counts only). Grid transform from the AOI grid (UTM 45N).
from pyproj import Transformer  # noqa: E402
g = crits[0].grid
to_utm = Transformer.from_crs("EPSG:4326", g.crs, always_xy=True)
total = np.zeros((H, W), dtype="int64")
high = np.zeros((H, W), dtype="int64")
for b in core.buildings:
    if b.hazard_class is None:
        continue
    c = b.geometry.centroid
    x, y = to_utm.transform(c.x, c.y)
    col = int((x - g.origin_x) / (g.resolution_m * BLOCK))
    row = int((g.origin_y - y) / (g.resolution_m * BLOCK))
    if 0 <= row < H and 0 <= col < W:
        total[row, col] += 1
        if b.hazard_class >= 4:
            high[row, col] += 1
ok = total >= MIN_BUILDINGS
high_share = np.where(ok, high / np.maximum(total, 1), np.nan)
share_bytes = np.where(ok, np.clip(np.round(1 + 254 * np.nan_to_num(high_share)), 1, 255), 0).astype("uint8")

def curve(sr):
    pts = [p for i, p in enumerate(sr.curve) if i % 5 == 0 or i == len(sr.curve) - 1]
    return [[round(a, 3), round(b, 4)] for a, b in pts]

def fr(by_class):
    return [{"class": c.hazard_class, "label": c.hazard_label, "pixels": c.pixel_count,
             "flooded": c.flooded_pixel_count,
             "fraction": None if c.flooded_fraction is None else round(c.flooded_fraction, 6)} for c in by_class]

validation = []
for ev, meta in config.VALIDATION_EVENTS.items():
    try:
        r = validate.validate_risk_surface(aoi, [], {}, True, ev)
    except Exception:  # event does not overlap this basin
        continue
    validation.append({"event": ev, "label": meta["label"], "auc": round(r.success_rate.auc, 3),
                       "observedCells": r.success_rate.n_observed_flooded_pixels,
                       "curve": curve(r.success_rate), "byClass": fr(r.frequency_ratio.by_class),
                       "monotonic": r.frequency_ratio.monotonic})

m = meteor_comparison.compare_risk_surface_to_meteor(aoi, [], {}, True)
meteor = {"floodType": m.meteor_flood_type, "returnPeriod": m.meteor_return_period, "auc": round(m.success_rate.auc, 3),
          "floodedFraction": round(m.success_rate.observed_flooded_fraction, 4),
          "curve": curve(m.success_rate), "byClass": fr(m.frequency_ratio.by_class), "monotonic": m.frequency_ratio.monotonic}

s = shelters.identify_shelter_sites(aoi, [], {}, True)
shelter = {"totalBuildings": s.total_buildings_in_aoi, "excludedTooSmall": s.excluded_too_small,
           "excludedHighHazard": s.excluded_high_hazard, "excludedNoData": s.excluded_no_data,
           "candidates": len(s.candidates),
           "minFootprintM2": config.SHELTER_MIN_FOOTPRINT_AREA_M2}

credits = sorted(set(attribution) | set(getattr(m, "attribution", []) or []) | set(getattr(s, "attribution", []) or []))
out = {
    "source": f"FloodHUB cache, AOI key {AOI_KEY}, HydroBASINS {HYBAS}; FloodHUB functions run on the cached risk surface, exported {dt.date.today().isoformat()}",
    "grid": {"w": W, "h": H},
    "hazard": {"labels": {1: "Very Low", 2: "Low", 3: "Moderate", 4: "High", 5: "Very High"},
               "classes": base64.b64encode(major.tobytes()).decode()},
    "report": {"zonal": zonal, "buildingsTotal": len(core.buildings),
               "highShareGrid": base64.b64encode(share_bytes.tobytes()).decode(),
               "highShareNote": f"share of buildings in High or Very High class per cell; cells with fewer than {MIN_BUILDINGS} buildings omitted"},
    "validation": validation,
    "meteor": meteor,
    "shelters": shelter,
    "credits": credits,
}
json.dump(out, sys.stdout, separators=(",", ":"))

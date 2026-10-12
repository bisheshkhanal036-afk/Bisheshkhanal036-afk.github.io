"""FloodHUB cache -> src/data/floodhub/world.json: geography for the Bagmati stand-in figures.

Runs INSIDE the FloodHUB backend container, read-only on its cache, for one basin
(HydroBASINS level 8, the basin around the Kathmandu Valley). Writes JSON to stdout:

  outline   basin polygon in figure units (simplified)
  rivers    OSM waterways (simplified), figure units
  roads     longer OSM road segments (simplified), figure units: a proxy for main roads,
            since the cache keeps geometry only
  hillshade 8-bit hillshade from the Copernicus GLO-30 DEM, base64, for the basemap
  hexes     pointy-top hexagons over the basin, each with:
              risk   mean FloodHUB risk (0-1)
              high   share of the hex in the High or Very High hazard class
              meteor share METEOR (1-in-100 fluvial, defended) floods
              elev   mean elevation (m)
              b      building count, aggregated; 0 when fewer than MIN_BUILDINGS
  Individual buildings never leave the container.

Usage (from the website repo, FloodHUB running):
  docker exec -i -w /app academiccv_bishesh-backend-1 python - 2e9c3f4b02 9c35cb59 4080848980 \
      < scripts/data/floodhub_world_to_json.py > src/data/floodhub/world.json
"""
import base64
import datetime as dt
import glob
import json
import math
import pickle
import sys

import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, mapping
from shapely.ops import transform as shp_transform

from app.data.basins import basin_to_aoi
from app.overlay.hazard_classes import risk_surface_to_hazard_classes

RUN_KEY, AOI_KEY, HYBAS = sys.argv[1], sys.argv[2], int(sys.argv[3])
C = "/app/data/cache/processed"
R_HEX = 650.0          # hex radius, metres
MIN_BUILDINGS = 5
FIG_W = 640.0

load = lambda d, k: pickle.load(open(glob.glob(f"{C}/{d}/{k}*")[0], "rb"))
rs, _attr, _w, crits = pickle.load(open(glob.glob(f"{C}/risk_surface/*{RUN_KEY}*.pkl")[0], "rb"))
g = crits[0].grid
risk = rs.risk_surface
valid = risk != rs.nodata
classes = risk_surface_to_hazard_classes(risk, rs.nodata)
dem = load("dem", AOI_KEY)
from app.data.meteor_flood import get_meteor_flood_hazard  # noqa: E402
aoi = basin_to_aoi(HYBAS, 8)
mf = get_meteor_flood_hazard(aoi)
meteor = ((mf.depth_m > 0) & (mf.depth_m != mf.nodata))

to_utm = Transformer.from_crs("EPSG:4326", g.crs, always_xy=True).transform
poly = shp_transform(to_utm, aoi.polygon)
minx, miny, maxx, maxy = poly.bounds
s = FIG_W / (maxx - minx)
FIG_H = round((maxy - miny) * s, 1)
fig = lambda x, y: (round((x - minx) * s, 1), round((maxy - y) * s, 1))

def path_of(geom, tol):
    geom = geom.simplify(tol, preserve_topology=False)
    out = []
    def coords(cs):
        pts = [fig(x, y) for x, y in cs]
        if len(pts) > 1:
            out.append("M" + "L".join(f"{a},{b}" for a, b in pts))
    gj = mapping(geom)
    t = gj["type"]
    if t == "LineString": coords(gj["coordinates"])
    elif t == "MultiLineString": [coords(c) for c in gj["coordinates"]]
    elif t == "Polygon": [coords(r) for r in gj["coordinates"]]
    elif t == "MultiPolygon": [coords(r) for p in gj["coordinates"] for r in p]
    return "".join(out)

outline = path_of(poly, 120) + "Z"
ww = load("osm_waterways", AOI_KEY).waterways.to_crs(g.crs)
rivers = "".join(path_of(geom.intersection(poly), 60) for geom in ww.geometry if not geom.is_empty and geom.intersects(poly))
rd = load("osm", AOI_KEY).roads.to_crs(g.crs)
rd = rd[rd.geometry.length > 1500]
roads = "".join(path_of(geom.intersection(poly), 80) for geom in rd.geometry if geom.intersects(poly))

# Hillshade from the DEM at ~100 m.
z = dem.elevation_m.astype("float64")
k = 10
h2, w2 = z.shape[0] // k, z.shape[1] // k
zc = z[: h2 * k, : w2 * k].reshape(h2, k, w2, k).mean(axis=(1, 3))
gy, gx = np.gradient(zc, g.resolution_m * k)
slope = np.arctan(np.hypot(gx, gy))
aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(45)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
hs8 = np.clip(hs * 255, 0, 255).astype("uint8")

# Hex grid over the basin (pointy-top), sampling the 10 m rasters at hex cells.
hw, hh = math.sqrt(3) * R_HEX, 1.5 * R_HEX
row = lambda y: int((g.origin_y - y) / g.resolution_m)
col = lambda x: int((x - g.origin_x) / g.resolution_m)

# Building counts per hex (centroids only, inside the container).
core = pickle.load(open(glob.glob(f"{C}/vulnerability_report_core/*{RUN_KEY}*.pkl")[0], "rb"))
to_utm_t = Transformer.from_crs("EPSG:4326", g.crs, always_xy=True)
hex_of = {}
def hex_index(x, y):
    r = round((maxy - y) / hh)
    q = round((x - minx - (hw / 2 if r % 2 else 0)) / hw)
    return q, r
counts = {}
for b in core.buildings:
    c = b.geometry.centroid
    x, y = to_utm_t.transform(c.x, c.y)
    key = hex_index(x, y)
    counts[key] = counts.get(key, 0) + 1

hexes = []
rr = 0
while maxy - rr * hh > miny - hh:
    cy = maxy - rr * hh
    q = 0
    while minx + q * hw < maxx + hw:
        cx = minx + q * hw + (hw / 2 if rr % 2 else 0)
        if poly.contains(Point(cx, cy)):
            r0, r1 = max(0, row(cy + R_HEX * 0.8)), min(g.height, row(cy - R_HEX * 0.8))
            c0, c1 = max(0, col(cx - R_HEX * 0.8)), min(g.width, col(cx + R_HEX * 0.8))
            v = valid[r0:r1, c0:c1]
            if v.sum() > 20:
                cls = classes[r0:r1, c0:c1][v]
                n = counts.get((q, rr), 0)
                fx, fy = fig(cx, cy)
                hexes.append({
                    "x": fx, "y": fy,
                    "risk": round(float(risk[r0:r1, c0:c1][v].mean()), 3),
                    "high": round(float((cls >= 4).mean()), 3),
                    "meteor": round(float(meteor[r0:r1, c0:c1][v].mean()), 3),
                    "elev": round(float(z[r0:r1, c0:c1][v].mean())),
                    "b": int(n) if n >= MIN_BUILDINGS else 0,
                })
        q += 1
    rr += 1

out = {
    "source": f"FloodHUB cache (run {RUN_KEY}, basin {HYBAS}); exported {dt.date.today().isoformat()}",
    "size": {"w": FIG_W, "h": FIG_H},
    "hexRadius": round(R_HEX * s, 2),
    "outline": outline,
    "rivers": rivers,
    "roads": roads,
    "hillshade": {"w": int(w2), "h": int(h2), "data": base64.b64encode(hs8.tobytes()).decode()},
    "hexes": hexes,
    "notes": f"hex radius {R_HEX:.0f} m; building counts under {MIN_BUILDINGS} set to 0; roads = OSM segments over 1.5 km",
}
json.dump(out, sys.stdout, separators=(",", ":"))

"""Narayani gauges -> src/data/narayani/storm.json: data for Fig. 7, "What a district mean hides".

Runs INSIDE the FloodHUB backend container (for geopandas, rasterio and its HydroBASINS and
district layers), reading copies placed in /tmp/nar:
  station_metadata.csv, station_daily_precipitation.csv   (paper pipeline, data/processed)
  srtm.tif                                                (SRTMGL1 mosaic, rasters_SRTMGL1)

Writes JSON to stdout:
  outline    Narayani basin: HydroBASINS level-8 units upstream of the outlet near Triveni
  districts  district outlines clipped to the basin, for the districts that hold gauges
  hillshade  8-bit hillshade, base64
  gauges     id, name, district, x, y, elevation (public DHM station metadata)
  days       ISO dates of the storm window
  rain       mm per gauge per day (observed, rounded to 0.1 mm; null where missing)
No result statistics from the manuscript are exported.

Usage (from the website repo, FloodHUB running, files copied to /tmp/nar):
  docker exec -i -w /app academiccv_bishesh-backend-1 python - 2003-07-27 2003-08-04 \
      < scripts/data/narayani_to_json.py > src/data/narayani/storm.json
"""
import base64
import datetime as dt
import json
import math
import sys

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from shapely.geometry import Point, mapping
from shapely.ops import unary_union

from app.data import basins, districts

D0, D1 = sys.argv[1], sys.argv[2]
OUTLET = (83.92, 27.46)  # Narayani at the Nepal-India border (Triveni)
FIG_W = 640.0
UTM = "+proj=tmerc +lon_0=84.3 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m"  # centred on the basin, so the lon/lat hillshade stays square

# Basin: walk NEXT_DOWN upstream from the unit holding the outlet.
hb = basins._load_basins(8)
start = hb[hb.contains(Point(OUTLET))].iloc[0].HYBAS_ID
up = {}
for hid, nd in zip(hb.HYBAS_ID, hb.NEXT_DOWN):
    up.setdefault(nd, []).append(hid)
ids, stack = set(), [start]
while stack:
    h = stack.pop()
    if h in ids:
        continue
    ids.add(h)
    stack.extend(up.get(h, []))
basin = unary_union(hb[hb.HYBAS_ID.isin(ids)].geometry).buffer(0)
basin_utm = gpd.GeoSeries([basin], crs=4326).to_crs(UTM).iloc[0]
minx, miny, maxx, maxy = basin_utm.bounds
s = FIG_W / (maxx - minx)
FIG_H = round((maxy - miny) * s, 1)
fig = lambda x, y: (round((x - minx) * s, 1), round((maxy - y) * s, 1))

def path_of(geom, tol):
    geom = geom.simplify(tol, preserve_topology=True)
    out = []
    def ring(cs):
        pts = [fig(x, y) for x, y in cs]
        if len(pts) > 2:
            out.append("M" + "L".join(f"{a},{b}" for a, b in pts) + "Z")
    gj = mapping(geom)
    polys = [gj["coordinates"]] if gj["type"] == "Polygon" else gj["coordinates"] if gj["type"] == "MultiPolygon" else []
    for p in polys:
        for r in p:
            ring(r)
    return "".join(out)

# Gauges and rainfall.
meta = pd.read_csv("/tmp/nar/station_metadata.csv")
rain = pd.read_csv("/tmp/nar/station_daily_precipitation.csv", parse_dates=["Date"]).set_index("Date")
win = rain.loc[D0:D1]
pts = gpd.GeoSeries([Point(xy) for xy in zip(meta.longitude, meta.latitude)], crs=4326).to_crs(UTM)
gauges = []
for (_, m), p in zip(meta.iterrows(), pts):
    x, y = fig(p.x, p.y)
    col = str(m.station_id)
    vals = [None if pd.isna(v) else round(float(v), 1) for v in win[col]] if col in win else [None] * len(win)
    gauges.append({"id": int(m.station_id), "name": m.station_name, "district": m.district,
                   "x": x, "y": y, "elev": int(m.elevation_m), "rain": vals})

# Districts with gauges, clipped to the basin. COD-AB splits a few old districts; merge by prefix.
dg = districts._load_districts().to_crs(UTM)
name_col = districts.NAME_COLUMN
wanted = sorted(set(meta.district))
dout = []
for name in wanted:
    key = name.lower()[:4]
    sel = dg[dg[name_col].str.lower().str.replace(" ", "").str.startswith(key)]
    if name == "Nawalparasi":
        sel = dg[dg[name_col].str.lower().str.contains("nawal")]
    if sel.empty:
        print(f"no district polygon for {name}", file=sys.stderr)
        continue
    geom = unary_union(sel.geometry)
    clip = geom.intersection(basin_utm)
    c = clip.representative_point() if not clip.is_empty else geom.representative_point()
    cx, cy = fig(c.x, c.y)
    dout.append({"name": name, "d": path_of(clip if not clip.is_empty else geom, 400),
                 "cx": cx, "cy": cy, "inBasin": round(clip.area / geom.area, 2)})

# Hillshade over the basin bounds (~500 m).
with rasterio.open("/tmp/nar/srtm.tif") as src:
    lon0, lat0, lon1, lat1 = basin.bounds
    wnd = from_bounds(lon0, lat0, lon1, lat1, src.transform)
    k = 18
    out_h, out_w = int(wnd.height // k), int(wnd.width // k)
    z = src.read(1, window=wnd, out_shape=(out_h, out_w), resampling=Resampling.average, boundless=True, fill_value=0).astype("float64")
lat_mid = math.radians((lat0 + lat1) / 2)
dy = (lat1 - lat0) / out_h * 111320
dx = (lon1 - lon0) / out_w * 111320 * math.cos(lat_mid)
gy, gx = np.gradient(z, dy, dx)
slope = np.arctan(np.hypot(gx, gy) * 1.6)
aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(45)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
hs8 = np.clip(hs * 255, 0, 255).astype("uint8")
# The hillshade is in lon/lat; give its corners in figure units so the SVG can place it.
corners = gpd.GeoSeries([Point(lon0, lat1), Point(lon1, lat0)], crs=4326).to_crs(UTM)
(hx0, hy0), (hx1, hy1) = fig(corners.iloc[0].x, corners.iloc[0].y), fig(corners.iloc[1].x, corners.iloc[1].y)

out = {
    "source": f"Narayani paper pipeline (data/processed, DHM gauges); HydroBASINS L8; COD-AB districts; SRTMGL1; exported {dt.date.today().isoformat()}",
    "size": {"w": FIG_W, "h": FIG_H},
    "outline": path_of(basin_utm, 600),
    "districts": dout,
    "hillshade": {"w": int(out_w), "h": int(out_h), "box": [hx0, hy0, hx1, hy1], "data": base64.b64encode(hs8.tobytes()).decode()},
    "days": [d.strftime("%Y-%m-%d") for d in win.index],
    "gauges": gauges,
}
json.dump(out, sys.stdout, separators=(",", ":"))
print(f"basin units {len(ids)}, area {basin_utm.area/1e6:.0f} km2, districts {len(dout)}/{len(wanted)}, hillshade {out_w}x{out_h}", file=sys.stderr)

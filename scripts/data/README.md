# Data preparation templates

Python scripts that turn model outputs into the small files the figures read from `src/data/`.
They are templates: **none has been run on real data yet**, and none should be run on
`content/source/` without Bishesh's go-ahead.

Requirements: Python 3.11+, `pip install numpy pandas h5py geopandas shapely pillow`.

| Script | Input (in `content/source/data/<slug>/`) | Output (in `src/data/<slug>/`) | Used by (planned unless stated) |
|---|---|---|---|
| `events_csv_to_json.py` | event CSV: `time, rainfall_mm, q_obs, q_pred_<xs>...` | `event.json` (rounded series) | Fig. 2 hydrograph |
| `hecras_hdf_to_json.py` | HEC-RAS 2D plan HDF (`*.p01.hdf`) | `depth_steps.json` (cell depth classes on a coarse grid per timestep) | Fig. 2 grid, Fig. 3 depth |
| `vector_to_topojson.py` | shapefile / GeoJSON (catchment, centreline, cross-sections, extents, service areas, routes) | simplified GeoJSON in figure coordinates | Figs. 2–4 |
| `buildings_to_hexbins.py` | building footprints + hazard class or depth raster | `hexbins.json` (counts per hex per class; **no points**) | Fig. 3 |
| `raster_to_png.py` | GeoTIFF (DEM, depth, criterion layers) | small 8-bit PNGs, max 128 px | Figs. 2, 6 |
| `surrogate_csv_to_json.py` | surrogate run folder (`C01`, `C02`, `C05`, `C07` CSVs) | `hanumante/surrogate.json` (one test event, 21 sections, metrics, warning levels) | Fig. 2 (run 2026-10-11 on `GRU_surrogate_leadtime3_12864`, with permission) |

Rules the scripts enforce:
- Building data leaves only as hex-bin counts; hexes with fewer than `--min-count` (default 5) buildings are merged or dropped, so no single building can be located.
- Geometry is simplified (`--tolerance`) and coordinates are rounded; every output file stays under 200 KB.
- Each output carries a `source` field naming the input file and the date it was processed.


Captions must name the real data source and status (`observed` or `simulated`).

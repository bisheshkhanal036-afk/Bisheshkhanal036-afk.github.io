// Static JSON for Fig. 6 (real FloodHUB layers), fetched by the figure script so the page HTML stays small.
import { buildLayers } from '../../lib/schematic/floodhub-layers';

export function GET() {
  const { payload, layerPngs } = buildLayers();
  return new Response(JSON.stringify({ ...payload, pngs: layerPngs }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

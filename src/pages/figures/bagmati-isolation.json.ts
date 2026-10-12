// Per-step state for Fig. 3 (codes, service outlines, routes), fetched by isolation.ts.
import { buildWorld } from '../../lib/schematic/catchment-world';

export function GET() {
  const w = buildWorld();
  return new Response(JSON.stringify({
    codes: w.steps.map((s) => s.code),
    service: w.steps.map((s) => s.service),
    routes: w.steps.map((s) => s.routes),
    t: w.steps.map((s) => s.t),
    T: w.hydro.flow.length,
    peak: w.peakStep,
  }), { headers: { 'Content-Type': 'application/json' } });
}

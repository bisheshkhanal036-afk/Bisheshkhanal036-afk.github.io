// Static JSON for Fig. 2, fetched by the figure script so section switching needs no inline data.
import data from '../../data/hanumante/surrogate.json';

export function GET() {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

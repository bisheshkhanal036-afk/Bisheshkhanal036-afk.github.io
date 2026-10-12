// Hillshade basemap for Fig. 7 (Narayani), from the SRTMGL1 mosaic in the paper folder.
import storm from '../../data/narayani/storm.json';
import { pngBytes } from '../../lib/schematic/png';

export function GET() {
  const { w: w0, h: h0, data } = storm.hillshade;
  const g0 = Buffer.from(data, 'base64');
  // Halve the resolution (2x2 mean): it is a soft background.
  const w = Math.floor(w0 / 2), h = Math.floor(h0 / 2);
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 2 * y * w0 + 2 * x;
    g[y * w + x] = (g0[i] + g0[i + 1] + g0[i + w0] + g0[i + w0 + 1]) >> 2;
  }
  // Grey shading as a dark overlay: alpha carries the shadow, so it sits on any background.
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px.set([28, 32, 35, Math.max(0, Math.min(255, Math.round((200 - g[i]) * 1.1)))], i * 4);
  }
  return new Response(Buffer.from(pngBytes(w, h, px)), { headers: { 'Content-Type': 'image/png' } });
}

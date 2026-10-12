// Mirror of timeline.ts layout() to write WebVTT cues at the edit's real times.
import fs from 'node:fs';
const marks = JSON.parse(fs.readFileSync('remotion/marks.json', 'utf8')).marks;
const src = fs.readFileSync('remotion/timeline.ts', 'utf8');
const num = (k) => Number(src.match(new RegExp(`export const ${k} = ([0-9.]+)`))[1]);
const FPS = num('FPS'), INTRO = num('INTRO'), OUTRO = num('OUTRO'), XFADE = num('XFADE');
const at = (id) => marks.find((m) => m.id === id).t;
// Evaluate the CLIPS array literal with `at` in scope.
const body = src.slice(src.indexOf('export const CLIPS'), src.indexOf('];', src.indexOf('export const CLIPS')) + 2).replace('export const CLIPS: Clip[] =', 'return');
const CLIPS = new Function('at', 'Math', body)(at, Math);
let t = Math.round(INTRO * FPS);
const cues = [{ s: 0, e: INTRO, text: 'FloodHUB, in use. A full run of the flood-risk tool on one basin. Waiting time is cut and some steps are sped up.' }];
for (const c of CLIPS) {
  const start = t - Math.round(XFADE * FPS);
  const len = Math.round(((c.to - c.from) / c.rate) * FPS) + Math.round(XFADE * FPS);
  t = start + len;
  const head = c.step > 0 ? `Step ${c.step} of 8: ${c.title}` : c.title;
  cues.push({ s: start / FPS + 0.3, e: t / FPS, text: `${head}. ${c.note ?? ''}${c.skipped ? ` (${c.skipped})` : ''}${c.rate !== 1 ? ` [${c.rate}x speed]` : ''}` });
}
cues.push({ s: t / FPS, e: t / FPS + OUTRO, text: "Equal weights and the app's default class breaks: an illustration of the pipeline, not a validated assessment. Step 8, shelter siting, is left out because it maps individual buildings." });
const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = (x % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`; };
fs.writeFileSync('out/tour.vtt', 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${ts(c.s)} --> ${ts(c.e)}\n${c.text}\n`).join('\n'));
console.log(cues.length, 'cues; ends at', (t / FPS + OUTRO).toFixed(1), 's');

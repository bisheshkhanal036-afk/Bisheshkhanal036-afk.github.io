/**
 * Edit decision list for the Khola / FloodHUB tour. Times come from marks.json, logged
 * by record.mjs while the real session was recorded, so each cut lands on a real event.
 * Speed-ups and the cut through report generation are stated on screen.
 */
import marks from './marks.json';

export const FPS = 25;
export const W = 1600;
export const H = 1000;

const at = (id: string) => {
  const m = marks.marks.find((x) => x.id === id);
  if (!m) throw new Error(`missing mark ${id}`);
  return m.t;
};

export interface Clip {
  /** Source seconds */
  from: number;
  to: number;
  rate: number;
  step: number; // 0 = intro of the app, 1..7 workflow steps
  title: string;
  note?: string;
  /** Slow zoom toward a point of the frame (0..1), for map moments */
  zoom?: { x: number; y: number; to: number };
  /** Show a "time skipped" stamp at the start of this clip */
  skipped?: string;
}

export const CLIPS: Clip[] = [
  { from: at('landing') + 0.3, to: at('aoi'), rate: 1.6, step: 0, title: 'Khola, the FloodHUB tool', note: 'Running locally in Docker' },
  { from: at('aoi'), to: at('criteria'), rate: 1, step: 1, title: 'Area of interest', note: 'A HydroBASINS level 8 basin containing the Kathmandu Valley', zoom: { x: 0.65, y: 0.5, to: 1.06 } },
  { from: at('criteria'), to: at('weighting'), rate: 2, step: 2, title: 'Criteria', note: 'Eleven factors, each reclassified from 1 to 5' },
  { from: at('weighting'), to: at('compute'), rate: 1.4, step: 3, title: 'Weighting', note: 'Equal weights in this session' },
  { from: at('compute'), to: at('report') - 2, rate: 1, step: 4, title: 'Compute', note: 'Criteria combined into a risk surface', zoom: { x: 0.66, y: 0.48, to: 1.12 } },
  { from: at('report') - 2, to: at('report') + 4, rate: 1, step: 5, title: 'Vulnerability report', note: 'Every building in the basin is tagged with a hazard class' },
  { from: at('report-done') - 1, to: at('validate'), rate: 1, step: 5, title: 'Vulnerability report', note: 'Area, people and buildings per hazard class', skipped: `${Math.round(at('report-done') - 1 - (at('report') + 4))} s of processing cut` },
  { from: at('validate'), to: at('meteor'), rate: 1.25, step: 6, title: 'Validate', note: 'Against flood incidents recorded on the BIPAD Portal, 2011 to 2026' },
  { from: at('meteor'), to: at('end'), rate: 1.25, step: 7, title: 'Compare to METEOR', note: 'Agreement with a modelled 1-in-100-year river flood' },
];

export const INTRO = 3.6; // s
export const OUTRO = 6.5; // s
export const XFADE = 0.5; // s crossfade between clips

export const clipFrames = (c: Clip) => Math.round(((c.to - c.from) / c.rate) * FPS);

export function layout() {
  let t = Math.round(INTRO * FPS);
  return CLIPS.map((c) => {
    const start = t - Math.round(XFADE * FPS);
    const len = clipFrames(c) + Math.round(XFADE * FPS);
    t = start + len;
    return { ...c, start, len };
  });
}

export function totalFrames() {
  const l = layout();
  const last = l[l.length - 1];
  return last.start + last.len + Math.round(OUTRO * FPS);
}

export const STEPS = ['Area of interest', 'Criteria', 'Weighting', 'Compute', 'Vulnerability report', 'Validate', 'Compare to METEOR', 'Shelters'];

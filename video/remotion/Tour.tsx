import React from 'react';
import {
  AbsoluteFill, Easing, OffthreadVideo, Sequence, continueRender, delayRender, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { FPS, INTRO, OUTRO, XFADE, STEPS, layout, totalFrames, type Clip } from './timeline';

// Site palette and type (fonts copied from the website build)
const PAPER = '#f3efe6', INK = '#1c2023', INK2 = '#4f555a', ACCENT = '#dba04a', ACCENT_D = '#b2741c', DARK = '#0d1215';
const SERIF = 'Newsreader, Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const fontHandle = delayRender('fonts');
Promise.all([
  new FontFace('Newsreader', `url(${staticFile('fonts/79c1e8686ff9f28f.woff2')})`, { weight: '400' }).load(),
  new FontFace('Newsreader', `url(${staticFile('fonts/ae3b4a9b831a88a3.woff2')})`, { weight: '500' }).load(),
  new FontFace('JetBrains Mono', `url(${staticFile('fonts/eb8cefc0a57905aa.woff2')})`, { weight: '100 800' }).load(),
]).then((faces) => { faces.forEach((f) => document.fonts.add(f)); continueRender(fontHandle); });

const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** One recorded clip: trimmed, speed-adjusted, with a slow zoom and crossfade in. */
const ClipView: React.FC<{ c: Clip & { len: number } }> = ({ c }) => {
  const f = useCurrentFrame();
  const xf = Math.round(XFADE * FPS);
  const opacity = interpolate(f, [0, xf], [0, 1], { extrapolateRight: 'clamp' });
  const z = c.zoom;
  const scale = z ? interpolate(f, [0, c.len], [1, z.to], { easing: Easing.inOut(Easing.quad), extrapolateRight: 'clamp' }) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: z ? `${z.x * 100}% ${z.y * 100}%` : '50% 50%' }}>
        <OffthreadVideo
          src={staticFile('session.webm')}
          trimBefore={Math.round(c.from * FPS)}
          playbackRate={c.rate}
          muted
          style={{ width: '100%', height: '100%' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Lower-third caption for a clip, slides up on entry. */
const Caption: React.FC<{ c: Clip & { len: number } }> = ({ c }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: f - 6, fps, config: { damping: 200 } });
  const outP = interpolate(f, [c.len - 10, c.len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const k = Math.min(inP, outP);
  return (
    <div style={{
      position: 'absolute', left: 460, right: 40, bottom: 34, padding: '18px 26px 20px',
      background: 'rgba(13,18,21,0.86)', borderLeft: `4px solid ${ACCENT}`, borderRadius: 4,
      transform: `translateY(${(1 - k) * 26}px)`, opacity: k, color: '#e9e3d6',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 1.5, color: ACCENT, textTransform: 'uppercase' }}>
        {c.step > 0 ? `Step ${c.step} of 8` : 'FloodHUB'}{c.rate !== 1 ? `  ·  ${c.rate}× speed` : ''}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 500, lineHeight: 1.15, marginTop: 6 }}>{c.title}</div>
      {c.note && <div style={{ fontFamily: SERIF, fontSize: 24, color: '#b8b2a4', marginTop: 6 }}>{c.note}</div>}
    </div>
  );
};

/** "Time skipped" stamp shown when a clip jumps over waiting time. */
const Skip: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, 45, 60], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', opacity: o,
      fontFamily: MONO, fontSize: 22, color: INK, background: ACCENT, padding: '8px 16px', borderRadius: 3 }}>
      ⏭ {text}
    </div>
  );
};

/** Eight-step rail across the top, filling as the tour advances. Step 8 is greyed (not shown). */
const Rail: React.FC<{ step: number }> = ({ step }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
    {STEPS.map((s, i) => (
      <div key={s} style={{ height: 6, background: i + 1 < step ? ACCENT_D : i + 1 === step ? ACCENT : i === 7 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.22)' }} />
    ))}
  </div>
);

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f, fps, config: { damping: 200 } });
  const b = spring({ frame: f - 10, fps, config: { damping: 200 } });
  const out = interpolate(f, [INTRO * FPS - 12, INTRO * FPS], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ background: PAPER, color: INK, justifyContent: 'center', padding: '0 140px', opacity: out }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 3, color: ACCENT_D, textTransform: 'uppercase', opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        Screen recording · 12 October 2026
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 92, fontWeight: 500, lineHeight: 1.05, marginTop: 18, letterSpacing: -1.5, opacity: b, transform: `translateY(${(1 - b) * 22}px)` }}>
        FloodHUB, in use
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 34, color: INK2, marginTop: 22, maxWidth: 1100, opacity: b }}>
        A full run of the flood-risk tool on one basin, from area of interest to validation. Waiting time is cut and some steps are sped up.
      </div>
      <div style={{ position: 'absolute', left: 140, right: 140, bottom: 120, height: 2, background: '#cdc4b1' }}>
        <div style={{ height: '100%', width: `${a * 100}%`, background: ACCENT_D }} />
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: PAPER, color: INK, justifyContent: 'center', padding: '0 140px', opacity: a }}>
      <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 3, color: ACCENT_D, textTransform: 'uppercase' }}>About this run</div>
      <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.3, marginTop: 18, maxWidth: 1200 }}>
        Equal weights and the app's default class breaks. The app itself marks a surface built this way as an illustration of the pipeline, not a validated assessment.
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 27, color: INK2, marginTop: 26, maxWidth: 1200, lineHeight: 1.4 }}>
        Step 8, shelter siting, is left out: it maps individual buildings.
      </div>
      <div style={{ fontFamily: MONO, fontSize: 17, color: INK2, marginTop: 44, maxWidth: 1300, lineHeight: 1.6 }}>
        Data: Copernicus GLO-30 DEM, ESA WorldCover, Sentinel-2, CHIRPS, HRSL, OpenStreetMap, BIPAD Portal, METEOR/Fathom. Basemap: Esri, HERE, Garmin, FAO, NOAA, USGS.
      </div>
    </AbsoluteFill>
  );
};

export const Tour: React.FC = () => {
  const clips = layout();
  const f = useCurrentFrame();
  const current = [...clips].reverse().find((c) => f >= c.start);
  const outroStart = totalFrames() - Math.round(OUTRO * FPS);
  return (
    <AbsoluteFill style={{ background: DARK }}>
      {clips.map((c, i) => (
        <Sequence key={i} from={c.start} durationInFrames={c.len} name={`${c.step} ${c.title}`}>
          <ClipView c={c} />
          <Caption c={c} />
          {c.skipped && <Skip text={c.skipped} />}
        </Sequence>
      ))}
      {current && f < outroStart && <Rail step={current.step} />}
      <Sequence from={0} durationInFrames={Math.round(INTRO * FPS)}><Intro /></Sequence>
      <Sequence from={outroStart}><Outro /></Sequence>
    </AbsoluteFill>
  );
};

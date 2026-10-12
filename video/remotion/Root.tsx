import React from 'react';
import { Composition } from 'remotion';
import { Tour } from './Tour';
import { FPS, W, H, totalFrames } from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="Tour" component={Tour} durationInFrames={totalFrames()} fps={FPS} width={W} height={H} />
);

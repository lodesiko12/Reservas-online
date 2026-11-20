import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './brand';
import {Piece, totalFrames, type Durations} from './Piece';
import {p01} from './pieces/p01';
import d01 from '../public/p01/durations.json';

export const Root: React.FC = () => (
  <>
    <Composition
      id="P01"
      component={Piece}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={totalFrames(p01, d01 as Durations)}
      defaultProps={{data: p01, durations: d01 as Durations}}
    />
  </>
);

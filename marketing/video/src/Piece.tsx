import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, FPS, SAFE_TOP} from './brand';
import {SCENES} from './scenes';
import type {PieceData, Sentence} from './types';

export type Durations = Record<string, number | boolean>;
export type PieceProps = {data: PieceData; durations: Durations};

const GAP = 5; // frames de aire entre frases
const TAIL = 12; // frames finales

export const framesOf = (s: Sentence, d: Durations) => Math.ceil(((d[s.id] as number) ?? 2) * FPS);

export const totalFrames = (data: PieceData, d: Durations) =>
  data.frases.reduce((acc, s, i) => acc + framesOf(s, d) + (i < data.frases.length - 1 ? GAP : 0), 0) + TAIL;

const BG = {oscuro: C.teal800, claro: C.bg, marca: C.teal600} as const;

/** Subtítulos: bloques de máx. 6 palabras, tiempos proporcionales a las letras. */
const Captions: React.FC<{s: Sentence; dur: number}> = ({s, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (s.bloques.length === 0) return null;
  const lens = s.bloques.map((b) => (b[0] + (b[1] ?? '')).length);
  const total = lens.reduce((a, b) => a + b, 0);
  const lead = 3;
  let acc = 0;
  const starts = lens.map((l) => {
    const st = lead + (acc / total) * (dur - lead);
    acc += l;
    return st;
  });
  let idx = 0;
  starts.forEach((st, i) => {
    if (frame >= st) idx = i;
  });
  const [l1, l2] = s.bloques[idx];
  const local = frame - starts[idx];
  const p = spring({frame: local, fps, config: {damping: 11, stiffness: 220, mass: 0.6}});
  const dark = s.tono !== 'claro';
  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        right: 80,
        top: SAFE_TOP + 70,
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 96,
        lineHeight: 1.08,
        letterSpacing: -1,
        color: dark ? '#fff' : C.text,
        transform: `scale(${0.82 + 0.18 * p})`,
        opacity: interpolate(local, [0, 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      }}
    >
      <div>{l1}</div>
      {l2 && <div style={{color: C.coral}}>{l2}</div>}
    </div>
  );
};

const Wipe: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 6], [-110, 110], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame > 6) return null;
  return <AbsoluteFill style={{background: C.coral, transform: `translateX(${x}%)`, opacity: 0.95}} />;
};

export const Piece: React.FC<PieceProps> = ({data, durations}) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: BG[data.frases[0].tono], fontFamily: FONT}}>
      {data.frases.map((s, i) => {
        const dur = framesOf(s, durations);
        const start = from;
        from += dur + GAP;
        const Scene = SCENES[s.visual];
        const isLast = i === data.frases.length - 1;
        // la última escena se alarga para cubrir el aire final
        const seqDur = dur + (isLast ? TAIL : GAP);
        return (
          <Sequence key={s.id} from={start} durationInFrames={seqDur}>
            <AbsoluteFill style={{background: BG[s.tono]}}>
              <Scene dur={dur} />
              <Captions s={s} dur={dur} />
              {i > 0 && <Wipe />}
              {durations._audio === true && <Audio src={staticFile(`${data.carpeta}/${s.id}.wav`)} startFrom={0} />}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

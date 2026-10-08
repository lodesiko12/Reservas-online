import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { TRACK } from "../music/track";

/** Forma mínima del `*.beats.json` que genera `npm run beats`. */
export type BeatMapJson = {
  file: string;
  durationSec: number;
  bpm: number;
  beatSec: number;
  firstBeatSec: number;
};

export type TrackSpec = {
  /** Ruta dentro de `public/`. */
  src: string;
  bpm: number;
  /** Segundo de la pista que cae en el beat 0 de la pieza (un primer tiempo de compás). */
  startSec: number;
  /** Volumen base de la música (0-1). */
  volume: number;
};

/**
 * Reloj de beats: pasa de "beat n" a frame. Todo el guion se escribe en beats; con tempo constante
 * (música electrónica/pop) basta el BPM, y `startSec` alinea el primer tiempo con el frame 0.
 */
export const makeBeats = (track: TrackSpec = TRACK, fps = 30) => {
  const framesPerBeat = (60 / track.bpm) * fps;
  return {
    bpm: track.bpm,
    framesPerBeat,
    /** Frame (redondeado) en el que cae el beat `n` (admite fracciones: 0,5 = contratiempo). */
    frame: (n: number) => Math.round(n * framesPerBeat),
    /** Frames que ocupan `n` beats. */
    span: (n: number) => Math.round(n * framesPerBeat),
    /** Frames de la pista que hay que recortar al principio para que el beat 0 caiga en el frame 0. */
    trimBefore: Math.round(track.startSec * fps),
  };
};

export type Beats = ReturnType<typeof makeBeats>;

/** Igual que `makeBeats` pero con el fps de la composición actual. */
export const useBeats = (track: TrackSpec = TRACK): Beats => {
  const { fps } = useVideoConfig();
  return useMemo(() => makeBeats(track, fps), [track, fps]);
};

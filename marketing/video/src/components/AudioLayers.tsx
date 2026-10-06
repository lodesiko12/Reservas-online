import { Audio } from "@remotion/media";
import type React from "react";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { MUSIC } from "../theme";

export type SfxName = "ding" | "pop" | "chime" | "tick";

/** Efecto de sonido de `public/sfx` (los genera `npm run sfx`). */
export const Sfx: React.FC<{ name: SfxName; from: number; volume?: number }> = ({ name, from, volume = 0.5 }) => {
  const { fps } = useVideoConfig();
  return <Audio name={`sfx ${name}`} src={staticFile(`sfx/${name}.wav`)} from={from} volume={volume} premountFor={fps} />;
};

/**
 * Música de fondo con "ducking": baja a `MUSIC.duckedVolume` mientras habla la
 * locución. No pinta nada si `MUSIC.src` es null.
 */
export const BackgroundMusic: React.FC<{ voiceRanges: [number, number][] }> = ({ voiceRanges }) => {
  if (!MUSIC.src) return null;
  const fade = 6;
  return (
    <Audio
      name="Música"
      src={staticFile(MUSIC.src)}
      loop
      volume={(f) => {
        const duck = Math.max(
          0,
          ...voiceRanges.map(([a, b]) =>
            interpolate(f, [a - fade, a, b, b + fade], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          ),
        );
        return interpolate(duck, [0, 1], [MUSIC.volume, MUSIC.duckedVolume]);
      }}
    />
  );
};

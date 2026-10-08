import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export type PunchHit = {
  /** Frame (relativo al padre) del golpe. */
  at: number;
  /** Zoom extra que se amortigua (0,06 = +6 %). */
  zoom?: number;
  /** Amplitud del temblor en px. */
  shake?: number;
  /** Frames que dura el temblor. */
  shakeFrames?: number;
};

const ZOOM_FRAMES = 9;

/** "Golpe" de cámara sobre toda la escena: zoom que rebota y temblor corto, para los kicks fuertes. */
export const Punch: React.FC<{ hits: PunchHit[]; children: React.ReactNode }> = ({ hits, children }) => {
  const frame = useCurrentFrame();
  let scale = 1;
  let sx = 0;
  let sy = 0;
  for (const h of hits) {
    const t = frame - h.at;
    if (t < 0) continue;
    if (t < ZOOM_FRAMES) scale += (h.zoom ?? 0.06) * (1 - t / ZOOM_FRAMES) ** 2;
    const d = h.shakeFrames ?? 6;
    if (t < d) {
      const amp = (h.shake ?? 14) * (1 - t / d) ** 2;
      sx += Math.sin(t * 2.9) * amp;
      sy += Math.cos(t * 3.7) * amp * 0.8;
    }
  }
  return <AbsoluteFill style={{ scale: String(scale), translate: `${sx}px ${sy}px` }}>{children}</AbsoluteFill>;
};

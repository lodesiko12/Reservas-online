import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "../lib/anim";

export type CameraKey = {
  /** Frame (relativo al padre). */
  at: number;
  /** Zoom (1 = encuadre completo). */
  scale: number;
  /** Punto del lienzo (px) que queda centrado en `center`. Por defecto, el centro del lienzo. */
  focus?: { x: number; y: number };
};

export type Shake = { at: number; intensity?: number; duration?: number };

type CameraProps = {
  keys: CameraKey[];
  /** Golpes de cámara (temblor que se amortigua). */
  shakes?: Shake[];
  /** Dónde se coloca el punto enfocado (por defecto el centro del lienzo). */
  center?: { x: number; y: number };
  /** Desvanece lo que suba por encima de esta altura (px) para no tapar el titular. */
  fadeTop?: number;
  children: React.ReactNode;
};

const EASE = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * Cámara virtual: interpola zoom y encuadre entre keyframes y añade temblores.
 * Todo lo que va dentro se mueve junto (plano, móvil…); titulares y subtítulos van fuera.
 */
export const Camera: React.FC<CameraProps> = ({ keys, shakes = [], center, fadeTop, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const c = center ?? { x: width / 2, y: height / 2 };

  // Cada keyframe → transform (origen 0,0): punto enfocado * escala + t = centro
  const pose = keys.map((k) => {
    const f = k.focus ?? c;
    return { at: k.at, s: k.scale, tx: c.x - f.x * k.scale, ty: c.y - f.y * k.scale };
  });
  const sorted = [...pose].sort((a, b) => a.at - b.at);
  const at = sorted.map((p) => p.at);
  const get = (key: "s" | "tx" | "ty") =>
    sorted.length === 1
      ? sorted[0][key]
      : interpolate(frame, at, sorted.map((p) => p[key]), { ...clamp, easing: EASE });

  let sx = 0;
  let sy = 0;
  let rot = 0;
  for (const sh of shakes) {
    const d = sh.duration ?? 12;
    const t = frame - sh.at;
    if (t < 0 || t > d) continue;
    const amp = (sh.intensity ?? 18) * (1 - t / d) ** 2;
    sx += Math.sin(t * 2.9) * amp;
    sy += Math.cos(t * 3.7) * amp * 0.8;
    rot += Math.sin(t * 2.3) * amp * 0.04;
  }

  const mask =
    fadeTop === undefined
      ? undefined
      : `linear-gradient(to bottom, transparent ${fadeTop - 70}px, black ${fadeTop + 10}px)`;

  return (
    <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          scale: String(get("s")),
          translate: `${get("tx") + sx}px ${get("ty") + sy}px`,
          rotate: `${rot}deg`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

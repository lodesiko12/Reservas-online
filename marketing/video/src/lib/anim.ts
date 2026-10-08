import { Easing, interpolate, spring } from "remotion";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Muelle 0→1 que arranca en `at`. */
export const springIn = (
  frame: number,
  fps: number,
  at = 0,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  spring({
    frame: frame - at,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.8, ...config },
  });

/** "Pop": 0→1 con un pequeño rebote, ideal para burbujas y chips. */
export const pop = (frame: number, fps: number, at = 0) =>
  springIn(frame, fps, at, { damping: 11, stiffness: 220, mass: 0.6 });

/** 1→0 durante `duration` frames a partir de `at` (salidas). */
export const fadeOut = (frame: number, at: number, duration = 8) =>
  interpolate(frame, [at, at + duration], [1, 0], { ...clamp, easing: EASE_IN });

/**
 * Transición "whip": entra (o sale) deslizando rápido con desenfoque de movimiento.
 * Devuelve estilos para aplicar al elemento. `dir` = desde dónde entra / hacia dónde sale.
 */
export const whip = (
  frame: number,
  at: number,
  mode: "in" | "out",
  dir: "left" | "right" | "up" | "down" = "right",
  duration = 9,
  distance = 1300,
) => {
  const p =
    mode === "in"
      ? interpolate(frame, [at, at + duration], [1, 0], { ...clamp, easing: EASE_OUT })
      : interpolate(frame, [at, at + duration], [0, 1], { ...clamp, easing: EASE_IN });
  const sign = dir === "left" || dir === "up" ? -1 : 1;
  const horizontal = dir === "left" || dir === "right";
  const offset = sign * p * distance;
  const blur = Math.sin(p * Math.PI) * 18;
  return {
    translate: horizontal ? `${offset}px 0px` : `0px ${offset}px`,
    filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
    opacity: mode === "out" && p >= 1 ? 0 : 1,
  } as const;
};

/** Pulso 1 → peak → 1 centrado en `at` (cambios de estado). */
export const pulse = (frame: number, at: number, peak = 1.12, duration = 14) =>
  interpolate(frame, [at, at + duration * 0.35, at + duration], [1, peak, 1], clamp);

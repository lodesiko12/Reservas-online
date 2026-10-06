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

/** Pulso 1 → peak → 1 centrado en `at` (cambios de estado). */
export const pulse = (frame: number, at: number, peak = 1.12, duration = 14) =>
  interpolate(frame, [at, at + duration * 0.35, at + duration], [1, peak, 1], clamp);

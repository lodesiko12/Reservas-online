import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT, clamp } from "../lib/anim";

type BurstProps = {
  /** Frame (relativo al padre) del estallido. */
  at: number;
  color: string;
  /** Tamaño del objeto que estalla (el anillo sale desde ahí). */
  size: number;
  /** Cuánto crece el anillo (px). */
  spread?: number;
  /** Número de chispas. */
  sparks?: number;
  duration?: number;
  /** Centro (px) relativo al contenedor posicionado. */
  x?: number;
  y?: number;
};

/** Anillo + chispas que salen hacia fuera: confirma visualmente un cambio. */
export const Burst: React.FC<BurstProps> = ({ at, color, size, spread = 110, sparks = 10, duration = 16, x = 0, y = 0 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > duration) return null;
  const p = interpolate(t, [0, duration], [0, 1], { ...clamp, easing: EASE_OUT });
  const fade = interpolate(t, [duration * 0.4, duration], [1, 0], clamp);
  const r = size / 2 + p * spread;

  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: -r,
          top: -r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          border: `${interpolate(p, [0, 1], [14, 2])}px solid ${color}`,
          opacity: fade,
        }}
      />
      {Array.from({ length: sparks }, (_, i) => {
        const a = (i / sparks) * Math.PI * 2 + 0.3;
        const d = size / 2 + 20 + p * (spread + 40);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Math.cos(a) * d - 6,
              top: Math.sin(a) * d - 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: i % 2 ? color : "#FF6B4A",
              opacity: fade,
              scale: String(1 - p * 0.6),
            }}
          />
        );
      })}
    </div>
  );
};

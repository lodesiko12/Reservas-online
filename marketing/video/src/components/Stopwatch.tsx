import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, pop, pulse } from "../lib/anim";
import { COLORS, FONT, RADIUS, STATUS } from "../theme";

type StopwatchProps = {
  /** Frame (relativo al padre) en el que aparece y arranca. */
  at: number;
  /** Frame en el que se para (se pone verde y da un pulso). */
  stopAt: number;
  /** Segundos que marca por cada segundo real (cámara rápida). */
  speed?: number;
  style?: React.CSSProperties;
};

/** Cronómetro en píldora (mm:ss) que corre en cámara rápida y se para en verde. */
export const Stopwatch: React.FC<StopwatchProps> = ({ at, stopAt, speed = 6, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const secs = Math.floor(((Math.min(frame, stopAt) - at) / fps) * speed);
  const stopped = frame >= stopAt;
  const p = pop(frame, fps, at);
  const color = stopped ? STATUS.confirmed.solid : COLORS.white;

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "18px 40px 18px 28px",
        borderRadius: RADIUS.pill,
        background: stopped ? STATUS.confirmed.tint : "rgba(255,255,255,0.10)",
        border: `4px solid ${color}`,
        color: stopped ? STATUS.confirmed.ink : COLORS.white,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 76,
        fontVariantNumeric: "tabular-nums",
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
        scale: String(interpolate(p, [0, 1], [0.5, 1]) * pulse(frame, stopAt, 1.15, 12)),
        ...style,
      }}
    >
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <circle cx="12" cy="13.5" r="8" />
        <path d="M12 9.5v4l2.5 2" />
        <path d="M9.5 2.5h5" />
        <path d={`M12 13.5 L${12 + Math.sin((frame - at) / 4) * 5} ${13.5 - Math.cos((frame - at) / 4) * 5}`} opacity={stopped ? 0 : 0.6} />
      </svg>
      {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
    </div>
  );
};

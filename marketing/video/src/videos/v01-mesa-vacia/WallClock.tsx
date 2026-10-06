import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_OUT, clamp, pop } from "../../lib/anim";
import { COLORS, FONT } from "../../theme";

type WallClockProps = {
  size: number;
  /** Minutos desde medianoche. */
  fromMinutes: number;
  toMinutes: number;
  /** Frames (relativos al padre) en los que avanzan las agujas. */
  runFrom: number;
  runTo: number;
  /** Frame de aparición. */
  at?: number;
  style?: React.CSSProperties;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Reloj de pared con agujas y hora digital que avanza entre dos horas. */
export const WallClock: React.FC<WallClockProps> = ({ size, fromMinutes, toMinutes, runFrom, runTo, at = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;

  const minutes = interpolate(frame, [runFrom, runTo], [fromMinutes, toMinutes], { ...clamp, easing: EASE_OUT });
  const minuteDeg = (minutes % 60) * 6;
  const hourDeg = ((minutes / 60) % 12) * 30;
  const shown = Math.floor(minutes);
  const p = pop(frame, fps, at);

  const hand = (len: number, width: number, deg: number, color: string) => (
    <div
      style={{
        position: "absolute",
        left: size / 2 - width / 2,
        top: size / 2 - len,
        width,
        height: len,
        borderRadius: width,
        background: color,
        transformOrigin: "50% 100%",
        rotate: `${deg}deg`,
      }}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORS.card,
        border: `${size * 0.045}px solid ${COLORS.ink}`,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        boxSizing: "border-box",
        fontFamily: FONT,
        scale: interpolate(p, [0, 1], [0.3, 1]),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
        ...style,
      }}
    >
      <div style={{ position: "absolute", inset: -size * 0.045 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: size / 2 - 3,
              top: size * 0.07,
              width: 6,
              height: i % 3 === 0 ? size * 0.09 : size * 0.05,
              borderRadius: 3,
              background: COLORS.ink,
              transformOrigin: `50% ${size / 2 - size * 0.07}px`,
              rotate: `${i * 30}deg`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: size * 0.6,
            textAlign: "center",
            fontSize: size * 0.13,
            fontWeight: 800,
            color: COLORS.inkMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pad(Math.floor(shown / 60) % 24)}:{pad(shown % 60)}
        </div>
        {hand(size * 0.25, size * 0.05, hourDeg, COLORS.ink)}
        {hand(size * 0.36, size * 0.032, minuteDeg, "#EF4444")}
        <div
          style={{
            position: "absolute",
            left: size / 2 - size * 0.04,
            top: size / 2 - size * 0.04,
            width: size * 0.08,
            height: size * 0.08,
            borderRadius: "50%",
            background: COLORS.ink,
          }}
        />
      </div>
    </div>
  );
};

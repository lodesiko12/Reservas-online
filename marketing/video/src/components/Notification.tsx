import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { EASE_IN, clamp, springIn } from "../lib/anim";
import { COLORS, FONT, STATUS, type StatusKey } from "../theme";
import { LogoMark } from "./Logo";

type NotificationProps = {
  title: string;
  body: string;
  /** Nombre de la app que envía la notificación. */
  appName?: string;
  time?: string;
  /** Punto de color de estado junto al título. */
  status?: StatusKey;
  /** Frame en el que cae desde arriba. */
  at?: number;
  /** Frame en el que vuelve a subir (opcional). */
  hideAt?: number;
  width?: number;
  style?: React.CSSProperties;
};

/** Banner de notificación estilo iOS que cae desde arriba. Se posiciona con `style` (top/left). */
export const Notification: React.FC<NotificationProps> = ({
  title,
  body,
  appName = BRAND.name,
  time = "ahora",
  status,
  at = 0,
  hideAt,
  width = 900,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;

  const enter = springIn(frame, fps, at, { damping: 16, stiffness: 170 });
  const exit = hideAt === undefined ? 0 : interpolate(frame, [hideAt, hideAt + 9], [0, 1], { ...clamp, easing: EASE_IN });
  if (exit >= 1) return null;

  return (
    <div
      style={{
        position: "absolute",
        width,
        display: "flex",
        gap: 24,
        alignItems: "center",
        padding: "26px 30px",
        borderRadius: 40,
        background: "rgba(250,250,252,0.97)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        fontFamily: FONT,
        color: COLORS.ink,
        translate: `0px ${interpolate(enter, [0, 1], [-260, 0]) - exit * 260}px`,
        opacity: interpolate(enter, [0, 0.3], [0, 1], clamp) * (1 - exit),
        ...style,
      }}
    >
      <LogoMark size={84} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 23, fontWeight: 600, color: COLORS.inkMuted }}>
          <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{appName}</span>
          <span>{time}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 32, fontWeight: 800 }}>
          {status ? (
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: STATUS[status].color, flexShrink: 0 }} />
          ) : null}
          {title}
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: "#3B4252" }}>{body}</div>
      </div>
    </div>
  );
};
